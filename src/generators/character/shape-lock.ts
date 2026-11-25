import { isDeepStrictEqual } from 'node:util';
import type { Raster } from '../../core/pixels/raster.ts';
import { sha256 } from '../../quality/raster.ts';
import type { characterReview } from './export.ts';

type Review = ReturnType<typeof characterReview>;
export function alphaPlane(raster: Raster) {
  const alpha = Buffer.alloc(raster.w * raster.h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = raster.rgba[i * 4 + 3];
  return alpha;
}

export function makeShapeLock(review: Review, checkpoint: string, candidate: string) {
  const { spec, silhouette, plan, layers, metadata } = review;
  const { w, h } = silhouette;
  const outline = alphaPlane(silhouette);
  const masks = Object.fromEntries(plan.parts.map(({ id }) => [id, alphaPlane(layers[id])]));
  const [gx, gy] = plan.landmarks['grip-anchor'].point;
  const hip = plan.landmarks.pelvis.point;
  const kneeY = Math.max(spec.pose.near.knee[1], spec.pose.far.knee[1]);
  const mask = (select: (x: number, y: number, i: number) => boolean) =>
    Buffer.from(Array.from({ length: w * h }, (_, i) => select(i % w, Math.floor(i / w), i) ? 255 : 0));
  const regionRef = (plane: Buffer) => ({ alphaSha256: sha256(plane), pixels: plane.reduce((count, a) => count + Number(a === 255), 0) });
  return {
    version: 1, kind: 'lumasprite-character-shape-lock', candidate, checkpoint, characterSpecVersion: spec.version,
    canvas: { w, h }, poseIntent: spec.pose.kind,
    source: {
      geometrySha256: sha256(review.files.get('geometry.json')!),
      specSha256: sha256(JSON.stringify(spec)),
      flatPngSha256: metadata.images.flatPngSha256,
      silhouettePngSha256: metadata.images.silhouettePngSha256,
      flatRgbaSha256: sha256(review.flat.rgba),
    },
    silhouetteAlphaSha256: sha256(outline),
    landmarks: structuredClone(plan.landmarks),
    links: structuredClone(plan.links),
    gripAnchor: [...plan.landmarks['grip-anchor'].point],
    groundPivot: [...plan.pivot],
    projectedGround: structuredClone(plan.projectedGround ?? null),
    layerOrder: plan.parts.map(({ id }) => id),
    bodyParts: Object.fromEntries(plan.parts.map(({ id, shapes }) => [id, {
      geometrySha256: sha256(JSON.stringify(shapes)), sourceRgbaSha256: sha256(layers[id].rgba), ...regionRef(masks[id]),
    }])),
    lockedRegions: {
      format: 'uint8-alpha-row-major',
      silhouette: regionRef(outline),
      lowerLegClearance: regionRef(mask((x, y, i) => y >= kneeY && y < plan.pivot[1] && Math.abs(x - hip[0]) < spec.proportions.hips / 2 && !outline[i])),
      gripContact: regionRef(mask((_x, _y, i) => !!masks['near-hand'][i] && !!masks.lantern[i])),
      handleOpening: regionRef(mask((x, y, i) => Math.abs(x - gx) <= 1 && y >= gy + 2 && y < gy + 5 && !outline[i])),
      bootSoles: regionRef(mask((_x, y, i) => (['near', 'far'] as const).some(side =>
        y === (plan.projectedGround?.[side] ?? plan.pivot[1]) - 2 && !!masks[side + '-boot'][i]))),
    },
  };
}

export type ShapeLock = ReturnType<typeof makeShapeLock>;

export function requireShapeLock(review: Review, lock: ShapeLock) {
  if (!isDeepStrictEqual(makeShapeLock(review, lock.checkpoint, lock.candidate), lock)) {
    throw new Error('Character shape lock mismatch. Use the approved spec and geometry checkpoint.');
  }
}
