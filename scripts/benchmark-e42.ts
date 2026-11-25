import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { blit, makeRaster, nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { characterReview, writeCharacterReview } from '../src/generators/character/export.ts';
import { characterMaterialReview } from '../src/generators/character/material-export.ts';
import { materialMaskLegend, materialStyles } from '../src/generators/character/materials.ts';
import { surveyorRefinements } from '../src/generators/character/presets.ts';
import { makeShapeLock } from '../src/generators/character/shape-lock.ts';
import { bakeTerrain, verifyBakedTerrain } from '../src/generators/terrain/baked.ts';
import { renderTerrain } from '../src/generators/terrain/render.ts';
import { sha256 } from '../src/quality/raster.ts';
import { onBackground, swatches } from './game-preview.ts';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'benchmarks/results/run/e42' } } });
const out = resolve(values.out);
for (const edition of ['sample', 'e2', 'e23', 'e24', 'e3', 'e32', 'e33', 'e34', 'e41', 'e41r']) {
  const locked = resolve('benchmarks/results', edition).toLowerCase();
  if (out.toLowerCase() === locked || out.toLowerCase().startsWith(locked + sep)) {
    throw new Error('Choose a separate character material review directory.');
  }
}

const geometry = characterReview(surveyorRefinements.b1);
const lock = makeShapeLock(geometry, '58b2d4c', 'b1');
assert.equal(lock.source.geometrySha256, 'efbe1727ba5feaf0240963644800d4cf691e4b85073eb95dff74afcf82a91d47');
assert.equal(lock.silhouetteAlphaSha256, 'a8ff259bbaed7dc87ee1a32d0271bf6fc533bc3c60aefcf7efe98a5ec62ef9dc');
for (const [name, bytes] of geometry.files) assert.deepEqual(bytes, await readFile(join('benchmarks/results/e41r/b1', name)));
await mkdir(out, { recursive: true });

const json = (name: string, value: unknown) => writeFile(join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const save = (name: string, raster: Raster) => writeFile(join(out, name + '.png'), encodePng(raster));
await json('b1-shape-lock', lock);
await json('material-mask-legend', materialMaskLegend);

function cropParts(raster: Raster, ids: readonly string[], scale: number) {
  const parts = ids.map(id => geometry.metadata.diagnostics.parts[id]);
  const left = Math.max(0, Math.min(...parts.map(b => b.left)) - 3);
  const top = Math.max(0, Math.min(...parts.map(b => b.top)) - 3);
  const right = Math.min(raster.w, Math.max(...parts.map(b => b.right)) + 4);
  const bottom = Math.min(raster.h, Math.max(...parts.map(b => b.bottom)) + 4);
  const crop = makeRaster(right - left, bottom - top);
  for (let y = top; y < bottom; y++) {
    raster.rgba.copy(crop.rgba, (y - top) * crop.w * 4, (y * raster.w + left) * 4, (y * raster.w + right) * 4);
  }
  return nearestNeighbor(crop, scale);
}

const backdrop = 'benchmarks/results/e34/packages/b-organic';
const reference = await verifyBakedTerrain(backdrop);
const overlays = await Promise.all(reference.overlays.filter(layer => layer.id !== 'traveler').map(async layer => {
  const png = await readFile(join(backdrop, layer.file));
  assert.equal(sha256(png), layer.pngSha256);
  return { id: layer.id, left: layer.left, top: layer.top, provenance: layer.provenance, png };
}));
const ground = bakeTerrain(renderTerrain(reference.spec), reference.map, overlays).raster;
const scenePivot = [240, 158] as const;
const bright = '#ded6c2', dark = '#2c3549';
const palettes = [
  { mode: 'authored' }, { mode: 'project' }, { mode: 'locked', colors: ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'] },
] as const;
const qa = [];

for (const style of materialStyles) {
  const review = characterMaterialReview(geometry, lock, style);
  await writeCharacterReview(join(out, style), review);
  const scene = { ...ground, rgba: Buffer.from(ground.rgba) };
  blit(scene, review.final, scenePivot[0] - lock.groundPivot[0], scenePivot[1] - lock.groundPivot[1]);
  await Promise.all([
    save(style + '-4x', nearestNeighbor(review.final, 4)),
    save(style + '-regions-4x', nearestNeighbor(review.mask, 4)),
    save(style + '-face-6x', cropParts(review.final, ['head', 'cap', 'neck'], 6)),
    save(style + '-shoulder-6x', cropParts(review.final, ['jacket', 'near-upper-arm', 'near-forearm', 'satchel'], 6)),
    save(style + '-grip-6x', cropParts(review.final, ['near-hand', 'lantern'], 6)),
    save(style + '-boots-6x', cropParts(review.final, ['near-boot', 'far-boot'], 6)),
    save(style + '-bright-1x', onBackground(review.final, bright)),
    save(style + '-dark-1x', onBackground(review.final, dark)),
    save(style + '-swatches', swatches(review.usedColors)),
    save(style + '-scene-1x', scene),
  ]);
  for (const palette of palettes) {
    const sample = palette.mode === 'authored' ? review : characterMaterialReview(geometry, lock, style, palette);
    if (palette.mode !== 'authored') await save(style + '-' + palette.mode + '-1x', sample.final);
    assert.equal(sample.metadata.images.alphaSha256, lock.silhouetteAlphaSha256);
    assert.equal(sample.diagnostics.status, palette.mode === 'locked' ? 'PALETTE_LIMITED' : 'FULL_RAMP');
    qa.push(sample.metadata);
  }
}
await json('palette-project', palettes[1]);
await json('palette-locked', palettes[2]);
await json('qa', qa);
await json('scene', { source: backdrop, sourcePngSha256: reference.image.pngSha256, groundPivot: scenePivot, backgrounds: { bright, dark },
  props: overlays.map(({ id, left, top, provenance, png }) => ({ id, left, top, provenance, pngSha256: sha256(png) })) });
console.log('E4.2 material benchmark written to ' + out);
