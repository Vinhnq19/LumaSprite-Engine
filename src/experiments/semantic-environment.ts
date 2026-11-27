import assert from 'node:assert/strict';
import { z } from 'zod';
import { rect } from '../core/geometry/faces.ts';
import { projectBox } from '../core/geometry/projection.ts';
import { fillPolygon, type Point } from '../core/geometry/shapes.ts';
import { pack } from '../core/palette/colors.ts';
import { composite, makeRaster, put, type Raster } from '../core/pixels/raster.ts';
import { encodePng } from '../core/renderer/png.ts';
import { loadComposition, pointSweep, type Composition } from '../generators/environment/composition.ts';
import { materialLegend, materialPiece } from '../generators/environment/kit.ts';
import { renderEnvironment } from '../generators/environment/render.ts';
import { covered } from '../generators/environment/refinement.ts';
import { sha256 } from '../quality/raster.ts';
import type { EnvironmentLight, StyleProfile } from '../specs/environment.ts';
import type { PilotBrief } from './cross-asset-pilot.ts';

const int = (min: number, max: number) => z.number().int().min(min).max(max);
const point = z.tuple([int(12, 303), int(12, 193)]);
const pin = z.strictObject({ file: z.string().regex(/^benchmarks\/fixtures\/[a-z0-9-]+\/[a-z0-9-]+\.json$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/) });
const key = z.string().regex(/^[a-z][a-z0-9-]{2,40}$/);
export const semanticScene = z.strictObject({
  version: z.literal(1), size: z.tuple([z.literal(320), z.literal(208)]), view: z.literal('three-quarter-right'),
  id: key, name: z.string().min(6).max(100), role: z.enum(['development', 'holdout']), purpose: z.enum(['ferry', 'floodgate']),
  brief: z.string().min(30).max(250), seed: int(0, 0xffffffff), profile: pin, style: pin, base: pin,
  shore: z.array(z.tuple([int(0, 208), int(120, 240)])).min(3).max(12).refine(rows =>
    rows[0][0] === 0 && rows.at(-1)![0] === 208 && rows.every(([y], i) => i === 0 || y > rows[i - 1][0])),
  actors: z.strictObject({ surveyor: point, courier: point }),
  landProps: z.array(z.strictObject({ id: key, ref: z.enum(['crate', 'barrel', 'workbench']), at: point })).max(4),
  berth: point,
  params: z.strictObject({ clearWidth: int(24, 40), landingDepth: int(26, 50), freeboard: int(4, 8), bankOverlap: int(10, 28) }),
  assembly: z.strictObject({ entry: point, lip: point, landingDepth: int(26, 50), clearWidth: int(24, 40), turn: point }),
  gate: z.strictObject({ at: point, span: int(44, 60), height: int(36, 50) }).nullable(),
}).refine(data => (data.purpose === 'floodgate') === Boolean(data.gate));

export type SemanticScene = z.infer<typeof semanticScene>;
type Mode = 'a0' | 'b1';
type Theme = StyleProfile['illumination']['day'];
type Refined = { purpose: 'berth-rim'; enabled: boolean };
export type WaterPalette = Record<EnvironmentLight, readonly [string, string, string, string]>;
type WetRole = 'water' | 'bank' | 'path' | 'deck' | 'support';
const colors = {
  water: '#346c82', bank: '#9b8f60', path: '#d6b688', deck: '#d38c60', support: '#79525c',
} as const;
const W = 320, H = 208;
const blank = () => makeRaster(W, H);
const maskInk = pack('#ffffff');
const paint = (r: Raster, role: string, points: readonly Point[]) => fillPolygon(r, points, pack(role));
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function shoreline(spec: SemanticScene) {
  return Array.from({ length: H }, (_, y) => {
    const i = spec.shore.findIndex(([row]) => row > y);
    const [a, u] = spec.shore[i - 1], [b, v] = spec.shore[i];
    return Math.round(u + (v - u) * (y - a) / (b - a));
  });
}

