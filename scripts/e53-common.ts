import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';

export const output = 'benchmarks/results/run/e53';
export const rnd = 'benchmarks/results/run/e53-checks/rnd-checkpoint/benchmarks/results/run/art-quality-rnd';
export const surveyorSource = 'benchmarks/results/e44/packages/r2';
export const courierSource = 'benchmarks/results/e44/packages/courier-rev';

export function save(name: string, data: Buffer | string) {
  const file = join(output, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
}
export const json = (name: string, data: unknown) => save(name, JSON.stringify(data, null, 2) + '\n');
export const png = (name: string, raster: Raster) => save(name + '.png', encodePng(raster));
export const readJson = <T = unknown>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
