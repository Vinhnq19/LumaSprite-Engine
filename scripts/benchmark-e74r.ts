import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { crossAssetStyle, loadArtDirection } from '../src/experiments/art-direction.ts';
import type { PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { instrumentContext } from '../src/experiments/quality-guided-context.ts';
import { analyzeContext, refineRim } from '../src/experiments/semantic-instrument-context.ts';
import { instrumentBrief, semanticInstrument, type InstrumentBrief } from '../src/experiments/semantic-instrument.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { inspectPng, sha256 } from '../src/quality/raster.ts';

const { values } = parseArgs({ options: { publish: { type: 'boolean' }, development: { type: 'boolean' } } });
assert.ok(!values.publish || !values.development);
const root = 'benchmarks/results/e74r';
const scratch = 'benchmarks/results/run/e74r';
const output = values.publish ? root : scratch;
const baselineRoot = 'benchmarks/results/e74/';
const lockRef = { file: 'benchmarks/fixtures/e74r/pilot-lock.json', sha256: '100092f92b9bdd26be9019a01ef7b3909c352b11539e67e4fc66a47b353203a6' };
const lock = JSON.parse((await pinnedFile(lockRef)).toString('utf8'));
const freezeFile = 'benchmarks/fixtures/e74r/candidate-freeze.json';
const frozen = await readFile(freezeFile);
const guard = JSON.parse(frozen.toString('utf8'));
assert.equal(guard.briefLock, lockRef.sha256);
for (const [file, hash] of Object.entries(guard.sources)) {
  assert.equal(sha256((await readFile(file, 'utf8')).replaceAll('\r\n', '\n')), hash);
}

const legacy = new Map<string, string>();
for (const line of (await pinnedFile(lock.baseline)).toString('utf8').trim().split('\n')) {
  const [checksum, relative] = line.split('  ');
  const file = baselineRoot + relative;
  await pinnedFile({ file, sha256: checksum });
  legacy.set(relative, checksum);
}
assert.equal(legacy.size, 85);
const { spec, profile } = await loadArtDirection(JSON.parse((await pinnedFile(lock.style)).toString('utf8')));
assert.deepEqual(spec.profile, lock.profile);
const style = crossAssetStyle(profile, spec);
const target = new Map<string, Buffer>();
const reused = new Map<string, string>();
const cases = [];
const costs = [];
const json = (path: string, value: object) => target.set(path, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
const schedule = () => ({ structure: 0, material: 0, attemptedPatches: 0, effectivePatches: 0, scene: 0, ownership: 0 });

function legacyImage(relative: string) {
  const path = baselineRoot + relative;
  const hash = legacy.get(relative);
  assert.ok(hash, relative + ' must be locked in E7.4.');
  reused.set(path, hash);
  return path;
}

async function trial(brief: InstrumentBrief, counters: ReturnType<typeof schedule>) {
  counters.structure++;
  const art = semanticInstrument(brief, style.device, lock.budget.maximumPalette);
  const images = new Map<string, Raster>();
  const pin = (name: string, raster: Raster) => {
    const file = brief.id + '/' + name + '.png';
    images.set(file, raster);
    return root + '/' + file;
  };
  const pair = (name: string, raster: Raster) => ({ native: pin(name, raster), zoom: pin(name + '-4x', nearestNeighbor(raster, 4)) });
  const geometry = { flat: pair('flat', art.flat), silhouette: pair('silhouette', art.silhouette), landmarks: pair('landmarks', art.labels) };
  if (!art.final || !art.ownership) return { images, complete: false as const, data: { geometry, shapeQA: art.proof } };
  counters.material++;
  const before = { raster: art.final, ownership: art.ownership, labels: art.labels, pivot: art.proof.pivot };
  const sceneFixture: PilotBrief = JSON.parse((await pinnedFile(brief.context)).toString('utf8'));
  const placement = await instrumentContext(sceneFixture, style.profile);
  const measured = analyzeContext(placement, before, art.proof.landmarks, lock.budget.weakContrast, phase => counters[phase]++);
  counters.attemptedPatches++;
  const patch = refineRim(before, measured.views.night, placement.placement.at, style.device,
    lock.budget.weakContrast, lock.budget.localPatchPixels);
  const after = patch.qa.changed ? analyzeContext(placement, { ...before, raster: patch.raster },
    art.proof.landmarks, lock.budget.weakContrast, phase => counters[phase]++) : measured;
  if (patch.qa.changed) {
    counters.effectivePatches++;
    const scene = Buffer.from(measured.views.night.rgba);
    const [x, y] = placement.placement.at;
    for (let i = 0; i < 32 * 32; i++) if (patch.edit.rgba[i * 4 + 3]) {
      const worldX = x - before.pivot[0] + i % 32, worldY = y - before.pivot[1] + Math.floor(i / 32);
      scene.writeUInt32BE(patch.raster.rgba.readUInt32BE(i * 4), (worldY * measured.views.night.w + worldX) * 4);
    }
    assert.ok(scene.equals(after.views.night.rgba), 'A Night patch affected other scene pixels.');
  }
  assert.equal(measured.contract, after.contract);
  assert.ok(patch.qa.used.length <= lock.budget.maximumPalette);
  const artFiles = {
    ...geometry, material: pair('material', art.final), ownership: pin('ownership', art.ownership),
    day: pair('day', measured.views.day), night: pair('night', measured.views.night),
  };
  const patchFiles = patch.qa.changed ? { native: pair('patched', patch.raster), night: pair('patched-night', after.views.night),
    mask: pin('target-mask', patch.edit), diff: pair('pixel-diff', patch.diff) } : null;
  return { images, complete: true as const, data: { geometry: artFiles, shapeQA: art.proof, materialQA: art.qa,
    context: { ...measured.qa, contract: measured.contract, placement: placement.placement.at, fixture: brief.context },
    patch: { ...patch.qa, files: patchFiles, before: measured.qa.night, after: after.qa.night,
      semanticLandmarksExact: true, humanEvaluation: 'PENDING_HUMAN_REVIEW', scope: 'Night only' } } };
}

for (const ref of lock.cases) {
  const brief = instrumentBrief.parse(JSON.parse((await pinnedFile(ref)).toString('utf8')));
  if (values.development && brief.role === 'holdout') continue;
  assert.equal(brief.role === 'holdout', brief.before === null);
  assert.deepEqual(brief.style, lock.style);
  const firstCount = schedule(), repeatCount = schedule();
  const wall = performance.now(), cpu = process.cpuUsage();
  const first = await trial(brief, firstCount);
  const primary = process.cpuUsage(cpu), repeatStart = process.cpuUsage();
  const repeat = await trial(brief, repeatCount);
  const repeated = process.cpuUsage(repeatStart);
  assert.deepEqual(firstCount, repeatCount);
  assert.deepEqual(first.data, repeat.data);
  assert.deepEqual([...first.images.keys()], [...repeat.images.keys()]);
  for (const [name, raster] of first.images) {
    const bytes = encodePng(raster);
    assert.deepEqual(inspectPng(raster, bytes, repeat.images.get(name)!), []);
    target.set(name, bytes);
  }
  let historical;
  if (brief.before) {
    const parent = JSON.parse((await pinnedFile(brief.before.brief)).toString('utf8'));
    assert.deepEqual([parent.id, parent.seed, parent.context], [brief.id, brief.seed, brief.context]);
    const historicPath = brief.id + '/qa.json';
    const qa = JSON.parse((await pinnedFile({ file: baselineRoot + historicPath, sha256: legacy.get(historicPath)! })).toString('utf8'));
    historical = ['a0', brief.before.candidate].map(id => {
      const data = qa.candidates.find((item: { id: string }) => item.id === id);
      const pair = (view: { native: string; zoom: string }) => ({ native: legacyImage(view.native), zoom: legacyImage(view.zoom) });
      return { id, files: { flat: pair(data.flat), silhouette: pair(data.silhouette), material: pair(data.material),
        day: pair(data.inScene.day), night: pair(data.inScene.night), ownership: legacyImage(data.ownership) },
      context: data.inScene.qa, shape: data.shapeQA, qaSha256: legacy.get(historicPath) };
    });
    if (first.complete) assert.equal(first.data.context.contract, qa.cameraContract, 'Scene contract drifted from E7.4.');
  }
  const qa = brief.id + '/qa.json';
  json(qa, { version: 1, source: ref, seed: brief.seed, profile: spec.profile, style: brief.style, view: spec.view,
    keyLight: spec.keyLight, priority: brief.priority, previous: historical ?? null, ...first.data });
  const patch = first.complete ? first.data.patch.changed : 0;
  cases.push({ id: brief.id, name: brief.name, role: brief.role, seed: brief.seed, brief: brief.brief, qa, patched: patch > 0,
    technical: first.complete ? 'PASS' : 'SHAPE_GATE_FAIL' });
  costs.push({ id: brief.id, primary: { cpuMicroseconds: primary, count: firstCount },
    deterministicRepeat: { cpuMicroseconds: repeated, count: repeatCount }, wallMs: Math.round(performance.now() - wall) });
  console.log(brief.id + ' · ' + first.data.shapeQA.status + ' · ' + patch + ' locally edited px');
}

const criteria = ['function', 'silhouette', 'material', 'clusters', 'dayNight', 'localGain'];
json('human-review.json', { version: 1, status: 'PENDING_HUMAN_REVIEW', criteria,
  cases: cases.map(({ id, role, patched }) => {
    const options = [...(role === 'development' ? ['Baseline', 'E7.4'] : []), 'E7.4R', ...(patched ? ['Night patch'] : []), 'Neither'];
    return { id, options, selected: null, scores: Object.fromEntries(options.filter(option => option !== 'Neither')
      .map(option => [option, Object.fromEntries(criteria.map(criterion => [criterion, null]))])), notes: '' };
  }) });
const files = Object.fromEntries([...target].map(([p, bytes]) => [root + '/' + p, sha256(bytes)]));
const pass = cases.every(test => test.technical === 'PASS');
json('benchmark.json', { version: 1, kind: 'lumasprite-semantic-context-instruments',
  technical: pass ? 'PASS' : 'TECHNICAL_BLOCKED', artistic: 'PENDING_HUMAN_REVIEW', checkpoint: lock.checkpoint,
  lock: lockRef, freeze: { file: freezeFile, sha256: sha256(frozen) }, cases, files, reused: Object.fromEntries(reused) });
const checksums = new Map([...Object.entries(files), ...reused, [root + '/benchmark.json', sha256(target.get('benchmark.json')!)]]);
target.set('SHA256SUMS', Buffer.from([...checksums].map(([path, checksum]) => checksum + '  ' + path + '\n').join('')));
for (const [name, bytes] of target) {
  const path = output + '/' + name;
  await mkdir(dirname(path), { recursive: true });
  if (!values.publish) { await writeFile(path, bytes); continue; }
  const old = await readFile(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (old) assert.ok(old.equals(bytes), name + ' differs from the published artifact.');
  else await writeFile(path, bytes, { flag: 'wx' });
}
await mkdir(scratch, { recursive: true });
await writeFile(scratch + '/performance.json', JSON.stringify({
  version: 1, node: process.version, platform: process.platform, onlyDevelopment: Boolean(values.development),
  apiCalls: 0, bytes: [...target.values()].reduce((n, bytes) => n + bytes.length, 0), runs: costs,
}, null, 2) + '\n');
console.log(cases.length + ' cases · ' + checksums.size + ' SHA-256 entries · technical ' + (pass ? 'PASS' : 'BLOCKED'));
if (!pass) process.exitCode = 1;
