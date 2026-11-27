import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { makeRaster, put } from '../src/core/pixels/raster.ts';
import { collisionBoxes, normalizedTileMap, scenePlans } from '../src/experiments/runtime-integration.ts';
import type { Spatial } from '../src/experiments/semantic-environment-export.ts';

test('E8 adapter preserves row-major tile identifiers and rejects invalid atlas references', () => {
  const tilemap = {
    version: 1, size: [32, 16], origin: [0, 0], tileSize: 16, sampling: 'nearest',
    columns: 16, ids: [[1, 0]], cells: [{ id: 0, x: 0, y: 0 }, { id: 1, x: 16, y: 0 }],
  };
  assert.deepEqual(normalizedTileMap(tilemap), { size: 16, atlasColumns: 16, cellCount: 2, ids: [1, 0] });
  assert.throws(() => normalizedTileMap({ ...tilemap, ids: [[1, 8]] }), /RUNTIME_TILE_ID/);
  assert.throws(() => normalizedTileMap({ ...tilemap, origin: [16, 0] }), /RUNTIME_TILE_ORIGIN/);
  assert.throws(() => normalizedTileMap({ ...tilemap, cells: [{ id: 0, x: 16, y: 0 }] }), /RUNTIME_ATLAS_CELL/);
});

test('E8 adapter merges solid spans without changing occupied pixels', () => {
  const blocked = makeRaster(7, 4);
  for (const [y, start, end] of [[0, 1, 3], [1, 1, 3], [2, 1, 2], [3, 3, 7]]) {
    for (let x = start; x < end; x++) put(blocked, x, y, 0xffffffff);
  }
  const boxes = collisionBoxes(blocked);
  assert.deepEqual(boxes, [{ x: 1, y: 0, w: 2, h: 2 }, { x: 1, y: 2, w: 1, h: 1 }, { x: 3, y: 3, w: 4, h: 1 }]);
  const replay = makeRaster(7, 4);
  for (const { x, y, w, h } of boxes) for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) put(replay, px, py, 0xffffffff);
  }
  assert.deepEqual(replay, blocked);
});

test('E8 adapter extracts physical blocker witnesses and refuses a water destination', () => {
  const spec: Spatial = JSON.parse(readFileSync('benchmarks/results/e76r/mistfen-ferry-landing/b2/scene-day.json', 'utf8'));
  const plan = scenePlans(spec, { x: spec.anchors.boarding[0], y: spec.anchors.boarding[1] });
  assert.equal(plan.route.length, 187);
  assert.deepEqual(plan.clearance, { x: 9, y: 2 });
  for (const kind of ['water', 'mooring', 'building']) assert.ok(plan.probes.some(p => p.kind === kind));
  assert.throws(() => scenePlans(spec, { x: 310, y: 38 }), /RUNTIME_TARGET_BLOCKED/);
});
