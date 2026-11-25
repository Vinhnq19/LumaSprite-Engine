import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { pack } from '../src/core/palette/colors.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { characterReview } from '../src/generators/character/export.ts';
import { characterMaterialReview } from '../src/generators/character/material-export.ts';
import { surveyorRefinements, surveyors } from '../src/generators/character/presets.ts';
import { unpackPartMask, verifyCharacterProductionPackage } from '../src/generators/character/production.ts';
import type { ShapeLock } from '../src/generators/character/shape-lock.ts';
import { sha256 } from '../src/quality/raster.ts';
import { backupInputs } from './studio-backup.ts';

type Production = Awaited<ReturnType<typeof verifyCharacterProductionPackage>>;

test('Studio validates and reopens geometry and material draft profiles with exact RGBA and part masks', async t => {
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
  const samples = Object.entries({ ...surveyors, ...surveyorRefinements }).map(([id, spec]) => {
    const review = characterReview(spec);
    return { id, spec: review.spec, review, image: review.flat, png: review.files.get('flat.png')!, palette: [...review.palette],
      layers: review.layers, production: undefined as Production | undefined };
  });
  const lock = JSON.parse(await readFile('benchmarks/results/e42/b1-shape-lock.json', 'utf8')) as ShapeLock;
  const b1 = characterReview(surveyorRefinements.b1);
  for (const id of ['m1', 'm2'] as const) {
    const paint = characterMaterialReview(b1, lock, id);
    samples.push({ id, spec: surveyorRefinements.b1, review: b1, image: paint.final, png: paint.files.get('final.png')!,
      palette: paint.usedColors, layers: paint.layers, production: undefined });
  }
  const edition = process.env.LUMASPRITE_CHARACTER_EDITION ?? '43';
  const packages = ['e43/packages/m2p', 'e43/packages/courier'];
  if (edition === '44') packages.push('e44/packages/r1', 'e44/packages/r2', 'e44/packages/courier-rev');
  else if (edition !== '43') throw new Error('Character Studio edition must be 43 or 44.');
  for (const path of packages) {
    const id = path.slice(path.lastIndexOf('/') + 1);
    const production = await verifyCharacterProductionPackage('benchmarks/results/' + path);
    const { geometry, material } = production;
    samples.push({ id, spec: geometry.spec, review: geometry, image: material.final, png: production.files.get('final.png')!,
      palette: material.usedColors, layers: material.layers, production });
  }
  const output = process.env.LUMASPRITE_CAPTURE_CHARACTER_PRODUCTION === '1'
    ? 'benchmarks/results/e' + edition + '/studio' : 'benchmarks/results/run/e' + edition + '-studio';
  await mkdir(output, { recursive: true });
  const proofs = [];
  for (const { id, spec, review, image, png, palette, layers, production } of samples) {
    const { w, h, rgba } = image;
    const pixels: Uint32Array | undefined = await readStudioPng(new Blob([Uint8Array.from(png)]), w, h);
    assert.ok(pixels);
    assert.deepEqual(pixels, Uint32Array.from({ length: w * h }, (_, i) => rgba.readUInt32BE(i * 4)));
    const doc = newDocument(spec.name, w, h);
    const asset = doc.assets[0];
    asset.palette = [0, ...palette.map(pack)];
    if (production) asset.provenance = {
      kind: 'generated', palette: asset.palette,
      batch: { batchId: 'e' + edition + '-' + production.manifest.lineage.checkpoint, candidateId: id,
        manifest: { version: 1, palette: {
          name: production.manifest.style + ' CharacterSpec v' + spec.version + (production.lock.geometryRevision ? ' r' + production.lock.geometryRevision : ''),
          colors: palette,
        },
          materials: Object.entries(production.material.diagnostics.ramps).map(([name, colors]) => ({ name, colors })) } },
    };
    const [x, y] = review.plan.pivot;
    asset.metadata.pivot = { x: x / w, y: y / h };
    const frameId = asset.frames[0].id;
    celFor(asset, asset.layers[0].id, frameId, true).data = pixels;
    const masks = Object.fromEntries(Object.entries(layers).map(([key, layer]) => [
      'part-' + key, { version: 1, kind: 'mask', w, h, data: production ? unpackPartMask(production.masks[key], w * h)
        : Uint32Array.from({ length: w * h }, (_, i) => Number(layer.rgba[i * 4 + 3] === 255)) },
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

    function verifyStore(project: string) {
      const reopened = store.load(project, true);
      const result = validateCharacterProfile(reopened.studio.characters[profile.id], profile.id, reopened);
      assert.deepEqual(result, profile);
      assert.equal(checkCharacterReadiness({ profile: result }).status, 'unapproved');
      assert.deepEqual(reopened.assets[0].provenance, asset.provenance);
      assert.deepEqual(reopened.assets[0].metadata.pivot, asset.metadata.pivot);
      assert.deepEqual(store.resource(project, 'flat-source').data, pixels);
      for (const [key, expected] of Object.entries(masks)) {
        assert.deepEqual(store.resource(project, key).data, expected.data);
      }
      const exported = Buffer.from(exportPixel({ document: reopened, assetId: asset.id, format: 'png' }).data);
      assert.deepEqual(decodePng(exported), image);
      return exported;
    }
    verifyStore(projectId);
    if (production) {
      assert.throws(() => store.save(projectId, stored.revision, { ...stored, name: 'Stale change' }),
        error => {
          const issue = error as { status?: number; diagnostic?: { code?: string } };
          return issue.status === 409 && issue.diagnostic?.code === 'STALE_REVISION';
        });
      assert.equal(store.load(projectId).name, spec.name);
      const backup = backupInputs(store.backupFiles(projectId));
      const restored = store.importBackup(spec.name, backup.document, backup.blobs, backup.history, backup.resources);
      const exported = verifyStore(restored.id);
      const rgbaSha256 = sha256(decodePng(exported).rgba);
      assert.equal(rgbaSha256, production.manifest.rgbaSha256);
      await writeFile(join(output, id + '-restored.png'), exported);
      proofs.push({ id, studioProfileVersion: profile.version, characterSpecVersion: spec.version, style: production.manifest.style,
        saveReopen: 'PASS', restore: 'PASS', staleRevision: 'REJECTED', masks: Object.keys(masks).length, pivot: [x, y], rgbaSha256,
        engineManifestSha256: sha256(production.files.get('manifest.json')!) });
    }
  }
  await writeFile(join(output, 'parity.json'), JSON.stringify({ studioRevision: revision, results: proofs }, null, 2) + '\n');
  t.diagnostic('Studio ' + revision + ' validated ' + samples.length + ' draft profiles and restored ' + proofs.length + ' production packages with exact RGBA.');
});
