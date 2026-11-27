import assert from 'node:assert/strict';
import { pack } from '../core/palette/colors.ts';
import { silhouette, type Raster } from '../core/pixels/raster.ts';
import { encodePng } from '../core/renderer/png.ts';
import { materialMaskLegend } from '../generators/character/materials.ts';
import { renderComposition } from '../generators/environment/composition.ts';
import { renderEnvironment } from '../generators/environment/render.ts';
import { materialLegend } from '../generators/environment/kit.ts';
import { sha256 } from '../quality/raster.ts';
import { loadCharacterContext } from './character-pilot-context.ts';
import type { identityCandidate } from './character-identity.ts';
import { contextContrast } from './context-contrast.ts';
import { inspectStructure } from './structure-quality/diagnostics.ts';

type Context = Awaited<ReturnType<typeof loadCharacterContext>>;
type Candidate = Extract<ReturnType<typeof identityCandidate>, { pass: true }>;
const marker = pack('#ff00ff');

export function identityContext(context: Context, candidate: Candidate) {
  const { id, base, at } = context, { body, frames, layout, tools } = candidate;
  const [px, py] = body.plan.pivot;
  const extent = (raster: Raster) => {
    const b = inspectStructure(raster).stat.bounds!;
    return { ...b, width: b.right - b.left + 1, height: b.bottom - b.top + 1 };
  };
  const height = extent(frames.final), jacket = extent(body.layers.jacket);
  const shoulderSpan = Math.abs(body.plan.landmarks['near-shoulder'].point[0] - body.plan.landmarks['far-shoulder'].point[0]);
  const placed = (raster: Raster) => {
    const assets = new Map(base.environment.assets);
    const { ref } = assets.get(id)!;
    assets.set(id, { ref: { ...ref, sha256: sha256(encodePng(raster)), pivot: [px, py], provenance: 'e75r-static-pilot' },
      raster, colors: new Set(inspectStructure(raster).stat.used.map(pack)), scale: {
        silhouette: height, jacket, shoulderSpan, bodyHalfWidth: Math.max(px - jacket.left, jacket.right - px) + 1,
      } });
    return { ...base, environment: { ...base.environment, assets } };
  };
  const tag = placed(silhouette(frames.final, marker));
  const markers = renderEnvironment(tag.environment, 'B', 'day', { composition: tag.spec, kitSeed: tag.kitSeed });
  const left = at[0] - px, top = at[1] - py, visible = new Set<number>();
  const world = (x: number, y: number) => (top + y) * markers.raster.w + left + x;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    if (markers.raster.rgba.readUInt32BE(world(x, y) * 4) === marker) {
      assert.equal(frames.final.rgba[(y * 64 + x) * 4 + 3], 255);
      visible.add(y * 64 + x);
    }
  }
  const input = placed(frames.final);
  const object = { left, top, at, raster: frames.final, mask: frames.material, visible,
    contour: pack(materialMaskLegend.contour), signal: pack(materialMaskLegend.metal) };
  function measure(light: 'day' | 'night') {
    const { scene, walkable, routes } = renderComposition(input, light);
    const actor = scene.metadata.occlusion.find(item => item.id === id)!;
    assert.equal(actor.visible, visible.size);
    assert.ok(actor.visible >= actor.visibleBefore * .65);
    const feet = Object.fromEntries((['near', 'far'] as const).map(side => {
      const f = body.metadata.diagnostics.pose!.feet[side], y = f.projectedGroundY - 2;
      const soles = Array.from({ length: f.soleBand[1] - f.soleBand[0] + 1 }, (_, i) => f.soleBand[0] + i)
        .filter(x => visible.has(y * 64 + x) && layout.owner.rgba.readUInt32BE((y * 64 + x) * 4) === layout.labels[side + '-boot']);
      assert.equal(soles.length, f.solePixels);
      return [side, { ...f, visibleSolePixels: soles.length,
        shadow: soles.filter(x => scene.materialMask.rgba.readUInt32BE(world(x, y + 2) * 4) === pack(materialLegend.shadow)).length }];
    }));
    const equipment = Object.fromEntries(tools.map(tool => [tool.kind,
      contextContrast(scene.raster, { ...object, mask: layout.owner, signal: layout.labels[tool.id] }, 18).signal]));
    const qa = { feet, edges: contextContrast(scene.raster, object, 18), equipment, anchor: at, rgbaSha256: scene.metadata.rgbaSha256,
      visible: actor.visible, total: actor.visibleBefore };
    const environment = { camera: scene.metadata.camera, keyLight: scene.metadata.keyLight, anchor: at,
      walkable: sha256(walkable.rgba), routes, collision: sha256(scene.collisionPlane.rgba),
      otherActors: scene.metadata.occlusion.filter(item => item.kind === 'actor' && item.id !== id)
        .map(item => [item.id, item.visible, item.hiddenBy]) };
    return { raster: scene.raster, qa, environment };
  }
  return { day: measure('day'), night: measure('night'), visible: [...visible], left, top };
}

export function sameContext(before: ReturnType<typeof identityContext>, after: ReturnType<typeof identityContext>) {
  assert.deepEqual([before.left, before.top], [after.left, after.top]);
  for (const light of ['day', 'night'] as const) {
    const a = before[light], b = after[light];
    assert.deepEqual(a.environment, b.environment);
    const cover = new Set([...before.visible, ...after.visible]
      .map(i => (before.top + Math.floor(i / 64)) * a.raster.w + before.left + i % 64));
    for (let i = 0; i < a.raster.w * a.raster.h; i++) if (!cover.has(i)) {
      assert.equal(a.raster.rgba.readUInt32BE(i * 4), b.raster.rgba.readUInt32BE(i * 4), 'BACKGROUND_PIXEL_DRIFT');
    }
  }
}
