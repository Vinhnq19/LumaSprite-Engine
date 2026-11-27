import assert from 'node:assert/strict';
import { z } from 'zod';
import { rect } from '../core/geometry/faces.ts';
import { projectBox } from '../core/geometry/projection.ts';
import { fillPolygon, type Point } from '../core/geometry/shapes.ts';
import { pack } from '../core/palette/colors.ts';
import { composite, makeRaster, put, silhouette, type Raster } from '../core/pixels/raster.ts';
import { renderOutlinedLayers } from '../core/renderer/layers.ts';
import { encodePng } from '../core/renderer/png.ts';
import { characterReview } from '../generators/character/export.ts';
import { characterColors } from '../generators/character/geometry.ts';
import { materialMaskLegend, renderCharacterMaterials } from '../generators/character/materials.ts';
import { alphaPlane, makeShapeLock, requireShapeLock } from '../generators/character/shape-lock.ts';
import { materialLegend } from '../generators/environment/kit.ts';
import { checkCharacter } from '../quality/character.ts';
import { sha256 } from '../quality/raster.ts';
import { characterSpecSchema } from '../specs/character.ts';
import type { StyleProfile } from '../specs/environment.ts';
import { crossAssetStyle, type ArtDirectionSpec } from './art-direction.ts';
import { paintHandTool, planHandTool, type ToolKind } from './character-equipment.ts';
import { contourOwner, lockValidMask, protectLocal, validateHandGrip } from './quality-guided-character.ts';
import { inspectStructure } from './structure-quality/diagnostics.ts';

const bound = (lo: number, hi: number) => z.number().int().min(lo).max(hi);
const point = z.tuple([bound(2, 61), bound(2, 61)]);
const pin = z.strictObject({ file: z.string().regex(/^benchmarks\/fixtures\/[a-z0-9-]+\/[a-z0-9-]+\.json$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/) });
const arm = z.strictObject({ elbow: point, wrist: point, palm: point });
const leg = z.strictObject({ knee: point, ankle: point });
const recipe = z.strictObject({ near: arm, far: arm, farLeg: leg.optional(),
  tools: z.array(z.strictObject({ kind: z.enum(['toolbox', 'wrench', 'hook', 'pole']),
    hand: z.enum(['near', 'far', 'both']), axis: z.tuple([bound(-12, 12), bound(-12, 12)]) })).min(1).max(2),
}).refine(({ tools }) => tools.some(t => t.kind === 'pole') ? tools.length === 1 && tools[0].hand === 'both' :
  tools.every(t => t.hand !== 'both') && new Set(tools.map(t => t.hand)).size === tools.length);
export const identityBrief = z.strictObject({
  version: z.literal(1), id: z.string().regex(/^[a-z][a-z0-9-]+$/), name: z.string().min(5),
  role: z.enum(['development', 'holdout']), profile: pin, style: pin, context: pin, historical: pin.nullable(),
  selected: z.enum(['a1', 'a2']).nullable(), actor: z.enum(['courier', 'surveyor']),
  canvas: z.literal(64), view: z.literal('three-quarter-right'), seed: bound(0, 0xffffffff),
  body: z.enum(['workwear', 'rainwear', 'porter']), spec: characterSpecSchema,
  defect: z.strictObject({ id: z.string().min(4), cause: z.string().min(10), approach: z.string().min(10) }),
  matched: recipe.nullable(), refined: recipe,
});
export type IdentityBrief = z.infer<typeof identityBrief>;
type Body = ReturnType<typeof characterReview>;
type Geometry = Body['plan']['parts'][number]['shapes'];
type Planes = ReturnType<typeof planHandTool>;
type Hand = 'near' | 'far';
const opaque = (r: Raster, i: number) => r.rgba[i * 4 + 3] === 255;
const at = (r: Raster, p: Point) => r.rgba.readUInt32BE((p[1] * r.w + p[0]) * 4);

