import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fillPolygon } from '../src/core/geometry/shapes.ts';
import { makeRaster, nearestNeighbor, put } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { renderAsset } from '../src/generators/props/supply-chest.ts';
import { mockPlanner, supplyChestBrief } from '../src/providers/mock/planner.ts';
import { inspectPng, validateRaster } from '../src/quality/raster.ts';

const spec = await mockPlanner.plan({ brief: supplyChestBrief, seed: 42 });
const frame = { durationMs: 100, loop: false };

test('validates unknown assets before rendering and rejects unsupported local briefs', async () => {
  assert.throws(() => renderAsset({ ...spec, canvas: { w: 31, h: 32 } }), /canvas.w/);
  assert.throws(() => renderAsset({ ...spec, seed: -1 }), /seed/);
  assert.throws(() => renderAsset({ ...spec, run: 'process.exit()' }), /run/);
  assert.throws(() => renderAsset({ ...spec, palette: ['#ffffff', '#FFFFFF'] }), /palette/);
  assert.throws(() => renderAsset({ ...spec, layers: [...spec.layers].reverse() }), /layers/);
  await assert.rejects(mockPlanner.plan({ brief: 'snow cliff tiles', seed: 42 }), /supply chest/);
});

test('fills integer pixel centers and refuses drawing out of bounds', () => {
  const raster = makeRaster(2, 2);
  fillPolygon(raster, [[0, 0], [2, 0], [2, 2], [0, 2]], 0x123456ff);
  assert.equal(raster.rgba.toString('hex'), '123456ff'.repeat(4));
  assert.throws(() => put(raster, 2, 0, 0), /outside layer/);
  assert.throws(() => put(raster, 0, 0.5, 0), /outside layer/);
});

test('renders the same bytes per seed and preserves the silhouette in each preview', () => {
  const { final, flat, silhouette } = renderAsset(spec);
  const rerender = renderAsset(spec).final;
  assert.deepEqual(final, rerender);
  assert.notDeepEqual(final, renderAsset({ ...spec, seed: 43 }).final);
  assert.deepEqual(validateRaster(final, spec, frame), []);
  const png = encodePng(final);
  assert.deepEqual(inspectPng(final, png, rerender), []);
  assert.deepEqual(decodePng(png), final);
  const scale = nearestNeighbor(final, 4);
  assert.equal(scale.w, 128);
  assert.equal(scale.h, 128);
  assert.equal(final.rgba.readUInt32BE(0), 0);
  for (let i = 3; i < final.rgba.length; i += 4) {
    assert.equal(flat.rgba[i], final.rgba[i]);
    assert.equal(silhouette.rgba[i], final.rgba[i]);
  }
  for (let y = 0; y < scale.h; y++) {
    for (let x = 0; x < scale.w; x++) {
      const i = 4 * (Math.floor(y / 4) * final.w + Math.floor(x / 4));
      assert.equal(scale.rgba.readUInt32BE(4 * (y * scale.w + x)), final.rgba.readUInt32BE(i));
    }
  }
});

test('reports malformed pixels, metadata, protection and integrity independently', () => {
  const { final } = renderAsset(spec);
  const bad = { ...final, rgba: Buffer.from(final.rgba) };
  bad.rgba.writeUInt32BE(0x00000100, 0);
  bad.rgba.writeUInt32BE(0xeeeeee80, 4);
  const errors = validateRaster(bad, spec, { ...frame, durationMs: 0 }, {
    rgba: final.rgba, editable: Buffer.alloc(final.w * final.h),
  });
  assert.deepEqual(new Set(errors), new Set(['FRAME', 'TRANSPARENT_RGB', 'ALPHA', 'PALETTE', 'PROTECTED_PIXELS']));
  assert.deepEqual(validateRaster({ ...bad, w: 30 }, spec, frame), ['CANVAS']);
  assert.deepEqual(validateRaster(makeRaster(32, 32), spec, frame), ['EMPTY']);
  assert.deepEqual(inspectPng(final, Buffer.from('corrupt'), bad), ['PNG_INTEGRITY', 'DETERMINISM']);
});
