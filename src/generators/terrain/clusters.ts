import { put, type Raster } from '../../core/pixels/raster.ts';
import type { TerrainSpecV4 } from '../../specs/terrain.ts';
import { coordinateHash, type TileOrigin } from './detail.ts';
import type { terrainMaterials } from './materials.ts';

const grassPatches = [
  ['  -+  ', ' -++  ', '-- -+ ', '   -- '],
  ['  +  ', ' -++ ', '-- -+', '   --'],
  ['    -+   ', '  -+++   ', ' --   -+ ', ' -  -+++ ', '    ---  '],
  ['   +  -+ ', ' -+++ ++ ', '--  --   ', '   -- -+ ', '      -- '],
];
const soilPatches = [
  [' ~~  ', '~~~~ ', ' ~~~ ', '  ~  '],
  ['  ~~~ ', ' ~~~~ ', '~~~-- ', '  ~~  '],
  ['   ~~~~  ', ' ~~~ ~~~ ', '~~~~~~~  ', ' ~~~~--  ', '   ~     '],
  ['      ~~ ', '   ~~~~~ ', ' ~~~~    ', '~~~~~~-  ', ' ~~~--   '],
];
const grassMicro = [['-+'], ['+ ', '--'], [' -', '--']];
const soilMicro = [['~~-'], ['~~', ' ~'], ['+ ', '~~'], ['  -', '-- ']];
const surfaceBias = { sparse: -.17, standard: 0, dense: .17 };

function coverageField(seed: number, [x, y]: TileOrigin) {
  // Interpolate world anchors so neighboring tiles share patches of activity.
  const u = (x + 3) / 7, v = (y - 2) / 9;
  const left = Math.floor(u), top = Math.floor(v);
  const fade = (a: number) => a * a * (3 - 2 * a);
  const tx = fade(u - left), ty = fade(v - top);
  const anchor = (dx: number, dy: number) => coordinateHash(seed, left + dx, top + dy, 29) / 0x100000000;
  const north = anchor(0, 0) * (1 - tx) + anchor(1, 0) * tx;
  const south = anchor(0, 1) * (1 - tx) + anchor(1, 1) * tx;
  return north * (1 - ty) + south * ty;
}

export function paintTerrainClusters(
  raster: Raster, spec: TerrainSpecV4, inks: ReturnType<typeof terrainMaterials>['inks'],
  distance: (x: number, y: number) => number, origin: TileOrigin,
) {
  const { seed, edgeInset: inset, tileSize: size } = spec;
  const directed = spec.direction === 'art-directed';
  const field = coverageField(seed, origin);
  const bias = surfaceBias[spec.surface];
  const choiceAt = (slot: number) => coordinateHash(seed, origin[0], origin[1], 40 + slot);
  const score = (directed ? field * .82 + (choiceAt(0) >>> 24) / 1450 : field * .3 + (choiceAt(0) >>> 24) / 390) + bias;
  const patches = score < (directed ? .35 : .28) ? 0 : score > (directed ? .68 : .66) ? 2 : 1;
  const used = new Uint8Array(size * size);

  function paint(glyph: readonly string[], left: number, top: number, grass: boolean, mirror: boolean) {
    const points = glyph.flatMap((row, y) => Array.from(row, (tone, x) => ({
      x: left + (mirror ? row.length - 1 - x : x), y: top + y, tone,
    }))).filter(point => point.tone !== ' ');
    if (!points.every(({ x, y }) => x > 0 && y > 0 && x < size - 1 && y < size - 1 && !used[y * size + x] &&
        (grass ? distance(x, y) >= inset + 2 : distance(x, y) < inset - 1))) return false;
    const ramp = grass ? { '+': inks.grassLight, '-': inks.grassShade, '~': inks.grass } :
      { '+': inks.dirtLight, '-': inks.dirtShade, '~': inks.dirtPacked };
    for (const { x, y, tone } of points) {
      put(raster, x, y, ramp[tone as keyof typeof ramp]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) used[(y + dy) * size + x + dx] = 1;
    }
    return true;
  }

  let stamp = 0;
  for (let attempt = 0; attempt < patches * 4 && stamp < patches; attempt++) {
    const choice = choiceAt(attempt + 1);
    const grass = distance(3 + choice % 10, 3 + (choice >>> 9) % 10) >= inset;
    const shapes = grass ? grassPatches : soilPatches;
    const index = directed && stamp === 0 && score > .44 ? 2 + ((choice >>> 26) & 1) : (choice >>> 23) & 1;
    const glyph = shapes[index];
    const x = 1 + choice % (size - 1 - glyph[0].length);
    const y = 1 + (choice >>> 9) % (size - 1 - glyph.length);
    if (!paint(glyph, x, y, grass, (choice & 16) !== 0)) continue;
    stamp++;
    if (score > .43 && (choice & 7) < 5) {
      const marks = grass ? grassMicro : soilMicro;
      const mark = marks[(choice >>> 18) % marks.length];
      const dx = (choice & 32) === 0 ? -3 : glyph[0].length;
      paint(mark, x + dx, y + ((choice >>> 8) % 3), grass, false);
    }
  }
  // One quiet soil crumb or tuft can survive near a bank that excludes a full patch.
  if (!stamp && patches && score > .42 && (choiceAt(9) & 3) === 0) {
    const choice = choiceAt(10), x = 2 + choice % 10, y = 2 + (choice >>> 9) % 10;
    const marks = distance(x, y) >= inset ? grassMicro : soilMicro;
    paint(marks[(choice >>> 18) % marks.length], x, y, marks === grassMicro, false);
  }
}
