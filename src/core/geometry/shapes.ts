import { put, type Raster } from '../pixels/raster.ts';

export type Point = readonly [x: number, y: number];
export type Span = readonly [y: number, fromX: number, toX: number];

export function cluster(raster: Raster, ink: number, spans: readonly Span[]) {
  for (const [y, fromX, toX] of spans) {
    for (let x = fromX; x <= toX; x++) put(raster, x, y, ink);
  }
}

export function fillPolygon(raster: Raster, vertices: readonly Point[], ink: number) {
  const top = Math.min(...vertices.map(([, y]) => y));
  const bottom = Math.max(...vertices.map(([, y]) => y));
  for (let y = top; y < bottom; y++) {
    const sampleY = y + 0.5;
    const crossings: number[] = [];
    for (const [i, [x1, y1]] of vertices.entries()) {
      const [x2, y2] = vertices[(i + 1) % vertices.length];
      if ((y1 > sampleY) !== (y2 > sampleY)) {
        crossings.push(x1 + (sampleY - y1) * (x2 - x1) / (y2 - y1));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i < crossings.length; i += 2) {
      cluster(raster, ink, [[y, Math.ceil(crossings[i] - 0.5), Math.ceil(crossings[i + 1] - 0.5) - 1]]);
    }
  }
}

export function outlinedPolygon(raster: Raster, contour: readonly Point[], face: readonly Point[], edge: number, fill: number) {
  fillPolygon(raster, contour, edge);
  fillPolygon(raster, face, fill);
}
