import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { blit, makeRaster, nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { characterReview, writeCharacterReview } from '../src/generators/character/export.ts';
import { forestCourierRevision, surveyorGeometryRevisions } from '../src/generators/character/presets.ts';
import { characterProductionPackage, verifyCharacterProductionPackage } from '../src/generators/character/production.ts';
import { makeShapeLock } from '../src/generators/character/shape-lock.ts';
import { measureMaterialReadability } from '../src/quality/character-materials.ts';
import { sha256 } from '../src/quality/raster.ts';
import { crop, outlineMarks } from './character-preview.ts';
import { characterGameScenes } from './character-scenes.ts';
import { onBackground } from './game-preview.ts';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'benchmarks/results/run/e44' } } });
const out = resolve(values.out);
if (out.toLowerCase() !== resolve('benchmarks/results/e44').toLowerCase() &&
    !out.toLowerCase().startsWith(resolve('benchmarks/results/run').toLowerCase() + sep)) {
  throw new Error('Choose benchmarks/results/e44 or a separate run directory.');
}
await mkdir(out, { recursive: true });

const save = (name: string, raster: Raster) => writeFile(join(out, name + '.png'), encodePng(raster));
const json = (name: string, value: unknown) => writeFile(join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const [b1, courier] = await Promise.all(['m2p', 'courier'].map(id => verifyCharacterProductionPackage('benchmarks/results/e43/packages/' + id)));
const checkpoint = '0294a98';
type Bundle = typeof b1;
function revision(id: string, spec: unknown, parent: Bundle, reference: string) {
  const review = characterReview(spec);
  return characterProductionPackage(review, makeShapeLock(review, checkpoint, id), parent.manifest.style,
    { checkpoint, reference, referenceSha256: sha256(parent.files.get('shape-lock.json')!) });
}
const r1 = revision('r1', surveyorGeometryRevisions.r1, b1, 'E4.3 B1 M2P shape-lock.json');
const r2 = revision('r2', surveyorGeometryRevisions.r2, r1, 'E4.4 R1 shape-lock.json');
const courierRev = revision('courier-rev', forestCourierRevision, courier, 'E4.3 Forest Courier shape-lock.json');
const revisions = [['r1', r1, b1], ['r2', r2, r1], ['courier-rev', courierRev, courier]] as const;
for (const [id, bundle, parent] of revisions) {
  const destination = join(out, 'packages', id);
  assert.notEqual(bundle.lock.silhouetteAlphaSha256, parent.lock.silhouetteAlphaSha256);
  assert.deepEqual(bundle.lock.groundPivot, parent.lock.groundPivot);
  assert.deepEqual(bundle.material.diagnostics.ramps, parent.material.diagnostics.ramps);
  await writeCharacterReview(destination, bundle);
  assert.deepEqual((await verifyCharacterProductionPackage(destination)).manifest, bundle.manifest);
}

const surveyors = [['b1', b1], ['r1', r1], ['r2', r2]] as const;
const couriers = [['courier', courier], ['courier-rev', courierRev]] as const;
const closeups = {
  arm: [21, 18, 48, 43],
  head: [24, 2, 47, 23],
  grip: [39, 27, 57, 52],
  stance: [20, 38, 47, 60],
} as const;
for (const [id, bundle] of [...surveyors, ...couriers]) {
  const { geometry, material } = bundle;
  await save(id + '-4x', nearestNeighbor(material.final, 4));
  await save(id + '-landmarks-4x', outlineMarks(geometry));
  if (id === 'courier' || id === 'courier-rev') {
    await save(id + '-flat-1x', geometry.flat);
  } else {
    for (const [region, [left, top, right, bottom]] of Object.entries(closeups)) {
      await save(id + '-' + region + '-4x', crop(material.final, left, top, right, bottom, 4));
    }
  }
}

const { scenes, source } = await characterGameScenes();
const lineup = onBackground(makeRaster(240, 88), '#8d8b85');
function place(scene: Raster, bundle: Bundle, [x, y]: readonly [number, number]) {
  const [px, py] = bundle.lock.groundPivot;
  blit(scene, bundle.material.final, x - px, y - py);
}
const copy = (base: Raster): Raster => ({ ...base, rgba: Buffer.from(base.rgba) });
for (const [i, [id, bundle]] of surveyors.entries()) {
  for (const scene of scenes) {
    const frame = copy(scene.base);
    place(frame, bundle, scene.pivot);
    if (id === 'b1') assert.deepEqual(encodePng(frame), await readFile('benchmarks/results/e43/' + scene.id + '-m2p-1x.png'));
    await save(scene.id + '-' + id + '-1x', frame);
  }
  place(lineup, bundle, [40 + i * 80, 73]);
}
await save('lineup-1x', lineup);
const duoPivot = [184, 158] as const;
for (const [id, a, b] of [['original', b1, courier], ['revisions', r2, courierRev]] as const) {
  const { base, pivot } = scenes[0];
  const frame = copy(base);
  place(frame, a, pivot);
  place(frame, b, duoPivot);
  await save('outdoor-pair-' + id + '-1x', frame);
}

function visibleParts({ geometry }: Bundle) {
  const order = geometry.plan.parts.map(({ id }) => id).reverse();
  const counts: Record<string, number> = {};
  for (let at = 3; at < geometry.flat.rgba.length; at += 4) {
    const part = order.find(id => geometry.layers[id].rgba[at] === 255);
    if (part) counts[part] = (counts[part] ?? 0) + 1;
  }
  return counts;
}
await json('revision-comparison', revisions.map(([id, bundle, parent]) => {
  const { lock, geometry } = bundle;
  return {
    id, parent: parent.lock.candidate, geometryRevision: lock.geometryRevision, lineage: bundle.manifest.lineage,
    beforeAlpha: parent.lock.silhouetteAlphaSha256, afterAlpha: lock.silhouetteAlphaSha256,
    changedMasks: lock.layerOrder.filter(part => lock.bodyParts[part].alphaSha256 !== parent.lock.bodyParts[part].alphaSha256),
    movedLandmarks: Object.keys(lock.landmarks).filter(name => lock.landmarks[name].point.some((value, axis) => value !== parent.lock.landmarks[name].point[axis])),
    grip: lock.gripAnchor, pivot: lock.groundPivot,
    beforeVisibleParts: visibleParts(parent), afterVisibleParts: visibleParts(bundle),
    beforeGeometry: parent.geometry.metadata.diagnostics.pose, afterGeometry: geometry.metadata.diagnostics.pose,
  };
}));
await json('qa', [...surveyors, ...couriers].map(([id, bundle]) => ({
  id, alphaSha256: bundle.lock.silhouetteAlphaSha256, partMasks: bundle.lock.layerOrder.length,
  geometry: bundle.geometry.metadata.diagnostics,
  material: { style: bundle.manifest.style, ...bundle.material.diagnostics, coverage: bundle.material.coverage,
    ...measureMaterialReadability(bundle.material.final, bundle.material.mask) },
})));
await json('scene-sources', { ...source, pair: { scene: 'outdoor', surveyorPivot: scenes[0].pivot, courierPivot: duoPivot },
  lineup: { pivots: [[40, 73], [120, 73], [200, 73]], background: '#8d8b85' } });
console.log('E4.4 character benchmark written to ' + out);
