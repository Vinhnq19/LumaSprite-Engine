import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { chestColors, pack } from '../src/core/palette/colors.ts';
import { nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { dirtTileId, grassTileId } from '../src/generators/terrain/adjacency.ts';
import { bakeTerrain, verifyBakedTerrain, writeBakedTerrain } from '../src/generators/terrain/baked.ts';
import { writeTerrainExport } from '../src/generators/terrain/export.ts';
import { productionProjectPalette, productionProjectTerrainRoles } from '../src/generators/terrain/project-palette.ts';
import { renderTerrain, renderTileGrid, tileIdsForMap } from '../src/generators/terrain/render.ts';
import { inspectPng, sha256 } from '../src/quality/raster.ts';
import { checkTerrainJunctions, checkTerrainSeams } from '../src/quality/terrain.ts';
import { defaultTerrainSpec, naturalTerrainSpec, productionTerrainSpec } from '../src/specs/terrain.ts';
import { swatches } from './game-preview.ts';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'benchmarks/results/run/e33' } } });
const out = resolve(values.out);
for (const edition of ['sample', 'e2', 'e23', 'e24', 'e3', 'e32']) {
  const old = resolve('benchmarks/results', edition).toLowerCase();
  if (out.toLowerCase() === old || out.toLowerCase().startsWith(old + sep)) throw new Error('Choose a separate E3.3 benchmark directory.');
}
await mkdir(out, { recursive: true });
const old = 'benchmarks/results/e32';
const json = (name: string, value: unknown) => writeFile(join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const save = (name: string, raster: Raster) => writeFile(join(out, name + '.png'), encodePng(raster));
const zoom = (name: string, raster: Raster) => save(name + '-4x', nearestNeighbor(raster, 4));

const prior = JSON.parse(await readFile(join(old, 'scenes.json'), 'utf8')) as {
  origin: [number, number];
  rows: { outdoor: string[]; large: string[]; stress: string[]; transition: string[] };
  props: { name: string; path: string; left: number; top: number; pngSha256: string }[];
};
const origin = prior.origin;
const regions = Array.from({ length: 18 }, (_, y) => Array.from({ length: 32 }, (_, x) => {
  const northwest = x < 11 && y < 9 && !(x > 3 && x < 8 && y > 2 && y < 6);
  const northeast = x > 17 && y < 7 && (x < 24 || y > 3);
  const southwest = x < 16 && y > 11 && (x > 4 || y > 13);
  const southeast = x > 20 && y > 9 && !(x > 24 && x < 29 && y > 12 && y < 15);
  return northwest || northeast || southwest || southeast ? '#' : '.';
}).join(''));

const scenes = { outdoor: prior.rows.outdoor, large: prior.rows.large, stress: prior.rows.stress, regions };
const overlays = await Promise.all(prior.props.map(async ({ name, path, left, top, pngSha256 }) => {
  const png = await readFile(path);
  if (sha256(png) !== pngSha256) throw new Error('Approved reference PNG changed: ' + name);
  const provenance = name === 'traveler' ? 'Eldiran CC0 fixture, benchmarks/fixtures/e24' : 'Approved E2.4 authored prop ' + name;
  return { id: name, left, top, png, provenance };
}));

const terrain = renderTerrain(productionTerrainSpec);
const project = renderTerrain({ ...productionTerrainSpec, palette: { mode: 'project', colors: productionProjectPalette } });
const locked = renderTerrain({ ...productionTerrainSpec, palette: {
  mode: 'locked', colors: ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'],
} });
const [atlas, projectAtlas, lockedAtlas] = await Promise.all([
  writeTerrainExport(terrain, out), writeTerrainExport(project, out, 'project-atlas'), writeTerrainExport(locked, out, 'locked-atlas'),
]);
await zoom('atlas', terrain.atlas);
await save('project-swatches', swatches(productionProjectPalette));
await json('project-palette', {
  version: 1, id: 'grass-dirt-wood-iron', colors: productionProjectPalette,
  terrainRoles: productionProjectTerrainRoles, propRoles: chestColors, studioRgba8: [0, ...productionProjectPalette.map(pack)],
});
await json('terrain-spec', productionTerrainSpec);
await json('map-input', { rows: prior.rows.large, origin });

const sceneProof = [];
for (const [name, rows] of Object.entries(scenes)) {
  const layers = name === 'outdoor' ? overlays : [];
  const bundle = bakeTerrain(terrain, { rows, origin }, layers);
  const packDirectory = join(out, 'packages', name);
  await writeBakedTerrain(packDirectory, bundle);
  const verified = await verifyBakedTerrain(packDirectory);
  await zoom(name, bundle.raster);
  await save(name + '-editable-reference-1x', renderTileGrid(terrain, verified.cells));
  sceneProof.push({ scene: name, package: 'packages/' + name + '/map.json', image: verified.image, overlays: verified.overlays });
}
const regionIds = tileIdsForMap(regions);
for (const [edition, raster] of [
  ['e31', renderTileGrid(renderTerrain(defaultTerrainSpec), regionIds)],
  ['e32', renderTileGrid(renderTerrain(naturalTerrainSpec), regionIds, origin)],
] as const) {
  await save('regions-' + edition + '-1x', raster);
  await zoom('regions-' + edition, raster);
}

for (const [name, raster] of Object.entries({
  'palette-authored': renderTileGrid(terrain, tileIdsForMap(prior.rows.transition), origin),
  'palette-project': renderTileGrid(project, tileIdsForMap(prior.rows.transition), origin),
  'palette-locked': renderTileGrid(locked, tileIdsForMap(prior.rows.transition), origin),
  'outdoor-sparse': bakeTerrain(renderTerrain({ ...productionTerrainSpec, surface: 'sparse' }), { rows: scenes.outdoor, origin }, overlays).raster,
  'outdoor-dense': bakeTerrain(renderTerrain({ ...productionTerrainSpec, surface: 'dense' }), { rows: scenes.outdoor, origin }, overlays).raster,
})) {
  await save(name + '-1x', raster);
  await zoom(name, raster);
}

const previousLarge = decodePng(await readFile(join(old, 'large-after-1x.png')));
const newLarge = decodePng(await readFile(join(out, 'packages/large/map.png')));
const largeIds = tileIdsForMap(scenes.large);
function repetition(raster: Raster) {
  const tiles = largeIds.map((row, y) => row.map((_, x) => {
    const lines = Array.from({ length: 16 }, (_, p) => {
      const offset = ((y * 16 + p) * raster.w + x * 16) * 4;
      return raster.rgba.subarray(offset, offset + 64);
    });
    return sha256(Buffer.concat(lines));
  }));
  return Object.fromEntries(Object.entries({ grass: grassTileId(255), dirt: dirtTileId }).map(([material, target]) => {
    const distinct = new Set<string>();
    let pairs = 0, repeats = 0;
    for (const [y, row] of largeIds.entries()) for (const [x, id] of row.entries()) {
      if (id !== target) continue;
      const hash = tiles[y][x];
      distinct.add(hash);
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (largeIds[y + dy]?.[x + dx] !== target) continue;
        pairs++;
        if (tiles[y + dy][x + dx] === hash) repeats++;
      }
    }
    return [material, { distinct: distinct.size, pairs, repeats }];
  }));
}
const measured = { e32: repetition(previousLarge), e33: repetition(newLarge) };
for (const stats of Object.values(measured.e33)) {
  if (stats.distinct < 100 || stats.repeats * 10 > stats.pairs) throw new Error('Production texture repetition exceeds the review threshold.');
}
const gate = (t: typeof terrain, mapping: typeof atlas) => {
  const errors = inspectPng(t.atlas, encodePng(t.atlas), renderTerrain(t.spec).atlas);
  if (errors.length) throw new Error(errors.join(', '));
  return { seams: checkTerrainSeams(t), junctions: checkTerrainJunctions(t), palette: mapping.diagnostics, pngSha256: mapping.pngSha256 };
};
await json('qa', {
  technical: 'PASS', artistic: 'PENDING_HUMAN_REVIEW', masks: 47, rawMasks: 256,
  authored: gate(terrain, atlas), project: gate(project, projectAtlas), locked: gate(locked, lockedAtlas),
  measured, scenes: sceneProof,
});

