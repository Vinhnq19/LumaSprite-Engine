import { z } from 'zod';

export const chestLayers = ['body', 'lid', 'iron', 'lock'] as const;
export const chestSize = 32;
export const seedSchema = z.number().int().min(0).max(0xffffffff);
export const hexSchema = z.string().regex(/^#[0-9a-f]{6}$/i).transform(hex => hex.toLowerCase());

export const assetSpecV1 = z.strictObject({
  version: z.literal(1),
  kind: z.literal('prop'),
  name: z.string().trim().min(1).max(100).regex(/^[^\u0000-\u001f\u007f-\u009f]+$/u),
  canvas: z.strictObject({ w: z.literal(chestSize), h: z.literal(chestSize) }),
  seed: seedSchema,
  palette: z.array(hexSchema).min(1).max(4096).refine(
    colors => new Set(colors).size === colors.length,
    'Palette colors must be unique.',
  ),
  artDirection: z.strictObject({ light: z.literal('upper-left') }),
  layers: z.tuple([z.literal('body'), z.literal('lid'), z.literal('iron'), z.literal('lock')]),
  prop: z.strictObject({ design: z.literal('supply-chest') }),
});
export type AssetSpecV1 = z.infer<typeof assetSpecV1>;

export function parseAssetSpec(value: unknown): AssetSpecV1 {
  const result = assetSpecV1.safeParse(value);
  if (result.success) return result.data;
  throw new Error(result.error.issues.map(issue => (issue.path.join('.') || 'AssetSpec') + ': ' + issue.message).join('\n'));
}
