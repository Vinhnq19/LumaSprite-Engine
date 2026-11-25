import { ellipseSpans, projectRoundVolume } from '../../core/geometry/projection.ts';
import { cluster } from '../../core/geometry/shapes.ts';
import { diagnosePalette, woodPlaneTones } from '../../core/materials/faces.ts';
import { materialRamps } from '../../core/materials/ramps.ts';
import { makeRaster, put, silhouette } from '../../core/pixels/raster.ts';
import { renderOutlinedLayers } from '../../core/renderer/layers.ts';
import type { AssetSpecV1 } from '../../specs/asset.ts';

type BarrelSpec = AssetSpecV1 & { prop: Extract<AssetSpecV1['prop'], { design: 'barrel' }> };

export function renderBarrel(spec: BarrelSpec) {
  const { width, rimWidth, height, rimDepth } = spec.prop.composition;
  const { w, h } = spec.canvas;
  const ramps = materialRamps(spec);
  const { contour, wood, iron } = ramps;
  const { base: crown, upper: crownLight, lower: crownGrain } = woodPlaneTones(wood, 'top');
  const { base: front, upper: frontLight, lower: frontShadow } = woodPlaneTones(wood, 'front');
  const { base: side, lower: sideShadow } = woodPlaneTones(wood, 'side');
  const [body, hoops, lid] = spec.layers.map(() => makeRaster(w, h));

  const cx = w / 2;
  const bottom = Math.floor((h + height) / 2);
  const top = bottom - height;
  const { cap, wall } = projectRoundVolume(cx, top, bottom, rimWidth, width, rimDepth);
  const hoopCenters = [top + Math.round(height * 0.26), top + Math.round(height * 0.67)];

  for (const [y, left, right] of wall) {
    let previousStave = -1;
    for (let x = left; x <= right; x++) {
      const u = Math.max(-1, Math.min(1, (x + 0.5 - cx) * 2 / (right - left + 1)));
      const arc = Math.sqrt(Math.max(0, 1 - u * u));
      const stave = Math.floor((Math.asin(u) / Math.PI + 0.5) * 7);
      const darkSide = u > 0.38 || u < -0.83;
      const lit = u >= -0.65 && u < -0.14;
      let ink = darkSide ? side : lit ? frontLight : front;
      if (x !== left && stave !== previousStave) ink = darkSide ? sideShadow : frontShadow;
      if (y >= bottom - 1) ink = darkSide ? sideShadow : frontShadow;
      put(body, x, y, ink);
      previousStave = stave;

      for (const center of hoopCenters) {
        const row = y - center - Math.round(arc * rimDepth * 0.36);
        if (row < 0 || row > 2) continue;
        const face = row === 2 || darkSide ? iron.shadow : iron.base;
        put(hoops, x, y, row === 0 && u > -0.6 && u < -0.16 ? iron.light : face);
      }
    }
  }

  cluster(lid, frontShadow, cap);
  const inner = ellipseSpans([cx, top - 0.5], rimWidth - 3, rimDepth - 2);
  cluster(lid, crown, inner);
  for (const [i, [y, left, right]] of inner.entries()) {
    if (i === 0 && right > left) cluster(lid, crownLight, [[y, left, Math.floor((left + right) / 2)]]);
    if (i === Math.floor(inner.length / 2) && right - left >= 6) {
      const end = right - 2 - spec.seed % 3;
      cluster(lid, crownGrain, [[y, left + 2, end]]);
    }
  }

  const flatLayers = [silhouette(body, front), silhouette(hoops, iron.base), silhouette(lid, crown)];
  const rendered = renderOutlinedLayers([body, hoops, lid], flatLayers, contour);
  return { spec, ...rendered, paletteDiagnostics: diagnosePalette(ramps) };
}
