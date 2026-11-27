import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { pack } from '../src/core/palette/colors.ts';
import { makeRaster, nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { crossAssetStyle, loadArtDirection } from '../src/experiments/art-direction.ts';
import { identityBrief, identityCandidate, negativeIdentity } from '../src/experiments/character-identity.ts';
import { loadCharacterContext } from '../src/experiments/character-pilot-context.ts';
import type { PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { identityContext, sameContext } from '../src/experiments/identity-character-context.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { inspectPng, sha256 } from '../src/quality/raster.ts';

const { values } = parseArgs({ options: { publish: { type: 'boolean' }, development: { type: 'boolean' } } });
assert.ok(!values.publish || !values.development);
const root = 'benchmarks/results/e75r', scratch = 'benchmarks/results/run/e75r';
const lockRef = { file: 'benchmarks/fixtures/e75r/pilot-lock.json', sha256: '84d16b6ef1f95f9894f6e2bc5e00aeda09cd120e8b7e8bf020a1b512296294cf' };
const lock = JSON.parse((await pinnedFile(lockRef)).toString('utf8'));
const freezeFile = 'benchmarks/fixtures/e75r/candidate-freeze.json';
const freeze = await readFile(freezeFile);
const sources = JSON.parse(freeze.toString('utf8'));
assert.equal(sources.briefLock, lockRef.sha256);
for (const [file, hash] of Object.entries(sources.sources)) {
  assert.equal(sha256((await readFile(file, 'utf8')).replaceAll('\r\n', '\n')), hash);
}
const old = new Map<string, string>();
for (const row of (await pinnedFile(lock.baseline)).toString('utf8').trim().split('\n')) {
  const [sha256, file] = row.split('  ');
  assert.ok(file.startsWith('benchmarks/results/e75/'));
  await pinnedFile({ file, sha256 });
  old.set(file, sha256);
}
assert.equal(old.size, 148);
const { spec, profile } = await loadArtDirection(JSON.parse((await pinnedFile(lock.style)).toString('utf8')));
assert.deepEqual(spec.profile, lock.profile);
const style = crossAssetStyle(profile, spec).profile;
const payload = new Map<string, Buffer>(), reused = new Map<string, string>(), cases = [], performanceRows = [];
const json = (file: string, data: object) => payload.set(file, Buffer.from(JSON.stringify(data, null, 2) + '\n'));

type Preview = { native: string; zoom: string };
type Legacy = { id: string; geometry: Record<string, Preview>; art: Record<string, Preview>; context: object; shapeQA: object };
type Sample = { id: string; status: string; views: Record<string, Preview>; qa: object };
const views = ['material', 'day', 'night', 'flat', 'silhouette', 'parts', 'pose', 'near', 'far', 'feet', 'mask'];
const labels = ['a0', 'a1', 'a2', 'matched', 'refined'];

function crop(source: Raster, x: number, y: number, w: number, h: number) {
  const left = Math.max(0, Math.min(x, source.w - w)), top = Math.max(0, Math.min(y, source.h - h));
  const r = makeRaster(w, h);
  for (let row = 0; row < h; row++) {
    const start = ((row + top) * source.w + left) * 4;
    source.rgba.copy(r.rgba, row * w * 4, start, start + w * 4);
  }
  return r;
}

function compare(before: Raster, after: Raster) {
  const image = makeRaster(64, 64), mask = makeRaster(64, 64);
  let coverage = 0, added = 0, removed = 0, sharedRgb = 0;
  const beforeBytes: Buffer[] = [], afterBytes: Buffer[] = [];
  for (let i = 0; i < before.rgba.length; i += 4) {
    if (before.rgba.readUInt32BE(i) === after.rgba.readUInt32BE(i)) {
      beforeBytes.push(before.rgba.subarray(i, i + 4));
      afterBytes.push(after.rgba.subarray(i, i + 4));
      continue;
    }
    coverage++;
    const add = !before.rgba[i + 3], remove = !after.rgba[i + 3];
    added += Number(add);
    removed += Number(remove);
    sharedRgb += Number(!add && !remove);
    image.rgba.writeUInt32BE(pack(add ? '#66dfbb' : remove ? '#ec7c8c' : '#ffc66d'), i);
    mask.rgba.writeUInt32BE(pack('#ffffff'), i);
  }
  const beforeHash = sha256(Buffer.concat(beforeBytes)), afterHash = sha256(Buffer.concat(afterBytes));
  assert.equal(beforeHash, afterHash);
  return { image, mask, geometryDelta: { coverage, added, removed, sharedRgb, unchanged: 4096 - coverage,
    unchangedBefore: beforeHash, unchangedAfter: afterHash } };
}

for (const lockCase of lock.cases) {
  const brief = identityBrief.parse(JSON.parse((await pinnedFile(lockCase)).toString('utf8')));
  if (values.development && brief.role === 'holdout') continue;
  assert.deepEqual([brief.profile, brief.style], [lock.profile, lock.style]);
  const prior: Sample[] = [];
  if (brief.historical) {
    const legacyBrief = JSON.parse((await pinnedFile(brief.historical)).toString('utf8'));
    assert.deepEqual([legacyBrief.id, legacyBrief.seed, legacyBrief.spec, legacyBrief.context], [brief.id, brief.seed, brief.spec, brief.context]);
    const historicalPath = 'benchmarks/results/e75/' + brief.id + '/qa.json';
    const historic = JSON.parse((await pinnedFile({ file: historicalPath, sha256: old.get(historicalPath)! })).toString('utf8'));
    for (const item of historic.candidates as Legacy[]) {
      const raw: Record<string, Preview> = { ...item.geometry, ...item.art, material: item.art.final };
      const images: Record<string, Preview> = Object.fromEntries(views.map(view => [view, { native: raw[view].native, zoom: raw[view].zoom }]));
      for (const paths of Object.values(images)) for (const file of Object.values(paths)) {
        assert.ok(old.has(file), file);
        reused.set(file, old.get(file)!);
      }
      prior.push({ id: item.id, status: 'HISTORICAL', views: images, qa: { context: item.context, shape: item.shapeQA, historicalPath } });
    }
  }
  const scene: PilotBrief = JSON.parse((await pinnedFile(brief.context)).toString('utf8'));
  const context = await loadCharacterContext(brief as unknown as Parameters<typeof loadCharacterContext>[0], scene, style);
  const modes = brief.matched ? ['matched', 'refined'] as const : ['refined'] as const;
  assert.equal(Boolean(brief.matched), brief.role === 'development');
  if (brief.matched) assert.deepEqual(brief.matched.tools.map(t => [t.kind, t.hand]), brief.refined.tools.map(t => [t.kind, t.hand]));
  const original = prior.find(item => item.id === brief.selected);
  const historicImage = original && decodePng(await pinnedFile({ file: original.views.material.native, sha256: old.get(original.views.material.native)! }));

  const trial = () => {
    const images = new Map<string, Raster>(), samples: Sample[] = [], diffs: Record<string, object> = {};
    let matched: Extract<ReturnType<typeof identityCandidate>, { pass: true }> | undefined;
    let matchedContext: ReturnType<typeof identityContext> | undefined;
    let negatives: string[] = [];
    const save = (relative: string, raster: Raster) => {
      const file = brief.id + '/' + relative + '.png';
      images.set(file, raster);
      return root + '/' + file;
    };
    const pair = (file: string, raster: Raster) => ({ native: save(file, raster), zoom: save(file + '-4x', nearestNeighbor(raster, 4)) });
    for (const mode of modes) {
      let c;
      try {
        c = identityCandidate(brief, mode, profile, spec, lock.checkpoint);
      } catch (error) {
        samples.push({ id: mode, status: 'TECHNICAL_BLOCKED', views: {}, qa: { failure: error instanceof Error ? error.message : String(error) } });
        continue;
      }
      const p = (file: string, raster: Raster) => pair(mode + '/' + file, raster);
      const shape = { flat: p('flat', c.frames.flat), silhouette: p('silhouette', c.frames.silhouette),
        parts: p('parts', c.frames.owners), pose: p('pose', c.frames.pose) };
      if (!c.pass) {
        samples.push({ id: mode, status: 'TECHNICAL_BLOCKED', views: shape, qa: { failure: c.reason, lock: c.lock } });
        continue;
      }
      const sampled = identityContext(context, c);
      if (mode === 'matched') { matched = c; matchedContext = sampled; }
      if (mode === 'refined') {
        negatives = negativeIdentity(c);
        if (matched && matchedContext) {
          sameContext(matchedContext, sampled);
          assert.ok(matched.body.layers['near-boot'].rgba.equals(c.body.layers['near-boot'].rgba), 'PLANTED_BOOT_DRIFT');
        }
        for (const [key, parent] of [['from-selected', historicImage], ['from-matched', matched?.frames.final]] as const) {
          if (!parent) continue;
          const delta = compare(parent, c.frames.final);
          diffs[key] = { pixels: pair(key + '-diff', delta.image), mask: pair(key + '-edit-mask', delta.mask), ...delta.geometryDelta };
        }
      }
      const [nx, ny] = c.anchors.near, [fx, fy] = c.anchors.far;
      const pic = c.frames.final;
      const output = { ...shape, material: p('material', pic), near: p('near', crop(pic, nx - 11, ny - 6, 24, 25)),
        far: p('far', crop(pic, fx - 9, fy - 20, 25, 30)), feet: p('feet', crop(pic, 20, 42, 33, 18)), mask: p('mask', c.frames.material),
        day: p('day', sampled.day.raster), night: p('night', sampled.night.raster) };
      samples.push({ id: mode, status: 'PASS', views: output, qa: {
        defect: brief.defect, grip: { technical: c.technicalGrip, artistic: c.artisticGrip, anchors: c.grips },
        pose: c.body.metadata.diagnostics, lock: c.lock, shape: c.silhouetteStat, labels: c.layout.labels,
        partOwnerSha256: sha256(c.frames.owners.rgba), palette: c.stat.used, material: c.stat,
        protected: { ...c.protectedState, rgbPatchApplied: false, postLockStatus: 'NO_MEANINGFUL_VISUAL_GAIN' },
        context: { day: sampled.day.qa, night: sampled.night.qa, scene: context.scene, source: brief.context },
      } });
    }
    return { images, samples, diffs, negatives };
  };
  const firstStart = process.cpuUsage();
  const first = trial();
  const primary = process.cpuUsage(firstStart);
  const repeatStart = process.cpuUsage();
  const repeat = trial();
  const repeated = process.cpuUsage(repeatStart);
  assert.deepEqual(first.samples, repeat.samples);
  assert.deepEqual(first.diffs, repeat.diffs);
  assert.deepEqual(first.negatives, repeat.negatives);
  assert.deepEqual([...first.images.keys()], [...repeat.images.keys()]);
  for (const [file, raster] of first.images) {
    const bytes = encodePng(raster);
    assert.deepEqual(inspectPng(raster, bytes, repeat.images.get(file)!), []);
    payload.set(file, bytes);
  }
  const file = brief.id + '/qa.json';
  const complete = first.samples.every(s => s.status === 'PASS');
  const matchedPassed = first.samples.some(s => s.id === 'matched' && s.status === 'PASS');
  const comparison = brief.role === 'holdout' ? 'HOLDOUT' : matchedPassed ? 'CAPABILITY_MATCHED' : 'FAIR_COMPARISON_NOT_ESTABLISHED';
  json(file, { version: 1, brief: lockCase, seed: brief.seed, profile: brief.profile, style: brief.style, view: brief.view,
    historicalSelection: brief.selected, comparison, selection: null, candidates: [...prior, ...first.samples],
    diffs: first.diffs, negative: first.negatives, animation: 'DESIGN_ONLY_AWAITING_OWNER' });
  cases.push({ id: brief.id, name: brief.name, role: brief.role, seed: brief.seed, qa: file, technical: complete ? 'PASS' : 'TECHNICAL_BLOCKED',
    options: [...prior, ...first.samples].filter(item => labels.includes(item.id)).map(item => item.id) });
  performanceRows.push({ id: brief.id, primaryCpuMicroseconds: primary, repeatCpuMicroseconds: repeated,
    bodyBuilds: modes.length, gameplayRenders: first.samples.filter(s => s.status === 'PASS').length * 2 });
  console.log(brief.id + ' · ' + comparison + ' · ' + first.samples.map(s => s.id + ':' + s.status).join(', '));
}
const criteria: string[] = lock.criteria;
json('human-review.json', { version: 1, status: 'PENDING_HUMAN_REVIEW', criteria,
  cases: cases.map(c => ({ id: c.id, options: [...c.options, 'neither'], chosen: null, notes: '',
    scores: Object.fromEntries(c.options.map(o => [o, Object.fromEntries(criteria.map(key => [key, null]))])) })) });
const files = Object.fromEntries([...payload].map(([name, bytes]) => [root + '/' + name, sha256(bytes)]));
const pass = cases.every(c => c.technical === 'PASS');
json('benchmark.json', { version: 1, kind: 'lumasprite-character-identity-fair-comparison', checkpoint: lock.checkpoint,
  technical: pass ? 'PASS' : 'TECHNICAL_BLOCKED', artistic: 'PENDING_HUMAN_REVIEW',
  lock: lockRef, freeze: { file: freezeFile, sha256: sha256(freeze) }, cases, files, reused: Object.fromEntries(reused) });
const all = new Map([...Object.entries(files), ...reused, [root + '/benchmark.json', sha256(payload.get('benchmark.json')!)]]);
payload.set('SHA256SUMS', Buffer.from([...all].map(([name, hash]) => hash + '  ' + name + '\n').join('')));
for (const [name, bytes] of payload) {
  const path = (values.publish ? root : scratch) + '/' + name;
  await mkdir(dirname(path), { recursive: true });
  if (!values.publish) { await writeFile(path, bytes); continue; }
  const current = await readFile(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (current) assert.ok(current.equals(bytes), name + ' differs from published artifact');
  else await writeFile(path, bytes, { flag: 'wx' });
}
await mkdir(scratch, { recursive: true });
await writeFile(scratch + '/performance.json', JSON.stringify({ version: 1, node: process.version, platform: process.platform,
  apiCalls: 0, bytes: [...payload.values()].reduce((n, b) => n + b.length, 0), runs: performanceRows }, null, 2) + '\n');
console.log(all.size + ' SHA-256 checksums.');
if (!pass) process.exitCode = 1;
