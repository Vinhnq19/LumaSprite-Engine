import assert from 'node:assert/strict';
import { pack } from '../core/palette/colors.ts';
import { silhouette, type Raster } from '../core/pixels/raster.ts';
import { encodePng } from '../core/renderer/png.ts';
import { loadComposition, renderComposition, type Composition } from '../generators/environment/composition.ts';
import { materialLegend } from '../generators/environment/kit.ts';
import { renderEnvironment } from '../generators/environment/render.ts';
import { sha256 } from '../quality/raster.ts';
import type { StyleProfile } from '../specs/environment.ts';
import { contextContrast } from './context-contrast.ts';
import type { PilotBrief } from './cross-asset-pilot.ts';
import { inspectStructure } from './structure-quality/diagnostics.ts';

const marked = pack('#ff00ff');

export async function instrumentContext(source: PilotBrief, style: StyleProfile) {
  const base = await loadComposition(source.scene);
  const placement = base.spec.props.find(item => item.id === source.prop.id);
  assert.ok(placement);
  const spec = base.environment.spec;
  return { base: { ...base, environment: { ...base.environment, style, spec: {
    ...spec, building: { ...spec.building, ...source.architecture },
  } } }, placement, footprint: source.prop.footprint };
}

type Context = Awaited<ReturnType<typeof instrumentContext>>;
type Pivot = readonly [number, number];

function placed(context: Context, raster: Raster, pivot: Pivot): Composition {
  const { base, placement, footprint } = context;
  const assets = new Map(base.environment.assets);
  const { ref } = assets.get(placement.ref)!;
  const { stat } = inspectStructure(raster);
  assert.equal(stat.bounds?.bottom, pivot[1] - 1);
  assets.set(placement.ref, { ref: { ...ref, pivot: [...pivot], footprint, sha256: sha256(encodePng(raster)),
    provenance: 'e74-pilot-in-memory' }, colors: new Set(stat.used.map(pack)), raster, scale: undefined });
  return { ...base, environment: { ...base.environment, assets } };
}

export function contextEvidence(context: Context, raster: Raster, mask: Raster, pivot: Pivot,
  signal: 'roof' | 'amber', count: (type: 'scene' | 'ownership') => void) {
  const composition = placed(context, raster, pivot);
  const tag = placed(context, silhouette(raster, marked), pivot);
  count('ownership');
  const ownership = renderEnvironment(tag.environment, 'B', 'day', { composition: tag.spec, kitSeed: tag.kitSeed });
  const item = ownership.metadata.occlusion.find(layer => layer.id === context.placement.id);
  assert.ok(item && item.visible > 0);
  const visible = new Set<number>();
  for (let y = 0; y < raster.h; y++) for (let x = 0; x < raster.w; x++) {
    const index = ((item.top + y) * ownership.raster.w + item.left + x) * 4;
    if (ownership.raster.rgba.readUInt32BE(index) === marked) visible.add(y * raster.w + x);
  }
  assert.equal(visible.size, item.visible);
  const qa = {} as Record<'day' | 'night', object>;
  const views = {} as Record<'day' | 'night', Raster>;
  const contracts = [] as object[];
  for (const light of ['day', 'night'] as const) {
    count('scene');
    const render = renderComposition(composition, light);
    const { scene } = render;
    const prop = scene.metadata.occlusion.find(layer => layer.id === context.placement.id)!;
    assert.ok(scene.metadata.occlusion.filter(layer => layer.kind === 'actor').every(layer => !layer.hiddenBy[prop.id]));
    assert.equal(prop.visible, visible.size);
    assert.ok(prop.visible >= prop.visibleBefore * .8, 'The review anchor hides too much of the instrument.');
    const contrasts = contextContrast(scene.raster, { mask, raster, visible,
      left: item.left, top: item.top, at: context.placement.at, contour: pack(materialLegend.contour),
      signal: pack(materialLegend[signal]) }, 18);
    qa[light] = { anchor: context.placement.at, pivot, coverage: prop.visibleBefore, visible: prop.visible, hiddenBy: prop.hiddenBy,
      rgbaSha256: scene.metadata.rgbaSha256, contrasts };
    views[light] = scene.raster;
    contracts.push({ camera: scene.metadata.camera, keyLight: scene.metadata.keyLight, portal: scene.metadata.portal,
      collisions: scene.metadata.collisions, collisionPlane: sha256(scene.collisionPlane.rgba), routes: render.routes,
      interactions: render.interactions, walkable: sha256(render.walkable.rgba),
      actors: scene.metadata.occlusion.filter(layer => layer.kind === 'actor').map(({ id, at, visible, hiddenBy }) =>
        ({ id, at, visible, hiddenBy })) });
  }
  return { views, qa, contract: sha256(JSON.stringify(contracts)) };
}
