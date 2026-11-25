import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { pack } from '../src/core/palette/colors.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import type { Raster } from '../src/core/pixels/raster.ts';
import { dirtTileId, grassTileId } from '../src/generators/terrain/adjacency.ts';
import { boundaryDistance } from '../src/generators/terrain/edges.ts';
import { terrainExport } from '../src/generators/terrain/export.ts';
import { projectPalette } from '../src/generators/terrain/project-palette.ts';
import { renderTerrain, renderTileGrid, tileIdsForMap, type TerrainAtlas } from '../src/generators/terrain/render.ts';
import { sha256 } from '../src/quality/raster.ts';
import { checkTerrainJunctions, checkTerrainPixels, checkTerrainSeams } from '../src/quality/terrain.ts';
import { defaultTerrainSpec, naturalTerrainSpec, terrainMapSpec } from '../src/specs/terrain.ts';

const loadBaseline = (name: string) => readFileSync('benchmarks/results/e3/' + name);

test('retains the E3.1 published PNG, metadata and QA hashes', () => {
  assert.equal(sha256(loadBaseline('atlas.png')), 'fc58cf83ef209ac785281db44b1906fece6fc1f339b5f31099415ab77c0cc5cf');
  assert.equal(sha256(loadBaseline('atlas.json')), 'a24474d8f80074ad7d034adfbb0fc9e197adb592cd0069d0fa88df69f013079f');
  assert.equal(sha256(loadBaseline('qa.json')), '8185581348e13712e6f73d5dd561c9f1d351bde778ed3ae659f1279adc93b607');
  const exported = terrainExport(renderTerrain(defaultTerrainSpec));
  assert.deepEqual(exported.png, loadBaseline('atlas.png'));
  assert.equal(JSON.stringify(exported.mapping, null, 2) + '\n', loadBaseline('atlas.json').toString('utf8'));
});

const pixel = (raster: Raster, x: number, y: number) => raster.rgba.readUInt32BE((y * raster.w + x) * 4);

test('steps banks while retaining identical E3.1 border pixels and the four-way junctions', () => {
  for (const edgeInset of [2, 3]) {
    const legacy = renderTerrain({ ...defaultTerrainSpec, edgeInset });
    const current = renderTerrain({ ...naturalTerrainSpec, edgeInset });
    const before = terrainExport(legacy).mapping;
    const after = terrainExport(current).mapping;
    assert.deepEqual(after.tiles, before.tiles);
    assert.deepEqual(after.maskBits, before.maskBits);
    assert.deepEqual(after.renderPolicy, {
      atlasPlacement: 'static', mapPlacement: 'world', coordinateUnit: 'tile', edgeProfile: 'stepped',
    });
    let moved = 0;
    for (const [i, { mask, raster }] of current.tiles.entries()) {
      for (let pos = 0; pos < 16; pos++) for (const [x, y] of [[0, pos], [15, pos], [pos, 0], [pos, 15]]) {
        assert.equal(pixel(raster, x, y), pixel(legacy.tiles[i].raster, x, y));
      }
      if (mask === null) continue;
      const inside = new Set<number>();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const isGrass = boundaryDistance(mask, x, y, 16, edgeInset, true) >= edgeInset;
        if (isGrass) inside.add(y * 16 + x);
        if (isGrass !== (boundaryDistance(mask, x, y, 16, edgeInset) >= edgeInset)) moved++;
      }
      const queue = [[...inside][0]];
      for (const at of queue) {
        for (const next of [at - 16, at + 16, at % 16 === 0 ? -1 : at - 1, at % 16 === 15 ? -1 : at + 1]) {
          if (inside.delete(next)) queue.push(next);
        }
      }
      assert.equal(inside.size, 0, 'Grass bank is detached for mask ' + mask);
    }
    assert.ok(moved > 100, 'The new profile should actually move the grass contour.');
    assert.deepEqual(checkTerrainSeams(current), { horizontal: 4096, vertical: 4096, matchedBorderPixels: 131072 });
    assert.deepEqual(checkTerrainJunctions(current), { neighborhoods: 65536, pixelsCompared: 262144 });
    assert.deepEqual(decodePng(terrainExport(current).png), current.atlas);
    checkTerrainPixels(current);
  }
});

function tilePixels(map: Raster, tileX: number, tileY: number) {
  return Buffer.concat(Array.from({ length: 16 }, (_, row) => {
    const start = ((tileY * 16 + row) * map.w + tileX * 16) * 4;
    return map.rgba.subarray(start, start + 64);
  }));
}

