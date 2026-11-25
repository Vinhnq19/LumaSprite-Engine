import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { pack } from '../src/core/palette/colors.ts';
import type { Point } from '../src/core/geometry/shapes.ts';
import { blit, makeRaster, nearestNeighbor, put, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { characterReview, writeCharacterReview } from '../src/generators/character/export.ts';
import { surveyorRefinements, surveyors } from '../src/generators/character/presets.ts';
import { bakeTerrain, verifyBakedTerrain } from '../src/generators/terrain/baked.ts';
import { renderTerrain } from '../src/generators/terrain/render.ts';
import { sha256 } from '../src/quality/raster.ts';

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

function outlineMarks({ flat, plan }: ReturnType<typeof characterReview>) {
  const raster = nearestNeighbor(flat, 4);
  const dot = ([x, y]: Point, ink: number) => put(raster, x, y, ink);
  const zoom = ([x, y]: Point): Point => [x * 4 + 2, y * 4 + 2];
  const drawLine = (a: Point, b: Point, ink: number) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let i = 0; i <= steps; i++) dot([a[0] + Math.round(dx * i / steps), a[1] + Math.round(dy * i / steps)], ink);
  };
  for (const { from, to } of plan.links) {
    const ink = pack(to.startsWith('far-') ? '#d6a5ed' : '#8ee5dd');
    drawLine(zoom(plan.landmarks[from].point), zoom(plan.landmarks[to].point), ink);
  }
  for (const [id, { point }] of Object.entries(plan.landmarks)) {
    const [x, y] = zoom(point);
    const ink = pack(id === 'grip-anchor' ? '#ffe294' : id.startsWith('far-') ? '#d6a5ed' : '#a6fff2');
    drawLine([x - 2, y], [x + 2, y], ink);
    drawLine([x, y - 2], [x, y + 2], ink);
  }
  const [x, y] = plan.pivot;
  drawLine([Math.max(0, x * 4 - 24), y * 4], [x * 4 + 28, y * 4], pack('#ffe294'));
  drawLine([x * 4, y * 4 - 3], [x * 4, y * 4 + 3], pack('#ffe294'));
  if (plan.projectedGround) {
    const secondary = plan.support === 'near' ? 'far' : 'near';
    const [footX] = plan.landmarks[secondary + '-ground'].point;
    const floorY = plan.projectedGround[secondary] * 4;
    drawLine([footX * 4 - 13, floorY], [footX * 4 + 24, floorY], pack('#d6a5ed'));
  }
  return raster;
}

function crop(source: Raster, left: number, top: number, right: number, bottom: number) {
  const raster = makeRaster(right - left, bottom - top);
  for (let y = 0; y < raster.h; y++) {
    source.rgba.copy(raster.rgba, y * raster.w * 4, ((top + y) * source.w + left) * 4, ((top + y) * source.w + right) * 4);
  }
  return nearestNeighbor(raster, 6);
}

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
