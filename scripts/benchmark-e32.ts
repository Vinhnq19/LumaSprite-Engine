import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { chestColors, pack } from '../src/core/palette/colors.ts';
import { blit, nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { grassTileId, dirtTileId } from '../src/generators/terrain/adjacency.ts';
import { writeTerrainExport } from '../src/generators/terrain/export.ts';
import { projectPalette, projectTerrainRoles } from '../src/generators/terrain/project-palette.ts';
import { renderTerrain, renderTileGrid, tileIdsForMap } from '../src/generators/terrain/render.ts';
import { inspectPng, sha256 } from '../src/quality/raster.ts';
import { checkTerrainJunctions, checkTerrainSeams } from '../src/quality/terrain.ts';
import { defaultTerrainSpec, naturalTerrainSpec } from '../src/specs/terrain.ts';
import { swatches } from './game-preview.ts';
import { opaqueBounds } from './prop-review-scenes.ts';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'benchmarks/results/run/e32' } } });
const out = resolve(values.out);
for (const edition of ['sample', 'e2', 'e23', 'e24', 'e3']) {
  const old = resolve('benchmarks/results', edition).toLowerCase();
  if (out.toLowerCase() === old || out.toLowerCase().startsWith(old + sep)) throw new Error('Choose a separate E3.2 benchmark directory.');
}
await mkdir(out, { recursive: true });
const json = (name: string, value: unknown) => writeFile(join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const save = (name: string, raster: Raster) => writeFile(join(out, name + '.png'), encodePng(raster));
async function previews(name: string, raster: Raster) {
  await save(name + '-1x', raster);
  await save(name + '-4x', nearestNeighbor(raster, 4));
}

const origin = [-17, 24] as const;
const baseline = renderTerrain(defaultTerrainSpec);
const current = renderTerrain(naturalTerrainSpec);
const project = renderTerrain({ ...naturalTerrainSpec, palette: { mode: 'project', colors: projectPalette } });
const locked = renderTerrain({ ...naturalTerrainSpec, palette: {
  mode: 'locked', colors: ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'],
} });
for (const terrain of [current, project, locked]) {
  const errors = inspectPng(terrain.atlas, encodePng(terrain.atlas), renderTerrain(terrain.spec).atlas);
  if (errors.length) throw new Error(errors.join(', '));
}

const [mapping, projectMapping, lockedMapping] = await Promise.all([
  writeTerrainExport(current, out), writeTerrainExport(project, out, 'project-atlas'), writeTerrainExport(locked, out, 'locked-atlas'),
]);
await save('atlas-4x', nearestNeighbor(current.atlas, 4));
await save('project-swatches', swatches(projectPalette));
await json('project-palette', {
  version: 1, id: 'grass-dirt-wood-iron', displayName: 'Grass, Dirt, Wood & Iron',
  colors: projectPalette, terrainRoles: projectTerrainRoles, propRoles: chestColors, studioRgba8: [0, ...projectPalette.map(pack)],
});
await json('terrain-spec', current.spec);

const grid = (width: number, height: number, grass: (x: number, y: number) => boolean) =>
  Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => grass(x, y) ? '#' : '.').join(''));
const outdoor = grid(26, 14, (x, y) => {
  const center = x < 6 ? 8 : x < 14 ? 7 : x < 20 ? 8 : 9;
  return Math.abs(y - center) > 1 || (x >= 22 && y === center - 1);
});
const large = grid(36, 21, (x, y) => x < (y < 8 ? 20 : y < 13 ? 17 : 22));
const stress = [
  '..###....##...###.',
  '.#####...##...#.#.',
  '.##.##..####..###.',
  '.#####....##......',
  '..###...###...###.',
  '.......#.#####.#..',
  '.##.#...######.#..',
  '.##..#.........#..',
  '.####..###.#####..',
  '...##..###.###.#..',
  '...........###....',
];
const transition = grid(16, 10, (x, y) => x < 6 || (y > 5 && x < 12));
const outdoorIds = tileIdsForMap(outdoor);
const largeIds = tileIdsForMap(large);
const stressIds = tileIdsForMap(stress);
const transitionIds = tileIdsForMap(transition);

