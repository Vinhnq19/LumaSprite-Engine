import assert from 'node:assert/strict';
import { z } from 'zod';
import { pack } from '../core/palette/colors.ts';
import { fillPolygon, type Point } from '../core/geometry/shapes.ts';
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
import { paintHandTool, planHandTool } from './character-equipment.ts';
import { inspectStructure } from './structure-quality/diagnostics.ts';

const pin = z.strictObject({ file: z.string().regex(/^benchmarks\/fixtures\/[a-z0-9-]+\/[a-z0-9-]+\.json$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const px = z.number().int().min(2).max(61), point = z.tuple([px, px]);
const delta = z.number().int().min(-12).max(12);
const limb = z.strictObject({ elbow: point, wrist: point, palm: point, knee: point, ankle: point });
const grips = z.array(z.strictObject({ hand: z.enum(['near', 'far']), kind: z.enum(['toolbox', 'wrench', 'hook']),
  axis: z.tuple([delta, delta]) })).min(1).max(2).refine(items => new Set(items.map(item => item.hand)).size === items.length);
const structure = z.strictObject({ id: z.enum(['a1', 'a2']), note: z.string().min(10).max(110), near: limb, far: limb, tools: grips });
export const characterPilotBrief = z.strictObject({
  version: z.literal(1), canvas: z.literal(64), view: z.literal('three-quarter-right'),
  id: z.string().regex(/^[a-z][a-z0-9-]{2,40}$/), name: z.string().min(4).max(65), actor: z.enum(['courier', 'surveyor']),
  role: z.enum(['development', 'holdout']), seed: z.number().int().min(0).max(0xffffffff),
  brief: z.string().min(20).max(220), profile: pin, style: pin, context: pin,
  spec: characterSpecSchema, poses: z.tuple([structure, structure]), cloak: z.boolean(),
});
export type CharacterPilotBrief = z.infer<typeof characterPilotBrief>;
type Body = ReturnType<typeof characterReview>;
type Theme = StyleProfile['illumination']['day'];
type Tool = ReturnType<typeof prepareEquipment>[number];
export const contourOwner = pack('#20202b');

function addCloak(body: Body) {
  const [x, y] = body.plan.landmarks.neck.point;
  const folds: Body['plan']['parts'][number]['shapes'] = [
    { ink: 'farCoat', polygon: [[x - 5, y], [x - 9, y + 4], [x - 14, y + 21], [x - 10, y + 22],
      [x - 8, y + 20], [x - 6, y + 23], [x + 1, y + 20], [x + 3, y + 5], [x + 2, y]] },
    { ink: 'jacket', polygon: [[x - 6, y + 3], [x - 7, y + 7], [x - 11, y + 19], [x - 8, y + 19],
      [x - 5, y + 18], [x - 1, y + 7], [x, y + 3]] },
  ];
  const cape = makeRaster(64, 64);
  for (const shape of folds) if ('polygon' in shape) fillPolygon(cape, shape.polygon, pack(characterColors[shape.ink]));
  const parts = body.plan.parts.flatMap(part => part.id === 'jacket' ? [{ id: 'cape', shapes: folds }, part] : [part]);
  const layers: Record<string, Raster> = { ...body.layers, cape };
  const ordered = parts.map(part => layers[part.id]);
  const { flat, silhouette } = renderOutlinedLayers(ordered, ordered, pack(characterColors.contour));
  const plan = { ...body.plan, parts };
  const native = { ...body, plan, layers, flat, silhouette };
  const diagnostics = checkCharacter(native);
  assert.deepEqual(diagnostics.errors, [], 'Cloak altered character structural constraints.');
  const flatBytes = encodePng(flat), silhouetteBytes = encodePng(silhouette);
  const meta = { ...body.metadata, bodyPlan: plan, diagnostics,
    images: { flatPngSha256: sha256(flatBytes), silhouettePngSha256: sha256(silhouetteBytes) } };
  const files = new Map([['flat.png', flatBytes], ['silhouette.png', silhouetteBytes],
    ['geometry.json', Buffer.from(JSON.stringify(meta, null, 2) + '\n')]]);
  return { ...native, metadata: meta, files };
}

function prepareEquipment(body: Body, tools: z.infer<typeof grips>, theme: Theme) {
  return tools.map(({ hand, kind, axis }) => {
    const anchor = body.plan.landmarks[hand + '-palm'].point;
    const planes = planHandTool(kind, anchor, axis);
    return { id: hand + '-tool', hand, kind, anchor, planes, flat: paintHandTool(planes, theme, anchor, true).raster };
  });
}

function arrange(body: Body, tools: Tool[]) {
  const order = body.plan.parts.flatMap(({ id }) => {
    const tool = tools.find(equipment => equipment.hand + '-hand' === id);
    return tool ? [tool.id, id] : [id];
  });
  const layers: Record<string, Raster> = { ...body.layers, ...Object.fromEntries(tools.map(tool => [tool.id, tool.flat])) };
  const palette = order.map((id, i) => [id, pack('#' + ((i * 104729 + 0x435662) & 0xffffff).toString(16).padStart(6, '0'))] as const);
  const labels = Object.fromEntries(palette);
  const raw = order.map(id => layers[id]);
  const { flat, silhouette: alpha } = renderOutlinedLayers(raw, raw, pack(characterColors.contour));
  const ownershipLayers = order.map(id => silhouette(layers[id], labels[id]));
  const { final: owner } = renderOutlinedLayers(ownershipLayers, ownershipLayers, contourOwner);
  return { order, layers, flat, silhouette: alpha, owner, labels };
}

type Layout = ReturnType<typeof arrange>;
const at = (r: Raster, point: Point) => r.rgba.readUInt32BE((point[1] * r.w + point[0]) * 4);
const opaque = (r: Raster, i: number) => r.rgba[i * 4 + 3] === 255;

export function validateHandGrip(layout: Layout, tool: Tool) {
  const palm = layout.layers[tool.hand + '-hand'];
  assert.ok(at(tool.flat, tool.anchor) && at(palm, tool.anchor), 'GRIP_ANCHOR: grip is outside hand or tool.');
  assert.equal(at(layout.owner, tool.anchor), layout.labels[tool.hand + '-hand'], 'GRIP_DEPTH: hand must occlude the shaft.');
  const toolPixels: number[] = [], torso: number[] = [], overlap: number[] = [];
  const masses = ['head', 'jacket', 'hips', 'satchel', 'cape', 'near-shin', 'far-shin']
    .flatMap(id => layout.layers[id] ? [layout.layers[id]] : []);
  for (let i = 0; i < 4096; i++) {
    if (masses.some(layer => opaque(layer, i))) torso.push(i);
    if (!opaque(tool.flat, i)) continue;
    toolPixels.push(i);
    if (opaque(palm, i)) overlap.push(i);
  }
  const exposed = toolPixels.filter(i => layout.owner.rgba.readUInt32BE(i * 4) === layout.labels[tool.id]).length;
  const distance = (a: number, b: number) => Math.abs(a % 64 - b % 64) + Math.abs(Math.floor(a / 64) - Math.floor(b / 64));
  const clearance = toolPixels.reduce((min, i) => torso.reduce((best, j) => Math.min(best, distance(i, j)), min), 128);
  assert.ok(overlap.length >= 2 && exposed >= toolPixels.length * .65, 'GRIP_VISIBILITY: lost contact or too little tool is visible.');
  assert.ok(clearance >= 3, 'TOOL_TORSO_CLEARANCE: enforce an open gap before painting.');
  const opening = tool.kind === 'toolbox' ? [3, 4].filter(dy => !at(layout.silhouette, [tool.anchor[0], tool.anchor[1] + dy])).length : null;
  assert.ok(opening === null || opening >= 1, 'HANDLE_OPENING: filled toolbox handle.');
  return { kind: tool.kind, hand: tool.hand, anchor: tool.anchor, overlap: overlap.length, exposed,
    toolPixels: toolPixels.length, clearance, opening, rgbaSha256: sha256(tool.flat.rgba) };
}

function verifiedBody(brief: CharacterPilotBrief, id: 'a0' | 'a1' | 'a2') {
  const load = brief.poses.find(pose => pose.id === id);
  const source = brief.spec;
  assert.equal(source.version, 3);
  assert.deepEqual([source.seed, source.view, source.canvas.w], [brief.seed, brief.view, brief.canvas]);
  assert.equal(source.palette.mode, 'authored');
  if (id !== 'a0') assert.ok(load);
  const base = characterReview(load ? { ...source, pose: { ...source.pose, near: load.near, far: load.far } } : source);
  if (!load || !brief.cloak) return base;
  const result = addCloak(base);
  return result;
}

export function overlayLandmarks(body: Body, layout: Layout, tools: Tool[]) {
  const overlay = composite([layout.flat]);
  const draw = (from: Point, to: Point, ink: number) => {
    const steps = Math.max(Math.abs(from[0] - to[0]), Math.abs(from[1] - to[1]), 1);
    for (let i = 0; i <= steps; i++) put(overlay, Math.round(from[0] + (to[0] - from[0]) * i / steps),
      Math.round(from[1] + (to[1] - from[1]) * i / steps), ink);
  };
  const { landmarks, links, pivot } = body.plan;
  for (const { from, to } of links) draw(landmarks[from].point, landmarks[to].point, pack('#c5adea'));
  for (const { point } of Object.values(landmarks)) put(overlay, ...point, pack('#fff1d2'));
  for (const { anchor } of tools) put(overlay, ...anchor, pack('#ffb254'));
  put(overlay, ...pivot, pack('#78e3cd'));
  return overlay;
}

export function lockValidMask(original: Raster, candidate: Raster) {
  assert.deepEqual([candidate.w, candidate.h], [original.w, original.h], 'PART_OWNERSHIP: mask dimensions.');
  assert.ok(original.rgba.equals(candidate.rgba), 'PART_OWNERSHIP: owner changed.');
}

export function protectLocal(before: Raster, after: Raster, editable: Raster, budget: number) {
  assert.ok(alphaPlane(before).equals(alphaPlane(after)), 'PROTECTED_ALPHA: local patch changed geometry.');
  const beforeProtected: Buffer[] = [], afterProtected: Buffer[] = [];
  let changed = 0;
  for (let i = 0; i < before.rgba.length; i += 4) {
    const difference = before.rgba.readUInt32BE(i) !== after.rgba.readUInt32BE(i);
    if (!editable.rgba[i + 3]) {
      assert.ok(!difference, 'PROTECTED_PIXEL: local patch escaped mask.');
      beforeProtected.push(before.rgba.subarray(i, i + 4));
      afterProtected.push(after.rgba.subarray(i, i + 4));
    }
    if (difference) changed++;
  }
  assert.ok(changed <= budget);
  return { changed, budget, protectedBefore: sha256(Buffer.concat(beforeProtected)), protectedAfter: sha256(Buffer.concat(afterProtected)) };
}

export function characterTrial(brief: CharacterPilotBrief, id: 'a0' | 'a1' | 'a2', profile: StyleProfile,
  direction: ArtDirectionSpec, checkpoint: string) {
  const { device, character } = crossAssetStyle(profile, direction);
  const body = verifiedBody(brief, id);
  const tools = prepareEquipment(body, brief.poses.find(pose => pose.id === id)?.tools ?? [], device);
  const layout = arrange(body, tools);
  const shape = inspectStructure(layout.flat);
  const lock = makeShapeLock(body, checkpoint, brief.id + '-' + id);
  const gate = { body: body.metadata.diagnostics, lock, combinedSha256: sha256(alphaPlane(layout.silhouette)),
    ownersSha256: sha256(layout.owner.rgba), toolGrips: [] as ReturnType<typeof validateHandGrip>[] };
  const frames = { flat: layout.flat, silhouette: shape.mask, owners: layout.owner, pose: overlayLandmarks(body, layout, tools) };
  try {
    assert.equal(shape.stat.components.length, 1);
    assert.ok(shape.stat.bounds!.left >= 1 && shape.stat.bounds!.right <= 62);
    gate.toolGrips = tools.map(tool => validateHandGrip(layout, tool));
  } catch (err) {
    return { pass: false as const, id, reason: err instanceof Error ? err.message : String(err), frames, gate };
  }
  // Both variants inherit the same body-material painter and palette guidance as the control.
  const ramps = { ...character!.ramps };
  if (body.spec.version === 3 && body.spec.outfit.cloth === 'russet-moss') {
    delete ramps.coat;
    delete ramps['far-coat'];
  }
  const paint = renderCharacterMaterials(body, lock, 'm2p', undefined, { ...character!, ramps });
  const equipment = Object.fromEntries(tools.map(tool => [tool.id, paintHandTool(tool.planes, device, tool.anchor, false)]));
  for (const tool of tools) assert.ok(alphaPlane(tool.flat).equals(alphaPlane(equipment[tool.id].raster)));
  const ordered = layout.order.map(id => equipment[id]?.raster ?? paint.layers[id]);
  const ownershipLayers = layout.order.map((id, i) => silhouette(ordered[i], layout.labels[id]));
  const finishedOwner = renderOutlinedLayers(ownershipLayers, ownershipLayers, contourOwner).final;
  lockValidMask(layout.owner, finishedOwner);
  const final = tools.length ? renderOutlinedLayers(ordered, ordered, pack(character!.outline)).final : paint.final;
  const material = makeRaster(64, 64);
  const toolMasks = Object.fromEntries(tools.map(tool => [tool.id, silhouette(tool.flat, pack('#ffffff'))]));
  for (let i = 0; i < final.rgba.length; i += 4) {
    const owner = finishedOwner.rgba.readUInt32BE(i);
    if (!owner) continue;
    const existing = paint.mask.rgba.readUInt32BE(i);
    if (owner === contourOwner) {
      material.rgba.writeUInt32BE(pack(materialMaskLegend.contour), i);
      if (existing === pack(materialMaskLegend.contour)) final.rgba.writeUInt32BE(paint.final.rgba.readUInt32BE(i), i);
      continue;
    }
    const selected = tools.find(tool => layout.labels[tool.id] === owner);
    const wood = selected && equipment[selected.id].material.rgba.readUInt32BE(i) === pack(materialLegend.wood);
    const ink = selected ? pack(wood ? materialMaskLegend.leather : materialMaskLegend.metal) : existing;
    assert.notEqual(ink, 0, 'Missing material ownership.');
    material.rgba.writeUInt32BE(ink, i);
  }
  assert.ok(alphaPlane(final).equals(alphaPlane(layout.silhouette)));
  assert.ok(alphaPlane(material).equals(alphaPlane(layout.silhouette)));
  const palette = new Set([...paint.usedColors, device.contour, ...device.surfaces.metal, ...device.surfaces.wood].map(pack));
  const stats = inspectStructure(final, palette, material).stat;
  const untouched = protectLocal(final, final, makeRaster(64, 64), 8);
  return { pass: true as const, id, body, layout, tools, gate, frames: { ...frames, material, final }, stats, toolMasks,
    local: { defectId: 'BODY_TOOL_TANGENCY', status: 'NO_MEANINGFUL_VISUAL_GAIN', scope: 'No RGB patch selected',
      firstAction: 'Keep validated structure because RGB cannot recover tool clearance or hand articulation.',
      humanEvaluation: 'PENDING_HUMAN_REVIEW', ...untouched } };
}

export function checkNegativeControls(candidate: Extract<ReturnType<typeof characterTrial>, { pass: true }>) {
  const { body, gate, layout, tools, frames } = candidate;
  const altered = { ...body, plan: { ...body.plan, landmarks: { ...body.plan.landmarks,
    'near-wrist': { ...body.plan.landmarks['near-wrist'], point: [3, 3] as Point } } } };
  assert.throws(() => requireShapeLock(altered, gate.lock), /shape lock mismatch/i);
  assert.ok(checkCharacter(altered).errors.some(error => error.includes('near-wrist')));
  assert.throws(() => validateHandGrip(layout, { ...tools[0], anchor: [3, 3] }), /GRIP_ANCHOR/);
  const damaged = composite([layout.owner]);
  damaged.rgba[3] = 255;
  assert.throws(() => lockValidMask(layout.owner, damaged), /PART_OWNERSHIP/);
  const changed = composite([frames.final]);
  const i = changed.rgba.findIndex((byte, index) => index % 4 === 3 && byte === 255);
  changed.rgba[i - 1] ^= 1;
  assert.throws(() => protectLocal(frames.final, changed, makeRaster(64, 64), 8), /PROTECTED_PIXEL/);
  return ['Invalid skeleton landmark', 'Detached grip anchor', 'Corrupted part mask', 'Outside-mask RGBA edit'];
}
