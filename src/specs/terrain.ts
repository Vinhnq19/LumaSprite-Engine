import { z } from 'zod';
import { paletteColorsSchema, paletteSelectionSchema } from './palette.ts';

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

export const terrainSpecV2 = terrainSpecV1.extend({
  version: z.literal(2),
  palette: z.discriminatedUnion('mode', [
    z.strictObject({ mode: z.literal('authored') }),
    z.strictObject({ mode: z.enum(['project', 'custom', 'locked']), colors: paletteColorsSchema }),
  ]),
  surface: z.enum(['sparse', 'standard', 'dense']),
  variation: z.enum(['atlas', 'world']),
});

export const terrainSpecSchema = z.discriminatedUnion('version', [terrainSpecV1, terrainSpecV2]);
export type TerrainSpecV1 = z.infer<typeof terrainSpecV1>;
export type TerrainSpecV2 = z.infer<typeof terrainSpecV2>;
export type TerrainSpec = z.infer<typeof terrainSpecSchema>;

export const defaultTerrainSpec = {
  version: 1, kind: 'grass-dirt', tileSize: 16, seed: 42, palette: { mode: 'authored' },
  surface: 'subtle', edgeInset: 2, adjacency: 'pxl-blob47', output: 'png-json',
} satisfies TerrainSpecV1;

export const naturalTerrainSpec = {
  ...defaultTerrainSpec, version: 2, surface: 'standard', variation: 'world',
} satisfies TerrainSpecV2;

export const terrainMapSpec = z.strictObject({
  rows: z.array(z.string().min(1).max(128).regex(/^[#.]+$/)).min(1).max(128),
  origin: z.tuple([z.number().int().min(-1_000_000).max(1_000_000), z.number().int().min(-1_000_000).max(1_000_000)]),
});
