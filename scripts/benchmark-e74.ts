import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { pack } from '../src/core/palette/colors.ts';
import { nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { materialLegend } from '../src/generators/environment/kit.ts';
import { crossAssetStyle, loadArtDirection } from '../src/experiments/art-direction.ts';
import type { PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { contextEvidence, instrumentContext } from '../src/experiments/quality-guided-context.ts';
import { createInstrumentShape, finishInstrument, qualityPropBrief, refineMeniscus, type QualityPropBrief } from '../src/experiments/quality-guided-prop.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { renderRelayDevice } from '../src/experiments/structure-quality/relay.ts';
import { inspectPng, sha256 } from '../src/quality/raster.ts';

const { values } = parseArgs({ options: { publish: { type: 'boolean' }, development: { type: 'boolean' } } });
assert.ok(!values.publish || !values.development);
const root = 'benchmarks/results/e74';
const scratch = 'benchmarks/results/run/e74';
const output = values.publish ? root : scratch;
const lockRef = { file: 'benchmarks/fixtures/e74/pilot-lock.json', sha256: 'a07c8457f8644dd12a37c71e77fa147a7003f7b6b4c0eb81f0bf56dc2e6eee3e' };
const freezePath = 'benchmarks/fixtures/e74/candidate-freeze.json';
const lock = JSON.parse((await pinnedFile(lockRef)).toString('utf8'));
const freezeBytes = await readFile(freezePath);
const freeze = JSON.parse(freezeBytes.toString('utf8'));
assert.equal(freeze.briefLock, lockRef.sha256);
for (const [path, checksum] of Object.entries(freeze.sources)) {
  assert.equal(sha256((await readFile(path, 'utf8')).replaceAll('\r\n', '\n')), checksum);
}
const historical = (await pinnedFile(lock.history)).toString('utf8').trim().split('\n');
assert.equal(historical.length, 134);
for (const line of historical) {
  const [sha256, file] = line.split('  ');
  await pinnedFile({ file, sha256 });
}

const stages = ['baseline', 'flatShape', 'material', 'materialRefinement', 'localRefinement', 'scene', 'ownership'] as const;
const counts = () => Object.fromEntries(stages.map(stage => [stage, 0])) as Record<typeof stages[number], number>;
const modes = ['a0', 'a1', 'a2'] as const;
const evidence = new Map<string, Buffer>();
const cases = [];
const time = [];
const fileJSON = (path: string, value: object) => evidence.set(path, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
const criteria = ['functionalRecognition', 'silhouette', 'proportions', 'perspective', 'materialSeparation', 'clusters',
  'outline', 'nativeReadability', 'dayNightContext', 'generalization'];

async function trial(brief: QualityPropBrief, count: ReturnType<typeof counts>) {
  const source: PilotBrief = JSON.parse((await pinnedFile(brief.context)).toString('utf8'));
  const { spec, profile } = await loadArtDirection(JSON.parse((await pinnedFile(brief.style)).toString('utf8')));
  assert.deepEqual(spec.profile, lock.profile);
  assert.deepEqual([spec.view, spec.keyLight], [brief.view, brief.light]);
  assert.equal(brief.role === 'development', brief.refine !== null);
  const { profile: shared, device } = crossAssetStyle(profile, spec);
  const { device: control } = crossAssetStyle(profile);
  const context = await instrumentContext(source, shared);
  const placement = { file: 'benchmarks/results/e62/packages/c1-courtyard-day/manifest.json',
    sha256: '9db69b0ce4248f22f616b2caaba2e28129cab77e722327b46dac4994e4938ed0', pivot: context.placement.at };
  const rasters = new Map<string, Raster>();
  const path = (key: string) => brief.id + '/' + key + '.png';
  const save = (key: string, raster: Raster) => { rasters.set(path(key), raster); return path(key); };
  const preview = (key: string, raster: Raster) => ({ native: save(key, raster), zoom: save(key + '-4x', nearestNeighbor(raster, 4)) });
  let cameraContract: string | undefined;
  const withContext = (prefix: string, final: Raster, ownership: Raster, pivot: readonly [number, number], signal: 'roof' | 'amber') => {
    const data = contextEvidence(context, final, ownership, pivot, signal, stage => count[stage]++);
    cameraContract ??= data.contract;
    assert.equal(data.contract, cameraContract, 'Collision, route, camera, or actor occlusion changed.');
    return { day: preview(prefix + '/day', data.views.day), night: preview(prefix + '/night', data.views.night), qa: data.qa };
  };
  count.baseline++;
  const a0 = renderRelayDevice({ version: 1, kind: 'field-signal-relay-box', label: brief.name, canvas: brief.canvas,
    seed: brief.seed, sourceStyle: spec.profile, body: brief.baseline.body, placement, brief: brief.brief }, brief.baseline.form, control);
  const baseline = {
    id: 'a0', parent: null, stage: 'baseline', decision: null, passed: true,
    flat: preview('a0/flat', a0.flat), silhouette: preview('a0/silhouette', a0.mask),
    material: preview('a0/material', a0.final), ownership: save('a0/ownership', a0.material),
    inScene: withContext('a0', a0.final, a0.material, a0.structure.contact, 'amber'),
    shapeQA: { status: 'EXISTING_GENERATOR_REFERENCE', source: 'E7.3 relay device', pivot: a0.structure.contact,
      geometrySha256: sha256(a0.mask.rgba), stat: a0.stat },
  };
  const candidates = [baseline as object];
  const geometry = new Set([baseline.shapeQA.geometrySha256]);
  let refinement;
  for (const id of ['a1', 'a2'] as const) {
    count.flatShape++;
    const shape = createInstrumentShape(brief, id, device);
    assert.ok(!geometry.has(shape.qa.geometrySha256), 'Structure recipes have the same silhouette.');
    geometry.add(shape.qa.geometrySha256);
    const diagnostic = {
      id, parent: 'a0', stage: 'structure', decision: null, shapeQA: shape.qa, parts: shape.plan.parts,
      flat: preview(id + '/flat', shape.flat), silhouette: preview(id + '/silhouette', shape.mask),
      ownership: save(id + '/ownership', shape.flatMaterial),
    };
    if (shape.qa.status !== 'PASS') {
      candidates.push({ ...diagnostic, passed: false, material: null, inScene: null });
      continue;
    }
    count.material++;
    const art = finishInstrument(shape, device, 'material');
    const role = brief.function === 'collector' ? 'roof' : 'amber';
    const contexts = withContext(id, art.raster, art.material, shape.plan.pivot, role);
    candidates.push({ ...diagnostic, passed: true, material: preview(id + '/material', art.raster),
      materialQA: art.stat, inScene: contexts });
    if (id !== brief.refine) continue;
    assert.equal(brief.function, 'collector');
    count.materialRefinement++;
    const focus = finishInstrument(shape, device, 'focused');
    let materialChanged = 0;
    for (let i = 0; i < focus.raster.rgba.length; i += 4) {
      if (focus.raster.rgba.readUInt32BE(i) === art.raster.rgba.readUInt32BE(i)) continue;
      assert.equal(art.material.rgba.readUInt32BE(i), pack(materialLegend.roof), 'Material pass edited beyond the glass role.');
      materialChanged++;
    }
    assert.ok(materialChanged > 0);
    count.localRefinement++;
    const local = refineMeniscus(focus, shape.plan, device, lock.bounds.editablePixels);
    refinement = {
      candidate: id, stage: 'local-refinement', decision: null, geometrySha256: shape.qa.geometrySha256,
      materialRefinement: { parent: id + '/material', hypothesis: 'Deeper liquid face separates the surface line from the tank.',
        changed: materialChanged, ...preview(id + '/focused', focus.raster),
        inScene: withContext('refinement-before', focus.raster, focus.material, shape.plan.pivot, role) },
      local: { parent: id + '/focused', ...local.qa, ...preview(id + '/refined', local.raster),
        edit: save(id + '/edit-mask', local.edit), diff: preview(id + '/pixel-diff', local.diff),
        inScene: withContext('refinement-after', local.raster, focus.material, shape.plan.pivot, role) },
    };
  }
  return { rasters, result: { candidates, refinement, cameraContract, context: source.scene, palette: { profile: spec.profile,
    outline: device.contour, metal: device.surfaces.metal, glass: device.surfaces.roof, signal: device.surfaces.amber } } };
}

for (const ref of lock.cases) {
  const brief = qualityPropBrief.parse(JSON.parse((await pinnedFile(ref)).toString('utf8')));
  if (values.development && brief.role !== 'development') continue;
  const firstCalls = counts(), repeatCalls = counts();
  const began = process.cpuUsage();
  const wall = performance.now();
  const first = await trial(brief, firstCalls);
  const firstCpu = process.cpuUsage(began);
  const repeatStart = process.cpuUsage();
  const repeat = await trial(brief, repeatCalls);
  const repeatCpu = process.cpuUsage(repeatStart);
  assert.deepEqual(first.result, repeat.result);
  assert.deepEqual(firstCalls, repeatCalls);
  for (const [path, raster] of first.rasters) {
    const bytes = encodePng(raster);
    assert.deepEqual(inspectPng(raster, bytes, repeat.rasters.get(path)!), [], path);
    evidence.set(path, bytes);
  }
  const qa = brief.id + '/qa.json';
  fileJSON(qa, { version: 1, brief: { file: ref.file, sha256: ref.sha256 }, seed: brief.seed, role: brief.role,
    profile: lock.profile, style: brief.style, view: brief.view, light: brief.light, bounds: lock.bounds, ...first.result });
  const accepted = first.result.candidates.slice(1).filter(item => (item as { passed: boolean }).passed).length;
  cases.push({ id: brief.id, title: brief.name, role: brief.role, seed: brief.seed, description: brief.brief,
    qa, accepted, refinement: Boolean(first.result.refinement) });
  time.push({ case: brief.id, primary: { calls: firstCalls, cpuMicroseconds: firstCpu }, deterministicRepeat: {
    calls: repeatCalls, cpuMicroseconds: repeatCpu }, wallMillisecondsIncludingEncode: Math.round(performance.now() - wall) });
  console.log(brief.id + ': ' + accepted + '/2 structural candidates cleared; stages ' + JSON.stringify(firstCalls));
}

fileJSON('human-review.json', {
  version: 1, status: 'PENDING_HUMAN_REVIEW', choices: ['A0', 'A1', 'A2', 'Refined', 'Neither'], criteria,
  cases: cases.map(({ id, refinement }) => ({ id, choice: null, notes: '', scores: Object.fromEntries(
    ['A0', 'A1', 'A2', ...(refinement ? ['Refined'] : [])].map(variant => [variant, Object.fromEntries(criteria.map(key => [key, null]))]),
  ) })),
});
const files = Object.fromEntries([...evidence].map(([name, bytes]) => [name, sha256(bytes)]));
const technical = cases.every(item => item.accepted > 0 && (item.role !== 'development' || item.refinement)) ? 'PASS' : 'BLOCKED';
fileJSON('benchmark.json', { version: 1, kind: 'lumasprite-quality-guided-prop-pilot', technical,
  artistic: 'PENDING_HUMAN_REVIEW', checkpoint: lock.checkpoint, lock: lockRef, candidateFreeze: {
    file: freezePath, sha256: sha256(freezeBytes) }, cases, files, economics: { apiCalls: 0, budgets: lock.bounds },
  candidateContract: { ancestry: ['baseline', 'structure', 'material', 'material-refinement', 'local-refinement'],
    qa: '<case>/qa.json', humanDecision: 'human-review.json', seedAndSource: '<case>/qa.json' } });
evidence.set('SHA256SUMS', Buffer.from([...evidence].map(([name, data]) => sha256(data) + '  ' + name + '\n').join('')));
for (const [name, bytes] of evidence) {
  const path = output + '/' + name;
  await mkdir(dirname(path), { recursive: true });
  if (!values.publish) {
    await writeFile(path, bytes);
    continue;
  }
  const existing = await readFile(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (existing) assert.ok(existing.equals(bytes), name + ' differs from published evidence.');
  else await writeFile(path, bytes, { flag: 'wx' });
}
await mkdir(scratch, { recursive: true });
const size = [...evidence].reduce((total, [, data]) => total + data.length, 0);
const pngCount = [...evidence.keys()].filter(name => name.endsWith('.png')).length;
await writeFile(scratch + '/performance.json', JSON.stringify({
  version: 1, node: process.version, platform: process.platform, mode: values.development ? 'development-only' : 'all',
  bytes: size, png: pngCount, payload: evidence.size, deepSeekCalls: 0, otherAiApiCalls: 0, runs: time,
}, null, 2) + '\n');
assert.equal(modes.length - 1, lock.bounds.structuresBeyondBaseline);
console.log(technical + ' · ' + pngCount + ' PNG · ' + (evidence.size - 1) + ' SHA-256 entries · ' + size + ' bytes');
if (technical !== 'PASS') process.exitCode = 1;
