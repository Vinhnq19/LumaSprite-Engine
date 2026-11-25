import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { pack } from '../src/core/palette/colors.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { unpackAnimationStrip, verifyAnimationPackage } from '../src/generators/character/animation.ts';
import { sha256 } from '../src/quality/raster.ts';
import { backupInputs } from './studio-backup.ts';

function readStripExport(bytes: Buffer) {
  const entries = new Map<string, Buffer>();
  for (let offset = 0; offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50;) {
    assert.equal(bytes.readUInt16LE(offset + 8), 0);
    const size = bytes.readUInt32LE(offset + 18), nameSize = bytes.readUInt16LE(offset + 26);
    const nameEnd = offset + 30 + nameSize, start = nameEnd + bytes.readUInt16LE(offset + 28);
    assert.ok(start + size <= bytes.length);
    entries.set(bytes.toString('utf8', offset + 30, nameEnd), bytes.subarray(start, start + size));
    offset = start + size;
  }
  assert.deepEqual([...entries.keys()], ['image.png', 'image.json']);
  return { png: entries.get('image.png')!, metadata: JSON.parse(entries.get('image.json')!.toString('utf8')) };
}

test('Studio materializes the animation PNG and timing, plays the tag and exports the restored exact strip', async t => {
  const studio = resolve(process.env.LUMASPRITE_STUDIO_ROOT ?? '../LumaSprite-Studio');
  const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: studio, encoding: 'utf8' }).trim();
  const url = (path: string) => pathToFileURL(join(studio, path)).href;
  const { readStudioPng } = await import(url('studio/pixel/read-png.ts'));
  const { materializeEngineResultV1, negotiateEngineV1 } = await import(url('src/studio/engine-adapter.ts'));
  const { composite, newDocument, playback } = await import(url('src/studio/pixel/model.ts'));
  const { sampleMotionPlayback } = await import(url('src/studio/quality/playback.ts'));
  const { PixelStore } = await import(url('src/node/studio/pixel-store.ts'));
  const { exportPixel } = await import(url('src/node/studio/pixel-render.ts'));

  const directory = 'benchmarks/results/e51/package';
  const animation = await verifyAnimationPackage(directory, 'benchmarks/results/e44/packages/r2');
  const sheetPng = await readFile(join(directory, 'spritesheet.png'));
  const { timing } = animation;
  const { w, h } = timing.canvas, sheetWidth = w * timing.frames.length;
  const decoded: Uint32Array | undefined = await readStudioPng(new Blob([Uint8Array.from(sheetPng)]), sheetWidth, h);
  assert.ok(decoded);
  const frames = timing.frames.map(frame => {
    const rgba = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) rgba.set(decoded.subarray(y * sheetWidth + frame.rect.x, y * sheetWidth + frame.rect.x + w), y * w);
    const exact = Buffer.alloc(w * h * 4);
    rgba.forEach((ink, i) => exact.writeUInt32BE(ink, i * 4));
    assert.equal(sha256(exact), frame.rgbaSha256);
    return { durationMs: frame.durationMs, rgba };
  });
  const timings = frames.map(frame => frame.durationMs);
  const palette = [0, ...new Set(animation.frames.flatMap(frame => frame.material.usedColors.map(pack)))];
  const request = {
    version: 1, requestId: 'e51-idle', assetType: 'animation', brief: timing.name,
    canvas: { w, h }, frameDurationsMs: timings, loop: timing.loop === 'repeat', alpha: 'binary', palette,
  };
  assert.equal(negotiateEngineV1({ versions: [1], assetTypes: ['animation'], features: [], limits: { width: 64, height: 64, frames: 4 } }, request), 1);
  const asset = materializeEngineResultV1({
    version: 1, jobId: 'idle-job', versionId: 'idle-final', name: timing.name, w, h, loop: request.loop, frames,
  }, request, 'idle-job', 'idle-final');
  const [x, y] = timing.pivot;
  asset.metadata.pivot = { x: x / w, y: y / h };
  const tagId = asset.tags[0].id;
  const doc = newDocument(timing.name, w, h);
  doc.assets = [asset];

  const cache = resolve('.cache');
  await mkdir(cache, { recursive: true });
  const root = await mkdtemp(join(cache, 'animation-studio-'));
  assert.ok(resolve(root).startsWith(cache + sep));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new PixelStore(root);
  const { id } = store.create(doc.name, w, h, 0, doc);
  const original = store.load(id, true);
  store.save(id, original.revision, original, 'Persist imported idle');

  function verifyStored(projectId: string) {
    const reopened = store.load(projectId, true);
    const stored = reopened.assets[0];
    assert.deepEqual(stored.metadata.pivot, asset.metadata.pivot);
    assert.deepEqual(stored.tags, asset.tags);
    assert.equal(stored.tags[0].loop, true);
    const sequence: { frame: { id: string; duration: number }; index: number }[] = playback(stored, tagId);
    assert.deepEqual(sequence.map(s => s.index), frames.map((_, i) => i));
    assert.deepEqual(sequence.map(s => s.frame.duration), timings);
    for (const [i, { frame }] of sequence.entries()) {
      assert.deepEqual(composite(stored, frame.id).data, frames[i].rgba);
      const result = exportPixel({ document: reopened, assetId: stored.id, frameId: frame.id, format: 'png' });
      const image = decodePng(Buffer.from(result.data));
      assert.equal(sha256(image.rgba), timing.frames[i].rgbaSha256);
    }
    let start = 0;
    for (const [index, frame] of frames.entries()) {
      assert.deepEqual(sampleMotionPlayback(frames, start, true), { index, done: false, delayMs: frame.durationMs });
      start += frame.durationMs;
      assert.deepEqual(sampleMotionPlayback(frames, start - 1, true), { index, done: false, delayMs: 1 });
    }
    assert.equal(start, timing.totalDurationMs);
    assert.deepEqual(sampleMotionPlayback(frames, start, true), { index: 0, done: false, delayMs: frames[0].durationMs });

    const result = exportPixel({ document: reopened, assetId: stored.id, tagId, format: 'strip' });
    const { png, metadata } = readStripExport(Buffer.from(result.data));
    const exported = decodePng(png);
    assert.deepEqual(exported, animation.sheet);
    assert.deepEqual(metadata.meta.size, { w: sheetWidth, h });
    assert.deepEqual(metadata.meta.frameTags, [{ name: timing.name, from: 0, to: frames.length - 1, direction: 'forward', loop: true }]);
    assert.deepEqual(metadata.meta.pxl.assets[stored.id].pivot, asset.metadata.pivot);
    assert.deepEqual(metadata.meta.pxl.playback, sequence.map(({ frame }) => ({ frameId: frame.id, duration: frame.duration })));
    const cells = Object.values(metadata.frames) as { frame: typeof timing.frames[number]['rect']; duration: number }[];
    assert.deepEqual(cells.map(cell => cell.frame), timing.frames.map(frame => frame.rect));
    assert.deepEqual(cells.map(cell => cell.duration), timings);
    assert.deepEqual(unpackAnimationStrip(exported, timing).map(cell => sha256(cell.rgba)), timing.frames.map(frame => frame.rgbaSha256));
    return png;
  }

  verifyStored(id);
  assert.throws(() => store.save(id, original.revision, { ...original, name: 'Stale animation' }), error => {
    const issue = error as { status?: number; diagnostic?: { code?: string } };
    return issue.status === 409 && issue.diagnostic?.code === 'STALE_REVISION';
  });
  assert.equal(store.load(id, true).name, timing.name);
  const backup = backupInputs(store.backupFiles(id));
  const restored = store.importBackup(timing.name, backup.document, backup.blobs, backup.history, backup.resources);
  const png = verifyStored(restored.id);
  const output = process.env.LUMASPRITE_CAPTURE_ANIMATION === '1' ? 'benchmarks/results/e51/studio' : 'benchmarks/results/run/e51-studio';
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'restored-strip.png'), png);
  await writeFile(join(output, 'parity.json'), JSON.stringify({
    studioRevision: revision, import: 'ENGINE_RESULT_V1', exactRgba: true, pivot: timing.pivot, normalizedPivot: asset.metadata.pivot,
    direction: 'forward', loop: true, timingMs: timings, totalDurationMs: timing.totalDurationMs, frames: timing.frames,
    saveReopen: 'PASS', backupRestore: 'PASS', stripPngJson: 'PASS', staleRevision: 'REJECTED',
    engineManifestSha256: sha256(animation.files.get('manifest.json')!), studioStripPngSha256: sha256(png),
  }, null, 2) + '\n');
  t.diagnostic('Studio ' + revision + ' preserved the four frame cells, pivot, loop and ' + timings.join('/') + ' ms delays.');
});
