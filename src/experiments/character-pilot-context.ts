import assert from 'node:assert/strict';
import { pack } from '../core/palette/colors.ts';
import { silhouette, type Raster } from '../core/pixels/raster.ts';
import { encodePng } from '../core/renderer/png.ts';
import { materialMaskLegend } from '../generators/character/materials.ts';
import { loadComposition, renderComposition, type Composition } from '../generators/environment/composition.ts';
import { materialLegend } from '../generators/environment/kit.ts';
import { renderEnvironment } from '../generators/environment/render.ts';
import { sha256 } from '../quality/raster.ts';
import type { StyleProfile } from '../specs/environment.ts';
import { contextContrast } from './context-contrast.ts';
import type { PilotBrief } from './cross-asset-pilot.ts';
import type { CharacterPilotBrief, characterTrial } from './quality-guided-character.ts';
import { inspectStructure } from './structure-quality/diagnostics.ts';

type Candidate = Extract<ReturnType<typeof characterTrial>, { pass: true }>;
const marker = pack('#ff00ff');

export async function loadCharacterContext(brief: CharacterPilotBrief, scene: PilotBrief, style: StyleProfile) {
  const base = await loadComposition(scene.scene);
  const spawn = base.spec.spawns.find(slot => slot.actor === brief.actor);
  assert.ok(spawn);
  const env = base.environment;
  return { id: brief.actor, at: spawn.at, scene: base.spec.name, base: { ...base,
    environment: { ...env, style, spec: { ...env.spec, building: { ...env.spec.building, ...scene.architecture } } } } };
}

type Context = Awaited<ReturnType<typeof loadCharacterContext>>;
function extent(raster: Raster) {
  const bounds = inspectStructure(raster).stat.bounds!;
  return { ...bounds, width: bounds.right - bounds.left + 1, height: bounds.bottom - bounds.top + 1 };
}

export function sampleCharacterContext(context: Context, candidate: Candidate) {
  const { id, base, at } = context;
  const { body, frames, layout, tools } = candidate;
  const [px, py] = body.plan.pivot;
  const bodyExtent = extent(frames.final), jacket = extent(body.layers.jacket);
  assert.equal(bodyExtent.bottom, py - 1);
  const span = Math.abs(body.plan.landmarks['near-shoulder'].point[0] - body.plan.landmarks['far-shoulder'].point[0]);
  function placed(raster: Raster): Composition {
    const assets = new Map(base.environment.assets);
    const { ref } = assets.get(id)!;
    assets.set(id, { ref: { ...ref, sha256: sha256(encodePng(raster)), pivot: [px, py], provenance: 'e75-static-pilot' }, raster,
      colors: new Set(inspectStructure(raster).stat.used.map(pack)),
      scale: { silhouette: bodyExtent, jacket, shoulderSpan: span,
        bodyHalfWidth: Math.max(px - jacket.left, jacket.right - px) + 1 } });
    return { ...base, environment: { ...base.environment, assets } };
  }
  const marked = placed(silhouette(frames.final, marker));
  const ownership = renderEnvironment(marked.environment, 'B', 'day', { composition: marked.spec, kitSeed: marked.kitSeed });
  const tagged = ownership.metadata.occlusion.find(item => item.id === id)!;
  const visible = new Set<number>();
  const left = at[0] - px, top = at[1] - py;
  for (let y = 0; y < frames.final.h; y++) for (let x = 0; x < frames.final.w; x++) {
    if (ownership.raster.rgba.readUInt32BE(((top + y) * ownership.raster.w + left + x) * 4) === marker) {
      const offset = y * frames.final.w + x;
      assert.equal(frames.final.rgba[offset * 4 + 3], 255);
      visible.add(offset);
    }
  }
  assert.equal(visible.size, tagged.visible);
  const input = placed(frames.final);
  const object = { left, top, at, raster: frames.final, mask: frames.material, visible,
    contour: pack(materialMaskLegend.contour), signal: pack(materialMaskLegend.metal) };
  const measure = (light: 'day' | 'night') => {
    const composed = renderComposition(input, light), { scene } = composed;
    const actor = scene.metadata.occlusion.find(item => item.id === id)!;
    assert.equal(actor.visible, visible.size);
    assert.equal(actor.visible, actor.visibleBefore, 'Selected gameplay spawn hides part of the complete sprite.');
    const before = body.metadata.diagnostics.pose!.feet;
    const feet = Object.fromEntries((['near', 'far'] as const).map(side => {
      const foot = before[side], y = foot.projectedGroundY - 2;
      const native = Array.from({ length: foot.soleBand[1] - foot.soleBand[0] + 1 }, (_, offset) => foot.soleBand[0] + offset)
        .filter(x => visible.has(y * 64 + x) && layout.owner.rgba.readUInt32BE((y * 64 + x) * 4) === layout.labels[side + '-boot']);
      const shadows = native.filter(x => scene.materialMask.rgba.readUInt32BE(((top + y + 2) * scene.raster.w + left + x) * 4) === pack(materialLegend.shadow));
      assert.equal(native.length, foot.solePixels, side + ' foot lost contact visibility.');
      return [side, { ...foot, visibleSolePixels: native.length, shadowSamples: shadows.length }];
    }));
    const toolContrast = Object.fromEntries(tools.map(tool => [tool.kind,
      contextContrast(scene.raster, { ...object, mask: layout.owner, signal: layout.labels[tool.id] }, 18).signal]));
    const surfaces = Object.fromEntries((['skin', 'coat', 'leather', 'metal'] as const).map(role => [role,
      contextContrast(scene.raster, { ...object, signal: pack(materialMaskLegend[role]) }, 18).signal]));
    const metadata = { camera: scene.metadata.camera, light: scene.metadata.keyLight, anchor: at, portal: scene.metadata.portal,
      collisions: scene.metadata.collisions, walkable: sha256(composed.walkable.rgba), routes: composed.routes,
      secondaryActors: scene.metadata.occlusion.filter(item => item.kind === 'actor' && item.id !== id)
        .map(item => ({ id: item.id, visible: item.visible, hiddenBy: item.hiddenBy })) };
    return { raster: scene.raster, metadata, q: { visible: actor.visible, total: actor.visibleBefore, feet, rgbaSha256: scene.metadata.rgbaSha256,
      edges: contextContrast(scene.raster, object, 18), toolContrast, surfaces } };
  };

  return { day: measure('day'), night: measure('night'), visible: [...visible], left, top };
}

export function requireSceneParity(before: ReturnType<typeof sampleCharacterContext>, after: ReturnType<typeof sampleCharacterContext>) {
  assert.deepEqual([before.left, before.top], [after.left, after.top], 'Sprite pivot shifted between candidates.');
  for (const light of ['day', 'night'] as const) {
    const a = before[light], b = after[light];
    assert.deepEqual(a.metadata, b.metadata, 'Scene camera, bounds, route or secondary actors drifted.');
    const occupied = new Set([...before.visible, ...after.visible].map(i => (before.top + Math.floor(i / 64)) * a.raster.w + before.left + i % 64));
    for (let i = 0; i < a.raster.w * a.raster.h; i++) if (!occupied.has(i)) {
      assert.equal(a.raster.rgba.readUInt32BE(i * 4), b.raster.rgba.readUInt32BE(i * 4), 'Background changed outside actor silhouettes.');
    }
  }
}
