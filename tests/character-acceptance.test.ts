import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { characterReview } from '../src/generators/character/export.ts';
import { characterMaterialReview } from '../src/generators/character/material-export.ts';
import { forestCourierRevision, surveyorGeometryRevisions } from '../src/generators/character/presets.ts';
import { verifyCharacterProductionPackage } from '../src/generators/character/production.ts';
import { alphaPlane, requireShapeLock } from '../src/generators/character/shape-lock.ts';
import { measureMaterialReadability } from '../src/quality/character-materials.ts';
import { sha256 } from '../src/quality/raster.ts';
import { characterSpecSchema } from '../src/specs/character.ts';

const published = (edition: 43 | 44, id: string) => verifyCharacterProductionPackage('benchmarks/results/e' + edition + '/packages/' + id);

test('all published E4.3 bytes and both independent original assets still verify', async () => {
  const hashes = (await readFile('docs/e43-benchmark-sha256.txt', 'utf8')).trim().split(/\r?\n/);
  assert.equal(hashes.length, 41);
  for (const entry of hashes) {
    const [expected, file] = entry.split('  ');
    assert.equal(sha256(await readFile(file)), expected, file);
  }
  const [b1, courier] = await Promise.all([published(43, 'm2p'), published(43, 'courier')]);
  assert.equal(b1.lock.lockedRegions.silhouette.pixels, 1086);
  assert.equal(courier.lock.lockedRegions.silhouette.pixels, 978);
});

test('R1 rebuilds only the lantern arm while retaining both soles, the palm, the handle and the light output', async () => {
  const [b1, r1] = await Promise.all([published(43, 'm2p'), published(44, 'r1')]);
  const { lock, geometry } = r1;
  assert.equal(lock.geometryRevision, 1);
  assert.deepEqual(geometry.spec, characterSpecSchema.parse(surveyorGeometryRevisions.r1));
  assert.throws(() => requireShapeLock(geometry, b1.lock), /shape lock mismatch/i);
  assert.deepEqual(geometry.plan.landmarks['near-elbow'].point, [32, 36]);
  assert.deepEqual(lock.layerOrder.filter(id => lock.bodyParts[id].alphaSha256 !== b1.lock.bodyParts[id].alphaSha256),
    ['near-upper-arm', 'near-forearm']);
  for (const id of Object.keys(lock.landmarks).filter(id => id !== 'near-elbow')) {
    assert.deepEqual(lock.landmarks[id], b1.lock.landmarks[id], id);
  }
  assert.deepEqual(lock.lockedRegions.gripContact, b1.lock.lockedRegions.gripContact);
  assert.deepEqual(lock.lockedRegions.handleOpening, b1.lock.lockedRegions.handleOpening);
  assert.deepEqual(lock.lockedRegions.bootSoles, b1.lock.lockedRegions.bootSoles);
  assert.deepEqual(lock.gripAnchor, [49, 33]);
  assert.deepEqual(lock.groundPivot, [30, 59]);
  assert.equal(geometry.metadata.diagnostics.gripPixels, 7);
  assert.equal(geometry.metadata.diagnostics.pose?.openHandleRows, 2);
  assert.ok(geometry.metadata.diagnostics.pose!.armTorsoGapRows >= 2);
  assert.deepEqual(r1.material.diagnostics.ramps, b1.material.diagnostics.ramps);
  assert.equal(measureMaterialReadability(r1.material.final, r1.material.mask).lantern?.brightGlassPixels, 10);
  assert.equal(r1.manifest.lineage.referenceSha256, sha256(b1.files.get('shape-lock.json')!));
});

test('R2 retains R1 arm intent and locked contact while changing the cap, coat planes and knee silhouettes', async () => {
  const [r1, r2] = await Promise.all([published(44, 'r1'), published(44, 'r2')]);
  const before = r1.geometry.metadata.diagnostics, after = r2.geometry.metadata.diagnostics;
  assert.equal(r2.lock.geometryRevision, 2);
  assert.throws(() => requireShapeLock(r2.geometry, r1.lock), /shape lock mismatch/i);
  assert.deepEqual(r2.geometry.plan.landmarks['near-elbow'], r1.geometry.plan.landmarks['near-elbow']);
  assert.deepEqual(r2.geometry.plan.landmarks['near-wrist'], r1.geometry.plan.landmarks['near-wrist']);
  assert.deepEqual(r2.lock.gripAnchor, r1.lock.gripAnchor);
  assert.deepEqual(r2.lock.bodyParts.lantern, r1.lock.bodyParts.lantern);
  assert.deepEqual(r2.lock.lockedRegions.handleOpening, r1.lock.lockedRegions.handleOpening);
  assert.equal(r2.lock.lockedRegions.bootSoles.alphaSha256, r1.lock.lockedRegions.bootSoles.alphaSha256);
  assert.equal(after.pose?.headroom, before.pose?.headroom);
  assert.ok(after.parts.cap.right < before.parts.cap.right);
  assert.ok(after.pose!.shoulderDrop > before.pose!.shoulderDrop);
  for (const side of ['near', 'far']) assert.ok(after.pose!.kneeBends[side] < before.pose!.kneeBends[side]);
  assert.deepEqual(after.pose?.feet, before.pose?.feet);
  assert.ok(after.legGapRows >= before.legGapRows);
  assert.deepEqual(r2.material.diagnostics.ramps, r1.material.diagnostics.ramps);
  assert.equal(measureMaterialReadability(r2.material.final, r2.material.mask).lantern?.brightGlassPixels, 10);
  assert.equal(r2.manifest.lineage.referenceSha256, sha256(r1.files.get('shape-lock.json')!));
  const spec = surveyorGeometryRevisions.r2;
  assert.throws(() => characterReview({ ...spec, geometryRevision: { ...spec.geometryRevision, headOpening: 4 } }));
  assert.throws(() => characterReview({ ...spec, geometryRevision: { ...spec.geometryRevision, satchelFlap: true } }));
});

test('Courier revision keeps the v3 stance and palette and paints the flap inside its own mask with an existing leather tone', async () => {
  const [before, after] = await Promise.all([published(43, 'courier'), published(44, 'courier-rev')]);
  const { geometry, lock, material } = after;
  assert.deepEqual(geometry.spec, characterSpecSchema.parse(forestCourierRevision));
  assert.equal(lock.geometryRevision, 1);
  assert.equal(lock.gripAnchor, null);
  assert.equal(lock.layerOrder.length, 19);
  assert.throws(() => requireShapeLock(geometry, before.lock), /shape lock mismatch/i);
  assert.deepEqual(lock.groundPivot, [32, 58]);
  assert.deepEqual(geometry.metadata.diagnostics.pose?.feet, before.geometry.metadata.diagnostics.pose?.feet);
  assert.equal(geometry.metadata.diagnostics.legGapRows, before.geometry.metadata.diagnostics.legGapRows);
  assert.deepEqual(material.diagnostics.ramps, before.material.diagnostics.ramps);
  assert.ok(geometry.plan.parts.find(({ id }) => id === 'satchel')!.shapes.some(({ ink }) => ink === 'contour'));
  assert.deepEqual(alphaPlane(material.layers.satchel), alphaPlane(geometry.layers.satchel));
  const lockedColors = ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'];
  const locked = characterMaterialReview(geometry, lock, 'm2', { mode: 'locked', colors: lockedColors });
  assert.ok(locked.usedColors.every(ink => lockedColors.includes(ink)));
  assert.equal(locked.diagnostics.status, 'PALETTE_LIMITED');
  assert.equal(after.manifest.lineage.referenceSha256, sha256(before.files.get('shape-lock.json')!));
});
