import { z } from 'zod';
import { chestColors, mapPalette, pack, unpack } from '../../core/palette/colors.ts';
import { makeRaster, type Raster } from '../../core/pixels/raster.ts';
import { paintSurface, type SurfaceBounds } from '../../core/materials/surface.ts';
import { paletteColorsSchema } from '../../specs/palette.ts';
import { productionProjectPalette } from '../terrain/project-palette.ts';
import type { characterReview } from './export.ts';
import { characterColors } from './geometry.ts';
import { characterRamps, materialPlanes, russetMossRamps, type Surface } from './material-planes.ts';
import { renderCharacter } from './render.ts';
import { alphaPlane, requireShapeLock, type ShapeLock } from './shape-lock.ts';

export const materialStyles = ['m1', 'm2', 'm2p'] as const;
export type MaterialStyle = (typeof materialStyles)[number];
const selection = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('authored') }),
  z.strictObject({ mode: z.literal('project') }),
  z.strictObject({ mode: z.literal('locked'), colors: paletteColorsSchema }),
]);
type Review = ReturnType<typeof characterReview>;

const outlineColor = chestColors.contour;
const authoredPalette = [...new Set([outlineColor, ...Object.values(characterRamps).flatMap(ramp => Object.values(ramp))])];
export const characterProjectPalette = [...new Set([...productionProjectPalette, ...authoredPalette])];
const surfaceLabels = {
  skin: '#eaa48c', hair: '#69425e', cap: '#5c9e96', brim: '#376b71', coat: '#62ac73',
  'far-coat': '#477763', trousers: '#6f87c1', 'far-trousers': '#4c5792',
  leather: '#bd7756', metal: '#9ca7c2', glass: '#f7c65d', contour: '#242032',
} as const;
export const materialMaskLegend = surfaceLabels;

const flatBrim = pack(characterColors.brim), flatFar = pack(characterColors.farCoat), flatGlass = pack(characterColors.lantern);
const flatSeam = pack(characterColors.contour);
function surfaceFor(part: string, ink: number, u: number, v: number): Surface {
  if (part === 'head') return (u < .25 && v < .7) || (u < .48 && v < .33) ? 'hair' : 'skin';
  if (part === 'neck' || part.endsWith('hand')) return 'skin';
  if (part === 'cap' || part === 'hood') return ink === flatBrim ? 'brim' : 'cap';
  if (part === 'lantern') return ink === flatGlass ? 'glass' : 'metal';
  if (part === 'satchel' || part === 'strap' || part.endsWith('boot')) return 'leather';
  if (part === 'hips' || part.endsWith('thigh') || part.endsWith('shin')) {
    return part.startsWith('far-') ? 'far-trousers' : 'trousers';
  }
  return ink === flatFar ? 'far-coat' : 'coat';
}

