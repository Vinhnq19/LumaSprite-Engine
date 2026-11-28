import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

test('E9.1 raw PNGs round-trip through the locked Studio pixel pipeline', async t => {
  const root = 'benchmarks/results/e91/';
  const manifest = JSON.parse(await readFile(root + 'benchmark.json', 'utf8'));
  const studio = resolve(process.env.LUMASPRITE_STUDIO_ROOT ?? '../LumaSprite-Studio');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: studio, encoding: 'utf8' }).trim();
  const revision = git('rev-parse', 'HEAD');
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  assert.equal(revision, '471ac90555d3545beff5182146e291ba97b9ae20');
  assert.equal(git('status', '--porcelain'), '');
  const uri = (file: string) => pathToFileURL(join(studio, file)).href;
  const { readStudioPng } = await import(uri('studio/pixel/read-png.ts'));
  const { celFor, newDocument } = await import(uri('src/studio/pixel/model.ts'));
  const { PixelStore } = await import(uri('src/node/studio/pixel-store.ts'));
  const { exportPixel } = await import(uri('src/node/studio/pixel-render.ts'));
  const parent = resolve(root);
  const folder = await mkdtemp(join(parent, 'studio-roundtrip-'));
  assert.ok(folder.startsWith(parent + sep + 'studio-roundtrip-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const store = new PixelStore(folder);
  const names = manifest.cases.flatMap(({ scope }: { scope: string }) =>
    ['a0/sprite.png', 'b4/sprite.png', 'b4/parts.png'].map(file => scope + file));
  const samples = [];
  for (const name of names) {
    const raw = await readFile(root + name);
    assert.equal(sha256(raw), manifest.files[name]);
    const raster = decodePng(raw);
    const pixels: Uint32Array = await readStudioPng(new Blob([Uint8Array.from(raw)]), raster.w, raster.h);
    assert.equal(pixels.length, raster.w * raster.h);
    for (const [i, ink] of pixels.entries()) assert.equal(ink, raster.rgba.readUInt32BE(i * 4));
    const doc = newDocument(name, raster.w, raster.h);
    const asset = doc.assets[0], layer = asset.layers[0], frame = asset.frames[0];
    celFor(asset, layer.id, frame.id, true).data.set(pixels);
    const { id } = store.create(doc.name, raster.w, raster.h, 0, doc);
    const saved = store.load(id, true);
    store.save(id, saved.revision, saved, 'Save E9.1 raw PNG');
    const result = exportPixel({ document: store.load(id, true), assetId: asset.id, frameId: frame.id, format: 'png' });
    assert.deepEqual(decodePng(Buffer.from(result.data)), raster);
    samples.push({ file: root + name, pngSha256: sha256(raw), rgbaSha256: sha256(raster.rgba) });
  }
  assert.equal(git('rev-parse', 'HEAD'), revision);
  assert.equal(git('status', '--porcelain'), '');
  await writeFile(root + 'studio-parity.json', JSON.stringify({
    revision, branch, mode: 'RAW_PNG_ONLY', v4Contract: 'STUDIO_V4_CONTRACT_GAP', samples,
  }, null, 2) + '\n');
  t.diagnostic(samples.length + ' exact RGBA round-trips.');
});
