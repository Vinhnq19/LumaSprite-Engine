import assert from 'node:assert/strict';
import { inkLuma, pack } from '../core/palette/colors.ts';
import { composite, makeRaster, type Raster } from '../core/pixels/raster.ts';
import { alphaPlane } from '../generators/character/shape-lock.ts';
import { materialLegend } from '../generators/environment/kit.ts';
import { sha256 } from '../quality/raster.ts';
import type { StyleProfile } from '../specs/environment.ts';
import { clusters, contextContrast, edgeSamples, gap, type Instance } from './context-contrast.ts';
import { contextEvidence, instrumentContext } from './quality-guided-context.ts';
import type { SemanticRaster } from './semantic-instrument.ts';
import { inspectStructure } from './structure-quality/diagnostics.ts';

type Placement = Awaited<ReturnType<typeof instrumentContext>>;
type Theme = StyleProfile['illumination']['day'];
type Label = { color: string; pixels: number };

function instance(art: SemanticRaster, at: readonly [number, number]) {
  const visible = new Set<number>();
  for (let i = 0; i < art.raster.w * art.raster.h; i++) if (art.raster.rgba[i * 4 + 3]) visible.add(i);
  return { raster: art.raster, mask: art.ownership, visible, at, left: at[0] - art.pivot[0], top: at[1] - art.pivot[1],
    contour: pack(materialLegend.contour), signal: pack(materialLegend.amber) } satisfies Instance;
}

function spread(values: number[], threshold: number) {
  values.sort((a, b) => a - b);
  return { samples: values.length, p10: values[Math.floor(values.length / 10)] ?? null,
    median: values[Math.floor(values.length / 2)] ?? null, weak: values.filter(value => value < threshold).length };
}

export function analyzeContext(context: Placement, art: SemanticRaster, semantic: Record<string, Label>, threshold: number,
  count: (stage: 'scene' | 'ownership') => void) {
  const result = contextEvidence(context, art.raster, art.ownership, art.pivot, 'amber', count);
  const object = instance(art, context.placement.at);
  const qa = Object.fromEntries((['day', 'night'] as const).map(light => {
    const ownership = result.qa[light] as { visible: number; coverage: number; anchor: readonly [number, number] };
    assert.equal(ownership.visible, object.visible.size, 'Context QA needs a fully visible instrument.');
    assert.equal(ownership.coverage, ownership.visible);
    const scene = result.views[light];
    const edges = edgeSamples(scene, object);
    const dark = edges.filter(edge => [materialLegend.metal, materialLegend.roof].map(pack).includes(edge.role) && inkLuma(edge.ink) < 90);
    const functions = Object.fromEntries(Object.entries(semantic).map(([name, label]) => [name,
      contextContrast(scene, { ...object, mask: art.labels, signal: pack(label.color) }, threshold).signal]));
    return [light, { ...ownership, darkMaterial: spread(dark.map(edge => gap(edge.ink, edge.neighbor)), threshold), functions }];
  }));
  return { ...result, qa };
}

function outsideHash(raster: Raster, edit: Raster) {
  const bytes: Buffer[] = [];
  for (let i = 0; i < raster.rgba.length; i += 4) if (!edit.rgba[i + 3]) bytes.push(raster.rgba.subarray(i, i + 4));
  return sha256(Buffer.concat(bytes));
}

export function refineRim(art: SemanticRaster, night: Raster, at: readonly [number, number],
  theme: Theme, threshold: number, budget: number) {
  const object = instance(art, at);
  const replacement = pack(theme.surfaces.metal[1]);
  const gains = new Map<number, number>(), matches = new Map<number, ReturnType<typeof edgeSamples>>();
  for (const edge of edgeSamples(night, object)) {
    const x = edge.offset % art.raster.w, y = Math.floor(edge.offset / art.raster.w);
    if (edge.role !== object.contour || y >= 21 || (y >= 10 && x > 18) || edge.contact) continue;
    if (!matches.has(edge.offset)) matches.set(edge.offset, []);
    matches.get(edge.offset)!.push(edge);
  }
  for (const [offset, edges] of matches) {
    const before = edges.map(edge => gap(edge.ink, edge.neighbor));
    const after = edges.map(edge => gap(replacement, edge.neighbor));
    const improvement = Math.min(...after) - Math.min(...before);
    if (Math.min(...before) < threshold && improvement >= 8 && before.every((value, i) => after[i] >= value)) gains.set(offset, improvement);
  }
  const possible = clusters(gains.keys(), art.raster.w).filter(group => group.length >= 4).map(group => group.slice(0, budget));
  const gain = (group: number[]) => group.reduce((score, offset) => score + gains.get(offset)!, 0);
  const selected = possible.sort((a, b) => gain(b) - gain(a))[0] ?? [];
  const edit = makeRaster(32, 32), diff = makeRaster(32, 32), raster = composite([art.raster]);
  for (const offset of selected) {
    assert.ok(art.ownership.rgba.readUInt32BE(offset * 4) === object.contour);
    assert.equal(art.labels.rgba[offset * 4 + 3], 0);
    assert.notEqual(raster.rgba.readUInt32BE(offset * 4), replacement);
    edit.rgba.writeUInt32BE(pack('#ffffff'), offset * 4);
    diff.rgba.writeUInt32BE(pack('#ffbf67'), offset * 4);
    raster.rgba.writeUInt32BE(replacement, offset * 4);
  }
  assert.ok(alphaPlane(art.raster).equals(alphaPlane(raster)));
  const protectedBefore = outsideHash(art.raster, edit), protectedAfter = outsideHash(raster, edit);
  assert.equal(protectedBefore, protectedAfter);
  const palette = new Set([theme.contour, ...theme.surfaces.metal, ...theme.surfaces.roof, ...theme.surfaces.amber].map(pack));
  const qa = inspectStructure(raster, palette, art.ownership).stat;
  const bounds = selected.length ? {
    x: [Math.min(...selected.map(offset => offset % 32)), Math.max(...selected.map(offset => offset % 32))],
    y: [Math.min(...selected.map(offset => Math.floor(offset / 32))), Math.max(...selected.map(offset => Math.floor(offset / 32)))],
  } : null;
  return { raster, edit, diff, qa: { defectId: 'NIGHT-OUTER-RIM', location: bounds,
    rootCause: 'Dark contour and adjacent B1 night ground share low local separation.',
    target: 'Connected, upward or left-facing metal contour on the Night sprite', ink: theme.surfaces.metal[1],
    changed: selected.length, budget, protectedBefore, protectedAfter, protectedPixels: 1024 - selected.length,
    alphaExact: true, used: qa.used, outcome: selected.length ? 'PENDING_HUMAN_REVIEW' : 'NO_MEANINGFUL_VISUAL_GAIN' } };
}
