import { fillPolygon, type Point } from './shapes.ts';
import { makeRaster, put, type Raster } from '../pixels/raster.ts';

export type Face = readonly [Point, Point, Point, Point];

export function facePoint([tl, tr, br, bl]: Face, u: number, v: number): Point {
  const interpolate = (axis: 0 | 1) =>
    (tl[axis] + (tr[axis] - tl[axis]) * u) * (1 - v) + (bl[axis] + (br[axis] - bl[axis]) * u) * v;
  return [interpolate(0), interpolate(1)];
}

export function fillFacePatch(raster: Raster, face: Face, ink: number, u0: number, v0: number, u1: number, v1: number) {
  fillPolygon(raster, [facePoint(face, u0, v0), facePoint(face, u1, v0),
    facePoint(face, u1, v1), facePoint(face, u0, v1)], ink);
}

export const rect = (left: number, top: number, right: number, bottom: number): Face =>
  [[left, top], [right, top], [right, bottom], [left, bottom]];

export function outline(mask: Raster, ink: number) {
  const edge = makeRaster(mask.w, mask.h);
  for (let y = 0; y < mask.h; y++) {
    for (let x = 0; x < mask.w; x++) {
      if (!mask.rgba[(y * mask.w + x) * 4 + 3]) continue;
      for (const [dx, dy] of [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]]) {
        put(edge, x + dx, y + dy, ink);
      }
    }
  }
  return edge;
}
