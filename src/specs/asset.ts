import { z } from 'zod';
import { compositionSchema, propDesigns } from './prop-shape.ts';
import { barrelCompositionSchema } from './barrel-shape.ts';
import { paletteColorsSchema } from './palette.ts';

export const chestLayers = ['body', 'lid', 'iron', 'lock'] as const;
export const barrelLayers = ['body', 'iron', 'rim'] as const;
export const chestSize = 32;
export const seedSchema = z.number().int().min(0).max(0xffffffff);

export const assetSpecV1 = z.strictObject({
  version: z.literal(1),
  kind: z.literal('prop'),
  name: z.string().trim().min(1).max(100).regex(/^[^\u0000-\u001f\u007f-\u009f]+$/u),
  canvas: z.strictObject({ w: z.literal(chestSize), h: z.literal(chestSize) }),
  seed: seedSchema,
  palette: paletteColorsSchema,
  artDirection: z.strictObject({ light: z.literal('upper-left') }),
  layers: z.union([
    z.tuple([z.literal('body'), z.literal('lid'), z.literal('iron'), z.literal('lock')]),
    z.tuple([z.literal('body'), z.literal('iron'), z.literal('rim')]),
  ]),
  prop: z.discriminatedUnion('design', [
    z.strictObject({ design: z.literal('supply-chest') }),
    z.strictObject({ design: z.enum(propDesigns), composition: compositionSchema, finish: z.enum(['refined', 'e24']).optional() }).superRefine(({ design, composition, finish }, context) => {
      if (finish === 'e24' && design !== 'travel') context.addIssue({
        code: 'custom', path: ['finish'], message: 'E2.4 finish is available for Travel and Barrel.',
      });
      const minimum = design === 'domed' ? 5 : design === 'travel' ? 4 : 3;
      if (composition.lidRise < minimum) context.addIssue({
        code: 'custom', path: ['composition', 'lidRise'], message: 'Lid rise is too low for this profile.',
      });
    }),
    z.strictObject({ design: z.literal('barrel'), composition: barrelCompositionSchema, finish: z.literal('e24').optional() }),
  ]),
}).superRefine(({ prop, layers }, context) => {
  if ((prop.design === 'barrel') !== (layers.length === barrelLayers.length)) context.addIssue({
    code: 'custom', path: ['layers'], message: 'Layers must match the prop design.',
  });
});
export type AssetSpecV1 = z.infer<typeof assetSpecV1>;

export function parseAssetSpec(value: unknown): AssetSpecV1 {
  const result = assetSpecV1.safeParse(value);
  if (result.success) return result.data;
  throw new Error(result.error.issues.map(issue => (issue.path.join('.') || 'AssetSpec') + ': ' + issue.message).join('\n'));
}
