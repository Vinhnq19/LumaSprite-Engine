import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

test('E7.6R scene and terrain evidence PNGs survive Studio save and export', async t => {
  const root = 'benchmarks/results/e76r/';
  const manifest = JSON.parse(await readFile(root + 'benchmark.json', 'utf8'));
  const studio = resolve(process.env.LUMASPRITE_STUDIO_ROOT ?? '../LumaSprite-Studio');
  const uri = (file: string) => pathToFileURL(join(studio, file)).href;
  const revision = process.env.LUMASPRITE_STUDIO_REVISION ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: studio, encoding: 'utf8' }).trim();
  const { readStudioPng } = await import(uri('studio/pixel/read-png.ts'));
  const { celFor, newDocument } = await import(uri('src/studio/pixel/model.ts'));
  const { PixelStore } = await import(uri('src/node/studio/pixel-store.ts'));
  const { exportPixel } = await import(uri('src/node/studio/pixel-render.ts'));
  const cache = resolve('.cache');
  await mkdir(cache, { recursive: true });
  const folder = await mkdtemp(join(cache, 'e76r-studio-'));
  assert.ok(folder.startsWith(cache + sep + 'e76r-studio-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const store = new PixelStore(folder);
  const names = manifest.cases.flatMap(({ id }: { id: string }) => ['b2'].flatMap(variant =>
    ['day', 'night', 'tilemap-day', 'atlas-day'].map(file => [id, variant, file + '.png'].join('/'))));
  const samples = [];
  for (const name of names) {
    const raw = await readFile(root + name);
    assert.equal(sha256(raw), manifest.files[name]);
    const raster = decodePng(raw);
    const pixels: Uint32Array = await readStudioPng(new Blob([Uint8Array.from(raw)]), raster.w, raster.h);
    for (const [i, ink] of pixels.entries()) assert.equal(ink, raster.rgba.readUInt32BE(i * 4));
    assert.equal(pixels.length, raster.w * raster.h);
    const doc = newDocument(name, raster.w, raster.h);
    const asset = doc.assets[0], layer = asset.layers[0], frame = asset.frames[0];
    celFor(asset, layer.id, frame.id, true).data.set(pixels);
    const { id } = store.create(doc.name, raster.w, raster.h, 0, doc);
    const saved = store.load(id, true);
    store.save(id, saved.revision, saved, 'Save E7.6R pilot PNG');
    const result = exportPixel({ document: store.load(id, true), assetId: asset.id, frameId: frame.id, format: 'png' });
    assert.deepEqual(decodePng(Buffer.from(result.data)), raster);
    samples.push({ file: root + name, pngSha256: sha256(raw), rgbaSha256: sha256(raster.rgba) });
  }
  const dest = process.env.LUMASPRITE_PUBLISH_E76R === '1' ? root : 'benchmarks/results/run/e76r/';
  await mkdir(dest, { recursive: true });
  await writeFile(dest + 'studio-parity-' + revision.slice(0, 7) + '.json', JSON.stringify({ revision, mode: 'RAW_PNG_ONLY', samples }, null, 2) + '\n');
  t.diagnostic(revision.slice(0, 7) + ' · ' + samples.length + ' exact RGBA round-trips.');
});
