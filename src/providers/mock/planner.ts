import { chestColors } from '../../core/palette/colors.ts';
import { chestLayers, chestSize, parseAssetSpec } from '../../specs/asset.ts';
import type { AssetPlanner, PlanInput } from '../planner.ts';

export const supplyChestBrief = 'A compact wooden supply chest with dark iron reinforcements, readable lock, controlled warm lighting and a clear silhouette suitable for a 2D adventure game.';

export function supportsSupplyChest(brief: string) {
  return /\bchest\b|\brương\b/iu.test(brief) &&
    !/\b(treasure|tool|ice|stone|sci-fi) chest\b/iu.test(brief);
}

export const mockPlanner: AssetPlanner = {
  async plan({ brief, seed, palette }: PlanInput) {
    if (!supportsSupplyChest(brief)) throw new Error('This local planner supports the wooden supply chest brief.');
    return parseAssetSpec({
      version: 1,
      kind: 'prop',
      name: 'Fantasy Adventurer Supply Chest',
      canvas: { w: chestSize, h: chestSize },
      seed,
      palette: palette ?? Object.values(chestColors),
      artDirection: { light: 'upper-left' },
      layers: chestLayers,
      prop: { design: 'supply-chest' },
    });
  },
}
