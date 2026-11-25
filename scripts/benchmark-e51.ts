import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { pack } from '../src/core/palette/colors.ts';
import { blit, makeRaster, nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { buildIdleAnimation, verifyAnimationPackage } from '../src/generators/character/animation.ts';
import { writeCharacterReview } from '../src/generators/character/export.ts';
import { verifyCharacterProductionPackage } from '../src/generators/character/production.ts';
import { crop, outlineMarks } from './character-preview.ts';
import { characterGameScenes } from './character-scenes.ts';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'benchmarks/results/run/e51' } } });
const out = resolve(values.out);
if (out.toLowerCase() !== resolve('benchmarks/results/e51').toLowerCase() &&
    !out.toLowerCase().startsWith(resolve('benchmarks/results/run').toLowerCase() + sep)) {
  throw new Error('Choose benchmarks/results/e51 or a separate run directory.');
}
await mkdir(out, { recursive: true });
const sourceDirectory = 'benchmarks/results/e44/packages/r2';
const source = await verifyCharacterProductionPackage(sourceDirectory);
const spec = JSON.parse(await readFile('benchmarks/fixtures/e51/surveyor-idle.json', 'utf8'));
const animation = buildIdleAnimation(source, spec);
const packagePath = join(out, 'package');
await writeCharacterReview(packagePath, animation);
assert.deepEqual((await verifyAnimationPackage(packagePath, sourceDirectory)).manifest, animation.manifest);

const save = (name: string, raster: Raster) => writeFile(join(out, name + '.png'), encodePng(raster));
const { scenes, source: references } = await characterGameScenes();
const { base, pivot } = scenes[0];
const [px, py] = animation.spec.pivot;
for (const [i, { geometry, material }] of animation.frames.entries()) {
  const name = animation.timing.frames[i].phase;
  const scene = { ...base, rgba: Buffer.from(base.rgba) };
  blit(scene, material.final, pivot[0] - px, pivot[1] - py);
  if (i === 0) assert.deepEqual(encodePng(scene), await readFile('benchmarks/results/e44/outdoor-r2-1x.png'));
  await Promise.all([
    save(name + '-1x', material.final), save(name + '-silhouette-1x', geometry.silhouette),
    save(name + '-landmarks-4x', outlineMarks(geometry)), save(name + '-grip-4x', crop(material.final, 39, 27, 57, 52, 4)),
    save(name + '-outdoor-1x', scene),
  ]);
}
await save('strip-4x', nearestNeighbor(animation.sheet, 4));

const onionColors = { old: pack('#f6a788'), next: pack('#87dfc5'), overlap: pack('#506969') };
for (const { from, to } of animation.qa.transitions) {
  const a = animation.frames[animation.timing.frames.findIndex(frame => frame.phase === from)].geometry.silhouette;
  const b = animation.frames[animation.timing.frames.findIndex(frame => frame.phase === to)].geometry.silhouette;
  const difference = makeRaster(a.w, a.h);
  for (let offset = 0; offset < difference.rgba.length; offset += 4) {
    const old = a.rgba[offset + 3], next = b.rgba[offset + 3];
    if (old || next) difference.rgba.writeUInt32BE(old && next ? onionColors.overlap : old ? onionColors.old : onionColors.next, offset);
  }
  await save('onion-' + from + '-' + to + '-4x', nearestNeighbor(difference, 4));
}
await writeFile(join(out, 'scene-source.json'), JSON.stringify(references.outdoor, null, 2) + '\n');
console.log('E5.1 animation benchmark written to ' + out);
