import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

test('E7.4R raw prop and evidence PNGs survive Studio save and export', async t => {
  const root = 'benchmarks/results/e74r/';
  const manifest = JSON.parse(await readFile(root + 'benchmark.json', 'utf8'));
  const studio = resolve(process.env.LUMASPRITE_STUDIO_ROOT ?? '../LumaSprite-Studio');
  const uri = (file: string) => pathToFileURL(join(studio, file)).href;
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: studio, encoding: 'utf8' }).trim();
  const { readStudioPng } = await import(uri('studio/pixel/read-png.ts'));
  const { celFor, newDocument } = await import(uri('src/studio/pixel/model.ts'));
  const { PixelStore } = await import(uri('src/node/studio/pixel-store.ts'));
  const { exportPixel } = await import(uri('src/node/studio/pixel-render.ts'));
  const cache = resolve('.cache');
  await mkdir(cache, { recursive: true });
  const folder = await mkdtemp(join(cache, 'e74r-studio-'));
  assert.ok(folder.startsWith(cache + sep + 'e74r-studio-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const store = new PixelStore(folder);
  const names = [
    'field-rain-gauge/material.png', 'field-rain-gauge/landmarks.png',
    'harbor-signal-beacon/material.png', 'harbor-signal-beacon/patched.png', 'harbor-signal-beacon/target-mask.png',
    'harbor-signal-beacon/patched-night.png', 'cliffside-wind-vane/material.png', 'cliffside-wind-vane/day.png',
  ];
  const samples = [];
  for (const name of names) {
    const raw = await readFile(root + name);
    assert.equal(sha256(raw), manifest.files[root + name]);
    const raster = decodePng(raw);
    const pixels: Uint32Array = await readStudioPng(new Blob([Uint8Array.from(raw)]), raster.w, raster.h);
    for (const [i, ink] of pixels.entries()) assert.equal(ink, raster.rgba.readUInt32BE(i * 4));
    assert.equal(pixels.length, raster.w * raster.h);
    const doc = newDocument(name, raster.w, raster.h);
    const asset = doc.assets[0], layer = asset.layers[0], frame = asset.frames[0];
    celFor(asset, layer.id, frame.id, true).data.set(pixels);
    const { id } = store.create(doc.name, raster.w, raster.h, 0, doc);
    const saved = store.load(id, true);
    store.save(id, saved.revision, saved, 'Save E7.4R pilot PNG');
    const result = exportPixel({ document: store.load(id, true), assetId: asset.id, frameId: frame.id, format: 'png' });
    assert.deepEqual(decodePng(Buffer.from(result.data)), raster);
    samples.push({ file: root + name, pngSha256: sha256(raw), rgbaSha256: sha256(raster.rgba) });
  }
  const dest = process.env.LUMASPRITE_PUBLISH_E74R === '1' ? root : 'benchmarks/results/run/e74r/';
  await mkdir(dest, { recursive: true });
  await writeFile(dest + 'studio-parity.json', JSON.stringify({ revision, mode: 'RAW_PNG_ONLY', samples }, null, 2) + '\n');
  t.diagnostic(revision.slice(0, 7) + ' · ' + samples.length + ' exact RGBA round-trips.');
});
