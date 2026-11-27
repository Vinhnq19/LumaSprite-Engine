import assert from 'node:assert/strict';
import { rect } from '../core/geometry/faces.ts';
import { projectBox } from '../core/geometry/projection.ts';
import type { Point } from '../core/geometry/shapes.ts';
import { pack } from '../core/palette/colors.ts';
import { composite, makeRaster, put, type Raster } from '../core/pixels/raster.ts';
import { encodePng } from '../core/renderer/png.ts';
import type { Composition } from '../generators/environment/composition.ts';
import { materialLegend, materialPiece, type PaintPiece } from '../generators/environment/kit.ts';
import { covered } from '../generators/environment/refinement.ts';
import { renderEnvironment } from '../generators/environment/render.ts';
import { sha256 } from '../quality/raster.ts';
import type { EnvironmentLight, StyleProfile } from '../specs/environment.ts';
import { renderLanding, type SemanticScene, type WaterPalette } from './semantic-environment.ts';

type Theme = StyleProfile['illumination']['day'];
type Piece = ReturnType<PaintPiece>;
type Draw = Parameters<PaintPiece>[3];
type Paint = Parameters<Draw>[0];
type WetFrame = ReturnType<typeof renderLanding>;
const joinBox = (paint: Paint, role: 'wood' | 'stone' | 'metal', left: number, top: number,
  width: number, depth: number, bottom: number) => {
  const box = projectBox({ left, top, width, depth, bottom, taper: 0 });
  paint(role, 0, box.side); paint(role, 1, box.front); paint(role, 2, box.top);
};

// Replacement modules retain the B1 pivot and footprint shape.
function post(theme: Theme, control: boolean) {
  return materialPiece(theme)(16, 27, [7, 25], paint => {
    joinBox(paint, 'wood', 3, 21, 8, 3, 25);
    joinBox(paint, 'wood', 5, 11, 5, 3, 23);
    if (control) {
      const wheel: Point[] = [[3, 4], [7, 3], [12, 5], [14, 8], [13, 12], [10, 15], [6, 15], [2, 12], [1, 8]];
      paint('metal', 0, wheel);
      paint('metal', 3, [[3, 5], [7, 4], [12, 6], [7, 6], [4, 8], [3, 11], [2, 8]]);
      paint('metal', 2, rect(6, 6, 8, 13));
      paint('metal', 2, rect(3, 8, 13, 10));
      paint('amber', 2, rect(10, 11, 14, 13));
      return;
    }
    paint('metal', 0, [[0, 10], [3, 9], [12, 9], [15, 10], [15, 14], [11, 15],
      [10, 13], [5, 13], [4, 15], [0, 14]]);
    paint('metal', 3, [[0, 10], [3, 9], [12, 9], [15, 10], [12, 11], [3, 11]]);
    paint('amber', 1, rect(5, 16, 10, 18));
    paint('amber', 2, rect(5, 16, 9, 17));
  });
}

function gate(theme: Theme, span: number, height: number) {
  const w = span + 19, h = height + 11, bottom = h - 2, left = 14, right = span;
  return materialPiece(theme)(w, h, [Math.floor(w / 2), h - 1], paint => {
    for (const x of [3, right - 2]) {
      joinBox(paint, 'stone', x, 13, 13, 7, bottom);
      joinBox(paint, 'stone', x - 1, 12, 14, 7, 17);
      for (const y of [25, 36, bottom - 7]) paint('stone', 0, rect(x, y, x + 13, y + 1));
    }
    for (const x of [left, right - 4]) {
      joinBox(paint, 'metal', x, 19, 4, 2, bottom - 3);
      paint('metal', 3, rect(x, 23, x + 1, bottom - 5));
    }
    // The straight bottom sill and the transparent gap beneath it distinguish a raised panel.
    joinBox(paint, 'wood', left + 4, 20, right - left - 8, 4, bottom - 16);
    for (let x = left + 10; x < right - 5; x += 6) paint('wood', 0, rect(x, 21, x + 1, bottom - 17));
    paint('metal', 0, rect(left + 4, bottom - 20, right - 4, bottom - 16));
    paint('metal', 3, rect(left + 4, bottom - 20, right - 4, bottom - 19));
    joinBox(paint, 'wood', left - 5, 15, right - left + 9, 6, 21);
    const center = Math.floor((right + left) / 2);
    joinBox(paint, 'metal', center - 2, 11, 4, 2, bottom - 20);
    joinBox(paint, 'metal', center - 6, 12, 11, 4, 17);
    paint('amber', 2, rect(center + 2, 12, center + 5, 14));
    for (const y of [24, 28, 32]) paint('metal', 2, rect(center - 2, y, center + 2, y + 1));
  });
}

