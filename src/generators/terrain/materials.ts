import { mapPalette, unpack, inkLuma, pack, nearestInk } from '../../core/palette/colors.ts';
import type { TerrainSpec } from '../../specs/terrain.ts';

const authored = {
  grass: '#68864c',
  grassShade: '#4b6940',
  grassLight: '#7f9858',
  dirt: '#a68061',
  dirtShade: '#936f53',
  dirtLight: '#b58f6f',
} as const;

export function terrainMaterials(selection: TerrainSpec['palette'], production = false) {
  const packed = '#9f795c';
  const palette = selection.mode === 'authored'
    ? [...Object.values(authored), ...(production ? [packed] : [])]
    : selection.colors;
  const inks = mapPalette(authored, palette);
  const grass = [inks.grassShade, inks.grass, inks.grassLight];
  const dirtPacked = production ? nearestInk(packed, palette.map(pack)) : inks.dirtShade;
  const dirt = [inks.dirtShade, ...(production ? [dirtPacked] : []), inks.dirt, inks.dirtLight];
  const gap = Math.abs(inkLuma(inks.grass) - inkLuma(inks.dirt));
  const authoredGap = Math.abs(inkLuma(pack(authored.grass)) - inkLuma(pack(authored.dirt)));
  const warnings: { code: string; material: string }[] = [];
  if (new Set(grass).size < 3) warnings.push({ code: 'GRASS_RAMP_COMPRESSED', material: 'grass' });
  if (new Set(dirt).size < dirt.length) warnings.push({ code: 'DIRT_RAMP_COMPRESSED', material: 'dirt' });
  if (inks.grass === inks.dirt || inks.grassShade === inks.dirtShade) {
    warnings.push({ code: 'GRASS_DIRT_INK_COLLISION', material: 'grass/dirt' });
  }
  if (gap * 2 < authoredGap) warnings.push({ code: 'GRASS_DIRT_CONTRAST_LOSS', material: 'grass/dirt' });
  return {
    inks: { ...inks, dirtPacked }, palette, diagnostics: {
      mode: selection.mode, status: warnings.length ? 'PALETTE_LIMITED' : 'FULL_RAMP',
      warnings, midtoneGap: gap, authoredMidtoneGap: authoredGap,
      ramps: { grass: grass.map(unpack), dirt: dirt.map(unpack) },
    },
  };
}
