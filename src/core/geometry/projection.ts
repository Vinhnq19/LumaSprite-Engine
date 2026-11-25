import type { Face } from './faces.ts';
import type { Point, Span } from './shapes.ts';

export const riseForDepth = (depth: number) => Math.ceil(depth / 2);

interface BoxProjection {
  left: number;
  top: number;
  width: number;
  depth: number;
  bottom: number;
  taper: number;
}

export function projectBox({ left, top, width, depth, bottom, taper }: BoxProjection) {
  const rise = riseForDepth(depth);
  const right = left + width;
  const front: Face = [[left, top], [right, top], [right - taper, bottom], [left + taper, bottom]];
  const far: Point = [right + depth, top - rise];
  const side: Face = [front[1], far, [right + depth, bottom - rise - taper], front[2]];
  const roof: Face = [[left + depth, top - rise], far, front[1], front[0]];
  return { front, side, top: roof };
}

export function projectProfile(top: Face, profile: readonly Point[]) {
  const [backLeft, , frontRight, frontLeft] = top;
  const width = frontRight[0] - frontLeft[0];
  const left = profile.map(([distance, elevation]): Point => [
    frontLeft[0] + Math.round((backLeft[0] - frontLeft[0]) * distance),
    frontLeft[1] - Math.round((frontLeft[1] - backLeft[1]) * distance) - elevation,
  ]);
  const right = left.map(([x, y]): Point => [x + width, y]);
  const strips = left.slice(1).map((point, i): Face => [point, right[i + 1], right[i], left[i]]);
  const lip: Face = [left[0], right[0], frontRight, frontLeft];
  const side = [frontRight, top[1], ...right.reverse()];
  return { strips, lip, side };
}

function horizontalSpan(center: number, halfWidth: number, y: number): Span {
  return [y, Math.ceil(center - halfWidth - 0.5), Math.floor(center + halfWidth - 0.5)];
}

// Sample at pixel centers so even and odd ellipses have stable mirror symmetry.
export function ellipseSpans(center: Point, width: number, height: number): Span[] {
  const [cx, cy] = center;
  const radius = height / 2;
  const spans: Span[] = [];
  for (let y = Math.ceil(cy - radius - 0.5); y + 0.5 < cy + radius; y++) {
    const v = (y + 0.5 - cy) / radius;
    const span = horizontalSpan(cx, width / 2 * Math.sqrt(Math.max(0, 1 - v * v)), y);
    if (span[1] <= span[2]) spans.push(span);
  }
  return spans;
}

export function projectRoundVolume(cx: number, top: number, bottom: number, endWidth: number, middleWidth: number, depth: number) {
  const cap = ellipseSpans([cx, top], endWidth, depth);
  const foot = ellipseSpans([cx, bottom], endWidth, depth).filter(([y]) => y >= bottom);
  const wall: Span[] = [];
  for (let y = top; y < bottom; y++) {
    const t = (y + 0.5 - top) / (bottom - top);
    const width = endWidth + (middleWidth - endWidth) * t * (1 - t) * 4;
    wall.push(horizontalSpan(cx, width / 2, y));
  }
  return { cap, wall: [...wall, ...foot] };
}