function replaceModules(base: Composition, spec: SemanticScene, frame: WetFrame, light: EnvironmentLight, flat: boolean) {
  const assets = new Map(base.environment.assets);
  const theme = base.environment.style.illumination[light];
  const sample = assets.get('crate')!;
  const wheelX = frame.layout.edge - 22;
  const wheelAt: [number, number] = [wheelX, frame.layout.center(wheelX) - Math.floor(frame.layout.width / 2) + 2];
  const items = frame.items.map(item => spec.gate && item.id === 'mooring-1' ? { ...item, at: wheelAt } : item);
  const modules: { id: string; at: Point; piece: Piece; footprint: [number, number] }[] = items.map(item => ({
    id: item.id, at: item.at,
    piece: item.ref === 'sluice' ? gate(theme, spec.gate!.span, spec.gate!.height)
      : post(theme, spec.gate !== null && item.id === 'mooring-1'),
    footprint: item.ref === 'sluice' ? [spec.gate!.span + 12, 12] : [8, 4],
  }));
  for (const { id, piece, footprint } of modules) {
    const raster = piece.raster, colors = new Set<number>();
    const flatInks = new Map((['wood', 'stone', 'metal', 'amber'] as const).map(role =>
      [pack(materialLegend[role]), pack(theme.surfaces[role][1])]));
    for (let i = 0; i < raster.rgba.length; i += 4) if (raster.rgba[i + 3]) {
      if (flat) raster.rgba.writeUInt32BE(flatInks.get(piece.material.rgba.readUInt32BE(i))!, i);
      colors.add(raster.rgba.readUInt32BE(i));
    }
    assets.set(id, { ref: { ...sample.ref, id, kind: 'prop', footprint, pivot: [piece.origin[0], piece.origin[1]],
      sha256: sha256(encodePng(raster)), provenance: 'E7.6R projected waterfront module' }, raster, colors, scale: undefined });
  }
  const placements = [...base.environment.spec.placements, ...items.map(item => ({ ...item, ref: item.id }))];
  const input = { ...base.environment, assets, spec: { ...base.environment.spec, placements } };
  const legacy = renderEnvironment(input, 'B', light, { composition: base.spec, kitSeed: base.kitSeed, flat });
  const fixed = (rows: typeof legacy.metadata.collisions) => rows.filter(c => !spec.gate || c.id !== 'mooring-1');
  assert.deepEqual(fixed(legacy.metadata.collisions), fixed(frame.legacy.metadata.collisions), 'B2_UNRELATED_COLLISION_CHANGED');
  assert.deepEqual(legacy.metadata.layerOrder, frame.legacy.metadata.layerOrder, 'B2_DEPTH_ORDER_CHANGED');
  return { legacy, modules, items, wheelAt };
}

