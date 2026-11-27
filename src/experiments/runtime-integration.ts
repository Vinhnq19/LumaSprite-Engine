import assert from 'node:assert/strict';
import { fillPolygon, type Point } from '../core/geometry/shapes.ts';
import { pack } from '../core/palette/colors.ts';
import { makeRaster, type Raster } from '../core/pixels/raster.ts';
import { maskRows, validateSpatial, type Spatial } from './semantic-environment-export.ts';

export type Pixel = { x: number; y: number };
export const pixel = ([x, y]: Point): Pixel => ({ x, y });
type Box = Pixel & { w: number; h: number };
const steps: Point[] = [[1, 0], [0, -1], [0, 1], [-1, 0]];
const alpha = (r: Raster, x: number, y: number) => x >= 0 && x < r.w && y >= 0 && y < r.h && r.rgba[(y * r.w + x) * 4 + 3] === 255;

export function collisionBoxes(mask: Raster): Box[] {
  const boxes: Box[] = [];
  let previous = new Map<string, Box>();
  for (const [y, spans] of maskRows(mask).entries()) {
    const current = new Map<string, Box>();
    for (const [x, end] of spans) {
      const key = x + ',' + end;
      const row = previous.get(key) ?? { x, y, w: end - x, h: 0 };
      if (!row.h) boxes.push(row);
      row.h++;
      current.set(key, row);
    }
    previous = current;
  }
  return boxes;
}

export function scenePlans(data: Spatial, target: Pixel) {
  const { masks } = validateSpatial(data);
  const [w, h] = data.size, halfX = data.connection.projectedBodyHalfWidth, halfY = data.connection.footprintHalfHeight;
  const fits = (x: number, y: number, half = halfX) => {
    for (let dy = -halfY; dy <= halfY; dy++) for (let dx = -half; dx <= half; dx++) {
      if (!alpha(masks.walkable, x + dx, y + dy)) return false;
    }
    return true;
  };
  const [sx, sy] = data.anchors.spawn.surveyor;
  const origin = sy * w + sx, destination = target.y * w + target.x;
  const seen = new Int32Array(w * h).fill(-1);
  seen[origin] = origin;
  const reachable = [origin];
  for (const i of reachable) {
    const x = i % w, y = Math.floor(i / w);
    for (const [dx, dy] of steps) {
      const u = x + dx, v = y + dy, j = v * w + u;
      if (seen[j] === -1 && fits(u, v)) {
        seen[j] = i;
        reachable.push(j);
      }
    }
  }
  const route: Pixel[] = [];
  assert.ok(seen[destination] >= 0, 'RUNTIME_TARGET_BLOCKED');
  for (let i = destination; ; i = seen[i]) {
    route.push({ x: i % w, y: Math.floor(i / w) });
    if (i === origin) break;
  }
  route.reverse();
  const blockerMasks = data.colliders.map(c => {
    const mask = makeRaster(w, h);
    fillPolygon(mask, c.points, pack('#ffffff'));
    const name = c.id.startsWith('mooring') ? 'mooring' : c.kind === 'architecture' ?
      ((c.id.startsWith('front-') || c.id === 'back-wall' || c.id.endsWith('-side')) ? 'building' : 'stone') : 'prop';
    return { name, id: c.id, test: (x: number, y: number) => alpha(mask, x, y) };
  });
  const blockers = [...blockerMasks, { name: 'water', id: 'open-water',
    test: (x: number, y: number) => alpha(masks.water, x, y) && !alpha(masks.deck, x, y) }];
  const probes = [];
  const checked = new Set<string>();
  for (const i of reachable) {
    const x = i % w, y = Math.floor(i / w);
    for (const [dx, dy] of steps) {
      const u = x + dx, v = y + dy;
      if (u < halfX || u >= w - halfX || v < halfY || v >= h - halfY || fits(u, v)) continue;
      const hit = blockers.filter(blocker => {
        for (let yy = v - halfY; yy <= v + halfY; yy++) for (let xx = u - halfX; xx <= u + halfX; xx++) {
          if (blocker.test(xx, yy)) return true;
        }
        return false;
      });
      if (hit.length !== 1 || checked.has(hit[0].name)) continue;
      const { name, id } = hit[0];
      checked.add(name);
      probes.push({ kind: name, collider: id, from: { x, y }, to: { x: u, y: v } });
    }
  }
  assert.ok(checked.has('water') && checked.has('mooring'), 'RUNTIME_COLLISION_PROBES_INCOMPLETE');
  return { route, probes, fits, collision: collisionBoxes(masks.collision),
    walkable: data.masks.walkable.map(row => ({ spans: row.flat() })), clearance: { x: halfX, y: halfY } };
}

export function normalizedTileMap(data: { version: number; size: number[]; origin: number[]; tileSize: number;
  columns: number; ids: number[][]; cells: { id: number; x: number; y: number }[]; sampling: string }) {
  const [width, height] = data.size, size = data.tileSize;
  assert.ok(Number.isInteger(size) && size === 16 && data.version === 1 && data.sampling === 'nearest', 'RUNTIME_TILE_FORMAT');
  assert.deepEqual(data.origin, [0, 0], 'RUNTIME_TILE_ORIGIN');
  assert.equal(height, data.ids.length * size, 'RUNTIME_TILE_HEIGHT');
  for (const [i, cell] of data.cells.entries()) assert.deepEqual([cell.id, cell.x, cell.y],
    [i, i % data.columns * size, Math.floor(i / data.columns) * size], 'RUNTIME_ATLAS_CELL');
  for (const row of data.ids) {
    assert.equal(row.length * size, width, 'RUNTIME_TILE_WIDTH');
    for (const id of row) assert.ok(Number.isInteger(id) && Object.hasOwn(data.cells, id), 'RUNTIME_TILE_ID');
  }
  return { size, atlasColumns: data.columns, cellCount: data.cells.length, ids: data.ids.flat() };
}
