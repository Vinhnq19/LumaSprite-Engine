import { encodePng } from '../../core/renderer/png.ts';
import { inspectPng, sha256 } from '../../quality/raster.ts';
import type { characterReview } from './export.ts';
import { renderCharacterMaterials, type MaterialStyle } from './materials.ts';
import { alphaPlane, type ShapeLock } from './shape-lock.ts';

export function characterMaterialReview(
  geometry: ReturnType<typeof characterReview>, lock: ShapeLock, style: MaterialStyle, policy?: unknown,
) {
  const paint = renderCharacterMaterials(geometry, lock, style, policy);
  const repeat = renderCharacterMaterials(geometry, lock, style, policy);
  const final = encodePng(paint.final), mask = encodePng(paint.mask);
  const errors = [...inspectPng(paint.final, final, repeat.final), ...inspectPng(paint.mask, mask, repeat.mask)];
  if (errors.length) throw new Error('Character material integrity failed: ' + errors.join(', '));
  const metadata = {
    version: 1, kind: 'lumasprite-character-material-review', style, light: 'upper-left',
    technical: 'PASS', artistic: 'VISUAL_REVIEW_PENDING',
    source: { candidate: lock.candidate, geometrySha256: lock.source.geometrySha256, silhouetteAlphaSha256: lock.silhouetteAlphaSha256 },
    pose: { intent: lock.poseIntent, pivot: lock.groundPivot, gripAnchor: lock.gripAnchor },
    palette: paint.diagnostics, usedColors: paint.usedColors, materialCoverage: paint.coverage,
    images: { finalPngSha256: sha256(final), finalRgbaSha256: sha256(paint.final.rgba), maskPngSha256: sha256(mask),
      alphaSha256: sha256(alphaPlane(paint.final)), silhouettePngSha256: lock.source.silhouettePngSha256 },
  };
  const files = new Map([
    ['final.png', final], ['silhouette.png', geometry.files.get('silhouette.png')!], ['material-mask.png', mask],
    ['material.json', Buffer.from(JSON.stringify(metadata, null, 2) + '\n')],
  ]);
  return { ...paint, metadata, files };
}