export function planLanding(spec: SemanticScene, mode: Mode) {
  const shore = shoreline(spec);
  const berth = spec.berth, [bx, by] = berth;
  const params = spec.params, manual = spec.assembly;
  const entry: Point = mode === 'a0' ? manual.entry : [shore[by] - params.bankOverlap, by + 3];
  const lip: Point = mode === 'a0' ? manual.lip : [bx + 18, by];
  const turn: Point = mode === 'a0' ? manual.turn : [entry[0] - 23, entry[1] + Math.round(clamp(spec.actors.surveyor[1] - entry[1], 0, 20) / 2)];
  const width = mode === 'a0' ? manual.clearWidth : params.clearWidth;
  const depth = mode === 'a0' ? manual.landingDepth : params.landingDepth;
  const [x0, y0] = entry, [x1, y1] = lip;
  assert.ok(x0 < x1 - 32 && bx < x1 && x1 < W - 6);
  const center = (x: number) => Math.round(y0 + (y1 - y0) * (x - x0) / (x1 - x0));
  const edge = x1 - depth, jointY = center(edge), neck = Math.floor(width / 2), apron = neck + 5;
  const deck: Point[] = [[x0, y0 - neck], [edge, jointY - neck], [edge, jointY - apron], [x1, y1 - apron],
    [x1, y1 + apron], [edge, jointY + apron], [edge, jointY + neck], [x0, y0 + neck]];
  const [sx, sy] = spec.actors.surveyor;
  const access: Point[] = [[sx - 19, sy - 14], [turn[0], turn[1] - 14], [x0 + 5, y0 - neck + 1],
    [x0 + 5, y0 + neck - 1], [turn[0], turn[1] + 15], [sx - 19, sy + 17]];
  const bankCrossing = shore[clamp(Math.round(y0), 0, H - 1)];
  const posts: Point[] = [[edge + 6, jointY - apron + 5], [x1 - 8, y1 + apron - 3]];
  return { shore, entry, lip, berth, turn, center, deck, access, edge, width, depth, freeboard: params.freeboard,
    bankCrossing, posts, route: [spec.actors.surveyor, turn, entry, berth] as Point[] };
}

type Layout = ReturnType<typeof planLanding>;
type E6Scene = ReturnType<typeof renderEnvironment>;
type Piece = ReturnType<ReturnType<typeof materialPiece>>;
type Asset = NonNullable<ReturnType<Composition['environment']['assets']['get']>>;
const waterIn = (layout: Layout, x: number, y: number) => x >= layout.shore[y];

function bollard(theme: Theme): Piece {
  return materialPiece(theme)(16, 27, [7, 25], (p, patch) => {
    const post = projectBox({ left: 4, top: 7, width: 5, depth: 4, bottom: 25, taper: 0 });
    p('wood', 0, post.side); p('wood', 2, post.front); p('wood', 3, post.top);
    patch('wood', 1, post.front, .6, .05, 1, 1);
    p('metal', 1, rect(3, 13, 10, 15));
    p('metal', 0, rect(3, 15, 10, 16));
    p('metal', 2, rect(3, 12, 9, 13));
  });
}

function sluice(theme: Theme, span: number, height: number): Piece {
  const w = span + 19, h = height + 11;
  return materialPiece(theme)(w, h, [Math.floor(w / 2), h - 1], (p, patch) => {
    const lower = h - 2;
    const box = (role: 'wood' | 'metal' | 'stone', x: number, y: number, width: number, depth: number, bottom: number) => {
      const f = projectBox({ left: x, top: y, width, depth, bottom, taper: 0 });
      p(role, 0, f.side); p(role, 1, f.front); p(role, 2, f.top);
      patch(role, 3, f.top, .05, .24, .88, .65);
    };
    box('wood', 6, 18, span + 2, 7, lower - 7);
    for (let x = 16; x < span; x += 6) p('wood', 0, rect(x, 19, x + 1, lower - 8));
    p('metal', 2, rect(11, 23, span + 4, 25));
    p('metal', 0, rect(11, lower - 13, span + 4, lower - 11));
    for (const x of [5, span]) {
      box('stone', x - 2, 10, 13, 7, lower + 1);
      box('stone', x, 6, 9, 7, lower - 4);
      for (let y = 17; y < lower - 4; y += 9) {
        p('stone', 0, rect(x, y, x + 9, y + 1));
        p('stone', 2, rect(x + ((y / 9) % 2 < 1 ? 2 : 5), y - 2, x + 7, y - 1));
      }
    }
    box('wood', 11, 12, span - 4, 6, 17);
    box('metal', Math.floor(span / 2) + 2, 10, 4, 3, lower - 8);
    box('metal', Math.floor(span / 2) - 2, 7, 12, 5, 11);
    p('amber', 2, rect(Math.floor(span / 2), 9, Math.floor(span / 2) + 3, 10));
  });
}

