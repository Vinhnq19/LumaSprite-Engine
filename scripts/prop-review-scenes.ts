import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pack } from '../src/core/palette/colors.ts';
import { makeRaster, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { placeSprite } from './game-preview.ts';

export const reviewDesigns = ['compact', 'domed', 'travel', 'crate', 'barrel-wide', 'barrel-tall'] as const;
export type ReviewDesign = (typeof reviewDesigns)[number];
type Props = ReadonlyMap<ReviewDesign, Raster>;
export const fixtureDir = 'benchmarks/fixtures/e24';

const fixtureNames = ['town-grass', 'town-grass-detail', 'town-path-edge', 'town-path', 'town-path-bottom',
  'dungeon-floor', 'dungeon-floor-detail', 'dungeon-wall', 'rpg-traveler'] as const;
type FixtureName = (typeof fixtureNames)[number];

export async function readSceneFixtures() {
  return new Map(await Promise.all(fixtureNames.map(async name => {
    const bytes = await readFile(join(fixtureDir, name + '.png'));
    const raster = decodePng(bytes);
    const size = name === 'rpg-traveler' ? 32 : 16;
    if (raster.w !== size || raster.h !== size) throw new Error(name + ' must be ' + size + '×' + size + '.');
    for (let i = 3; i < raster.rgba.length; i += 4) {
      if (raster.rgba[i] !== 0 && raster.rgba[i] !== 255) throw new Error(name + ' has nonbinary alpha.');
    }
    return [name, raster] as const;
  })));
}

export function opaqueBounds(raster: Raster) {
  let left = raster.w, top = raster.h, right = -1, bottom = -1;
  for (let y = 0; y < raster.h; y++) {
    for (let x = 0; x < raster.w; x++) {
      if (!raster.rgba[(y * raster.w + x) * 4 + 3]) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (bottom < 0) throw new Error('Preview sprite has no opaque pixels.');
  return { left, top, right, bottom };
}

function solid(w: number, h: number, color: string) {
  const raster = makeRaster(w, h);
  const pixel = Buffer.alloc(4);
  pixel.writeUInt32BE(pack(color));
  raster.rgba.fill(pixel);
  return raster;
}

export function renderReviewScenes(props: Props, fixtures: ReadonlyMap<FixtureName, Raster>) {
  function fixture(name: FixtureName) {
    const asset = fixtures.get(name);
    if (!asset) throw new Error('Missing fixture ' + name);
    return asset;
  }

  function tileGround(width: number, tileAt: (row: number, column: number) => FixtureName) {
    const raster = makeRaster(width, 80);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < width / 16; x++) placeSprite(raster, fixture(tileAt(y, x)), x * 16, y * 16);
    }
    return raster;
  }

  type Subject = ReviewDesign | 'rpg-traveler';
  function compose(id: string, raster: Raster, subjects: readonly Subject[], groundY: number) {
    const placements = subjects.map((key, i) => {
      const sprite = key === 'rpg-traveler' ? fixture(key) : props.get(key);
      if (!sprite) throw new Error('Missing prop ' + key);
      const bounds = opaqueBounds(sprite);
      const pivot = { x: Math.floor(sprite.w / 2), y: bounds.bottom + 1 };
      const centerX = Math.floor((i + 0.5) * raster.w / subjects.length);
      const left = centerX - pivot.x;
      const top = groundY - pivot.y;
      placeSprite(raster, sprite, left, top);
      return { key, origin: { x: left, y: top }, pivot, bounds };
    });
    return { id, raster, metadata: { width: raster.w, height: raster.h, scale: 1, groundY, placements } };
  }

  const outdoor = tileGround(192, (row, x) => {
    if (row === 1) return 'town-path-edge';
    if (row === 2) return 'town-path';
    if (row === 3) return 'town-path-bottom';
    return x % 4 === row % 4 ? 'town-grass-detail' : 'town-grass';
  });
  const dungeon = tileGround(160, (row, x) => {
    if (row === 0) return 'dungeon-wall';
    return (x + 2 * row) % 7 === 0 ? 'dungeon-floor-detail' : 'dungeon-floor';
  });
  return [
    compose('outdoor', outdoor, ['rpg-traveler', 'compact', 'travel', 'barrel-wide', 'crate'], 65),
    compose('dungeon', dungeon, ['barrel-tall', 'domed', 'travel', 'crate'], 64),
    compose('neutral', solid(216, 48, '#7a7774'), reviewDesigns, 38),
  ];
}
