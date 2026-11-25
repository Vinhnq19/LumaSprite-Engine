import { inkLuma, pack } from '../core/palette/colors.ts';
import type { Raster } from '../core/pixels/raster.ts';
import { materialMaskLegend } from '../generators/character/materials.ts';

export function measureMaterialReadability(final: Raster, mask: Raster) {
  if (final.w !== mask.w || final.h !== mask.h || final.rgba.length !== mask.rgba.length) {
    throw new Error('Material diagnostic dimensions differ.');
  }
  const areas = Object.fromEntries(Object.entries(materialMaskLegend).map(([name, color]) =>
    [name, { label: pack(color), pixels: 0, sum: 0, lightest: 0 }]));
  const byLabel = new Map(Object.values(areas).map(area => [area.label, area]));
  let brightGlassPixels = 0;
  for (let at = 0; at < final.rgba.length; at += 4) {
    const label = mask.rgba.readUInt32BE(at);
    const area = byLabel.get(label);
    if (!area) continue;
    const ink = final.rgba.readUInt32BE(at), light = inkLuma(ink);
    area.pixels++;
    area.sum += light;
    area.lightest = Math.max(area.lightest, light);
    if (label === areas.glass.label && light >= 170 && (ink >>> 24) - ((ink >>> 8) & 255) >= 45) brightGlassPixels++;
  }
  const mean = (name: keyof typeof materialMaskLegend) => areas[name].pixels ? areas[name].sum / areas[name].pixels : 0;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    coatPlanes: { nearLuma: round(mean('coat')), farLuma: round(mean('far-coat')),
      nearMinusFar: round(mean('coat') - mean('far-coat')) },
    lantern: areas.glass.pixels ? {
      glassPixels: areas.glass.pixels, brightGlassPixels,
      glassLuma: round(mean('glass')), frameLuma: round(mean('metal')),
      glassMinusFrame: round(mean('glass') - mean('metal')),
      frameMinusFarTrousers: round(mean('metal') - mean('far-trousers')),
    } : null,
  };
}
