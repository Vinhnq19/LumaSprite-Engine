import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { blit, nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { characterReview, writeCharacterReview } from '../src/generators/character/export.ts';
import { surveyorRefinements, surveyors } from '../src/generators/character/presets.ts';
import { bakeTerrain, verifyBakedTerrain } from '../src/generators/terrain/baked.ts';
import { renderTerrain } from '../src/generators/terrain/render.ts';
import { sha256 } from '../src/quality/raster.ts';
import { crop, outlineMarks } from './character-preview.ts';

const { values } = parseArgs({ options: { out: { type: 'string' }, refined: { type: 'boolean' } } });
const out = resolve(values.out ?? (values.refined ? 'benchmarks/results/run/e41r' : 'benchmarks/results/run/e41'));
const lockedEditions = ['sample', 'e2', 'e23', 'e24', 'e3', 'e32', 'e33', 'e34'];
lockedEditions.push(values.refined ? 'e41' : 'e41r');
for (const edition of lockedEditions) {
  const locked = resolve('benchmarks/results', edition).toLowerCase();
  if (out.toLowerCase() === locked || out.toLowerCase().startsWith(locked + sep)) {
    throw new Error('Choose a separate character review directory.');
  }
}
await mkdir(out, { recursive: true });
const json = (name: string, value: unknown) => writeFile(join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const save = (name: string, raster: Raster) => writeFile(join(out, name + '.png'), encodePng(raster));

const backdrop = 'benchmarks/results/e34/packages/b-organic';
const reference = await verifyBakedTerrain(backdrop);
const props = await Promise.all(reference.overlays.filter(layer => layer.id !== 'traveler').map(async ({ id, left, top, provenance, file, pngSha256 }) => {
  const png = await readFile(join(backdrop, file));
  assert.equal(sha256(png), pngSha256);
  return { id, left, top, provenance, png };
}));
const ground = bakeTerrain(renderTerrain(reference.spec), reference.map, props).raster;
const scenePivot = [240, 158] as const;
const qa = [];
for (const [id, spec] of Object.entries(values.refined ? surveyorRefinements : surveyors)) {
  const review = characterReview(spec);
  await json(id + '-spec', review.spec);
  await writeCharacterReview(join(out, id), review);
  const { flat, silhouette, plan, metadata } = review;
  const [gx, gy] = plan.landmarks['grip-anchor'].point;
  const { near, far } = review.spec.pose;
  const scene: Raster = { ...ground, rgba: Buffer.from(ground.rgba) };
  blit(scene, flat, scenePivot[0] - plan.pivot[0], scenePivot[1] - plan.pivot[1]);
  await Promise.all([
    save(id + '-silhouette-4x', nearestNeighbor(silhouette, 4)),
    save(id + '-landmarks-4x', outlineMarks(review)),
    save(id + '-grip-6x', crop(flat, gx - 9, gy - 7, gx + 8, metadata.diagnostics.parts.lantern.bottom + 3)),
    save(id + '-stance-6x', crop(flat, Math.min(near.ankle[0], far.ankle[0]) - 7,
      spec.version === 2 ? Math.min(near.knee[1], far.knee[1]) - 3 : near.knee[1] - 2,
      Math.max(near.ankle[0], far.ankle[0]) + 11, plan.pivot[1] + 1)),
    save(id + '-scene-1x', scene),
  ]);
  qa.push({ candidate: id, ...metadata });
}
await json('qa', qa.map(({ candidate, technical, artistic, diagnostics, images }) => ({ candidate, technical, artistic, diagnostics, images })));
await json('scene', { source: backdrop, sourcePngSha256: reference.image.pngSha256, overlays: props.map(({ id, provenance, png }) => ({
  id, provenance, pngSha256: sha256(png),
})), groundPivot: scenePivot });
console.log((values.refined ? 'E4.1R' : 'E4.1') + ' geometry benchmark written to ' + out);
