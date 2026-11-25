import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pack } from '../src/core/palette/colors.ts';
import type { Raster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { canonicalMasks } from '../src/generators/terrain/adjacency.ts';
import { bakeTerrain, verifyBakedTerrain, writeBakedTerrain } from '../src/generators/terrain/baked.ts';
import { boundaryDistance, productionBanks } from '../src/generators/terrain/edges.ts';
import { terrainExport } from '../src/generators/terrain/export.ts';
import { productionProjectPalette, projectPalette } from '../src/generators/terrain/project-palette.ts';
import { renderTerrain, renderTileGrid, tileIdsForMap } from '../src/generators/terrain/render.ts';
import { sha256 } from '../src/quality/raster.ts';
import { naturalTerrainSpec, productionTerrainSpec } from '../src/specs/terrain.ts';

const before = (name: string) => readFileSync('benchmarks/results/e32/' + name);
const pixel = (raster: Raster, x: number, y: number) => raster.rgba.readUInt32BE((y * raster.w + x) * 4);

test('keeps the published E3.2 benchmark hashes and regenerates its atlas exactly', () => {
  assert.equal(sha256(before('atlas.png')), 'dea7567053ad73c63b6e2bf3939ec80605e3c10fa802d287bf9dacdb5ce51818');
  assert.equal(sha256(before('atlas.json')), 'e7c184827d0b5e17d2c13452c6a8ffcda044e45a14fc040d1712de53a18ff566');
  assert.equal(sha256(before('qa.json')), '16210aba6bc39fd9cb913b2fee5115be72daa126bb4a47cb45a270c9876a263a');
  assert.equal(sha256(before('large-after-1x.png')), '26eddbac9c14924463bd92225b7bc5a24ed1ab6fbdfaf4813bc184a69ba3c732');
  const exported = terrainExport(renderTerrain(naturalTerrainSpec));
  assert.deepEqual(exported.png, before('atlas.png'));
  assert.equal(JSON.stringify(exported.mapping, null, 2) + '\n', before('atlas.json').toString('utf8'));
});

test('all production bank profiles preserve boundaries and absolute-world detail', () => {
  for (const inset of [2, 3]) {
    for (const mask of canonicalMasks) {
      for (let variant = 0; variant < 4; variant++) {
        const profile = productionBanks(variant);
        const grass = new Set<number>();
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const distance = boundaryDistance(mask, x, y, 16, inset, true, profile);
          if (x === 0 || x === 15 || y === 0 || y === 15) {
            assert.equal(distance, boundaryDistance(mask, x, y, 16, inset));
          }
          if (distance >= inset) grass.add(y * 16 + x);
        }
        assert.ok(grass.has(7 * 16 + 7), 'Mask needs a grass center: ' + mask);
        const queue = [7 * 16 + 7];
        grass.delete(queue[0]);
        for (const at of queue) {
          for (const next of [at - 16, at + 16, at % 16 ? at - 1 : -1, at % 16 === 15 ? -1 : at + 1]) {
            if (grass.delete(next)) queue.push(next);
          }
        }
        assert.equal(grass.size, 0, 'Detached grass for mask ' + mask + ', profile ' + variant);
      }
    }
  }
  const ids = tileIdsForMap(['##.####.', '#..###..', '...##...', '..###...']);
  const origin = [-17, 9] as const;
  const terrain = renderTerrain(productionTerrainSpec);
  const staticMap = renderTileGrid(terrain, ids);
  const world = renderTileGrid(terrain, ids, origin);
  const patch = renderTileGrid(terrain, ids.slice(1, 3).map(row => row.slice(2, 5)), [-15, 10]);
  assert.deepEqual(world, renderTileGrid(terrain, ids, origin));
  assert.notDeepEqual(world, renderTileGrid(terrain, ids, [-16, 9]));
  assert.notDeepEqual(world, renderTileGrid(renderTerrain({ ...productionTerrainSpec, seed: 43 }), ids, origin));
  assert.deepEqual(terrainExport(terrain).mapping.tiles, terrainExport(renderTerrain(naturalTerrainSpec)).mapping.tiles);
  for (let y = 0; y < patch.h; y++) for (let x = 0; x < patch.w; x++) {
    assert.equal(pixel(world, x + 32, y + 16), pixel(patch, x, y));
  }
  for (const [y, row] of ids.entries()) for (const x of row.keys()) {
    for (let p = 0; p < 16; p++) for (const [u, v] of [[0, p], [15, p], [p, 0], [p, 15]]) {
      assert.equal(pixel(world, 16 * x + u, 16 * y + v), pixel(staticMap, 16 * x + u, 16 * y + v));
    }
  }
});

test('regenerates a baked package and rejects payload changes and manifest path substitution', async t => {
  const root = resolve('.cache');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, 'terrain-baked-'));
  assert.ok(resolve(directory).startsWith(root + sep));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const map = { rows: ['##.', '...'], origin: [-3, 4] };
  const overlay = { id: 'marker', left: 3, top: 4, provenance: 'Unit test', png: encodePng({ w: 1, h: 1, rgba: Buffer.from([1, 2, 3, 255]) }) };
  const terrain = renderTerrain(productionTerrainSpec);
  const bundle = bakeTerrain(terrain, map, [overlay]);
  assert.deepEqual(decodePng(bundle.files.get('map.png')!), bundle.raster);
  assert.equal(pixel(bundle.raster, 3, 4), 0x010203ff);
  await writeBakedTerrain(directory, bundle);
  await writeBakedTerrain(directory, bundle);
  assert.deepEqual(await verifyBakedTerrain(directory), bundle.manifest);
  await assert.rejects(writeBakedTerrain(directory, bakeTerrain(terrain, { ...map, origin: [0, 0] }, [overlay])), /Existing package differs/);
  await writeFile(join(directory, 'map.png'), Buffer.from('corrupt payload'));
  await assert.rejects(verifyBakedTerrain(directory), /map\.png/);
  await writeFile(join(directory, 'map.png'), bundle.files.get('map.png')!);
  const hostile = { ...bundle.manifest, overlays: [{ ...bundle.manifest.overlays[0], file: '../overlay-1.png' }] };
  await writeFile(join(directory, 'map.json'), JSON.stringify(hostile));
  await assert.rejects(verifyBakedTerrain(directory), /Invalid overlay file name/);
  assert.throws(() => bakeTerrain(renderTerrain({ ...productionTerrainSpec, variation: 'atlas' }), map), /world-variation/);

  assert.ok(projectPalette.every(color => productionProjectPalette.includes(color)));
  for (const [mode, colors, status] of [
    ['project', productionProjectPalette, 'FULL_RAMP'],
    ['locked', ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'], 'PALETTE_LIMITED'],
  ] as const) {
    const result = bakeTerrain(renderTerrain({ ...productionTerrainSpec, palette: { mode, colors } }), map);
    assert.equal(result.manifest.paletteDiagnostics.status, status);
    const allowed = new Set(colors.map(pack));
    for (let at = 0; at < result.raster.rgba.length; at += 4) assert.ok(allowed.has(result.raster.rgba.readUInt32BE(at)));
  }
});
