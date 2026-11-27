import assert from 'node:assert/strict';
import { pack, unpack } from '../core/palette/colors.ts';
import { silhouette, type Raster } from '../core/pixels/raster.ts';
import { encodePng } from '../core/renderer/png.ts';
import { materialMaskLegend, renderCharacterMaterials } from '../generators/character/materials.ts';
import { alphaPlane } from '../generators/character/shape-lock.ts';
import { renderComposition, type Composition } from '../generators/environment/composition.ts';
import { materialLegend } from '../generators/environment/kit.ts';
import { renderEnvironment } from '../generators/environment/render.ts';
import { sha256 } from '../quality/raster.ts';
import type { EnvironmentLight, StyleProfile } from '../specs/environment.ts';
import { crossAssetStyle, type ArtDirectionSpec } from './art-direction.ts';
import { contextContrast, type Instance } from './context-contrast.ts';
import { preparePilot, renderPilot } from './cross-asset-pilot.ts';
import { liftFootShadow, paintNightOutline, type SemanticDirection } from './semantic-style.ts';
import { inspectStructure } from './structure-quality/diagnostics.ts';

type Input = Awaited<ReturnType<typeof preparePilot>>;
type Pilot = ReturnType<typeof renderPilot>;
type Pair = { character: Raster; prop: Raster };
type Point = [number, number];
const lights = ['day', 'night'] as const;
const families = ['character', 'prop'] as const;
const marker = { character: pack('#ff00ff'), prop: pack('#00ffff') };
const legend = {
  character: { contour: pack(materialMaskLegend.contour), signal: pack(materialMaskLegend.glass) },
  prop: { contour: pack(materialLegend.contour), signal: pack(materialLegend.amber) },
};

const sceneKey = (light: EnvironmentLight) => light === 'day' ? 'scene-day' : 'scene-night';

function withSprites(input: Input, style: StyleProfile, pair: Pair, propPivot: Point): Composition {
  const { base, brief, placement, pivot, scale } = input;
  const assets = new Map(base.environment.assets);
  const asset = (id: string, raster: Raster, origin: Point, footprint: Point, avatar?: Input['scale']) => {
    const { stat } = inspectStructure(raster);
    assert.equal(stat.bounds?.bottom, origin[1] - 1, id + ' pivot');
    const { ref } = assets.get(id)!;
    assets.set(id, { ref: { id, kind: ref.kind, file: ref.file, sha256: sha256(encodePng(raster)),
      provenance: 'e73r-pilot-in-memory', pivot: origin, footprint }, raster, colors: new Set(stat.used.map(pack)), scale: avatar });
  };
  asset(brief.character.actor, pair.character, pivot, [0, 0], scale);
  asset(placement.ref, pair.prop, propPivot, brief.prop.footprint);
  const spec = base.environment.spec;
  return { ...base, environment: {
    ...base.environment, assets, style, spec: { ...spec, building: { ...spec.building, ...brief.architecture } },
  } };
}

function isolatedOwnership(input: Input, style: StyleProfile, reference: Pilot, origin: Point) {
  const masks = { character: reference.pngs['character-material'], prop: reference.pngs['prop-material'] };
  for (const color of Object.values(marker)) {
    assert.ok(!reference.pngs['scene-day'].rgba.includes(Buffer.from([color >>> 24, color >>> 16 & 255, color >>> 8 & 255, 255])));
  }
  const tagged = { character: silhouette(masks.character, marker.character), prop: silhouette(masks.prop, marker.prop) };
  const { environment, kitSeed, spec } = withSprites(input, style, tagged, origin);
  const scene = renderEnvironment(environment, 'B', 'day', { composition: spec, kitSeed });
  assert.ok(scene.materialMask.rgba.equals(reference.pngs['scene-material'].rgba));
  const ids = { character: input.brief.character.actor, prop: input.placement.id };
  const make = (family: keyof Pair) => {
    const item = scene.metadata.occlusion.find(layer => layer.id === ids[family]);
    assert.ok(item);
    const mask = masks[family], visible = new Set<number>();
    for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) {
      if (scene.raster.rgba.readUInt32BE(((item.top + y) * scene.raster.w + item.left + x) * 4) === marker[family]) {
        const at = y * mask.w + x;
        assert.ok(mask.rgba[at * 4 + 3] === 255);
        visible.add(at);
      }
    }
    assert.equal(visible.size, item.visible, family + ' ownership');
    return { left: item.left, top: item.top, at: item.at as Point, mask, visible, ...legend[family] };
  };
  return { character: make('character'), prop: make('prop') };
}

function protectedColors(a: Raster, b: Raster, mask: Raster, roles: number[]) {
  let count = 0;
  for (let i = 0; i < mask.rgba.length; i += 4) {
    if (!roles.includes(mask.rgba.readUInt32BE(i))) continue;
    assert.equal(a.rgba.readUInt32BE(i), b.rgba.readUInt32BE(i));
    count++;
  }
  return count;
}

function stableScene(reference: Pilot['geometry']['day'], render: ReturnType<typeof renderComposition>) {
  const { scene, routes, interactions, walkable } = render;
  const noContrast = scene.metadata.occlusion.map(({ p10LumaGap, ...item }) => {
    void p10LumaGap;
    return item;
  });
  assert.deepEqual({
    camera: scene.metadata.camera, lights: scene.metadata.keyLight, portal: scene.metadata.portal,
    occlusion: noContrast, collisions: scene.metadata.collisions, refinement: scene.metadata.refinement?.geometry,
    collisionPlane: sha256(scene.collisionPlane.rgba), walkable: sha256(walkable.rgba), routes, interactions,
  }, reference);
}

