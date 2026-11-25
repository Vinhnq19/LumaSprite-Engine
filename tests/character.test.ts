import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodePng } from '../src/core/renderer/png.ts';
import { characterReview } from '../src/generators/character/export.ts';
import { surveyors } from '../src/generators/character/presets.ts';
import { renderCharacter } from '../src/generators/character/render.ts';
import { checkCharacter } from '../src/quality/character.ts';

test('both Field Surveyor pilots have connected deterministic 64×64 silhouettes and real raster grips', () => {
  const a = characterReview(surveyors.a), b = characterReview(surveyors.b);
  for (const candidate of [a, b]) {
    const { diagnostics } = candidate.metadata;
    assert.deepEqual(diagnostics.errors, []);
    assert.equal(diagnostics.bounds.components, 1);
    assert.equal(Object.keys(diagnostics.joints).length, 12);
    assert.ok(diagnostics.legGapRows >= 2 && diagnostics.gripPixels >= 2 && diagnostics.lampGapRows >= 2);
    assert.equal(candidate.flat.w, 64);
    assert.equal(candidate.flat.h, 64);
    assert.deepEqual(decodePng(candidate.files.get('silhouette.png')!), candidate.silhouette);
    assert.deepEqual(decodePng(candidate.files.get('flat.png')!), candidate.flat);
    assert.deepEqual(characterReview(candidate.spec).files, candidate.files);
  }
  const height = (x: typeof a) => x.metadata.diagnostics.bounds.bottom - x.metadata.diagnostics.bounds.top + 1;
  assert.ok(height(b) >= height(a) + 7);
  assert.ok(b.spec.pose.near.palm[1] <= a.spec.pose.near.palm[1] - 5);
  let changed = 0;
  for (let i = 3; i < a.silhouette.rgba.length; i += 4) if (a.silhouette.rgba[i] !== b.silhouette.rgba[i]) changed++;
  assert.ok(changed > 200, String(changed));
});

test('rejects invalid proportions, a reversed knee, clipping and unsupported views', () => {
  const a = surveyors.a;
  assert.throws(() => characterReview({ ...a, proportions: { ...a.proportions, head: [4, 15] } }));
  assert.throws(() => characterReview({ ...a, canvas: { ...a.canvas, w: 32 } }));
  assert.throws(() => characterReview({ ...a, view: 'front' }));
  assert.throws(() => characterReview({ ...a, pose: { ...a.pose, near: { ...a.pose.near, knee: [25, 37] } } }), /segment|POSE_CHAIN/);
  assert.throws(() => characterReview({ ...a, pose: { ...a.pose, near: { ...a.pose.near, wrist: [49, 33], palm: [52, 32] } } }), /segment|margin/);
});

test('reports a corrupt grip mask, reversed layer order and malformed alpha independently', () => {
  const lost = renderCharacter(surveyors.a);
  lost.layers['near-hand'].rgba.fill(0);
  assert.ok(checkCharacter(lost).errors.includes('GRIP_CONTACT'));
  const swapped = renderCharacter(surveyors.a);
  swapped.plan.parts.reverse();
  assert.ok(checkCharacter(swapped).errors.includes('GRIP_DEPTH'));
  assert.ok(checkCharacter(swapped).errors.includes('PART_DEPTH'));
  assert.ok(checkCharacter(swapped).errors.includes('RASTER_DEPTH'));
  const rgba = renderCharacter(surveyors.a);
  rgba.flat.rgba[3] = 128;
  assert.ok(checkCharacter(rgba).errors.includes('ALPHA'));
  const badPivot = { ...surveyors.a, pose: { ...surveyors.a.pose, pivot: [28, 59] } };
  assert.throws(() => characterReview(badPivot), /GROUND_CONTACT/);
});

test('a locked palette limits output inks without changing structural alpha', () => {
  const normal = characterReview(surveyors.a);
  const colors = ['#263344', '#947344', '#dad0b4'];
  const locked = characterReview({ ...surveyors.a, palette: { mode: 'locked', colors } });
  assert.deepEqual(locked.metadata.diagnostics.errors, []);
  for (let i = 3; i < locked.flat.rgba.length; i += 4) {
    assert.equal(normal.flat.rgba[i], locked.flat.rgba[i]);
    if (locked.flat.rgba[i]) assert.ok(colors.includes('#' + locked.flat.rgba.toString('hex', i - 3, i)));
  }
});