function stableAsset(id: string, sample: Asset, piece: Piece, footprint: [number, number]): Asset {
  const native = piece.raster;
  const inks = new Set<number>();
  for (let i = 0; i < native.rgba.length; i += 4) if (native.rgba[i + 3]) inks.add(native.rgba.readUInt32BE(i));
  return { ref: { ...sample.ref, id, kind: 'prop', pivot: [piece.origin[0], piece.origin[1]], footprint,
    sha256: sha256(encodePng(native)), provenance: 'E7.6 semantic module' }, raster: native, colors: inks, scale: undefined };
}

export async function prepareSemantic(spec: SemanticScene, heritage: PilotBrief, style: StyleProfile) {
  const loaded = await loadComposition(heritage.scene);
  assert.deepEqual(loaded.spec.size, spec.size);
  assert.equal(loaded.environment.spec.style.sha256, spec.profile.sha256);
  const base = loaded.environment.spec;
  const props = spec.landProps;
  const spawns = (['surveyor', 'courier'] as const).map(actor => ({ actor, at: spec.actors[actor] }));
  const composition = { ...loaded.spec, name: spec.name, id: spec.id, seed: spec.seed, props, spawns, paving: [] };
  const environment = { ...loaded.environment, style, spec: { ...base, name: spec.name, seed: spec.seed,
    building: { ...base.building, ...heritage.architecture }, placements: [...props, ...spawns.map(a => ({ id: a.actor, ref: a.actor, at: a.at }))] } };
  // Rebuild E3 terrain for the locked pilot seed through the ordinary loader.
  const regenerated = await loadComposition({ ...loaded.spec, name: spec.name, id: spec.id, seed: spec.seed });
  return { spec: composition, environment: { ...environment, ground: regenerated.environment.ground }, kitSeed: loaded.kitSeed };
}

function shoreScenes(base: Composition, spec: SemanticScene, layout: Layout, light: EnvironmentLight, flat: boolean) {
  const { style, assets: pinned } = base.environment, theme = style.illumination[light];
  const assets = new Map(pinned);
  const originalProp = assets.get('crate')!;
  const flatPiece = (piece: Piece) => {
    if (!flat) return piece;
    const { raster, material } = piece;
    const tones = new Map((['wood', 'stone', 'metal', 'amber'] as const).map(role =>
      [pack(materialLegend[role]), pack(theme.surfaces[role][1])]));
    for (let i = 0; i < raster.rgba.length; i += 4) if (raster.rgba[i + 3]) {
      raster.rgba.writeUInt32BE(tones.get(material.rgba.readUInt32BE(i))!, i);
    }
    return piece;
  };
  const items = layout.posts.map((at, i) => ({ id: 'mooring-' + (i + 1), ref: 'mooring', at: [...at] as [number, number] }));
  assets.set('mooring', stableAsset('mooring', originalProp, flatPiece(bollard(theme)), [8, 4]));
  if (spec.gate) {
    const { at, span, height } = spec.gate;
    assets.set('sluice', stableAsset('sluice', originalProp, flatPiece(sluice(theme, span, height)), [span + 12, 12]));
    items.push({ id: 'sluice', ref: 'sluice', at });
  }
  const environment = { ...base.environment, assets, spec: { ...base.environment.spec,
    placements: [...base.environment.spec.placements, ...items] } };
  const legacy = renderEnvironment(environment, 'B', light, { composition: base.spec, kitSeed: base.kitSeed, flat });
  return { legacy, items };
}

