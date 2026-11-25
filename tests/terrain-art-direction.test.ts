import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { pack } from '../src/core/palette/colors.ts';
import type { Raster } from '../src/core/pixels/raster.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { dirtTileId, grassTileId } from '../src/generators/terrain/adjacency.ts';
import { bakeTerrain } from '../src/generators/terrain/baked.ts';
import { coordinateHash } from '../src/generators/terrain/detail.ts';
import { boundaryDistance, productionBanks } from '../src/generators/terrain/edges.ts';
import { terrainExport } from '../src/generators/terrain/export.ts';
import { renderTerrain, renderTileGrid, tileIdsForMap } from '../src/generators/terrain/render.ts';
import { sha256 } from '../src/quality/raster.ts';
import { productionTerrainSpec, type TerrainSpecV4 } from '../src/specs/terrain.ts';

const before = 'benchmarks/results/e33/';
const pixel = (raster: Raster, x: number, y: number) => raster.rgba.readUInt32BE((y * raster.w + x) * 4);
const v4 = { ...productionTerrainSpec, version: 4, direction: 'conservative' } satisfies TerrainSpecV4;

test('preserves E3.3 production hashes and exact output for the same map', () => {
  const checkpoint = {
    'atlas.png': '1403b7ab5181b780be6d2a36f4ef1c5e20db7334b3bcf8e12d637ab1b582fe09',
    'atlas.json': '151805909ae71d486759a3b480a7505b849c28afb36f70702ad5aa69d4e291ea',
    'qa.json': '67a55c5f1533a6c9e7c78cee8952c266543dda1b2bf231d5034f551fa6f56d77',
    'packages/large/map.png': 'ea2ab668746f2f30f5c16f5cfc0fb86382b7885bd3c8ca37dc35404dcdc10980',
  };
  for (const [path, hash] of Object.entries(checkpoint)) assert.equal(sha256(readFileSync(before + path)), hash);
  const input: unknown = JSON.parse(readFileSync(before + 'map-input.json', 'utf8'));
  const result = bakeTerrain(renderTerrain(productionTerrainSpec), input);
  for (const [file, bytes] of result.files) assert.deepEqual(readFileSync(before + 'packages/large/' + file), bytes);
  assert.throws(() => renderTerrain({ ...v4, direction: 'unsupported' }));
});

test('both v4 directions clip details by material and retain canonical seams at world coordinates', () => {
  const rows = ['######....', '####...###', '####...###', '###....###', '....######'];
  const ids = tileIdsForMap(rows);
  const origin = [-31, 52] as const;
  const prior = renderTerrain(productionTerrainSpec);
  const legacy = renderTileGrid(prior, ids, origin);
  for (const direction of ['conservative', 'art-directed'] as const) {
    const terrain = renderTerrain({ ...v4, direction });
    const world = renderTileGrid(terrain, ids, origin);
    assert.deepEqual(world, renderTileGrid(terrain, ids, origin));
    assert.notDeepEqual(world, legacy);
    assert.notDeepEqual(world, renderTileGrid(terrain, ids, [-30, 52]));
    assert.notDeepEqual(world, renderTileGrid(renderTerrain({ ...v4, direction, seed: 12 }), ids, origin));
    assert.deepEqual(terrainExport(terrain).mapping.tiles, terrainExport(prior).mapping.tiles);

    const { grass, grassLight, grassShade, dirt, dirtLight, dirtShade, dirtPacked } = terrain.material.inks;
    const grassInks = new Set([grass, grassLight, grassShade]), dirtInks = new Set([dirt, dirtLight, dirtShade, dirtPacked]);
    const crop = renderTileGrid(terrain, ids.slice(2, 4).map(row => row.slice(3, 7)), [-28, 54]);
    for (let y = 0; y < crop.h; y++) for (let x = 0; x < crop.w; x++) {
      assert.equal(pixel(world, x + 48, y + 32), pixel(crop, x, y));
    }
    for (const [ty, row] of ids.entries()) for (const [tx, id] of row.entries()) {
      const tile = terrain.tiles[id - 1];
      const bank = productionBanks(coordinateHash(v4.seed, origin[0] + tx, origin[1] + ty, 11));
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const ink = pixel(world, tx * 16 + x, ty * 16 + y);
        const isGrass = boundaryDistance(tile.mask, x, y, 16, v4.edgeInset, true, bank) >= v4.edgeInset;
        assert.ok((isGrass ? grassInks : dirtInks).has(ink));
        assert.equal(ink & 255, 255);
        if (x === 0 || y === 0 || x === 15 || y === 15) assert.equal(ink, pixel(legacy, tx * 16 + x, ty * 16 + y));
      }
    }
    const locked = ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'];
    const baked = bakeTerrain(renderTerrain({ ...v4, direction, palette: { mode: 'locked', colors: locked } }), { rows, origin });
    assert.equal(baked.manifest.spec.version, 4);
    assert.equal(baked.manifest.paletteDiagnostics.status, 'PALETTE_LIMITED');
    assert.deepEqual(decodePng(baked.files.get('map.png')!), baked.raster);
    const allowed = new Set(locked.map(pack));
    for (let at = 0; at < baked.raster.rgba.length; at += 4) assert.ok(allowed.has(baked.raster.rgba.readUInt32BE(at)));
  }
});

test('art-directed details concentrate in patches with rest tiles and respond to density', () => {
  const ids = Array.from({ length: 22 }, () => [...Array<number>(19).fill(grassTileId(255)), ...Array<number>(19).fill(dirtTileId)]);
  const sample = (direction: TerrainSpecV4['direction'], surface: TerrainSpecV4['surface']) => {
    const terrain = renderTerrain({ ...v4, direction, surface });
    const map = renderTileGrid(terrain, ids, [-17, 24]);
    const counts = { marked: 0, resting: 0, developed: 0 };
    for (const [y, row] of ids.entries()) for (const [x, tile] of row.entries()) {
      const base = tile === dirtTileId ? terrain.material.inks.dirt : terrain.material.inks.grass;
      let ink = 0;
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        if (pixel(map, x * 16 + px, y * 16 + py) !== base) ink++;
      }
      counts.marked += ink;
      if (ink === 0) counts.resting++;
      if (ink >= 15) counts.developed++;
    }
    return counts;
  };
  const [sparse, standard, dense] = ['sparse', 'standard', 'dense'].map(surface => sample('art-directed', surface as TerrainSpecV4['surface']));
  const conservative = sample('conservative', 'standard');
  assert.ok(sparse.marked < standard.marked && standard.marked < dense.marked);
  assert.ok(standard.resting > conservative.resting && standard.developed > conservative.developed, JSON.stringify({ standard, conservative }));
});