function boundsFor(pixels: number[], width: number): SurfaceBounds {
  const xs = pixels.map(i => i % width);
  const ys = pixels.map(i => Math.floor(i / width));
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

export function renderCharacterMaterials(review: Review, lock: ShapeLock, style: MaterialStyle, policy: unknown = { mode: 'authored' }) {
  if (!materialStyles.includes(style)) throw new Error('Expected material style m1, m2 or m2p.');
  requireShapeLock(review, lock);
  const choice = selection.parse(policy);
  const surfaceRamps = review.spec.version === 3 && review.spec.outfit.cloth === 'russet-moss'
    ? { ...characterRamps, ...russetMossRamps } : characterRamps;
  const defaultPalette = surfaceRamps === characterRamps ? authoredPalette
    : [...new Set([outlineColor, ...Object.values(surfaceRamps).flatMap(ramp => Object.values(ramp))])];
  const palette = choice.mode === 'locked' ? choice.colors : choice.mode === 'project'
    ? [...new Set([...productionProjectPalette, ...defaultPalette])] : defaultPalette;
  const ramps = Object.fromEntries(Object.entries(surfaceRamps).map(([key, colors]) =>
    [key, mapPalette(colors, palette)])) as Record<Surface, Record<keyof typeof characterRamps.skin, number>>;
  const contour = mapPalette({ outline: outlineColor }, palette).outline;
  const { w, h } = review.flat;
  const directed = style !== 'm1';
  const sourceLayers = review.spec.palette.mode === 'authored' ? review.layers
    : renderCharacter({ ...review.spec, palette: { mode: 'authored' } }).layers;
  const visibleRegions: (Surface | undefined)[] = Array(w * h).fill(undefined);
  const final = makeRaster(w, h), mask = makeRaster(w, h);
  const layers: Record<string, Raster> = {};
  for (const { id } of review.plan.parts) {
    const original = sourceLayers[id];
    const bounds = review.metadata.diagnostics.parts[id];
    const groups = new Map<Surface, number[]>();
    for (let y = bounds.top; y <= bounds.bottom; y++) for (let x = bounds.left; x <= bounds.right; x++) {
      const pixel = y * w + x, ink = original.rgba.readUInt32BE(pixel * 4);
      if (!ink) continue;
      const surface = surfaceFor(id, ink, (x - bounds.left + .5) / (bounds.right - bounds.left + 1),
        (y - bounds.top + .5) / (bounds.bottom - bounds.top + 1));
      if (!groups.has(surface)) groups.set(surface, []);
      groups.get(surface)!.push(pixel);
      visibleRegions[pixel] = surface;
    }
    const layer = makeRaster(w, h);
    for (const [surface, pixels] of groups) {
      const frame = surface === 'glass' ? boundsFor(pixels, w) : bounds;
      const ramp = ramps[surface];
      paintSurface(layer, pixels, frame, ramp.base, ramp, materialPlanes(id, surface, directed, style === 'm2p'));
      for (const pixel of pixels) {
        const offset = pixel * 4;
        if (surface === 'leather' && original.rgba.readUInt32BE(offset) === flatSeam) layer.rgba.writeUInt32BE(ramp.shadow, offset);
        final.rgba.writeUInt32BE(layer.rgba.readUInt32BE(offset), offset);
      }
    }
    if (!alphaPlane(layer).equals(alphaPlane(review.layers[id]))) throw new Error('Material paint escaped the ' + id + ' mask.');
    layers[id] = layer;
  }

  for (let i = 0; i < visibleRegions.length; i++) {
    if (review.silhouette.rgba[i * 4 + 3] === 0) continue;
    const current = visibleRegions[i];
    if (current) {
      mask.rgba.writeUInt32BE(pack(surfaceLabels[current]), i * 4);
      continue;
    }
    const lit = visibleRegions[i + w] || (i % w < w - 1 ? visibleRegions[i + 1] : undefined);
    const lower = visibleRegions[i - w] || (i % w > 0 ? visibleRegions[i - 1] : undefined);
    const tint = directed && lit && !lower && lit !== 'glass' ? ramps[lit].shadow : contour;
    final.rgba.writeUInt32BE(tint, i * 4);
    mask.rgba.writeUInt32BE(pack(surfaceLabels.contour), i * 4);
  }
  if (!alphaPlane(final).equals(alphaPlane(review.silhouette)) || !alphaPlane(mask).equals(alphaPlane(review.silhouette))) {
    throw new Error('Material silhouette alpha changed.');
  }
  const legal = new Set(palette.map(pack));
  const used = new Set<number>();
  const coverage: Record<string, number> = {};
  for (let i = 0; i < visibleRegions.length; i++) {
    const ink = final.rgba.readUInt32BE(i * 4);
    if (!ink) continue;
    if (!legal.has(ink)) throw new Error('Material ink escaped the selected palette.');
    used.add(ink);
    const name = visibleRegions[i] ?? 'contour';
    coverage[name] = (coverage[name] ?? 0) + 1;
  }
  const families = (['skin', 'coat', 'trousers', 'leather', 'metal', 'glass'] as const).filter(role => coverage[role]);
  const warnings: { code: string; regions: string[] }[] = [];
  for (const role of families) {
    const { shadow, base, light } = ramps[role];
    if (new Set([shadow, base, light]).size < 3) warnings.push({ code: 'RAMP_COMPRESSED', regions: [role] });
  }
  for (const [i, role] of families.entries()) for (const next of families.slice(i + 1)) {
    if (ramps[role].base === ramps[next].base) warnings.push({ code: 'BASE_INK_COLLISION', regions: [role, next] });
  }
  return {
    final, mask, layers, usedColors: [...used].map(unpack).sort(), coverage,
    diagnostics: { mode: choice.mode, status: warnings.length ? 'PALETTE_LIMITED' : 'FULL_RAMP', warnings,
      ramps: Object.fromEntries(Object.entries(ramps).map(([key, ramp]) => [key, Object.values(ramp).map(unpack)])) },
  };
}
