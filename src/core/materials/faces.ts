import { fillFacePatch, type Face } from '../geometry/faces.ts';
import { fillPolygon } from '../geometry/shapes.ts';
import type { Raster } from '../pixels/raster.ts';
import { unpack } from '../palette/colors.ts';
import type { materialRamps } from './ramps.ts';

type Ramps = ReturnType<typeof materialRamps>;
type Lighting = 'top' | 'front' | 'side';

export function woodFace(target: Raster, face: Face, wood: Ramps['wood'], lighting: Lighting, seed: number) {
  const base = lighting === 'top' ? wood.light : lighting === 'front' ? wood.base : wood.dark;
  const upper = lighting === 'top' ? wood.glint : lighting === 'front' ? wood.light : wood.base;
  const lower = lighting === 'top' ? wood.base : lighting === 'front' ? wood.dark : wood.shadow;
  fillPolygon(target, face, base);
  fillFacePatch(target, face, lower, 0, 0.74, 1, 1);
  fillFacePatch(target, face, upper, 0.04, 0, 0.78, 0.18);

  const shift = (seed % 3) / 30;
  // Grain stays in the face's local horizontal axis, including when projected onto the side.
  fillFacePatch(target, face, lower, 0.17 + shift, 0.55, 0.48 + shift, 0.68);
  fillFacePatch(target, face, upper, 0.51 - shift, 0.36, 0.81 - shift, 0.52);
}

export function ironPlate(target: Raster, face: Face, iron: Ramps['iron'], lit: boolean) {
  fillPolygon(target, face, iron.shadow);
  fillFacePatch(target, face, iron.base, 0, 0, 0.65, 0.86);
  if (lit) fillFacePatch(target, face, iron.light, 0, 0.15, 0.65, 0.36);
}

export function diagnosePalette({ wood, iron }: Ramps) {
  const woodRamp = [wood.shadow, wood.dark, wood.base, wood.light, wood.glint];
  const ironRamp = [iron.shadow, iron.base, iron.light];
  const codes: string[] = [];
  if (new Set(woodRamp).size < 4) codes.push('WOOD_RAMP_COMPRESSED');
  if (new Set(ironRamp).size < 3) codes.push('IRON_RAMP_COMPRESSED');
  if (wood.dark === iron.base || wood.base === iron.base || wood.shadow === iron.shadow) codes.push('WOOD_IRON_INK_COLLISION');
  return { codes, wood: woodRamp.map(unpack), iron: ironRamp.map(unpack) };
}
