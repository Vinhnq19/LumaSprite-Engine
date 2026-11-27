import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const raw = 'benchmarks/results/run/e83/';
const out = 'benchmarks/results/e83/';
const old = 'benchmarks/results/e8/';
const read = readFileSync;
const json = (path: string) => JSON.parse(read(path, 'utf8'));
const write = (name: string, bytes: Buffer | string) => {
  const file = out + name;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  hashes[name] = sha256(Buffer.from(bytes));
};
const hashes: Record<string, string> = {};
const save = (name: string) => write(name, read(raw + name));
const report = json(raw + 'runtime.json');
const importer = json(raw + 'unity-import.json');
const runPackage = '.cache/e8-runtime-acceptance/Assets/Resources/E8Input/bundle.json';
const priorEvidence = Object.fromEntries(read(old + 'SHA256SUMS', 'utf8').trim().split(/\r?\n/).map(x => x.split('  ').reverse()));
assert.deepEqual(read(runPackage), read(old + 'bundle-manifest.json'), 'E83_CHANGED_E8_ADAPTER_PAYLOADS');
assert.deepEqual([report.editor, report.platform, report.width, report.height, report.ppu, report.targetFps],
  ['6000.3.21f1', 'WindowsPlayer', 320, 208, 32, 60]);
assert.ok(report.startupToAwakeMs > 0 && report.awakeToSceneMs > 0 && report.processToFirstWorldCaptureMs > report.startupToAwakeMs);
assert.equal(importer.maps, 6);
assert.ok(report.timingBoundaries);
const testResults = [];
for (const [mode, expected] of [['EditMode', 4], ['PlayMode', 1]] as const) {
  const file = mode + '.xml';
  const result = /<test-run\b[^>]*\bresult="Passed"[^>]*>/.exec(read(raw + file, 'utf8'));
  const passed = Number(/\bpassed="(\d+)"/.exec(result?.[0] ?? '')?.[1]);
  assert.equal(passed, expected);
  testResults.push({ mode, passed });
  write(file, read(raw + file, 'utf8').replaceAll('\r\n', '\n'));
}
for (const file of ['e8-build.log', 'e8-EditMode.log', 'e8-PlayMode.log', 'e8-player.log']) {
  const log = read('.cache/e8-runtime-acceptance/' + file, 'utf8');
  assert.ok(!/\berror CS\d+\b|(?:NullReferenceException|InvalidDataException|ArgumentException):/.test(log), file);
}
const captures = [];
const cues = [];
assert.equal(report.cases.length, 6);
const scale = Math.floor(Math.min(report.screenWidth / 320, report.screenHeight / 232));
assert.ok(scale >= 1);
const left = Math.floor((report.screenWidth - 320 * scale) / 2);
const top = Math.floor((report.screenHeight - 232 * scale) / 2) + 24 * scale;
for (const row of report.cases) {
  assert.ok(row.reachRejectsRemote && row.sharedPress && row.duplicateRejected && row.promptLeavesRange && row.promptReset &&
    row.feedbackResets && row.feedbackExpires && row.saveReload && row.dayNightAligned && row.stablePivot && row.colliderAgreement);
  assert.ok(row.probes.every((p: { physics: boolean; rejected: boolean }) => p.physics && p.rejected));
  assert.equal(row.interactionEvents, 1);
  assert.ok(row.steadyFrames > 50 && row.warmupMs > 0 && row.captureMs > 0 && row.steadyP95Ms > 0);
  const frozen = decodePng(read('benchmarks/results/e76r/' + row.id + '/b2/' + row.light + '.png'));
  const native = decodePng(read(raw + row.staticCapture));
  assert.deepEqual(native, frozen, 'WORLD_RENDER_PARITY ' + row.id + ' ' + row.light);
  for (const [kind, name] of [['spawn', row.staticCapture], ['interaction', row.routeCapture], ['staging', row.stagingCapture]]) {
    if (!name) continue;
    save(name);
    captures.push({ scene: row.id, light: row.light, kind, file: name, type: 'WORLD_RENDER_PARITY' });
  }
  for (const [state, name] of [['out-of-range', row.outOfRangeCapture], ['in-range', row.promptCapture], ['activated', row.feedbackCapture]]) {
    const screenshot = decodePng(read(raw + name));
    assert.equal(screenshot.w, report.screenWidth);
    assert.equal(screenshot.h, report.screenHeight);
    const color = (x: number, y: number) => screenshot.rgba.readUInt32BE((y * screenshot.w + x) * 4);
    const isGold = (ink: number) => (ink >>> 24) >= 244 && ((ink >>> 16) & 255) >= 201 &&
      ((ink >>> 16) & 255) <= 228 && ((ink >>> 8) & 255) >= 104 && ((ink >>> 8) & 255) <= 147;
    const markerX = left + row.marker.x * scale, markerY = top + row.marker.y * scale;
    let markerGold = 0, promptGold = 0, textLight = 0, worldMatches = 0;
    for (let y = markerY - 4 * scale; y < markerY + 5 * scale; y++) for (let x = markerX - 4 * scale; x < markerX + 5 * scale; x++)
      if (isGold(color(x, y))) markerGold++;
    for (let y = top - 21 * scale; y < top - 4 * scale; y++) for (let x = left + 8 * scale; x < left + 312 * scale; x++) {
      const ink = color(x, y);
      if (isGold(ink)) promptGold++;
      if ((ink >>> 24) >= 225 && ((ink >>> 16) & 255) >= 220 && ((ink >>> 8) & 255) >= 200) textLight++;
    }
    assert.ok(markerGold >= 8 * scale * scale, 'COMPOSITE_MARKER_NOT_VISIBLE ' + name);
    assert.ok(textLight >= 45, 'COMPOSITE_BARE_RAIL ' + name);
    assert.equal(promptGold > 20 * scale * scale, state === 'in-range', 'COMPOSITE_KEY_STATE ' + name);
    if (state === 'out-of-range') {
      for (let y = 0; y < 208; y++) for (let x = 0; x < 320; x++) {
        if (Math.abs(x - row.marker.x) <= 4 && Math.abs(y - row.marker.y) <= 4) continue;
        if (color(left + x * scale, top + y * scale) === native.rgba.readUInt32BE((y * 320 + x) * 4)) worldMatches++;
      }
      assert.equal(worldMatches, 320 * 208 - 81, 'COMPOSITE_VIEWPORT_ALIGNMENT ' + name);
    }
    save(name);
    cues.push({ scene: row.id, light: row.light, state, markerGold, promptGold, textLight, worldMatches });
    captures.push({ scene: row.id, light: row.light, kind: state, file: name, type: 'COMPOSITED_RUNTIME_UI_CAPTURE' });
  }
  if (row.id === 'canal-intake-service-platform') {
    assert.deepEqual([row.apertureVisible, row.apertureStaging, row.apertureThreshold], [19, 140, 35]);
    assert.ok(row.stagingWalkable && row.stagingDepth && row.stagingPath && row.stagingInteraction === 'static-maintenance-wheel');
  }
}
assert.deepEqual(report.animation.map((r: { frame: number }) => r.frame), [0, 1, 2, 3, 4, 5, 6, 7, 0, 0]);
assert.equal(report.animation[8].atMs, report.walkCycleMs);
assert.deepEqual(report.animation[8].position, report.animation[9].position);
for (const frame of report.animation) {
  const png = decodePng(read(raw + frame.file));
  assert.deepEqual([png.w, png.h], [320, 208]);
  save(frame.file);
}
const before = ['mistfen-ferry-landing-day-spawn.png', 'mistfen-ferry-landing-day-interaction.png'];
for (const name of before) {
  const bytes = read(old + name);
  assert.equal(sha256(bytes), priorEvidence[name]);
  write('before/' + name, bytes);
}
for (const name of ['runtime.json', 'unity-import.json']) save(name);
const engine = json(out + 'engine-regression.json');
assert.deepEqual(engine.engineTests, { passed: 76, total: 76 });
write('engine-regression.json', read(out + 'engine-regression.json'));
for (const file of ['human-review.json', 'owner-acceptance.json']) write(file, read(out + file));
write('verification.json', JSON.stringify({
  status: 'E8_3_READY_FOR_OWNER_INTERACTION_RETEST',
  base: 'a2f7ebb88c03f51bcbe94119f8e99b6a0c61a5e9',
  input: 'INTERACTION_LOGIC_AUTOMATED_PASS',
  owner: 'OWNER_MANUAL_ACCEPTANCE_E8 = 5/6_CONFIRMED',
  discoverability: 'INTERACTION_DISCOVERABILITY = REVISION_REQUIRED',
  retest: 'OWNER_INTERACTION_RETEST = PENDING',
  manualKeyboard: { status: 'NOT_RUN', reason: 'Windows foreground key delivery was not reliable at the E8 checkpoint. E8.3 exercises the identical key action method in Player. Owner verifies physical E in retest.' },
  animation: { technical: 'ANIMATION_TECHNICAL_PASS', artistic: 'ARTISTIC_MOTION_REVIEW_PENDING' },
  studio: { main: '593650101ed0cd2a54d045197911fc5b7a8bdd83', implementation: 'NOT_RUN – E8.4 design only' },
  parity: { exact: 6, total: 6 },
  tests: testResults, cues, captures, aiCalls: 0,
}, null, 2) + '\n');
writeFileSync(out + 'SHA256SUMS', Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b))
  .map(([name, digest]) => digest + '  ' + name).join('\n') + '\n');
console.log('E8.3 evidence PASS', Object.keys(hashes).length, 'files · 6 exact world captures · 18 composite states · 10 animation frames');