function surfaceRules(frame: WetFrame, spec: SemanticScene, theme: Theme, water: WaterPalette[EnvironmentLight], flat: boolean) {
  const { layout, surfaces } = frame;
  const { layers, semantic } = surfaces;
  const { w, h } = frame.scene;
  const changes = makeRaster(w, h);
  const wood = theme.surfaces.wood.map(pack), waves = water.map(pack), dirt = theme.dirt.map(pack);
  const mark = (target: Raster, x: number, y: number, color: number) => {
    if (!covered(target, x, y)) return;
    if (target.rgba.readUInt32BE((y * w + x) * 4) !== color) put(changes, x, y, pack('#fff0b3'));
    put(target, x, y, color);
  };
  const gate = spec.gate;
  const channel = gate ? { x: gate.at[0], y: gate.at[1], throat: Math.floor(gate.span / 3) } : null;
  const [lipX, lipY] = layout.lip;
  const neck = Math.floor(layout.width / 2);
  for (let y = 0; y < h; y++) for (let x = layout.shore[y] - 8; x < w; x++) {
    const wet = x - layout.shore[y];
    if (wet < 0) {
      // Cut a discontinuous mud terrace into the existing dry bank band.
      const pocket = Math.abs(layout.shore[Math.max(0, y - 6)] - layout.shore[Math.min(h - 1, y + 6)]);
      const terrace = 2 + (Math.floor((y + spec.seed % 13) / 11) + pocket) % 5;
      if (wet >= -terrace && !covered(layers.path, x, y)) mark(layers.bank, x, y, dirt[wet >= -2 ? 0 : 1]);
      continue;
    }
    const under = covered(layers.support, x, y + 1) || covered(layers.support, x, y - 3);
    const wakeDepth = channel ? y - channel.y : -500;
    const channelOffset = channel ? x - channel.x - Math.trunc(wakeDepth / 5) : 500;
    let tone = under ? 0 : 1;
    if (wet < 2) tone = 0;
    else if (wet < 7 && (Math.floor((y + Math.floor(layout.shore[y] / 5)) / 7) % 3 === 1 || wet < 3)) tone = 2;
    else if (!flat && channel && wakeDepth > -17 && wakeDepth < 39 && Math.abs(channelOffset) < channel.throat + Math.max(0, wakeDepth >> 2)) {
      const trail = Math.abs(channelOffset % 7);
      tone = trail < 2 && (wakeDepth + 32 + Math.floor(x / 9)) % 15 < 11 ? (wakeDepth < 9 ? 3 : 2) : 0;
    } else if (!flat && !under) {
      // Long quiet patches have short groups of edge glints instead of aligned horizontal rows.
      const bankStep = Math.floor((x + spec.seed % 31) / 34);
      const row = (y + bankStep * 11 + 3 * (bankStep % 5)) % 39;
      const along = (x + spec.seed % 41 + 7 * Math.floor(y / 39)) % 34;
      if ((row === 5 || row === 8) && along >= 6 && along <= (row === 5 ? 25 : 16)) tone = 2;
      if (row === 19 && along >= 21 && along <= 30) tone = 0;
    }
    mark(layers.water, x, y, waves[tone]);
  }
  for (let x = layout.entry[0]; x < lipX; x++) {
    const y0 = layout.center(x), apron = x >= layout.edge ? 5 : 0;
    for (let y = y0 - neck - apron - 3; y <= y0 + neck + apron + layout.freeboard + 12; y++) {
      if (!covered(layers.deck, x, y)) {
        if (y > y0 + neck + apron && covered(layers.support, x, y)) {
          mark(layers.support, x, y, wood[y < y0 + neck + apron + 4 ? 2 : 0]);
        }
        continue;
      }
      const atApron = x >= layout.edge;
      const lip = lipX - x;
      // Board direction turns at the apron, leaving a bright sill and a darker rubbing edge.
      if (atApron) {
        const joints = (y - y0 + neck + apron + 1) % 6;
        const rim = lip < 5;
        const tone = rim ? lip === 2 ? 3 : lip === 1 ? 0 : 1 : flat ? 2 : joints === 0 ? 1 : 2;
        mark(layers.deck, x, y, wood[tone]);
      } else if (x < layout.entry[0] + 5) {
        mark(layers.deck, x, y, wood[x === layout.entry[0] + 2 ? 3 : 1]);
      }
    }
  }
  assert.ok(covered(layers.deck, lipX - 2, lipY), 'LANDING_SILL_OFF_DECK');
  return { surfaceImage: composite(Object.values(layers)), changes, semantic };
}

