import { facePoint, fillFacePatch, rect, type Face } from '../../core/geometry/faces.ts';
import { fillPolygon, type Point } from '../../core/geometry/shapes.ts';
import { diagnosePalette, ironPlate, woodFace } from '../../core/materials/faces.ts';
import { materialRamps } from '../../core/materials/ramps.ts';
import { makeRaster, put, silhouette } from '../../core/pixels/raster.ts';
import type { AssetSpecV1 } from '../../specs/asset.ts';
import { projectBox, projectProfile } from '../../core/geometry/projection.ts';
import { renderOutlinedLayers } from '../../core/renderer/layers.ts';
import type { PropDesign } from '../../specs/prop-shape.ts';

type ComposedSpec = AssetSpecV1 & { prop: Extract<AssetSpecV1['prop'], { design: PropDesign }> };

export function renderComposedProp(spec: ComposedSpec) {
  const { design, composition, finish } = spec.prop;
  const refined = finish !== undefined;
  const { frontWidth, sideDepth, bodyHeight, lidRise, bandSpacing, lockOffset } = composition;
  const { w, h } = spec.canvas;
  const { seed } = spec;
  const ramps = materialRamps(spec);
  const { contour, wood, iron, brass } = ramps;
  const [body, lid, fittings, latch, flatBody, flatLid, flatBrace] = Array.from({ length: 7 }, () => makeRaster(w, h));

  const baseY = 27;
  const seam = baseY - bodyHeight;
  const left = Math.floor((w - frontWidth - sideDepth) / 2);
  const right = left + frontWidth;
  const center = Math.floor((left + right) / 2);
  const taper = design === 'travel' ? 2 : 0;
  const { front, side, top } = projectBox({ left, top: seam, width: frontWidth, depth: sideDepth, bottom: baseY, taper });

  woodFace(body, side, wood, 'side', seed);
  woodFace(body, front, wood, 'front', seed);
  if (refined && design === 'crate') fillFacePatch(body, side, wood.shadow, 0.62, 0, 1, 1);
  fillFacePatch(body, front, wood.shadow, 0, 1 - 2 / bodyHeight, 1, 1);
  fillFacePatch(body, side, wood.shadow, 0, 1 - 2 / bodyHeight, 1, 1);
  fillPolygon(flatBody, side, wood.dark);
  fillPolygon(flatBody, front, wood.base);
  // Keep a single, readable seam at the corner separating the two planes.
  fillFacePatch(body, side, wood.shadow, 0, 0, 1 / sideDepth, 1);

  const frontRise = design === 'domed' || design === 'travel' ? 2 : lidRise;
  const profile: Point[] = design === 'domed'
    ? refined
      ? [[0, frontRise], [0.25, lidRise - 3], [0.5, lidRise - 1], [0.75, lidRise - 1], [1, lidRise - 3]]
      : [[0, frontRise], [0.25, lidRise - 2], [0.55, lidRise], [0.78, lidRise - 1], [1, lidRise - 3]]
    : design === 'travel' ? [[0, frontRise], [0.4, lidRise], [1, lidRise]] : [[0, lidRise], [1, lidRise]];
  const { strips, lip, side: lidSide } = projectProfile(top, profile);
  fillPolygon(lid, lidSide, wood.dark);
  fillPolygon(flatLid, lidSide, wood.dark);
  for (let i = strips.length - 1; i >= 0; i--) {
    const strip = strips[i];
    const ink = design === 'domed' && i === 0 ? wood.base : i === 1 && !(refined && design === 'domed') ? wood.glint : wood.light;
    fillPolygon(lid, strip, ink);
    fillPolygon(flatLid, strip, wood.light);
    if (strips.length === 1) {
      fillFacePatch(lid, strip, wood.glint, 0.06, 0, 0.8, 0.23);
      fillFacePatch(lid, strip, wood.base, 0.24, 0.56, 0.95, 0.79);
    }
  }
  fillPolygon(lid, lip, wood.light);
  fillPolygon(flatLid, lip, wood.light);
  fillFacePatch(lid, lip, wood.shadow, 0, 1 - 1 / frontRise, 1, 1);
  if (refined && design === 'compact') fillFacePatch(lid, lip, wood.glint, 0.05, 0, 0.95, 1 / frontRise);

  for (const x of [center - bandSpacing, center + bandSpacing]) {
    const u = (x - left) / frontWidth;
    const from = u - 1 / frontWidth;
    const to = u + (design === 'travel' ? 2 : 1) / frontWidth;
    for (const face of [...strips, lip, front]) {
      const bottom = design === 'compact' && face === front ? 0.42 : 1;
      const band: Face = [facePoint(face, from, 0), facePoint(face, to, 0),
        facePoint(face, to, bottom), facePoint(face, from, bottom)];
      ironPlate(fittings, band, iron, face !== front && (face === strips[0] || face === lip));
    }
    if (design === 'travel' || design === 'crate') {
      const [footX] = facePoint(front, u, 1);
      const x0 = Math.floor(footX);
      const foot = rect(x0 - 2, baseY - 3, x0 + 3, baseY + 1);
      ironPlate(fittings, foot, iron, true);
      if (refined && design === 'travel') fillFacePatch(fittings, foot, iron.base, 0, 0.45, 0.66, 1);
      if (finish === 'e24') fillFacePatch(fittings, foot, iron.light, 0, 0.43, 0.36, 0.77);
    }
  }

  if (design === 'travel') {
    fillFacePatch(fittings, side, iron.shadow, 0.04, 0.77, 1, 0.9);
    fillFacePatch(fittings, front, refined ? iron.base : iron.shadow, 0.02, 0.77, 0.98, 0.9);
    if (finish === 'e24') fillFacePatch(fittings, front, iron.light, 0.21, 0.77, 0.64, 0.84);
    const handle: Face = [facePoint(side, 0.14, 0.26), facePoint(side, 0.9, 0.26),
      facePoint(side, 0.9, 0.49), facePoint(side, 0.14, 0.49)];
    ironPlate(fittings, handle, iron, true);
  }
  if (design === 'crate') {
    const brace: Face = [facePoint(front, 0.15, 0.85), facePoint(front, 0.71, 0.12),
      facePoint(front, 0.89, 0.12), facePoint(front, 0.33, 0.85)];
    fillPolygon(latch, brace, wood.dark);
    fillPolygon(flatBrace, brace, wood.dark);
    fillFacePatch(latch, brace, wood.light, 0, 0, refined ? 0.44 : 0.6, 1);
  } else {
    const x = center + lockOffset;
    fillPolygon(latch, [[x - 2, seam - 2], [x + 3, seam - 2], [x + 3, seam + 2],
      [x + 1, seam + 4], [x, seam + 4], [x - 2, seam + 2]], brass.shadow);
    fillPolygon(latch, rect(x - 1, seam - 1, x + 2, seam + 2), brass.base);
    put(latch, x - 1, seam - 1, brass.light);
    if (refined && design === 'compact') put(latch, x, seam - 1, brass.light);
    put(latch, x, seam + 1, contour);
  }

  const layers = [body, lid, fittings, latch];
  const flatFocal = design === 'crate' ? flatBrace : silhouette(latch, brass.base);
  const flatLayers = [flatBody, flatLid, silhouette(fittings, iron.base), flatFocal];
  return { spec, ...renderOutlinedLayers(layers, flatLayers, contour), paletteDiagnostics: diagnosePalette(ramps) };
}
