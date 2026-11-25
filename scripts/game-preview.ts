import { rect } from '../src/core/geometry/faces.ts';
import { fillPolygon } from '../src/core/geometry/shapes.ts';
import { pack } from '../src/core/palette/colors.ts';
import { makeRaster, type Raster } from '../src/core/pixels/raster.ts';

function block(raster: Raster, x: number, y: number, w: number, h: number, hex: string) {
  fillPolygon(raster, rect(x, y, x + w, y + h), pack(hex));
}

export function placeSprite(scene: Raster, asset: Raster, left: number, top: number) {
  if (left < 0 || top < 0 || left + asset.w > scene.w || top + asset.h > scene.h) {
    throw new Error('Sprite lies outside the preview canvas.');
  }
  for (let y = 0; y < asset.h; y++) {
    for (let x = 0; x < asset.w; x++) {
      const offset = (y * asset.w + x) * 4;
      if (!asset.rgba[offset + 3]) continue;
      scene.rgba.writeUInt32BE(asset.rgba.readUInt32BE(offset), ((top + y) * scene.w + left + x) * 4);
    }
  }
}

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
