export interface Raster {
  w: number;
  h: number;
  rgba: Buffer;
}

export const makeRaster = (w: number, h: number): Raster => ({ w, h, rgba: Buffer.alloc(w * h * 4) });

export function put(raster: Raster, x: number, y: number, ink: number) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= raster.w || y < 0 || y >= raster.h) {
    throw new RangeError('Pixel outside layer: (' + x + ', ' + y + ')');
  }
  raster.rgba.writeUInt32BE(ink, (y * raster.w + x) * 4);
}

export function composite(layers: readonly Raster[]): Raster {
  const { w, h } = layers[0];
  const result = makeRaster(w, h);
  for (const layer of layers) {
    if (layer.w !== w || layer.h !== h || layer.rgba.length !== result.rgba.length) {
      throw new Error('Layer bounds do not match the destination canvas.');
    }
    for (let offset = 0; offset < layer.rgba.length; offset += 4) {
      const alpha = layer.rgba[offset + 3];
      if (alpha === 255) result.rgba.writeUInt32BE(layer.rgba.readUInt32BE(offset), offset);
      else if (alpha !== 0) throw new Error('Layer compositing requires binary alpha.');
    }
  }
  return result;
}

export function silhouette(raster: Raster, ink: number): Raster {
  const result = makeRaster(raster.w, raster.h);
  for (let i = 0; i < raster.rgba.length; i += 4) {
    if (raster.rgba[i + 3]) result.rgba.writeUInt32BE(ink, i);
  }
  return result;
}

export function nearestNeighbor(raster: Raster, scale: number): Raster {
  if (!Number.isInteger(scale) || scale < 1 || scale > 8) throw new RangeError('Preview scale must be 1–8.');
  const result = makeRaster(raster.w * scale, raster.h * scale);
  for (let y = 0; y < result.h; y++) {
    for (let x = 0; x < result.w; x++) {
      const source = (Math.floor(y / scale) * raster.w + Math.floor(x / scale)) * 4;
      put(result, x, y, raster.rgba.readUInt32BE(source));
    }
  }
  return result;
}

export function blit(destination: Raster, source: Raster, left: number, top: number) {
  if (!Number.isInteger(left) || !Number.isInteger(top) || left < 0 || top < 0 ||
      left + source.w > destination.w || top + source.h > destination.h) {
    throw new RangeError('Source lies outside the destination raster.');
  }
  for (let y = 0; y < source.h; y++) for (let x = 0; x < source.w; x++) {
    const ink = source.rgba.readUInt32BE((y * source.w + x) * 4);
    if ((ink & 255) !== 0) destination.rgba.writeUInt32BE(ink, ((top + y) * destination.w + left + x) * 4);
  }
}
