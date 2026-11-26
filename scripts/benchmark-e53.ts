import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import type { Point } from '../src/core/geometry/shapes.ts';
import { chestColors, pack } from '../src/core/palette/colors.ts';
import { blit, makeRaster, nearestNeighbor, put } from '../src/core/pixels/raster.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { inspectMotionTransition, unpackAnimationStrip, type CharacterPackage } from '../src/generators/character/animation-export.ts';
import { verifyAnimationPackage } from '../src/generators/character/animation.ts';
import { characterReview } from '../src/generators/character/export.ts';
import type { GaitPose } from '../src/generators/character/geometry.ts';
import { characterMaterialReview } from '../src/generators/character/material-export.ts';
import { verifyCharacterProductionPackage } from '../src/generators/character/production.ts';
import { makeShapeLock } from '../src/generators/character/shape-lock.ts';
import { buildWalkAnimation, plantedDisplacement } from '../src/generators/character/walk.ts';
import { feet } from '../src/generators/character/walk-pose.ts';
import { sha256 } from '../src/quality/raster.ts';
import { inspect } from '../research/open-source/art-quality/common.ts';
import { outlineMarks } from './character-preview.ts';
import { characterGameScenes } from './character-scenes.ts';
import { courierSource, json, output, png, readJson, rnd, save, surveyorSource } from './e53-common.ts';
import { archiveE53 } from './e53-archive.ts';

type Walk = ReturnType<typeof buildWalkAnimation>;
type Timing = Walk['timing'];
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const offset = z.number().int().min(-1).max(1);
const refinement = z.strictObject({
  version: z.literal(1), kind: z.literal('lumasprite-walk-refinement'), name: z.literal('W2-Hybrid'),
  base: z.literal('benchmarks/fixtures/e52/w2.json'),
  baseSha256: digest, w2ManifestSha256: digest, ikQaSha256: digest,
  knees: z.array(z.strictObject({ frame: z.number().int().min(0).max(7),
    side: z.enum(feet), offset: z.tuple([offset, offset]) })).min(1).max(4),
}).refine(spec => new Set(spec.knees.map(k => k.frame + '-' + k.side)).size === spec.knees.length, 'Duplicate knee refinement.');
const spec = refinement.parse(readJson('benchmarks/fixtures/e53/w2-hybrid.json'));
assert.equal(sha256(readFileSync(spec.base)), spec.baseSha256);
assert.equal(sha256(readFileSync(join(rnd, 'ik-qa.json'))), spec.ikQaSha256);
assert.equal(sha256(readFileSync('benchmarks/results/e52/w2/package/manifest.json')), spec.w2ManifestSha256);

const [source, courier, idle] = await Promise.all([
  verifyCharacterProductionPackage(surveyorSource), verifyCharacterProductionPackage(courierSource),
  verifyAnimationPackage('benchmarks/results/e51/package', surveyorSource),
]);
const baseline = buildWalkAnimation(source, readJson(spec.base));
for (const [file, bytes] of baseline.files) assert.ok(bytes.equals(readFileSync('benchmarks/results/e52/w2/package/' + file)), file);

const { buildWalkAnimation: buildResearchWalk } = await import(
  pathToFileURL(join(archiveE53(), 'src/generators/character/walk.ts')).href
) as { buildWalkAnimation: (character: CharacterPackage, input: unknown,
  refine: (frame: number, side: (typeof feet)[number], point: Point) => [number, number]) => Walk };

function hybridClip() {
  return buildResearchWalk(source, { ...baseline.spec, name: spec.name }, (frame, side, [x, y]) => {
    const [dx, dy] = spec.knees.find(change => change.frame === frame && change.side === side)?.offset ?? [0, 0];
    return [x + dx, y + dy];
  });
}
const hybrid = hybridClip();
for (const [file, bytes] of hybridClip().files) assert.ok(bytes.equals(hybrid.files.get(file)!), 'Hybrid ' + file);
assert.deepEqual(hybrid.timing.frames.map(x => x.durationMs), baseline.timing.frames.map(x => x.durationMs));
assert.deepEqual(hybrid.timing.rootMotion.frames.map(x => x.rootX), baseline.timing.rootMotion.frames.map(x => x.rootX));
for (const [i, frame] of hybrid.frames.entries()) {
  const original = baseline.frames[i];
  const changes = spec.knees.filter(k => k.frame === i);
  const editable = new Set(changes.flatMap(k => [k.side + '-thigh', k.side + '-shin']));
  for (const id of frame.lock.layerOrder) {
    if (!editable.has(id)) assert.deepEqual(frame.lock.bodyParts[id], original.lock.bodyParts[id], 'Frozen ' + id);
  }
  const { near, far, ...upperPose } = frame.geometry.spec.pose;
  const base = original.geometry.spec.pose;
  const { near: baseNear, far: baseFar, ...baseUpperPose } = base;
  assert.deepEqual(upperPose, baseUpperPose);
  for (const [actual, prev, side] of [[near, baseNear, 'near'], [far, baseFar, 'far']] as const) {
    const shift = changes.find(k => k.side === side)?.offset ?? [0, 0];
    assert.deepEqual(actual, { ...prev, knee: [prev.knee[0] + shift[0], prev.knee[1] + shift[1]] });
  }
  assert.equal(frame.material.final.rgba.equals(original.material.final.rgba), changes.length === 0, 'Refined frame pixels');
  assert.deepEqual(frame.lock.lockedRegions.gripContact, original.lock.lockedRegions.gripContact);
  assert.deepEqual(frame.lock.lockedRegions.handleOpening, original.lock.lockedRegions.handleOpening);
}
const researchFiles = new Map(hybrid.files);
researchFiles.delete('manifest.json');
researchFiles.set('animation-spec.json', readFileSync('benchmarks/fixtures/e53/w2-hybrid.json'));
for (const [file, data] of researchFiles) save('hybrid/package/' + file, data);
json('hybrid/package/manifest.json', {
  ...hybrid.manifest, kind: 'lumasprite-animation-research', reproduction: 'node scripts/benchmark-e53.ts',
  files: Object.fromEntries([...researchFiles].map(([file, data]) => [file, sha256(data)])),
});

