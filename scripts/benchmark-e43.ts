import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { pack } from '../src/core/palette/colors.ts';
import { blit, makeRaster, nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { characterReview, writeCharacterReview } from '../src/generators/character/export.ts';
import { characterMaterialReview } from '../src/generators/character/material-export.ts';
import { materialMaskLegend } from '../src/generators/character/materials.ts';
import { forestCourier, surveyorRefinements } from '../src/generators/character/presets.ts';
import { characterProductionPackage, verifyCharacterProductionPackage } from '../src/generators/character/production.ts';
import { makeShapeLock, type ShapeLock } from '../src/generators/character/shape-lock.ts';
import { characterGameScenes } from './character-scenes.ts';
import { measureMaterialReadability } from '../src/quality/character-materials.ts';
import { onBackground } from './game-preview.ts';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'benchmarks/results/run/e43' } } });
const out = resolve(values.out);
for (const edition of ['sample', 'e2', 'e23', 'e24', 'e3', 'e32', 'e33', 'e34', 'e41', 'e41r', 'e42']) {
  const locked = resolve('benchmarks/results', edition).toLowerCase();
  if (out.toLowerCase() === locked || out.toLowerCase().startsWith(locked + sep)) {
    throw new Error('Choose a separate E4.3 production directory.');
  }
}
await mkdir(out, { recursive: true });
const json = (name: string, value: unknown) => writeFile(join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const save = (name: string, raster: Raster) => writeFile(join(out, name + '.png'), encodePng(raster));

const baseline = 'benchmarks/results/e42';
const b1 = characterReview(surveyorRefinements.b1);
const b1Lock = JSON.parse(await readFile(join(baseline, 'b1-shape-lock.json'), 'utf8')) as ShapeLock;
const m1 = characterMaterialReview(b1, b1Lock, 'm1'), m2 = characterMaterialReview(b1, b1Lock, 'm2');
for (const [style, art] of [['m1', m1], ['m2', m2]] as const) {
  for (const [file, bytes] of art.files) assert.deepEqual(bytes, await readFile(join(baseline, style, file)), style + '/' + file);
}
const polish = characterProductionPackage(b1, b1Lock, 'm2p', {
  checkpoint: '67875ec', reference: 'E4.2 M2 final PNG', referenceSha256: m2.metadata.images.finalPngSha256,
});
const courier = characterReview(forestCourier);
const courierLock = makeShapeLock(courier, '67875ec', 'courier');
const courierPackage = characterProductionPackage(courier, courierLock, 'm2', {
  checkpoint: '67875ec', reference: 'E4.3 Forest Courier pilot geometry', referenceSha256: courierLock.source.geometrySha256,
});
for (const [id, bundle] of [['m2p', polish], ['courier', courierPackage]] as const) {
  const destination = join(out, 'packages', id);
  await writeCharacterReview(destination, bundle);
  assert.deepEqual((await verifyCharacterProductionPackage(destination)).manifest, bundle.manifest);
}
await save('courier-flat-1x', courier.flat);
await save('courier-4x', nearestNeighbor(courierPackage.material.final, 4));
await json('courier-geometry-qa', courier.metadata.diagnostics);

const { scenes, source: sceneSources } = await characterGameScenes();

const lineup = onBackground(makeRaster(240, 88), '#8d8b85');
const styles = [['m1', m1], ['m2', m2], ['m2p', polish.material]] as const;
const measurements = [];
for (const [index, [style, art]] of styles.entries()) {
  for (const { id, base, pivot } of scenes) {
    const scene = { ...base, rgba: Buffer.from(base.rgba) };
    blit(scene, art.final, pivot[0] - b1Lock.groundPivot[0], pivot[1] - b1Lock.groundPivot[1]);
    if (id === 'outdoor' && style !== 'm2p') {
      assert.deepEqual(encodePng(scene), await readFile(join(baseline, style + '-scene-1x.png')));
    }
    await save(id + '-' + style + '-1x', scene);
  }
  blit(lineup, art.final, 40 + index * 80 - b1Lock.groundPivot[0], 73 - b1Lock.groundPivot[1]);
  measurements.push({ style, ...measureMaterialReadability(art.final, art.mask), ...art.metadata.images });
}
await save('lineup-1x', lineup);
await save('lineup-4x', nearestNeighbor(lineup, 4));

const lanternLabels = new Set([pack(materialMaskLegend.glass), pack(materialMaskLegend.metal)]);
const gripBounds = b1.metadata.diagnostics.parts.lantern;
for (const [style, art] of [['m2', m2], ['m2p', polish.material]] as const) {
  const lamp = makeRaster(art.final.w, art.final.h);
  const { left, top, right, bottom } = gripBounds;
  const crop = makeRaster(right - left + 9, bottom - top + 9);
  const cutout = makeRaster(crop.w, crop.h);
  for (let offset = 0; offset < art.mask.rgba.length; offset += 4) {
    if (lanternLabels.has(art.mask.rgba.readUInt32BE(offset))) lamp.rgba.writeUInt32BE(art.final.rgba.readUInt32BE(offset), offset);
  }
  for (let y = 0; y < crop.h; y++) for (const [source, target] of [[art.final, crop], [lamp, cutout]] as const) {
    const start = ((top - 4 + y) * source.w + left - 4) * 4;
    source.rgba.copy(target.rgba, y * target.w * 4, start, start + target.w * 4);
  }
  await save(style + '-grip-6x', nearestNeighbor(crop, 6));
  await save(style + '-lantern-isolated-1x', onBackground(cutout, '#777886'));
}
const lockedColors = ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'];
const locked = characterMaterialReview(b1, b1Lock, 'm2p', { mode: 'locked', colors: lockedColors });
assert.equal(locked.diagnostics.status, 'PALETTE_LIMITED');
await save('m2p-locked-1x', locked.final);
await json('readability', {
  authored: measurements, locked: { policy: locked.diagnostics, measured: measureMaterialReadability(locked.final, locked.mask) },
  courier: { geometry: courier.metadata.diagnostics.bounds, measured: measureMaterialReadability(courierPackage.material.final, courierPackage.material.mask) },
});
await json('scene-sources', {
  ...sceneSources,
  lineup: { pivots: [[40, 73], [120, 73], [200, 73]], background: '#8d8b85' },
});
console.log('E4.3 production benchmark written to ' + out);
