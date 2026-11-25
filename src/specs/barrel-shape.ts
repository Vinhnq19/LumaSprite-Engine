import { z } from 'zod';

export const barrelCompositionSchema = z.strictObject({
  width: z.number().int().min(16).max(26),
  rimWidth: z.number().int().min(12).max(23),
  height: z.number().int().min(16).max(25),
  rimDepth: z.number().int().min(4).max(8),
}).superRefine((shape, context) => {
  if (shape.width - shape.rimWidth < 3 || shape.width - shape.rimWidth > 8) context.addIssue({
    code: 'custom', path: ['rimWidth'], message: 'A barrel needs a 3 to 8 pixel bulge.',
  });
  if (shape.height + shape.rimDepth > 30) context.addIssue({
    code: 'custom', path: ['height'], message: 'Leave at least one pixel around the contour.',
  });
});

export type BarrelComposition = z.infer<typeof barrelCompositionSchema>;

export const barrelDesigns = ['barrel-wide', 'barrel-tall'] as const;
export type BarrelDesign = (typeof barrelDesigns)[number];
export const barrelCompositions: Record<BarrelDesign, BarrelComposition> = {
  'barrel-wide': { width: 25, rimWidth: 19, height: 17, rimDepth: 7 },
  'barrel-tall': { width: 19, rimWidth: 15, height: 23, rimDepth: 6 },
};
