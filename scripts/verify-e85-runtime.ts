import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const raw = 'benchmarks/results/run/e85/';
const out = 'benchmarks/results/e85/';
const zipsDir = '.cache/e85-studio-zips/';
const read = readFileSync;
const json = (path: string) => JSON.parse(read(path, 'utf8'));

const hashes: Record<string, string> = {};
const write = (name: string, bytes: Buffer | string) => {
  const file = out + name;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  hashes[name] = sha256(Buffer.from(bytes));
};
const save = (name: string) => write(name, read(raw + name));

function diffCount(a: Buffer, b: Buffer): number {
  assert.equal(a.length, b.length, 'RGBA buffer length mismatch');
  let diffs = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a.readUInt32BE(i) !== b.readUInt32BE(i)) diffs++;
  }
  return diffs;
}

const report = json(raw + 'runtime.json');
const importer = json(raw + 'unity-import.json');
const zipsManifest = json(zipsDir + 'zips-manifest.json');
const phaseASmoke = json(raw + 'phase-a-smoke.json');

assert.equal(phaseASmoke.zipBytes, 163438);
assert.equal(phaseASmoke.zipSha256, 'b7606778e555e2f048356c1dbb6c89be7bbc9315683e7c0e88d99c6c4d779754');
assert.deepEqual([report.editor, report.platform, report.width, report.height, report.ppu, report.targetFps],
  ['6000.3.21f1', 'WindowsPlayer', 320, 208, 32, 60]);
assert.equal(importer.studioZipsCount, 9);
assert.equal(importer.maps, 6);
assert.ok(report.timingBoundaries);

const testResults = [];
for (const [mode, expected] of [['EditMode', 7], ['PlayMode', 2]] as const) {
  const file = mode + '.xml';
  const result = /<test-run\b[^>]*\bresult="Passed"[^>]*>/.exec(read(raw + file, 'utf8'));
  const passed = Number(/\bpassed="(\d+)"/.exec(result?.[0] ?? '')?.[1]);
  assert.equal(passed, expected, `${mode} expected ${expected} passed, got ${passed}`);
  testResults.push({ mode, passed, total: expected });
  write(file, read(raw + file, 'utf8').replaceAll('\r\n', '\n'));
}

for (const file of ['e85-build.log', 'e85-EditMode.log', 'e85-PlayMode.log', 'e85-player.log']) {
  const log = read('.cache/e8-runtime-acceptance/' + file, 'utf8');
  assert.ok(!/\berror CS\d+\b|(?:NullReferenceException|InvalidDataException|ArgumentException):/.test(log), 'Unity log error in ' + file);
}

interface ZipManifestItem {
  targetSubdir: string;
  expectedPng: string;
  zipSha256: string;
}
interface StudioVariant {
  variant: string;
  id: string;
  spawnX: number;
  zipSha256: string;
  studioRevision: number;
  capture: string;
  promptCapture: string;
}

const captures: unknown[] = [];
const cues: unknown[] = [];
const expectedBySubdir = new Map<string, ZipManifestItem>(
  (zipsManifest.items as ZipManifestItem[]).map(it => [it.targetSubdir, it])
);

// Verify extra variants: verbatim Owner E8.4 ZIP (X=117) & Studio Rollback ZIP (X=113)
const ownerVar = (report.studioVariants as StudioVariant[]).find(v => v.variant === 'day-e84');
const rollbackVar = (report.studioVariants as StudioVariant[]).find(v => v.variant === 'day-rollback');
assert.ok(ownerVar && rollbackVar);
assert.equal(ownerVar.spawnX, 117);
assert.equal(ownerVar.zipSha256, 'b7606778e555e2f048356c1dbb6c89be7bbc9315683e7c0e88d99c6c4d779754');
assert.equal(ownerVar.studioRevision, 8);
assert.equal(rollbackVar.spawnX, 113);

const origMistfen = decodePng(read('benchmarks/results/e76r/mistfen-ferry-landing/b2/day.png'));
const ownerUnityWorld = decodePng(read(raw + ownerVar.capture));
const ownerSpec = expectedBySubdir.get('mistfen-ferry-landing/day-e84');
assert.ok(ownerSpec, 'Missing mistfen-ferry-landing/day-e84 in zips-manifest');
const ownerExpected = decodePng(read(ownerSpec.expectedPng));
assert.equal(diffCount(ownerUnityWorld.rgba, ownerExpected.rgba), 0, 'OWNER_E84_UNITY_WORLD_PARITY');
const ownerDiffVsX113 = diffCount(ownerUnityWorld.rgba, origMistfen.rgba);
assert.ok(ownerDiffVsX113 > 0, 'OWNER_E84_MUST_DIFFER_FROM_X113');

const rollbackUnityWorld = decodePng(read(raw + rollbackVar.capture));
assert.equal(diffCount(rollbackUnityWorld.rgba, origMistfen.rgba), 0, 'ROLLBACK_X113_WORLD_PARITY');

for (const v of report.studioVariants) {
  save(v.capture);
  save(v.promptCapture);
  captures.push({ scene: v.id, light: v.variant, kind: 'studio-variant', file: v.capture, promptFile: v.promptCapture });
}

// Verify all 6 primary Day/Night cases
assert.equal(report.cases.length, 6);
const scale = Math.floor(Math.min(report.screenWidth / 320, report.screenHeight / 232));
const left = Math.floor((report.screenWidth - 320 * scale) / 2);
const top = Math.floor((report.screenHeight - 232 * scale) / 2) + 24 * scale;