test('world-space details reduce 16-pixel repeats and match across independently rendered windows', () => {
  const terrain = renderTerrain(naturalTerrainSpec);
  for (const id of [grassTileId(255), dirtTileId]) {
    const ids = Array.from({ length: 12 }, () => Array(16).fill(id));
    const origin = [-17, 24] as const;
    const variant = renderTileGrid(terrain, ids, origin);
    assert.deepEqual(renderTileGrid(terrain, ids, origin), variant);
    assert.notDeepEqual(renderTileGrid(terrain, ids, [-16, 24]), variant);
    assert.notDeepEqual(renderTileGrid(renderTerrain({ ...naturalTerrainSpec, seed: 31 }), ids, origin), variant);
    const strip = renderTileGrid(terrain, ids.slice(3, 8).map(row => row.slice(5, 10)), [-12, 27]);
    const signatures = new Set<string>();
    const atlas = renderTileGrid(terrain, ids);
    let equalNeighbors = 0;
    for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) {
      signatures.add(sha256(tilePixels(variant, x, y)));
      if (x < 15 && tilePixels(variant, x, y).equals(tilePixels(variant, x + 1, y))) equalNeighbors++;
      if (x >= 5 && x < 10 && y >= 3 && y < 8) assert.deepEqual(tilePixels(variant, x, y), tilePixels(strip, x - 5, y - 3));
      for (let p = 0; p < 16; p++) for (const [i, j] of [[0, p], [15, p], [p, 0], [p, 15]]) {
        assert.equal(pixel(variant, x * 16 + i, y * 16 + j), pixel(atlas, x * 16 + i, y * 16 + j));
      }
    }
    assert.ok(signatures.size > 100);
    assert.ok(equalNeighbors < 18);
    const atlasMode = renderTerrain({ ...naturalTerrainSpec, variation: 'atlas' });
    assert.deepEqual(renderTileGrid(atlasMode, ids, origin), atlas);
  }

  const rows = ['##.#.', '#..##', '.....', '..##.'];
  const ids = tileIdsForMap(rows);
  const map = renderTileGrid(terrain, ids, [-17, 24]);
  const plain = renderTileGrid(terrain, ids);
  for (const [y, row] of ids.entries()) for (let x = 0; x < row.length; x++) {
    for (let p = 0; p < 16; p++) for (const [i, j] of [[0, p], [15, p], [p, 0], [p, 15]]) {
      assert.equal(pixel(map, x * 16 + i, y * 16 + j), pixel(plain, x * 16 + i, y * 16 + j));
    }
  }
});

test('preserves explicit palette colors and increases texture with selected density', () => {
  const modes = [
    { mode: 'project', colors: projectPalette },
    { mode: 'locked', colors: ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'] },
  ] as const;
  for (const { mode, colors } of modes) {
    const terrain = renderTerrain({ ...naturalTerrainSpec, palette: { mode, colors: [...colors] } });
    const map = renderTileGrid(terrain, [[grassTileId(255), dirtTileId]], [-7, 11]);
    const allowed = new Set(colors.map(pack));
    for (let p = 0; p < map.rgba.length; p += 4) assert.ok(allowed.has(map.rgba.readUInt32BE(p)));
    checkTerrainPixels(terrain);
    assert.equal(terrain.material.diagnostics.status, mode === 'locked' ? 'PALETTE_LIMITED' : 'FULL_RAMP');
  }

  function texturePixels(terrain: TerrainAtlas) {
    const ids = Array.from({ length: 4 }, () => Array(4).fill(grassTileId(255)));
    const map = renderTileGrid(terrain, ids, [-17, 24]);
    let count = 0;
    for (let p = 0; p < map.rgba.length; p += 4) if (map.rgba.readUInt32BE(p) !== terrain.material.inks.grass) count++;
    return count;
  }
  const [sparse, standard, dense] = ['sparse', 'standard', 'dense'].map(surface =>
    texturePixels(renderTerrain({ ...naturalTerrainSpec, surface })));
  assert.ok(sparse < standard && standard < dense);
  assert.throws(() => renderTerrain({ ...naturalTerrainSpec, variation: 'noise' }));
  assert.throws(() => terrainMapSpec.parse({ origin: [0.5, 0], rows: ['##'] }));
});
