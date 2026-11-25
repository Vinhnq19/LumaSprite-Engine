import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { encodePng } from '../src/core/renderer/png.ts';
import { makePropSpec } from '../src/generators/props/presets.ts';
import { renderAsset } from '../src/generators/props/render.ts';
import { inspectPng, sha256, validateRaster } from '../src/quality/raster.ts';
import { propDesigns } from '../src/specs/prop-shape.ts';

const locked = ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'];
const sample = 'benchmarks/results/sample/';
const frame = { durationMs: 100, loop: false };

test('preserves the baseline review PNGs and reproduces saved E1 specs', () => {
  const records = readFileSync('benchmarks/briefs/e0-e1-png-sha256.txt', 'utf8').trim().split(/\r?\n/);
  for (const entry of records) {
    const [file, digest] = entry.split(' ');
    assert.equal(sha256(readFileSync(sample + file)), digest, file);
  }
  for (const seed of [42, 43]) {
    const raw: unknown = JSON.parse(readFileSync(sample + 'chest-' + seed + '.json', 'utf8'));
    assert.deepEqual(encodePng(renderAsset(raw).final), readFileSync(sample + 'chest-' + seed + '-final-1x.png'));
  }
});

test('presets produce four deterministic closed silhouettes and exact PNGs in both palettes', () => {
  for (const palette of [undefined, locked]) {
    const seen = new Set<string>();
    for (const design of propDesigns) {
      const { spec, final, flat, silhouette } = renderAsset(makePropSpec(design, 42, palette));
      assert.deepEqual(validateRaster(final, spec, frame), [], design);
      assert.deepEqual(inspectPng(final, encodePng(final), renderAsset(spec).final), []);

      const pixels = new Set<number>();
      for (let i = 0; i < final.w * final.h; i++) {
        const a = i * 4 + 3;
        assert.equal(flat.rgba[a], final.rgba[a], design);
        assert.equal(silhouette.rgba[a], final.rgba[a], design);
        if (final.rgba[a]) pixels.add(i);
      }
      assert.ok(pixels.size > 200);
      const hash = sha256(silhouette.rgba);
      assert.ok(!seen.has(hash), design);
      seen.add(hash);
      const queue = [[...pixels][0]];
      for (const i of queue) {
        for (const next of [i - 1, i + 1, i - final.w, i + final.w]) {
          if (pixels.delete(next)) queue.push(next);
        }
      }
      assert.equal(pixels.size, 0, design + ' has a disconnected silhouette.');
    }
  }
});

test('shape constraints reject collisions, shallow sides and out-of-bounds dimensions', () => {
  const spec = makePropSpec('domed', 42);
  const { prop } = spec;
  assert.ok('composition' in prop);
  for (const composition of [
    { lockOffset: 2, bandSpacing: 5 },
    { sideDepth: 2 },
    { frontWidth: 24, sideDepth: 8 },
    { bodyHeight: 13, lidRise: 8 },
    { lidRise: 3 },
  ]) {
    assert.throws(() => renderAsset({ ...spec, prop: { ...prop, composition: { ...prop.composition, ...composition } } }), /prop/);
  }
});

test('locked palette emits diagnostics without introducing colors', () => {
  const asset = renderAsset(makePropSpec('domed', 42, locked));
  assert.ok('paletteDiagnostics' in asset);
  assert.deepEqual(asset.paletteDiagnostics.codes, ['WOOD_RAMP_COMPRESSED', 'IRON_RAMP_COMPRESSED', 'WOOD_IRON_INK_COLLISION']);
  assert.ok(asset.paletteDiagnostics.wood.every(ink => locked.includes(ink)));
  assert.ok(asset.paletteDiagnostics.iron.every(ink => locked.includes(ink)));
  assert.deepEqual(validateRaster(asset.final, asset.spec, frame), []);
});