export function renderFunctionalWaterfront(base: Composition, spec: SemanticScene, water: WaterPalette,
  light: EnvironmentLight, flat = false) {
  const baseline = renderLanding(base, spec, 'b1', water, light, { flat });
  const frame = renderLanding(base, spec, 'b1', water, light, { flat });
  const { legacy, modules, items, wheelAt } = replaceModules(base, spec, frame, light, flat);
  const theme = base.environment.style.illumination[light], tones = water[light];
  const { surfaceImage, changes, semantic } = surfaceRules(frame, spec, theme, tones, flat);
  const scene = composite([legacy.raster]);
  const { w, h } = scene, { layerLegend } = legacy.metadata.atlas;
  const outlines = makeRaster(w, h);
  const roles = { actor: pack(layerLegend.actor), prop: pack(layerLegend.prop), building: pack(layerLegend.building),
    shadow: pack(layerLegend.shadow), water: pack('#346c82'), deck: pack('#d38c60') };
  const foreground = new Set([roles.actor, roles.prop, roles.building]);
  const legal = new Set([...legacy.metadata.palette.allowed, ...tones].map(pack));
  for (const model of modules) {
    const left = model.at[0] - model.piece.origin[0], top = model.at[1] - model.piece.origin[1];
    for (let y = 0; y < model.piece.raster.h; y++) for (let x = 0; x < model.piece.raster.w; x++) {
      if (covered(model.piece.material, x, y)) {
        put(outlines, left + x, top + y, model.piece.material.rgba.readUInt32BE((y * model.piece.raster.w + x) * 4));
      }
    }
  }

  const bounds = [...frame.legacy.metadata.occlusion, ...legacy.metadata.occlusion].filter(row =>
    modules.some(module => module.id === row.id));
  let changed = 0, editedForeground = 0, protectedPixels = 0, buildingDepthTransitions = 0;
  for (let i = 0; i < scene.rgba.length; i += 4) {
    const x = i / 4 % w, y = Math.floor(i / 4 / w);
    const owner = legacy.layerOverlay.rgba.readUInt32BE(i), oldOwner = baseline.legacy.layerOverlay.rgba.readUInt32BE(i);
    const insideModule = bounds.some(p => (x >= p.left && x < p.left + p.w && y >= p.top && y < p.top + p.h) ||
      (Math.abs(x - p.at[0]) <= 13 && y >= p.at[1] - 2 && y <= p.at[1] + 4));
    const surf = surfaceImage.rgba.readUInt32BE(i);
    if (surf && !foreground.has(owner)) {
      const role = semantic.rgba.readUInt32BE(i);
      const shade = role === roles.deck ? theme.surfaces.wood[1] : role === roles.water ? tones[0] : theme.surfaces.paving[0];
      scene.rgba.writeUInt32BE(owner === roles.shadow ? pack(shade) : surf, i);
    }
    const now = scene.rgba.readUInt32BE(i), before = baseline.scene.rgba.readUInt32BE(i);
    assert.ok(legal.has(now), 'B2_PALETTE');
    if (oldOwner === roles.actor || owner === roles.actor || (oldOwner === roles.building && owner === roles.building) ||
        (!insideModule && (oldOwner === roles.prop || owner === roles.prop))) {
      assert.equal(now, before, 'UNRELATED_FOREGROUND_CHANGED ' + x + ',' + y);
      protectedPixels++;
    }
    if (now !== before) {
      assert.ok(changes.rgba[i + 3] || insideModule, 'CHANGE_OUTSIDE_INTENDED_MASK');
      if (oldOwner !== owner && (oldOwner === roles.building || owner === roles.building)) buildingDepthTransitions++;
      changed++;
      if (insideModule && foreground.has(owner)) editedForeground++;
    }
  }
  const controls = spec.gate ? { kind: 'static-maintenance-wheel', at: wheelAt,
    handle: [wheelAt[0], wheelAt[1] - 15] as Point, stand: [wheelAt[0], wheelAt[1] + 11] as Point } : null;
  const layout = { ...frame.layout, posts: items.filter(item => item.ref === 'mooring').map(item => item.at) };
  return { ...frame, layout, legacy, items, scene, surfaceImage, legal: legal.size, changes, outlines,
    qa: { changed, editedForeground, protectedPixels, buildingDepthTransitions }, controls };
}