function outfit(body: Body, design: IdentityBrief['body']): Body {
  const { plan: rig } = body, [x, y] = rig.landmarks.crown.point;
  const radius = Math.floor(body.spec.proportions.head[0] / 2);
  const parts = rig.parts.map(part => ({ ...part, shapes: [...part.shapes] }));
  const polygon = (ink: keyof typeof characterColors, points: readonly Point[]) => ({ ink, polygon: points });
  if (design !== 'rainwear') {
    const broad = design === 'porter';
    const rim = radius + (broad ? 4 : 0), brim = broad ? 4 : 2;
    const crownTop = y - (broad ? 4 : 7);
    parts.find(part => part.id === 'hood')!.shapes = [
      polygon('cap', [[x - radius + 1, y - 1], [x - radius + 2, y - 5], [x - 2, crownTop], [x + 4, crownTop + 1],
        [x + radius - 2, y - 4], [x + radius - 1, y], [x - radius + 1, y + 1]]),
      polygon('brim', [[x - rim, y - 1], [x + rim + brim, y - 1], [x + rim + brim - 2, y + 1], [x - rim + 1, y + 2]]),
    ];
  }
  if (design === 'rainwear') {
    const [nx, ny] = rig.landmarks.neck.point;
    const knee = body.spec.pose.near.knee[1];
    const hem = Math.min(knee + 1, ny + 23);
    const cape: Geometry = [
      polygon('farCoat', [[nx - 4, ny], [nx - 9, ny + 5], [nx - 12, hem - 4], [nx - 10, hem], [nx - 6, hem - 2],
        [nx - 3, hem + 1], [nx + 2, hem - 6], [nx + 4, ny + 5], [nx + 2, ny]]),
      polygon('jacket', [[nx - 5, ny + 3], [nx - 9, ny + 8], [nx - 10, hem - 4], [nx - 7, hem - 5], [nx - 2, ny + 6]]),
    ];
    const jacketIndex = parts.findIndex(part => part.id === 'jacket');
    parts.splice(jacketIndex, 0, { id: 'cape', shapes: cape });
  }
  if (design === 'workwear') {
    const b = body.metadata.diagnostics.parts.satchel;
    const pocket = projectBox({ left: b.left, top: b.top + 1, width: b.right - b.left - 1, depth: 2, bottom: b.bottom + 1, taper: 1 });
    parts.find(part => part.id === 'satchel')!.shapes = [polygon('leather', pocket.side), polygon('leather', pocket.front),
      polygon('leather', pocket.top), polygon('contour', rect(b.left + 1, b.top + 4, b.right - 1, b.top + 5))];
  }
  const layers = Object.fromEntries(parts.map(({ id, shapes }) => {
    if (id !== 'hood' && id !== 'cape' && !(design === 'workwear' && id === 'satchel')) return [id, body.layers[id]];
    const r = makeRaster(64, 64);
    for (const shape of shapes) if ('polygon' in shape) fillPolygon(r, shape.polygon, pack(characterColors[shape.ink]));
    return [id, r];
  }));
  const ordered = parts.map(({ id }) => layers[id]);
  const { flat, silhouette: alpha } = renderOutlinedLayers(ordered, ordered, pack(characterColors.contour));
  const plan = { ...rig, parts };
  const native = { ...body, plan, layers, flat, silhouette: alpha };
  const diagnostics = checkCharacter(native);
  assert.deepEqual(diagnostics.errors, [], 'OUTFIT_GEOMETRY');
  const f = encodePng(flat), s = encodePng(alpha);
  const metadata = { ...body.metadata, bodyPlan: plan, diagnostics, images: { flatPngSha256: sha256(f), silhouettePngSha256: sha256(s) } };
  return { ...native, metadata, files: new Map([
    ['flat.png', f], ['silhouette.png', s], ['geometry.json', Buffer.from(JSON.stringify(metadata, null, 2) + '\n')],
  ]) };
}

