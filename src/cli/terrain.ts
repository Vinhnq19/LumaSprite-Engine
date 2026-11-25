import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { writeTerrainExport } from '../generators/terrain/export.ts';
import { renderTerrain } from '../generators/terrain/render.ts';
import { defaultTerrainSpec } from '../specs/terrain.ts';
import { checkTerrainSeams } from '../quality/terrain.ts';

try {
  const { values } = parseArgs({ options: {
    spec: { type: 'string' }, out: { type: 'string', default: 'benchmarks/results/run/e3-terrain' },
  } });
  const spec: unknown = values.spec ? JSON.parse(await readFile(values.spec, 'utf8')) : defaultTerrainSpec;
  const terrain = renderTerrain(spec);
  const seams = checkTerrainSeams(terrain);
  const mapping = await writeTerrainExport(terrain, values.out);
  console.log(JSON.stringify({ out: values.out, pngSha256: mapping.pngSha256, masks: mapping.tiles.length - 1,
    seams, palette: mapping.diagnostics.status }));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
