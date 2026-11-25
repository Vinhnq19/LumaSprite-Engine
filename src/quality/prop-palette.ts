import type { diagnosePalette } from '../core/materials/faces.ts';
import { chestColors, inkLuma, pack } from '../core/palette/colors.ts';

type RampMapping = ReturnType<typeof diagnosePalette>;

const midtoneGap = (wood: string, iron: string) => Math.abs(inkLuma(pack(wood)) - inkLuma(pack(iron)));
const authoredMidtoneGap = midtoneGap(chestColors.wood, chestColors.iron);

export function assessPropPalette(mapping: RampMapping) {
  const gap = midtoneGap(mapping.wood[2], mapping.iron[1]);
  const warnings = mapping.codes.map(code => ({
    code,
    material: code === 'WOOD_RAMP_COMPRESSED' ? 'wood' : code === 'IRON_RAMP_COMPRESSED' ? 'iron' : 'wood/iron',
  }));
  // This compares representative midtones on a 0–255 scale. It is a review cue for sprites.
  if (gap * 2 < authoredMidtoneGap) warnings.push({ code: 'WOOD_IRON_CONTRAST_LOSS', material: 'wood/iron' });
  return {
    status: warnings.length ? 'PALETTE_LIMITED' : 'FULL_RAMP',
    warnings,
    metrics: {
      woodDistinct: new Set(mapping.wood).size,
      ironDistinct: new Set(mapping.iron).size,
      woodIronMidtoneGap: gap,
      authoredWoodIronMidtoneGap: authoredMidtoneGap,
    },
    ramps: { wood: mapping.wood, iron: mapping.iron },
  };
}