function toolGeometry(kind: ToolKind, anchor: Point, axis: Point): Planes {
  if (kind === 'toolbox') {
    const planes = planHandTool(kind, anchor, axis);
    const [x, y] = anchor;
    return [...planes, { role: 'metal', tone: 2, points: rect(x - 6, y + 10, x - 4, y + 14) },
      { role: 'metal', tone: 2, points: rect(x + 1, y + 10, x + 3, y + 14) }];
  }
  const length = Math.hypot(...axis);
  const [dx, dy] = [axis[0] / length, axis[1] / length];
  const grown = planHandTool(kind, anchor, axis).map((plane, index) => ({
    ...plane, points: plane.points.map(([x, y]) => {
      const u = (x - anchor[0] - .5) * dx + (y - anchor[1] - .5) * dy;
      const v = -(x - anchor[0] - .5) * dy + (y - anchor[1] - .5) * dx;
      const lead = u > 3 ? Math.min(2, (u - 3) / 4) : Math.max(0, -u - 2.5);
      const width = index < 2 ? .85 : kind === 'hook' ? 1.27 : 1.13;
      return [anchor[0] + .5 + (u + lead) * dx - v * width * dy,
        anchor[1] + .5 + (u + lead) * dy + v * width * dx] as Point;
    }),
  }));
  let scale = 1;
  for (const { points } of grown) for (const point of points) for (const axis of [0, 1] as const) {
    const origin = anchor[axis] + .5;
    const delta = point[axis] - origin;
    if (delta < 0) scale = Math.min(scale, (origin - 1.5) / -delta);
    if (delta > 0) scale = Math.min(scale, (62.25 - origin) / delta);
  }
  assert.ok(scale >= .85, 'TOOL_MARGIN: a full-size tool needs a different grip pose.');
  return grown.map(plane => ({ ...plane, points: plane.points.map(([x, y]): Point =>
    [anchor[0] + .5 + (x - anchor[0] - .5) * scale, anchor[1] + .5 + (y - anchor[1] - .5) * scale]) }));
}

function sharedCarrier(near: Point, far: Point): Planes {
  const [x, y] = near, [u, v] = far;
  assert.ok(u - x >= 16 && Math.abs(v - y) <= 7, 'CARRIER_GRIP_SPAN');
  const left: Point = [x - 7, y + 1], right: Point = [u + 7, v - 1];
  const head = projectBox({ left: left[0] - 5, top: left[1] + 7, width: 10, depth: 3, bottom: left[1] + 15, taper: 1 });
  return [
    { role: 'wood', tone: 0, points: rect(left[0] - 2, left[1], left[0], left[1] + 8) },
    { role: 'wood', tone: 1, points: rect(left[0] + 2, left[1], left[0] + 4, left[1] + 8) },
    { role: 'wood', tone: 0, points: head.side }, { role: 'wood', tone: 1, points: head.front },
    { role: 'wood', tone: 2, points: head.top },
    { role: 'metal', tone: 1, points: rect(left[0] + 1, left[1] + 9, left[0] + 3, left[1] + 12) },
    { role: 'wood', tone: 2, points: [[left[0], left[1] - 1], [right[0], right[1] - 1], [right[0], right[1] + 2], [left[0], left[1] + 2]] },
    { role: 'wood', tone: 3, points: [[left[0], left[1] - 1], [right[0], right[1] - 1], [right[0], right[1]], [left[0], left[1]]] },
  ];
}

function ownerMap(order: string[], layers: Record<string, Raster>, labels: Record<string, number>) {
  const rasters = order.map(id => silhouette(layers[id], labels[id]));
  return renderOutlinedLayers(rasters, rasters, contourOwner).final;
}

function verifySharedCarrier(planes: Planes, flat: Raster, hands: Record<Hand, Point>, layout: {
  layers: Record<string, Raster>; owner: Raster; labels: Record<string, number>;
}) {
  return (['near', 'far'] as const).map(hand => {
    const anchor = hands[hand], palm = layout.layers[hand + '-hand'];
    assert.ok(at(flat, anchor) && at(palm, anchor), 'TWO_HAND_ANCHOR: pole missed ' + hand + ' palm.');
    assert.equal(at(layout.owner, anchor), layout.labels[hand + '-hand'], 'TWO_HAND_DEPTH: pole covers a hand.');
    const overlap = alphaPlane(flat).reduce((n, a, i) => n + Number(a === 255 && opaque(palm, i)), 0);
    assert.ok(overlap >= 3, 'TWO_HAND_PIXELS');
    assert.ok(planes.length > 0);
    return { kind: 'pole', hand, anchor, overlap, exposed: alphaPlane(flat).reduce((n, a, i) =>
      n + Number(a === 255 && layout.owner.rgba.readUInt32BE(i * 4) === layout.labels['both-tool']), 0) };
  });
}

