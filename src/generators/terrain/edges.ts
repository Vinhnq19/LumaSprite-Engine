import { terrainBits } from './adjacency.ts';

// Profiles move the nominal edge by at most one pixel. Short runs keep the
// shift attached to the grass bank, and the ends return to the canonical join.
const horizontalSteps = [0, 0, 1, 1, 0, -1, -1, -1, 0, 0, 1, 1, 1, 0, 0, 0];
const verticalSteps = [0, 0, 0, -1, -1, 0, 1, 1, 1, 0, 0, -1, -1, 0, 0, 0];

export function boundaryDistance(mask: number | null, x: number, y: number, size: number, inset: number, natural = false) {
  if (mask === null) return -Infinity;
  const right = x >= size / 2, bottom = y >= size / 2;
  const u = right ? size - 1 - x : x, v = bottom ? size - 1 - y : y;
  const horizontal = (mask & (right ? terrainBits.E : terrainBits.W)) !== 0;
  const vertical = (mask & (bottom ? terrainBits.S : terrainBits.N)) !== 0;
  const diagonal = bottom ? (right ? terrainBits.SE : terrainBits.SW) : (right ? terrainBits.NE : terrainBits.NW);

  const interiorProfile = natural && u > 0 && v > 0;
  const shiftedU = u + (interiorProfile ? verticalSteps[y] : 0);
  const shiftedV = v + (interiorProfile ? horizontalSteps[x] : 0);
  if (!horizontal && !vertical) return Math.min(shiftedU, shiftedV, u + v - inset - (interiorProfile ? 2 : 1));
  if (!horizontal) return shiftedU;
  if (!vertical) return shiftedV;
  return (mask & diagonal) !== 0 ? Infinity : u + v - (interiorProfile ? 1 : 0);
}
