import { z } from 'zod';

export const hexSchema = z.string().regex(/^#[0-9a-f]{6}$/i).transform(hex => hex.toLowerCase());
export const paletteColorsSchema = z.array(hexSchema).min(1).max(4096).refine(
  colors => new Set(colors).size === colors.length,
  'Palette colors must be unique.',
);

export const paletteSelectionSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('authored') }),
  z.strictObject({ mode: z.enum(['custom', 'locked']), colors: paletteColorsSchema }),
]);
