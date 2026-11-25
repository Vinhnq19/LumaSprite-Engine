import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { pack } from '../src/core/palette/colors.ts';
import { blit, makeRaster, nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { dirtTileId, grassTileId } from '../src/generators/terrain/adjacency.ts';
import { bakeTerrain, verifyBakedTerrain, writeBakedTerrain } from '../src/generators/terrain/baked.ts';
import { coordinateHash } from '../src/generators/terrain/detail.ts';
import { terrainExport } from '../src/generators/terrain/export.ts';
import { productionProjectPalette } from '../src/generators/terrain/project-palette.ts';
import { renderTerrain, renderTileGrid, tileIdsForMap } from '../src/generators/terrain/render.ts';
import { sha256 } from '../src/quality/raster.ts';
import { checkTerrainJunctions, checkTerrainSeams } from '../src/quality/terrain.ts';
import { productionTerrainSpec, type TerrainSpecV4 } from '../src/specs/terrain.ts';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'benchmarks/results/run/e34' } } });
const out = resolve(values.out);
const results = resolve('benchmarks/results');
for (const edition of ['sample', 'e2', 'e23', 'e24', 'e3', 'e32', 'e33']) {
  const baseline = join(results, edition).toLowerCase();
  if (out.toLowerCase() === baseline || out.toLowerCase().startsWith(baseline + sep)) {
    throw new Error('Choose a separate E3.4 benchmark directory.');
  }
}
await mkdir(out, { recursive: true });
const json = (name: string, data: unknown) => writeFile(join(out, name + '.json'), JSON.stringify(data, null, 2) + '\n');
const save = (name: string, raster: Raster) => writeFile(join(out, name + '.png'), encodePng(raster));
const zoom = (name: string, raster: Raster) => save(name + '-4x', nearestNeighbor(raster, 4));
const previous = renderTerrain(productionTerrainSpec);
const approved = 'benchmarks/results/e33/packages';

const [outdoor, large, stress] = await Promise.all(['outdoor', 'large', 'stress'].map(name => verifyBakedTerrain(join(approved, name))));
const props = await Promise.all(outdoor.overlays.map(async ({ id, left, top, provenance, file, pngSha256 }) => {
  const png = await readFile(join(approved, 'outdoor', file));
  assert.equal(sha256(png), pngSha256);
  return { id, left, top, provenance, png };
}));

const origin = outdoor.map.origin;
const design = {
  seed: productionTerrainSpec.seed,
  size: [31, 19],
  main: [[-2, 13], [4, 12], [9, 9], [13, 8.2], [17, 9.4], [21, 11.5], [25, 11.1], [30, 8.7], [33, 8]],
  branch: [[18, 10], [20, 7], [21, 4], [26, 1], [27, -2]],
  shoulders: [[8, 11, 3.1, 2.7], [19, 10, 3.8, 3.1]],
};
function distanceToPath(x: number, y: number, points: number[][]) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}
const paths = [design.main, design.branch].map(path => path.map(([x, y], i) => [
  x, y + ((coordinateHash(design.seed, x, y, i) % 7) - 3) / 8,
]));
const organic = Array.from({ length: design.size[1] }, (_, y) => Array.from({ length: design.size[0] }, (_, x) => {
  const shoulder = design.shoulders.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
  const road = distanceToPath(x, y, paths[0]) <= 1.8 + .22 * Math.sin(x / 4);
  const fork = distanceToPath(x, y, paths[1]) <= 1.55;
  return road || fork || shoulder ? '.' : '#';
}).join(''));
const roadCells = new Set(organic.flatMap((row, y) => Array.from(row, (cell, x) => cell === '.' ? y * design.size[0] + x : -1)).filter(at => at >= 0));
const road = [roadCells.values().next().value!];
roadCells.delete(road[0]);
const width = design.size[0];
for (const at of road) {
  for (const next of [at - width, at + width, at % width ? at - 1 : -1, at % width === width - 1 ? -1 : at + 1]) {
    if (roadCells.delete(next)) road.push(next);
  }
}
assert.equal(roadCells.size, 0, 'The clearing road and fork stay connected.');
assert.ok(road.some(at => at < width) && road.some(at => at % width === 0) && road.some(at => at % width === width - 1));

const place = (id: string, left: number, top: number) => ({ ...props.find(prop => prop.id === id)!, left, top });
const organicProps = [place('compact', 109, 158), place('crate', 281, 173), place('barrel-wide', 318, 164), place('traveler', 229, 135)];
const wallPath = 'benchmarks/fixtures/e24/dungeon-wall.png';
const wallPng = await readFile(wallPath);
assert.equal(sha256(wallPng), '0d4f0c82ffb4c4158342fc0d7fc95cef22ff509003d711e84ec3b5ba3cee21f6');
const wallTile = decodePng(wallPng);
const wall = makeRaster(256, wallTile.h);
for (let x = 0; x < wall.w; x += wallTile.w) blit(wall, wallTile, x, 0);
const storageProps = [
  { id: 'wall', provenance: 'Kenney Tiny Dungeon CC0 wall repeated at 1×, benchmarks/fixtures/e24', left: 0, top: 0, png: encodePng(wall) },
  place('barrel-tall', 15, 18), place('barrel-wide', 49, 21), place('crate', 177, 18),
  place('compact', 211, 27), place('traveler', 110, 77),
];
const scenes = [
  { id: 'outdoor', map: outdoor.map, overlays: props, lockedBaseline: true },
  { id: 'large', map: large.map, overlays: [], lockedBaseline: true },
  { id: 'stress', map: stress.map, overlays: [], lockedBaseline: true },
  { id: 'organic', map: { rows: organic, origin }, overlays: organicProps, lockedBaseline: false },
  { id: 'storage', map: { rows: Array<string>(9).fill('.'.repeat(16)), origin }, overlays: storageProps, lockedBaseline: false },
];
await json('organic-layout', { ...design, paths, map: scenes[3].map });
for (const scene of scenes) {
  if (scene.lockedBaseline) continue;
  const raster = bakeTerrain(previous, scene.map, scene.overlays).raster;
  await save('e33-' + scene.id + '-1x', raster);
  await zoom('e33-' + scene.id, raster);
}

