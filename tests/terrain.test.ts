import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pack } from '../src/core/palette/colors.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { canonicalMask, canonicalMasks, dirtTileId, grassTileId } from '../src/generators/terrain/adjacency.ts';
import { terrainExport } from '../src/generators/terrain/export.ts';
import { renderTerrain, renderTileGrid, tileIdsForMap } from '../src/generators/terrain/render.ts';
import { makeCurrentPropSpec } from '../src/generators/props/presets.ts';
import { renderAsset } from '../src/generators/props/render.ts';
import { assessPropPalette } from '../src/quality/prop-palette.ts';
import { inspectPng, sha256, validateRaster } from '../src/quality/raster.ts';
import { checkTerrainPixels, checkTerrainSeams } from '../src/quality/terrain.ts';
import { defaultTerrainSpec } from '../src/specs/terrain.ts';

test('normalizes all raw masks to Studio cardinal-first coverage and slot IDs', () => {
  assert.equal(canonicalMasks.length, 47);
  assert.equal(grassTileId(0), 1);
  assert.equal(grassTileId(255), 47);
  assert.equal(canonicalMask(16), 0);
  assert.equal(canonicalMask(16 | 1), 1);
  assert.equal(canonicalMask(16 | 3), 19);
  const mapped = new Set<number>();
  for (let raw = 0; raw < 256; raw++) {
    const mask = canonicalMask(raw);
    assert.equal(mask & 15, raw & 15);
    assert.equal(canonicalMask(mask), mask);
    for (const [diagonal, cardinals] of [[16, 3], [32, 6], [64, 12], [128, 9]]) {
      assert.equal(Boolean(mask & diagonal), Boolean(raw & diagonal) && (raw & cardinals) === cardinals);
    }
    mapped.add(grassTileId(raw));
  }
  assert.equal(mapped.size, 47);
  assert.equal(dirtTileId, 48);
});

test('matches every seam and preserves every border when the seed changes', () => {
  for (const edgeInset of [2, 3]) {
    const terrain = renderTerrain({ ...defaultTerrainSpec, edgeInset });
    const variant = renderTerrain({ ...defaultTerrainSpec, edgeInset, seed: 31 });
    assert.deepEqual(checkTerrainSeams(terrain), { horizontal: 4096, vertical: 4096, matchedBorderPixels: 131072 });
    assert.deepEqual(checkTerrainSeams(variant), checkTerrainSeams(terrain));
    assert.notDeepEqual(terrain.atlas.rgba, variant.atlas.rgba);
    for (const [i, tile] of terrain.tiles.entries()) {
      const other = variant.tiles[i];
      assert.equal(tile.mask, other.mask);
      for (let p = 0; p < 16; p++) {
        for (const at of [p, 240 + p, p * 16, p * 16 + 15]) {
          assert.equal(tile.raster.rgba.readUInt32BE(at * 4), other.raster.rgba.readUInt32BE(at * 4));
        }
      }
    }
  }
});

test('terrain atlas PNG and mapping round-trip and locate every native tile', () => {
  const terrain = renderTerrain(defaultTerrainSpec);
  const { png, mapping } = terrainExport(terrain);
  const parsed = JSON.parse(JSON.stringify(mapping)) as typeof mapping;
  const atlas = decodePng(png);
  assert.deepEqual(atlas, terrain.atlas);
  assert.equal(parsed.tiles.length, 48);
  assert.equal(parsed.tiles.at(-1)?.mask, null);
  assert.equal(parsed.pngSha256, sha256(png));
  assert.equal(parsed.rgbaSha256, sha256(atlas.rgba));
  assert.deepEqual(inspectPng(atlas, png, renderTerrain(parsed.spec).atlas), []);
  for (const tile of parsed.tiles) {
    assert.equal(tile.collision, 'empty');
    for (let row = 0; row < 16; row++) {
      const start = ((tile.y + row) * atlas.w + tile.x) * 4;
      assert.deepEqual(atlas.rgba.subarray(start, start + 64), terrain.tiles[tile.id - 1].raster.rgba.subarray(row * 64, row * 64 + 64));
    }
  }
  assert.deepEqual(tileIdsForMap(['..', '##']), [[48, 48], [grassTileId(2), grassTileId(8)]]);
  const map = renderTileGrid(terrain, tileIdsForMap(['...','.##','###']));
  assert.deepEqual(decodePng(encodePng(map)), map);
  assert.throws(() => renderTileGrid(terrain, [[49]]), /Unknown/);
  assert.throws(() => tileIdsForMap(['..', '#']), /equal-width/);
});

test('validates TerrainSpec and keeps authored, custom and locked palettes authoritative', () => {
  assert.throws(() => renderTerrain({ ...defaultTerrainSpec, tileSize: 32 }));
  assert.throws(() => renderTerrain({ ...defaultTerrainSpec, callback: 'throw 1' }));
  assert.throws(() => renderTerrain({ ...defaultTerrainSpec, palette: { mode: 'locked', colors: [] } }));
  assert.throws(() => renderTerrain({ ...defaultTerrainSpec, palette: { mode: 'custom', colors: ['#aabbcc', '#AABBCC'] } }));
  const authored = renderTerrain(defaultTerrainSpec);
  assert.equal(authored.material.diagnostics.status, 'FULL_RAMP');
  const custom = renderTerrain({ ...defaultTerrainSpec, palette: { mode: 'custom', colors: authored.material.palette } });
  assert.deepEqual(custom.atlas, authored.atlas);
  assert.equal(custom.material.diagnostics.mode, 'custom');
  const limited = renderTerrain({ ...defaultTerrainSpec, palette: { mode: 'locked', colors: ['#123456'] } });
  assert.equal(limited.material.diagnostics.status, 'PALETTE_LIMITED');
  assert.deepEqual(limited.material.diagnostics.warnings.map(warning => warning.code),
    ['GRASS_RAMP_COMPRESSED', 'DIRT_RAMP_COMPRESSED', 'GRASS_DIRT_INK_COLLISION', 'GRASS_DIRT_CONTRAST_LOSS']);
  checkTerrainPixels(limited);
  for (let i = 0; i < limited.atlas.rgba.length; i += 4) assert.equal(limited.atlas.rgba.readUInt32BE(i), pack('#123456'));
  const raster = renderTerrain({ ...defaultTerrainSpec, surface: 'plain' });
  assert.notDeepEqual(raster.atlas, authored.atlas);
  assert.deepEqual(checkTerrainSeams(raster), checkTerrainSeams(authored));

  const prop = renderAsset(makeCurrentPropSpec('travel', 42, ['#123456', '#b7abb0']));
  assert.deepEqual(validateRaster(prop.final, prop.spec, { durationMs: 100, loop: false }), []);
  assert.ok(prop.paletteDiagnostics);
  assert.equal(assessPropPalette(prop.paletteDiagnostics).status, 'PALETTE_LIMITED');
});
