import pngjs from 'pngjs';
import type { Raster } from '../pixels/raster.ts';

export function encodePng(raster: Raster): Buffer {
  const image = new pngjs.PNG({ width: raster.w, height: raster.h });
  image.data = raster.rgba;
  return pngjs.PNG.sync.write(image, { colorType: 6 });
}

export function decodePng(bytes: Buffer): Raster {
  const { width: w, height: h, data: rgba } = pngjs.PNG.sync.read(bytes);
  return { w, h, rgba };
}