const palettes = {
  authored: { mode: 'authored' },
  project: { mode: 'project', colors: productionProjectPalette },
  locked: { mode: 'locked', colors: ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'] },
} satisfies Record<string, TerrainSpecV4['palette']>;
const ids = tileIdsForMap(large.map.rows);
function materialCoverage(terrain: ReturnType<typeof renderTerrain>) {
  const map = renderTileGrid(terrain, ids, origin);
  return Object.fromEntries([
    ['grass', grassTileId(255), terrain.material.inks.grass],
    ['dirt', dirtTileId, terrain.material.inks.dirt],
  ].map(([name, id, base]) => {
    let tiles = 0, painted = 0, resting = 0, micro = 0, meso = 0, larger = 0;
    const signatures = new Set<string>();
    for (const [y, row] of ids.entries()) for (const [x, tile] of row.entries()) {
      if (tile !== id) continue;
      const marks = new Set<number>();
      const pixels: number[] = [];
      for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) {
        const ink = map.rgba.readUInt32BE(((y * 16 + v) * map.w + x * 16 + u) * 4);
        if (ink !== base) marks.add(v * 16 + u);
        pixels.push(ink);
      }
      tiles++;
      painted += marks.size;
      if (!marks.size) resting++;
      signatures.add(JSON.stringify(pixels));
      while (marks.size) {
        const anchor = marks.values().next().value!;
        const region = [anchor];
        marks.delete(anchor);
        for (const pos of region) {
          for (const next of [pos - 16, pos + 16, pos % 16 ? pos - 1 : -1, pos % 16 === 15 ? -1 : pos + 1]) {
            if (marks.delete(next)) region.push(next);
          }
        }
        if (region.length <= 4) micro++;
        else if (region.length <= 24) meso++;
        else larger++;
      }
    }
    return [name, { tiles, painted, resting, micro, meso, larger, distinct: signatures.size }];
  }));
}

function straightRun(rows: string[]) {
  let max = 0;
  for (const grid of [rows, Array.from(rows[0], (_, i) => rows.map(row => row[i]).join(''))]) {
    for (let y = 1; y < grid.length; y++) {
      let run = 0, last = '';
      for (let x = 0; x < grid[y].length; x++) {
        const a = grid[y - 1][x], b = grid[y][x];
        run = a === b ? 0 : a === last ? run + 1 : 1;
        last = a;
        max = Math.max(max, run);
      }
    }
  }
  return max;
}

const configurations = [['a', 'conservative'], ['b', 'art-directed']] as const;
const proofs = [];
for (const [id, direction] of configurations) {
  const spec = { ...productionTerrainSpec, version: 4, direction } satisfies TerrainSpecV4;
  const terrain = renderTerrain(spec);
  await json(id + '-spec', spec);
  const maps = [];
  for (const scene of scenes) {
    const key = id + '-' + scene.id;
    const bundle = bakeTerrain(terrain, scene.map, scene.overlays);
    const directory = join(out, 'packages', key);
    await writeBakedTerrain(directory, bundle);
    const verified = await verifyBakedTerrain(directory);
    await zoom(key, bundle.raster);
    await save(key + '-editable-reference-1x', renderTileGrid(terrain, verified.cells));
    maps.push({ id: scene.id, package: 'packages/' + key + '/map.json', ...verified.image });
  }
  const diagnostics = Object.fromEntries(await Promise.all(Object.entries(palettes).map(async ([name, palette]) => {
    const selected = renderTerrain({ ...spec, palette });
    const { png, mapping } = terrainExport(selected);
    assert.deepEqual(decodePng(png), selected.atlas);
    const raster = renderTileGrid(selected, tileIdsForMap(scenes[2].map.rows), origin);
    const allowed = new Set(selected.material.palette.map(pack));
    for (let at = 0; at < raster.rgba.length; at += 4) assert.ok(allowed.has(raster.rgba.readUInt32BE(at)));
    await save(id + '-palette-' + name + '-1x', raster);
    await zoom(id + '-palette-' + name, raster);
    return [name, {
      ...mapping.diagnostics, atlasPngSha256: mapping.pngSha256,
      seams: checkTerrainSeams(selected), junctions: checkTerrainJunctions(selected),
    }];
  })));
  for (const surface of ['sparse', 'standard', 'dense'] as const) {
    const raster = bakeTerrain(renderTerrain({ ...spec, surface }), scenes[3].map, organicProps).raster;
    await save(id + '-' + surface + '-1x', raster);
    await zoom(id + '-' + surface, raster);
  }
  proofs.push({ id, direction, diagnostics, coverage: materialCoverage(terrain), maps });
}
await json('qa', {
  engineering: 'PASS', artistic: 'PENDING_HUMAN_REVIEW', canonicalMasks: 47, rawMasks: 256,
  storageWallSourceSha256: sha256(wallPng),
  straightInternalBoundaryTiles: Object.fromEntries(scenes.map(scene => [scene.id, straightRun(scene.map.rows)])),
  organicRoad: { connectedDirtTiles: road.length, exits: ['north', 'west', 'east'] },
  baselineCoverage: materialCoverage(previous), candidates: proofs,
});
console.log('E3.4 benchmark written to ' + out);
