import assert from 'node:assert/strict';
import { z } from 'zod';
import { rect, type Face } from '../core/geometry/faces.ts';
import { ellipseSpans, projectBox, riseForDepth } from '../core/geometry/projection.ts';
import type { Point } from '../core/geometry/shapes.ts';
import { pack } from '../core/palette/colors.ts';
import { composite, makeRaster, put, type Raster } from '../core/pixels/raster.ts';
import { renderOutlinedLayers } from '../core/renderer/layers.ts';
import { alphaPlane } from '../generators/character/shape-lock.ts';
import { materialLegend, materialPiece } from '../generators/environment/kit.ts';
import { covered } from '../generators/environment/refinement.ts';
import { sha256 } from '../quality/raster.ts';
import { seedSchema } from '../specs/asset.ts';
import type { StyleProfile } from '../specs/environment.ts';
import { inspectStructure } from './structure-quality/diagnostics.ts';

const ref = z.strictObject({
  file: z.string().regex(/^benchmarks\/fixtures\/[a-z0-9-]+\/[a-z0-9-]+\.json$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
const bounded = (min: number, max: number) => z.number().int().min(min).max(max);
export const qualityPropBrief = z.strictObject({
  version: z.literal(1), id: z.string().regex(/^[a-z][a-z0-9-]+$/),
  role: z.enum(['development', 'holdout']), name: z.string().min(5).max(65),
  canvas: z.strictObject({ w: z.literal(32), h: z.literal(32) }),
  view: z.literal('three-quarter-right'), light: z.literal('upper-left'),
  seed: seedSchema.max(65535), function: z.enum(['collector', 'beacon']),
  brief: z.string().min(20).max(180),
  dimensions: z.strictObject({ width: bounded(6, 8), depth: bounded(3, 5), height: bounded(20, 23) }),
  baseline: z.strictObject({
    form: z.enum(['depth-gauge', 'weather-hood']),
    body: z.strictObject({ width: bounded(16, 20), depth: bounded(5, 8), height: bounded(12, 16) }),
  }),
  style: ref, context: ref, refine: z.enum(['a1', 'a2']).nullable(),
});
export type QualityPropBrief = z.infer<typeof qualityPropBrief>;
type Theme = StyleProfile['illumination']['day'];
type Topology = 'a1' | 'a2';
type Role = 'metal' | 'roof' | 'amber';
type Part = { id: string; role: Role; faces: ReturnType<typeof projectBox> };
type Box = readonly [left: number, top: number, right: number, bottom: number];
const pivot = [15, 29] as const;
const white = pack('#ffffff');

function planInstrument(brief: QualityPropBrief, id: Topology) {
  const parts: Part[] = [];
  const { width, depth, height } = brief.dimensions;
  const top = 28 - height;
  const open = id === 'a1';
  const isGauge = brief.function === 'collector';
  const box = (name: string, role: Role, left: number, y: number, w: number, d: number, bottom: number, taper = 0) => {
    parts.push({ id: name, role, faces: projectBox({ left, top: y, width: w, depth: d, bottom, taper }) });
  };
  const strut = (name: string, from: Point, to: Point, w: number, d: number) => {
    const [x, y] = from, [u, v] = to;
    const rise = riseForDepth(d);
    const front: Face = [from, [x + w, y], [u + w, v], to];
    const side: Face = [front[1], [x + w + d, y - rise], [u + w + d, v - rise], front[2]];
    const top: Face = [[x + d, y - rise], [x + w + d, y - rise], front[1], from];
    parts.push({ id: name, role: 'metal', faces: { front, side, top } });
  };
  let window: Box;
  let aperture: { center: Point; width: number; height: number };
  let voidRegion: Box;
  if (isGauge) {
    const x = open ? 13 : 7;
    const neck = top + 4;
    const floor = 24;
    if (open) {
      box('left-foot', 'metal', 4, 25, 6, 3, 28, 1);
      box('right-foot', 'metal', 21, 25, 5, 3, 28, 1);
      box('support-rail', 'metal', 5, neck + 1, 19, 3, neck + 3);
      strut('left-upright', [5, neck + 1], [5, 27], 2, 2);
      strut('right-upright', [22, neck + 2], [22, 27], 2, 2);
      box('lower-cradle', 'metal', 7, floor - 1, 16, 3, floor + 2);
      voidRegion = [8, neck + 4, x, floor - 2];
    } else {
      box('cantilever-base', 'metal', 7, 25, 17, 4, 28, 2);
      strut('side-column', [22, neck], [20, 26], 3, 3);
      box('upper-cantilever', 'metal', x + 2, neck, 17, 3, neck + 3);
      box('lower-cantilever', 'metal', x, floor - 1, 14, 3, floor + 2);
      voidRegion = [x + width + depth, neck + 4, 22, floor - 2];
    }
    box('glass-chamber', 'roof', x, neck, width, depth - 1, floor);
    box('drain-collar', 'metal', x - 1, floor - 1, width + 2, depth - 1, floor + 2, 1);
    box('tapered-funnel', 'metal', x - 2, top + 1, width + 4, depth + 1, neck + 1, 2);
    const funnelDepth = depth + 1;
    aperture = { center: [x + width / 2 + Math.floor(funnelDepth / 2), top + 1 - 1], width: width - 1, height: 1.3 };
    window = [x, neck + 2, x + width, floor - 3];
  } else {
    const headX = open ? 8 : 10;
    const headY = top + 3;
    const headW = width + 4;
    if (open) {
      box('pedestal-shoe', 'metal', 7, 24, 16, 4, 28, 2);
      box('mast', 'metal', 13, headY + 5, 4, 4, 25);
      strut('toggle-lever', [19, 16], [17, 21], 2, 2);
      box('lever-knob', 'metal', 18, 16, 4, 2, 18);
      voidRegion = [8, headY + 7, 13, 24];
    } else {
      box('port-foot', 'metal', 5, 25, 6, 3, 28, 1);
      box('starboard-foot', 'metal', 20, 25, 6, 3, 28, 1);
      strut('port-brace', [12, headY + 5], [7, 27], 3, 2);
      strut('starboard-brace', [17, headY + 4], [21, 27], 3, 2);
      box('hinge-block', 'metal', 14, headY + 8, 5, 2, headY + 11);
      voidRegion = [11, headY + 9, 21, 25];
    }
    box('signal-housing', 'metal', headX, headY, headW, depth, headY + 7, 1);
    box('lamp-visor', 'metal', headX - 1, headY - 2, headW + 2, depth, headY + 1, 1);
    aperture = { center: [headX + headW / 2, headY + 3.5], width, height: 4.5 };
    window = [headX + 2, headY + 1, headX + headW - 2, headY + 6];
  }
  return { parts, aperture, window, voidRegion, isGauge, level: 4 + brief.seed % 3, pivot };
}

type Plan = ReturnType<typeof planInstrument>;
function renderPlan(plan: Plan, theme: Theme, finish: 'flat' | 'material' | 'focused') {
  const flat = finish === 'flat';
  const [left, top, right, bottom] = plan.window;
  const level = bottom - plan.level;
  const piece = materialPiece(theme)(32, 32, plan.pivot, (paint, patch) => {
    for (const { faces, role } of plan.parts) {
      paint(role, 0, faces.side);
      paint(role, 1, faces.front);
      paint(role, 2, faces.top);
      if (!flat && role === 'metal') patch(role, 3, faces.top, .08, 0, .77, .28);
    }
    if (plan.isGauge) {
      if (flat) return;
      for (const [y, x, max] of ellipseSpans(plan.aperture.center, plan.aperture.width, plan.aperture.height)) {
        paint('metal', 0, rect(x, y, max + 1, y + 1));
      }
      paint('roof', finish === 'focused' ? 1 : 2, rect(left, level + 1, right, bottom));
      paint('roof', 2, rect(left, level, right - 2, level + 1));
      paint('roof', 2, rect(left + 1, top, left + 2, level));
      for (let y = top + 1, i = 0; y < bottom; y += 3, i++) {
        paint('roof', 3, rect(right - (i % 2 ? 2 : 3), y, right, y + 1));
      }
    } else {
      const { center, width, height } = plan.aperture;
      for (const [y, x, max] of ellipseSpans(center, width, height)) {
        paint('amber', 2, rect(x, y, max + 1, y + 1));
      }
      if (!flat) {
        const x = Math.ceil(center[0]);
        const y = Math.floor(center[1]);
        paint('amber', 3, rect(x - 2, y - 1, x + 1, y + 1));
      }
    }
  });
  const raster = renderOutlinedLayers([piece.raster], [piece.raster], pack(theme.contour)).final;
  const material = renderOutlinedLayers([piece.material], [piece.material], pack(materialLegend.contour)).final;
  return { raster, material };
}

function countRegion(raster: Raster, area: Box, accepts: (ink: number) => boolean) {
  let count = 0;
  for (let y = area[1]; y < area[3]; y++) for (let x = area[0]; x < area[2]; x++) {
    if (accepts(raster.rgba.readUInt32BE((y * raster.w + x) * 4))) count++;
  }
  return count;
}

export function createInstrumentShape(brief: QualityPropBrief, id: Topology, theme: Theme) {
  const plan = planInstrument(brief, id);
  const result = renderPlan(plan, theme, 'flat');
  const { stat, mask } = inspectStructure(result.raster);
  const bounds = stat.bounds!;
  const negative = countRegion(mask, plan.voidRegion, ink => ink === 0);
  const functional = countRegion(result.material, plan.window, ink => ink === pack(plan.isGauge ? materialLegend.roof : materialLegend.amber));
  const [a, b, c, d] = plan.window;
  const contact = countRegion(mask, [bounds.left, bounds.bottom, bounds.right + 1, bounds.bottom + 1], ink => ink !== 0);
  const wire = plan.parts.filter(part => part.id.includes('upright') || part.id.includes('brace') || part.id.includes('column') || part.id === 'mast');
  const projectedDepth = Math.max(...plan.parts.map(part => part.faces.top[1][0] - part.faces.front[1][0]));
  const failures = [
    [stat.components.length === 1, 'connected-volume'],
    [bounds.left >= 1 && bounds.right <= 30 && bounds.top >= 1, 'contour-margin'],
    [bounds.bottom === pivot[1] - 1 && contact >= 5, 'ground-contact'],
    [bounds.bottom - bounds.top >= 19 && bounds.right - bounds.left >= 15, 'design-proportions'],
    [negative >= 5, 'negative-space'],
    [functional >= 12 && c - a >= 5 && d - b >= 4 && wire.length > 0, 'functional-landmarks'],
    [projectedDepth >= 3 && stat.isolatedOutline === 0 && stat.outline / stat.coverage <= .65, 'projected-depth-and-outline'],
  ].filter(([pass]) => !pass).map(([, reason]) => reason);
  return { plan, flat: result.raster, flatMaterial: result.material, mask,
    qa: { status: failures.length ? 'SHAPE_GATE_FAIL' : 'PASS', failures, functional, negative, contact, projectedDepth,
      window: plan.window, voidRegion: plan.voidRegion, aperture: plan.aperture,
      geometrySha256: sha256(mask.rgba), pivot, stat } };
}

export function finishInstrument(shape: ReturnType<typeof createInstrumentShape>, theme: Theme, finish: 'material' | 'focused') {
  assert.equal(shape.qa.status, 'PASS', 'Material requires a passing geometry gate.');
  const result = renderPlan(shape.plan, theme, finish);
  assert.ok(alphaPlane(result.raster).equals(alphaPlane(shape.mask)), 'Material changed geometry.');
  assert.ok(result.material.rgba.equals(shape.flatMaterial.rgba), 'Material changed ownership.');
  const palette = new Set([...Object.values(theme.surfaces).flat(), theme.contour].map(pack));
  const stat = inspectStructure(result.raster, palette, result.material).stat;
  assert.ok(stat.used.length <= 13, 'Instrument exceeded palette budget.');
  return { ...result, stat, palette };
}

function protectedHash(raster: Raster, edit: Raster) {
  const bytes = Buffer.alloc(raster.rgba.length);
  let out = 0;
  for (let i = 0; i < raster.rgba.length; i += 4) if (!edit.rgba[i + 3]) {
    raster.rgba.copy(bytes, out, i, i + 4);
    out += 4;
  }
  return sha256(bytes.subarray(0, out));
}

export function refineMeniscus(before: ReturnType<typeof finishInstrument>, plan: Plan, theme: Theme, pixelBudget: number) {
  assert.ok(plan.isGauge);
  const [left, , right, bottom] = plan.window, y = bottom - plan.level;
  const edit = makeRaster(32, 32), diff = makeRaster(32, 32), after = composite([before.raster]);
  const [glassMid, gloss] = theme.surfaces.roof.slice(2).map(pack);
  let changed = 0;
  for (let x = left + 1; x < right - 3; x++) {
    assert.ok(covered(before.material, x, y));
    const offset = (y * after.w + x) * 4;
    assert.equal(before.material.rgba.readUInt32BE(offset), pack(materialLegend.roof));
    assert.equal(before.raster.rgba.readUInt32BE(offset), glassMid);
    put(edit, x, y, white);
    put(after, x, y, gloss);
    put(diff, x, y, pack('#ffb950'));
    changed++;
  }
  assert.ok(changed >= 2 && changed <= pixelBudget, 'Local edit exceeded its contiguous highlight budget.');
  const start = protectedHash(before.raster, edit), end = protectedHash(after, edit);
  assert.equal(start, end, 'Pixel outside local mask changed.');
  assert.ok(alphaPlane(before.raster).equals(alphaPlane(after)));
  const stat = inspectStructure(after, before.palette, before.material).stat;
  assert.ok(stat.used.length <= 13);
  return { raster: after, edit, diff, qa: { changed, protectedBefore: start, protectedAfter: end,
    editablePixels: changed, budget: pixelBudget, scope: 'glass-meniscus', used: stat.used } };
}
