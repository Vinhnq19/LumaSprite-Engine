import { z } from 'zod';
import { paletteSelectionSchema } from './palette.ts';

const size = (min: number, max: number) => z.number().int().min(min).max(max);
const extent = (minW: number, maxW: number, minH: number, maxH: number) =>
  z.tuple([size(minW, maxW), size(minH, maxH)]);
const point = extent(2, 61, 2, 61);
const limbPose = z.strictObject({ elbow: point, wrist: point, palm: point, knee: point, ankle: point });

export const characterSpecSchema = z.strictObject({
  version: z.literal(1),
  kind: z.literal('humanoid-surveyor'),
  name: z.string().trim().min(1).max(80),
  canvas: z.strictObject({ w: z.literal(64), h: z.literal(64), background: z.literal('transparent') }),
  view: z.literal('three-quarter-right'),
  seed: size(0, 0xffffffff),
  palette: paletteSelectionSchema,
  proportions: z.strictObject({
    head: extent(12, 20, 12, 18),
    jacket: extent(12, 23, 11, 20),
    hips: size(9, 17),
    arm: extent(4, 8, 3, 6),
    leg: extent(5, 10, 4, 8),
    boot: extent(8, 13, 3, 5),
    satchel: extent(7, 13, 8, 16),
    lantern: extent(6, 10, 7, 12),
  }),
  pose: z.strictObject({
    kind: z.literal('standing-hold'),
    hip: point,
    lean: size(-4, 4),
    pivot: point,
    support: z.enum(['near', 'far']),
    near: limbPose,
    far: limbPose,
  }),
});

export type CharacterSpec = z.infer<typeof characterSpecSchema>;