function wave(seed: number, x: number, y: number) {
  const j = Math.floor((x + (Math.floor(y / 7) % 2) * 11) / 29);
  let v = Math.imul(j + 47, 5179) ^ Math.imul(y + 103, 1297) ^ seed;
  v ^= v >>> 11;
  return v & 255;
}

function paintSurfaces(layout: Layout, theme: Theme, water: WaterPalette[EnvironmentLight], seed: number, flat: boolean, refine: Refined) {
  const layers = { water: blank(), bank: blank(), path: blank(), deck: blank(), support: blank() };
  const semantic = blank();
  const ink = (name: WetRole, tone: string, x: number, y: number) => {
    put(layers[name], x, y, pack(tone));
    put(semantic, x, y, pack(colors[name]));
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const bank = layout.shore[y], wet = x - bank;
    if (wet >= 0) {
      const streak = wave(seed, x, y), phase = (x + (Math.floor(y / 7) % 2) * 11) % 29;
      const tone = wet < 2 ? 0 : wet < 5 ? 2 : flat ? 1
        : y % 7 === 0 && phase > 3 && phase < 10 + streak % 11 ? (streak > 180 ? 3 : 2)
          : y % 9 === 4 && phase > 8 && phase < 20 ? 0 : 1;
      ink('water', water[tone], x, y);
    } else if (wet >= -10) {
      const tone = wet === -1 ? theme.dirt[0] : wet >= -4 ? theme.dirt[2] : wet >= -7 ? theme.dirt[1] : theme.grass[1];
      ink('bank', tone, x, y);
    }
  }
  if (!flat) for (let y = 18; y < H - 10; y += 14) {
    if (Math.abs(y - layout.entry[1]) < layout.width * .74) continue;
    const x = layout.shore[y] - 5;
    paint(layers.bank, theme.grass[0], [[x - 3, y + 2], [x - 3, y - 3], [x - 1, y - 1], [x, y - 8],
      [x + 1, y - 1], [x + 3, y - 5], [x + 2, y + 3]]);
    paint(layers.bank, theme.grass[2], [[x, y - 7], [x + 1, y - 3], [x + 2, y + 1], [x, y]]);
  }
  for (let i = 0; i < layers.bank.rgba.length; i += 4) {
    if (layers.bank.rgba[i + 3]) semantic.rgba.writeUInt32BE(pack(colors.bank), i);
  }
  const pathMask = blank();
  fillPolygon(pathMask, layout.access, maskInk);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!waterIn(layout, x, y) && covered(pathMask, x, y)) {
    const edge = !covered(pathMask, x, y - 1) || !covered(pathMask, x, y + 1);
    const n = wave(seed + 73, x - x % 4, y - y % 3);
    ink('path', theme.surfaces.paving[edge ? 0 : !flat && n < 27 ? 2 : 1], x, y);
  }
  const top = blank();
  fillPolygon(top, layout.deck, maskInk);
  const [, y1] = layout.lip;
  const [x0] = layout.entry, [x1] = layout.lip;
  const edgeAt = (x: number) => layout.center(x) + Math.floor(layout.width / 2) + (x >= layout.edge ? 5 : 0);
  for (let x = x0; x < x1; x++) {
    const lower = edgeAt(x), upper = 2 * layout.center(x) - lower;
    for (let y = lower + layout.freeboard; y < lower + layout.freeboard + 4; y++) if (y < H && waterIn(layout, x, y)) {
      ink('water', water[0], x, y);
    }
    for (let y = lower; y < lower + layout.freeboard; y++) if (y < H) {
      const joint = (x - x0) % 9;
      ink('support', theme.surfaces.wood[y === lower ? 3 : joint === 0 || y === lower + layout.freeboard - 1 ? 0 : 1], x, y);
    }
    if ((x - x0) % 17 <= 3) for (let y = lower + layout.freeboard - 1; y < Math.min(H, lower + 13); y++) {
      ink('support', theme.surfaces.wood[(x - x0) % 17 < 2 ? 1 : 0], x, y);
    }
    for (let y = Math.max(0, upper - 2); y < Math.min(H, lower + 2); y++) if (covered(top, x, y)) {
      const joint = (x - x0) % 9, n = wave(seed + x0, x - joint, upper);
      const tone = flat ? 2 : y === upper ? 3 : joint === 0 ? 1 : n < 85 ? 2 : joint <= 5 ? 2 : 1;
      ink('deck', theme.surfaces.wood[tone], x, y);
      if (!flat && y > upper + 4 && y < lower - 3 && joint > 2 && joint < 7 && (y - upper) % 11 === 0 && n > 118) {
        ink('deck', theme.surfaces.wood[3], x, y);
      }
    }
  }
  const target = blank();
  if (refine.enabled && !flat) {
    const x1 = layout.lip[0], y0 = y1 - Math.floor(layout.width / 2) - 5, y2 = 2 * y1 - y0;
    for (let y = y0 + 2; y < y2 - 2; y++) for (let x = x1 - 4; x < x1 - 1; x++) if (covered(layers.deck, x, y)) {
      put(target, x, y, maskInk);
      put(layers.deck, x, y, pack(theme.surfaces.wood[x === x1 - 4 ? 1 : x === x1 - 2 ? 3 : 2]));
    }
  }
  return { layers, semantic, top, pathMask, target };
}

