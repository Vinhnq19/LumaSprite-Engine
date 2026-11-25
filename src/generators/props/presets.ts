import { chestColors } from '../../core/palette/colors.ts';
import { chestLayers, chestSize, parseAssetSpec } from '../../specs/asset.ts';
import { propCompositions, type PropDesign } from '../../specs/prop-shape.ts';

export const propNames: Record<PropDesign, string> = {
  compact: 'Compact rectangular supply chest',
  domed: 'Domed-lid fantasy chest',
  travel: 'Reinforced travel chest',
  crate: 'Reinforced wooden crate',
};

export function makePropSpec(design: PropDesign, seed: number, palette: readonly string[] = Object.values(chestColors)) {
  return parseAssetSpec({
    version: 1, kind: 'prop', name: propNames[design], seed, palette,
    canvas: { w: chestSize, h: chestSize },
    artDirection: { light: 'upper-left' }, layers: chestLayers,
    prop: { design, composition: propCompositions[design] },
  });
}
