import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { makeCurrentPropSpec } from '../src/generators/props/presets.ts';
import { renderAsset } from '../src/generators/props/render.ts';
import { assessPropPalette } from '../src/quality/prop-palette.ts';
import { inspectPng, validateRaster } from '../src/quality/raster.ts';
import { readSceneFixtures, renderReviewScenes, reviewDesigns, type ReviewDesign } from '../scripts/prop-review-scenes.ts';

const locked = ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'];
const changed = new Set<ReviewDesign>(['travel', 'barrel-wide', 'barrel-tall']);
const frame = { durationMs: 100, loop: false };

test('preserves E2.3 specs and refines only the planned assets without moving silhouette pixels', () => {
  for (const design of reviewDesigns) {
    const prior = renderAsset(JSON.parse(readFileSync('benchmarks/results/e23/' + design + '-spec.json', 'utf8')));
    assert.deepEqual(encodePng(prior.final), readFileSync('benchmarks/results/e23/' + design + '-1x.png'), design);
    const current = renderAsset(makeCurrentPropSpec(design, 42));
    assert.equal(prior.final.rgba.equals(current.final.rgba), !changed.has(design), design);
    assert.deepEqual(prior.silhouette.rgba, current.silhouette.rgba, design);
    assert.deepEqual(validateRaster(current.final, current.spec, frame), []);
    assert.deepEqual(inspectPng(current.final, encodePng(current.final), renderAsset(current.spec).final), []);
  }
});

test('records ramp compression and contrast loss independently of technical validity', () => {
  for (const design of reviewDesigns) {
    const authored = renderAsset(makeCurrentPropSpec(design, 42));
    const restricted = renderAsset(makeCurrentPropSpec(design, 42, locked));
    assert.ok(authored.paletteDiagnostics && restricted.paletteDiagnostics);
    assert.equal(assessPropPalette(authored.paletteDiagnostics).status, 'FULL_RAMP');
    const advice = assessPropPalette(restricted.paletteDiagnostics);
    assert.equal(advice.status, 'PALETTE_LIMITED');
    assert.equal(advice.metrics.woodIronMidtoneGap, 0);
    assert.deepEqual(advice.warnings.map(warning => warning.code), [
      'WOOD_RAMP_COMPRESSED', 'IRON_RAMP_COMPRESSED', 'WOOD_IRON_INK_COLLISION', 'WOOD_IRON_CONTRAST_LOSS',
    ]);
    assert.deepEqual(validateRaster(restricted.final, restricted.spec, frame), []);
    assert.deepEqual(inspectPng(restricted.final, encodePng(restricted.final), renderAsset(restricted.spec).final), []);
  }
});

test('composites existing fixtures at native size with matching pivots in both palettes', async () => {
  const fixtures = await readSceneFixtures();
  const makeSet = (palette?: readonly string[]) => new Map<ReviewDesign, Raster>(
    reviewDesigns.map(design => [design, renderAsset(makeCurrentPropSpec(design, 42, palette)).final]),
  );
  const original = makeSet();
  const scenes = renderReviewScenes(original, fixtures);
  const restricted = renderReviewScenes(makeSet(locked), fixtures);
  assert.deepEqual(scenes.map(scene => scene.id), ['outdoor', 'dungeon', 'neutral']);
  assert.deepEqual(scenes[0].metadata.placements.map(entry => entry.key), ['rpg-traveler', 'compact', 'travel', 'barrel-wide', 'crate']);
  assert.deepEqual(scenes[1].metadata.placements.map(entry => entry.key), ['barrel-tall', 'domed', 'travel', 'crate']);
  assert.deepEqual(scenes[2].metadata.placements.map(entry => entry.key), reviewDesigns);
  for (const [i, { raster, metadata }] of scenes.entries()) {
    assert.deepEqual(metadata, restricted[i].metadata);
    assert.equal(metadata.scale, 1);
    for (const { key, origin, pivot, bounds } of metadata.placements) {
      assert.equal(origin.y + pivot.y, metadata.groundY);
      assert.equal(pivot.y, bounds.bottom + 1);
      assert.equal(pivot.x, 16);
      const source = key === 'rpg-traveler' ? fixtures.get(key)! : original.get(key)!;
      for (let y = 0; y < source.h; y++) {
        for (let x = 0; x < source.w; x++) {
          const ink = source.rgba.readUInt32BE((y * source.w + x) * 4);
          if ((ink & 255) === 0) continue;
          assert.equal(raster.rgba.readUInt32BE(((origin.y + y) * raster.w + origin.x + x) * 4), ink, key);
        }
      }
    }
    const rerender = renderReviewScenes(original, fixtures)[i].raster;
    assert.deepEqual(inspectPng(raster, encodePng(raster), rerender), []);
  }
  const native = original.get('barrel-tall')!;
  const enlarged = nearestNeighbor(native, 4);
  for (let y = 0; y < enlarged.h; y++) {
    for (let x = 0; x < enlarged.w; x++) {
      assert.equal(enlarged.rgba.readUInt32BE((y * enlarged.w + x) * 4),
        native.rgba.readUInt32BE((Math.floor(y / 4) * native.w + Math.floor(x / 4)) * 4));
    }
  }
});
