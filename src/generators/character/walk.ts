import { isDeepStrictEqual } from 'node:util';
import type { Point } from '../../core/geometry/shapes.ts';
import { walkSpecSchema } from '../../specs/animation.ts';
import { inspectMotionTransition, packAnimation, requireAnimationSource, type AnimationFrame, type CharacterPackage } from './animation-export.ts';
import { characterReview } from './export.ts';
import type { GaitPose } from './geometry.ts';
import { characterMaterialReview } from './material-export.ts';
import { makeShapeLock } from './shape-lock.ts';
import { feet, solveWalkPose, type WalkingCharacter } from './walk-pose.ts';

type FootSample = {
  state: 'planted' | 'swing';
  canvas: Point;
  world: Point;
  groundY: number;
  clearance: number;
  solePixels: number;
  ankle: Point;
  knee: Point;
};

export function plantedDisplacement(from: FootSample, to: FootSample, wrapPx: number): Point | null {
  return from.state === 'planted' && to.state === 'planted'
    ? [to.world[0] + wrapPx - from.world[0], to.world[1] - from.world[1]] : null;
}

function renderPose(source: CharacterPackage, spec: WalkingCharacter, gait: GaitPose, id: string, checkpoint: string) {
  let geometry: ReturnType<typeof characterReview>;
  try {
    geometry = characterReview(spec, gait);
  } catch (error) {
    throw new Error(id + ': ' + (error instanceof Error ? error.message : String(error)));
  }
  const lock = makeShapeLock(geometry, checkpoint, id);
  const material = characterMaterialReview(geometry, lock, source.manifest.style);
  if (!isDeepStrictEqual(lock.groundPivot, source.lock.groundPivot) || !isDeepStrictEqual(lock.layerOrder, source.lock.layerOrder) ||
      !isDeepStrictEqual(material.diagnostics.ramps, source.material.diagnostics.ramps)) throw new Error(id + ': walk identity changed.');
  const [x, y] = geometry.spec.pose.near.palm;
  if (!isDeepStrictEqual(lock.gripAnchor, [x + 1, y + 1]) ||
      lock.lockedRegions.gripContact.pixels !== source.lock.lockedRegions.gripContact.pixels ||
      lock.lockedRegions.handleOpening.pixels !== source.lock.lockedRegions.handleOpening.pixels) {
    throw new Error(id + ': held lantern contact changed.');
  }
  return { geometry, lock, material };
}

function footSample(frame: AnimationFrame, side: (typeof feet)[number], rootX: number): FootSample {
  const { geometry, lock } = frame;
  const report = geometry.metadata.diagnostics.pose!.feet[side];
  const state = geometry.plan.gait!.planted[side] ? 'planted' : 'swing';
  const [x] = lock.landmarks[side + '-ground'].point;
  const y = report.projectedGroundY - report.clearance;
  return { state, canvas: [x, y], world: [x + rootX, y], groundY: report.projectedGroundY,
    clearance: report.clearance, solePixels: report.solePixels, ankle: lock.landmarks[side + '-ankle'].point, knee: lock.landmarks[side + '-knee'].point };
}

function buildTransition(source: CharacterPackage, base: WalkingCharacter, first: AnimationFrame, checkpoint: string) {
  const end = first.geometry.spec.pose;
  const start = base.pose;
  const average = (a: Point, b: Point): [number, number] => [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)];
  const nearAnkle = average(start.near.ankle, end.near.ankle);
  const farAnkle = start.far.ankle;
  if (!isDeepStrictEqual(farAnkle, end.far.ankle)) throw new Error('Walk transition needs the same far-foot plant as the idle.');
  const pose = {
    ...start, support: 'far' as const,
    near: { ...start.near, knee: [average(start.near.knee, end.near.knee)[0], start.near.knee[1] - 1] as [number, number],
      ankle: [nearAnkle[0], nearAnkle[1] - 2] as [number, number] },
    far: { ...start.far, elbow: average(start.far.elbow, end.far.elbow), wrist: average(start.far.wrist, end.far.wrist),
      palm: average(start.far.palm, end.far.palm), knee: average(start.far.knee, end.far.knee) },
  };
  const frame = renderPose(source, { ...base, pose }, {
    phase: 'transition', planted: { near: false, far: true }, pushOff: null, ground: source.lock.projectedGround!, lanternSway: 0,
  }, 'walk-transition', checkpoint);
  const planted = source.lock.bodyParts['far-boot'];
  if (!isDeepStrictEqual(frame.lock.bodyParts['far-boot'], planted) || !isDeepStrictEqual(first.lock.bodyParts['far-boot'], planted)) {
    throw new Error('Idle/walk bridge changed the planted far boot.');
  }
  const moves = [inspectMotionTransition(source, frame), inspectMotionTransition(frame, first)];
  // Static ground landmarks track the ankle, while gait tracks the repeatable forefoot point.
  for (const move of moves) {
    const max = Math.max(...Object.entries(move.displacement).filter(([id]) => !id.endsWith('-ground')).flatMap(([, p]) => p).map(Math.abs));
    if (max > 4 || move.flicker.length) throw new Error('Idle/walk bridge exceeds the pose continuity limit.');
  }
  return { frame, qa: { durationMs: 110, support: 'far', stationaryFarAnkle: farAnkle, transitions: moves } };
}

