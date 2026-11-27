import assert from 'node:assert/strict';
import { chestColors, pack } from '../core/palette/colors.ts';
import { makeRaster, put, type Raster } from '../core/pixels/raster.ts';
import { encodePng } from '../core/renderer/png.ts';
import { characterReview } from '../generators/character/export.ts';
import { renderCharacterMaterials } from '../generators/character/materials.ts';
import { makeShapeLock } from '../generators/character/shape-lock.ts';
import { loadComposition, renderComposition, type Composition } from '../generators/environment/composition.ts';
import { renderEnvironment } from '../generators/environment/render.ts';
import { sha256 } from '../quality/raster.ts';
import type { EnvironmentLight, StyleProfile } from '../specs/environment.ts';
import { crossAssetStyle, type ArtDirectionSpec } from './art-direction.ts';
import { inspectStructure } from './structure-quality/diagnostics.ts';
import { renderRelayDevice } from './structure-quality/relay.ts';

type Point = [number, number];
type Environment = Composition['environment'];
type Asset = NonNullable<ReturnType<Environment['assets']['get']>>;
type Scene = ReturnType<typeof renderEnvironment>;
type Bay = Environment['spec']['building']['bays'][number];
export type PilotBrief = {
  id: string;
  role: 'development' | 'holdout';
  seed: number;
  brief: string;
  scene: unknown;
  character: { actor: string; spec: unknown };
  prop: { id: string; label: string; form: 'weather-hood' | 'depth-gauge'; body: unknown; footprint: Point; brief: string };
  architecture: { bays: Bay[]; signBay: number };
  profile: { file: string; sha256: string };
  direction: { file: string; sha256: string };
};

function extent(raster: Raster) {
  const { bounds } = inspectStructure(raster).stat;
  assert.ok(bounds, 'Empty scale reference.');
  return { ...bounds, width: bounds.right - bounds.left + 1, height: bounds.bottom - bounds.top + 1 };
}

function pilotAsset(previous: Asset, raster: Raster, pivot: Point, footprint: Point, file: string, scale?: Asset['scale']): Asset {
  const { stat } = inspectStructure(raster);
  assert.equal(stat.bounds?.bottom, pivot[1] - 1, file + ' pivot is off the ground contact row.');
  assert.ok(pivot[0] >= 0 && pivot[0] < raster.w && pivot[1] < raster.h);
  assert.ok(footprint[0] <= raster.w && footprint[1] <= raster.h);
  const { id, kind } = previous.ref;
  return {
    ref: { id, kind, file, sha256: sha256(encodePng(raster)), provenance: 'e73-pilot', pivot, footprint },
    raster, scale, colors: new Set(stat.used.map(pack)),
  };
}

function buildingSilhouette(scene: Scene) {
  const { w, h, rgba } = scene.layerOverlay;
  const ink = pack(scene.metadata.atlas.layerLegend.building);
  const raster = makeRaster(w, h);
  for (let i = 0; i < w * h; i++) {
    if (rgba.readUInt32BE(i * 4) === ink) put(raster, i % w, Math.floor(i / w), pack('#ffffff'));
  }
  return raster;
}

function geometryOf(render: ReturnType<typeof renderComposition>) {
  const { scene, routes, interactions, walkable } = render;
  return {
    camera: scene.metadata.camera, lights: scene.metadata.keyLight, portal: scene.metadata.portal,
    occlusion: scene.metadata.occlusion.map(({ p10LumaGap, ...item }) => {
      void p10LumaGap;
      return item;
    }),
    collisions: scene.metadata.collisions, refinement: scene.metadata.refinement?.geometry,
    collisionPlane: sha256(scene.collisionPlane.rgba), walkable: sha256(walkable.rgba), routes, interactions,
  };
}

