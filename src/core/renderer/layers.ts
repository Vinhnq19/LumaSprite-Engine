import { outline } from '../geometry/faces.ts';
import { composite, silhouette, type Raster } from '../pixels/raster.ts';

export function renderOutlinedLayers(layers: readonly Raster[], flatLayers: readonly Raster[], ink: number) {
  const filled = composite(layers);
  const edge = outline(filled, ink);
  const final = composite([edge, filled]);
  const flat = composite([edge, ...flatLayers]);
  return { final, flat, silhouette: silhouette(final, ink) };
}
