import { chestColors } from '../../core/palette/colors.ts';
import { barrelLayers, chestLayers, chestSize, parseAssetSpec } from '../../specs/asset.ts';
import { propCompositions, type PropDesign } from '../../specs/prop-shape.ts';
import { barrelCompositions, type BarrelDesign } from '../../specs/barrel-shape.ts';

export const propNames: Record<PropDesign, string> = {
  compact: 'Compact rectangular supply chest',
  domed: 'Domed-lid fantasy chest',
  travel: 'Reinforced travel chest',
  crate: 'Reinforced wooden crate',
};

export function makePropSpec(design: PropDesign, seed: number, palette: readonly string[] = Object.values(chestColors), finish?: 'refined') {
  return parseAssetSpec({
    version: 1, kind: 'prop', name: propNames[design], seed, palette,
    canvas: { w: chestSize, h: chestSize },
    artDirection: { light: 'upper-left' }, layers: chestLayers,
    prop: { design, composition: propCompositions[design], ...(finish && { finish }) },
  });
}

export function makeBarrelSpec(design: BarrelDesign, seed: number, palette: readonly string[] = Object.values(chestColors)) {
  return parseAssetSpec({
    version: 1, kind: 'prop', name: design === 'barrel-wide' ? 'Fantasy wooden barrel · wide' : 'Fantasy wooden barrel · tall', seed, palette,
    canvas: { w: chestSize, h: chestSize },
    artDirection: { light: 'upper-left' }, layers: barrelLayers,
    prop: { design: 'barrel', composition: barrelCompositions[design] },
  });
}
