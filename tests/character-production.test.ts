import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pack } from '../src/core/palette/colors.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { characterReview, writeCharacterReview } from '../src/generators/character/export.ts';
import { characterMaterialReview } from '../src/generators/character/material-export.ts';
import { forestCourier, surveyorRefinements } from '../src/generators/character/presets.ts';
import { characterProductionPackage, unpackPartMask, verifyCharacterProductionPackage } from '../src/generators/character/production.ts';
import { alphaPlane, makeShapeLock, type ShapeLock } from '../src/generators/character/shape-lock.ts';
import { measureMaterialReadability } from '../src/quality/character-materials.ts';
import { sha256 } from '../src/quality/raster.ts';

const baseline = 'benchmarks/results/e42';
const b1 = () => characterReview(surveyorRefinements.b1);
const lock = () => JSON.parse(readFileSync(baseline + '/b1-shape-lock.json', 'utf8')) as ShapeLock;

test('the complete published E4.2 manifest, report and previews keep their hashes', () => {
  const catalog = readFileSync('docs/e42-benchmark-sha256.txt', 'utf8').trim().split(/\r?\n/);
  assert.equal(catalog.length, 39);
  for (const entry of catalog) {
    const [digest, path] = entry.split('  ');
    assert.equal(sha256(readFileSync(path)), digest, path);
  }
  for (const style of ['m1', 'm2'] as const) {
    for (const [file, data] of characterMaterialReview(b1(), lock(), style).files) {
      assert.deepEqual(data, readFileSync(baseline + '/' + style + '/' + file));
    }
  }
});

test('M2P improves measured glass separation and retains ownership, alpha and shoulder planes', () => {
  const geometry = b1(), expected = lock();
  const m2 = characterMaterialReview(geometry, expected, 'm2'), m2p = characterMaterialReview(geometry, expected, 'm2p');
  const before = measureMaterialReadability(m2.final, m2.mask), after = measureMaterialReadability(m2p.final, m2p.mask);
  assert.ok(before.lantern && after.lantern);
  assert.equal(before.lantern.glassPixels, after.lantern.glassPixels);
  assert.ok(after.lantern.glassMinusFrame > before.lantern.glassMinusFrame + 5);
  assert.ok(after.lantern.frameMinusFarTrousers > before.lantern.frameMinusFarTrousers);
  assert.ok(after.lantern.brightGlassPixels > before.lantern.brightGlassPixels);
  assert.ok(after.coatPlanes.nearMinusFar > 25);
  assert.equal(after.coatPlanes.farLuma, before.coatPlanes.farLuma);
  assert.deepEqual(m2.mask, m2p.mask);
  assert.equal(m2p.metadata.images.alphaSha256, expected.silhouetteAlphaSha256);
  assert.deepEqual(decodePng(m2p.files.get('final.png')!), m2p.final);
  for (const key of expected.layerOrder) assert.deepEqual(alphaPlane(m2p.layers[key]), alphaPlane(geometry.layers[key]));
  const colors = ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'];
  const limited = characterMaterialReview(geometry, expected, 'm2p', { mode: 'locked', colors });
  assert.equal(limited.diagnostics.status, 'PALETTE_LIMITED');
  const allowed = new Set([0, ...colors.map(pack)]);
  for (let at = 0; at < limited.final.rgba.length; at += 4) assert.ok(allowed.has(limited.final.rgba.readUInt32BE(at)));
  assert.deepEqual(alphaPlane(limited.final), alphaPlane(geometry.silhouette));
});

test('Forest Courier generalizes proportions, free-hand stance and material routing on an independent lock', () => {
  const courier = characterReview(forestCourier), surveyor = b1();
  assert.equal(courier.spec.version, 3);
  assert.ok(courier.spec.proportions.head[0] > surveyor.spec.proportions.head[0]);
  assert.ok(courier.spec.proportions.jacket[1] < surveyor.spec.proportions.jacket[1]);
  assert.deepEqual(courier.metadata.diagnostics.errors, []);
  assert.equal(courier.plan.poseIntent, 'standing-free');
  assert.ok(courier.layers.hood && courier.layers.satchel && courier.layers.strap);
  assert.equal(courier.layers.lantern, undefined);
  assert.notDeepEqual(courier.silhouette, surveyor.silhouette);
  assert.throws(() => characterMaterialReview(courier, lock(), 'm2'), /shape lock mismatch/i);
  const ownLock = makeShapeLock(courier, '67875ec', 'courier');
  assert.equal(ownLock.gripAnchor, null);
  const paint = characterMaterialReview(courier, ownLock, 'm2');
  assert.deepEqual(alphaPlane(paint.final), alphaPlane(courier.silhouette));
  assert.equal(paint.diagnostics.status, 'FULL_RAMP');
  assert.ok(paint.coverage.leather > 120 && paint.coverage.coat > 50 && paint.coverage.skin > 50);
  assert.equal(measureMaterialReadability(paint.final, paint.mask).lantern, null);
  const alternate = characterReview({ ...forestCourier, outfit: { ...forestCourier.outfit, cloth: 'teal' } });
  const alternatePaint = characterMaterialReview(alternate, makeShapeLock(alternate, '67875ec', 'courier-teal'), 'm2');
  assert.deepEqual(alphaPlane(alternatePaint.final), alphaPlane(paint.final));
  assert.notDeepEqual(alternatePaint.final, paint.final);
});

test('production package regenerates, preserves packed masks and rejects tampering', async t => {
  const directory = resolve('.cache');
  await mkdir(directory, { recursive: true });
  const out = await mkdtemp(join(directory, 'character-production-'));
  assert.ok(resolve(out).startsWith(directory + sep));
  t.after(() => rm(out, { force: true, recursive: true }));
  const shape = b1(), expected = lock();
  const pkg = characterProductionPackage(shape, expected, 'm2p', {
    checkpoint: '67875ec', reference: 'E4.2 M2 final PNG',
    referenceSha256: sha256(readFileSync(baseline + '/m2/final.png')),
  });
  await writeCharacterReview(out, pkg);
  const verified = await verifyCharacterProductionPackage(out);
  assert.deepEqual(verified.files, pkg.files);
  for (const [id, data] of Object.entries(verified.masks)) {
    const unpacked = unpackPartMask(data, 4096);
    assert.deepEqual(unpacked, Uint32Array.from(alphaPlane(verified.geometry.layers[id]), a => a / 255));
  }
  assert.throws(() => unpackPartMask('AA==', 4096), /wrong size/);
  const altered = { ...pkg.manifest, groundPivot: [29, 59] };
  await writeFile(join(out, 'manifest.json'), JSON.stringify(altered, null, 2) + '\n');
  await assert.rejects(verifyCharacterProductionPackage(out), /manifest\.json/);
  await writeFile(join(out, 'manifest.json'), pkg.files.get('manifest.json')!);
  await writeFile(join(out, 'final.png'), Buffer.from('edited image'));
  await assert.rejects(verifyCharacterProductionPackage(out), /final\.png/);
});
