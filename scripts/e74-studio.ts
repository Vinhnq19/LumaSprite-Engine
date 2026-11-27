import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

test('Studio preserves E7.4 candidate and edit-mask RGBA through raw PNG round-trips', async t => {
  const root = 'benchmarks/results/e74';
  const benchmark = JSON.parse(await readFile(root + '/benchmark.json', 'utf8'));
  const studio = resolve(process.env.LUMASPRITE_STUDIO_ROOT ?? '../LumaSprite-Studio');
  const uri = (file: string) => pathToFileURL(join(studio, file)).href;
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: studio, encoding: 'utf8' }).trim();
  const { readStudioPng } = await import(uri('studio/pixel/read-png.ts'));
  const { celFor, newDocument } = await import(uri('src/studio/pixel/model.ts'));
  const { PixelStore } = await import(uri('src/node/studio/pixel-store.ts'));
  const { exportPixel } = await import(uri('src/node/studio/pixel-render.ts'));
  const cache = resolve('.cache');
  await mkdir(cache, { recursive: true });
  const folder = await mkdtemp(join(cache, 'e74-studio-'));
  assert.ok(folder.startsWith(cache + sep + 'e74-studio-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const store = new PixelStore(folder);
  const names = [
    ...benchmark.cases.flatMap(({ id }: { id: string }) => ['a0', 'a1', 'a2'].map(v => id + '/' + v + '/material.png')),
    'field-rain-gauge/a1/focused.png', 'field-rain-gauge/a1/refined.png',
    'field-rain-gauge/a1/edit-mask.png', 'harbor-signal-beacon/a2/night.png',
  ];
  const records = [];
  for (const name of names) {
    const raw = await readFile(root + '/' + name);
    assert.equal(sha256(raw), benchmark.files[name]);
    const raster = decodePng(raw);
    const data: Uint32Array = await readStudioPng(new Blob([Uint8Array.from(raw)]), raster.w, raster.h);
    assert.equal(data.length, raster.w * raster.h);
    for (const [i, ink] of data.entries()) assert.equal(ink, raster.rgba.readUInt32BE(i * 4));
    const doc = newDocument(name, raster.w, raster.h);
    const asset = doc.assets[0], layer = asset.layers[0], frame = asset.frames[0];
    celFor(asset, layer.id, frame.id, true).data.set(data);
    const { id } = store.create(doc.name, raster.w, raster.h, 0, doc);
    const saved = store.load(id, true);
    store.save(id, saved.revision, saved, 'Save E7.4 offline pilot PNG');
    const output = exportPixel({ document: store.load(id, true), assetId: asset.id, frameId: frame.id, format: 'png' });
    assert.deepEqual(decodePng(Buffer.from(output.data)), raster);
    records.push({ name, canvas: [raster.w, raster.h], pngSha256: sha256(raw), rgbaSha256: sha256(raster.rgba) });
  }
  const dest = process.env.LUMASPRITE_PUBLISH_E74 === '1' ? root : 'benchmarks/results/run/e74';
  await mkdir(dest, { recursive: true });
  await writeFile(dest + '/studio-parity.json', JSON.stringify({ revision, mode: 'RAW_PNG_ONLY', records }, null, 2) + '\n');
  t.diagnostic(revision.slice(0, 7) + ' · ' + records.length + ' exact RGBA round-trips.');
});
