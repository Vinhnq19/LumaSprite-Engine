import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { pack } from '../src/core/palette/colors.ts';
import { makeRaster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { verifyAnimationPackage } from '../src/generators/character/animation.ts';
import { verifyCharacterProductionPackage } from '../src/generators/character/production.ts';
import { buildWalkAnimation } from '../src/generators/character/walk.ts';
import { sha256 } from '../src/quality/raster.ts';
import { crop } from '../research/open-source/art-quality/common.ts';
import { characterGameScenes } from './character-scenes.ts';
import { courierSource, readJson, surveyorSource } from './e53-common.ts';

const { values } = parseArgs({ options: { publish: { type: 'boolean' }, unity: { type: 'boolean' } } });
const runRoot = 'benchmarks/results/run/e54';
const publishRoot = 'benchmarks/results/e54';
const root = values.publish ? publishRoot : runRoot;
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const read = (path: string) => readFileSync(path);
const textDigest = (path: string) => sha256(readFileSync(path, 'utf8').replaceAll('\r\n', '\n'));
function save(path: string, data: Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) assert.ok(read(path).equals(data), 'Existing evidence differs at ' + path);
  else writeFileSync(path, data);
}

const [surveyor, courier, idle, w1, w2, backgrounds] = await Promise.all([
  verifyCharacterProductionPackage(surveyorSource), verifyCharacterProductionPackage(courierSource),
  verifyAnimationPackage('benchmarks/results/e51/package', surveyorSource),
  verifyAnimationPackage('benchmarks/results/e52/w1/package', surveyorSource),
  verifyAnimationPackage('benchmarks/results/e52/w2/package', surveyorSource), characterGameScenes(),
]);
assert.ok('bridge' in w2);
const courierWalk = buildWalkAnimation(courier, readJson('benchmarks/fixtures/e53/courier-walk.json'));
const e53 = readJson<{ artifacts: Record<string, string> }>('docs/e53-evidence.json');
for (const [name, data] of courierWalk.files) assert.equal(sha256(data), e53.artifacts['courier/package/' + name]);
assert.equal(sha256(encodePng(courierWalk.bridge.material.final)), e53.artifacts['courier/bridge.png']);
const baseIdle = {
  version: 1, kind: 'lumasprite-standing-pose', name: 'Forest Courier E4.4 Revised · standing', image: 'spritesheet.png',
  canvas: { w: 64, h: 64 }, sampling: 'nearest', pivot: courier.lock.groundPivot, loop: 'hold',
  totalDurationMs: idle.timing.totalDurationMs,
  frames: [{ phase: 'standing', durationMs: idle.timing.totalDurationMs, rect: { x: 0, y: 0, w: 64, h: 64 },
    rgbaSha256: sha256(courier.material.final.rgba) }],
};
const locks = [
  { id: 'surveyor', source: surveyor, path: surveyorSource, walk: w2,
    idleTiming: idle.timing, idleFiles: idle.files },
  { id: 'courier', source: courier, path: courierSource, walk: courierWalk,
    idleTiming: baseIdle, idleFiles: new Map([['spritesheet.png', courier.files.get('final.png')!], ['timing.json', bytes(baseIdle)]]) },
];

const bundles = locks.map(({ id, source, path, walk, idleTiming, idleFiles }) => {
  const files = new Map([
    ...[...idleFiles].map(([name, data]) => ['idle/' + name, data] as const),
    ...[...walk.files].map(([name, data]) => ['walk/' + name, data] as const),
    ['bridge.png', encodePng(walk.bridge.material.final)],
    ['material.json', source.files.get('material.json')!],
  ]);
  assert.deepEqual(walk.timing.pivot, idleTiming.pivot);
  const manifest = {
    version: 1, kind: 'lumasprite-animation-bundle', character: id, pivot: walk.timing.pivot, canvas: walk.timing.canvas,
    clips: { idle: { timing: 'idle/timing.json', spec: id === 'surveyor' ? 'idle/animation-spec.json' : null },
      walk: { timing: 'walk/timing.json', spec: 'walk/animation-spec.json',
        bridge: 'bridge.png', bridgeMs: walk.qa.entryExit.durationMs } },
    source: { directory: path, characterSpecVersion: source.geometry.spec.version, materialStyle: source.manifest.style,
      productionManifestSha256: sha256(source.files.get('manifest.json')!),
      characterSpecSha256: sha256(source.files.get('character-spec.json')!),
      shapeLockSha256: sha256(source.files.get('shape-lock.json')!) },
    files: Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)).map(([name, file]) => [name, sha256(file)])),
  };
  for (const [name, file] of files) save(join(root, 'packages', id, name), file);
  save(join(root, 'packages', id, 'manifest.json'), bytes(manifest));
  return { id, manifestSha256: sha256(bytes(manifest)), ...manifest.source, clips: manifest.clips };
});
const historical = readJson<{ historical: number; historicalRebuilt: Record<string, number> }>('docs/e53-evidence.json');
save(join(root, 'baseline-lock.json'), bytes({
  version: 1, checkpoint: '7fa1f23', historicalChecksums: historical.historical, historicalRebuilt: historical.historicalRebuilt,
  packages: bundles, previous: {
    idle: sha256(idle.files.get('manifest.json')!), w1: sha256(w1.files.get('manifest.json')!), w2: sha256(w2.files.get('manifest.json')!),
    e53Evidence: textDigest('docs/e53-evidence.json'), e53RuntimeProof: textDigest('docs/e53-runtime-proof.json'),
    rndNotices: Object.fromEntries(['ink-and-bones','spritekiln','texel-color'].map(id =>
      [id, sha256(read('research/open-source/art-quality/licenses/' + id + '.txt'))])),
  },
}));
// Scratch Unity input contains only approved Engine assets and their original JSON sidecars.
const stage = '.cache/e54-unity/Assets/E54Input';
if (values.unity) {
  for (const { id } of bundles) {
    for (const [name, dest] of [['idle/spritesheet.png','idle.png'], ['idle/timing.json','idle.json'],
      ['walk/spritesheet.png','walk.png'], ['walk/timing.json','walk.json'], ['bridge.png','bridge.png'], ['manifest.json','manifest.json']]) {
      save(join(stage, id, dest), read(join(root, 'packages', id, name)));
    }
  }
  const outdoor = backgrounds.scenes.find(scene => scene.id === 'outdoor')!.base;
  const dungeon = backgrounds.scenes.find(scene => scene.id === 'dungeon')!.base;
  const neutral = makeRaster(320, 176);
  const ink = pack('#28322f');
  for (let at = 0; at < neutral.rgba.length; at += 4) neutral.rgba.writeUInt32BE(ink, at);
  for (const [id, frame] of [['outdoor', crop(outdoor, 64, 52, 320, 176)], ['dungeon', dungeon], ['neutral', neutral]] as const) {
    save(join(stage, id + '.png'), encodePng(frame));
  }
  save(join(stage, 'scene-source.json'), bytes(backgrounds.source));
}
console.log('Verified production bundles: ' + root + '/packages');
