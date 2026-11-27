import assert from 'node:assert/strict';
import { z } from 'zod';
import { pack } from '../core/palette/colors.ts';
import { composite, type Raster } from '../core/pixels/raster.ts';
import { materialLegend } from '../generators/environment/kit.ts';
import { covered } from '../generators/environment/refinement.ts';
import type { StyleProfile } from '../specs/environment.ts';
import { clusters, edgeSamples, gap, type Instance } from './context-contrast.ts';

const protectedRole = z.enum(['coat', 'far-coat']);
export const semanticDirectionSchema = z.strictObject({
  version: z.literal(1),
  base: z.strictObject({ file: z.literal('benchmarks/fixtures/e73/art-direction-v1.json'), sha256: z.string().regex(/^[0-9a-f]{64}$/) }),
  protectByBrief: z.record(z.string().regex(/^[a-z][a-z0-9-]{0,35}$/), z.array(protectedRole).max(2).refine(
    roles => roles.length === new Set(roles).size, 'Duplicate protected role.',
  )),
  functional: z.literal('keep-baseline-amber'),
  material: z.literal('lift-wood-foot-shadow-one-step'),
  shared: z.literal('inherit-b1-day'),
  night: z.strictObject({
    weakGap: z.number().int().min(8).max(24), minCluster: z.number().int().min(3).max(6),
    budgetPercent: z.number().int().min(5).max(25),
  }),
  structure: z.literal('locked'),
});
export type SemanticDirection = z.infer<typeof semanticDirectionSchema>;

export function liftFootShadow(sprite: Raster, mask: Raster, wood: StyleProfile['illumination']['day']['surfaces']['wood'], pivotY: number) {
  const [shadow, secondary] = wood.map(pack);
  const contour = pack(materialLegend.contour), timber = pack(materialLegend.wood);
  const selected: number[] = [];
  for (let y = pivotY - 6; y < pivotY; y++) for (let x = 0; x < sprite.w; x++) {
    const offset = (y * sprite.w + x) * 4;
    if (mask.rgba.readUInt32BE(offset) !== timber || sprite.rgba.readUInt32BE(offset) !== shadow) continue;
    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    if (neighbors.some(([u, v]) => covered(mask, u, v) && mask.rgba.readUInt32BE((v * mask.w + u) * 4) === contour)) {
      selected.push(offset / 4);
    }
  }
  const raster = composite([sprite]);
  const runs = clusters(selected, sprite.w).filter(run => run.length >= 2);
  for (const run of runs) for (const at of run) raster.rgba.writeUInt32BE(secondary, at * 4);
  return { raster, runs: runs.map(run => run.length) };
}

export function paintNightOutline(scene: Raster, object: Instance, night: StyleProfile['illumination']['night'], rules: SemanticDirection['night']) {
  const edge = edgeSamples(scene, object).filter(sample => sample.role === object.contour);
  const byPixel = new Map<number, typeof edge>();
  for (const sample of edge) {
    if (!byPixel.has(sample.offset)) byPixel.set(sample.offset, []);
    byPixel.get(sample.offset)!.push(sample);
  }
  const budget = Math.floor(byPixel.size * rules.budgetPercent / 100);
  // Night inks come from B1. One connected edge run keeps the silhouette from acquiring a halo.
  const candidates = [night.contour, night.surfaces.roof[0], night.surfaces.roof[1], night.surfaces.metal[0]].map(pack);
  let winner: { ink: number; px: number[]; gain: number } | undefined;
  for (const ink of new Set(candidates)) {
    const gainByPixel = new Map<number, number>();
    for (const [pixel, samples] of byPixel) {
      if (samples.some(sample => sample.contact)) continue;
      const before = samples.map(sample => gap(sample.ink, sample.neighbor));
      const after = samples.map(sample => gap(ink, sample.neighbor));
      const weakGain = Math.min(...after) - Math.min(...before);
      if (Math.min(...before) < rules.weakGap && weakGain >= 4 && after.every((value, i) => value >= before[i] - 2)) {
        gainByPixel.set(pixel, weakGain);
      }
    }
    for (const run of clusters(gainByPixel.keys(), object.raster.w)) {
      if (run.length < rules.minCluster || run.length > budget) continue;
      const gain = run.reduce((sum, pixel) => sum + gainByPixel.get(pixel)!, 0);
      if (!winner || gain > winner.gain) winner = { ink, px: run, gain };
    }
  }
  const raster = composite([object.raster]);
  if (winner) {
    assert.ok(winner.px.length <= budget);
    for (const at of winner.px) raster.rgba.writeUInt32BE(winner.ink, at * 4);
  }
  return { raster, budget, pixels: winner?.px.length ?? 0, ink: winner?.ink ?? null };
}
