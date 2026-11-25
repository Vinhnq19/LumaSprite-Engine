import { pack } from '../core/palette/colors.ts';
import { atlasColumns, atlasRows, mapTileId } from '../generators/terrain/adjacency.ts';
import type { TerrainAtlas } from '../generators/terrain/render.ts';

export function checkTerrainSeams(terrain: TerrainAtlas) {
  const { tileSize: size } = terrain.spec;
  let horizontal = 0, vertical = 0;
  for (let layout = 0; layout < 1 << 12; layout++) {
    const grass = (x: number, y: number) =>
      x >= 0 && x < 4 && y >= 0 && y < 3 && (layout & (1 << (y * 4 + x))) !== 0;
    const east = terrain.tiles[mapTileId(grass, 2, 1) - 1].raster;
    const west = terrain.tiles[mapTileId(grass, 1, 1) - 1].raster;
    const transposed = (x: number, y: number) => grass(y, x);
    const south = terrain.tiles[mapTileId(transposed, 1, 2) - 1].raster;
    const north = terrain.tiles[mapTileId(transposed, 1, 1) - 1].raster;
    for (let i = 0; i < size; i++) {
      if (west.rgba.readUInt32BE((i * size + size - 1) * 4) !== east.rgba.readUInt32BE(i * size * 4)) {
        throw new Error('Horizontal seam mismatch at neighborhood ' + layout + ', pixel ' + i);
      }
      if (north.rgba.readUInt32BE(((size - 1) * size + i) * 4) !== south.rgba.readUInt32BE(i * 4)) {
        throw new Error('Vertical seam mismatch at neighborhood ' + layout + ', pixel ' + i);
      }
    }
    horizontal++;
    vertical++;
  }
  return { horizontal, vertical, matchedBorderPixels: (horizontal + vertical) * size };
}

export function checkTerrainPixels({ atlas, spec, material }: TerrainAtlas) {
  if (atlas.w !== spec.tileSize * atlasColumns || atlas.h !== spec.tileSize * atlasRows ||
      atlas.rgba.length !== atlas.w * atlas.h * 4) throw new Error('Invalid atlas canvas.');
  const allowed = new Set(material.palette.map(pack));
  for (let i = 0; i < atlas.rgba.length; i += 4) {
    if (atlas.rgba[i + 3] !== 255 || !allowed.has(atlas.rgba.readUInt32BE(i))) {
      throw new Error('Atlas has transparent pixels or an ink outside the active palette at index ' + i / 4);
    }
  }
}