export async function preparePilot(brief: PilotBrief, checkpoint: string) {
  const base = await loadComposition(brief.scene);
  const review = characterReview(brief.character.spec);
  assert.equal(base.spec.seed, brief.seed);
  assert.equal(review.spec.seed, brief.seed);
  const lock = makeShapeLock(review, checkpoint, brief.id);
  const pivot: Point = [review.plan.pivot[0], review.plan.pivot[1]];
  const silhouette = extent(review.silhouette), jacket = extent(review.layers.jacket);
  const { landmarks } = review.plan;
  const scale = { silhouette, jacket, shoulderSpan: Math.abs(landmarks['near-shoulder'].point[0] - landmarks['far-shoulder'].point[0]),
    bodyHalfWidth: Math.max(pivot[0] - jacket.left, jacket.right - pivot[0]) + 1 };
  const placement = base.spec.props.find(item => item.id === brief.prop.id);
  assert.ok(placement);
  const deviceInput = {
    version: 1, kind: 'field-signal-relay-box', label: brief.prop.label, canvas: { w: 32, h: 32 },
    seed: brief.seed, body: brief.prop.body, sourceStyle: brief.profile, brief: brief.prop.brief,
    placement: { file: 'benchmarks/results/e62/packages/c1-courtyard-day/manifest.json',
      sha256: '9db69b0ce4248f22f616b2caaba2e28129cab77e722327b46dac4994e4938ed0', pivot: placement.at },
  };
  return { base, brief, review, lock, pivot, scale, placement, deviceInput };
}

export function renderPilot(input: Awaited<ReturnType<typeof preparePilot>>, profile: StyleProfile, direction?: ArtDirectionSpec) {
  const { base, brief, review, lock, pivot, scale, placement, deviceInput } = input;
  const edition = direction ? 'b' : 'a';
  const { profile: style, device, character } = crossAssetStyle(profile, direction);
  assert.equal(review.spec.view, style.view);
  const actor = renderCharacterMaterials(review, lock, 'm2p', undefined, character);
  const prop = renderRelayDevice(deviceInput, brief.prop.form, device);
  const assets = new Map(base.environment.assets);
  assets.set(brief.character.actor, pilotAsset(assets.get(brief.character.actor)!, actor.final, pivot, [0, 0],
    'benchmarks/results/e73/' + brief.id + '/' + edition + '/character.png', scale));
  assets.set(placement.ref, pilotAsset(assets.get(placement.ref)!, prop.final, [...prop.structure.contact], brief.prop.footprint,
    'benchmarks/results/e73/' + brief.id + '/' + edition + '/prop.png'));
  const baseSpec = base.environment.spec;
  const environment = { ...base.environment, assets, style, spec: { ...baseSpec,
    building: { ...baseSpec.building, ...brief.architecture } } };
  const finish = (light: EnvironmentLight) => renderComposition({ ...base, environment }, light);
  const day = finish('day'), night = finish('night');
  const landscape = renderEnvironment({ ...environment, spec: { ...environment.spec, placements: [] } }, 'B', 'day',
    { composition: base.spec, kitSeed: base.kitSeed });
  const landscapeNight = renderEnvironment({ ...environment, spec: { ...environment.spec, placements: [] } }, 'B', 'night',
    { composition: base.spec, kitSeed: base.kitSeed });
  const actorStat = inspectStructure(actor.final, new Set(actor.usedColors.map(pack)), actor.mask).stat;
  const actorEdge = (view: typeof day) => view.scene.metadata.occlusion.find(item => item.id === brief.character.actor);
  return {
    geometry: { day: geometryOf(day), night: geometryOf(night) },
    pngs: {
      character: actor.final, prop: prop.final, environment: landscape.raster, 'environment-night': landscapeNight.raster,
      'scene-day': day.scene.raster, 'scene-night': night.scene.raster,
      'character-flat': review.flat, 'character-silhouette': review.silhouette, 'character-material': actor.mask,
      'prop-flat': prop.flat, 'prop-silhouette': prop.mask, 'prop-material': prop.material,
      'environment-flat': landscape.layerOverlay, 'environment-silhouette': buildingSilhouette(landscape),
      'environment-material': landscape.materialMask, 'scene-flat': day.scene.layerOverlay, 'scene-material': day.scene.materialMask,
      'scene-collision': day.routeOverlay,
    },
    qa: {
      actor: { pivot, scale, metatarsalContactRow: review.metadata.diagnostics.bounds?.bottom,
        material: actor.diagnostics, roleCoverage: actor.coverage, ...actorStat },
      prop: { pivot: prop.structure.contact, anchor: placement.at, footprint: brief.prop.footprint,
        nativeView: style.view, ...prop.stat },
      palette: { characterContour: character?.outline ?? chestColors.contour, deviceContour: device.contour,
        deviceSurfaces: device.surfaces, environment: day.scene.metadata.palette.ramps,
        environmentWarnings: day.scene.metadata.palette.warnings },
      landscape: { detail: day.hierarchy, occlusion: { day: actorEdge(day), night: actorEdge(night) },
        day: day.scene.metadata.rgbaSha256, night: night.scene.metadata.rgbaSha256 },
    },
  };
}
