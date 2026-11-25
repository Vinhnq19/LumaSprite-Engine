import { chestColors, nearestInk, pack } from '../palette/colors.ts';
import type { AssetSpecV1 } from '../../specs/asset.ts';

export function materialRamps(spec: AssetSpecV1) {
  const palette = spec.palette.map(pack);
  const color = (role: keyof typeof chestColors) => nearestInk(chestColors[role], palette);
  return {
    contour: color('contour'),
    wood: { shadow: color('woodShadow'), dark: color('woodDark'), base: color('wood'), light: color('woodLight'), glint: color('woodGlint') },
    iron: { shadow: color('ironShadow'), base: color('iron'), light: color('ironLight') },
    brass: { shadow: color('brassShadow'), base: color('brass'), light: color('brassLight') },
  };
}
