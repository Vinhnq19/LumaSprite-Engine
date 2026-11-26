import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blit, makeRaster, type Raster } from '../../../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../../../src/core/renderer/png.ts';
import { sha256 } from '../../../src/quality/raster.ts';
import { characterGameScenes } from '../../../scripts/character-scenes.ts';
import type { Point } from '../../../src/core/geometry/shapes.ts';

export const output = 'benchmarks/results/run/art-quality-rnd';
export function save(file: string, bytes: Buffer | string) {
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, file), bytes);
}
export const json = (file: string, data: unknown) => save(file, JSON.stringify(data, null, 2) + '\n');
export const loadPng = (file: string) => decodePng(readFileSync(file));
export const png = (file: string, raster: Raster) => save(file, encodePng(raster));
export const round = (value: number) => Math.round(value * 1000) / 1000;
export const hex = (pixel: number) => '#' + pixel.toString(16).padStart(8, '0').slice(0, 6);

export function inspect(frame: Raster, palette?: readonly string[]) {
  const colors = new Map<string, number>();
  const allowed = palette && new Set(palette);
  assert.deepEqual(decodePng(encodePng(frame)), frame);
  for (let offset = 0; offset < frame.rgba.length; offset += 4) {
    const pixel = frame.rgba.readUInt32BE(offset);
    assert.ok(pixel === 0 || (pixel & 255) === 255, 'Non-binary alpha or hidden RGB');
    if (pixel) {
      const color = hex(pixel);
      assert.ok(!allowed || allowed.has(color), 'Unexpected color ' + color);
      colors.set(color, (colors.get(color) ?? 0) + 1);
    }
  }
  assert.ok(colors.size > 0 && frame.rgba.length === frame.w * frame.h * 4);
  return { area: [...colors.values()].reduce((a, b) => a + b), colors: [...colors].sort(([a], [b]) => a.localeCompare(b)), rgba: sha256(frame.rgba) };
}

export function strip(frames: readonly Raster[]) {
  const { w, h } = frames[0];
  const result = makeRaster(w * frames.length, h);
  frames.forEach((frame, i) => blit(result, frame, i * w, 0));
  return result;
}

export function crop(source: Raster, x: number, y: number, w: number, h: number) {
  const result = makeRaster(w, h);
  assert.ok(x >= 0 && y >= 0 && x + w <= source.w && y + h <= source.h);
  for (let row = 0; row < h; row++) {
    const start = ((row + y) * source.w + x) * 4;
    source.rgba.copy(result.rgba, row * w * 4, start, start + w * 4);
  }
  return result;
}

export async function scenes() {
  const { scenes: all, source } = await characterGameScenes();
  const backgrounds = all.filter(scene => scene.id !== 'gameplay').map(({ id, base, pivot: [x, y] }) => ({
    id, background: crop(base, x - 56, y - 62, 144, 80), pivot: [56, 62] as Point,
  }));
  return { backgrounds, source };
}

export function placed(background: Raster, frame: Raster, pivot: Point, origin: Point, move = 0) {
  const result = { ...background, rgba: Buffer.from(background.rgba) };
  blit(result, frame, pivot[0] - origin[0] + move, pivot[1] - origin[1]);
  return result;
}

export function compareTime<T>(baseline: () => T, candidate: () => T, count: number) {
  const observations = { baseline: [] as number[], candidate: [] as number[] };
  for (let i = -3; i < count; i++) {
    const order = i % 2 === 0 ? ['baseline', 'candidate'] as const : ['candidate', 'baseline'] as const;
    for (const id of order) {
      const start = performance.now();
      (id === 'baseline' ? baseline : candidate)();
      if (i >= 0) observations[id].push(performance.now() - start);
    }
  }
  const median = (samples: number[]) => round(samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)]);
  return { count, baselineMs: median(observations.baseline), candidateMs: median(observations.candidate) };
}

export const visible = (raster: Raster, x: number, y: number) => x >= 0 && y >= 0 && x < raster.w && y < raster.h && raster.rgba[(y * raster.w + x) * 4 + 3] > 0;
export const inkAt = (raster: Raster, px: number, py: number) => raster.rgba.readUInt32BE((py * raster.w + px) * 4);
