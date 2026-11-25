import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { writeTerrainExport } from '../generators/terrain/export.ts';
import { renderTerrain, renderTileGrid, tileIdsForMap } from '../generators/terrain/render.ts';
import { naturalTerrainSpec, terrainMapSpec } from '../specs/terrain.ts';
import { checkTerrainJunctions, checkTerrainSeams } from '../quality/terrain.ts';
import { encodePng } from '../core/renderer/png.ts';
import { sha256 } from '../quality/raster.ts';

try {
  const { values } = parseArgs({ options: {
    spec: { type: 'string' }, map: { type: 'string' }, out: { type: 'string', default: 'benchmarks/results/run/e32-terrain' },
  } });
  const spec: unknown = values.spec ? JSON.parse(await readFile(values.spec, 'utf8')) : naturalTerrainSpec;
  const terrain = renderTerrain(spec);
  const seams = checkTerrainSeams(terrain);
  const junctions = checkTerrainJunctions(terrain);
  const map = values.map ? terrainMapSpec.parse(JSON.parse(await readFile(values.map, 'utf8'))) : undefined;
  const cells = map && tileIdsForMap(map.rows);
  const mapPng = map && cells && encodePng(renderTileGrid(terrain, cells, map.origin));
  const mapping = await writeTerrainExport(terrain, values.out);
  if (map && mapPng) {
    await Promise.all([
      writeFile(join(values.out, 'map.png'), mapPng),
      writeFile(join(values.out, 'map.json'), JSON.stringify({
        version: 1, spec: terrain.spec, rows: map.rows, origin: map.origin, cells,
        pngSha256: sha256(mapPng),
      }, null, 2) + '\n'),
    ]);
  }
  console.log(JSON.stringify({ out: values.out, pngSha256: mapping.pngSha256, masks: mapping.tiles.length - 1,
    seams, junctions, map: mapPng ? 'map.png' : undefined, palette: mapping.diagnostics.status }));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