export function identityCandidate(brief: IdentityBrief, variant: 'matched' | 'refined',
  profile: StyleProfile, direction: ArtDirectionSpec, revision: string) {
  const recipe = brief[variant];
  assert.ok(recipe);
  const { device, character } = crossAssetStyle(profile, direction);
  const base = brief.spec;
  assert.equal(base.version, 3);
  assert.equal(base.palette.mode, 'authored');
  assert.deepEqual([base.seed, base.view, base.canvas.w], [brief.seed, brief.view, brief.canvas]);
  const posed = { ...base, pose: { ...base.pose, near: { ...base.pose.near, ...recipe.near },
    far: { ...base.pose.far, ...recipe.far, ...recipe.farLeg } } };
  const body = outfit(characterReview(posed), brief.body);
  const anchors = { near: body.plan.landmarks['near-palm'].point, far: body.plan.landmarks['far-palm'].point };
  const tools = recipe.tools.map(input => {
    const anchor = anchors[input.hand === 'both' ? 'near' : input.hand];
    const planes = input.kind === 'pole' ? sharedCarrier(anchors.near, anchors.far) : toolGeometry(input.kind, anchor, input.axis);
    assert.ok(planes.every(plane => plane.points.every(([x, y]) => x >= 1 && y >= 1 && x < 63 && y < 63)), 'TOOL_MARGIN');
    const flat = paintHandTool(planes, device, anchor, true).raster;
    assert.equal(inspectStructure(flat).stat.components.length, 1, 'TOOL_CONNECTIVITY');
    return { ...input, id: input.hand + '-tool', anchor, planes, flat };
  });
  const carrier = tools.find(tool => tool.hand === 'both');
  const order = body.plan.parts.flatMap(({ id }) => {
    if (carrier) return id.endsWith('-hand') ? [] : [id];
    const tool = tools.find(item => item.hand + '-hand' === id);
    return tool ? [tool.id, id] : [id];
  });
  if (carrier) order.push(carrier.id, 'far-hand', 'near-hand');
  const labels = Object.fromEntries(order.map((id, i) => [id, (0x435662 + 104729 * i) * 256 + 255]));
  const layers = { ...body.layers, ...Object.fromEntries(tools.map(tool => [tool.id, tool.flat])) };
  const layerOrder = order.map(id => layers[id]);
  const shape = renderOutlinedLayers(layerOrder, layerOrder, pack(characterColors.contour));
  const owner = ownerMap(order, layers, labels);
  const layout = { layers, owner, labels, order, flat: shape.flat, silhouette: shape.silhouette };
  const silhouetteStat = inspectStructure(shape.flat).stat;
  const bounds = silhouetteStat.bounds!;
  const lock = makeShapeLock(body, revision, brief.id + '-' + variant);
  const pose = composite([shape.flat]);
  for (const { from, to } of body.plan.links) {
    const a = body.plan.landmarks[from].point, b = body.plan.landmarks[to].point;
    const length = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), 1);
    for (let i = 0; i <= length; i++) put(pose, Math.round(a[0] + (b[0] - a[0]) * i / length),
      Math.round(a[1] + (b[1] - a[1]) * i / length), pack('#d5c1ec'));
  }
  for (const { point } of Object.values(body.plan.landmarks)) put(pose, ...point, pack('#fff0d0'));
  for (const tool of tools) {
    put(pose, ...tool.anchor, pack('#ffc079'));
    if (tool.hand === 'both') put(pose, ...anchors.far, pack('#ffc079'));
  }
  put(pose, ...body.plan.pivot, pack('#75dfc2'));
  const frames = { flat: shape.flat, silhouette: silhouette(shape.flat, pack('#ffffff')), owners: owner, pose };
  let grips;
  try {
    assert.equal(silhouetteStat.components.length, 1, 'COMBINED_CONNECTIVITY');
    assert.ok(bounds.left >= 1 && bounds.top >= 1 && bounds.right <= 62 && bounds.bottom === body.plan.pivot[1] - 1, 'PIVOT_OR_MARGIN');
    grips = tools.flatMap(tool => tool.hand === 'both' ? verifySharedCarrier(tool.planes, tool.flat, anchors, layout)
      : [validateHandGrip(layout, { ...tool, hand: tool.hand, kind: tool.kind as ToolKind })]);
  } catch (error) {
    return { pass: false as const, frames, reason: error instanceof Error ? error.message : String(error), body, lock };
  }
  const ramps = { ...character!.ramps };
  if (base.outfit.cloth === 'russet-moss') {
    delete ramps.coat;
    delete ramps['far-coat'];
  }
  const paint = renderCharacterMaterials(body, lock, 'm2p', undefined, { ...character!, ramps });
  const equipment = Object.fromEntries(tools.map(tool => [tool.id, paintHandTool(tool.planes, device, tool.anchor, false)]));
  const painted = { ...paint.layers, ...Object.fromEntries(Object.entries(equipment).map(([id, paint]) => [id, paint.raster])) };
  if (brief.body === 'workwear') for (const hand of ['near', 'far'] as const) {
    const id = hand + '-hand', glove = composite([painted[id]]);
    const [gx, gy] = anchors[hand];
    const mask = body.layers[id];
    for (let y = gy - 4; y <= gy + 4; y++) for (let x = gx - 5; x <= gx + 5; x++) if (at(mask, [x, y])) {
      put(glove, x, y, pack(device.surfaces.wood[y <= gy - 1 ? 3 : y <= gy + 1 ? 2 : 1]));
    }
    painted[id] = glove;
  }
  lockValidMask(owner, ownerMap(order, painted, labels));
  const rasterOrder = order.map(id => painted[id]);
  const final = renderOutlinedLayers(rasterOrder, rasterOrder, pack(character!.outline)).final;
  const material = makeRaster(64, 64);
  for (let i = 0; i < final.rgba.length; i += 4) {
    const role = owner.rgba.readUInt32BE(i);
    if (!role) continue;
    const old = paint.mask.rgba.readUInt32BE(i);
    if (role === contourOwner) {
      const ink = pack(materialMaskLegend.contour);
      if (old === ink) final.rgba.writeUInt32BE(paint.final.rgba.readUInt32BE(i), i);
      material.rgba.writeUInt32BE(ink, i);
      continue;
    }
    const tool = tools.find(t => labels[t.id] === role);
    const isWood = tool && equipment[tool.id].material.rgba.readUInt32BE(i) === pack(materialLegend.wood);
    const glove = brief.body === 'workwear' && [labels['near-hand'], labels['far-hand']].includes(role);
    const selected = tool ? pack(isWood ? materialMaskLegend.leather : materialMaskLegend.metal)
      : glove ? pack(materialMaskLegend.leather) : role === labels['far-hand'] ? pack(materialMaskLegend.skin) : old;
    assert.ok(selected, 'MATERIAL_OWNERSHIP');
    material.rgba.writeUInt32BE(selected, i);
  }
  for (const r of [final, material, owner]) assert.ok(alphaPlane(r).equals(alphaPlane(frames.silhouette)));
  const allowed = new Set([character!.outline, ...paint.usedColors, ...device.surfaces.metal, ...device.surfaces.wood].map(pack));
  const stat = inspectStructure(final, allowed, material).stat;
  const protectedState = protectLocal(final, final, makeRaster(64, 64), 0);
  return { pass: true as const, body, lock, layout, tools, anchors, frames: { ...frames, material, final }, grips, stat,
    technicalGrip: 'TECHNICAL_GRIP_VALID', artisticGrip: 'ARTISTIC_GRIP_READABLE_PENDING_HUMAN_REVIEW',
    protectedState, silhouetteStat };
}

