import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { chestColors, pack } from '../../../src/core/palette/colors.ts';
import type { Point } from '../../../src/core/geometry/shapes.ts';
import { nearestNeighbor, put } from '../../../src/core/pixels/raster.ts';
import { verifyCharacterProductionPackage } from '../../../src/generators/character/production.ts';
import { buildWalkAnimation } from '../../../src/generators/character/walk.ts';
import { inspectMotionTransition, packAnimation, type AnimationFrame } from '../../../src/generators/character/animation-export.ts';
import { planCharacter } from '../../../src/generators/character/geometry.ts';
import { characterReview } from '../../../src/generators/character/export.ts';
import { makeShapeLock } from '../../../src/generators/character/shape-lock.ts';
import { characterMaterialReview } from '../../../src/generators/character/material-export.ts';
import { outlineMarks } from '../../../scripts/character-preview.ts';
import { compareTime, inspect, json, placed, png, round, save, scenes, strip } from './common.ts';

const source = await verifyCharacterProductionPackage('benchmarks/results/e44/packages/r2');
const fixture = JSON.parse(readFileSync('benchmarks/fixtures/e52/w2.json', 'utf8'));
const baseline = buildWalkAnimation(source, fixture);
const sides = ['near', 'far'] as const;
const root = baseline.timing.rootMotion;
assert.equal(baseline.timing.totalDurationMs, 880);
assert.ok(baseline.files.get('spritesheet.png')!.equals(readFileSync('benchmarks/results/e52/w2/package/spritesheet.png')));
assert.ok(baseline.files.get('timing.json')!.equals(readFileSync('benchmarks/results/e52/w2/package/timing.json')));
assert.ok(source.geometry.spec.version === 2);
const rest = source.geometry.spec.pose;
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cosine = (n: number) => Math.max(-1, Math.min(1, n));

// Law-of-cosines construction adapted from Ink & Bones Skeleton.solveChain (MIT).
// W2 owns the contact targets. Compression and integer rounding belong to this experiment.
function renderIk(frame: AnimationFrame, i: number): AnimationFrame {
  assert.ok(frame.geometry.spec.version === 2);
  const pose = structuredClone(frame.geometry.spec.pose);
  const gait = frame.geometry.plan.gait!;
  const key = baseline.spec.keyPoses[i];
  if (key.phase === 'down') {
    pose.hip[1]--;
    const swing = key.lead === 'near' ? 'far' : 'near';
    pose[swing].ankle[0]++;
    for (const joint of ['elbow', 'wrist', 'palm'] as const) pose.far[joint][1]--;
  }
  const plan = planCharacter({ ...frame.geometry.spec, pose }, gait);
  for (const side of sides) {
    const hip = plan.landmarks[side + '-hip'].point;
    const a = pose[side].ankle;
    const restHip = source.lock.landmarks[side + '-hip'].point;
    const nominalUpper = distance(restHip, rest[side].knee);
    const nominalLower = distance(rest[side].knee, rest[side].ankle);
    const dx = a[0] - hip[0];
    const dy = a[1] - hip[1];
    const d = Math.hypot(dx, dy);
    const bend = key.phase === 'down' && !gait.planted[side] ? 2.65 :
      { contact: 2.35, down: 3.5, passing: 3.25, up: 2.25 }[key.phase];
    const restLength = nominalUpper + nominalLower;
    const ratio = Math.max(d + 0.35, Math.min(restLength, Math.hypot(d, 2 * bend))) / restLength;
    const upper = nominalUpper * ratio;
    const lower = nominalLower * ratio;
    const angle = Math.atan2(dx, dy) + Math.acos(cosine((upper * upper + d * d - lower * lower) / (2 * upper * d)));
    const y = Math.max(hip[1] + 3, Math.min(a[1] - 3, Math.round(hip[1] + upper * Math.cos(angle))));
    const axisX = hip[0] + dx * (y - hip[1]) / dy;
    const x = Math.max(Math.ceil(axisX - 0.65), Math.min(Math.floor(axisX + 4.7), Math.round(hip[0] + upper * Math.sin(angle))));
    pose[side].knee = [x, y];
  }
  const geometry = characterReview({ ...frame.geometry.spec, pose }, gait);
  const lock = makeShapeLock(geometry, baseline.spec.source.checkpoint, 'w2-ik-' + i);
  const material = characterMaterialReview(geometry, lock, source.manifest.style);
  return { geometry, lock, material };
}

