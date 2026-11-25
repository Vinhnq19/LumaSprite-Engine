import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { blit, makeRaster } from '../src/core/pixels/raster.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { bakeTerrain, verifyBakedTerrain } from '../src/generators/terrain/baked.ts';
import { renderTerrain } from '../src/generators/terrain/render.ts';
import { sha256 } from '../src/quality/raster.ts';

async function terrainScene(name: string) {
  const directory = 'benchmarks/results/e34/packages/b-' + name;
  const reference = await verifyBakedTerrain(directory);
  const overlays = await Promise.all(reference.overlays.filter(layer => layer.id !== 'traveler').map(async layer => {
    const png = await readFile(join(directory, layer.file));
    assert.equal(sha256(png), layer.pngSha256);
    return { id: layer.id, left: layer.left, top: layer.top, provenance: layer.provenance, png };
  }));
  return {
    raster: bakeTerrain(renderTerrain(reference.spec), reference.map, overlays).raster,
    source: { package: directory, mapPngSha256: reference.image.pngSha256,
      props: overlays.map(({ id, left, top, png, provenance }) => ({ id, left, top, pngSha256: sha256(png), provenance })) },
  };
}
export async function characterGameScenes() {
  const [outdoor, gameplay] = await Promise.all([terrainScene('organic'), terrainScene('outdoor')]);
  const wall = ['dungeon-wall', 'dungeon-floor', 'dungeon-floor-detail'] as const;
  const tileFiles = await Promise.all(wall.map(async id => {
    const file = 'benchmarks/fixtures/e24/' + id + '.png';
    const png = await readFile(file);
    return { file, raster: decodePng(png), sha256: sha256(png) };
  }));
  const dungeon = makeRaster(320, 176);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 20; x++) {
    const tile = tileFiles[y === 0 ? 0 : (x * 5 + y * 7 + x * y * 3) % 13 === 0 ? 2 : 1].raster;
    assert.ok(tile.w === 16 && tile.h === 16);
    blit(dungeon, tile, x * 16, y * 16);
  }
  const dungeonProps = await Promise.all([
    ['compact', 39, 32], ['barrel-tall', 92, 36], ['crate', 208, 50], ['travel', 253, 86],
  ].map(async ([id, x, y]) => {
    const file = 'benchmarks/results/e24/' + id + '-1x.png';
    const png = await readFile(file);
    blit(dungeon, decodePng(png), Number(x), Number(y));
    return { file, x, y, sha256: sha256(png) };
  }));
  return {
    scenes: [
      { id: 'outdoor', base: outdoor.raster, pivot: [240, 158] },
      { id: 'dungeon', base: dungeon, pivot: [153, 112] },
      { id: 'gameplay', base: gameplay.raster, pivot: [244, 136] },
    ] as const,
    source: {
      outdoor: { ...outdoor.source, pivot: [240, 158] }, gameplay: { ...gameplay.source, pivot: [244, 136] },
      dungeon: { tiles: tileFiles.map(({ file, sha256 }) => ({ file, sha256 })), license: 'CC0 1.0', props: dungeonProps, pivot: [153, 112] },
    },
  };
}