export function negativeIdentity(candidate: Extract<ReturnType<typeof identityCandidate>, { pass: true }>) {
  const { body, layout, tools, frames, lock, anchors } = candidate;
  const plan = { ...body.plan, landmarks: { ...body.plan.landmarks,
    'near-wrist': { ...body.plan.landmarks['near-wrist'], point: [2, 2] as Point } } };
  assert.throws(() => requireShapeLock({ ...body, plan }, lock), /shape lock/);
  const broken = composite([layout.owner]);
  broken.rgba[3] = 255;
  assert.throws(() => lockValidMask(layout.owner, broken), /PART_OWNERSHIP/);
  const edited = composite([frames.final]);
  const pixel = edited.rgba.findIndex((a, i) => i % 4 === 3 && a === 255);
  edited.rgba[pixel - 1] ^= 1;
  assert.throws(() => protectLocal(frames.final, edited, makeRaster(64, 64), 0), /PROTECTED_PIXEL/);
  const tool = tools[0];
  if (tool.hand === 'both') assert.throws(() => verifySharedCarrier(tool.planes, tool.flat, { ...anchors, far: [3, 3] }, layout), /TWO_HAND_ANCHOR/);
  else assert.throws(() => validateHandGrip(layout, { ...tool, kind: tool.kind as ToolKind, hand: tool.hand as Hand, anchor: [3, 3] }), /GRIP_ANCHOR/);
  return ['landmark', 'owner mask', 'protected RGB', tool.hand === 'both' ? 'second anchor on shared prop' : 'grip anchor'];
}
