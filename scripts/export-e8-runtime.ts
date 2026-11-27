import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { pack } from '../src/core/palette/colors.ts';
import { blit, composite, makeRaster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { crossAssetStyle, loadArtDirection } from '../src/experiments/art-direction.ts';
import type { PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { renderFunctionalWaterfront } from '../src/experiments/functional-waterfront.ts';
import { normalizedTileMap, pixel, scenePlans } from '../src/experiments/runtime-integration.ts';
import { buildTiles, verifyTiles, type Spatial } from '../src/experiments/semantic-environment-export.ts';
import { prepareSemantic, semanticScene, type WaterPalette } from '../src/experiments/semantic-environment.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { collectEnvironmentLayers, type EnvironmentLayerStack } from '../src/generators/environment/render.ts';
import { sha256 } from '../src/quality/raster.ts';

const { values } = parseArgs({ options: { out: { type: 'string' } } });
const out = resolve(values.out ?? '.cache/e8-adapter');
const version = 'bdc5114bcc92e7a4603f2fd65d4726dd0ee8f7dd';
const history = 'benchmarks/results/e76r/';
const file = (path: string) => readFileSync(path);
const json = (path: string) => JSON.parse(file(path).toString('utf8'));
const pretty = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const listing: Record<string, string> = {};
function save(name: string, bytes: Buffer) {
  const dest = join(out, name);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, bytes);
  listing[name] = sha256(bytes);
}

const published = Object.fromEntries(file(history + 'SHA256SUMS').toString('utf8').trim().split(/\r?\n/).map(row => {
  const [hash, name] = row.split('  ', 2);
  assert.equal(sha256(file(history + name)), hash, name);
  return [name, hash];
}));
assert.equal(Object.keys(published).length, 142);
const oldLock = json('benchmarks/fixtures/e76/pilot-lock.json');
const study = json(history + 'benchmark.json');
const { spec: direction, profile } = await loadArtDirection(JSON.parse((await pinnedFile(oldLock.style)).toString('utf8')));
const style = crossAssetStyle(profile, direction).profile, water: WaterPalette = oldLock.water;
const point = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]);
const adapterSource = z.looseObject({ version: z.literal(1), size: z.tuple([z.literal(320), z.literal(208)]),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/), camera: z.looseObject({ width: z.literal(320), height: z.literal(208),
    sampling: z.literal('nearest'), pixelsPerUnit: z.literal(32) }),
  landmarks: z.strictObject({ boarding: z.looseObject({ kind: z.literal('boarding-sill'), at: point, stand: point }),
    control: z.strictObject({ kind: z.literal('static-maintenance-wheel'), at: point, handle: point, stand: point }).nullable() }),
});
const cases = [];
for (const metadata of study.cases) {
  const spec = semanticScene.parse(JSON.parse((await pinnedFile(metadata.source)).toString('utf8')));
  const heritage: PilotBrief = JSON.parse((await pinnedFile(spec.base)).toString('utf8'));
  const base = await prepareSemantic(spec, heritage, style);
  const sources = [];
  for (const light of ['day', 'night'] as const) {
    const prefix = spec.id + '/b2/', target = spec.id + '/' + light + '/';
    const locked = (name: string) => {
      assert.ok(published[prefix + name]);
      return file(history + prefix + name);
    };
    const lockedScene = locked('scene-' + light + '.json');
    const sceneObject = JSON.parse(lockedScene.toString('utf8'));
    const input = adapterSource.parse(sceneObject);
    assert.equal(input.sourceSha256, metadata.source.sha256);
    const spatial: Spatial = sceneObject;
    const lockedMap = locked('tilemap-' + light + '.json');
    const originalMap = JSON.parse(lockedMap.toString('utf8'));
    const tiles = normalizedTileMap(originalMap);
    const atlas = locked('atlas-' + light + '.png'), foreground = locked('foreground-' + light + '.png');
    let stack: EnvironmentLayerStack | undefined;
    const environment = { ...base.environment,
      [collectEnvironmentLayers]: (snapshot: EnvironmentLayerStack) => { stack = snapshot; },
    };
    const frame = renderFunctionalWaterfront({ ...base, environment }, spec, water, light);
    assert.ok(stack, 'E6_LAYER_STACK_UNAVAILABLE');
    assert.equal(sha256(encodePng(frame.scene)), published[prefix + light + '.png']);
    const generated = buildTiles(base, frame, light);
    const replay = verifyTiles(decodePng(atlas), originalMap, decodePng(foreground), generated.ground);
    const ground = replay.preview, correction = makeRaster(ground.w, ground.h);
    const theme = style.illumination[light];
    const legend = frame.legacy.metadata.atlas.layerLegend;
    const shade = pack(legend.shadow), building = pack(legend.building), deck = pack('#d38c60'), wet = pack('#346c82');
    for (let i = 0; i < ground.rgba.length; i += 4) {
      const owner = stack.owners.rgba.readUInt32BE(i), surface = frame.surfaceImage.rgba.readUInt32BE(i);
      const role = frame.surfaces.semantic.rgba.readUInt32BE(i);
      const ink = owner === building || !surface ? stack.underlay.rgba.readUInt32BE(i) : owner === shade ?
        pack(role === deck ? theme.surfaces.wood[1] : role === wet ? water[light][0] : theme.surfaces.paving[0]) : surface;
      if (ink !== ground.rgba.readUInt32BE(i)) correction.rgba.writeUInt32BE(ink, i);
    }
    const recomposed = composite([ground, correction]);
    const layers = stack.layers.map(({ id, at, kind, piece }, order) => {
      assert.equal(frame.legacy.metadata.layerOrder[order], id);
      const [px, py] = piece.origin, path = target + 'layer-' + id;
      save(path + '.png', encodePng(piece.raster));
      blit(recomposed, piece.raster, at[0] - px, at[1] - py);
      return { id, kind, at: pixel(at), pivot: { x: px, y: py }, order, texture: path };
    });
    assert.deepEqual(recomposed.rgba, frame.scene.rgba, 'DYNAMIC_LAYER_STATIC_PARITY');
    const name = target + 'scene';
    const control = input.landmarks.control;
    const interaction = control ?? input.landmarks.boarding;
    const stand = pixel(interaction.stand);
    const { route, probes, collision, walkable, clearance, fits } = scenePlans(spatial, stand);
    let aperture = null;
    if (metadata.role === 'fresh-holdout' && spec.gate) {
      const [gx, gy] = spec.gate.at;
      const courier = base.environment.assets.get('courier')!;
      const initial = spec.actors.courier;
      const feasible = Array.from({ length: 34 }, (_, i) => gx + i + 1).filter(x =>
        fits(x, initial[1], courier.scale!.bodyHalfWidth) && fits(x, initial[1]));
      assert.ok(feasible.length);
      aperture = { x: gx - 7, y: gy - 13, w: 14, h: 10, water: [...water[light]], threshold: 35, expected: 19,
        staging: { x: feasible.at(-1)!, y: initial[1] }, original: pixel(initial) };
    }
    save(target + 'atlas.png', atlas);
    save(target + 'foreground.png', foreground);
    save(target + 'underlay-correction.png', encodePng(correction));
    save(target + 'locked-scene.json', lockedScene);
    save(target + 'locked-tilemap.json', lockedMap);
    save(name + '.json', pretty({ version: 1, revision: version, id: spec.id, light, width: ground.w, height: ground.h,
      pixelsPerUnit: input.camera.pixelsPerUnit, tiles, correction: target + 'underlay-correction',
      foreground: target + 'foreground', atlas: target + 'atlas', spawn: pixel(spatial.anchors.spawn.surveyor), clearance,
      collision, walkable, layers, probes, route, landmark: { kind: interaction.kind, at: pixel(control?.handle ?? interaction.at), stand },
      aperture, source: { fixture: input.sourceSha256, lockedScene: sha256(lockedScene), lockedMap: sha256(lockedMap),
        lockedFrame: published[prefix + light + '.png'], rgba: sha256(frame.scene.rgba) },
    }));
    sources.push(name);
    console.log(spec.id, light, layers.length, collision.length, probes.map(p => p.kind).join(','), 'exact RGBA');
  }
  cases.push({ id: spec.id, name: spec.name, day: sources[0], night: sources[1] });
}

const animationRoot = 'benchmarks/results/e54/packages/surveyor/';
const animationManifest = json(animationRoot + 'manifest.json');
for (const clip of ['idle', 'walk']) {
  for (const [source, dest] of [['timing.json', '.json'], ['spritesheet.png', '.png']]) {
    const name = clip + '/' + source, bytes = file(animationRoot + name);
    assert.equal(sha256(bytes), animationManifest.files[name]);
    save('actor/' + clip + dest, bytes);
  }
}
save('actor/source.json', file(animationRoot + 'manifest.json'));
save('bundle.json', pretty({ version: 1, revision: version, cases, animationManifestSha256: listing['actor/source.json'],
  palettePolicy: 'use frozen B2 art and approved E5 playback', files: listing }));
console.log('E8 adapter PASS', Object.keys(listing).length, 'deterministic files');