const pilot = buildWalkAnimation(courier, readJson('benchmarks/fixtures/e53/courier-walk.json'));
for (const [file, bytes] of pilot.files) save('courier/package/' + file, bytes);
await verifyAnimationPackage(join(output, 'courier/package'), courierSource);
for (const frame of pilot.frames) {
  assert.equal(frame.geometry.spec.version, 3);
  assert.deepEqual(frame.geometry.spec.proportions, courier.geometry.spec.proportions);
  assert.equal(frame.lock.gripAnchor, null);
  assert.ok(frame.lock.bodyParts.satchel.pixels > 0 && frame.lock.bodyParts.strap.pixels > 0);
  const layers = frame.geometry.layers;
  let attachment = 0;
  for (let i = 3; i < layers.satchel.rgba.length; i += 4) if (layers.satchel.rgba[i] && layers.strap.rgba[i]) attachment++;
  assert.ok(attachment >= 3, 'Satchel strap has separated');
}

const research = readJson<{ frames: { pose: unknown; gait: GaitPose }[] }>(join(rnd, 'ik-poses.json'));
const ikTiming = readJson<Timing>(join(rnd, 'w2-ik-timing.json'));
const ikSheet = decodePng(readFileSync(join(rnd, 'w2-ik-strip.png')));
const ikCells = unpackAnimationStrip(ikSheet, ikTiming);
const ikFrames = research.frames.map(({ pose, gait }, i) => {
  const geometry = characterReview({ ...source.geometry.spec, pose }, gait);
  const lock = makeShapeLock(geometry, baseline.spec.source.checkpoint, 'frozen-ik-' + i);
  const material = characterMaterialReview(geometry, lock, source.manifest.style);
  assert.deepEqual(material.final, ikCells[i]);
  return { geometry, lock, material };
});

