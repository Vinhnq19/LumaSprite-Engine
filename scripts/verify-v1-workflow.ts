import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeRaster, put } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';
import type { ComponentManifest } from '../src/components/package.ts';

const output = resolve(process.argv[2] ?? '.cache/e10-v1/workflow');
mkdirSync(output, { recursive: true });
const run = mkdtempSync(join(output, 'proof-'));
const sample = join(run, 'samples');
const input = join(run, 'source');
const r1 = join(sample, 'r1'), r2 = join(sample, 'r2');
mkdirSync(sample);
mkdirSync(input);
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
const studioPath = resolve('../LumaSprite-Studio');
const studioSha = git(studioPath, 'rev-parse', 'HEAD');
assert.equal(studioSha, '471ac90555d3545beff5182146e291ba97b9ae20');
assert.equal(git(studioPath, 'status', '--porcelain'), '');
const fromStudio = (path: string) => pathToFileURL(join(studioPath, path)).href;
const { readStudioPng } = await import(fromStudio('studio/pixel/read-png.ts'));
const { celFor, newDocument } = await import(fromStudio('src/studio/pixel/model.ts'));
const { PixelStore } = await import(fromStudio('src/node/studio/pixel-store.ts'));
const { exportPixel } = await import(fromStudio('src/node/studio/pixel-render.ts'));

const art = [
  ['body', ['....', '.dd.', 'dddd', 'dddd', '.dd.']],
  ['cap', ['.gg.', '.gg.', '....', '....', '....']],
] as const;
const width = 16, height = 16;
const colors = { d: 0x243455ff, g: 0xe6bc69ff };
const layers: ComponentManifest['layers'] = [];
for (const [id, rows] of art) {
  const raster = makeRaster(width, height), mask = makeRaster(width, height);
  for (const [y, row] of rows.entries()) for (const [x, value] of [...row].entries()) {
    if (value === '.') continue;
    put(raster, x + 6, y + 5, colors[value as keyof typeof colors]);
    put(mask, x + 6, y + 5, 0xffffffff);
  }
  const png = encodePng(raster), owned = encodePng(mask);
  writeFileSync(join(input, 'layer-' + id + '.png'), png);
  writeFileSync(join(input, 'layer-' + id + '.mask.png'), owned);
  layers.push({ id, pngSha256: sha256(png), maskSha256: sha256(owned), anchors: { join: [7, 6] },
    provenance: { creator: 'LumaSprite Engine QA', source: 'Original two-layer acceptance fixture in verify-v1-workflow.ts',
      license: 'Internal acceptance fixture', rights: 'review-only' } });
}
const manifest: ComponentManifest = { schema: 'lumasprite.component-package.v1', canvas: { w: width, h: height },
  pivot: [8, 10], pixelsPerUnit: 16, palette: ['#243455', '#e6bc69'], layers, revision: 1, parent: null };
const manifestPath = join(input, 'component.json');
writeFileSync(manifestPath, JSON.stringify(manifest));
const cli = (...args: string[]) => JSON.parse(execFileSync(process.execPath, ['dist/cli/component.js', ...args], { encoding: 'utf8' }));
const initial = cli('--manifest', manifestPath, '--out', r1);

const tempStudio = mkdtempSync(join(run, 'studio-data-'));
try {
  const store = new PixelStore(tempStudio);
  async function studioExport(file: string, edit?: { index: number; ink: number }): Promise<Buffer> {
    const png = readFileSync(file);
    const source = decodePng(png);
    const rgba: Uint32Array = await readStudioPng(new Blob([Uint8Array.from(png)]), width, height);
    assert.equal(rgba.length * 4, source.rgba.length);
    assert.ok(rgba.every((ink, i) => ink === source.rgba.readUInt32BE(i * 4)));
    const doc = newDocument('Engine v1 round-trip', width, height);
    const asset = doc.assets[0], frame = asset.frames[0];
    celFor(asset, asset.layers[0].id, frame.id, true).data.set(rgba);
    const { id } = store.create(doc.name, width, height, 0, doc);
    const saved = store.load(id, true);
    if (edit) celFor(saved.assets[0], asset.layers[0].id, frame.id, true).data[edit.index] = edit.ink;
    store.save(id, saved.revision, saved, 'Engine v1 proof');
    const reopened = new PixelStore(tempStudio).load(id, true);
    const exported = exportPixel({ document: reopened, assetId: asset.id, frameId: frame.id, format: 'png' });
    return Buffer.from(exported.data);
  }
  const allowed = makeRaster(width, height), x = 8, y = 5;
  put(allowed, x, y, 0xffffffff);
  const edited = join(run, 'studio-edit.png'), mask = join(run, 'allowed.png');
  writeFileSync(edited, await studioExport(join(r1, 'layer-cap.png'), { index: y * width + x, ink: colors.d }));
  writeFileSync(mask, encodePng(allowed));
  const revised = cli('--revise', r1, '--layer', 'cap', '--png', edited, '--edit-mask', mask, '--out', r2);
  assert.deepEqual(cli('--verify', r2, '--parent', r1), revised);
  assert.deepEqual(cli('--verify', r1), initial);
  const comparisons = [];
  for (const [name, dir] of [['r1', r1], ['r2', r2]]) {
    const file = join(dir, 'sprite.png');
    const studioPng = await studioExport(file);
    const returned = decodePng(studioPng);
    assert.deepEqual(returned, decodePng(readFileSync(file)));
    writeFileSync(join(run, 'studio-' + name + '.png'), studioPng);
    comparisons.push({ name, rgbaSha256: sha256(returned.rgba), pngSha256: sha256(studioPng), diffPixels: 0 });
    if (name === 'r2') writeFileSync(join(run, 'studio-r2.rgba'), returned.rgba);
  }
  const [a, b] = [r1, r2].map(dir => decodePng(readFileSync(join(dir, 'sprite.png'))).rgba);
  const changed = Array.from({ length: width * height }, (_, pixel) => pixel)
    .filter(pixel => a.readUInt32BE(pixel * 4) !== b.readUInt32BE(pixel * 4));
  assert.deepEqual(changed, [y * width + x]);
  assert.equal(git(studioPath, 'status', '--porcelain'), '');
  writeFileSync(join(run, 'workflow.json'), JSON.stringify({ status: 'PASS', studioSha, canvas: manifest.canvas,
    changedPixels: changed.length, outsideMask: 0, initial, revised, rollbackRgbaSha256: initial.spriteRgbaSha256,
    comparisons }, null, 2) + '\n');
  writeFileSync(join(output, 'latest.txt'), run + '\n');
  console.log('Engine component + Studio edit, export and rollback PASS:', run);
} finally {
  rmSync(tempStudio, { recursive: true });
}