const candidate = baseline.frames.map(renderIk);
function diagnostics(frames: AnimationFrame[]) {
  const samples = frames.map(({ geometry, lock, material }, i) => {
    const pose = geometry.metadata.diagnostics.pose!;
    assert.deepEqual(lock.groundPivot, source.lock.groundPivot);
    assert.deepEqual(lock.layerOrder, source.lock.layerOrder);
    assert.deepEqual(material.diagnostics.ramps, source.material.diagnostics.ramps);
    assert.deepEqual(lock.lockedRegions.gripContact.pixels, source.lock.lockedRegions.gripContact.pixels);
    assert.deepEqual(lock.lockedRegions.handleOpening.pixels, source.lock.lockedRegions.handleOpening.pixels);
    assert.equal(pose.openHandleRows, 2);
    assert.ok(pose.lampBodyGap >= 5);
    const point = (id: string) => lock.landmarks[id].point;
    const feet = sides.map(side => {
      const foot = pose.feet[side];
      const hip = point(side + '-hip'), knee = point(side + '-knee'), ankle = point(side + '-ankle');
      const angle = Math.acos(cosine(((hip[0] - knee[0]) * (ankle[0] - knee[0]) + (hip[1] - knee[1]) * (ankle[1] - knee[1])) /
        (distance(hip, knee) * distance(knee, ankle)))) * 180 / Math.PI;
      const ground = point(side + '-ground');
      const canvas: Point = [ground[0], foot.projectedGroundY - foot.clearance];
      const state = root.frames[i].feet[side].state;
      const world: Point = [canvas[0] + root.frames[i].rootX, canvas[1]];
      if (state === 'planted') assert.deepEqual(world, root.frames[i].feet[side].world);
      return { side, state, hip, knee, ankle, angle: round(angle), upperPx: round(distance(hip, knee)), lowerPx: round(distance(knee, ankle)),
        canvas, world, groundY: foot.projectedGroundY, clearance: foot.clearance, solePixels: foot.solePixels };
    });
    const palm = point('near-palm');
    assert.ok(lock.gripAnchor);
    const gripOffset = [lock.gripAnchor[0] - palm[0], lock.gripAnchor[1] - palm[1]];
    assert.deepEqual(gripOffset, [1, 1]);
    const palette = [...new Set([chestColors.contour, ...Object.values(material.diagnostics.ramps).flat()])];
    const raster = inspect(material.final, palette);
    return {
      phase: root.frames[i].phase, lead: root.frames[i].lead, rootX: root.frames[i].rootX,
      centerX: geometry.metadata.diagnostics.centerX, hip: point('pelvis'), shoulder: point('near-shoulder'), freePalm: point('far-palm'),
      grip: lock.gripAnchor, gripOffset, gripPixels: geometry.metadata.diagnostics.gripPixels,
      opening: pose.openHandleRows, lampGap: pose.lampBodyGap, feet, alpha: raster.area, rgba: raster.rgba,
      maskArea: Object.fromEntries(lock.layerOrder.map(id => [id, lock.bodyParts[id].pixels])),
    };
  });
  const edges = frames.map((from, i) => {
    const j = (i + 1) % frames.length;
    const a = samples[i], b = samples[j];
    const motion = inspectMotionTransition(from, frames[j]);
    assert.equal(motion.flicker.length, 0);
    for (const [id, [dx, dy]] of Object.entries(motion.displacement)) {
      const low = /(?:ankle|ground)$/.test(id);
      const knee = id.endsWith('-knee');
      const freeArm = /^far-.*(?:elbow|wrist|palm)$/.test(id);
      assert.ok(Math.abs(dx) <= (low ? 10 : knee || freeArm ? 7 : 4), id + ' horizontal continuity');
      assert.ok(Math.abs(dy) <= (low ? 7 : knee ? 5 : 4), id + ' vertical continuity');
    }
    assert.ok(Math.abs(b.alpha - a.alpha) <= 140);
    const feet = a.feet.map((foot, k) => {
      const next = b.feet[k];
      const delta = foot.state === 'planted' && next.state === 'planted' ? [next.world[0] - foot.world[0] + (j === 0 ? root.cyclePx : 0), next.world[1] - foot.world[1]] : null;
      if (delta) assert.deepEqual(delta, [0, 0]);
      return { side: foot.side, plantDelta: delta, kneeChange: round(Math.abs(next.angle - foot.angle)) };
    });
    let outlineChanges = 0;
    for (let at = 3; at < frames[i].material.final.rgba.length; at += 4) {
      if (frames[i].material.final.rgba[at] !== frames[j].material.final.rgba[at]) outlineChanges++;
    }
    return { i, j, feet, alphaAreaChange: Math.abs(b.alpha - a.alpha), outlineChanges, ...motion };
  });
  const angles = edges.flatMap(edge => edge.feet.map(foot => foot.kneeChange));
  const swingClearance = samples.map(sample => sample.feet.filter(foot => foot.state === 'swing').map(foot => foot.clearance));
  return { samples, edges, summary: {
    plantedPairs: edges.flatMap(edge => edge.feet).filter(foot => foot.plantDelta !== null).length,
    kneeMean: round(angles.reduce((a, b) => a + b) / angles.length), kneeMax: Math.max(...angles),
    hipY: samples.map(sample => sample.hip[1]), shoulderY: samples.map(sample => sample.shoulder[1]), swingClearance,
    alphaMaxChange: Math.max(...edges.map(edge => edge.alphaAreaChange)),
    outlineMeanChange: round(edges.reduce((sum, edge) => sum + edge.outlineChanges, 0) / edges.length),
    wrapKnee: edges.at(-1)!.feet.map(foot => foot.kneeChange), wrapJoint: edges.at(-1)!.maxJointStepPx,
    stablePaintPairs: edges.reduce((sum, edge) => sum + edge.comparedParts, 0),
  } };
}