const clips = [
  { id: 'w2', frames: baseline.frames, timing: baseline.timing, sheet: baseline.sheet, bridge: baseline.bridge },
  { id: 'ik', frames: ikFrames, timing: ikTiming, sheet: ikSheet, bridge: baseline.bridge },
  { id: 'hybrid', frames: hybrid.frames, timing: hybrid.timing, sheet: hybrid.sheet, bridge: hybrid.bridge },
  { id: 'courier', frames: pilot.frames, timing: pilot.timing, sheet: pilot.sheet, bridge: pilot.bridge },
];
const degrees = (h: Point, k: Point, a: Point) => {
  const [ux, uy] = [h[0] - k[0], h[1] - k[1]], [vx, vy] = [a[0] - k[0], a[1] - k[1]];
  const cosine = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
};
const round = (n: number) => Math.round(n * 1000) / 1000;
const measured = clips.map(({ id, frames, timing, sheet, bridge }) => {
  const original: CharacterPackage = id === 'courier' ? courier : source;
  const { rootMotion: root } = timing;
  assert.equal(timing.totalDurationMs, timing.frames.reduce((n, f) => n + f.durationMs, 0));
  const samples = frames.map(({ geometry, lock, material }, i) => {
    const point = (name: string) => lock.landmarks[name].point;
    const legal = [...new Set([chestColors.contour, ...Object.values(material.diagnostics.ramps).flat()])];
    const ras = inspect(material.final, legal);
    assert.equal(ras.rgba, timing.frames[i].rgbaSha256);
    const legs = Object.fromEntries(feet.map(side => {
      const hip = point(side + '-hip'), knee = point(side + '-knee'), ankle = point(side + '-ankle');
      const foot = root.frames[i].feet[side];
      assert.deepEqual(foot.knee, knee);
      assert.deepEqual(foot.ankle, ankle);
      assert.deepEqual(foot.world, [foot.canvas[0] + root.frames[i].rootX, foot.canvas[1]]);
      return [side, { ...foot, hip, angle: round(degrees(hip, knee, ankle)) }];
    }));
    return { phase: root.frames[i].phase, rootX: root.frames[i].rootX, hip: point('pelvis'),
      shoulder: point('near-shoulder'), grip: lock.gripAnchor, gripPixels: geometry.metadata.diagnostics.gripPixels,
      alpha: ras.area, legs, satchelPixels: lock.bodyParts.satchel.pixels,
      partAreas: Object.fromEntries(lock.layerOrder.map(part => [part, lock.bodyParts[part].pixels])) };
  });
  const edges = samples.map((frame, i) => {
    const next = (i + 1) % frames.length;
    const wrap = next === 0;
    assert.equal(root.frames[next].rootX + (wrap ? root.cyclePx : 0) - frame.rootX, root.frames[i].advancePx);
    const continuity = inspectMotionTransition(frames[i], frames[next]);
    assert.equal(continuity.flicker.length, 0);
    return { from: i, to: next, wrap, ...continuity, alphaChange: Math.abs(frame.alpha - samples[next].alpha),
      feet: feet.map(side => {
        const a = frame.legs[side], b = samples[next].legs[side];
        const slide = plantedDisplacement(a, b, wrap ? root.cyclePx : 0);
        if (slide) assert.deepEqual(slide, [0, 0]);
        return { side, slide, kneeDelta: round(Math.abs(a.angle - b.angle)) };
      }) };
  });
  const clipsForTransition = [original, bridge, frames[0]];
  const bridges = clipsForTransition.slice(0, -1).map((frame, i) => {
    const next = clipsForTransition[i + 1];
    assert.deepEqual(frame.lock.bodyParts['far-boot'], next.lock.bodyParts['far-boot']);
    const motion = inspectMotionTransition(frame, next);
    assert.equal(motion.flicker.length, 0);
    assert.ok(Math.max(...Object.entries(motion.displacement).filter(([id]) => !id.endsWith('-ground')).flatMap(([, p]) => p).map(Math.abs)) <= 4);
    return motion;
  });
  const markers = makeRaster(64 * 4 * frames.length, 256);
  for (const [i, frame] of frames.entries()) {
    const image = outlineMarks(frame.geometry);
    for (const side of feet) {
      const { canvas: [x, y], state } = samples[i].legs[side];
      const ink = pack(state === 'planted' ? '#ffbc70' : '#83baff');
      for (let dx = -6; dx <= 6; dx++) put(image, x * 4 + dx, y * 4 - 1, ink);
    }
    blit(markers, image, i * 256, 0);
  }
  png(id + '/strip', sheet);
  png(id + '/strip-4x', nearestNeighbor(sheet, 4));
  png(id + '/marks', markers);
  png(id + '/bridge', bridge.material.final);
  json(id + '/timing.json', { ...timing, image: 'strip.png' });
  const possible = edges.flatMap(edge => edge.feet);
  return { id, samples, edges, bridges, root, totalMs: timing.totalDurationMs,
    kneeMax: Math.max(...possible.map(x => x.kneeDelta)),
    kneeMean: round(possible.reduce((n, x) => n + x.kneeDelta, 0) / possible.length),
    plantedPairs: possible.filter(x => x.slide).length,
    alphaMax: Math.max(...edges.map(edge => edge.alphaChange)), wrapKnees: edges.at(-1)!.feet.map(f => f.kneeDelta) };
});

const { scenes, source: backdropProvenance } = await characterGameScenes();
for (const scene of scenes.filter(s => s.id !== 'gameplay')) png('scenes/' + scene.id, scene.base);
png('scenes/idle-surveyor', idle.sheet);
png('scenes/idle-courier', courier.material.final);
json('scenes/idle-surveyor.json', idle.timing);
json('scenes/idle-courier.json', { ...idle.timing, canvas: { w: 64, h: 64 }, pivot: courier.lock.groundPivot,
  frames: [{ durationMs: idle.timing.totalDurationMs, rect: { x: 0, y: 0, w: 64, h: 64 } }] });
json('walk-qa.json', { checkpoint: 'f9c6f77', spec, backdropProvenance, clips: measured });
console.log(JSON.stringify(measured.map(({ id, totalMs, root, kneeMean, kneeMax, plantedPairs, wrapKnees }) =>
  ({ id, totalMs, root: root.cyclePx, kneeMean, kneeMax, plantedPairs, wrapKnees }))));

export type WalkReview = { spec: typeof spec; clips: typeof measured };
export type WalkTiming = Timing;
