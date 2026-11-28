import assert from 'node:assert/strict';
import { lstat, mkdir, open, readFile, rm, rmdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { composite, type Raster } from '../core/pixels/raster.ts';
import { decodePng, encodePng } from '../core/renderer/png.ts';
import { sha256, validateRaster } from '../quality/raster.ts';
import { paletteColorsSchema } from '../specs/palette.ts';

const maxSize = 128;
const pngLimit = 132 * 1024;
const manifestLimit = 64 * 1024;
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const coordinate = z.number().int().min(0).max(maxSize - 1);
const point = z.tuple([coordinate, coordinate]);
const label = z.string().trim().min(1).max(256).regex(/^[^\u0000-\u001f\u007f-\u009f]+$/u);
const layerSchema = z.strictObject({
  id,
  pngSha256: hash,
  maskSha256: hash,
  anchors: z.record(id, point).refine(anchors => Object.keys(anchors).length <= 16),
  provenance: z.strictObject({
    creator: label,
    source: label,
    license: label,
    rights: z.enum(['review-only', 'production-declared']),
  }),
});
const manifestSchema = z.strictObject({
  schema: z.literal('lumasprite.component-package.v1'),
  canvas: z.strictObject({ w: z.number().int().min(1).max(maxSize), h: z.number().int().min(1).max(maxSize) }),
  pivot: point,
  pixelsPerUnit: z.number().int().min(1).max(256),
  palette: paletteColorsSchema.refine(colors => colors.length <= 64, 'Use at most 64 colors.'),
  layers: z.array(layerSchema).min(1).max(16),
  revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  parent: z.strictObject({ manifestSha256: hash, layer: id, editMaskSha256: hash }).nullable(),
});

export type ComponentManifest = z.infer<typeof manifestSchema>;
type PackageContent = Awaited<ReturnType<typeof readContent>>;

async function readBounded(file: string, limit: number) {
  const stat = await lstat(file);
  assert.ok(stat.isFile() && stat.size <= limit, 'Expected a bounded regular file: ' + file);
  const bytes = await readFile(file);
  assert.ok(bytes.length <= limit, 'File size limit: ' + file);
  return bytes;
}

function readNativePng(bytes: Buffer, { w, h }: ComponentManifest['canvas']): Raster {
  assert.ok(bytes.length >= 33 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'PNG signature');
  assert.ok(bytes.readUInt32BE(8) === 13 && bytes.toString('ascii', 12, 16) === 'IHDR', 'PNG header');
  assert.ok(bytes.readUInt32BE(16) === w && bytes.readUInt32BE(20) === h, 'PNG canvas mismatch');
  assert.deepEqual([...bytes.subarray(24, 29)], [8, 6, 0, 0, 0], 'Use non-interlaced 8-bit RGBA PNG.');
  return decodePng(bytes);
}

function binaryMask(bytes: Buffer, canvas: ComponentManifest['canvas']) {
  const raster = readNativePng(bytes, canvas);
  const selected = Buffer.alloc(raster.w * raster.h);
  for (let i = 0; i < selected.length; i++) {
    const ink = raster.rgba.readUInt32BE(i * 4);
    assert.ok(ink === 0 || ink === 0xffffffff, 'Mask pixels must be transparent black or opaque white.');
    selected[i] = Number(ink !== 0);
  }
  assert.ok(selected.includes(1), 'Mask is empty.');
  return selected;
}

const pngName = (layer: string) => 'layer-' + layer + '.png';
const maskName = (layer: string) => 'layer-' + layer + '.mask.png';
const manifestName = 'component.json';
const spriteName = 'sprite.png';
const editName = 'edit-mask.png';
const sumsName = 'SHA256SUMS';

async function readContent(directory: string, input: unknown, edit?: { layer: string; png: Buffer; mask: Buffer }) {
  const manifest = manifestSchema.parse(input);
  const { canvas: { w, h }, layers, parent, pivot, revision } = manifest;
  assert.equal(revision === 1, parent === null, 'Revision 1 is the root.');
  assert.ok(pivot[0] < w && pivot[1] < h, 'Pivot outside canvas.');
  assert.equal(new Set(layers.map(layer => layer.id)).size, layers.length, 'Duplicate layer id.');
  assert.ok(!parent || layers.some(layer => layer.id === parent.layer), 'Unknown edited layer.');

  const bytes = new Map<string, Buffer>();
  const rasters = new Map<string, Raster>();
  const ownership = new Map<string, Buffer>();
  for (const layer of layers) {
    const name = pngName(layer.id), mask = maskName(layer.id);
    const png = edit?.layer === layer.id ? edit.png : await readBounded(join(directory, name), pngLimit);
    const maskPng = await readBounded(join(directory, mask), pngLimit);
    assert.equal(sha256(png), layer.pngSha256, name + ' digest mismatch.');
    assert.equal(sha256(maskPng), layer.maskSha256, mask + ' digest mismatch.');
    const raster = readNativePng(png, manifest.canvas);
    const qa = validateRaster(raster, manifest, { durationMs: 1, loop: false });
    assert.deepEqual(qa, [], name + ' failed pixel validation: ' + qa.join(', '));
    const owned = binaryMask(maskPng, manifest.canvas);
    for (let i = 0; i < owned.length; i++) {
      assert.ok(owned[i] === Number(raster.rgba[i * 4 + 3] === 255), name + ' mask and alpha differ.');
    }
    for (const [key, [x, y]] of Object.entries(layer.anchors)) {
      assert.ok(x < w && y < h && owned[y * w + x] === 1, name + ' anchor outside ownership: ' + key);
    }
    bytes.set(name, png);
    bytes.set(mask, maskPng);
    rasters.set(layer.id, raster);
    ownership.set(layer.id, owned);
  }

  let editable: Buffer | undefined;
  if (parent) {
    const mask = edit ? edit.mask : await readBounded(join(directory, editName), pngLimit);
    assert.equal(sha256(mask), parent.editMaskSha256, 'Edit mask digest mismatch.');
    editable = binaryMask(mask, manifest.canvas);
    const owned = ownership.get(parent.layer)!;
    assert.ok(editable.every((selected, i) => !selected || owned[i]), 'Edit mask is outside layer ownership.');
    bytes.set(editName, mask);
  }

  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const sprite = composite([...rasters.values()]);
  bytes.set(manifestName, manifestBytes);
  bytes.set(spriteName, encodePng(sprite));
  const sums = [...bytes.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([name, data]) => sha256(data) + '  ' + name).join('\n') + '\n';
  bytes.set(sumsName, Buffer.from(sums));
  return { manifest, rasters, sprite, bytes, editable, manifestSha256: sha256(manifestBytes) };
}

async function readPackage(directory: string) {
  const raw = await readBounded(join(directory, manifestName), manifestLimit);
  const content = await readContent(directory, JSON.parse(raw.toString('utf8')));
  assert.deepEqual(raw, content.bytes.get(manifestName), 'Package manifest is not canonical.');
  const sprite = await readBounded(join(directory, spriteName), pngLimit);
  assert.ok(sprite.equals(content.bytes.get(spriteName)!), 'Sprite does not match the composed layers.');
  const sums = await readBounded(join(directory, sumsName), manifestLimit);
  assert.ok(sums.equals(content.bytes.get(sumsName)!), 'Package checksum catalog mismatch.');
  return content;
}

function checkParent(previous: PackageContent, next: PackageContent) {
  const { parent } = next.manifest;
  assert.ok(parent && next.editable, 'Expected a child revision.');
  assert.equal(parent.manifestSha256, previous.manifestSha256, 'Parent manifest digest mismatch.');
  const old = previous.rasters.get(parent.layer);
  assert.ok(old, 'Unknown parent layer.');
  const newLayer = next.manifest.layers.find(layer => layer.id === parent.layer)!;
  assert.deepEqual(next.manifest, {
    ...previous.manifest,
    revision: previous.manifest.revision + 1,
    parent,
    layers: previous.manifest.layers.map(layer => layer.id === parent.layer ? { ...layer, pngSha256: newLayer.pngSha256 } : layer),
  }, 'Revision changed locked metadata.');
  const edited = next.rasters.get(parent.layer)!;
  assert.ok(!old.rgba.equals(edited.rgba), 'Revision does not change any pixels.');
  assert.deepEqual(validateRaster(edited, next.manifest, { durationMs: 1, loop: false },
    { rgba: old.rgba, editable: next.editable }), [], 'Revision changes protected pixels.');
}

async function writePackage(directory: string, content: PackageContent) {
  // Reserving the directory first prevents replacing an earlier revision.
  await mkdir(directory);
  const written: string[] = [];
  try {
    for (const [name, bytes] of content.bytes) {
      const file = join(directory, name);
      const handle = await open(file, 'wx');
      written.push(file);
      try {
        await handle.writeFile(bytes);
      } finally {
        await handle.close();
      }
    }
  } catch (error) {
    await Promise.allSettled(written.map(file => rm(file)));
    await rmdir(directory).catch(() => {});
    throw error;
  }
}

function receipt(content: PackageContent, revisionLink: 'ROOT' | 'PASS' | 'NOT_RUN') {
  return {
    integrity: 'PASS',
    revisionLink,
    revision: content.manifest.revision,
    manifestSha256: content.manifestSha256,
    spriteRgbaSha256: sha256(content.sprite.rgba),
    rights: content.manifest.layers.every(layer => layer.provenance.rights === 'production-declared')
      ? 'PRODUCTION_RIGHTS_DECLARED' : 'REVIEW_ONLY',
  } as const;
}

export async function buildComponentPackage(input: string, output: string) {
  const raw = await readBounded(input, manifestLimit);
  const content = await readContent(dirname(input), JSON.parse(raw.toString('utf8')));
  assert.equal(content.manifest.parent, null, 'Use the revision command for a child package.');
  await writePackage(output, content);
  return receipt(content, 'ROOT');
}

export async function reviseComponentPackage(directory: string, layerId: string, editedPng: string, editMask: string, output: string) {
  const previous = await readPackage(directory);
  assert.ok(previous.rasters.has(layerId), 'Unknown layer: ' + layerId);
  const [png, mask] = await Promise.all([readBounded(editedPng, pngLimit), readBounded(editMask, pngLimit)]);
  const next = await readContent(directory, {
    ...previous.manifest,
    revision: previous.manifest.revision + 1,
    parent: { manifestSha256: previous.manifestSha256, layer: layerId, editMaskSha256: sha256(mask) },
    layers: previous.manifest.layers.map(layer => layer.id === layerId ? { ...layer, pngSha256: sha256(png) } : layer),
  }, { layer: layerId, png, mask });
  checkParent(previous, next);
  await writePackage(output, next);
  return receipt(next, 'PASS');
}

export async function verifyComponentPackage(directory: string, parent?: string) {
  const content = await readPackage(directory);
  if (parent) checkParent(await readPackage(parent), content);
  return receipt(content, parent ? 'PASS' : content.manifest.parent ? 'NOT_RUN' : 'ROOT');
}
