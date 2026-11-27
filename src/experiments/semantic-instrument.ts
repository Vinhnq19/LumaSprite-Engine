import assert from 'node:assert/strict';
import { z } from 'zod';
import { rect } from '../core/geometry/faces.ts';
import { ellipseSpans, projectBox, riseForDepth } from '../core/geometry/projection.ts';
import { fillPolygon, type Point } from '../core/geometry/shapes.ts';
import { pack } from '../core/palette/colors.ts';
import { makeRaster, type Raster } from '../core/pixels/raster.ts';
import { renderOutlinedLayers } from '../core/renderer/layers.ts';
import { materialLegend, materialPiece } from '../generators/environment/kit.ts';
import { sha256 } from '../quality/raster.ts';
import type { StyleProfile } from '../specs/environment.ts';
import { clusters } from './context-contrast.ts';
import { inspectStructure } from './structure-quality/diagnostics.ts';

const pin = z.strictObject({ file: z.string().regex(/^benchmarks\/fixtures\/[a-z0-9-]+\/[a-z0-9-]+\.json$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const bounded = (min: number, max: number) => z.number().int().min(min).max(max);
export const instrumentBrief = z.strictObject({
  version: z.literal(1), id: z.string().regex(/^[a-z][a-z0-9-]{2,40}$/), name: z.string().min(5).max(60),
  role: z.enum(['development', 'holdout']), kind: z.enum(['collector', 'beacon', 'vane']),
  seed: bounded(0, 65535), canvas: z.literal(32), view: z.literal('three-quarter-right'),
  dimensions: z.strictObject({ height: bounded(20, 23), width: bounded(6, 8), depth: bounded(3, 5) }),
  brief: z.string().min(16).max(200), style: pin, context: pin,
  before: z.strictObject({ brief: pin, candidate: z.enum(['a1', 'a2']) }).nullable(),
  priority: z.array(z.string().min(3)).length(3),
});
export type InstrumentBrief = z.infer<typeof instrumentBrief>;
type Theme = StyleProfile['illumination']['day'];
type Role = 'metal' | 'roof' | 'amber';
type Tone = 0 | 1 | 2 | 3;
const landmarkInks = {
  frame: '#826e83', feet: '#d8ab75', funnel: '#e8bc82', mouth: '#c78ee8', tube: '#65d2dc',
  scale: '#b6f0d5', hood: '#739abd', lens: '#ffd458', lever: '#ef867e',
  shaft: '#699897', tail: '#bdd1bc', bearing: '#b78ff4', pointer: '#f4c66b',
} as const;
type Landmark = keyof typeof landmarkInks;
type Plane = { landmark: Landmark; role: Role; tone: Tone; points: readonly Point[] };
const pivot = [15, 29] as const;

function plan(brief: InstrumentBrief) {
  const { width, depth, height } = brief.dimensions;
  const top = 28 - height, plans: Plane[] = [];
  const add = (landmark: Landmark, role: Role, tone: Tone, points: readonly Point[]) => plans.push({ landmark, role, tone, points });
  const band = (mark: Landmark, role: Role, tone: Tone, left: number, y: number, right: number, bottom: number) =>
    add(mark, role, tone, rect(left, y, right, bottom));
  const oval = (mark: Landmark, role: Role, tone: Tone, center: Point, w: number, h: number) => {
    for (const [y, x, right] of ellipseSpans(center, w, h)) band(mark, role, tone, x, y, right + 1, y + 1);
  };
  const box = (mark: Landmark, role: Role, left: number, y: number, w: number, d: number, bottom: number, taper = 0) => {
    const face = projectBox({ left, top: y, width: w, depth: d, bottom, taper });
    add(mark, role, 0, face.side);
    add(mark, role, 1, face.front);
    add(mark, role, 2, face.top);
  };
  const brace = (mark: Landmark, from: Point, to: Point, w: number) => {
    const [x, y] = from, [u, v] = to, rise = riseForDepth(2);
    add(mark, 'metal', 0, [[x + w, y], [x + w + 2, y - rise], [u + w + 2, v - rise], [u + w, v]]);
    add(mark, 'metal', 1, [from, [x + w, y], [u + w, v], to]);
  };
  let minimum: Partial<Record<Landmark, number>>;
  let window: readonly [number, number, number, number];
  if (brief.kind === 'collector') {
    const cx = 16, glassX = cx - Math.floor(width / 2), neck = top + 6, glassBottom = 24;
    box('feet', 'metal', 4, 25, 6, 3, 28, 1);
    box('feet', 'metal', 21, 25, 6, 3, 28, 1);
    brace('frame', [5, neck + 1], [6, 27], 2);
    box('frame', 'metal', 5, neck, 10, 2, neck + 2);
    brace('frame', [21, neck + 3], [22, 27], 2);
    box('frame', 'metal', 7, 22, 17, 3, 25, 1);
    box('tube', 'roof', glassX, neck, width, depth - 1, glassBottom);
    const liquid = glassBottom - 6 - brief.seed % 2;
    band('tube', 'roof', 2, glassX, liquid, glassX + width, glassBottom - 1);
    band('tube', 'roof', 2, glassX + 1, neck + 1, glassX + 2, liquid);
    for (const [i, y] of [neck + 2, neck + 5, neck + 8].entries()) {
      band('scale', 'roof', 3, glassX + width - (i === 1 ? 3 : 2), y, glassX + width, y + 1);
    }
    box('frame', 'metal', glassX - 1, glassBottom - 1, width + 2, depth - 1, 26, 1);
    box('funnel', 'metal', cx - 2, neck - 2, 4, depth - 1, neck + 1);
    const rim = width + 8;
    add('funnel', 'metal', 1, [[cx - rim / 2, top + 1], [cx + rim / 2, top + 1], [cx + 3, neck - 1], [cx - 3, neck - 1]]);
    add('funnel', 'metal', 0, [[cx + 3, top + 1], [cx + rim / 2, top + 1], [cx + 3, neck - 1], [cx, neck - 1]]);
    oval('funnel', 'metal', 3, [cx, top + 1], rim, 5);
    oval('mouth', 'roof', 0, [cx, top + .5], rim - 4, 2.6);
    minimum = { feet: 12, mouth: 14, tube: 32, scale: 6 };
    window = [8, neck + 2, glassX, 22];
  } else if (brief.kind === 'beacon') {
    const x = 7, y = top + 3, hood = width + 4;
    box('feet', 'metal', 4, 25, 7, 3, 28, 1);
    box('feet', 'metal', 20, 25, 7, 3, 28, 1);
    brace('frame', [11, y + 5], [6, 26], 3);
    brace('frame', [16, y + 5], [22, 26], 3);
    box('shaft', 'metal', 13, y + 4, 4, 3, 21);
    box('lever', 'metal', 16, y + 5, 6, 3, y + 8, 1);
    brace('lever', [23, y + 4], [20, y + 9], 2);
    box('lever', 'metal', 23, y + 3, 3, 2, y + 5);
    band('lever', 'metal', 3, 23, y + 3, 26, y + 4);
    box('hood', 'metal', x, y, hood, depth, y + 7, 1);
    box('hood', 'metal', x - 1, y - 2, hood + 2, depth, y + 1, 1);
    oval('lens', 'amber', 2, [x + hood / 2, y + 3.5], width, 5);
    band('lens', 'amber', 3, x + 3, y + 2, x + 7, y + 4);
    minimum = { feet: 12, hood: 30, lens: 22, lever: 12 };
    window = [10, 20, 21, 25];
  } else {
    const y = top + 4;
    box('feet', 'metal', 9, 24, 13, depth, 28, 2);
    box('shaft', 'metal', 13, y + 4, 4, 3, 25, 1);
    box('shaft', 'metal', 5, y, 20, 2, y + 2);
    box('bearing', 'metal', 12, y - 1, 7, 3, y + 6, 1);
    add('tail', 'metal', 1, [[3, y - 4], [8, y - 4], [11, y], [8, y + 3], [3, y + 3]]);
    add('tail', 'metal', 2, [[3, y - 4], [5, y - 5], [10, y - 5], [11, y], [8, y - 4]]);
    add('pointer', 'amber', 1, [[22, y - 4], [29, y + 1], [22, y + 5]]);
    add('pointer', 'amber', 2, [[22, y - 4], [29, y + 1], [22, y + 1]]);
    minimum = { feet: 10, tail: 20, shaft: 25, bearing: 14, pointer: 20 };
    window = [4, y + 6, 12, 24];
  }
  return { plans, minimum, window };
}

export function semanticInstrument(brief: InstrumentBrief, theme: Theme, paletteBudget: number) {
  const recipe = plan(brief), labels = makeRaster(32, 32);
  for (const { landmark, points } of recipe.plans) fillPolygon(labels, points, pack(landmarkInks[landmark]));
  const assemble = (flat: boolean) => materialPiece(theme)(32, 32, pivot, paint => {
    for (const { role, tone, points } of recipe.plans) paint(role, flat ? 1 : tone, points);
  });
  const shape = assemble(true);
  const outlineInk = pack(theme.contour);
  const flat = renderOutlinedLayers([shape.raster], [shape.raster], outlineInk).final;
  const geom = inspectStructure(flat);
  const bounds = geom.stat.bounds!;
  const landmarks = Object.fromEntries(Object.entries(landmarkInks).flatMap(([role, color]) => {
    const indices: number[] = [];
    for (let i = 0; i < labels.w * labels.h; i++) if (labels.rgba.readUInt32BE(i * 4) === pack(color)) indices.push(i);
    if (!indices.length) return [];
    const x = indices.map(i => i % labels.w), y = indices.map(i => Math.floor(i / labels.w));
    return [[role, { color, pixels: indices.length, box: [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)],
      clusters: clusters(indices, labels.w).map(cluster => cluster.length) }]];
  }));
  const [x0, y0, x1, y1] = recipe.window;
  let gaps = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!geom.mask.rgba[(y * 32 + x) * 4 + 3]) gaps++;
  const contacts = geom.stat.bounds?.bottom === 28 && Array.from({ length: 32 }, (_, x) => x)
    .filter(x => geom.mask.rgba[(28 * 32 + x) * 4 + 3]).length;
  const failures = [
    [geom.stat.components.length === 1, 'connected volume'],
    [bounds.left >= 1 && bounds.right <= 30 && bounds.top >= 1, 'outline margin'],
    [contacts && contacts >= 5, 'ground contact'],
    [gaps >= 5, 'separated negative space'],
    [Object.entries(recipe.minimum).every(([key, min]) => (landmarks[key]?.pixels ?? 0) >= min), 'semantic landmarks'],
  ].filter(([pass]) => !pass).map(([, reason]) => reason);
  const proof = { status: failures.length ? 'SHAPE_GATE_FAIL' : 'PASS', failures, bounds, contacts, gaps, landmarks,
    shapeSha256: sha256(geom.mask.rgba), pivot, contiguity: geom.stat.components };
  const data = { flat, silhouette: geom.mask, labels, proof };
  if (failures.length) return { ...data, final: null, ownership: null, qa: null };
  const art = assemble(false);
  assert.ok(art.material.rgba.equals(shape.material.rgba), 'Material changed landmark ownership.');
  const final = renderOutlinedLayers([art.raster], [shape.raster], outlineInk).final;
  const ownership = renderOutlinedLayers([art.material], [shape.material], pack(materialLegend.contour)).final;
  const palette = new Set([theme.contour, ...theme.surfaces.metal, ...theme.surfaces.roof, ...theme.surfaces.amber].map(pack));
  const qa = inspectStructure(final, palette, ownership);
  assert.ok(qa.mask.rgba.equals(geom.mask.rgba));
  assert.equal(sha256(inspectStructure(ownership).mask.rgba), proof.shapeSha256);
  assert.ok(qa.stat.used.length <= paletteBudget);
  return { ...data, final, ownership, qa: { ...qa.stat, shadeBudget: paletteBudget } };
}

export type SemanticArt = ReturnType<typeof semanticInstrument>;
export type SemanticRaster = { raster: Raster; ownership: Raster; labels: Raster; pivot: readonly [number, number] };
