import { z } from 'zod';
import { riseForDepth } from '../core/geometry/projection.ts';

export const propDesigns = ['compact', 'domed', 'travel', 'crate'] as const;
export type PropDesign = (typeof propDesigns)[number];

export const compositionSchema = z.strictObject({
  frontWidth: z.number().int().min(18).max(24),
  sideDepth: z.number().int().min(4).max(8),
  bodyHeight: z.number().int().min(9).max(13),
  lidRise: z.number().int().min(3).max(8),
  bandSpacing: z.number().int().min(5).max(9),
  lockOffset: z.number().int().min(-2).max(2),
}).superRefine((shape, context) => {
  const check = (invalid: boolean, path: keyof typeof shape, message: string) => {
    if (invalid) context.addIssue({ code: 'custom', path: [path], message });
  };
  check(shape.frontWidth + shape.sideDepth > 28, 'sideDepth', 'Front and side must fit with a clear contour margin.');
  check(shape.bodyHeight + shape.lidRise + riseForDepth(shape.sideDepth) > 22,
    'lidRise', 'The lid must fit above the body with a clear contour margin.');
  check(shape.bandSpacing > Math.floor(shape.frontWidth / 2) - 3,
    'bandSpacing', 'Bands need room inside the front and its corner bevels.');
  check(shape.bandSpacing < 5 + Math.abs(shape.lockOffset),
    'lockOffset', 'Latch must have a visible gap to both bands.');
});

export type PropComposition = z.infer<typeof compositionSchema>;

export const propCompositions: Record<PropDesign, PropComposition> = {
  compact: { frontWidth: 20, sideDepth: 5, bodyHeight: 10, lidRise: 3, bandSpacing: 6, lockOffset: 0 },
  domed: { frontWidth: 19, sideDepth: 8, bodyHeight: 11, lidRise: 7, bandSpacing: 6, lockOffset: 0 },
  travel: { frontWidth: 23, sideDepth: 5, bodyHeight: 12, lidRise: 5, bandSpacing: 8, lockOffset: 1 },
  crate: { frontWidth: 18, sideDepth: 8, bodyHeight: 13, lidRise: 3, bandSpacing: 6, lockOffset: 0 },
};
