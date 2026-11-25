import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';
import { canonicalMask, grassTileId } from '../src/generators/terrain/adjacency.ts';

test('Studio registers the exported atlas, resolves all masks, and round-trips a backup', async t => {
  const studio = resolve(process.env.LUMASPRITE_STUDIO_ROOT ?? '../LumaSprite-Studio');
  const sourceUrl = (path: string) => pathToFileURL(join(studio, 'src', path)).href;
  const { newDocument, celFor } = await import(sourceUrl('studio/pixel/model.ts'));
  const { canonicalMask: studioMask, terrainSlot } = await import(sourceUrl('studio/terrain.ts'));
  const { registerTileset, createMap, getMap, setTileCollision, MapStroke } = await import(sourceUrl('studio/map-commands.ts'));
  const { renderMapCells } = await import(sourceUrl('studio/tilemap-render.ts'));
  const { PixelStore } = await import(sourceUrl('node/studio/pixel-store.ts'));
  const { zipFiles } = await import(sourceUrl('node/studio/zip.ts'));

  const artifact = 'benchmarks/results/e3';
  const mapping = JSON.parse(await readFile(join(artifact, 'atlas.json'), 'utf8'));
  const png = await readFile(join(artifact, 'atlas.png'));
  assert.equal(sha256(png), mapping.pngSha256);
  const atlas = decodePng(png);
  const doc = newDocument('Engine Grass & Dirt', atlas.w, atlas.h);
  const asset = doc.assets[0], frame = asset.frames[0].id;
  asset.palette = [0, ...mapping.palette.map((ink: string) => Number.parseInt(ink.slice(1), 16) * 256 + 255)];
  celFor(asset, asset.layers[0].id, frame, true).data = Uint32Array.from(
    { length: atlas.w * atlas.h }, (_, i) => atlas.rgba.readUInt32BE(i * 4),
  );

  const tilesetId = registerTileset(doc, asset.id, frame, 16, 'Grass & Dirt', 'grass-dirt');
  for (const tile of mapping.tiles) setTileCollision(doc, tilesetId, tile.id, tile.collision);
  assert.deepEqual(doc.studio.tilesets[tilesetId].tiles, mapping.tiles);
  for (let raw = 0; raw < 256; raw++) {
    assert.equal(studioMask(raw), canonicalMask(raw));
    assert.equal(terrainSlot(raw) + 1, grassTileId(raw));
  }

  const { width, height, grassAndDirt, cells } = JSON.parse(await readFile(join(artifact, 'transition.json'), 'utf8'));
  const mapId = createMap(doc, tilesetId, 'Grass and Dirt Transition', width, height, 'transition');
  const layer = getMap(doc, mapId).layers[0].id;
  const stroke = new MapStroke(doc, mapId, layer);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    stroke.set(x, y, grassAndDirt[y][x] === '#' ? 47 : 48);
  }
  assert.equal(stroke.commit(), true);
  const reader = new MapStroke(doc, mapId, layer, true);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) assert.equal(reader.get(x, y), cells[y][x]);
  reader.cancel();
  const expected = decodePng(await readFile(join(artifact, 'transition-1x.png')));
  const checkImage = (image: { w: number; h: number; data: Uint32Array }) => {
    assert.equal(image.w, expected.w);
    assert.equal(image.h, expected.h);
    for (let i = 0; i < image.data.length; i++) assert.equal(image.data[i], expected.rgba.readUInt32BE(i * 4));
  };
  checkImage(renderMapCells(doc, mapId));

  await mkdir('.cache', { recursive: true });
  const sandbox = resolve('.cache');
  const root = await mkdtemp(join(sandbox, 'terrain-studio-'));
  assert.ok(resolve(root).startsWith(sandbox + sep));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new PixelStore(root);
  const saved = store.create(doc.name, atlas.w, atlas.h, 0, doc);
  const files: { path: string; data: Buffer }[] = store.backupFiles(saved.id);
  const manifest = JSON.parse(files.find(file => file.path === 'pxl.project.json')!.data.toString('utf8'));
  const blobs: Record<string, string> = {}, resources: Record<string, string> = {};
  for (const file of files) {
    const cel = /^\.pxl\/cels\/([a-f0-9]{64})\.rgba\.z$/.exec(file.path);
    const resource = /^\.pxl\/resources\/([a-f0-9]{64})\.(rgba|mask|tile-index)\.z$/.exec(file.path);
    if (cel) blobs[cel[1]] = file.data.toString('base64');
    if (resource) resources[resource[2] + ':' + resource[1]] = file.data.toString('base64');
  }
  const restored = store.importBackup('Grass & Dirt Preview', manifest.document, blobs, [], resources);
  const hydrated = store.load(restored.id, true);
  for (const ref of Object.values(getMap(hydrated, mapId).layers[0].chunks) as string[]) {
    hydrated.studio.resources[ref] = store.resource(restored.id, ref);
  }
  checkImage(renderMapCells(hydrated, mapId));
  if (process.env.LUMASPRITE_CAPTURE_TERRAIN_BACKUP === '1') {
    const path = 'benchmarks/results/run/e3-studio.zip';
    await mkdir('benchmarks/results/run', { recursive: true });
    await writeFile(path, zipFiles(files));
    console.log('Studio import fixture written to ' + resolve(path));
  }
});
