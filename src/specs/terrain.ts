import { z } from 'zod';
import { paletteSelectionSchema } from './palette.ts';

export const terrainSpecV1 = z.strictObject({
  version: z.literal(1),
  kind: z.literal('grass-dirt'),
  tileSize: z.literal(16),
  seed: z.number().int().min(0).max(0xffffffff),
  palette: paletteSelectionSchema,
  surface: z.enum(['subtle', 'plain']),
  edgeInset: z.number().int().min(2).max(3),
  adjacency: z.literal('pxl-blob47'),
  output: z.literal('png-json'),
});
export type TerrainSpec = z.infer<typeof terrainSpecV1>;

export const defaultTerrainSpec = {
  version: 1, kind: 'grass-dirt', tileSize: 16, seed: 42, palette: { mode: 'authored' },
  surface: 'subtle', edgeInset: 2, adjacency: 'pxl-blob47', output: 'png-json',
} satisfies TerrainSpec;