const before = diagnostics(baseline.frames);
const after = diagnostics(candidate);
const packed = packAnimation(source, { ...baseline.spec, name: 'W2-IK' }, candidate, after, {
  rootMotion: { ...root, frames: root.frames.map((frame, i) => ({ ...frame, feet: Object.fromEntries(after.samples[i].feet.map(foot => [foot.side, foot])) })) },
});
assert.ok(candidate.every((frame, i) => isDeepStrictEqual(renderIk(baseline.frames[i], i).material.final, frame.material.final)));
const { backgrounds, source: sceneSources } = await scenes();
for (const [id, clip, data] of [['w2', baseline, before], ['w2-ik', packed, after]] as const) {
  save(id + '-strip.png', clip.files.get('spritesheet.png')!);
  json(id + '-timing.json', { ...clip.timing, image: id + '-strip.png' });
  png(id + '-4x.png', nearestNeighbor(clip.sheet, 4));
  png(id + '-marks.png', strip(clip.frames.map((frame, i) => {
    const raster = outlineMarks(frame.geometry);
    for (const foot of data.samples[i].feet) {
      const color = pack(foot.state === 'planted' ? '#ffaf58' : '#89c6ff');
      for (let dx = -6; dx <= 6; dx++) put(raster, foot.canvas[0] * 4 + dx, foot.canvas[1] * 4 - 1, color);
    }
    return raster;
  })));
  for (const scene of backgrounds) {
    png(id + '-' + scene.id + '.png', strip(clip.frames.map((frame, i) =>
      placed(scene.background, frame.material.final, scene.pivot, baseline.spec.pivot, root.frames[i].rootX))));
  }
}
json('ik-poses.json', { version: 1, upstream: '26b93914ada8414732bc65b7679222b65f004d9b', source: baseline.spec.source,
  frames: candidate.map(frame => ({ pose: frame.geometry.spec.pose, gait: frame.geometry.plan.gait })) });
json('ik-qa.json', { durationMs: 880, rootTravelPx: root.cyclePx, sceneSources, before, after });
json('ik-perf.json', compareTime(
  () => baseline.frames.map((frame, i) => {
    const geometry = characterReview(frame.geometry.spec, frame.geometry.plan.gait);
    const lock = makeShapeLock(geometry, baseline.spec.source.checkpoint, 'w2-perf-' + i);
    return characterMaterialReview(geometry, lock, source.manifest.style).final.rgba.length;
  }),
  () => baseline.frames.map((frame, i) => renderIk(frame, i).material.final.rgba.length),
  13,
));
console.log(JSON.stringify({ w2: before.summary, ik: after.summary }));


export type IkEvidence = { before: typeof before; after: typeof after; durationMs: number; rootTravelPx: number };