function placeSurfaces(legacy: E6Scene, surfaces: ReturnType<typeof paintSurfaces>, theme: Theme, water: WaterPalette[EnvironmentLight]) {
  const scene = composite([legacy.raster]);
  const { layerLegend } = legacy.metadata.atlas;
  const shadeInk = pack(layerLegend.shadow);
  const foreground = new Set([layerLegend.actor, layerLegend.prop, layerLegend.building].map(pack));
  const surfaceImage = composite(Object.values(surfaces.layers));
  for (let i = 0; i < scene.rgba.length; i += 4) {
    const owner = legacy.layerOverlay.rgba.readUInt32BE(i), surface = surfaceImage.rgba.readUInt32BE(i);
    if (!surface || foreground.has(owner)) continue;
    const role = surfaces.semantic.rgba.readUInt32BE(i);
    const shade = role === pack(colors.deck) ? theme.surfaces.wood[1] : role === pack(colors.water) ? water[0] : theme.surfaces.paving[0];
    scene.rgba.writeUInt32BE(owner === shadeInk ? pack(shade) : surface, i);
  }
  return { scene, surfaceImage };
}

export function renderLanding(base: Composition, spec: SemanticScene, mode: Mode, water: WaterPalette,
  light: EnvironmentLight, options: { flat?: boolean; refine?: boolean } = {}) {
  const layout = planLanding(spec, mode);
  const { legacy, items } = shoreScenes(base, spec, layout, light, Boolean(options.flat));
  const theme = base.environment.style.illumination[light];
  const surfaces = paintSurfaces(layout, theme, water[light], spec.seed, Boolean(options.flat),
    { purpose: 'berth-rim', enabled: Boolean(options.refine) });
  const { scene, surfaceImage } = placeSurfaces(legacy, surfaces, theme, water[light]);
  const legal = new Set([...legacy.metadata.palette.allowed, ...water[light]].map(pack));
  for (let i = 0; i < scene.rgba.length; i += 4) assert.ok(legal.has(scene.rgba.readUInt32BE(i)), 'INVALID_SCENE_PALETTE');
  return { layout, scene, legacy, items, surfaces, surfaceImage, legal: legal.size };
}

export function routeOverlay(scene: Raster, mask: Raster, route: readonly Point[]) {
  const output = composite([scene]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (covered(mask, x, y) && (x + y) % 7 === 0) put(output, x, y, pack('#8ee3aa'));
  }
  for (const [x, y] of pointSweep(route)) put(output, x, y, pack('#fff2a1'));
  return output;
}
