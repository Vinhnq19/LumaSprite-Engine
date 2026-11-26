import { z } from 'zod';
import { terrainMapSpec } from './terrain.ts';

const coordinate = z.number().int().min(0).max(512);
const point = z.tuple([coordinate, coordinate]);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const ink = z.string().regex(/^#[0-9a-f]{6}$/);
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const terrainPath = z.string().regex(/^benchmarks\/results\/(?:[a-z0-9-]+\/)+map\.json$/);
const assetPath = z.string().regex(/^benchmarks\/results\/(?:[a-z0-9-]+\/)+[a-z0-9-]+\.png$/);
export const surfaceNames = ['stone', 'wood', 'roof', 'paving', 'metal', 'amber'] as const;
const ramp = z.tuple([ink, ink, ink, ink]);
const illumination = z.strictObject({
  surfaces: z.record(z.enum(surfaceNames), ramp),
  grass: z.tuple([ink, ink, ink]), dirt: ramp,
  contour: ink,
});
export const artStyleProfileSchema = z.strictObject({
  version: z.literal(1), view: z.literal('three-quarter-right'), tilePx: z.literal(16),
  pixelsPerUnit: z.literal(32), actorCanvasPx: z.literal(64), keyLight: z.literal('upper-left'),
  cast: z.tuple([z.number().int().min(1).max(8), z.number().int().min(1).max(5)]),
  detailSpan: z.number().int().min(4).max(9), minMaterialLumaGap: z.number().int().min(1).max(24),
  illumination: z.strictObject({ day: illumination, night: illumination }),
});

const pngRef = z.strictObject({
  id, kind: z.enum(['actor','prop']), file: assetPath, sha256: digest, provenance: z.string().min(1).max(100),
  pivot: point, footprint: point, scaleManifestSha256: digest.optional(),
});
const bay = z.enum(['wall','window','door']);
const common = z.strictObject({
  kind: z.literal('field-outpost'), name: z.string().min(1).max(64),
  seed: z.number().int().min(0).max(0xffffffff),
  style: z.strictObject({
    file: z.string().regex(/^benchmarks\/fixtures\/(?:[a-z0-9-]+\/)+[a-z0-9-]+\.json$/), sha256: digest,
  }),
  terrain: z.strictObject({ manifest: terrainPath, sha256: digest, provenance: z.string().min(1).max(100), map: terrainMapSpec }),
  building: z.strictObject({
    at: point, bays: z.array(bay).min(5).max(9), signBay: z.number().int().min(0).max(8),
  }),
  path: z.array(point).min(4).max(14),
  assetRefs: z.array(pngRef).min(1).max(12),
  placements: z.array(z.strictObject({ id, ref: id, at: point })).min(1).max(20),
});
const architecture = z.strictObject({
  wallHeight: z.number().int().min(52).max(72),
  doorHeight: z.number().int().min(48).max(66),
  jamb: z.number().int().min(2).max(5),
  terrainRest: z.array(z.array(point).min(4).max(10)).min(1).max(4),
});
export type EnvironmentArchitecture = z.infer<typeof architecture>;
export const environmentSpecSchema = z.discriminatedUnion('version', [
  z.strictObject({ version: z.literal(1), ...common.shape }),
  z.strictObject({ version: z.literal(2), ...common.shape, architecture }),
]).superRefine((spec, ctx) => {
  const error = (message: string, path: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  const { bays, signBay } = spec.building;
  const entrance = bays.indexOf('door');
  if (entrance <= 0 || entrance >= bays.length - 1 || bays.lastIndexOf('door') !== entrance) {
    error('The front requires one interior door.', 'building');
  }
  if (bays[signBay] !== 'wall') error('The station sign attaches to a solid wall bay.', 'building');
  if (new Set(spec.assetRefs.map(x => x.id)).size !== spec.assetRefs.length ||
      new Set(spec.placements.map(x => x.id)).size !== spec.placements.length) error('Asset and placement IDs must be unique.', 'placements');
  if (spec.placements.some(x => x.ref !== 'workbench' && !spec.assetRefs.some(asset => asset.id === x.ref)) ||
      spec.assetRefs.some(asset => asset.id === 'workbench' || (asset.kind === 'prop' ? asset.footprint.includes(0) : asset.footprint.some(Boolean)))) {
    error('Placements require known references and actor/prop collision dimensions.', 'placements');
  }
  if (spec.version === 2) {
    const { wallHeight, doorHeight } = spec.architecture;
    if (wallHeight - doorHeight < 8) error('The entrance needs an eight-pixel lintel.', 'architecture');
    if (spec.assetRefs.some(ref => ref.kind === 'actor' && !ref.scaleManifestSha256)) {
      error('Revised architecture requires pinned actor scale evidence.', 'assetRefs');
    }
  } else if (spec.assetRefs.some(ref => ref.scaleManifestSha256)) {
    error('Scale references require version 2.', 'assetRefs');
  }
  const { rows } = spec.terrain.map;
  if (rows.length < 10 || rows.length > 24 || rows[0].length < 14 || rows[0].length > 32 ||
      rows.some(row => row.length !== rows[0].length)) error('The scene needs a bounded rectangular tile map.', 'terrain');
});
export type EnvironmentSpec = z.infer<typeof environmentSpecSchema>;
export type StyleProfile = z.infer<typeof artStyleProfileSchema>;
export type EnvironmentLight = keyof StyleProfile['illumination'];
export type EnvironmentFinish = 'A' | 'B';
