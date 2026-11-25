import { cluster, type Span } from '../../core/geometry/shapes.ts';
import { blit, makeRaster, put, type Raster } from '../../core/pixels/raster.ts';
import { terrainSpecV1, type TerrainSpec } from '../../specs/terrain.ts';
import { atlasColumns, atlasRows, canonicalMasks, dirtTileId, mapTileId, terrainBits } from './adjacency.ts';
import { terrainMaterials } from './materials.ts';

function boundaryDistance(mask: number | null, x: number, y: number, size: number, inset: number) {
  if (mask === null) return -Infinity;
  const right = x >= size / 2, bottom = y >= size / 2;
  const u = right ? size - 1 - x : x, v = bottom ? size - 1 - y : y;
  const horizontal = (mask & (right ? terrainBits.E : terrainBits.W)) !== 0;
  const vertical = (mask & (bottom ? terrainBits.S : terrainBits.N)) !== 0;
  const diagonal = bottom ? (right ? terrainBits.SE : terrainBits.SW) : (right ? terrainBits.NE : terrainBits.NW);
  if (!horizontal && !vertical) return Math.min(u, v, u + v - inset - 1);
  if (!horizontal) return u;
  if (!vertical) return v;
  return (mask & diagonal) !== 0 ? Infinity : u + v;
}

function renderTile(spec: TerrainSpec, mask: number | null, inks: ReturnType<typeof terrainMaterials>['inks']) {
  const { tileSize: size, edgeInset: inset, seed } = spec;
  const raster = makeRaster(size, size);
  const distance = (x: number, y: number) => boundaryDistance(mask, x, y, size, inset);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = distance(x, y);
    // All strips sample the same distance to the edge, including concave joins.
    const color = d < inset ? inks.dirt : d === inset ? inks.grassShade : inks.grass;
    put(raster, x, y, color);
  }

  if (spec.surface === 'subtle') {
    const x = 5 + seed % 4, y = 5 + (seed >>> 3) % 4;
    const tuft: Span[] = [[y, x + 1, x + 1], [y + 1, x, x + 2]];
    if (tuft.every(([row, first, last]) => distance(first, row) >= inset + 3 && distance(last, row) >= inset + 3)) {
      cluster(raster, inks.grassLight, tuft);
      put(raster, x + 1, y + 2, inks.grassShade);
    }
    const soil: Span[] = [[y + 2, x + 1, x + 2], [y + 3, x, x + 1]];
    if (soil.every(([row, first, last]) => distance(first, row) < inset && distance(last, row) < inset)) {
      cluster(raster, inks.dirtLight, [soil[0]]);
      cluster(raster, inks.dirtShade, [soil[1]]);
    }
  }
  return raster;
}

export function renderTerrain(input: unknown) {
  const spec = terrainSpecV1.parse(input);
  const { tileSize } = spec;
  const material = terrainMaterials(spec.palette);
  const atlas = makeRaster(atlasColumns * tileSize, atlasRows * tileSize);
  const tiles = [...canonicalMasks, null].map((mask, i) => {
    const raster = renderTile(spec, mask, material.inks);
    const x = (i % atlasColumns) * tileSize, y = Math.floor(i / atlasColumns) * tileSize;
    blit(atlas, raster, x, y);
    return { id: i + 1, mask, x, y, collision: 'empty' as const, raster };
  });
  return { spec, atlas, tiles, material };
}
export type TerrainAtlas = ReturnType<typeof renderTerrain>;

export function renderTileGrid(terrain: TerrainAtlas, ids: readonly (readonly number[])[]): Raster {
  const width = ids[0]?.length ?? 0, size = terrain.spec.tileSize;
  if (!width || ids.some(row => row.length !== width) || width > 128 || ids.length > 128) {
    throw new RangeError('Expected a rectangular tile grid of 1–128 cells per axis.');
  }
  const result = makeRaster(width * size, ids.length * size);
  for (const [y, row] of ids.entries()) for (const [x, id] of row.entries()) {
    if (!Number.isInteger(id) || id < 1 || id > dirtTileId) throw new RangeError('Unknown terrain tile ID.');
    blit(result, terrain.tiles[id - 1].raster, x * size, y * size);
  }
  return result;
}

export function tileIdsForMap(rows: readonly string[]): number[][] {
  if (!rows.length || !rows[0].length || rows.some(row => row.length !== rows[0].length || /[^#.]/u.test(row))) {
    throw new Error('Map needs equal-width rows of grass (#) and dirt (.).');
  }
  const isGrass = (x: number, y: number) => rows[y]?.[x] === '#';
  return rows.map((row, y) => Array.from(row, (_, x) => mapTileId(isGrass, x, y)));
}
