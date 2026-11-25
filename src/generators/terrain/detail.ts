import { put, type Raster } from '../../core/pixels/raster.ts';
import type { TerrainSpecV2, TerrainSpecV3 } from '../../specs/terrain.ts';
import type { terrainMaterials } from './materials.ts';

type Inks = ReturnType<typeof terrainMaterials>['inks'];
export type TileOrigin = readonly [x: number, y: number];

const grass = [
  ['  +', ' ++', '---'],
  ['+  +', '++-+', ' -- '],
  [' +   ', '++ + ', '---- '],
  [' -  ', '--- ', ' -++'],
];
const dirt = [
  [' +++ ', '++---', ' --- '],
  ['+++  ', ' +---', '   - '],
  ['  -- ', ' ----', '+++  '],
  ['  +  ', ' +++ ', '---  '],
];
const productionGrass = [
  [' +', '++', ' -'],
  ['- ', '--', ' +'],
  ['  + + ', ' ++++-', ' -- --'],
  ['  -- ', ' ---+', '--++ '],
  [' +  ', '+++-', ' ---'],
];
const productionDirt = [
  [' ~~ ', '+~~-', ' -- '],
  ['  ~~~~ ', ' ~~~~~-', '~~~~---', ' --    '],
  [' ++ ', '~~~~', ' ~~-'],
  [' ~~ ', '~~~~', '~~--'],
  [' --- ', ' ~~+-', '~~~+ '],
];
const attempts = { sparse: 2, standard: 4, dense: 7 };

export function coordinateHash(seed: number, x: number, y: number, index: number) {
  let bits = seed ^ Math.imul(x, 0x632be5ab) ^ Math.imul(y, 0x85157af5) ^ Math.imul(index + 1, 0x9e3779b9);
  bits = Math.imul(bits ^ (bits >>> 16), 0x21f0aaad);
  bits = Math.imul(bits ^ (bits >>> 15), 0x735a2d97);
  return (bits ^ (bits >>> 15)) >>> 0;
}

export function paintMaterialDetails(
  raster: Raster, spec: TerrainSpecV2 | TerrainSpecV3, inks: Inks, distance: (x: number, y: number) => number, origin: TileOrigin,
) {
  const { tileSize: size, seed, surface, edgeInset } = spec;
  const production = spec.version === 3;
  const quiet = production && coordinateHash(seed, Math.floor(origin[0] / 4), Math.floor(origin[1] / 4), 19) % 3 === 0;
  const grassShapes = production ? productionGrass : grass;
  const dirtShapes = production ? productionDirt : dirt;
  const occupied = new Uint8Array(size * size);
  for (let i = 0; i < attempts[surface]; i++) {
    if (quiet && i === 0) continue;
    const choice = coordinateHash(seed, origin[0], origin[1], i);
    const left = 1 + choice % 11, top = 1 + (choice >>> 8) % 12;
    const isGrass = distance(left + 1, top + 1) >= edgeInset;
    const shapes = isGrass ? grassShapes : dirtShapes;
    const glyph = shapes[(choice >>> 20) % shapes.length];
    const pixels = glyph.flatMap((row, y) => Array.from(row, (tone, x) => ({ x: x + left, y: y + top, tone })))
      .filter(pixel => pixel.tone !== ' ');
    if (!pixels.every(({ x, y }) =>
      x > 0 && y > 0 && x < size - 1 && y < size - 1 && !occupied[y * size + x] &&
      (isGrass ? distance(x, y) >= edgeInset + 2 : distance(x, y) < edgeInset - 1))) continue;

    for (const { x, y, tone } of pixels) {
      const ink = isGrass
        ? (tone === '+' ? inks.grassLight : inks.grassShade)
        : (tone === '+' ? inks.dirtLight : tone === '~' ? inks.dirtPacked : inks.dirtShade);
      put(raster, x, y, ink);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) occupied[(y + dy) * size + x + dx] = 1;
    }
  }
}
