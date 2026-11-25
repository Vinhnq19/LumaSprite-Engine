import { cluster, fillPolygon, outlinedPolygon, type Point, type Span } from '../../core/geometry/shapes.ts';
import { materialRamps } from '../../core/materials/ramps.ts';
import { composite, makeRaster, silhouette } from '../../core/pixels/raster.ts';
import { parseAssetSpec } from '../../specs/asset.ts';

export function renderAsset(input: unknown) {
  const spec = parseAssetSpec(input);
  const { w, h } = spec.canvas;
  const { contour, wood, iron, brass } = materialRamps(spec);
  const [body, lid, bands, lock] = spec.layers.map(() => makeRaster(w, h));
  const offset = spec.seed % 2;
  const latch = 15 + offset;

  outlinedPolygon(body,
    [[3, 13], [28, 13], [28, 26], [25, 29], [6, 29], [3, 26]],
    [[4, 14], [27, 14], [27, 25], [25, 28], [6, 28], [4, 26]], contour, wood.base);
  fillPolygon(body, [[24, 14], [27, 13], [27, 25], [24, 28], [23, 28], [23, 15]], wood.dark);
  fillPolygon(body, [[4, 23], [9, 24], [23, 24], [27, 22], [27, 25], [25, 28], [6, 28], [4, 26]], wood.dark);
  cluster(body, wood.shadow, [[16, 4, 26], [20, 5, 26], [24, 5, 26], [27, 7, 24]]);
  cluster(body, wood.light, [[17, 5, 10], [18, 11, 14], [21, 5, 9], [22, 10, 14], [25, 10, 14], [25, 18, 21]]);
  cluster(body, wood.dark, [[18, 17, 21], [19, 19, 22], [22, 16, 18], [23, 17, 21]]);

  outlinedPolygon(lid,
    [[2, 14], [3, 10], [6, 6], [10, 4], [22, 4], [27, 7], [29, 12], [29, 15], [26, 17], [5, 17]],
    [[3, 14], [4, 10], [7, 7], [10, 5], [22, 5], [26, 8], [28, 12], [28, 14], [26, 16], [5, 16]], contour, wood.light);
  fillPolygon(lid, [[22, 5], [26, 8], [28, 12], [28, 14], [26, 16], [23, 16], [25, 13], [24, 8]], wood.dark);
  fillPolygon(lid, [[4, 12], [7, 13], [24, 13], [28, 12], [28, 14], [26, 16], [5, 16], [3, 14]], wood.base);
  cluster(lid, wood.glint, [[5, 10, 20], [6, 8, 16], [7, 6, 10], [9, 11, 19], [10, 6, 11], [13, 5, 11]]);
  cluster(lid, wood.base, [[8, 8, 21], [11, 6, 24], [12, 15, 22]]);
  cluster(lid, wood.shadow, [[15, 6, 26]]);

  for (const [x, direction] of [[7 + offset, 1], [22 - offset, -1]]) {
    const px = (delta: number) => x + direction * delta;
    const bandShape: Point[] = [[2, 5], [6, 5], [3, 9], [2, 13], [2, 28], [-2, 28], [-2, 12], [-1, 8]];
    fillPolygon(bands, bandShape.map(([dx, y]) => [px(dx), y]), iron.shadow);
    const strokes = (ink: number, spans: readonly Span[]) => {
      cluster(bands, ink, spans.map(([y, start, end]) => [y, Math.min(px(start), px(end)), Math.max(px(start), px(end))]));
    };
    strokes(iron.base, [[6, 2, 4], [7, 1, 3], [8, 0, 2], [9, 0, 1], [10, -1, 1], [11, -1, 1],
      [12, -1, 1], [13, -1, 0], [14, -1, 0], [15, -1, 0], [17, -1, 0], [18, -1, 0], [19, -1, 0],
      [20, -1, 0], [21, -1, 0], [22, -1, 0], [23, -1, 0], [24, -1, 0], [25, -1, 0]]);
    strokes(iron.light, [[6, 2, 3], [7, 1, 1], [10, -1, -1], [14, -1, -1], [18, -1, -1], [23, -1, -1], [26, -1, -1]]);
  }
  for (let i = 0; i < bands.rgba.length; i += 4) {
    if (body.rgba[i + 3] === 0 && lid.rgba[i + 3] === 0) bands.rgba.writeUInt32BE(0, i);
  }

  outlinedPolygon(lock,
    [[latch - 2, 12], [latch + 3, 12], [latch + 4, 14], [latch + 4, 19], [latch + 2, 21],
      [latch - 1, 21], [latch - 3, 19], [latch - 3, 14]],
    [[latch - 2, 13], [latch + 2, 13], [latch + 3, 14], [latch + 3, 19], [latch + 1, 20],
      [latch - 1, 20], [latch - 2, 19]], contour, brass.base);
  cluster(lock, brass.light, [[13, latch - 2, latch + 1], [14, latch - 2, latch - 1], [15, latch - 2, latch - 2]]);
  cluster(lock, brass.shadow, [[18, latch + 2, latch + 2], [19, latch - 1, latch + 2]]);
  cluster(lock, contour, [[16, latch, latch + 1], [17, latch, latch + 1], [18, latch, latch]]);

  const final = composite([body, lid, bands, lock]);
  const flat = composite([silhouette(body, wood.base), silhouette(lid, wood.light),
    silhouette(bands, iron.base), silhouette(lock, brass.base)]);
  return { spec, final, flat, silhouette: silhouette(final, contour) };
}