export function buildWalkAnimation(source: CharacterPackage, input: unknown) {
  const spec = walkSpecSchema.parse(input);
  const base = source.geometry.spec;
  requireAnimationSource(source, spec);
  if (base.version !== 2 || base.pose.kind !== 'standing-hold' || !source.lock.projectedGround) {
    throw new Error('Walk requires a revised standing lantern-hold source.');
  }
  const cyclePx = spec.stepPx * 2;
  let rootX = 0;
  const builds = spec.keyPoses.map((key, i) => {
    const { pose, gait } = solveWalkPose(base, source.lock.projectedGround!, key, spec.stepPx / 2, rootX % spec.stepPx);
    const frame = renderPose(source, { ...base, pose }, gait, key.lead + '-' + key.phase, spec.source.checkpoint);
    const { lock, geometry, material } = frame;
    const foot = { near: footSample(frame, 'near', rootX), far: footSample(frame, 'far', rootX) };
    const motion = { index: i, phase: key.phase, lead: key.lead, rootX, advancePx: key.advancePx, feet: foot };
    const { diagnostics } = geometry.metadata;
    const report = {
      ...motion, bodyBob: key.bob, centerX: diagnostics.centerX, hip: lock.landmarks.pelvis.point,
      crown: lock.landmarks.crown.point, nearShoulder: lock.landmarks['near-shoulder'].point,
      farPalm: lock.landmarks['far-palm'].point, grip: lock.gripAnchor, gripPixels: diagnostics.gripPixels,
      openHandleRows: diagnostics.pose!.openHandleRows, lampBodyGap: diagnostics.pose!.lampBodyGap,
      lanternSway: key.sway, alphaPixels: diagnostics.bounds.area, alphaSha256: lock.silhouetteAlphaSha256,
      partMasks: Object.fromEntries(lock.layerOrder.map(id => [id, lock.bodyParts[id].alphaSha256])),
      geometrySha256: lock.source.geometrySha256, rgbaSha256: material.metadata.images.finalRgbaSha256,
      joints: diagnostics.joints, kneeBends: diagnostics.pose!.kneeBends,
    };
    rootX += key.advancePx;
    return { frame, motion, report };
  });
  if (rootX !== cyclePx) throw new Error('Walk root travel differs from the two stride distances.');
  const transitions = builds.map(({ frame, motion }, i) => {
    const j = (i + 1) % builds.length;
    const to = builds[j];
    const wrap = j === 0;
    const wrapPx = wrap ? cyclePx : 0;
    const continuity = inspectMotionTransition(frame, to.frame);
    if (to.motion.rootX + wrapPx - motion.rootX !== motion.advancePx) throw new Error('Root advance skips a frame.');
    const contacts = feet.map(side => {
      const a = motion.feet[side], b = to.motion.feet[side];
      const plantedDelta = plantedDisplacement(a, b, wrapPx);
      if (plantedDelta?.some(Boolean)) throw new Error('Planted ' + side + ' foot slides in world space at ' + i + ' → ' + j + '.');
      return { side, from: a.state, to: b.state, plantedDelta };
    });
    if (continuity.flicker.length) throw new Error('Stable part paint flickers in walk frame ' + i + '.');
    for (const [joint, [dx, dy]] of Object.entries(continuity.displacement)) {
      const lower = joint.endsWith('-ankle') || joint.endsWith('-ground');
      const knee = joint.endsWith('-knee');
      const reaching = joint.startsWith('far-') && /(?:elbow|wrist|palm)$/.test(joint);
      if (Math.abs(dx) > (lower ? 10 : knee || reaching ? 7 : 4) || Math.abs(dy) > (lower ? 7 : knee ? 5 : 4)) {
        throw new Error('Walk joint discontinuity at ' + joint + ' on frame ' + i + ' → ' + j + '.');
      }
    }
    if (Math.abs(to.report.alphaPixels - builds[i].report.alphaPixels) > 140) throw new Error('Walk alpha area changes abruptly.');
    return { from: i, to: j, wrap, contacts, ...continuity };
  });
  const bridge = buildTransition(source, base, builds[0].frame, spec.source.checkpoint);
  const rootMotion = { mode: spec.contact.root, cyclePx, axis: '+x', frames: builds.map(build => build.motion) } as const;
  const qa = {
    version: 2, technical: 'PASS', artistic: 'VISUAL_REVIEW_PENDING', root: spec.pivot,
    layerOrder: source.lock.layerOrder, frames: builds.map(build => build.report), transitions, rootMotion, entryExit: bridge.qa,
  };
  return { ...packAnimation(source, spec, builds.map(build => build.frame), qa, { rootMotion }), bridge: bridge.frame };
}
