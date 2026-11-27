import assert from 'node:assert/strict';
import { z } from 'zod';
import { chestColors, inkLuma, pack } from '../core/palette/colors.ts';
import type { MaterialDirection } from '../generators/character/materials.ts';
import { artStyleProfileSchema, type StyleProfile } from '../specs/environment.ts';
import { pinnedFile } from './structure-quality/diagnostics.ts';

const ink = z.string().regex(/^#[a-f0-9]{6}$/);
const ramp = z.tuple([ink, ink, ink, ink]).refine(values => values.every((color, i) =>
  i === 0 || inkLuma(pack(color)) > inkLuma(pack(values[i - 1]))), 'Expected a strictly ascending value ramp.');
const profileRef = z.strictObject({
  file: z.literal('benchmarks/fixtures/e61r/style-profile.json'), sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const schema = z.strictObject({
  version: z.literal(1), id: z.literal('weathered-station-v1'), profile: profileRef,
  view: z.literal('three-quarter-right'), keyLight: z.literal('upper-left'),
  stoneAndSlate: z.strictObject({ roof: ramp, metal: ramp, amber: ramp }),
  outline: ink, hierarchy: z.literal('actors-and-devices-first'),
  character: z.strictObject({ coat: ramp, nearHue: z.literal('slate'), farSide: z.literal('one-value-step-lower') }),
  clothAndWood: z.literal('preserve-warm-leather-and-timber'), ground: z.literal('muted-rest-areas'),
  geometry: z.literal('locked-ab'), provenance: z.literal('family-pivots-and-style-v1'),
});
export type ArtDirectionSpec = z.infer<typeof schema>;

export async function loadArtDirection(input: unknown) {
  const spec = schema.parse(input);
  const profile = artStyleProfileSchema.parse(JSON.parse((await pinnedFile(spec.profile)).toString('utf8')));
  assert.equal(profile.view, spec.view);
  assert.equal(profile.keyLight, spec.keyLight);
  return { spec, profile };
}

type Theme = StyleProfile['illumination']['day'];
function tones([shadow, accent, base, light]: readonly string[]) {
  return { shadow, accent, base, light };
}

export function crossAssetStyle(profile: StyleProfile, direction?: ArtDirectionSpec) {
  if (!direction) {
    const device: Theme = { ...profile.illumination.day, contour: chestColors.contour, surfaces: {
      ...profile.illumination.day.surfaces,
      wood: [chestColors.woodShadow, chestColors.woodDark, chestColors.wood, chestColors.woodLight],
      metal: [chestColors.ironShadow, chestColors.iron, chestColors.ironLight, '#a4adbb'],
      amber: [chestColors.woodDark, chestColors.brassShadow, chestColors.brass, chestColors.brassLight],
    } };
    return { profile, device, character: undefined };
  }
  const day: Theme = { ...profile.illumination.day, contour: direction.outline, surfaces: {
    ...profile.illumination.day.surfaces, ...direction.stoneAndSlate,
  } };
  const [low, mid, high] = direction.character.coat;
  const character: MaterialDirection = { outline: direction.outline, ramps: {
    coat: tones(direction.character.coat),
    'far-coat': tones([direction.stoneAndSlate.roof[0], low, mid, high]),
    metal: tones(direction.stoneAndSlate.metal),
    glass: tones(direction.stoneAndSlate.amber),
  } };
  // Night retains B1's separate environmental palette and uses the same sprites as the day comparison.
  return { profile: { ...profile, illumination: { ...profile.illumination, day } }, device: day, character };
}
