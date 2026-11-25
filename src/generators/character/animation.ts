import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { Point } from '../../core/geometry/shapes.ts';
import { animationSpecSchema } from '../../specs/animation.ts';
import { characterReview } from './export.ts';
import { characterMaterialReview } from './material-export.ts';
import { verifyCharacterProductionPackage } from './production.ts';
import { makeShapeLock } from './shape-lock.ts';
import { buildWalkAnimation } from './walk.ts';
import { inspectMotionTransition, packAnimation, requireAnimationSource, type CharacterPackage } from './animation-export.ts';

export { inspectMotionTransition as inspectIdleTransition, unpackAnimationStrip } from './animation-export.ts';

const add = (p: Point, offset: Point): Point => [p[0] + offset[0], p[1] + offset[1]];

export function buildIdleAnimation(source: CharacterPackage, input: unknown) {
  const spec = animationSpecSchema.parse(input);
  const base = source.geometry.spec;
  const original = source.lock;
  if (base.version === 1 || base.pose.kind === 'forward-step-hold') throw new Error('Idle requires a revised standing character source.');
  requireAnimationSource(source, spec);
  const frames = spec.keyPoses.map(({ phase, body, joints }) => {
    const geometry = characterReview({
      ...base,
      proportions: { ...base.proportions, jacket: [
        base.proportions.jacket[0] + body.jacketWidth, base.proportions.jacket[1] + body.jacketHeight,
      ] },
      pose: { ...base.pose,
        near: { ...base.pose.near, elbow: add(base.pose.near.elbow, joints.nearElbow) },
        far: { ...base.pose.far, elbow: add(base.pose.far.elbow, joints.farElbow) },
      },
    });
    const lock = makeShapeLock(geometry, spec.source.checkpoint, 'idle-' + phase);
    const same = (part: string) => isDeepStrictEqual(lock.bodyParts[part], original.bodyParts[part]);
    const assert = (condition: boolean, requirement: string) => {
      if (!condition) throw new Error(phase + ': ' + requirement);
    };
    assert(isDeepStrictEqual(lock.groundPivot, original.groundPivot) && isDeepStrictEqual(lock.layerOrder, original.layerOrder), 'Pivot or layer order changed.');
    assert(isDeepStrictEqual(lock.projectedGround, original.projectedGround) && same('near-boot') && same('far-boot') &&
      isDeepStrictEqual(lock.lockedRegions.bootSoles, original.lockedRegions.bootSoles), 'Planted feet changed.');
    if (original.gripAnchor) {
      assert(isDeepStrictEqual(lock.gripAnchor, original.gripAnchor) && same('lantern') && same('near-hand') &&
        isDeepStrictEqual(lock.lockedRegions.gripContact, original.lockedRegions.gripContact) &&
        isDeepStrictEqual(lock.lockedRegions.handleOpening, original.lockedRegions.handleOpening), 'Held equipment or grip contact changed.');
    }
    const material = characterMaterialReview(geometry, lock, source.manifest.style);
    assert(isDeepStrictEqual(material.diagnostics.ramps, source.material.diagnostics.ramps), 'Material ramps changed.');
    if (phase === 'neutral' || phase === 'return') assert(material.final.rgba.equals(source.material.final.rgba), 'Neutral frame differs from the source.');
    return { geometry, lock, material };
  });

  if (new Set(frames.map(frame => frame.lock.silhouetteAlphaSha256)).size < 2) throw new Error('Idle has no structural motion.');
  const transitions = frames.map((from, i) => {
    const ending = (i + 1) % frames.length;
    const result = inspectMotionTransition(from, frames[ending]);
    if (result.maxJointStepPx > spec.contact.jointStepPx || result.flicker.length) {
      throw new Error('Animation continuity or stable-part material flicker at frame ' + (i + 1) + ' → ' + (ending + 1) + '.');
    }
    return { from: spec.keyPoses[i].phase, to: spec.keyPoses[ending].phase, wrap: ending === 0, ...result };
  });
  const qa = {
    version: 1, technical: 'PASS', artistic: 'VISUAL_REVIEW_PENDING', root: spec.pivot, layerOrder: original.layerOrder,
    frames: frames.map(({ geometry, lock, material }, i) => ({
      phase: spec.keyPoses[i].phase, alphaSha256: lock.silhouetteAlphaSha256, geometrySha256: lock.source.geometrySha256,
      rgbaSha256: material.metadata.images.finalRgbaSha256, alphaPixels: lock.lockedRegions.silhouette.pixels,
      partMasks: Object.fromEntries(lock.layerOrder.map(id => [id, lock.bodyParts[id].alphaSha256])),
      feet: geometry.metadata.diagnostics.pose!.feet, grip: lock.gripAnchor,
      gripPixels: geometry.metadata.diagnostics.gripPixels, lampGapRows: geometry.metadata.diagnostics.lampGapRows,
      openHandleRows: geometry.metadata.diagnostics.pose!.openHandleRows, armTorsoGapRows: geometry.metadata.diagnostics.pose!.armTorsoGapRows,
      headroom: geometry.metadata.diagnostics.pose!.headroom, joints: geometry.metadata.diagnostics.joints,
    })),
    transitions,
  };
  return packAnimation(source, spec, frames, qa, {});
}

export function buildAnimation(source: CharacterPackage, input: unknown) {
  return input && typeof input === 'object' && 'version' in input && input.version === 2
    ? buildWalkAnimation(source, input) : buildIdleAnimation(source, input);
}

export async function verifyAnimationPackage(directory: string, characterDirectory: string) {
  const [source, bytes] = await Promise.all([
    verifyCharacterProductionPackage(characterDirectory), readFile(join(directory, 'animation-spec.json')),
  ]);
  const rebuilt = buildAnimation(source, JSON.parse(bytes.toString('utf8')));
  if ((await readdir(directory)).length !== rebuilt.files.size) throw new Error('Unexpected animation package files.');
  for (const [file, expected] of rebuilt.files) {
    if (!expected.equals(await readFile(join(directory, file)))) throw new Error('Animation package differs at ' + file);
  }
  return rebuilt;
}