export function renderSemanticPilot(input: Input, profile: StyleProfile, direction: ArtDirectionSpec, semantic: SemanticDirection) {
  const a = renderPilot(input, profile), b = renderPilot(input, profile, direction);
  assert.deepEqual(a.geometry, b.geometry);
  const style = crossAssetStyle(profile, direction);
  const propPivot: Point = [...b.qa.prop.pivot];
  const mode = semantic.protectByBrief[input.brief.id];
  assert.ok(mode, 'Missing semantic binding for ' + input.brief.id);
  const ownership = isolatedOwnership(input, style.profile, b, propPivot);
  const instance = (family: keyof Pair, raster: Raster): Instance => ({ ...ownership[family], raster });
  const characterDirection = style.character!;
  const ramps = { ...characterDirection.ramps };
  for (const role of mode) delete ramps[role];
  const actorPaint = renderCharacterMaterials(input.review, input.lock, 'm2p', undefined, { ...characterDirection, ramps });
  assert.ok(actorPaint.mask.rgba.equals(ownership.character.mask.rgba));
  const identity = mode.map(role => materialMaskLegend[role]).map(pack);
  const protectedPixels = protectedColors(a.pngs.character, actorPaint.final, actorPaint.mask, identity);
  assert.equal(protectedPixels > 0, mode.length > 0);
  const paintProp = liftFootShadow(b.pngs.prop, ownership.prop.mask, style.device.surfaces.wood, propPivot[1]);
  const dayPair: Pair = { character: actorPaint.final, prop: paintProp.raster };
  const unpaintedNight = renderComposition(withSprites(input, style.profile, dayPair, propPivot), 'night');
  const nightPaint = paintNightOutline(unpaintedNight.scene.raster, instance('character', dayPair.character), profile.illumination.night, semantic.night);
  const nightActor = nightPaint.raster;
  const nightPair = { ...dayPair, character: nightActor };
  const amber = protectedColors(b.pngs.prop, dayPair.prop, ownership.prop.mask, [legend.prop.signal]);
  assert.ok(amber > 0);
  assert.equal(protectedColors(a.pngs.character, nightPair.character, ownership.character.mask, identity), protectedPixels);
  const cPair = { day: dayPair, night: nightPair };
  const scene = {
    day: renderComposition(withSprites(input, style.profile, dayPair, propPivot), 'day'),
    night: nightPaint.pixels ? renderComposition(withSprites(input, style.profile, nightPair, propPivot), 'night') : unpaintedNight,
  };
  const qa = (pair: Pair, raster: Raster) => ({
    character: contextContrast(raster, instance('character', pair.character), semantic.night.weakGap),
    prop: contextContrast(raster, instance('prop', pair.prop), semantic.night.weakGap),
  });
  const metrics = {
    A: Object.fromEntries(lights.map(light => [light, qa(a.pngs, a.pngs[sceneKey(light)])])),
    B: Object.fromEntries(lights.map(light => [light, qa(b.pngs, b.pngs[sceneKey(light)])])),
    C: Object.fromEntries(lights.map(light => [light, qa(cPair[light], scene[light].scene.raster)])),
  };
  const legalActor = new Set(actorPaint.usedColors.map(pack));
  const legalProp = new Set(b.qa.prop.used.concat(style.device.surfaces.wood).map(pack));
  for (const light of lights) {
    stableScene(b.geometry[light], scene[light]);
    const control = renderComposition(withSprites(input, style.profile, b.pngs, propPivot), light).scene;
    assert.ok(control.raster.rgba.equals(b.pngs[sceneKey(light)].rgba));
    assert.ok(scene[light].scene.materialMask.rgba.equals(control.materialMask.rgba), light + ' material coverage changed.');
    const expected = Buffer.from(control.raster.rgba);
    for (const family of families) {
      const object = instance(family, cPair[light][family]);
      assert.ok(alphaPlane(object.raster).equals(alphaPlane(b.pngs[family])));
      for (const offset of object.visible) {
        const x = object.left + offset % object.raster.w;
        const y = object.top + Math.floor(offset / object.raster.w);
        expected.writeUInt32BE(object.raster.rgba.readUInt32BE(offset * 4), (y * control.raster.w + x) * 4);
      }
    }
    assert.ok(expected.equals(scene[light].scene.raster.rgba), light + ' changed scene pixels outside the two owned assets.');
    const legal = new Set(legalActor);
    if (light === 'night' && nightPaint.ink !== null) legal.add(nightPaint.ink);
    inspectStructure(cPair[light].character, legal);
    inspectStructure(cPair[light].prop, legalProp);
  }
  assert.ok(a.pngs['environment-night'].rgba.equals(b.pngs['environment-night'].rgba));
  const variants = { A: a, B: b, C: { pngs: { ...b.pngs, ...dayPair, 'scene-day': scene.day.scene.raster, 'scene-night': scene.night.scene.raster } } };
  const foot = (raster: Raster) => inspectStructure(raster, undefined, ownership.prop.mask).stat.materialBoundaries;
  return { variants, nightActor, metrics, a, b, qa: {
    identity: { roles: mode, exactPixels: protectedPixels },
    prop: { amberPixelsExact: amber, woodShadowRuns: paintProp.runs,
      materialBoundaries: { A: foot(a.pngs.prop), B: foot(b.pngs.prop), C: foot(paintProp.raster) } },
    night: { outlineBudget: nightPaint.budget, outlineChanged: nightPaint.pixels,
      ink: nightPaint.ink === null ? null : unpack(nightPaint.ink), environment: 'B1_UNCHANGED' },
    results: { geometryStable: true, masksExact: true, alphaExact: true, paletteValid: true },
  } };
}
