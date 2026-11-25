import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { encodePng } from '../core/renderer/png.ts';
import { renderAsset } from '../generators/props/supply-chest.ts';
import { mockPlanner, supplyChestBrief } from '../providers/mock/planner.ts';
import { inspectPng, sha256, validateRaster } from '../quality/raster.ts';

try {
  const { values } = parseArgs({ options: {
    seed: { type: 'string' }, spec: { type: 'string' }, out: { type: 'string' },
  } });
  if (values.spec !== undefined && values.seed !== undefined) {
    throw new Error('Use --seed for the built-in brief or --spec for a saved spec.');
  }
  if (values.seed !== undefined && !/^\d+$/.test(values.seed)) throw new Error('--seed must be a non-negative integer.');
  const spec: unknown = values.spec === undefined
    ? await mockPlanner.plan({ brief: supplyChestBrief, seed: Number(values.seed ?? '42') })
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
  console.log(JSON.stringify({ out, seed: asset.spec.seed, rgbaSha256: sha256(asset.final.rgba), technical: 'PASS' }));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
