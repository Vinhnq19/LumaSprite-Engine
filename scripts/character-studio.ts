import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { pack } from '../src/core/palette/colors.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { characterReview } from '../src/generators/character/export.ts';
import { surveyorRefinements, surveyors } from '../src/generators/character/presets.ts';

test('Studio validates and reopens the E4.1 and E4.1R unapproved profiles with exact RGBA and part masks', async t => {
  const studio = resolve(process.env.LUMASPRITE_STUDIO_ROOT ?? '../LumaSprite-Studio');
  const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: studio, encoding: 'utf8' }).trim();
  const url = (path: string) => pathToFileURL(join(studio, path)).href;
  const { readStudioPng } = await import(url('studio/pixel/read-png.ts'));
  const { newDocument, celFor } = await import(url('src/studio/pixel/model.ts'));
  const { validateCharacterProfile, checkCharacterReadiness } = await import(url('src/studio/characters.ts'));
  const { PixelStore } = await import(url('src/node/studio/pixel-store.ts'));
  const { exportPixel } = await import(url('src/node/studio/pixel-render.ts'));
  const sandbox = resolve('.cache');
  await mkdir(sandbox, { recursive: true });
  const root = await mkdtemp(join(sandbox, 'character-studio-'));
  assert.ok(resolve(root).startsWith(sandbox + sep));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new PixelStore(root);
  for (const [id, spec] of Object.entries({ ...surveyors, ...surveyorRefinements })) {
    const review = characterReview(spec);
    const png = review.files.get('flat.png')!;
    const { w, h, rgba } = review.flat;
    const pixels: Uint32Array | undefined = await readStudioPng(new Blob([Uint8Array.from(png)]), w, h);
    assert.ok(pixels);
    assert.deepEqual(pixels, Uint32Array.from({ length: w * h }, (_, i) => rgba.readUInt32BE(i * 4)));
    const doc = newDocument(spec.name, w, h);
    const asset = doc.assets[0];
    asset.palette = [0, ...review.palette.map(pack)];
    const [x, y] = review.plan.pivot;
    asset.metadata.pivot = { x: x / w, y: y / h };
    const frameId = asset.frames[0].id;
    celFor(asset, asset.layers[0].id, frameId, true).data = pixels;
    const masks = Object.fromEntries(Object.entries(review.layers).map(([key, layer]) => [
      'part-' + key, { version: 1, kind: 'mask', w, h, data: Uint32Array.from({ length: w * h }, (_, i) => Number(layer.rgba[i * 4 + 3] === 255)) },
    ]));
    const profile = {
      id: 'field-surveyor-' + id, version: 1, name: spec.name, approved: false,
      source: { assetId: asset.id, frameId, captureRevision: 1, w, h, rgbaResourceId: 'flat-source', palette: asset.palette, pivot: { x, y } },
      parts: Object.fromEntries(review.plan.parts.map(({ id }) => [id, { name: id, maskResourceId: 'part-' + id }])),
      landmarks: Object.fromEntries(Object.entries(review.plan.landmarks).map(([id, { point, partId }]) =>
        [id, { name: id, x: point[0], y: point[1], partId }])),
      links: review.plan.links,
      actions: {},
    };
    doc.studio = { version: 1, resources: { ...masks, 'flat-source': { version: 1, kind: 'rgba', w, h, data: pixels } },
      characters: { [profile.id]: profile } };
    assert.deepEqual(validateCharacterProfile(profile, profile.id, doc), profile);
    const { id: projectId } = store.create(doc.name, w, h, 0, doc);
    const stored = store.load(projectId, true);
    store.save(projectId, stored.revision, stored, 'Reopen geometry draft');
    const reopened = store.load(projectId, true);
    const result = validateCharacterProfile(reopened.studio.characters[profile.id], profile.id, reopened);
    assert.deepEqual(result, profile);
    assert.equal(checkCharacterReadiness({ profile: result }).status, 'unapproved');
    assert.deepEqual(store.resource(projectId, 'flat-source').data, pixels);
    for (const [key, expected] of Object.entries(masks)) {
      assert.deepEqual(store.resource(projectId, key).data, expected.data);
    }
    const exported = exportPixel({ document: reopened, assetId: asset.id, format: 'png' });
    assert.deepEqual(decodePng(Buffer.from(exported.data)), review.flat);
  }
  t.diagnostic('Studio ' + revision + ' validated A, B, B1 and B2 profiles, all part masks, pivots, links and RGBA.');
});
