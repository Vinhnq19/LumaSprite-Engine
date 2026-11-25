import { pack } from '../src/core/palette/colors.ts';
import type { Point } from '../src/core/geometry/shapes.ts';
import { makeRaster, nearestNeighbor, put, type Raster } from '../src/core/pixels/raster.ts';
import type { characterReview } from '../src/generators/character/export.ts';

export function outlineMarks({ flat, plan }: ReturnType<typeof characterReview>) {
  const raster = nearestNeighbor(flat, 4);
  const dot = ([x, y]: Point, ink: number) => put(raster, x, y, ink);
  const zoom = ([x, y]: Point): Point => [x * 4 + 2, y * 4 + 2];
  const drawLine = (a: Point, b: Point, ink: number) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let i = 0; i <= steps; i++) dot([a[0] + Math.round(dx * i / steps), a[1] + Math.round(dy * i / steps)], ink);
  };
  for (const { from, to } of plan.links) {
    const ink = pack(to.startsWith('far-') ? '#d6a5ed' : '#8ee5dd');
    drawLine(zoom(plan.landmarks[from].point), zoom(plan.landmarks[to].point), ink);
  }
  for (const [id, { point }] of Object.entries(plan.landmarks)) {
    const [x, y] = zoom(point);
    const ink = pack(id === 'grip-anchor' ? '#ffe294' : id.startsWith('far-') ? '#d6a5ed' : '#a6fff2');
    drawLine([x - 2, y], [x + 2, y], ink);
    drawLine([x, y - 2], [x, y + 2], ink);
  }
  const [x, y] = plan.pivot;
  drawLine([Math.max(0, x * 4 - 24), y * 4], [x * 4 + 28, y * 4], pack('#ffe294'));
  drawLine([x * 4, y * 4 - 3], [x * 4, y * 4 + 3], pack('#ffe294'));
  if (plan.projectedGround) {
    const secondary = plan.support === 'near' ? 'far' : 'near';
    const [footX] = plan.landmarks[secondary + '-ground'].point;
    const floorY = plan.projectedGround[secondary] * 4;
    drawLine([footX * 4 - 13, floorY], [footX * 4 + 24, floorY], pack('#d6a5ed'));
  }
  return raster;
}

export function crop(source: Raster, left: number, top: number, right: number, bottom: number, scale = 6) {
  const raster = makeRaster(right - left, bottom - top);
  for (let y = 0; y < raster.h; y++) {
    source.rgba.copy(raster.rgba, y * raster.w * 4, ((top + y) * source.w + left) * 4, ((top + y) * source.w + right) * 4);
  }
  return nearestNeighbor(raster, scale);
}
