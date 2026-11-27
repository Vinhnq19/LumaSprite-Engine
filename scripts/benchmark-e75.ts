import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { makeRaster, nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { renderCharacter } from '../src/generators/character/render.ts';
import { checkCharacter } from '../src/quality/character.ts';
import { inspectPng, sha256 } from '../src/quality/raster.ts';
import { crossAssetStyle, loadArtDirection } from '../src/experiments/art-direction.ts';
import { loadCharacterContext, requireSceneParity, sampleCharacterContext } from '../src/experiments/character-pilot-context.ts';
import type { PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { characterPilotBrief, characterTrial, checkNegativeControls, type CharacterPilotBrief } from '../src/experiments/quality-guided-character.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';

const { values } = parseArgs({ options: { publish: { type: 'boolean' }, development: { type: 'boolean' } } });
assert.ok(!values.publish || !values.development);
const root = 'benchmarks/results/e75';
const scratch = 'benchmarks/results/run/e75';
const out = values.publish ? root : scratch;
const lockRef = { file: 'benchmarks/fixtures/e75/pilot-lock.json', sha256: '316a49cad68afee2a10b037d97351724d00289dd0f2ae99f5cd849ab3181ef12' };
const lock = JSON.parse((await pinnedFile(lockRef)).toString('utf8'));
const freezeFile = 'benchmarks/fixtures/e75/candidate-freeze.json';
const freeze = await readFile(freezeFile);
const frozen = JSON.parse(freeze.toString('utf8'));
assert.equal(frozen.briefLock, lockRef.sha256);
for (const [file, hash] of Object.entries(frozen.sources)) {
  assert.equal(sha256((await readFile(file, 'utf8')).replaceAll('\r\n', '\n')), hash);
}
const baseline = (await pinnedFile(lock.baseline)).toString('utf8').trim().split('\n');
assert.equal(baseline.length, 95);
for (const line of baseline) {
  const [sha256, file] = line.split('  ');
  await pinnedFile({ file, sha256 });
}

const { spec, profile } = await loadArtDirection(JSON.parse((await pinnedFile(lock.style)).toString('utf8')));
assert.deepEqual(spec.profile, lock.profile);
const style = crossAssetStyle(profile, spec).profile;
const variants = ['a0', 'a1', 'a2'] as const;
const payload = new Map<string, Buffer>();
const cases = [], timings = [];
const json = (name: string, value: object) => payload.set(name, Buffer.from(JSON.stringify(value, null, 2) + '\n'));

function crop(source: Raster, x: number, y: number, w: number, h: number) {
  const left = Math.max(0, Math.min(x, source.w - w)), top = Math.max(0, Math.min(y, source.h - h));
  const image = makeRaster(w, h);
  for (let row = 0; row < h; row++) {
    const start = ((top + row) * source.w + left) * 4;
    source.rgba.copy(image.rgba, row * w * 4, start, start + w * 4);
  }
  return { image, bounds: [left, top, w, h] };
}

function runCharacter(brief: CharacterPilotBrief, id: typeof variants[number]) {
  try {
    return { candidate: characterTrial(brief, id, profile, spec, lock.checkpoint), rejected: null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (!/geometry failed|contour margin|joint segment|cloak altered/i.test(reason)) throw error;
    const changes = brief.poses.find(pose => pose.id === id);
    const base = brief.spec;
    const raw = changes ? { ...base, pose: { ...base.pose, near: changes.near, far: changes.far } } : base;
    try {
      const draft = renderCharacter(raw);
      return { candidate: null, rejected: { flat: draft.flat, silhouette: draft.silhouette, reason, qa: checkCharacter(draft) } };
    } catch {
      return { candidate: null, rejected: { flat: null, silhouette: null, reason, qa: null } };
    }
  }
}

async function trial(brief: CharacterPilotBrief) {
  const sceneSpec: PilotBrief = JSON.parse((await pinnedFile(brief.context)).toString('utf8'));
  const context = await loadCharacterContext(brief, sceneSpec, style);
  const images = new Map<string, Raster>();
  const record = [];
  const counters = { structures: 0, materials: 0, compositionRenders: 0, ownershipPasses: 0, localPatches: 0 };
  let reference: ReturnType<typeof sampleCharacterContext> | undefined;
  const finishedShapeLocks: string[] = [];
  let negative: string[] = [];
  for (const id of variants) {
    const path = brief.id + '/' + id + '/';
    const pin = (file: string, raster: Raster) => {
      const name = path + file + '.png';
      images.set(name, raster);
      return root + '/' + name;
    };
    const pair = (file: string, raster: Raster) => ({ native: pin(file, raster), zoom: pin(file + '-4x', nearestNeighbor(raster, 4)) });
    counters.structures++;
    const { candidate, rejected } = runCharacter(brief, id);
    if (!candidate) {
      record.push({ id, status: 'SHAPE_GATE_FAIL', reason: rejected.reason, qa: rejected.qa,
        images: { flat: rejected.flat && pair('flat', rejected.flat), silhouette: rejected.silhouette && pair('silhouette', rejected.silhouette) } });
      continue;
    }
    const { frames, gate } = candidate;
    const geometry = { flat: pair('flat', frames.flat), silhouette: pair('silhouette', frames.silhouette),
      parts: pair('parts', frames.owners), pose: pair('pose', frames.pose) };
    if (!candidate.pass) {
      record.push({ id, status: 'SHAPE_GATE_FAIL', reason: candidate.reason, geometry, shapeQA: gate });
      continue;
    }
    finishedShapeLocks.push(gate.lock.silhouetteAlphaSha256);
    counters.materials++;
    counters.compositionRenders += 2;
    counters.ownershipPasses++;
    const sampled = sampleCharacterContext(context, candidate);
    if (reference) requireSceneParity(reference, sampled);
    else reference = sampled;
    const { landmarks } = candidate.body.plan;
    const [nx, ny] = landmarks['near-palm'].point, [fx, fy] = landmarks['far-palm'].point;
    const near = crop(candidate.frames.final, nx - 9, ny - 6, 20, 23);
    const far = crop(candidate.frames.final, fx - 7, fy - 15, 24, 28);
    const feet = crop(candidate.frames.final, 20, 42, 33, 18);
    const closeups = { near: { ...pair('near-grip', near.image), bounds: near.bounds },
      far: { ...pair('far-grip', far.image), bounds: far.bounds }, feet: { ...pair('feet', feet.image), bounds: feet.bounds } };
    record.push({ id, status: 'PASS', note: brief.poses.find(pose => pose.id === id)?.note ?? 'Existing v3 standing-free control.',
      scope: id === 'a0' ? 'CAPABILITY_GAP: base v3 has no dual toolkit or cloak layer.' : 'Landmark-bound equipment on the existing body rig.',
      geometry, shapeQA: gate, partLegend: candidate.layout.labels, materialQA: candidate.stats,
      art: { final: pair('material', candidate.frames.final), mask: pair('material-mask', candidate.frames.material),
        day: pair('day', sampled.day.raster), night: pair('night', sampled.night.raster), ...closeups,
        toolMasks: Object.fromEntries(Object.entries(candidate.toolMasks).map(([name, raster]) => [name, pair(name + '-mask', raster)])) },
      context: { scene: context.scene, source: brief.context, ...sampled.day.metadata, day: sampled.day.q, night: sampled.night.q },
      local: candidate.local });
    if (brief.role === 'development' && id === 'a1') negative = checkNegativeControls(candidate);
  }
  assert.equal(new Set(finishedShapeLocks).size, finishedShapeLocks.length, 'Pose differences disappeared beneath the equipment.');
  return { images, counters, record, negative, passing: record.filter(x => x.status === 'PASS').length };
}

for (const ref of lock.cases) {
  const brief = characterPilotBrief.parse(JSON.parse((await pinnedFile(ref)).toString('utf8')));
  if (values.development && brief.role === 'holdout') continue;
  assert.deepEqual([brief.profile, brief.style, brief.poses.map(pose => pose.id)], [lock.profile, lock.style, ['a1', 'a2']]);
  const start = process.cpuUsage(), wall = performance.now();
  const first = await trial(brief);
  const cpu = process.cpuUsage(start), repeatStart = process.cpuUsage();
  const second = await trial(brief);
  const repeated = process.cpuUsage(repeatStart);
  assert.deepEqual(first.record, second.record);
  assert.deepEqual(first.negative, second.negative);
  assert.deepEqual(first.counters, second.counters);
  assert.deepEqual([...first.images.keys()], [...second.images.keys()]);
  for (const [file, raster] of first.images) {
    const bytes = encodePng(raster);
    assert.deepEqual(inspectPng(raster, bytes, second.images.get(file)!), [], file);
    payload.set(file, bytes);
  }
  const file = brief.id + '/qa.json';
  json(file, { version: 1, provenance: ref, id: brief.id, role: brief.role, seed: brief.seed, style: spec.id,
    profile: spec.profile, view: spec.view, keyLight: spec.keyLight, codeRevision: lock.checkpoint, ...{
      candidates: first.record, negative: first.negative, animation: 'DESIGN_ONLY_AWAITING_STATIC_OWNER_APPROVAL',
    } });
  cases.push({ id: brief.id, name: brief.name, seed: brief.seed, role: brief.role, qa: file, brief: brief.brief, passing: first.passing,
    technical: first.passing === variants.length ? 'PASS' : 'TECHNICAL_BLOCKED' });
  timings.push({ id: brief.id, primaryCpuMicroseconds: cpu, repeatCpuMicroseconds: repeated, counters: first.counters,
    wallMsIncludingEncoding: Math.round(performance.now() - wall) });
  console.log(brief.id + ' · ' + first.passing + '/' + variants.length + ' shape/pose/material/context passes');
}

const criteria: string[] = lock.review;
json('human-review.json', {
  version: 1, status: 'PENDING_HUMAN_REVIEW', options: ['A0', 'A1', 'A2', 'Neither'], criteria,
  cases: cases.map(({ id }) => ({ id, selected: null, notes: '', scores: Object.fromEntries(variants
    .map(v => [v.toUpperCase(), Object.fromEntries(criteria.map(key => [key, null]))])) })),
});
const files = Object.fromEntries([...payload].map(([name, bytes]) => [root + '/' + name, sha256(bytes)]));
const pass = cases.every(c => c.technical === 'PASS');
json('benchmark.json', {
  version: 1, kind: 'lumasprite-quality-guided-static-character', technical: pass ? 'PASS' : 'TECHNICAL_BLOCKED',
  artistic: 'PENDING_HUMAN_REVIEW', checkpoint: lock.checkpoint, lock: lockRef, freeze: { file: freezeFile, sha256: sha256(freeze) },
  cases, files,
});
const sums = new Map([...Object.entries(files), [root + '/benchmark.json', sha256(payload.get('benchmark.json')!)]]);
payload.set('SHA256SUMS', Buffer.from([...sums].map(([file, digest]) => digest + '  ' + file + '\n').join('')));
for (const [file, bytes] of payload) {
  const output = out + '/' + file;
  await mkdir(dirname(output), { recursive: true });
  if (!values.publish) { await writeFile(output, bytes); continue; }
  const existing = await readFile(output).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (existing) assert.ok(existing.equals(bytes), file + ' differs from published evidence.');
  else await writeFile(output, bytes, { flag: 'wx' });
}
await mkdir(scratch, { recursive: true });
await writeFile(scratch + '/performance.json', JSON.stringify({
  version: 1, node: process.version, platform: process.platform, apiCalls: 0,
  bytes: [...payload.values()].reduce((size, bytes) => size + bytes.length, 0), developmentOnly: Boolean(values.development), timings,
}, null, 2) + '\n');
console.log((pass ? 'PASS' : 'TECHNICAL_BLOCKED') + ' · ' + sums.size + ' checksums');
if (!pass) process.exitCode = 1;