let mistfenDayDiffVsX113 = 0;
for (const row of report.cases) {
  assert.ok(row.reachRejectsRemote && row.sharedPress && row.duplicateRejected && row.promptLeavesRange && row.promptReset &&
    row.feedbackResets && row.feedbackExpires && row.saveReload && row.dayNightAligned && row.stablePivot &&
    row.colliderAgreement && row.linkedEntityResolved);
  assert.equal(row.approvalStatus, 'APPROVED');
  assert.ok(row.interactionLabel.length > 0);
  assert.equal(row.prompt, 'E · ' + row.interactionLabel);

  const subdir = `${row.id}/${row.light}`;
  const spec = expectedBySubdir.get(subdir);
  assert.ok(spec, 'Missing zips-manifest entry for ' + subdir);
  assert.equal(row.zipSha256, spec.zipSha256);

  const native = decodePng(read(raw + row.staticCapture));
  const expected = decodePng(read(spec.expectedPng));
  assert.equal(diffCount(native.rgba, expected.rgba), 0, `WORLD_RENDER_PARITY ${subdir}`);

  if (row.id === 'mistfen-ferry-landing' && row.light === 'day') {
    assert.equal(row.spawnX, 117);
    assert.equal(row.steps, 182);
    assert.equal(row.linkedEntityId, 'mooring-2');
    mistfenDayDiffVsX113 = diffCount(native.rgba, origMistfen.rgba);
    assert.ok(mistfenDayDiffVsX113 > 0, 'MISTFEN_DAY_MUST_SHOW_X117');
  }

  for (const [kind, name] of [['spawn', row.staticCapture], ['interaction', row.routeCapture], ['staging', row.stagingCapture]]) {
    if (!name) continue;
    save(name);
    if (kind === 'staging' && row.light === 'day') {
      const stSpec = expectedBySubdir.get('canal-intake-service-platform/day-staging');
      assert.ok(stSpec, 'Missing canal-intake-service-platform/day-staging in zips-manifest');
      const stExpected = decodePng(read(stSpec.expectedPng));
      const stActual = decodePng(read(raw + name));
      assert.equal(diffCount(stActual.rgba, stExpected.rgba), 0, 'CANAL_STAGING_WORLD_PARITY');
    }
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
    assert.ok(row.stagingWalkable && row.stagingDepth && row.stagingPath);
  }
}

for (const frame of report.animation) {
  const png = decodePng(read(raw + frame.file));
  assert.deepEqual([png.w, png.h], [320, 208]);
  save(frame.file);
}
for (const name of ['runtime.json', 'unity-import.json', 'phase-a-smoke.json']) save(name);
write('zips-manifest.json', read(zipsDir + 'zips-manifest.json'));
write('before-mistfen-day-x113.png', read('benchmarks/results/e76r/mistfen-ferry-landing/b2/day.png'));

const blankReview = {
  schemaVersion: 'lumasprite.e85.human-review.v1',
  milestone: 'E8.5 End-to-End Production Pipeline Acceptance',
  ownerAuthorization: 'E8_5_RESEARCH_INTEGRATION_AUTHORIZED',
  approvalStatus: 'PENDING_OWNER_END_TO_END_ACCEPTANCE',
  reviewer: '',
  reviewedAt: '',
  decision: '',
  checklist: {
    studioToUnityZipImport: '',
    surveyorX117AndRollback: '',
    dynamicInteractionLabelAndLinkedEntity: '',
    threeSceneDayNightAndCanalStaging: '',
    physicalKeyboardPlaythrough: '',
    gameReadyArtisticApproval: '',
  },
  notes: '',
};
write('human-review.json', JSON.stringify(blankReview, null, 2) + '\n');

const verification = {
  status: 'E8_5_READY_FOR_OWNER_END_TO_END_ACCEPTANCE',
  engineBase: '74c6e7722d92e5570977cd7760e6130c771c9179',
  studioHead: '471ac90555d3545beff5182146e291ba97b9ae20',
  studioSourceCommit: '59353475334bf0ef9635b01f606a2f8de509d5d9',
  ownerStudioZip: {
    file: 'e8-mistfen-ferry-landing-day-e84-export.zip',
    bytes: 163438,
    sha256: 'b7606778e555e2f048356c1dbb6c89be7bbc9315683e7c0e88d99c6c4d779754',
    diffPixelsVsX113: ownerDiffVsX113,
  },
  mistfenDayDynamicLabel: {
    zipFile: 'e8-mistfen-ferry-landing-day-label-e85.zip',
    spawnX: 117,
    diffPixelsVsX113: mistfenDayDiffVsX113,
    label: 'Kiểm tra cầu phà E8.5',
    linkedEntityId: 'mooring-2',
  },
  manualKeyboard: {
    status: 'NOT_RUN',
    reason: 'Scripted Player proof mode exercised E8World.Step/HandleInteractionPress/Save/Reload in LumaSpriteE85.exe; physical Owner keyboard playthrough remains part of Owner Acceptance checklist.',
  },
  tests: testResults,
  studioZipsImported: importer.studioZipsCount,
  worldRgbaParity: { exact: 6, total: 6, extraVariantsExact: 2 },
  cues,
  captures,
  aiCalls: 0,
};
write('verification.json', JSON.stringify(verification, null, 2) + '\n');
writeFileSync(out + 'SHA256SUMS', Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b))
  .map(([name, digest]) => digest + '  ' + name).join('\n') + '\n');

console.log('E8.5 verification PASS:', Object.keys(hashes).length, 'files · 6/6 + 2 variant World RGBA exact · ownerDiffVsX113=' + ownerDiffVsX113);
