import { createHash } from 'node:crypto';
import { pack } from '../core/palette/colors.ts';
import type { Raster } from '../core/pixels/raster.ts';
import { decodePng } from '../core/renderer/png.ts';
import type { AssetSpecV1 } from '../specs/asset.ts';

export interface FrameMetadata {
  durationMs: number;
  loop: boolean;
}

export type Diagnostic = 'CANVAS' | 'FRAME' | 'ALPHA' | 'TRANSPARENT_RGB' | 'PALETTE' |
  'EMPTY' | 'PROTECTED_PIXELS' | 'PNG_INTEGRITY' | 'DETERMINISM';

export const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

export function validateRaster(raster: Raster, spec: AssetSpecV1, frame: FrameMetadata,
  protection?: { rgba: Buffer; editable: Buffer }): Diagnostic[] {
  const errors = new Set<Diagnostic>();
  const { w, h, rgba } = raster;
  if (w !== spec.canvas.w || h !== spec.canvas.h || rgba.length !== w * h * 4) return ['CANVAS'];

  if (!Number.isInteger(frame.durationMs) || frame.durationMs < 1 || frame.durationMs > 60000 ||
      typeof frame.loop !== 'boolean') errors.add('FRAME');
  const palette = new Set(spec.palette.map(pack));
  let visible = false;
  for (let i = 0; i < rgba.length; i += 4) {
    const ink = rgba.readUInt32BE(i);
    const alpha = rgba[i + 3];
    if (alpha) visible = true;
    if (alpha !== 0 && alpha !== 255) errors.add('ALPHA');
    if (alpha === 0 && ink !== 0) errors.add('TRANSPARENT_RGB');
    if (alpha !== 0 && !palette.has(ink)) errors.add('PALETTE');
    if (protection && protection.editable[i / 4] === 0 && protection.rgba.readUInt32BE(i) !== ink) {
      errors.add('PROTECTED_PIXELS');
    }
  }
  if (!visible) errors.add('EMPTY');
  return [...errors];
}

function equalRaster(a: Raster, b: Raster) {
  return a.w === b.w && a.h === b.h && a.rgba.equals(b.rgba);
}

export function inspectPng(raster: Raster, png: Buffer, rerender: Raster): Diagnostic[] {
  const errors: Diagnostic[] = [];
  try {
    if (!equalRaster(raster, decodePng(png))) errors.push('PNG_INTEGRITY');
  } catch {
    errors.push('PNG_INTEGRITY');
  }
  if (!equalRaster(raster, rerender)) errors.push('DETERMINISM');
  return errors;
}
