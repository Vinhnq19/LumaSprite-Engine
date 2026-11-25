import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { bakeTerrain, verifyBakedTerrain, writeBakedTerrain } from '../generators/terrain/baked.ts';
import { writeTerrainExport } from '../generators/terrain/export.ts';
import { renderTerrain, renderTileGrid, tileIdsForMap } from '../generators/terrain/render.ts';
import { productionTerrainSpec, terrainMapSpec } from '../specs/terrain.ts';
import { checkTerrainJunctions, checkTerrainSeams } from '../quality/terrain.ts';
import { encodePng } from '../core/renderer/png.ts';
import { sha256 } from '../quality/raster.ts';

try {
  const { values } = parseArgs({ options: {
    spec: { type: 'string' }, map: { type: 'string' }, out: { type: 'string' },
    bake: { type: 'boolean' }, verify: { type: 'string' },
  } });
  if (values.verify) {
    if (values.spec || values.map || values.bake || values.out) throw new Error('Use --verify on its own.');
    const verified = await verifyBakedTerrain(values.verify);
    console.log(JSON.stringify({ verified: values.verify, mode: verified.renderMode, pngSha256: verified.image.pngSha256 }));
  } else {
    await generate(values);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function generate(values: { spec?: string | undefined; map?: string | undefined; out?: string | undefined; bake?: boolean | undefined }) {
  const out = values.out ?? 'benchmarks/results/run/e33-terrain';
  const spec: unknown = values.spec ? JSON.parse(await readFile(values.spec, 'utf8')) : productionTerrainSpec;
  const terrain = renderTerrain(spec);
  const seams = checkTerrainSeams(terrain);
  const junctions = checkTerrainJunctions(terrain);
  const map = values.map ? terrainMapSpec.parse(JSON.parse(await readFile(values.map, 'utf8'))) : undefined;
  if (values.bake) {
    if (!map) throw new Error('--bake requires --map.');
    const bundle = bakeTerrain(terrain, map);
    await writeBakedTerrain(out, bundle);
    console.log(JSON.stringify({ out, mode: bundle.manifest.renderMode, pngSha256: bundle.manifest.image.pngSha256,
      palette: bundle.manifest.paletteDiagnostics.status, seams, junctions }));
    return;
  }
  const cells = map && tileIdsForMap(map.rows);
  const mapPng = map && cells && encodePng(renderTileGrid(terrain, cells, map.origin));
  const mapping = await writeTerrainExport(terrain, out);
  if (map && mapPng) {
    await Promise.all([
      writeFile(join(out, 'map.png'), mapPng),
      writeFile(join(out, 'map.json'), JSON.stringify({
        version: 1, spec: terrain.spec, rows: map.rows, origin: map.origin, cells,
        pngSha256: sha256(mapPng),
      }, null, 2) + '\n'),
    ]);
  }
  console.log(JSON.stringify({ out, pngSha256: mapping.pngSha256, masks: mapping.tiles.length - 1,
    seams, junctions, map: mapPng ? 'map.png' : undefined, palette: mapping.diagnostics.status }));
}
