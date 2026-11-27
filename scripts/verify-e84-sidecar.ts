import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { composite, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { normalizedTileMap } from '../src/experiments/runtime-integration.ts';
import { validateSpatial, verifyTiles } from '../src/experiments/semantic-environment-export.ts';
import { sha256 } from '../src/quality/raster.ts';

const base = 'benchmarks/results/e76r/mistfen-ferry-landing/b2/';
const manifest = JSON.parse(readFileSync('benchmarks/fixtures/e84/mistfen-scene-sidecar-proposal.json', 'utf8'));
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const ref = (file: string) => z.strictObject({ file: z.literal(file), sha256: digest });
const boundary = z.strictObject({ version: z.literal(1), kind: z.literal('lumasprite-studio-scene-sidecar-proposal'),
  caseId: z.literal('mistfen-ferry-landing'), variant: z.literal('b2'), light: z.literal('day'),
  sourceRevision: z.string().regex(/^[a-f0-9]{40}$/), studioMain: z.string().regex(/^[a-f0-9]{40}$/),
  approval: z.strictObject({ state: z.literal('UNREVIEWED'), decision: z.null() }),
  space: z.strictObject({ width: z.literal(320), height: z.literal(208), origin: z.literal('top-left'),
    pixelsPerUnit: z.literal(32), sampling: z.literal('nearest') }),
  files: z.strictObject({ scene: ref('scene-day.json'), tilemap: ref('tilemap-day.json'),
    atlas: ref('atlas-day.png'), foreground: ref('foreground-day.png') }),
  layerContract: z.strictObject({ staticComposite: z.literal('tiles-then-foreground'), foregroundCanEditAsNativeLayers: z.literal(false) }),
  gameplayFields: z.array(z.string()).length(6), savePolicy: z.string().min(1),
});
const fixture = boundary.parse(manifest);
const pinned = ({ file, sha256: hash }: { file: string; sha256: string }) => {
  const bytes = readFileSync(base + file);
  assert.equal(sha256(bytes), hash, 'SIDECAR_HASH_MISMATCH');
  return bytes;
};
const scene = JSON.parse(pinned(fixture.files.scene).toString('utf8'));
const map = JSON.parse(pinned(fixture.files.tilemap).toString('utf8'));
const normalized = normalizedTileMap(map);
assert.equal(normalized.ids.length, 260);
const { counts, masks } = validateSpatial(scene);
assert.equal(counts.routeLength, 186);
assert.deepEqual(scene.landmarks.boarding.stand, scene.anchors.boarding);
assert.ok(scene.layerOrder.includes('surveyor') && masks.walkable.rgba.length === 320 * 208 * 4);
const atlas = decodePng(pinned(fixture.files.atlas)), foreground = decodePng(pinned(fixture.files.foreground));
const expected = decodePng(readFileSync(base + 'tilemap-day.png'));
const actual: Raster = verifyTiles(atlas, map, foreground, expected).preview;
assert.equal(sha256(composite([actual, foreground]).rgba), map.sceneRgbaSha256);
const saved = JSON.stringify(fixture);
assert.equal(JSON.stringify(boundary.parse(JSON.parse(saved))), saved);
assert.throws(() => boundary.parse({ ...fixture, approval: { state: 'APPROVED', decision: 'automatic' } }));
assert.throws(() => boundary.parse({ ...fixture, files: { ...fixture.files, atlas: { ...fixture.files.atlas, file: '../atlas.png' } } }));
assert.throws(() => pinned({ ...fixture.files.tilemap, sha256: '0'.repeat(64) }), /SIDECAR_HASH_MISMATCH/);
console.log('E8.4 proposal fixture PASS · normalized IDs, layers, collision/walkability, anchors, provenance, draft-only round-trip and 3 negative cases');
