import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { decodePng } from '../src/core/renderer/png.ts';
import { buildIdleAnimation, inspectIdleTransition, unpackAnimationStrip, verifyAnimationPackage } from '../src/generators/character/animation.ts';
import { writeCharacterReview } from '../src/generators/character/export.ts';
import { verifyCharacterProductionPackage } from '../src/generators/character/production.ts';
import { animationSpecSchema } from '../src/specs/animation.ts';

const sourcePath = 'benchmarks/results/e44/packages/r2';
const inputs = async () => {
  const [source, bytes] = await Promise.all([
    verifyCharacterProductionPackage(sourcePath), readFile('benchmarks/fixtures/e51/surveyor-idle.json', 'utf8'),
  ]);
  return { source, spec: animationSpecSchema.parse(JSON.parse(bytes)) };
};

test('idle animates the torso and returns to exact R2 with fixed feet, grip, ramps and 1 px continuity including wrap', async () => {
  const { source, spec } = await inputs();
  const result = buildIdleAnimation(source, spec);
  assert.equal(result.timing.frames.length, 4);
  assert.deepEqual(result.timing.frames.map(frame => frame.durationMs), [360, 480, 360, 600]);
  assert.equal(result.timing.totalDurationMs, 1800);
  assert.equal(result.timing.loop, 'repeat');
  assert.deepEqual(result.timing.pivot, [30, 59]);
  assert.equal(new Set(result.qa.frames.map(frame => frame.alphaSha256)).size, 3);
  for (const [i, frame] of result.frames.entries()) {
    assert.deepEqual(frame.geometry.metadata.diagnostics.errors, []);
    assert.deepEqual(frame.lock.layerOrder, source.lock.layerOrder);
    assert.deepEqual(frame.lock.gripAnchor, [49, 33]);
    assert.deepEqual(frame.lock.lockedRegions.bootSoles, source.lock.lockedRegions.bootSoles);
    assert.deepEqual(frame.lock.lockedRegions.gripContact, source.lock.lockedRegions.gripContact);
    assert.equal(result.qa.frames[i].gripPixels, 7);
    assert.equal(result.qa.frames[i].openHandleRows, 2);
    assert.deepEqual(frame.material.diagnostics.ramps, source.material.diagnostics.ramps);
  }
  assert.deepEqual(result.frames[0].material.final, source.material.final);
  assert.deepEqual(result.frames[2].material.final, source.material.final);
  for (const check of result.qa.transitions) {
    assert.equal(check.maxJointStepPx, 1);
    assert.deepEqual(check.flicker, []);
    assert.ok(check.comparedParts > 0);
  }
  assert.equal(result.qa.transitions.at(-1)?.wrap, true);
  assert.deepEqual(unpackAnimationStrip(decodePng(result.files.get('spritesheet.png')!), result.timing),
    result.frames.map(frame => frame.material.final));
  assert.deepEqual(buildIdleAnimation(source, spec).files, result.files);
  assert.deepEqual((await verifyAnimationPackage('benchmarks/results/e51/package', sourcePath)).files, result.files);
});

test('animation rejects invalid timing, reordered poses, mismatched source and broken lantern clearance', async () => {
  const { source, spec } = await inputs();
  assert.throws(() => animationSpecSchema.parse({ ...spec, frameCount: 3 }), /Frame count/);
  assert.throws(() => animationSpecSchema.parse({ ...spec, keyPoses: [...spec.keyPoses].reverse() }), /Start at neutral/);
  const badTime = structuredClone(spec);
  badTime.keyPoses[1].durationMs = 0;
  assert.throws(() => animationSpecSchema.parse(badTime));
  assert.throws(() => buildIdleAnimation(source, { ...spec, pivot: [31, 59] }), /pivot.*match/);
  assert.throws(() => buildIdleAnimation(source, { ...spec, source: { ...spec.source, shapeLockSha256: '0'.repeat(64) } }), /source revision/);
  const badArm = structuredClone(spec);
  badArm.keyPoses[1].body.jacketWidth = 0;
  badArm.keyPoses[1].joints.nearElbow = [0, 1];
  assert.throws(() => buildIdleAnimation(source, badArm), /ARM_TORSO_CLEARANCE/);
});

test('flicker diagnostic catches altered paint on a translated part and allows legitimate silhouette movement', async () => {
  const { source, spec } = await inputs();
  const { frames } = buildIdleAnimation(source, spec);
  const from = frames[2], to = frames[3];
  const cloned = { ...to.material.layers.cap, rgba: Buffer.from(to.material.layers.cap.rgba) };
  const pixel = cloned.rgba.findIndex((ink, offset) => offset % 4 === 3 && ink === 255);
  cloned.rgba[pixel - 3] ^= 1;
  const altered = { ...to, material: { ...to.material, layers: { ...to.material.layers, cap: cloned } } };
  assert.deepEqual(inspectIdleTransition(from, to).flicker, []);
  assert.deepEqual(inspectIdleTransition(from, altered).flicker, [{ part: 'cap', pixels: 1 }]);
});

test('portable animation verifier rejects replaced timing and misordered sheet cells', async t => {
  const { source, spec } = await inputs();
  const built = buildIdleAnimation(source, spec);
  const badTiming = { ...built.timing, frames: [...built.timing.frames].reverse() };
  assert.throws(() => unpackAnimationStrip(built.sheet, badTiming), /out of order/);
  const cache = resolve('.cache');
  await mkdir(cache, { recursive: true });
  const dir = await mkdtemp(join(cache, 'idle-package-'));
  assert.ok(dir.startsWith(cache + sep));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeCharacterReview(dir, built);
  await writeFile(join(dir, 'timing.json'), JSON.stringify({ ...built.timing, totalDurationMs: 1801 }));
  await assert.rejects(verifyAnimationPackage(dir, sourcePath), /timing.json/);
});
