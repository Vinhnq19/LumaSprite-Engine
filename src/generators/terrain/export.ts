import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { encodePng } from '../../core/renderer/png.ts';
import { checkTerrainPixels } from '../../quality/terrain.ts';
import { sha256 } from '../../quality/raster.ts';
import { atlasColumns, atlasRows, terrainBits } from './adjacency.ts';
import type { TerrainAtlas } from './render.ts';

export function terrainExport(terrain: TerrainAtlas, stem = 'atlas') {
  checkTerrainPixels(terrain);
  const { spec, atlas, material, tiles } = terrain;
  const png = encodePng(atlas);
  const mapping = {
    version: 1,
    format: 'pxl-blob47-atlas',
    png: stem + '.png',
    tileSize: spec.tileSize,
    columns: atlasColumns,
    rows: atlasRows,
    width: atlas.w,
    height: atlas.h,
    maskBits: terrainBits,
    pngSha256: sha256(png),
    rgbaSha256: sha256(atlas.rgba),
    spec,
    ...(spec.version !== 1 ? {
      renderPolicy: { atlasPlacement: 'static', mapPlacement: spec.variation, coordinateUnit: 'tile', edgeProfile: spec.version >= 3 ? 'stepped-variants' : 'stepped' },
    } : {}),
    palette: material.palette,
    diagnostics: material.diagnostics,
    tiles: tiles.map(({ id, mask, x, y, collision }) => ({ id, mask, x, y, collision })),
  };
  return { png, mapping };
}

export async function writeTerrainExport(terrain: TerrainAtlas, directory: string, stem = 'atlas') {
  const { png, mapping } = terrainExport(terrain, stem);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, mapping.png), png),
    writeFile(join(directory, stem + '.json'), JSON.stringify(mapping, null, 2) + '\n'),
  ]);
  return mapping;
}