const references = [
  ['compact', 'benchmarks/results/e24/compact-1x.png', 36, 139],
  ['travel', 'benchmarks/results/e24/travel-1x.png', 98, 137],
  ['crate', 'benchmarks/results/e24/crate-1x.png', 157, 122],
  ['barrel-wide', 'benchmarks/results/e24/barrel-wide-1x.png', 216, 118],
  ['barrel-tall', 'benchmarks/results/e24/barrel-tall-1x.png', 281, 144],
  ['traveler', 'benchmarks/fixtures/e24/rpg-traveler.png', 345, 149],
] as const;
const sprites = await Promise.all(references.map(async ([name, path, pivotX, groundY]) => {
  const bytes = await readFile(path);
  const sprite = decodePng(bytes);
  const left = pivotX - Math.floor(sprite.w / 2);
  const top = groundY - opaqueBounds(sprite).bottom - 1;
  return { name, sprite, left, top, path, pivotX, groundY, pngSha256: sha256(bytes) };
}));
function withProps(map: Raster) {
  for (const { sprite, left, top } of sprites) blit(map, sprite, left, top);
  return map;
}
const outdoorBefore = withProps(renderTileGrid(baseline, outdoorIds));
const outdoorAfter = withProps(renderTileGrid(current, outdoorIds, origin));
const largeBefore = renderTileGrid(baseline, largeIds);
const largeAfter = renderTileGrid(current, largeIds, origin);
const stressBefore = renderTileGrid(baseline, stressIds);
const stressAfter = renderTileGrid(current, stressIds, origin);
for (const [name, image] of Object.entries({
  'outdoor-before': outdoorBefore, 'outdoor-after': outdoorAfter,
  'large-before': largeBefore, 'large-after': largeAfter,
  'stress-before': stressBefore, 'stress-after': stressAfter,
  'palette-authored': renderTileGrid(current, transitionIds, origin),
  'palette-project': renderTileGrid(project, transitionIds, origin),
  'palette-locked': renderTileGrid(locked, transitionIds, origin),
  'outdoor-sparse': withProps(renderTileGrid(renderTerrain({ ...naturalTerrainSpec, surface: 'sparse' }), outdoorIds, origin)),
  'outdoor-dense': withProps(renderTileGrid(renderTerrain({ ...naturalTerrainSpec, surface: 'dense' }), outdoorIds, origin)),
})) await previews(name, image);

await save('transition-atlas-1x', renderTileGrid(current, transitionIds));
await json('transition', { width: transition[0].length, height: transition.length, grassAndDirt: transition, cells: transitionIds });
await json('map-input', { rows: large, origin });
await json('scenes', {
  version: 1, origin, seed: naturalTerrainSpec.seed, beforeSpec: baseline.spec, afterSpec: current.spec,
  comparison: { authored: current.spec.palette, project: project.spec.palette, locked: locked.spec.palette },
  rows: { outdoor, large, stress, transition },
  density: { sparse: 'outdoor-sparse', standard: 'outdoor-after', dense: 'outdoor-dense' },
  props: sprites.map(({ name, path, left, top, pivotX, groundY, pngSha256 }) =>
    ({ name, path, left, top, pivotX, groundY, pngSha256 })),
});

function repetition(image: Raster) {
  const idFor = { grass: grassTileId(255), dirt: dirtTileId };
  const tileSize = 16;
  const hashes = largeIds.map((row, y) => row.map((_, x) => {
    const scanlines = Array.from({ length: tileSize }, (_, pixelY) => {
      const offset = ((y * tileSize + pixelY) * image.w + x * tileSize) * 4;
      return image.rgba.subarray(offset, offset + tileSize * 4);
    });
    return sha256(Buffer.concat(scanlines));
  }));
  return Object.fromEntries(Object.entries(idFor).map(([name, tileId]) => {
    const unique = new Set<string>();
    let tiles = 0, neighborPairs = 0, repeatPairs = 0;
    for (const [y, row] of largeIds.entries()) for (const [x, id] of row.entries()) {
      if (id !== tileId) continue;
      const digest = hashes[y][x];
      tiles++;
      unique.add(digest);
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (largeIds[y + dy]?.[x + dx] !== tileId) continue;
        neighborPairs++;
        if (digest === hashes[y + dy][x + dx]) repeatPairs++;
      }
    }
    return [name, { tiles, distinctTextures: unique.size, neighborPairs, exactRepeatsAt16px: repeatPairs }];
  }));
}

