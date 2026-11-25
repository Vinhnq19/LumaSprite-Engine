import type { diagnosePalette } from '../../core/materials/faces.ts';
import type { Raster } from '../../core/pixels/raster.ts';
import { parseAssetSpec, type AssetSpecV1 } from '../../specs/asset.ts';
import { renderBarrel } from './barrel.ts';
import { renderComposedProp } from './composed-prop.ts';
import { renderSupplyChest } from './supply-chest.ts';

interface RenderedProp {
  spec: AssetSpecV1;
  final: Raster;
  flat: Raster;
  silhouette: Raster;
  paletteDiagnostics?: ReturnType<typeof diagnosePalette>;
}

export function renderAsset(input: unknown): RenderedProp {
  const spec = parseAssetSpec(input);
  if (spec.prop.design === 'barrel') return renderBarrel({ ...spec, prop: spec.prop });
  if (spec.prop.design !== 'supply-chest') return renderComposedProp({ ...spec, prop: spec.prop });
  return renderSupplyChest(spec);
}
