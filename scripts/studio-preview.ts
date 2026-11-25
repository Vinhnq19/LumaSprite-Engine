import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { supplyChestBrief } from '../src/providers/mock/planner.ts';
import { serveEngine } from '../src/server/http.ts';

test('Studio HTTP receives a candidate and verifies pixels, selection, receipt and revision', async t => {
  const checkout = resolve(process.env.LUMASPRITE_STUDIO_ROOT ?? '../LumaSprite-Studio');
  const fromStudio = (path: string) => pathToFileURL(join(checkout, 'src', path)).href;
  const { serveStudio } = await import(fromStudio('node/studio/server.ts'));
  const { PixelStore } = await import(fromStudio('node/studio/pixel-store.ts'));
  const { newDocument, celFor, wireParse, wireStringify } = await import(fromStudio('studio/pixel/model.ts'));

  mkdirSync('.cache', { recursive: true });
  const root = mkdtempSync(resolve('.cache', 'studio-'));
  const engine = await serveEngine(0);
  t.after(async () => {
    await engine.close();
    rmSync(root, { force: true, recursive: true });
  });
  const studio = await serveStudio(root, { port: 0, externalEnginePort: engine.port });
  t.after(() => studio.close());

  const doc = newDocument('Engine contract fixture', 32, 32);
  const source = doc.assets[0], sourceFrame = source.frames[0];
  source.palette = [0, 0x1c2434ff, 0x536da0ff, 0xf7ba5bff, 0xeaf1f7ff];
  source.layers[0].locked = true;
  const protectedPixel = 16 * 32 + 16;
  const selected = protectedPixel + 1;
  const sourcePixels = celFor(source, source.layers[0].id, sourceFrame.id, true).data as Uint32Array;
  sourcePixels[protectedPixel] = source.palette[4];
  sourcePixels[0] = source.palette[2];
  const store = new PixelStore(root);
  const saved = store.create(doc.name, 32, 32, 0, doc);
  const project = 'api/pixel/projects/' + saved.id;
  const base = project + '/external-engine';
  const origin = new URL(studio.url).origin;

  async function call(path: string, input?: object, status = 200) {
    const response = await fetch(studio.url + path, input === undefined ? {} : {
      method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: wireStringify(input),
    });
    const body = await response.text();
    assert.equal(response.status, status, body);
    return wireParse(body);
  }

  const discover = await call(base);
  assert.deepEqual(discover.capabilities.versions, [1]);
  assert.deepEqual(discover.capabilities.assetTypes, ['prop']);

  async function preview(region: object | null, brief = supplyChestBrief) {
    const started = await call(base + '/jobs', {
      revision: saved.revision, assetType: 'prop', w: 32, h: 32, brief, source: region,
    }, 201);
    const path = base + '/' + started.id;
    let job = started;
    for (let i = 0; i < 80 && ['queued', 'running'].includes(job.state); i++) {
      await delay(20);
      job = await call(path);
    }
    assert.equal(job.state, 'ready', job.problem);
    const previewPath = path + '/preview/' + job.version;
    const candidate = await call(previewPath);
    assert.equal(candidate.w, 32);
    assert.equal(candidate.h, 32);
    assert.match(candidate.digest, /^[0-9a-f]{64}$/);
    assert.ok(candidate.rgba instanceof Uint32Array);
    assert.deepEqual(await call(previewPath), candidate);
    return { candidate, path, previewPath };
  }

  const normal = await preview(null);
  assert.ok(normal.candidate.rgba.some((ink: number) => ink !== 0));
  assert.ok(normal.candidate.rgba.every((ink: number) => source.palette.includes(ink)));
  const raster: Raster = { w: 32, h: 32, rgba: Buffer.alloc(4096) };
  normal.candidate.rgba.forEach((ink: number, i: number) => raster.rgba.writeUInt32BE(ink, i * 4));
  if (process.env.LUMASPRITE_CAPTURE_STUDIO_PREVIEW === '1') {
    const dir = 'benchmarks/results/run/e2-studio';
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'studio-locked-1x.png'), encodePng(raster));
    writeFileSync(join(dir, 'studio-locked-4x.png'), encodePng(nearestNeighbor(raster, 4)));
  }

  const mask = Array.from({ length: 1024 }, (_, i) => Number(i === protectedPixel || i === selected));
  const masked = await preview({ assetId: source.id, frameId: sourceFrame.id, mask });
  assert.notEqual(masked.candidate.rgba[selected], 0);
  const expected = new Uint32Array(sourcePixels);
  expected[selected] = masked.candidate.rgba[selected];
  assert.deepEqual(masked.candidate.rgba, expected);
  const barrel = await preview(null, 'Tall wooden barrel');
  assert.ok(barrel.candidate.rgba.some((ink: number) => ink !== 0));
  assert.ok(barrel.candidate.rgba.every((ink: number) => source.palette.includes(ink)));
  assert.notDeepEqual(barrel.candidate.rgba, normal.candidate.rgba);
  const before = await call(project);
  assert.equal(before.revision, saved.revision);
  assert.equal(before.assets.length, 1);

  await call(masked.path + '/apply', {
    approved: false, revision: saved.revision, version: masked.candidate.version, digest: masked.candidate.digest,
  }, 409);
  store.save(saved.id, saved.revision, { ...store.load(saved.id), name: 'Edited fixture' }, 'Test revision protection');
  await call(masked.previewPath, undefined, 409);
});
