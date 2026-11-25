import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { chestColors, pack } from '../src/core/palette/colors.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { characterReview } from '../src/generators/character/export.ts';
import { characterMaterialReview } from '../src/generators/character/material-export.ts';
import { characterProjectPalette, renderCharacterMaterials } from '../src/generators/character/materials.ts';
import { surveyorRefinements } from '../src/generators/character/presets.ts';
import { alphaPlane, makeShapeLock, type ShapeLock } from '../src/generators/character/shape-lock.ts';
import { sha256 } from '../src/quality/raster.ts';

const loadLock = () => JSON.parse(readFileSync('benchmarks/results/e42/b1-shape-lock.json', 'utf8')) as ShapeLock;

test('E4.1R benchmark remains locked and the material shape lock matches B1 exactly', () => {
  const lines = readFileSync('docs/e41r-benchmark-sha256.txt', 'utf8').trim().split(/\r?\n/);
  assert.equal(lines.length, 21);
  for (const line of lines) {
    const [digest, path] = line.split('  ');
    assert.equal(sha256(readFileSync(path)), digest, path);
  }
  const lock = loadLock();
  const b1 = characterReview(surveyorRefinements.b1);
  assert.deepEqual(makeShapeLock(b1, '58b2d4c', 'b1'), lock);
  assert.equal(lock.source.geometrySha256, sha256(readFileSync('benchmarks/results/e41r/b1/geometry.json')));
  assert.equal(lock.characterSpecVersion, 2);
  assert.equal(Object.keys(lock.bodyParts).length, 20);
  assert.deepEqual(lock.groundPivot, [30, 59]);
  assert.equal(lock.lockedRegions.gripContact.pixels, 7);
  assert.equal(lock.lockedRegions.handleOpening.pixels, 2);
});

test('the two authored outputs are distinct and deterministic with the same exact alpha and owned part masks', () => {
  const b1 = characterReview(surveyorRefinements.b1);
  const lock = loadLock();
  const m1 = characterMaterialReview(b1, lock, 'm1'), m2 = characterMaterialReview(b1, lock, 'm2');
  assert.notDeepEqual(m1.final, m2.final);
  assert.deepEqual(m1.mask, m2.mask);
  for (const result of [m1, m2]) {
    assert.deepEqual(alphaPlane(result.final), alphaPlane(b1.silhouette));
    assert.deepEqual(alphaPlane(result.mask), alphaPlane(b1.silhouette));
    assert.equal(result.metadata.images.alphaSha256, lock.silhouetteAlphaSha256);
    assert.deepEqual(result.files.get('silhouette.png'), b1.files.get('silhouette.png'));
    assert.deepEqual(decodePng(result.files.get('final.png')!), result.final);
    assert.deepEqual(Object.keys(result.layers), Object.keys(b1.layers));
    for (const [name, layer] of Object.entries(result.layers)) assert.deepEqual(alphaPlane(layer), alphaPlane(b1.layers[name]));
    assert.deepEqual(characterMaterialReview(b1, lock, result.metadata.style).files, result.files);
    assert.equal(result.diagnostics.status, 'FULL_RAMP');
  }
});

test('rejects B2, a shifted landmark, a moved pivot and an edited part mask under B1 approval', () => {
  const approved = characterReview(surveyorRefinements.b1);
  const lock = makeShapeLock(approved, '58b2d4c', 'b1');
  assert.throws(() => renderCharacterMaterials(characterReview(surveyorRefinements.b2), lock, 'm1'), /shape lock mismatch/i);
  const landmark = approved.plan.landmarks['grip-anchor'];
  landmark.point = [landmark.point[0] + 1, landmark.point[1]];
  assert.throws(() => renderCharacterMaterials(approved, lock, 'm1'), /shape lock mismatch/i);
  const pivot = characterReview(surveyorRefinements.b1);
  pivot.plan.pivot = [29, 59];
  assert.throws(() => renderCharacterMaterials(pivot, lock, 'm1'), /shape lock mismatch/i);
  const escaped = characterReview(surveyorRefinements.b1);
  escaped.layers.jacket.rgba[3] = 255;
  assert.throws(() => renderCharacterMaterials(escaped, lock, 'm2'), /shape lock mismatch/i);
});

test('Project retains the approved E2 colors and Locked emits only request inks with diagnostics', () => {
  assert.ok(Object.values(chestColors).every(color => characterProjectPalette.includes(color)));
  const b1 = characterReview(surveyorRefinements.b1), lock = loadLock();
  const colors = ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'];
  const allowed = new Set([0, ...colors.map(pack)]);
  assert.equal(renderCharacterMaterials(b1, lock, 'm1', { mode: 'project' }).diagnostics.status, 'FULL_RAMP');
  for (const id of ['m1', 'm2'] as const) {
    const result = renderCharacterMaterials(b1, lock, id, { mode: 'locked', colors });
    assert.equal(result.diagnostics.status, 'PALETTE_LIMITED');
    assert.ok(result.diagnostics.warnings.some(warning => warning.code === 'BASE_INK_COLLISION'));
    for (let offset = 0; offset < result.final.rgba.length; offset += 4) {
      assert.ok(allowed.has(result.final.rgba.readUInt32BE(offset)));
    }
    assert.deepEqual(alphaPlane(result.final), alphaPlane(b1.silhouette));
  }
});
