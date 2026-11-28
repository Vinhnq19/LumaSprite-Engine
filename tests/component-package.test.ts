import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildComponentPackage, reviseComponentPackage, verifyComponentPackage, type ComponentManifest } from '../src/components/package.ts';
import { makeRaster, put } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

test('authored component layers export exactly, preserve mask and provenance through revisions, and roll back', async t => {
  const root = await mkdtemp(join(tmpdir(), 'luma-component-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'component.json'), r1 = join(root, 'r1'), r2 = join(root, 'r2');
  const editedFile = join(root, 'edited.png'), editMask = join(root, 'edit-mask.png');
  const background = makeRaster(4, 4), foreground = makeRaster(4, 4);
  const bgMask = makeRaster(4, 4), fgMask = makeRaster(4, 4), allowed = makeRaster(4, 4);
  const dark = 0x243455ff, light = 0xe6bc69ff;
  put(background, 0, 1, dark);
  put(background, 1, 1, dark);
  put(foreground, 1, 1, light);
  put(foreground, 2, 1, light);
  for (const x of [0, 1]) put(bgMask, x, 1, 0xffffffff);
  for (const x of [1, 2]) put(fgMask, x, 1, 0xffffffff);
  put(allowed, 2, 1, 0xffffffff);

  const provenance = { creator: 'Fixture artist', source: 'Original test drawing', license: 'Test fixture grant',
    rights: 'production-declared' } as const;
  const layers: ComponentManifest['layers'] = [];
  for (const [id, raster, mask] of [['base', background, bgMask], ['cap', foreground, fgMask]] as const) {
    const bytes = encodePng(raster), ownership = encodePng(mask);
    await writeFile(join(root, 'layer-' + id + '.png'), bytes);
    await writeFile(join(root, 'layer-' + id + '.mask.png'), ownership);
    layers.push({ id, pngSha256: sha256(bytes), maskSha256: sha256(ownership), provenance, anchors: { join: [1, 1] } });
  }
  const manifest: ComponentManifest = {
    schema: 'lumasprite.component-package.v1', canvas: { w: 4, h: 4 }, pivot: [1, 2], pixelsPerUnit: 16,
    palette: ['#243455', '#e6bc69'], layers, revision: 1, parent: null,
  };
  await writeFile(source, JSON.stringify({ ...manifest, layers: [{ ...layers[0], provenance: { ...provenance, license: '' } }, layers[1]] }));
  await assert.rejects(buildComponentPackage(source, r1));
  await writeFile(source, JSON.stringify(manifest));
  const initial = await buildComponentPackage(source, r1);
  assert.equal(initial.rights, 'PRODUCTION_RIGHTS_DECLARED');
  await assert.rejects(buildComponentPackage(source, r1), { code: 'EEXIST' });
  const baseSprite = decodePng(await readFile(join(r1, 'sprite.png')));
  assert.equal(baseSprite.rgba.readUInt32BE((1 * 4 + 1) * 4), light, 'Foreground owns overlap.');

  await writeFile(editMask, encodePng(allowed));
  put(foreground, 1, 1, dark);
  await writeFile(editedFile, encodePng(foreground));
  await assert.rejects(reviseComponentPackage(r1, 'cap', editedFile, editMask, r2), /protected pixels/);
  put(foreground, 1, 1, light);
  put(foreground, 2, 1, dark);
  await writeFile(editedFile, encodePng(foreground));
  const changed = await reviseComponentPackage(r1, 'cap', editedFile, editMask, r2);
  assert.deepEqual(await verifyComponentPackage(r2, r1), changed);
  assert.equal((await verifyComponentPackage(r2)).revisionLink, 'NOT_RUN');
  assert.notEqual(changed.spriteRgbaSha256, initial.spriteRgbaSha256);
  assert.deepEqual(await verifyComponentPackage(r1), initial);
  await assert.rejects(verifyComponentPackage(r2, r2), /Parent manifest digest mismatch/);

  await writeFile(join(r2, 'sprite.png'), encodePng(baseSprite));
  await assert.rejects(verifyComponentPackage(r2, r1), /Sprite does not match/);
});