const qa = {
  technical: 'PASS',
  artistic: 'PENDING_HUMAN_REVIEW',
  masks: current.tiles.length - 1,
  authored: { seams: checkTerrainSeams(current), junctions: checkTerrainJunctions(current), ...mapping.diagnostics },
  project: { seams: checkTerrainSeams(project), junctions: checkTerrainJunctions(project), ...projectMapping.diagnostics },
  locked: { seams: checkTerrainSeams(locked), junctions: checkTerrainJunctions(locked), ...lockedMapping.diagnostics },
  repetition: { before: repetition(largeBefore), after: repetition(largeAfter) },
};
for (const result of Object.values(qa.repetition.after)) {
  if (result.distinctTextures < 20 || result.exactRepeatsAt16px * 10 > result.neighborPairs) {
    throw new Error('World variation did not reduce the 16-pixel repeat.');
  }
}
await json('qa', qa);

await writeFile(join(out, 'README.md'), [
  '# E3.2 Terrain Art Quality', '',
  'Review 1× before 4× nearest-neighbor. A, B and C keep the same layouts and placements across E3.1 and E3.2.',
  '', '| Scene | E3.1 at 1× | E3.2 at 1× | 4× |', '| --- | --- | --- | --- |',
  ...[['Outdoor RPG with E2 props', 'outdoor'], ['Large grass and dirt', 'large'], ['Autotile stress', 'stress']].map(([title, name]) =>
    '| ' + title + ' | ![Before ' + title + '](' + name + '-before-1x.png) | ![After ' + title + '](' + name + '-after-1x.png) | [Before](' + name + '-before-4x.png) · [After](' + name + '-after-4x.png) |'),
  '', '## Palette and density comparisons', '',
  '| Scene D palette | Native | Enlarged |', '| --- | --- | --- |',
  ...['authored', 'project', 'locked'].map(mode => '| ' + mode + ' | ![' + mode + ' palette](palette-' + mode + '-1x.png) | [4×](palette-' + mode + '-4x.png) |'),
  '', '| Outdoor density | Native | Enlarged |', '| --- | --- | --- |',
  ...[['sparse', 'outdoor-sparse'], ['standard', 'outdoor-after'], ['dense', 'outdoor-dense']].map(([density, image]) =>
    '| ' + density + ' | ![' + density + ' outdoor](' + image + '-1x.png) | [4×](' + image + '-4x.png) |'),
  '', '![Project palette swatches](project-swatches.png)', '',
  '[Project palette](project-palette.json) · [Atlas PNG](atlas.png) · [Atlas 4×](atlas-4x.png) · [Mask mapping](atlas.json)',
  '', '[Scene metadata](scenes.json) · [Seam, corner and repetition QA](qa.json) · [Owner review sheet](review.md)', '',
].join('\n'));
await writeFile(join(out, 'review.md'), [
  '# E3.2 owner review', '', '**PENDING_HUMAN_REVIEW**. Review the 1× scenes before opening the 4× views.', '',
  '| Criterion | Score 1–5 | Notes |', '| --- | --- | --- |',
  ...['Terrain readability', 'Grass texture', 'Dirt texture', 'Boundary shape', 'Seam appearance', 'Repetition',
    'Palette harmony', 'Prop readability', 'Overall game readiness'].map(name => '| ' + name + ' |  |  |'),
  '', 'Preferred density · __________', 'Owner decision · __________', '',
].join('\n'));
console.log('E3.2 benchmark written to ' + out);
