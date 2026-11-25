import { mapPalette } from '../../core/palette/colors.ts';
import { cluster, fillPolygon } from '../../core/geometry/shapes.ts';
import { makeRaster } from '../../core/pixels/raster.ts';
import { renderOutlinedLayers } from '../../core/renderer/layers.ts';
import { characterSpecSchema } from '../../specs/character.ts';
import { characterColors, planCharacter } from './geometry.ts';

export function renderCharacter(input: unknown) {
  const spec = characterSpecSchema.parse(input);
  const plan = planCharacter(spec);
  const { w, h } = spec.canvas;
  const palette = spec.palette.mode === 'authored' ? Object.values(characterColors) : spec.palette.colors;
  const inks = mapPalette(characterColors, palette);
  const layers = Object.fromEntries(plan.parts.map(({ id, shapes }) => {
    const raster = makeRaster(w, h);
    for (const shape of shapes) {
      const inside = (x: number, y: number) => x >= 1 && y >= 1 && x < w - 1 && y < h - 1;
      if ('spans' in shape) {
        if (shape.spans.some(([y, left, right]) => !inside(left, y) || !inside(right, y))) throw new Error(id + ' exceeds the contour margin.');
        cluster(raster, inks[shape.ink], shape.spans);
      } else {
        if (!shape.polygon.every(([x, y]) => inside(x, y))) throw new Error(id + ' exceeds the contour margin.');
        fillPolygon(raster, shape.polygon, inks[shape.ink]);
      }
    }
    return [id, raster];
  }));
  const ordered = plan.parts.map(part => layers[part.id]);
  const { flat, silhouette } = renderOutlinedLayers(ordered, ordered, inks.contour);
  return { spec, plan, layers, palette, flat, silhouette };
}

export type CharacterRender = ReturnType<typeof renderCharacter>;
