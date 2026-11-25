import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { canonicalMask, grassTileId } from '../src/generators/terrain/adjacency.ts';
import { verifyBakedTerrain } from '../src/generators/terrain/baked.ts';
import { renderTerrain, renderTileGrid } from '../src/generators/terrain/render.ts';
import { sha256 } from '../src/quality/raster.ts';

function backupInputs(files: { path: string; data: Buffer }[]) {
  const manifest = JSON.parse(files.find(file => file.path === 'pxl.project.json')!.data.toString('utf8'));
  const blobs: Record<string, string> = {}, resources: Record<string, string> = {};
  for (const file of files) {
    const cel = /^\.pxl\/cels\/([a-f0-9]{64})\.rgba\.z$/.exec(file.path);
    const resource = /^\.pxl\/resources\/([a-f0-9]{64})\.(rgba|mask|tile-index)\.z$/.exec(file.path);
    if (cel) blobs[cel[1]] = file.data.toString('base64');
    if (resource) resources[resource[2] + ':' + resource[1]] = file.data.toString('base64');
  }
  return { document: manifest.document, blobs, resources };
}

test('real Studio import and export preserve four baked maps, while editable autotiling draws the static atlas', async t => {
  const studio = resolve(process.env.LUMASPRITE_STUDIO_ROOT ?? '../LumaSprite-Studio');
  const studioRevision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: studio, encoding: 'utf8' }).trim();
  const studioUrl = (path: string) => pathToFileURL(join(studio, path)).href;
  const { readStudioPng } = await import(studioUrl('studio/pixel/read-png.ts'));
  const { newDocument, newAsset, celFor } = await import(studioUrl('src/studio/pixel/model.ts'));
  const { canonicalMask: studioMask, terrainSlot } = await import(studioUrl('src/studio/terrain.ts'));
  const { registerTileset, createMap, getMap, setTileCollision, MapStroke } = await import(studioUrl('src/studio/map-commands.ts'));
  const { PixelStore } = await import(studioUrl('src/node/studio/pixel-store.ts'));
  const { exportPixel } = await import(studioUrl('src/node/studio/pixel-render.ts'));
  const { terrainRequest } = await import(studioUrl('src/node/studio/terrain-worker.ts'));
  const { zipFiles } = await import(studioUrl('src/node/studio/zip.ts'));
  for (let raw = 0; raw < 256; raw++) {
    assert.equal(studioMask(raw), canonicalMask(raw));
    assert.equal(terrainSlot(raw) + 1, grassTileId(raw));
  }
  const sandbox = resolve('.cache');
  await mkdir(sandbox, { recursive: true });
  const root = await mkdtemp(join(sandbox, 'terrain-production-'));
  assert.ok(resolve(root).startsWith(sandbox + sep));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new PixelStore(root);
  const artifact = 'benchmarks/results/e33';
  const capturing = process.env.LUMASPRITE_CAPTURE_PRODUCTION_PARITY === '1';
  const runs = 'benchmarks/results/run';
  const output = capturing ? join(artifact, 'studio') : join(runs, 'e33-studio');
  await mkdir(output, { recursive: true });
  if (capturing) await mkdir(runs, { recursive: true });
  const results = [];

  async function pngAsset(name: string, png: Buffer) {
    const { w, h } = decodePng(png);
    const pixels: Uint32Array | undefined = await readStudioPng(new Blob([Uint8Array.from(png)]), w, h);
    assert.ok(pixels, 'Studio PNG importer must accept the 8-bit RGBA source.');
    const asset = newAsset(name, w, h);
    asset.palette = [...new Set(pixels)];
    celFor(asset, asset.layers[0].id, asset.frames[0].id, true).data = pixels;
    return asset;
  }

  for (const name of ['large', 'stress', 'outdoor', 'regions']) {
    const directory = join(artifact, 'packages', name);
    const manifest = await verifyBakedTerrain(directory);
    const baked = await readFile(join(directory, 'map.png'));
    const editableReference = decodePng(await readFile(join(artifact, name + '-editable-reference-1x.png')));
    const atlasMapping = JSON.parse(await readFile(join(directory, 'atlas.json'), 'utf8'));
    const doc = newDocument('E3.3 ' + name, 128, 96);
    const atlas = await pngAsset('Editable tilemap atlas', await readFile(join(directory, 'atlas.png')));
    const background = await pngAsset('Baked terrain raster', baked);
    doc.assets = [atlas, background];
    const tileset = registerTileset(doc, atlas.id, atlas.frames[0].id, 16, 'Grass and Dirt', 'grass-dirt');
    for (const tile of atlasMapping.tiles) setTileCollision(doc, tileset, tile.id, tile.collision);
    assert.deepEqual(doc.studio.tilesets[tileset].tiles, atlasMapping.tiles);
    const rows = manifest.map.rows;
    const mapId = createMap(doc, tileset, 'Studio editable ' + name, rows[0].length, rows.length, 'terrain-map');
    const layerId = getMap(doc, mapId).layers[0].id;
    const stroke = new MapStroke(doc, mapId, layerId);
    for (const [y, row] of rows.entries()) for (let x = 0; x < row.length; x++) stroke.set(x, y, row[x] === '#' ? 47 : 48);
    assert.equal(stroke.commit(), true);
    const stored = store.create(doc.name, atlas.w, atlas.h, 0, doc);
    const reopened = store.load(stored.id);
    const saved = store.save(stored.id, reopened.revision, reopened, 'Verify E3.3 save and reopen');

    function verifySaved(id: string) {
      const loaded = store.load(id, true);
      const bakedPng = Buffer.from(exportPixel({ document: loaded, assetId: background.id, format: 'png' }).data);
      const base = { mode: 'terrain', root, projectId: id, revision: loaded.revision, operation: 'map-export', mapId };
      const editablePng = Buffer.from(terrainRequest({ ...base, format: 'png' }).data);
      const portable = JSON.parse(Buffer.from(terrainRequest({ ...base, format: 'json' }).data).toString('utf8'));
      assert.equal(portable.kind, 'pxl-map');
      assert.equal(portable.version, 1);
      assert.equal(portable.tileSize, 16);
      assert.equal(portable.width, rows[0].length);
      assert.equal(portable.height, rows.length);
      assert.deepEqual(loaded.studio.tilesets[tileset].tiles, atlasMapping.tiles);
      const chunks = new Map<string, number[]>(portable.layers[0].chunks.map(
        (chunk: { x: number; y: number; tiles: number[] }) => [chunk.x + ',' + chunk.y, chunk.tiles],
      ));
      for (const [y, row] of manifest.cells.entries()) for (const [x, tileId] of row.entries()) {
        const key = Math.floor(x / 32) + ',' + Math.floor(y / 32);
        const position = (y % 32) * 32 + x % 32;
        assert.equal(chunks.get(key)?.[position], tileId);
      }
      const bakedRaster = decodePng(bakedPng);
      assert.equal(bakedRaster.w, manifest.image.width);
      assert.equal(bakedRaster.h, manifest.image.height);
      assert.equal(sha256(bakedRaster.rgba), manifest.image.rgbaSha256);
      assert.deepEqual(decodePng(editablePng), editableReference);
      return { bakedPng, editablePng };
    }
    verifySaved(saved.id);
    const files = store.backupFiles(saved.id);
    const backup = backupInputs(files);
    const restored = store.importBackup('Restore ' + name, backup.document, backup.blobs, [], backup.resources);
    const exports = verifySaved(restored.id);

    // Compare variation against the editable terrain without the Outdoor sprite overlays.
    const world = renderTileGrid(renderTerrain(manifest.spec), manifest.cells, manifest.map.origin);
    let differentPixels = 0;
    for (let at = 0; at < world.rgba.length; at += 4) {
      if (world.rgba.readUInt32BE(at) !== editableReference.rgba.readUInt32BE(at)) differentPixels++;
    }
    assert.ok(differentPixels > 0, 'World-space detail must be absent from the editable atlas path.');

    await writeFile(join(output, name + '-baked-1x.png'), exports.bakedPng);
    await writeFile(join(output, name + '-editable-1x.png'), exports.editablePng);
    if (capturing) await writeFile(join(runs, 'e33-studio-' + name + '.zip'), zipFiles(files));
    results.push({
      scene: name, baked: 'BAKED_MAP_RGBA_PARITY_PASS', editable: 'STATIC_ATLAS_RGBA_MATCH',
      saveReopen: 'PASS', backupRestore: 'PASS', width: manifest.image.width, height: manifest.image.height,
      bakedRgbaSha256: manifest.image.rgbaSha256, editableRgbaSha256: sha256(editableReference.rgba),
      worldTerrainPixelsOutsideStaticParity: differentPixels, overlays: manifest.overlays,
    });
  }

  await writeFile(join(output, 'parity.json'), JSON.stringify({
    studioRevision,
    canonicalMasks: 47, rawMasks: 256,
    variation: 'ENGINE_VARIATION_PASS / STUDIO_VARIATION_NOT_SUPPORTED',
    results,
  }, null, 2) + '\n');
});
