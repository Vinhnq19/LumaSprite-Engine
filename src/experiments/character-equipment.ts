import assert from 'node:assert/strict';
import { rect } from '../core/geometry/faces.ts';
import { projectBox } from '../core/geometry/projection.ts';
import type { Point } from '../core/geometry/shapes.ts';
import { materialPiece } from '../generators/environment/kit.ts';
import type { StyleProfile } from '../specs/environment.ts';

type Surface = 'metal' | 'wood';
type Tone = 0 | 1 | 2 | 3;
type Plane = { role: Surface; tone: Tone; points: readonly Point[] };
type Theme = StyleProfile['illumination']['day'];
export type ToolKind = 'toolbox' | 'wrench' | 'hook';

export function planHandTool(kind: ToolKind, anchor: Point, axis: Point) {
  const planes: Plane[] = [];
  const add = (role: Surface, tone: Tone, points: readonly Point[]) => planes.push({ role, tone, points });
  const band = (role: Surface, tone: Tone, x: number, y: number, right: number, bottom: number) =>
    add(role, tone, rect(x, y, right, bottom));
  const [x, y] = anchor;
  if (kind === 'toolbox') {
    const left = x - 7, top = y + 8;
    band('metal', 1, x - 3, y - 1, x + 4, y + 1);
    band('metal', 1, x - 3, y, x - 2, top + 1);
    band('metal', 2, x + 3, y, x + 4, top + 1);
    const box = projectBox({ left, top, width: 11, depth: 3, bottom: top + 7, taper: 1 });
    add('metal', 0, box.side);
    add('metal', 1, box.front);
    add('metal', 2, box.top);
    band('metal', 0, left, top + 3, left + 11, top + 4);
    band('wood', 2, left + 4, top + 2, left + 6, top + 5);
  } else {
    const [dx, dy] = axis, length = Math.hypot(dx, dy);
    assert.ok(length >= 2);
    const place = (points: Point[]) => points.map(([u, v]): Point =>
      [x + .5 + (dx * u - dy * v) / length, y + .5 + (dy * u + dx * v) / length]);
    const profile = (tone: Tone, ...points: Point[]) => add('metal', tone, place(points));
    profile(1, [-4, -1.3], [8, -1.3], [8, 1.3], [-4, 1.3]);
    profile(2, [-3, -.9], [7, -.9], [7, 0], [-3, 0]);
    if (kind === 'wrench') {
      profile(2, [4, -1.5], [7, -3], [11, -2.8], [11, -1.2], [8.8, -1], [8.8, 1],
        [11, 1.2], [11, 3], [7, 3.1], [4, 1.6]);
      profile(3, [6.6, -2.3], [10.6, -2.3], [10.6, -1.6], [7.2, -1.2]);
    } else {
      profile(2, [3, -1.4], [6.5, -3.7], [10, -4.2], [12, -2.6], [12.4, .2], [11.1, 3.6],
        [8.4, 4.1], [9.6, 2.3], [10.4, .1], [9.8, -1.6], [7.3, -1.7], [5.3, .4]);
      profile(3, [6.3, -3.4], [9.8, -3.9], [11.4, -2.6], [9.6, -2.5], [7.1, -2.7]);
    }
  }
  assert.ok(planes.every(plane => plane.points.every(([u, v]) => u >= 1 && v >= 1 && u < 63 && v < 63)), kind + ' exceeds contour margin.');
  return planes;
}

export function paintHandTool(planes: ReturnType<typeof planHandTool>, theme: Theme, anchor: Point, flat: boolean) {
  return materialPiece(theme)(64, 64, anchor, paint => {
    for (const { role, tone, points } of planes) paint(role, flat ? 1 : tone, points);
  });
}
