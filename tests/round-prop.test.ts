import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ellipseSpans, projectBox, projectProfile, projectRoundVolume } from '../src/core/geometry/projection.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { makeBarrelSpec, makePropSpec } from '../src/generators/props/presets.ts';
import { renderAsset } from '../src/generators/props/render.ts';
import { inspectPng, sha256, validateRaster } from '../src/quality/raster.ts';
import { barrelDesigns } from '../src/specs/barrel-shape.ts';
import { propDesigns } from '../src/specs/prop-shape.ts';

const frame = { durationMs: 100, loop: false };
const locked = ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'];

test('projects centered ellipse spans and a round wall that widens and tapers', () => {
  const spans = ellipseSpans([16, 8], 15, 6);
  assert.equal(spans.length, 6);
  for (const [i, [y, left, right]] of spans.entries()) {
    assert.equal(y, 5 + i);
    assert.equal(left + right, 31);
    assert.deepEqual([left, right], spans[5 - i].slice(1));
  }
  const { cap, wall } = projectRoundVolume(16, 9, 24, 15, 23, 6);
  assert.ok(cap.length > 0);
  assert.ok(wall[7][2] - wall[7][1] > wall[0][2] - wall[0][1]);
  assert.ok(wall.at(-1)![2] - wall.at(-1)![1] < wall[7][2] - wall[7][1]);
});

test('box faces and a stepped profile share attachment edges', () => {
  const { front, side, top } = projectBox({ left: 3, top: 16, width: 20, depth: 5, bottom: 27, taper: 2 });
  assert.deepEqual(front, [[3, 16], [23, 16], [21, 27], [5, 27]]);
  assert.deepEqual(side, [[23, 16], [28, 13], [28, 22], [21, 27]]);
  assert.deepEqual(top, [[8, 13], [28, 13], [23, 16], [3, 16]]);
  const { lip, strips } = projectProfile(top, [[0, 2], [0.5, 5], [1, 4]]);
  assert.deepEqual(lip.slice(2), [front[1], front[0]]);
  assert.deepEqual(strips[0][0], [6, 9]);
  assert.deepEqual(strips[0].slice(0, 2), [strips[1][3], strips[1][2]]);
});

test('preserves E2.1/E2.2 pixels while each explicit refinement changes the final', () => {
  for (const design of propDesigns) {
    const old = renderAsset(makePropSpec(design, 42));
    for (const [suffix, image] of [['1x', old.final], ['flat', old.flat], ['silhouette', old.silhouette]] as const) {
      assert.deepEqual(encodePng(image), readFileSync('benchmarks/results/e2/' + design + '-' + suffix + '.png'));
    }
    const lockedOld = renderAsset(makePropSpec(design, 42, locked));
    assert.deepEqual(encodePng(lockedOld.final), readFileSync('benchmarks/results/e2/' + design + '-locked.png'));
    const refined = renderAsset(makePropSpec(design, 42, undefined, 'refined'));
    assert.notEqual(sha256(old.final.rgba), sha256(refined.final.rgba), design);
    assert.deepEqual(validateRaster(refined.final, refined.spec, frame), []);
  }
});

test('both barrel shapes render connected, distinct silhouettes and stay inside the locked palette', () => {
  const chest = renderAsset(makePropSpec('domed', 42));
  const crate = renderAsset(makePropSpec('crate', 42));
  const shapes = new Set([sha256(chest.silhouette.rgba), sha256(crate.silhouette.rgba)]);
  for (const design of barrelDesigns) {
    const asset = renderAsset(makeBarrelSpec(design, 42));
    for (const candidate of [asset, renderAsset(makeBarrelSpec(design, 42, locked))]) {
      const { final, flat, silhouette, spec } = candidate;
      const selected = new Set<number>();
      for (let i = 0; i < final.w * final.h; i++) {
        const a = i * 4 + 3;
        assert.equal(flat.rgba[a], final.rgba[a]);
        assert.equal(silhouette.rgba[a], final.rgba[a]);
        if (final.rgba[a]) selected.add(i);
      }
      const queue = [[...selected][0]];
      for (const i of queue) {
        const x = i % final.w;
        const adjacent = [i - final.w, i + final.w];
        if (x > 0) adjacent.push(i - 1);
        if (x < final.w - 1) adjacent.push(i + 1);
        for (const j of adjacent) if (selected.delete(j)) queue.push(j);
      }
      assert.equal(selected.size, 0);
      assert.ok(queue.length > 220);
      assert.deepEqual(validateRaster(final, spec, frame), []);
      assert.deepEqual(inspectPng(final, encodePng(final), renderAsset(spec).final), []);
    }
    const hash = sha256(asset.silhouette.rgba);
    assert.ok(!shapes.has(hash));
    shapes.add(hash);
    const paletteResult = renderAsset(makeBarrelSpec(design, 42, locked));
    assert.ok('paletteDiagnostics' in paletteResult);
    assert.ok(paletteResult.paletteDiagnostics.codes.includes('WOOD_RAMP_COMPRESSED'));
  }
});

test('barrel constraints enforce wall bulge, contour margin and barrel layer order', () => {
  const spec = makeBarrelSpec('barrel-tall', 42);
  const { prop } = spec;
  assert.equal(prop.design, 'barrel');
  assert.throws(() => renderAsset({ ...spec, layers: ['body', 'lid', 'iron', 'lock'] }), /layers/);
  assert.throws(() => renderAsset({ ...spec, prop: { ...prop, composition: { ...prop.composition, rimWidth: 20 } } }), /rimWidth/);
  assert.throws(() => renderAsset({ ...spec, prop: { ...prop, composition: { ...prop.composition, height: 25 } } }), /height/);
  const margin = renderAsset({ ...spec, prop: { ...prop, composition: { ...prop.composition, height: 25, rimDepth: 5 } } });
  assert.deepEqual(validateRaster(margin.final, margin.spec, frame), []);
});
