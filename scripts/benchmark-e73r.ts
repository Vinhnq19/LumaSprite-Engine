import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { loadArtDirection } from '../src/experiments/art-direction.ts';
import { preparePilot, type PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { renderSemanticPilot } from '../src/experiments/semantic-pilot.ts';
import { semanticDirectionSchema } from '../src/experiments/semantic-style.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { inspectPng, sha256 } from '../src/quality/raster.ts';

const { values } = parseArgs({ options: { publish: { type: 'boolean' }, development: { type: 'boolean' } } });
assert.ok(!values.publish || !values.development);
const published = 'benchmarks/results/e73r';
const output = values.publish ? published : 'benchmarks/results/run/e73r';
const old = 'benchmarks/results/e73/';
const lockRef = { file: 'benchmarks/fixtures/e73r/pilot-lock.json', sha256: '0b6d533fee46d0c6635f66b8ddc7cbd291026b3b9b0e25ddc0d9cc96979c17cb' };
const lock = JSON.parse((await pinnedFile(lockRef)).toString('utf8'));
const freezeFile = 'benchmarks/fixtures/e73r/candidate-freeze.json';
const freezeBytes = await readFile(freezeFile);
const freeze = JSON.parse(freezeBytes.toString('utf8'));
assert.equal(freeze.briefLock, lockRef.sha256);
for (const [file, digest] of Object.entries(freeze.sources)) {
  assert.equal(sha256((await readFile(file, 'utf8')).replaceAll('\r\n', '\n')), digest, file + ' differs from the frozen rule.');
}
const semantic = semanticDirectionSchema.parse(JSON.parse((await pinnedFile(lock.semantic)).toString('utf8')));
const { spec, profile } = await loadArtDirection(JSON.parse((await pinnedFile(semantic.base)).toString('utf8')));
assert.deepEqual(spec.profile, lock.profile);
const pins = (await pinnedFile(lock.baseline)).toString('utf8').trim().split('\n');
const historical = new Map<string, string>();
for (const pin of pins) {
  const [digest, file] = pin.split('  ');
  await pinnedFile({ file: old + file, sha256: digest });
  historical.set(file, digest);
}
assert.equal(historical.size, 92);
const original = JSON.parse((await pinnedFile({ file: old + 'benchmark.json', sha256: historical.get('benchmark.json')! })).toString('utf8'));
const payload = new Map<string, Buffer>();
const reused = new Map<string, string>();
const cases = [];
const json = (file: string, object: object) => payload.set(file, Buffer.from(JSON.stringify(object, null, 2) + '\n'));
const views = ['character', 'character-night', 'prop', 'environment', 'environment-night', 'scene-day', 'scene-night'] as const;
const diagnostics = ['character-silhouette', 'character-material', 'prop-silhouette', 'prop-material', 'environment-silhouette',
  'scene-flat', 'scene-material'] as const;
const scales = [1, 4] as const;
const roles = ['A', 'B', 'C'] as const;
const fingerprint = new Map<string, string>();

function register(path: string, raster: Raster, next: Raster, historicalPath?: string) {
  const bytes = encodePng(raster);
  assert.deepEqual(inspectPng(raster, bytes, next), [], path);
  const hash = sha256(bytes);
  if (historicalPath) {
    assert.equal(hash, historical.get(historicalPath), historicalPath + ' drifted from original.');
    reused.set(old + historicalPath, hash);
    return old + historicalPath;
  }
  const known = fingerprint.get(hash);
  if (known) return known;
  payload.set(path, bytes);
  const fullPath = published + '/' + path;
  fingerprint.set(hash, fullPath);
  return fullPath;
}

for (const ref of lock.cases) {
  if (values.development && ref.role === 'holdout') continue;
  const brief: PilotBrief = JSON.parse((await pinnedFile(ref)).toString('utf8'));
  assert.deepEqual([brief.id, brief.role, brief.seed], [ref.id, ref.historicalRole ?? ref.role, ref.seed]);
  assert.deepEqual(brief.profile, lock.profile);
  assert.deepEqual(brief.direction, semantic.base);
  const checkpoint = ref.role === 'holdout' ? lock.checkpoint : original.checkpoint;
  const input = await preparePilot(brief, checkpoint);
  const first = renderSemanticPilot(input, profile, spec, semantic);
  const repeat = renderSemanticPilot(await preparePilot(brief, checkpoint), profile, spec, semantic);
  assert.deepEqual(first.qa, repeat.qa);
  assert.deepEqual(first.metrics, repeat.metrics);
  assert.deepEqual(first.a.geometry, repeat.a.geometry);
  const images: Record<string, Record<string, string>> = {};
  for (const version of roles) {
    const source = first.variants[version].pngs, rerender = repeat.variants[version].pngs;
    const variant: Record<string, string> = {};
    const folder = brief.id + '/' + version.toLowerCase() + '/';
    for (const view of views) {
      const key = view === 'character-night' ? 'character' : view;
      const separateNight = version === 'C' && view === 'character-night';
      const raster = separateNight ? first.nightActor : source[key];
      const other = separateNight ? repeat.nightActor : rerender[key];
      for (const scale of scales) {
        const ending = scale === 1 ? '.png' : '-4x.png';
        const baseline = ref.role !== 'holdout' && version !== 'C' ? folder + key + ending : undefined;
        variant[view + '-' + scale] = register(folder + view + ending,
          scale === 1 ? raster : nearestNeighbor(raster, 4), scale === 1 ? other : nearestNeighbor(other, 4), baseline);
      }
    }
    images[version] = variant;
  }
  const geometry = Object.fromEntries(diagnostics.map(name => {
    const path = brief.id + '/geometry/' + name + '.png';
    return [name, register(path, first.a.pngs[name], repeat.a.pngs[name], ref.role !== 'holdout' ? path : undefined)];
  }));
  const qaPath = brief.id + '/qa.json';
  json(qaPath, { id: brief.id, role: ref.role, seed: brief.seed, scene: input.base.spec.name, description: brief.brief,
    device: brief.prop.label, lock: input.lock, geometry: first.a.geometry, diagnostics: first.metrics, candidate: first.qa });
  cases.push({ id: brief.id, role: ref.role, seed: brief.seed, label: input.base.spec.name, note: brief.brief,
    qa: qaPath, images, geometry });
  console.log(brief.id + ' · ' + JSON.stringify({ identity: first.qa.identity.exactPixels, night: first.qa.night,
    foot: first.qa.prop.woodShadowRuns, amber: first.qa.prop.amberPixelsExact }));
}
const criteria = {
  character: ['silhouette', 'proportions', 'identity', 'materialHierarchy', 'dayNightReadability'],
  prop: ['functionalRecognition', 'materialSeparation', 'outline', 'signal', 'pixelClusters'],
  environment: ['paletteHarmony', 'depth', 'lighting', 'architecture', 'gameplayComposition'],
  set: ['hierarchy', 'coherence', 'semanticContrast', 'styleConsistency', 'individuality'],
};
json('human-review.json', {
  version: 1, status: 'PENDING_HUMAN_REVIEW', options: [...roles, 'Neither'],
  criteria, cases: cases.map(({ id }) => ({ id, decisions: Object.fromEntries(Object.keys(criteria).map(key => [key, null])),
    scores: Object.fromEntries(Object.entries(criteria).map(([family, names]) => [
      family, Object.fromEntries(roles.map(variant => [variant, Object.fromEntries(names.map(name => [name, null]))])),
    ])), notes: '' })),
});
const files = Object.fromEntries([...payload].map(([name, bytes]) => [published + '/' + name, sha256(bytes)]));
json('benchmark.json', { version: 1, kind: 'lumasprite-semantic-style-review', technical: 'PASS',
  artistic: 'PENDING_HUMAN_REVIEW', checkpoint: lock.checkpoint, lock: lockRef,
  freeze: { file: freezeFile, sha256: sha256(freezeBytes) }, cases, files, reused: Object.fromEntries(reused) });
const all = new Map([...Object.entries(files), ...reused, [published + '/benchmark.json', sha256(payload.get('benchmark.json')!)]]);
payload.set('SHA256SUMS', Buffer.from([...all].map(([name, digest]) => digest + '  ' + name + '\n').join('')));
for (const [name, bytes] of payload) {
  const path = output + '/' + name;
  await mkdir(dirname(path), { recursive: true });
  if (!values.publish) {
    await writeFile(path, bytes);
    continue;
  }
  const previous = await readFile(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (previous) assert.ok(previous.equals(bytes), name + ' differs from published evidence.');
  else await writeFile(path, bytes, { flag: 'wx' });
}
console.log(cases.length + ' cases · ' + all.size + ' evidence SHA-256 · deterministic PNG round-trips.');