const comparison = [
  ['Outdoor RPG', 'outdoor', '../e32/outdoor-before', '../e32/outdoor-after'],
  ['Large terrain', 'large', '../e32/large-before', '../e32/large-after'],
  ['Autotile stress', 'stress', '../e32/stress-before', '../e32/stress-after'],
  ['Multiple regions', 'regions', 'regions-e31', 'regions-e32'],
];
await writeFile(join(out, 'README.md'), [
  '# E3.3 production tileset and terrain', '',
  'Open the [single-file report](../../../docs/LumaSprite-Engine-E3.3-Report.html) for the review gallery, atlas, baked parity and palette comparison. Review native 1× first.',
  '', '| Scene | E3.1 · 1× | E3.2 · 1× | E3.3 Engine baked · 1× | 4× |', '| --- | --- | --- | --- | --- |',
  ...comparison.map(([label, id, first, second]) =>
    '| ' + label + ' | [1×](' + first + '-1x.png) | [1×](' + second + '-1x.png) | [1×](packages/' + id +
    '/map.png) | [E3.1](' + first + '-4x.png) · [E3.2](' + second + '-4x.png) · [E3.3](' + id + '-4x.png) |'),
  '', '[Canon atlas PNG](atlas.png) · [Atlas 4×](atlas-4x.png) · [Atlas mapping](atlas.json) · [QA](qa.json) · [Owner review sheet](review.md)', '',
].join('\n'));
await writeFile(join(out, 'review.md'), [
  '# E3 final art review', '', '**PENDING_HUMAN_REVIEW**. Score 1–5 at native size. Proposed target is 4/5 for core criteria, with no severe seam or repetition defects.', '',
  '| Criterion | Score | Notes |', '| --- | --- | --- |',
  ...['Grass texture', 'Dirt texture', 'Boundary naturalness', 'Visible repetition', 'Palette harmony',
    'Props readability', 'Map readability', 'Game readiness'].map(item => '| ' + item + ' |  |  |'),
  '', 'Preferred density · __________', 'Project Owner decision · __________', '',
].join('\n'));
console.log('E3.3 benchmark written to ' + out);
