import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { chestColors, pack } from '../src/core/palette/colors.ts';
import { blit, makeRaster, nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { canonicalMask, canonicalMasks, dirtTileId, grassTileId, offsets } from '../src/generators/terrain/adjacency.ts';
import { writeTerrainExport } from '../src/generators/terrain/export.ts';
import { renderTerrain, renderTileGrid, tileIdsForMap } from '../src/generators/terrain/render.ts';
import { inspectPng } from '../src/quality/raster.ts';
import { checkTerrainSeams } from '../src/quality/terrain.ts';
import { defaultTerrainSpec } from '../src/specs/terrain.ts';
import { swatches } from './game-preview.ts';
import { opaqueBounds } from './prop-review-scenes.ts';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'benchmarks/results/run/e3' } } });
const out = resolve(values.out);
for (const edition of ['sample', 'e2', 'e23', 'e24']) {
  const old = resolve('benchmarks/results', edition).toLowerCase();
  if (out.toLowerCase() === old || out.toLowerCase().startsWith(old + sep)) throw new Error('Choose a separate E3 benchmark directory.');
}
await mkdir(out, { recursive: true });
const write = (name: string, data: unknown) => writeFile(join(out, name + '.json'), JSON.stringify(data, null, 2) + '\n');
const save = (name: string, raster: Raster) => writeFile(join(out, name + '.png'), encodePng(raster));
const pair = async (name: string, raster: Raster) => {
  await save(name + '-1x', raster);
  await save(name + '-4x', nearestNeighbor(raster, 4));
};

const authored = renderTerrain(defaultTerrainSpec);
const locked = renderTerrain({ ...defaultTerrainSpec, palette: {
  mode: 'locked', colors: ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'],
} });
for (const terrain of [authored, locked]) {
  const errors = inspectPng(terrain.atlas, encodePng(terrain.atlas), renderTerrain(terrain.spec).atlas);
  if (errors.length) throw new Error(errors.join(', '));
}
const [mapping, lockedMapping] = await Promise.all([
  writeTerrainExport(authored, out), writeTerrainExport(locked, out, 'locked-atlas'),
]);
await save('atlas-4x', nearestNeighbor(authored.atlas, 4));
await save('terrain-swatches', swatches(mapping.palette));
await save('locked-swatches', swatches(lockedMapping.palette));
const woodIron = Object.values(chestColors);
await write('wood-iron-preset', {
  version: 1, id: 'wood-iron', displayName: 'Wood & Iron', mode: 'locked', colors: woodIron,
  roles: chestColors, studioRgba8: [0, ...woodIron.map(pack)],
});
await save('wood-iron-swatches', swatches(woodIron));

await pair('repeated-centers', renderTileGrid(authored,
  Array.from({ length: 4 }, () => Array.from({ length: 10 }, (_, x) => x < 5 ? grassTileId(255) : dirtTileId))));

const maps = {
  outdoor: [
    '##################',
    '##################',
    '#####....#########',
    '###..........#####',
    '.................#',
    '#.............####',
    '####........######',
    '##################',
  ],
  transition: [
    '######......',
    '######......',
    '######......',
    '######......',
    '############',
    '############',
    '############',
    '############',
  ],
  stress: [
    '.....###.....',
    '.###.###.###.',
    '.#.#.#.#.###.',
    '.###.###..##.',
    '.......##.##.',
    '.####..##....',
    '.####..#.###.',
    '.##.####.###.',
    '......##.....',
  ],
} as const;

const baseline = 'benchmarks/results/e24';
for (const [name, layout] of Object.entries(maps)) {
  const tiles = tileIdsForMap(layout);
  const map = renderTileGrid(authored, tiles);
  await write(name, { width: layout[0].length, height: layout.length, tileSize: 16, grassAndDirt: layout, cells: tiles });
  if (name === 'outdoor') {
    await save('outdoor-terrain-1x', map);
    const props = [
      ['compact', 32, 92], ['travel', 78, 100], ['crate', 125, 85],
      ['barrel-wide', 172, 91], ['barrel-tall', 225, 100],
    ] as const;
    const placements = [];
    for (const [prop, center, baselineY] of props) {
      const sprite = decodePng(await readFile(join(baseline, prop + '-1x.png')));
      const originX = center - Math.floor(sprite.w / 2), originY = baselineY - opaqueBounds(sprite).bottom - 1;
      blit(map, sprite, originX, originY);
      placements.push({ prop, originX, originY, center, baselineY, palette: 'E2 authored' });
    }
    const traveler = decodePng(await readFile('benchmarks/fixtures/e24/rpg-traveler.png'));
    const center = 260, baselineY = 78;
    const originX = center - Math.floor(traveler.w / 2), originY = baselineY - opaqueBounds(traveler).bottom - 1;
    blit(map, traveler, originX, originY);
    await write('outdoor-props', [...placements, { prop: 'rpg-traveler', originX, originY, center, baselineY, palette: 'CC0 reference' }]);
  }
  await pair(name, map);
}
await save('transition-locked-1x', renderTileGrid(locked, tileIdsForMap(maps.transition)));

