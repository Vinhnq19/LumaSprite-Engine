import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { pack } from '../src/core/palette/colors.ts';
import { makeRaster, nearestNeighbor } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { crossAssetStyle, loadArtDirection } from '../src/experiments/art-direction.ts';
import type { PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { buildTiles, diagnosticOverlay, layerInspection, spatialExport, validateOcclusion, validateSpatial,
  verifyNegativeCases, verifyTiles } from '../src/experiments/semantic-environment-export.ts';
import { prepareSemantic, renderLanding, routeOverlay, semanticScene, type WaterPalette } from '../src/experiments/semantic-environment.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { sha256 } from '../src/quality/raster.ts';
import type { Raster } from '../src/core/pixels/raster.ts';

const { values } = parseArgs({ options: { publish: { type: 'boolean' }, development: { type: 'boolean' }, freeze: { type: 'boolean' }, out: { type: 'string' } } });
assert.ok([values.publish, values.development, values.freeze, values.out].filter(Boolean).length <= 1);
const inputs = 'benchmarks/fixtures/e76/';
const read = (file: string) => readFileSync(file);
const json = (file: Buffer) => JSON.parse(file.toString('utf8'));
const stable = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const lockSha = '74ffcc6a4bebd941bb60229030bee1eb1dd3c45c266c18371548aaf5f7a064ab';
const lock = json(await pinnedFile({ file: inputs + 'pilot-lock.json', sha256: lockSha }));
const historical: Buffer = await pinnedFile(lock.baseline);
const past = historical.toString('utf8').trim().split(/\r?\n/);
assert.equal(past.length, 263);
for (const line of past) {
  const [hash, file] = line.split('  ');
  assert.equal(sha256(read(file)), hash, file);
}
const water: WaterPalette = lock.water;
for (const light of ['day', 'night'] as const) assert.equal(new Set(water[light]).size, 4);
const { spec: direction, profile } = await loadArtDirection(json(await pinnedFile(lock.style)));
const style = crossAssetStyle(profile, direction).profile;
const sources = [inputs + 'pilot-lock.json', ...lock.cases.map((item: { file: string }) => item.file),
  'scripts/benchmark-e76.ts', 'src/experiments/semantic-environment.ts', 'src/experiments/semantic-environment-export.ts'];
const fingerprints = () => Object.fromEntries(sources.map(file => [file, sha256(read(file))]));
const freezeFile = inputs + 'floodgate-freeze.json';
const decision = { defectId: 'MF-01', selected: 'original', status: 'NO_MEANINGFUL_VISUAL_GAIN',
  concern: 'The boarding edge is thin at native size.',
  rootCause: 'The end of the deck uses the same implicit top and front edge hierarchy as the rest of the dock.',
  source: 'paintSurfaces() timber walkway in semantic-environment.ts',
  target: 'The three-pixel-wide interior band immediately before the boarding lip.',
  protected: 'All pixels outside the target, all foreground actors and solid props, every geometry and navigation mask.',
  humanReview: 'UNREVIEWED' };
if (values.freeze) {
  const dev = '.cache/e76-development/benchmark.json';
  const benchmark = json(read(dev));
  assert.equal(benchmark.cases.length, 1);
  assert.equal(benchmark.cases[0].role, 'development');
  assert.deepEqual(benchmark.cases[0].refinement.decision, decision);
  writeFileSync(freezeFile, stable({ version: 1, conditions: 'Fresh holdout locked after development and before any holdout render.',
    inputs: fingerprints(), developmentReportSha256: sha256(read(dev)), decision }));
  process.exit(0);
}
if (!values.development) {
  const freeze = json(read(freezeFile));
  assert.deepEqual(freeze.inputs, fingerprints(), 'FROZEN_HOLDOUT_SOURCES_CHANGED');
  assert.deepEqual(freeze.decision, decision, 'FROZEN_REFINEMENT_DECISION_CHANGED');
}
const published = 'benchmarks/results/e76/';
const out = values.out ?? (values.publish ? published : values.development ? '.cache/e76-development' : 'benchmarks/results/run/e76');
const files: Record<string, string> = {};
const save = (file: string, value: Buffer | string) => {
  const path = join(out, file);
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  mkdirSync(path.slice(0, slash), { recursive: true });
  writeFileSync(path, value);
  files[file] = sha256(Buffer.from(value));
};
const picture = (file: string, raster: Raster) => {
  const png = encodePng(raster);
  assert.deepEqual(decodePng(png), raster, 'PNG_RGBA_ROUNDTRIP');
  save(file + '.png', png);
  return png;
};
const closeup = (raster: Raster, x: number, y: number, w: number, h: number) => {
  const result = makeRaster(w, h);
  for (let row = 0; row < h; row++) {
    const at = ((row + y) * raster.w + x) * 4;
    raster.rgba.copy(result.rgba, row * w * 4, at, at + w * 4);
  }
  return result;
};
const cases = [];
for (const ref of lock.cases.slice(0, values.development ? 1 : 2)) {
  const spec = semanticScene.parse(json(await pinnedFile(ref)));
  assert.deepEqual(spec.profile, lock.profile);
  assert.deepEqual(spec.style, lock.style);
  const heritage: PilotBrief = json(await pinnedFile(spec.base));
  const base = await prepareSemantic(spec, heritage, style);
  const surveyor = base.environment.assets.get('surveyor')!;
  const half = surveyor.scale!.bodyHalfWidth;
  const options = [];
  const notes = [];
  for (const mode of ['a0', 'b1'] as const) {
    const folder = spec.id + '/' + mode + '/';
    const illumination = [];
    let geometryHash = '';
    let negative: string[] = [];
    for (const light of ['day', 'night'] as const) {
      const frame = renderLanding(base, spec, mode, water, light);
      const repeat = renderLanding(base, spec, mode, water, light);
      assert.deepEqual(frame.scene, repeat.scene, 'DETERMINISTIC_RGBA');
      assert.ok(encodePng(frame.scene).equals(encodePng(repeat.scene)), 'DETERMINISTIC_PNG');
      const spatial = spatialExport(spec, frame, half, ref.sha256);
      for (const prop of spatial.entities.filter(entity => entity.kind === 'prop' && entity.id !== 'sluice')) {
        assert.ok(prop.w <= surveyor.raster.w * 2.5 && prop.h <= surveyor.raster.h * 1.2, 'PROP_SCALE');
      }
      const layoutHash = sha256(Buffer.from(stable(spatial.masks)));
      if (light === 'day') geometryHash = layoutHash;
      else assert.equal(layoutHash, geometryHash, 'DAY_NIGHT_GEOMETRY_DIVERGENCE');
      const sceneJson = stable(spatial);
      const inspected = validateSpatial(JSON.parse(sceneJson));
      const layers = validateOcclusion(frame.scene, frame);
      const tiles = buildTiles(base, frame, light);
      const atlasPng = picture(folder + 'atlas-' + light, tiles.atlas);
      const foregroundPng = picture(folder + 'foreground-' + light, tiles.foreground);
      const tilemapJson = stable(tiles.tilemap);
      const replay = verifyTiles(decodePng(atlasPng), JSON.parse(tilemapJson), decodePng(foregroundPng), tiles.ground);
      if (light === 'day') {
        picture(folder + 'flat', renderLanding(base, spec, mode, water, light, { flat: true }).scene);
        picture(folder + 'regions', frame.surfaces.semantic);
        picture(folder + 'walkability', routeOverlay(frame.scene, inspected.masks.walkable, inspected.route));
        picture(folder + 'collision', diagnosticOverlay(frame.scene, inspected.masks.collision, '#ff876f'));
        picture(folder + 'layers', layerInspection(frame));
      }
      if (light === 'day' && mode === 'b1') negative = verifyNegativeCases(spatial, frame, tiles);
      picture(folder + light, frame.scene);
      picture(folder + light + '-4x', nearestNeighbor(frame.scene, 4));
      const [x, y] = frame.layout.entry;
      picture(folder + 'shore-' + light, closeup(frame.scene, x - 14, y - 28, 105, 70));
      picture(folder + 'tilemap-' + light, replay.preview);
      save(folder + 'scene-' + light + '.json', sceneJson);
      save(folder + 'tilemap-' + light + '.json', tilemapJson);
      if (spec.role === 'development' && mode === 'b1') {
        const trial = renderLanding(base, spec, 'b1', water, light, { refine: true });
        const diff = makeRaster(frame.scene.w, frame.scene.h);
        const owner = pack(frame.legacy.metadata.atlas.layerLegend.actor);
        const owners = layerInspection(frame);
        const overlay = frame.legacy.metadata.atlas.layerLegend;
        const protectedColors = new Set([owner, pack(overlay.building), pack(overlay.prop)]);
        let changed = 0;
        for (let i = 0; i < diff.rgba.length; i += 4) {
          if (frame.scene.rgba.readUInt32BE(i) === trial.scene.rgba.readUInt32BE(i)) continue;
          assert.ok(trial.surfaces.target.rgba[i + 3] && !protectedColors.has(owners.rgba.readUInt32BE(i)), 'REFINEMENT_OUTSIDE_TARGET');
          diff.rgba.writeUInt32BE(pack('#f2b759'), i);
          changed++;
        }
        assert.ok(changed > 0);
        assert.deepEqual(spatialExport(spec, trial, half, ref.sha256), spatial, 'REFINEMENT_CHANGED_GAMEPLAY');
        picture(folder + 'rim-trial-' + light, trial.scene);
        picture(folder + 'rim-mask-' + light, trial.surfaces.target);
        picture(folder + 'rim-diff-' + light, diff);
        notes.push({ light, changed, outsideTarget: 0, geometryUnchanged: true, gameplayUnchanged: true,
          before: files[folder + light + '.png'], after: files[folder + 'rim-trial-' + light + '.png'] });
      }
      illumination.push({ light, rgbaSha256: sha256(frame.scene.rgba), pngSha256: files[folder + light + '.png'],
        paletteInks: frame.legal, atlasTiles: tiles.tilemap.cells.length, seamSamples: replay.seams,
        ...inspected.counts, ...layers, route: inspected.route });
      console.log(spec.id, mode, light, 'PASS', inspected.counts, layers);
    }
    options.push({ mode, geometryHash, negative, illumination });
  }
  cases.push({ id: spec.id, name: spec.name, brief: spec.brief, role: spec.role, seed: spec.seed, dimensions: spec.size,
    sourceSha256: ref.sha256, variants: options,
    refinement: spec.role === 'development' ? { decision, evidence: notes } : null });
}
const manifest = { version: 1, status: values.development ? 'DEVELOPMENT_ONLY' : 'E7_6_READY_FOR_HUMAN_ENVIRONMENT_REVIEW',
  approval: 'UNREVIEWED', checkpoint: lock.checkpoint, implementationParent: lock.implementationParent, lockSha256: lockSha,
  freeze: values.development ? null : sha256(read(freezeFile)), caseCount: cases.length, seedPolicy: 'same per pair',
  paidAiCalls: 0, e75rBaselineMatches: past.length, criteria: lock.criteria, cases };
save('benchmark.json', stable({ ...manifest, files }));
const sums = Object.entries(files).sort(([a], [b]) => a < b ? -1 : a === b ? 0 : 1).map(([file, hash]) => hash + '  ' + file);
save('SHA256SUMS', sums.join('\n') + '\n');
console.log('E7.6 PASS · ' + cases.length + ' case(s) · ' + sums.length + ' files · ' + past.length + ' E7.5R files unchanged.');
