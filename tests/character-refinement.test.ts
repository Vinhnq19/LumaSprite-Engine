import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodePng } from '../src/core/renderer/png.ts';
import { characterReview } from '../src/generators/character/export.ts';
import { surveyorRefinements, surveyors } from '../src/generators/character/presets.ts';
import { renderCharacter } from '../src/generators/character/render.ts';
import { checkCharacter } from '../src/quality/character.ts';
import { sha256 } from '../src/quality/raster.ts';

test('keeps the entire E4.1 published set and regenerates legacy character bundles byte for byte', () => {
  const catalog = readFileSync('docs/e41-baseline-sha256.txt', 'utf8').trim().split(/\r?\n/);
  assert.equal(catalog.length, 23);
  for (const line of catalog) {
    const [digest, path] = line.split('  ');
    assert.equal(sha256(readFileSync(path)), digest, path);
  }
  for (const [id, spec] of Object.entries(surveyors)) {
    for (const [file, bytes] of characterReview(spec).files) {
      assert.deepEqual(bytes, readFileSync('benchmarks/results/e41/' + id + '/' + file));
    }
  }
});

test('standing puts two feet on their own floor lines and stepping has genuine reach and raised toe', () => {
  const b1 = characterReview(surveyorRefinements.b1), b2 = characterReview(surveyorRefinements.b2);
  for (const candidate of [b1, b2]) {
    const d = candidate.metadata.diagnostics;
    assert.equal(candidate.spec.version, 2);
    assert.equal(d.structure, 'STRUCTURAL_VALID');
    assert.equal(d.constraints, 'POSE_CONSTRAINTS_VALID');
    assert.equal(d.visual, 'VISUAL_REVIEW_PENDING');
    assert.equal(d.pose!.feet.near.clearance, 0);
    assert.ok(d.pose!.headroom >= 3 && d.pose!.shoulderDrop > 1 && d.pose!.hipDrop > 1);
    assert.ok(d.legGapRows >= 2 && d.pose!.openHandleRows > 0 && d.pose!.lampBodyGap >= 4);
    assert.deepEqual(decodePng(candidate.files.get('flat.png')!), candidate.flat);
    assert.deepEqual(decodePng(candidate.files.get('silhouette.png')!), candidate.silhouette);
    assert.deepEqual(characterReview(candidate.spec).files, candidate.files);
  }
  const stand = b1.metadata.diagnostics, step = b2.metadata.diagnostics;
  assert.equal(stand.bounds.bottom - stand.bounds.top + 1, 56);
  assert.equal(stand.pose!.feet.far.clearance, 0);
  assert.ok(stand.pose!.feet.far.solePixels >= 3);
  assert.equal(b2.plan.poseIntent, 'forward-step-hold');
  assert.ok(step.pose!.feet.far.clearance > 0 && step.pose!.feet.far.toeRise > 0);
  assert.ok(b2.spec.pose.hip[0] > b1.spec.pose.hip[0] && b2.spec.pose.far.ankle[0] > b1.spec.pose.far.ankle[0]);
  assert.ok(step.centerX > step.pose!.feet.near.soleBand[1]);
  assert.notDeepEqual(b1.silhouette, b2.silhouette);
});

test('refinement diagnoses failed support, backwards knees and a filled handle as pose issues', () => {
  const stand = surveyorRefinements.b1, step = surveyorRefinements.b2;
  const foot = renderCharacter({ ...stand, pose: { ...stand.pose, secondaryGroundOffset: 0 } });
  const verdict = checkCharacter(foot);
  assert.equal(verdict.structure, 'STRUCTURAL_VALID');
  assert.equal(verdict.constraints, 'POSE_CONSTRAINTS_INVALID');
  assert.ok(verdict.errors.includes('SECONDARY_SOLE'));
  assert.throws(() => characterReview({ ...step, pose: { ...step.pose, secondaryGroundOffset: -3 } }), /STEP_FOOT_CLEARANCE/);
  assert.throws(() => characterReview({ ...stand, pose: { ...stand.pose, near: { ...stand.pose.near, knee: [25, 45] } } }), /KNEE_DIRECTION/);
  const handle = renderCharacter(stand);
  const [gx, gy] = handle.plan.landmarks['grip-anchor'].point;
  for (let y = gy + 2; y < gy + 5; y++) {
    const offset = (y * handle.flat.w + gx) * 4;
    handle.layers.lantern.rgba.writeUInt32BE(0x525869ff, offset);
    handle.flat.rgba.writeUInt32BE(0x525869ff, offset);
    handle.silhouette.rgba.writeUInt32BE(0x262334ff, offset);
  }
  assert.ok(checkCharacter(handle).errors.includes('HANDLE_OPENING'));
});

test('rejects new-proportion head and lantern clipping before publishing a bundle', () => {
  const stand = surveyorRefinements.b1;
  assert.throws(() => characterReview({ ...stand, proportions: { ...stand.proportions, head: [14, 18] } }), /cap exceeds the contour margin/);
  assert.throws(() => characterReview({
    ...stand, proportions: { ...stand.proportions, lantern: [10, 12] },
    pose: { ...stand.pose, near: { ...stand.pose.near, elbow: [40, 34], wrist: [56, 32], palm: [59, 31] } },
  }), /lantern exceeds the contour margin/);
});
