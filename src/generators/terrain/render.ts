import { cluster, type Span } from '../../core/geometry/shapes.ts';
import { blit, makeRaster, put, type Raster } from '../../core/pixels/raster.ts';
import { terrainSpecSchema, type TerrainSpecV1, type TerrainSpecV2, type TerrainSpecV3 } from '../../specs/terrain.ts';
import { atlasColumns, atlasRows, canonicalMasks, dirtTileId, mapTileId } from './adjacency.ts';
import { terrainMaterials } from './materials.ts';
import { boundaryDistance, productionBanks } from './edges.ts';
import { coordinateHash, paintMaterialDetails, type TileOrigin } from './detail.ts';

function renderTile(spec: TerrainSpecV1, mask: number | null, inks: ReturnType<typeof terrainMaterials>['inks']) {
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

function renderNaturalTile(
  spec: TerrainSpecV2 | TerrainSpecV3, mask: number | null, inks: ReturnType<typeof terrainMaterials>['inks'], origin: TileOrigin,
) {
  const { tileSize: size, edgeInset: inset } = spec;
  const raster = makeRaster(size, size);
  const profile = spec.version === 3 ? productionBanks(coordinateHash(spec.seed, origin[0], origin[1], 11)) : undefined;
  const distance = (x: number, y: number) => boundaryDistance(mask, x, y, size, inset, true, profile);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = distance(x, y);
    const exposed = d === inset - 1 && d < boundaryDistance(mask, x, y, size, inset);
    const ink = d < inset ? (exposed ? inks.dirtShade : inks.dirt) : d === inset ? inks.grassShade : inks.grass;
    put(raster, x, y, ink);
  }
  paintMaterialDetails(raster, spec, inks, distance, origin);
  return raster;
}

export function renderTerrain(input: unknown) {
  const spec = terrainSpecSchema.parse(input);
  const { tileSize } = spec;
  const material = terrainMaterials(spec.palette, spec.version === 3);
  const atlas = makeRaster(atlasColumns * tileSize, atlasRows * tileSize);
  const tiles = [...canonicalMasks, null].map((mask, i) => {
    const raster = spec.version === 1
      ? renderTile(spec, mask, material.inks)
      : renderNaturalTile(spec, mask, material.inks, [0, 0]);
    const x = (i % atlasColumns) * tileSize, y = Math.floor(i / atlasColumns) * tileSize;
    blit(atlas, raster, x, y);
    return { id: i + 1, mask, x, y, collision: 'empty' as const, raster };
  });
  return { spec, atlas, tiles, material };
}
export type TerrainAtlas = ReturnType<typeof renderTerrain>;

export function renderTileGrid(terrain: TerrainAtlas, ids: readonly (readonly number[])[], origin?: TileOrigin): Raster {
  const width = ids[0]?.length ?? 0, size = terrain.spec.tileSize;
  if (!width || ids.some(row => row.length !== width) || width > 128 || ids.length > 128) {
    throw new RangeError('Expected a rectangular tile grid of 1–128 cells per axis.');
  }
  const result = makeRaster(width * size, ids.length * size);
  for (const [y, row] of ids.entries()) for (const [x, id] of row.entries()) {
    if (!Number.isInteger(id) || id < 1 || id > dirtTileId) throw new RangeError('Unknown terrain tile ID.');
    const tile = terrain.tiles[id - 1];
    const raster = origin && terrain.spec.version !== 1 && terrain.spec.variation === 'world'
      ? renderNaturalTile(terrain.spec, tile.mask, terrain.material.inks, [origin[0] + x, origin[1] + y])
      : tile.raster;
    blit(result, raster, x * size, y * size);
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
