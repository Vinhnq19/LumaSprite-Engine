// Studio Adapter export order. This is the documented pxl bit layout.
export const terrainBits = { N: 1, E: 2, S: 4, W: 8, NE: 16, SE: 32, SW: 64, NW: 128 } as const;
export const atlasColumns = 8;
export const atlasRows = 6;
export const dirtTileId = 48;

const cornerLinks = [
  { diagonal: terrainBits.NE, sides: terrainBits.N | terrainBits.E },
  { diagonal: terrainBits.SE, sides: terrainBits.S | terrainBits.E },
  { diagonal: terrainBits.SW, sides: terrainBits.S | terrainBits.W },
  { diagonal: terrainBits.NW, sides: terrainBits.N | terrainBits.W },
];

export function canonicalMask(mask: number) {
  if (!Number.isInteger(mask) || mask < 0 || mask > 255) throw new RangeError('Expected an 8-bit terrain mask.');
  let result = mask & 15;
  for (const { diagonal, sides } of cornerLinks) {
    if ((result & sides) === sides) result |= mask & diagonal;
  }
  return result;
}

export const canonicalMasks = [...new Set(Array.from({ length: 256 }, (_, mask) => canonicalMask(mask)))].sort((a, b) => a - b);
const ids = new Map(canonicalMasks.map((mask, slot) => [mask, slot + 1]));
export const grassTileId = (mask: number) => ids.get(canonicalMask(mask))!;

export const offsets = [
  [0, -1, terrainBits.N], [1, 0, terrainBits.E], [0, 1, terrainBits.S], [-1, 0, terrainBits.W],
  [1, -1, terrainBits.NE], [1, 1, terrainBits.SE], [-1, 1, terrainBits.SW], [-1, -1, terrainBits.NW],
] as const;

export function mapTileId(isGrass: (x: number, y: number) => boolean, x: number, y: number) {
  if (!isGrass(x, y)) return dirtTileId;
  let mask = 0;
  for (const [dx, dy, bit] of offsets) if (isGrass(x + dx, y + dy)) mask |= bit;
  return grassTileId(mask);
}
