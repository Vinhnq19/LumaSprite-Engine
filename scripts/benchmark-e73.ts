import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { pack } from '../src/core/palette/colors.ts';
import { blit, makeRaster, nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { loadArtDirection } from '../src/experiments/art-direction.ts';
import { preparePilot, renderPilot, type PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { inspectStructure, pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { alphaPlane } from '../src/generators/character/shape-lock.ts';
import { inspectPng, sha256 } from '../src/quality/raster.ts';

const published = 'benchmarks/results/e73';
const lockFile = 'benchmarks/fixtures/e73/brief-lock.json';
const lockSha = '14bb8fedbf2b74c0f36d317863a8e2f9fa6d827c351df0388afb92533a3cc374';
const { values } = parseArgs({ options: { publish: { type: 'boolean' }, development: { type: 'boolean' }, out: { type: 'string' } } });
assert.ok(!values.publish || (!values.out && !values.development));
const output = values.publish ? published : values.out ?? 'benchmarks/results/run/e73';
const evidence = new Map<string, Buffer>();
const lock = JSON.parse((await pinnedFile({ file: lockFile, sha256: lockSha })).toString('utf8'));
const { spec, profile } = await loadArtDirection(JSON.parse((await pinnedFile(lock.direction)).toString('utf8')));
const json = (file: string, value: object) => evidence.set(file, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
const reviewAreas = ['character', 'prop', 'environment', 'setConsistency'];

function background(source: Raster, color: string) {
  const preview = makeRaster(source.w, source.h);
  const ink = Buffer.alloc(4);
  ink.writeUInt32BE(pack(color));
  preview.rgba.fill(ink);
  blit(preview, source, 0, 0);
  return preview;
}

function publishImage(path: string, first: Raster, second: Raster) {
  const bytes = encodePng(first);
  assert.deepEqual(inspectPng(first, bytes, second), [], path);
  if (!path.endsWith('-4x')) inspectStructure(first);
  evidence.set(path + '.png', bytes);
}

const previewKeys = ['character', 'prop', 'environment', 'environment-night', 'scene-day', 'scene-night'] as const;
const backgrounds = { light: '#c8bda7', dark: '#32333e' };

const cases = [];
for (const ref of lock.briefs) {
  if (values.development && ref.role !== 'development') continue;
  const brief: PilotBrief = JSON.parse((await pinnedFile(ref)).toString('utf8'));
  assert.deepEqual([brief.id, brief.role, brief.seed], [ref.id, ref.role, ref.seed]);
  assert.deepEqual(brief.direction, lock.direction);
  assert.deepEqual(brief.profile, spec.profile);
  const input = await preparePilot(brief, lock.checkpoint);
  assert.equal(input.base.environment.spec.style.sha256, spec.profile.sha256);
  const a = renderPilot(input, profile);
  const repeatA = renderPilot(await preparePilot(brief, lock.checkpoint), profile);
  const b = renderPilot(input, profile, spec);
  const repeatB = renderPilot(await preparePilot(brief, lock.checkpoint), profile, spec);
  assert.deepEqual(a.geometry, b.geometry, 'A/B scene geometry, scale or occlusion drifted.');
  for (const stem of ['character', 'prop', 'environment'] as const) {
    assert.deepEqual(alphaPlane(a.pngs[stem]), alphaPlane(b.pngs[stem]), stem + ' alpha differs.');
    const mask = `${stem}-material` as const;
    const silhouette = `${stem}-silhouette` as const;
    assert.ok(a.pngs[mask].rgba.equals(b.pngs[mask].rgba), stem + ' mask differs.');
    assert.ok(a.pngs[silhouette].rgba.equals(b.pngs[silhouette].rgba), stem + ' silhouette differs.');
    assert.ok(!a.pngs[stem].rgba.equals(b.pngs[stem].rgba), stem + ' did not use shared direction.');
  }
  for (const key of ['scene-flat', 'scene-material', 'environment-flat'] as const) {
    assert.ok(a.pngs[key].rgba.equals(b.pngs[key].rgba), key + ' A/B diagnostic differs.');
  }
  const shared = Object.keys(a.pngs).filter(key => key.endsWith('-silhouette') || key.endsWith('-flat') || key.endsWith('-material') || key === 'scene-collision');
  for (const [edition, render, repeat] of [['a', a, repeatA], ['b', b, repeatB]] as const) {
    assert.deepEqual(render.qa, repeat.qa);
    assert.deepEqual(render.geometry, repeat.geometry);
    for (const name of Object.keys(render.pngs) as (keyof typeof render.pngs)[]) {
      if (edition === 'b' && shared.includes(name)) continue;
      const folder = shared.includes(name) ? 'geometry' : edition;
      publishImage(brief.id + '/' + folder + '/' + name, render.pngs[name], repeat.pngs[name]);
    }
    const prefix = brief.id + '/' + edition + '/';
    for (const key of previewKeys) {
      publishImage(prefix + key + '-4x', nearestNeighbor(render.pngs[key], 4), nearestNeighbor(repeat.pngs[key], 4));
    }
    for (const key of ['character', 'prop'] as const) for (const [light, ink] of Object.entries(backgrounds)) {
      publishImage(prefix + key + '-' + light, background(render.pngs[key], ink), background(repeat.pngs[key], ink));
    }
  }
  json(brief.id + '/qa.json', {
    id: brief.id, role: brief.role, seed: brief.seed, brief: brief.brief, label: input.base.spec.name,
    shapeLock: input.lock, geometry: a.geometry, A: a.qa, B: b.qa,
    checks: ['Deterministic RGBA/PNG', 'Binary alpha', 'Palette membership', 'Material masks',
      'Silhouette/pivot/scale parity', 'Collision, route, contact and occlusion parity'],
  });
  cases.push({ id: brief.id, role: brief.role, seed: brief.seed, label: input.base.spec.name,
    qa: brief.id + '/qa.json', visualDecision: null });
  console.log(brief.id + ' · ' + evidence.size + ' cumulative payloads · paired QA PASS');
}

json('human-review.json', {
  version: 1, status: 'PENDING_HUMAN_REVIEW',
  choices: ['A', 'B', 'Neither'],
  cases: cases.map(({ id }) => ({ id, choices: Object.fromEntries(reviewAreas.map(key => [key, null])), notes: '' })),
});
const files = Object.fromEntries([...evidence].map(([name, bytes]) => [name, sha256(bytes)]));
json('benchmark.json', {
  version: 1, kind: 'lumasprite-cross-asset-art-direction', technical: 'PASS', artistic: 'PENDING_HUMAN_REVIEW',
  checkpoint: lock.checkpoint, lock: { file: lockFile, sha256: lockSha }, direction: lock.direction, cases, files,
});
evidence.set('SHA256SUMS', Buffer.from([...evidence].map(([name, bytes]) => sha256(bytes) + '  ' + name + '\n').join('')));
for (const [name, bytes] of evidence) {
  const file = output + '/' + name;
  await mkdir(dirname(file), { recursive: true });
  if (values.publish) {
    const existing = await readFile(file).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (existing) assert.deepEqual(existing, bytes, name + ' differs from locked evidence.');
    else await writeFile(file, bytes, { flag: 'wx' });
  } else await writeFile(file, bytes);
}
