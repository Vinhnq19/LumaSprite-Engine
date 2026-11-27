import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { nearestNeighbor } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const { values } = parseArgs({ options: { publish: { type: 'boolean' } } });
const run = 'benchmarks/results/run/e8/', published = 'benchmarks/results/e8/';
const runtimeRoot = '.cache/e8-runtime-acceptance/';
const inPath = runtimeRoot + 'Assets/Resources/E8Input/';
const read = readFileSync;
const json = (path: string) => JSON.parse(read(path, 'utf8'));
const stable = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const out = values.publish ? published : run;
const files: Record<string, string> = {};
function save(name: string, data: Buffer) {
  const path = join(out, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  files[name] = sha256(data);
}
const bundle = json(inPath + 'bundle.json');
assert.equal(Object.keys(bundle.files).length, 95);
for (const [name, hash] of Object.entries(bundle.files)) assert.equal(sha256(read(inPath + name)), hash, name);
const regressionFile = '.cache/e8-regression.json';
const engineQa = json(existsSync(regressionFile) ? regressionFile : published + 'engine-regression.json');
assert.deepEqual(engineQa.engineTests, { passed: 76, total: 76 });
const runtime = json(run + 'runtime.json'), importer = json(run + 'unity-import.json');
assert.equal(importer.editor, '6000.3.21f1');
assert.equal(importer.target, 'StandaloneWindows64');
assert.deepEqual([importer.maps, importer.foregroundTextures, importer.tileSize, importer.ppu], [6, 6, 16, 32]);
assert.ok(importer.textures.every((row: { filter: string; mipCount: number; compression: string }) =>
  row.filter === 'Point' && row.mipCount === 1 && row.compression === 'Uncompressed'));
assert.equal(runtime.platform, 'WindowsPlayer');
assert.equal(runtime.revision, bundle.revision);
assert.equal(runtime.editor, importer.editor);
assert.equal(runtime.cases.length, 6);
assert.equal(runtime.timingBoundaries, true);
assert.deepEqual([runtime.idleCycleMs, runtime.walkCycleMs], [1800, 880]);
const tests = [];
for (const mode of ['EditMode', 'PlayMode']) {
  const bytes = read(run + mode + '.xml');
  const result = /<test-run\b[^>]*\bresult="Passed"[^>]*>/.exec(bytes.toString('utf8'));
  assert.ok(result, 'Unity test results ' + mode);
  const count = Number(/\bpassed="(\d+)"/.exec(result[0])?.[1]);
  assert.ok(count > 0);
  tests.push({ mode, result: 'PASS', passed: count });
  save(mode + '.xml', Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n')));
}
for (const log of ['e8-build.log','e8-player.log','e8-EditMode.log','e8-PlayMode.log']) {
  const raw = read(runtimeRoot + log, 'utf8');
  assert.ok(!/\berror CS\d+\b|\b(?:NullReferenceException|InvalidDataException|ArgumentException):/.test(raw), log);
}
const captureInfo = [];
const parity = [];
for (const row of runtime.cases) {
  const isCanal = row.id === 'canal-intake-service-platform';
  const prefix = row.id + '/b2/';
  const staging = json(inPath + row.id + '/' + row.light + '/scene.json');
  assert.equal(row.atlasCells, 260);
  assert.ok(row.atDestination && row.saveReload && row.colliderAgreement && row.stablePivot &&
    row.reachRejectsRemote && row.dayNightAligned && row.interactionEvents === 1 && row.sortOrderChanges > 0, prefix + row.light);
  assert.equal(row.steps, staging.route.length - 1);
  assert.ok(row.probes.every((p: { physics: boolean; rejected: boolean }) => p.physics && p.rejected));
  assert.equal(row.walkFramesSeen.length, runtime.walkDurations.length);
  assert.equal(row.idleFramesSeen.length, runtime.idleDurations.length);
  const native = decodePng(read(run + row.staticCapture));
  const locked = decodePng(read('benchmarks/results/e76r/' + prefix + row.light + '.png'));
  assert.deepEqual([native.w, native.h], [320, 208]);
  let differences = 0, largestChannelDelta = 0, first: number[] | null = null;
  for (let i = 0; i < native.rgba.length; i += 4) {
    if (native.rgba.readUInt32BE(i) === locked.rgba.readUInt32BE(i)) continue;
    differences++;
    first ??= [i / 4 % native.w, Math.floor(i / 4 / native.w), native.rgba.readUInt32BE(i), locked.rgba.readUInt32BE(i)];
    for (let c = 0; c < 4; c++) largestChannelDelta = Math.max(largestChannelDelta, Math.abs(native.rgba[i + c] - locked.rgba[i + c]));
  }
  parity.push({ scene: row.id, light: row.light, identicalPixels: 320 * 208 - differences, differences, largestChannelDelta,
    firstDifference: first, unityRgba: sha256(native.rgba), lockedRgba: sha256(locked.rgba) });
  if (isCanal) {
    assert.deepEqual([row.apertureVisible, row.apertureThreshold], [19, 35]);
    assert.ok(row.apertureStaging >= row.apertureThreshold);
  }
  for (const [kind, name] of [['spawn', row.staticCapture], ['interaction', row.routeCapture], ['staging', row.stagingCapture]]) {
    if (!name) continue;
    const raw = read(run + name);
    const raster = decodePng(raw);
    assert.equal(raster.w, 320);
    assert.equal(raster.h, 208);
    save(name, raw);
    const zoom = name.replace('.png', '-4x.png');
    save(zoom, encodePng(nearestNeighbor(raster, 4)));
    captureInfo.push({ scene: row.id, light: row.light, kind, native: name, zoom,
      nativePngSha256: files[name], zoomPngSha256: files[zoom], provenance: 'Unity Camera.Render + GPU RenderTexture readback' });
  }
  const stageKey = row.id + '-' + row.light;
  save('contract/' + stageKey + '.json', stable({ id: staging.id, light: staging.light, clearance: staging.clearance,
    spawn: staging.spawn, landmark: staging.landmark, source: staging.source, aperture: staging.aperture,
    colliderBoxes: staging.collision.length, tiles: staging.tiles.ids.length }));
}
for (const name of ['unity-import.json', 'runtime.json']) save(name, read(run + name));
save('bundle-manifest.json', read(inPath + 'bundle.json'));
const lock = runtimeRoot + 'Packages/packages-lock.json';
assert.ok(existsSync(lock));
save('unity-packages.json', read(lock));
const maxDiff = Math.max(...parity.map(x => x.differences));
const status = maxDiff === 0 ? 'E8_RUNTIME_PILOT_READY_FOR_OWNER_ACCEPTANCE' : 'E8_RUNTIME_TECHNICAL_BLOCKED';
save('verification.json', stable({ status, acceptance: 'UNREVIEWED', engineRevision: bundle.revision,
  evidenceType: 'Windows Standalone · native GPU captures', tests, captureInfo, parity,
  engineQa, input: { runtimeMotor: 'PASS', physicalKeyboardVerification: 'NOT_RUN', reason: 'Harness drives the same methods directly. The interactive Windows process launched, but foreground could not be confirmed consistently for the key sequence.' },
  render: { exact: maxDiff === 0, width: 320, height: 208, ppu: 32, runtimeCapture: true },
  ownerArt: 'PENDING', production: 'NOT_AUTHORIZED', knownFailure: 'INTAKE_APERTURE_OCCLUDED', aiCalls: 0,
}));
save('engine-regression.json', stable(engineQa));
const manifest = Object.entries(files).sort(([a], [b]) => a < b ? -1 : a === b ? 0 : 1).map(([name, hash]) => hash + '  ' + name);
writeFileSync(join(out, 'SHA256SUMS'), manifest.join('\n') + '\n');
console.log(status, parity, captureInfo.length, 'actual camera captures', manifest.length, 'verified evidence files');
if (maxDiff) process.exitCode = 1;
