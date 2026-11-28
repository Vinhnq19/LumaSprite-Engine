import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { blit, composite, makeRaster } from '../src/core/pixels/raster.ts';
import { sha256 } from '../src/quality/raster.ts';

function unzipStoredOrDeflate(buf: Buffer): Record<string, Buffer> {
  const entries: Record<string, Buffer> = {};
  for (let o = 0; o + 30 <= buf.length && buf.readUInt32LE(o) === 0x04034b50;) {
    const method = buf.readUInt16LE(o + 8);
    assert.equal(method, 0, `Unsupported ZIP compression method ${method}`);
    const len = buf.readUInt32LE(o + 18);
    const nl = buf.readUInt16LE(o + 26);
    const el = buf.readUInt16LE(o + 28);
    const start = o + 30 + nl + el;
    const name = buf.toString('utf8', o + 30, o + 30 + nl);
    entries[name] = buf.subarray(start, start + len);
    o = start + len;
  }
  return entries;
}

const zipPath = 'D:/LumaSprite-Engine/.cache/e85-studio-zips/e8-mistfen-ferry-landing-day-e84-export.zip';
const zipBytes = readFileSync(zipPath);
const zipStat = statSync(zipPath);
const zipSha256 = sha256(zipBytes);
assert.equal(zipStat.size, 163438);
assert.equal(zipSha256, 'b7606778e555e2f048356c1dbb6c89be7bbc9315683e7c0e88d99c6c4d779754');

const files = unzipStoredOrDeflate(zipBytes);
const manifest = JSON.parse(files['export-manifest.json'].toString('utf8'));
const sidecar = JSON.parse(files['studio-scene-sidecar.json'].toString('utf8'));
const scene = JSON.parse(files['mistfen-ferry-landing/day/scene.json'].toString('utf8'));

for (const [entryPath, expectedSha] of Object.entries(manifest.fileHashes)) {
  assert.ok(Object.hasOwn(files, entryPath), `Missing ZIP entry ${entryPath}`);
  assert.equal(sha256(files[entryPath]), expectedSha, `SHA mismatch for ${entryPath}`);
}

assert.equal(scene.id, 'mistfen-ferry-landing');
assert.equal(scene.light, 'day');
assert.deepEqual(scene.spawn, { x: 117, y: 174 });
assert.equal(scene.route.length, 183);
assert.deepEqual(scene.route[0], { x: 117, y: 174 });
assert.deepEqual(scene.route[scene.route.length - 1], scene.landmark.stand);
assert.equal(manifest.studioRevision, 8);
assert.equal(manifest.approval.status, 'APPROVED');
assert.equal(manifest.approval.note, 'Live QA verified');
assert.equal(sidecar.unityCompatibility.directE8ImportCompatible, true);

// Reconstruct expected World-only composite RGBA directly from the Studio ZIP PNGs & scene JSON
const atlas = decodePng(files['mistfen-ferry-landing/day/atlas.png']);
const correction = decodePng(files['mistfen-ferry-landing/day/underlay-correction.png']);
const ground = makeRaster(scene.width, scene.height);
const cols = scene.tiles.atlasColumns;
const tileSize = scene.tiles.size;
const gridCols = scene.width / tileSize;
for (let i = 0; i < scene.tiles.ids.length; i++) {
  const tid = scene.tiles.ids[i];
  const sx = (tid % cols) * tileSize;
  const sy = Math.floor(tid / cols) * tileSize;
  const dx = (i % gridCols) * tileSize;
  const dy = Math.floor(i / gridCols) * tileSize;
  for (let y = 0; y < tileSize; y++) {
    for (let x = 0; x < tileSize; x++) {
      ground.rgba.writeUInt32BE(atlas.rgba.readUInt32BE(((sy + y) * atlas.w + sx + x) * 4), ((dy + y) * ground.w + dx + x) * 4);
    }
  }
}
const composed = composite([ground, correction]);
for (const layer of scene.layers) {
  const tex = decodePng(files[`${layer.texture}.png`]);
  blit(composed, tex, layer.at.x - layer.pivot.x, layer.at.y - layer.pivot.y);
}
const expectedCompositeSha = sha256(composed.rgba);
assert.equal(expectedCompositeSha, scene.source.rgba, 'STUDIO_ZIP_RGBA_SELF_CONSISTENT');

// Confirm this edited X=117 composite visibly differs from original locked X=113 Engine PNG
const lockedOrig = decodePng(readFileSync('D:/LumaSprite-Engine/benchmarks/results/e76r/mistfen-ferry-landing/b2/day.png'));
let diffPixelsVsX113 = 0;
for (let i = 0; i < composed.rgba.length; i += 4) {
  if (composed.rgba.readUInt32BE(i) !== lockedOrig.rgba.readUInt32BE(i)) diffPixelsVsX113++;
}
assert.ok(diffPixelsVsX113 > 0, 'X=117 override must visually differ from locked X=113 Engine scene');

const outPath = 'D:/LumaSprite-Engine/benchmarks/results/run/e85/phase-a-smoke.json';
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(join('D:/LumaSprite-Engine/.cache/e85-studio-zips', 'e8-mistfen-day-e84-expected.png'), encodePng(composed));

const report = {
  phase: 'Phase A — Real Studio ZIP Smoke Test (Pre-Bridge Audit)',
  zipPath,
  zipBytes: zipStat.size,
  zipSha256,
  sourceEngineRevision: manifest.sourceRevision,
  protectedSha256: manifest.protectedSha256,
  studioRevision: manifest.studioRevision,
  approval: manifest.approval,
  sceneSpawn: scene.spawn,
  routeLength: scene.route.length,
  layersCount: scene.layers.length,
  manifestFilesVerified: Object.keys(manifest.fileHashes).length,
  studioZipRgbaSha256: expectedCompositeSha,
  pixelDiffVsLockedEngineX113: diffPixelsVsX113,
  preBridgeUnityGaps: [
    'UNMODIFIED_E8BUILD_READS_RESOURCES_NOT_ZIP: E8Build.cs reads pre-extracted Resources/E8Input/ and has no ZIP + export-manifest.json + studio-scene-sidecar.json importer.',
    'UNMODIFIED_HUD_HARDCODES_PROMPTS: E8InteractionHud.PromptFor(scene.id) hardcodes scene prompt strings instead of reading Studio interaction.label / linkedEntityId.',
    'UNMODIFIED_E8SMOKE_ASSUMES_EQUAL_STEPS: E8Smoke.cs compares Day/Night step counts directly, which fails when Day has Studio spawn override (X=117, 182 steps) vs original (X=113, 186 steps).',
  ],
  status: 'SMOKE_VERIFIED_BRIDGE_NEEDED',
};
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log('PHASE_A_SMOKE_PASS', 'size=' + zipStat.size, 'sha=' + zipSha256.slice(0, 12), 'spawnX=' + scene.spawn.x, 'diffVsX113=' + diffPixelsVsX113);
