import { fillPolygon, type Point } from '../geometry/shapes.ts';
import { makeRaster, type Raster } from '../pixels/raster.ts';

export type SurfacePatch<T extends string> = { tone: T; points: readonly Point[] };
export type SurfaceBounds = { left: number; top: number; right: number; bottom: number };

export function paintSurface<T extends string>(
  target: Raster, ownedPixels: readonly number[], bounds: SurfaceBounds, base: number,
  inks: Record<T, number>, patches: readonly SurfacePatch<T>[],
) {
  const { left, top, right, bottom } = bounds;
  const width = right + 1 - left, height = bottom + 1 - top;
  const overlay = makeRaster(width, height);
  for (const { tone, points } of patches) {
    fillPolygon(overlay, points.map(([u, v]) => [u * width, v * height]), inks[tone]);
  }
  for (const pixel of ownedPixels) {
    const x = pixel % target.w - left, y = Math.floor(pixel / target.w) - top;
    const ink = overlay.rgba.readUInt32BE((y * width + x) * 4) || base;
    target.rgba.writeUInt32BE(ink, pixel * 4);
  }
}
