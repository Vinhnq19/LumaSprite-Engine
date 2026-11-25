import { chestColors, mapPalette } from '../palette/colors.ts';
import type { AssetSpecV1 } from '../../specs/asset.ts';

export function materialRamps(spec: AssetSpecV1) {
  const inks = mapPalette(chestColors, spec.palette);
  return {
    contour: inks.contour,
    wood: { shadow: inks.woodShadow, dark: inks.woodDark, base: inks.wood, light: inks.woodLight, glint: inks.woodGlint },
    iron: { shadow: inks.ironShadow, base: inks.iron, light: inks.ironLight },
    brass: { shadow: inks.brassShadow, base: inks.brass, light: inks.brassLight },
  };
}
