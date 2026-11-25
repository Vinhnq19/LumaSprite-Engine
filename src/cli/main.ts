import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { encodePng } from '../core/renderer/png.ts';
import { renderAsset } from '../generators/props/render.ts';
import { makeBarrelSpec, makePropSpec } from '../generators/props/presets.ts';
import { propDesigns, type PropDesign } from '../specs/prop-shape.ts';
import { barrelDesigns } from '../specs/barrel-shape.ts';
import { inspectPng, sha256, validateRaster } from '../quality/raster.ts';

try {
  const { values } = parseArgs({ options: {
    seed: { type: 'string' }, design: { type: 'string' }, spec: { type: 'string' }, out: { type: 'string' },
  } });
  if (values.spec !== undefined && (values.seed !== undefined || values.design !== undefined)) {
    throw new Error('Use --design and --seed for a preset or --spec for a saved spec.');
  }
  if (values.seed !== undefined && !/^\d+$/.test(values.seed)) throw new Error('--seed must be a non-negative integer.');
  const design = values.design ?? 'domed';
  const barrel = barrelDesigns.find(option => option === design);
  if (!barrel && !propDesigns.includes(design as PropDesign)) {
    throw new Error('--design must be ' + [...propDesigns, ...barrelDesigns].join(', ') + '.');
  }
  const seed = Number(values.seed ?? '42');
  const spec: unknown = values.spec === undefined
    ? barrel ? makeBarrelSpec(barrel, seed) : makePropSpec(design as PropDesign, seed, undefined, 'refined')
    : JSON.parse(await readFile(values.spec, 'utf8'));
  const asset = renderAsset(spec);
  const png = encodePng(asset.final);
  const diagnostics = [
    ...validateRaster(asset.final, asset.spec, { durationMs: 100, loop: false }),
    ...inspectPng(asset.final, png, renderAsset(asset.spec).final),
  ];
  if (diagnostics.length) throw new Error(diagnostics.join(', '));
  const out = values.out ?? 'benchmarks/results/run/chest.png';
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, png);
  console.log(JSON.stringify({ out, seed: asset.spec.seed, rgbaSha256: sha256(asset.final.rgba), technical: 'PASS', paletteWarnings: asset.paletteDiagnostics?.codes ?? [] }));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
