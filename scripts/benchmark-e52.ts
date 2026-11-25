import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import type { Point } from '../src/core/geometry/shapes.ts';
import { pack } from '../src/core/palette/colors.ts';
import { blit, makeRaster, nearestNeighbor, put, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { verifyAnimationPackage } from '../src/generators/character/animation.ts';
import { writeCharacterReview } from '../src/generators/character/export.ts';
import { verifyCharacterProductionPackage } from '../src/generators/character/production.ts';
import { buildWalkAnimation } from '../src/generators/character/walk.ts';
import { feet } from '../src/generators/character/walk-pose.ts';
import { crop, outlineMarks } from './character-preview.ts';
import { characterGameScenes } from './character-scenes.ts';
import { onBackground } from './game-preview.ts';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'benchmarks/results/run/e52' } } });
const out = resolve(values.out);
if (out.toLowerCase() !== resolve('benchmarks/results/e52').toLowerCase() &&
    !out.toLowerCase().startsWith(resolve('benchmarks/results/run').toLowerCase() + sep)) {
  throw new Error('Choose benchmarks/results/e52 or a separate run directory.');
}
await mkdir(out, { recursive: true });
const sourceDirectory = 'benchmarks/results/e44/packages/r2';
const source = await verifyCharacterProductionPackage(sourceDirectory);
const idle = await verifyAnimationPackage('benchmarks/results/e51/package', sourceDirectory);
const save = (name: string, raster: Raster) => writeFile(join(out, name + '.png'), encodePng(raster));
const { scenes, source: references } = await characterGameScenes();
for (const { id, base } of scenes.filter(scene => scene.id !== 'gameplay')) await save(id, base);
await save('idle-neutral', idle.frames[0].material.final);
await writeFile(join(out, 'scene-source.json'), JSON.stringify({ outdoor: references.outdoor, dungeon: references.dungeon }, null, 2) + '\n');

function line(raster: Raster, [ax, ay]: Point, [bx, by]: Point, ink: number) {
  const steps = Math.max(Math.abs(ax - bx), Math.abs(ay - by), 1);
  for (let i = 0; i <= steps; i++) put(raster, Math.round(ax + (bx - ax) * i / steps), Math.round(ay + (by - ay) * i / steps), ink);
}
function trajectory(root: ReturnType<typeof buildWalkAnimation>['timing']['rootMotion']) {
  const raster = onBackground(makeRaster(288, 62), '#243530');
  const plot = ([x, y]: Point): Point => [x * 3, (y - 44) * 3 + 5];
  for (const side of feet) {
    const y = root.frames[0].feet[side].groundY;
    line(raster, plot([0, y]), plot([95, y]), pack('#728475'));
  }
  for (const side of feet) {
    const samples = root.frames.map(f => f.feet[side]);
    const ink = pack(side === 'near' ? '#8de4ca' : '#e0afd8');
    for (const [i, a] of samples.entries()) {
      const b = samples[(i + 1) % samples.length];
      const to = plot([b.world[0] + (i === samples.length - 1 ? root.cyclePx : 0), b.world[1]]);
      line(raster, plot(a.world), to, ink);
    }
    for (const { world, state } of samples) {
      const [x, y] = plot(world);
      const marker = state === 'planted' ? pack('#ffe29c') : ink;
      for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) put(raster, x + dx, y + dy, marker);
    }
  }
  return raster;
}

for (const id of ['w1', 'w2']) {
  const spec = JSON.parse(await readFile('benchmarks/fixtures/e52/' + id + '.json', 'utf8'));
  const walk = buildWalkAnimation(source, spec);
  const dest = join(out, id, 'package');
  await writeCharacterReview(dest, walk);
  assert.deepEqual((await verifyAnimationPackage(dest, sourceDirectory)).manifest, walk.manifest);
  const silhouette = makeRaster(walk.sheet.w, walk.sheet.h);
  for (const [i, { geometry, material }] of walk.frames.entries()) {
    const n = String(i + 1).padStart(2, '0');
    blit(silhouette, geometry.silhouette, i * 64, 0);
    await Promise.all([
      save(id + '/frame-' + n, material.final), save(id + '/landmarks-' + n, outlineMarks(geometry)),
      save(id + '/grip-' + n, crop(material.final, 39, 26, 58, 53, 4)),
    ]);
    const next = walk.frames[(i + 1) % walk.frames.length].geometry.silhouette;
    const a = geometry.silhouette;
    const onion = makeRaster(a.w, a.h);
    const [shared, prior, after] = ['#526e64', '#f0aa8c', '#86dec6'].map(pack);
    for (let at = 0; at < onion.rgba.length; at += 4) {
      const p = a.rgba[at + 3], q = next.rgba[at + 3];
      if (p || q) onion.rgba.writeUInt32BE(p && q ? shared : p ? prior : after, at);
    }
    await save(id + '/onion-' + n, nearestNeighbor(onion, 4));
  }
  await Promise.all([
    save(id + '/strip-4x', nearestNeighbor(walk.sheet, 4)), save(id + '/silhouette-strip', silhouette),
    save(id + '/foot-trajectory', trajectory(walk.timing.rootMotion)), save(id + '/bridge', walk.bridge.material.final),
  ]);
}
console.log('E5.2 walk benchmark written to ' + out);
