import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

test('Studio raw PNG preserves E7.3R assets on save, reopen and export', async t => {
  const root = 'benchmarks/results/e73r';
  const benchmark = JSON.parse(await readFile(root + '/benchmark.json', 'utf8'));
  const studio = resolve(process.env.LUMASPRITE_STUDIO_ROOT ?? '../LumaSprite-Studio');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: studio, encoding: 'utf8' }).trim();
  const uri = (path: string) => pathToFileURL(join(studio, path)).href;
  const { readStudioPng } = await import(uri('studio/pixel/read-png.ts'));
  const { celFor, newDocument } = await import(uri('src/studio/pixel/model.ts'));
  const { PixelStore } = await import(uri('src/node/studio/pixel-store.ts'));
  const { exportPixel } = await import(uri('src/node/studio/pixel-render.ts'));
  const cache = resolve('.cache');
  await mkdir(cache, { recursive: true });
  const folder = await mkdtemp(join(cache, 'e73r-studio-'));
  assert.ok(folder.startsWith(cache + sep + 'e73r-studio-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const store = new PixelStore(folder);
  const cases = [];
  for (const item of benchmark.cases) {
    for (const view of ['character-1', 'character-night-1', 'prop-1', 'environment-1', 'scene-night-1']) {
      const file = item.images.C[view];
      const bytes = await readFile(file);
      assert.equal(sha256(bytes), benchmark.files[file] ?? benchmark.reused[file]);
      const raster = decodePng(bytes);
      const inks: Uint32Array = await readStudioPng(new Blob([Uint8Array.from(bytes)]), raster.w, raster.h);
      assert.equal(inks.length, raster.w * raster.h);
      for (const [i, ink] of inks.entries()) assert.equal(ink, raster.rgba.readUInt32BE(i * 4));
      const doc = newDocument(item.id + '-' + view, raster.w, raster.h);
      const asset = doc.assets[0], frame = asset.frames[0], layer = asset.layers[0];
      celFor(asset, layer.id, frame.id, true).data.set(inks);
      const { id } = store.create(doc.name, raster.w, raster.h, 0, doc);
      const saved = store.load(id, true);
      store.save(id, saved.revision, saved, 'Save E7.3R raw PNG benchmark');
      const exported = exportPixel({ document: store.load(id, true), assetId: asset.id, frameId: frame.id, format: 'png' });
      assert.deepEqual(decodePng(Buffer.from(exported.data)), raster);
      cases.push({ case: item.id, view, file, w: raster.w, h: raster.h, pngSha256: sha256(bytes), rgbaSha256: sha256(raster.rgba) });
    }
  }
  const dest = process.env.LUMASPRITE_PUBLISH_E73R === '1' ? root : 'benchmarks/results/run/e73r';
  await mkdir(dest, { recursive: true });
  await writeFile(dest + '/studio-parity.json', JSON.stringify({ revision, mode: 'RAW_PNG_ONLY', cases }, null, 2) + '\n');
  t.diagnostic(revision.slice(0, 7) + ' · ' + cases.length + ' RGBA-exact round-trips.');
});