const matrix = makeRaster(8 * 50, 6 * 50);
const coverage = canonicalMasks.map((mask, i) => {
  const cells = Array.from({ length: 3 }, () => ['.', '.', '.']);
  cells[1][1] = '#';
  for (const [x, y, bit] of offsets) if (mask & bit) cells[y + 1][x + 1] = '#';
  const ids = tileIdsForMap(cells.map(row => row.join('')));
  const tileId = i + 1;
  if (ids[1][1] !== tileId) throw new Error('Coverage matrix chose the wrong center tile.');
  blit(matrix, renderTileGrid(authored, ids), (i % 8) * 50, Math.floor(i / 8) * 50);
  return { mask, tileId, x: mapping.tiles[i].x, y: mapping.tiles[i].y, cells: ids };
});
if (coverage.length !== 47) throw new Error('Expected all 47 masks.');
await save('mask-matrix-1x', matrix);
await write('coverage', {
  masks: coverage, rawMasks: Array.from({ length: 256 }, (_, raw) => ({ raw, mask: canonicalMask(raw), tileId: grassTileId(raw) })),
});
await write('qa', {
  technical: 'PASS', artistic: 'PENDING_HUMAN_REVIEW', masks: coverage.length, slots: authored.tiles.length,
  authored: { seams: checkTerrainSeams(authored), palette: mapping.diagnostics, pngSha256: mapping.pngSha256 },
  locked: { seams: checkTerrainSeams(locked), palette: lockedMapping.diagnostics, pngSha256: lockedMapping.pngSha256 },
});

await writeFile(join(out, 'README.md'), [
  '# E3.1 Grass & Dirt Tileset', '',
  'Native-size previews come first. The atlas contains 47 grass configurations on a dirt field and Dirt Center in slot 48.',
  '', '| Preview | Native size | 4× inspection |', '| --- | --- | --- |',
  ...[
    ['Atlas', 'atlas.png', 'atlas-4x.png'], ['Repeated centers', 'repeated-centers-1x.png', 'repeated-centers-4x.png'],
    ['Outdoor and E2 props', 'outdoor-1x.png', 'outdoor-4x.png'],
    ['Horizontal and vertical transitions', 'transition-1x.png', 'transition-4x.png'],
    ['Corner stress map', 'stress-1x.png', 'stress-4x.png'],
  ].map(([label, native, zoom]) => '| ' + label + ' | ![' + label + ' at 1×](' + native + ') | [View 4×](' + zoom + ') |'),
  '', '![Three-by-three neighborhoods for the 47 masks](mask-matrix-1x.png)',
  '', '[Atlas mapping and spec](atlas.json) · [Locked atlas](locked-atlas.png) · [Locked transition](transition-locked-1x.png)',
  '', '[Mask coverage](coverage.json) · [Technical diagnostics](qa.json) · [Owner review](review.md)', '',
].join('\n'));
await writeFile(join(out, 'review.md'), [
  '# E3.1 artistic review', '', '**PENDING_HUMAN_REVIEW**. Compare maps at 1× first, then inspect their joins at 4×.',
  '', '| Criterion | 1–5 | Notes |', '| --- | --- | --- |',
  ...['Terrain readability', 'Seam continuity', 'Edge and corner quality', 'Cluster quality', 'Texture repetition',
    'Color harmony', 'Prop and character readability', 'Game readiness'].map(label => '| ' + label + ' |  |  |'),
  '', 'Owner decision · __________', '',
].join('\n'));
console.log('E3 benchmark written to ' + out);
