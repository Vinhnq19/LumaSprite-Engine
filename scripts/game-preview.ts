import { rect } from '../src/core/geometry/faces.ts';
import { fillPolygon } from '../src/core/geometry/shapes.ts';
import { pack } from '../src/core/palette/colors.ts';
import { blit, makeRaster, type Raster } from '../src/core/pixels/raster.ts';

function block(raster: Raster, x: number, y: number, w: number, h: number, hex: string) {
  fillPolygon(raster, rect(x, y, x + w, y + h), pack(hex));
}

export const placeSprite = blit;

export function onBackground(asset: Raster, hex: string) {
  const result = makeRaster(asset.w, asset.h);
  block(result, 0, 0, result.w, result.h, hex);
  placeSprite(result, asset, 0, 0);
  return result;
}

export function swatches(colors: readonly string[]) {
  const result = makeRaster(colors.length * 8, 8);
  colors.forEach((color, i) => block(result, i * 8, 0, 8, 8, color));
  return result;
}

export function gamePreview(asset: Raster, crate: Raster) {
  const result = makeRaster(96, 64);
  block(result, 0, 0, 96, 64, '#293333');
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const x = col * 16;
      const y = row * 16;
      const wall = row < 2;
      const color = wall ? '#3e494b' : (row + col) % 2 === 0 ? '#626760' : '#5a615b';
      block(result, x, y, 15, 15, color);
      block(result, x + 1, y + 1, 12, 1, wall ? '#465053' : '#6b6e64');
      block(result, x + 12, y + 4, 2, 7, wall ? '#384344' : '#555d56');
    }
  }
  block(result, 0, 30, 96, 3, '#343f3e');
  block(result, 14, 48, 29, 2, '#484e49');
  block(result, 53, 43, 31, 2, '#484e49');
  placeSprite(result, crate, 11, 20);
  placeSprite(result, asset, 50, 15);
  return result;
}
