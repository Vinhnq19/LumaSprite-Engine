import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { pack } from '../src/core/palette/colors.ts';
import { makeRaster, nearestNeighbor, put, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { crossAssetStyle, loadArtDirection } from '../src/experiments/art-direction.ts';
import type { PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { renderFunctionalWaterfront } from '../src/experiments/functional-waterfront.ts';
import { buildTiles, diagnosticOverlay, layerInspection, spatialExport, validateOcclusion,
  validateSpatial, verifyNegativeCases, verifyTiles } from '../src/experiments/semantic-environment-export.ts';
import { prepareSemantic, renderLanding, routeOverlay, semanticScene, type WaterPalette } from '../src/experiments/semantic-environment.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { sha256 } from '../src/quality/raster.ts';

const { values } = parseArgs({ options: { known: { type: 'boolean' }, freeze: { type: 'boolean' },
  publish: { type: 'boolean' }, out: { type: 'string' } } });
assert.ok([values.known, values.freeze, values.publish, values.out].filter(Boolean).length < 2);
const fixtureRoot = 'benchmarks/fixtures/e76r/';
const e76 = 'benchmarks/results/e76/';
const published = 'benchmarks/results/e76r/';
const holdout = fixtureRoot + 'canal-intake-service-platform.json';
const seal = fixtureRoot + 'holdout-freeze.json';
const knownRoot = '.cache/e76r-known/';
const read = readFileSync;
const json = (bytes: Buffer) => JSON.parse(bytes.toString('utf8'));
const stable = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const write = (path: string, bytes: string | Buffer) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
};
const rules = json(read(fixtureRoot + 'study.json'));
const e76Lock = await pinnedFile({ file: 'benchmarks/fixtures/e76/pilot-lock.json',
  sha256: '74ffcc6a4bebd941bb60229030bee1eb1dd3c45c266c18371548aaf5f7a064ab' });
const previous = json(e76Lock);
const manifest = await pinnedFile({ file: e76 + 'SHA256SUMS',
  sha256: '571c0f17adebc2b4b26162e235b0d4f2c44bffe5aabfead6bcc83736a917fba7' });
const old = manifest.toString('utf8').trim().split(/\r?\n/);
assert.equal(old.length, 91);
for (const row of old) {
  const [hash, file] = row.split('  ', 2);
  assert.equal(sha256(read(e76 + file)), hash, file);
}
const pinned = [fixtureRoot + 'study.json', holdout, 'scripts/benchmark-e76r.ts',
  'src/experiments/functional-waterfront.ts', 'src/experiments/semantic-environment.ts',
  'src/experiments/semantic-environment-export.ts', 'benchmarks/fixtures/e76/pilot-lock.json'];
const fingerprint = () => Object.fromEntries(pinned.map(file => [file, sha256(read(file))]));
if (values.freeze) {
  const provisional = read(knownRoot + 'benchmark.json');
  const interim = json(provisional);
  assert.equal(interim.status, 'KNOWN_CASES_ONLY');
  assert.equal(interim.cases.length, 2);
  const knownEvidence = sha256(provisional);
  const info = stable({ version: 1, protocol: 'The candidate was frozen after known cases and before generating Canal Intake.',
    source: fingerprint(), knownEvidence, criteria: rules.criteria, requirements: rules.required });
  if (existsSync(seal)) assert.equal(read(seal, 'utf8'), info, 'HOLDOUT_ALREADY_FROZEN');
  else write(seal, info);
  process.exit(0);
}
if (!values.known) assert.deepEqual(fingerprint(), json(read(seal)).source, 'HOLDOUT_SOURCE_OR_BRIEF_CHANGED');

const root = values.out ?? (values.known ? knownRoot : values.publish ? published : 'benchmarks/results/run/e76r/');
const fileHashes: Record<string, string> = {};
const save = (name: string, bytes: Buffer | string) => {
  fileHashes[name] = sha256(Buffer.from(bytes));
  write(join(root, name), bytes);
};
const png = (name: string, raster: Raster) => {
  const bytes = encodePng(raster);
  assert.deepEqual(decodePng(bytes), raster, 'PNG_RGBA');
  save(name + '.png', bytes);
  return bytes;
};
const crop = (r: Raster, x0: number, y0: number, w: number, h: number) => {
  const raster = makeRaster(w, h);
  const left = Math.max(0, Math.min(r.w - w, x0)), top = Math.max(0, Math.min(r.h - h, y0));
  for (let y = 0; y < h; y++) {
    const i = ((y + top) * r.w + left) * 4;
    r.rgba.copy(raster.rgba, y * w * 4, i, i + w * 4);
  }
  return raster;
};
const { spec: direction, profile } = await loadArtDirection(json(await pinnedFile(previous.style)));
const style = crossAssetStyle(profile, direction).profile, water: WaterPalette = previous.water;
const refs = [...previous.cases, ...(!values.known ? [{ file: holdout, sha256: fingerprint()[holdout] }] : [])];
const cases = [];
for (const pinnedSpec of refs) {
  const spec = semanticScene.parse(json(await pinnedFile(pinnedSpec)));
  const studyRole = rules.caseRoles[spec.id];
  const isHoldout = studyRole === 'fresh-holdout';
  const heritage: PilotBrief = json(await pinnedFile(spec.base));
  const base = await prepareSemantic(spec, heritage, style);
  const half = base.environment.assets.get('surveyor')!.scale!.bodyHalfWidth;
  const variants = [];
  for (const variant of ['a0', 'b1', 'b2'] as const) {
    const candidate = variant === 'b2';
    const archive = !candidate && !isHoldout;
    const folder = spec.id + '/' + variant + '/';
    const metrics = [];
    let sameGeometry = '';
    for (const light of ['day', 'night'] as const) {
      const refinement = candidate ? renderFunctionalWaterfront(base, spec, water, light) : null;
      const frame = refinement ?? renderLanding(base, spec, candidate ? 'b1' : variant, water, light);
      const spatial = spatialExport(spec, frame, half, pinnedSpec.sha256);
      const earlier = candidate ? renderLanding(base, spec, 'b1', water, light) : frame;
      const earlierSpatial = spatialExport(spec, earlier, half, pinnedSpec.sha256);
      for (const key of ['water', 'shore', 'deck', 'access', 'supports'] as const) assert.deepEqual(spatial.masks[key], earlierSpatial.masks[key]);
      if (!spec.gate || !candidate) assert.deepEqual(spatial.masks, earlierSpatial.masks);
      const spatialData = refinement ? {
        ...spatial, studyRole, landmarks: { boarding: {
          kind: 'boarding-sill', at: [frame.layout.lip[0] - 2, frame.layout.lip[1]],
          stand: spatial.anchors.boarding, runtimeInteraction: 'NOT_IMPLEMENTED',
        }, control: refinement.controls },
      } : spatial;
      const sceneJson = stable(spatialData);
      const gameplay = validateSpatial(json(Buffer.from(sceneJson)));
      const occlusion = validateOcclusion(frame.scene, frame);
      const masksHash = sha256(Buffer.from(stable(spatial.masks)));
      if (light === 'day') sameGeometry = masksHash;
      else assert.equal(masksHash, sameGeometry, 'LIGHT_CHANGED_GAMEPLAY');
      if (archive) {
        assert.deepEqual(encodePng(frame.scene), read(e76 + folder + light + '.png'), 'E76_IMAGE_CHANGED');
        assert.equal(sceneJson, read(e76 + folder + 'scene-' + light + '.json', 'utf8'), 'E76_JSON_CHANGED');
      }
      const tiles = buildTiles(base, frame, light);
      const atlasPng = encodePng(tiles.atlas), fgPng = encodePng(tiles.foreground);
      const replay = verifyTiles(decodePng(atlasPng), json(Buffer.from(stable(tiles.tilemap))), decodePng(fgPng), tiles.ground);
      assert.deepEqual(replay.preview, tiles.ground);
      let maintenanceSteps: number | null = null, apertureWater = 0, negative: string[] = [];
      if (refinement?.controls && spec.gate) {
        const exported = json(Buffer.from(sceneJson));
        const control = exported.landmarks.control;
        const validateControl = (contact: typeof exported) => {
          const marker = contact.landmarks.control;
          assert.ok(marker.stand[0] === marker.at[0] && marker.stand[1] - marker.at[1] === 11, 'CONTROL_OUT_OF_REACH');
          return validateSpatial({ ...contact,
            anchors: { ...contact.anchors, boarding: marker.stand },
            connection: { ...contact.connection, to: marker.stand },
          });
        };
        maintenanceSteps = validateControl(exported).counts.routeLength;
        assert.ok(frame.legacy.metadata.occlusion.some(e =>
          e.id === 'mooring-1' && e.visible / e.visibleBefore >= .85), 'CONTROL_OCCLUDED');
        const handleOffset = (control.handle[1] * frame.scene.w + control.handle[0]) * 4;
        assert.equal(frame.legacy.layerOverlay.rgba.readUInt32BE(handleOffset), pack(frame.legacy.metadata.atlas.layerLegend.prop),
          'CONTROL_HANDLE_NOT_DRAWN');
        const [x, y] = spec.gate.at;
        for (let py = y - 13; py < y - 3; py++) for (let px = x - 7; px < x + 7; px++) {
          const offset = (py * frame.scene.w + px) * 4;
          if (gameplay.masks.water.rgba[offset + 3] &&
            (water[light].map(pack).includes(frame.scene.rgba.readUInt32BE(offset)))) apertureWater++;
        }
        assert.ok(apertureWater >= 35, 'INTAKE_APERTURE_OCCLUDED');
        if (light === 'day') {
          exported.landmarks.control.stand[1] += 20;
          assert.throws(() => validateControl(exported), /CONTROL_OUT_OF_REACH/);
          negative.push('CONTROL_OUT_OF_REACH');
        }
      }
      if (candidate && light === 'day') negative = [...negative, ...verifyNegativeCases(spatial, frame, tiles)];
      let collisionPixelsChanged = 0, walkPixelsChanged = 0;
      const oldGameplay = validateSpatial(earlierSpatial);
      const diff = makeRaster(frame.scene.w, frame.scene.h);
      for (let i = 0; i < frame.scene.rgba.length; i += 4) {
        if (gameplay.masks.collision.rgba[i + 3] !== oldGameplay.masks.collision.rgba[i + 3]) collisionPixelsChanged++;
        if (gameplay.masks.walkable.rgba[i + 3] !== oldGameplay.masks.walkable.rgba[i + 3]) walkPixelsChanged++;
        if (refinement && frame.scene.rgba.readUInt32BE(i) !== earlier.scene.rgba.readUInt32BE(i)) {
          put(diff, i / 4 % diff.w, Math.floor(i / 4 / diff.w), pack('#f2bb84'));
        }
      }
      if (candidate) {
        const again = renderFunctionalWaterfront(base, spec, water, light);
        assert.deepEqual(again.scene, frame.scene);
        assert.equal(sha256(encodePng(again.scene)), sha256(encodePng(frame.scene)));
        assert.deepEqual(spatialExport(spec, again, half, pinnedSpec.sha256), spatial);
      }
      if (!archive) {
        png(folder + light, frame.scene);
        png(folder + light + '-4x', nearestNeighbor(frame.scene, 4));
        png(folder + 'atlas-' + light, tiles.atlas);
        png(folder + 'tilemap-' + light, replay.preview);
        png(folder + 'foreground-' + light, tiles.foreground);
        png(folder + 'shore-' + light, crop(frame.scene, frame.layout.entry[0] - 16, frame.layout.entry[1] - 27, 106, 66));
        save(folder + 'scene-' + light + '.json', sceneJson);
        save(folder + 'tilemap-' + light + '.json', stable(tiles.tilemap));
        if (light === 'day') {
          const flat = candidate ? renderFunctionalWaterfront(base, spec, water, light, true).scene
            : renderLanding(base, spec, variant, water, light, { flat: true }).scene;
          png(folder + 'flat', flat);
          png(folder + 'regions', frame.surfaces.semantic);
          png(folder + 'walkability', routeOverlay(frame.scene, gameplay.masks.walkable, gameplay.route));
          png(folder + 'collision', diagnosticOverlay(frame.scene, gameplay.masks.collision, '#ff876f'));
          png(folder + 'layers', layerInspection(frame));
        }
      }
      if (refinement && light === 'day') {
        png(folder + 'material-modules', refinement.outlines);
        png(folder + 'diff-b1', diff);
      }
      const [px, py] = frame.layout.lip;
      png(folder + 'berth-' + light, crop(frame.scene, px - 68, py - 33, 88, 66));
      if (spec.gate) png(folder + 'mechanism-' + light, crop(frame.scene, spec.gate.at[0] - 48, spec.gate.at[1] - 48, 96, 84));
      metrics.push({ light, counts: gameplay.counts, occlusion, seams: replay.seams, cells: tiles.tilemap.cells.length,
        pngSha256: sha256(encodePng(frame.scene)), rgbaSha256: sha256(frame.scene.rgba), maintenanceSteps,
        apertureWater, collisionPixelsChanged, walkPixelsChanged, change: refinement?.qa ?? null, negative });
      console.log(spec.id, variant, light, 'PASS', gameplay.counts.routeLength, maintenanceSteps, apertureWater);
    }
    variants.push({ variant, archive, sameGeometry, metrics });
  }
  cases.push({ id: spec.id, name: spec.name, brief: spec.brief, role: studyRole, seed: spec.seed, source: pinnedSpec, variants });
}
const status = values.known ? 'KNOWN_CASES_ONLY' : 'E7_6R_READY_FOR_FINAL_HUMAN_ENVIRONMENT_REVIEW';
save('benchmark.json', stable({ version: 1, status, approval: 'UNREVIEWED', baseline: rules.base, rules: rules.criteria,
  historyMatches: old.length, aiCalls: 0, freshFreeze: values.known ? null : sha256(read(seal)), cases, files: fileHashes }));
const sums = Object.entries(fileHashes).sort(([a], [b]) => a < b ? -1 : a === b ? 0 : 1).map(([name, hash]) => hash + '  ' + name);
save('SHA256SUMS', sums.join('\n') + '\n');
console.log('E7.6R PASS', cases.length, sums.length, old.length);
