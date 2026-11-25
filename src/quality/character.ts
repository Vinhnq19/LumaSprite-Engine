import { pack } from '../core/palette/colors.ts';
import type { Point } from '../core/geometry/shapes.ts';
import type { Raster } from '../core/pixels/raster.ts';
import type { CharacterRender } from '../generators/character/render.ts';

const visible = (raster: Raster, x: number, y: number) =>
  x >= 0 && x < raster.w && y >= 0 && y < raster.h && raster.rgba[(y * raster.w + x) * 4 + 3] === 255;
const at = (raster: Raster, p: Point) => raster.rgba.readUInt32BE((p[1] * raster.w + p[0]) * 4);
const overlap = (a: Raster, b: Raster) =>
  a.rgba.reduce((count, opacity, offset) => count + Number(offset % 4 === 3 && opacity === 255 && b.rgba[offset] === 255), 0);

function shapeStats(raster: Raster) {
  const { w, h } = raster;
  const pixels = new Set<number>();
  let left = w, right = -1, top = h, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!visible(raster, x, y)) continue;
    pixels.add(y * w + x);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  const area = pixels.size;
  let components = 0;
  while (pixels.size) {
    const start = pixels.values().next().value!;
    const queue = [start];
    pixels.delete(start);
    components++;
    for (const i of queue) {
      for (const j of [i - w, i + w, i % w ? i - 1 : -1, i % w === w - 1 ? -1 : i + 1]) {
        if (pixels.delete(j)) queue.push(j);
      }
    }
  }
  return { left, right, top, bottom, area, components };
}

export function checkCharacter({ spec, plan, layers, flat, silhouette, palette }: CharacterRender) {
  const errors = new Set<string>();
  const inks = new Set(palette.map(pack));
  const parts = Object.fromEntries(Object.entries(layers).map(([id, raster]) => [id, shapeStats(raster)]));
  const bounds = shapeStats(silhouette);
  const w = spec.canvas.w, h = spec.canvas.h;
  const order = plan.parts.map(({ id }) => id);
  const depth = new Map(order.map((id, i) => [id, i]));
  const outfit = spec.version === 3;
  const accessoryDepth = outfit ? [['jacket', 'strap'], ['strap', 'satchel'], ['head', 'hood']]
    : [['satchel', 'jacket'], ['near-forearm', 'lantern'], ['lantern', 'near-hand'], ['head', 'cap']];
  for (const [back, front] of [['far-hand', 'jacket'], ['jacket', 'near-forearm'], ...accessoryDepth]) {
    if (!depth.has(back) || !depth.has(front) || depth.get(back)! >= depth.get(front)!) errors.add('PART_DEPTH');
  }
  for (let offset = 0; offset < flat.rgba.length; offset += 4) {
    const pixel = flat.rgba.readUInt32BE(offset), alpha = pixel & 255;
    if (alpha !== 0 && alpha !== 255 || alpha === 0 && pixel !== 0) errors.add('ALPHA');
    if (alpha === 255 && !inks.has(pixel)) errors.add('PALETTE');
    if (alpha !== silhouette.rgba[offset + 3]) errors.add('SILHOUETTE_ALPHA');
    const foreground = order.findLast(id => layers[id].rgba[offset + 3] === 255);
    if (foreground && layers[foreground].rgba.readUInt32BE(offset) !== pixel) errors.add('RASTER_DEPTH');
  }
  if (bounds.left < 1 || bounds.top < 1 || bounds.right > w - 2 || bounds.bottom > h - 2) errors.add('CANVAS_MARGIN');
  if (bounds.components !== 1) errors.add('CONNECTED_SILHOUETTE');
  for (const [id, { components }] of Object.entries(parts)) if (components !== 1) errors.add('COMPONENTS/' + id);

  const attachments = [
    ['head', 'neck'], [outfit ? 'hood' : 'cap', 'head'], ['neck', 'jacket'], ['hips', 'jacket'], ['satchel', 'jacket'], ['strap', 'jacket'],
    ...(outfit ? [['strap', 'satchel']] : []),
  ];
  const joints: Record<string, number> = {};
  for (const side of ['near', 'far'] as const) {
    const limb = spec.pose[side];
    const point = (joint: string) => plan.landmarks[side + '-' + joint].point;
    const [, shoulderY] = point('shoulder'), [, hipY] = point('hip');
    const [kx, ky] = limb.knee, [ax, ay] = limb.ankle;
    if (limb.elbow[1] - shoulderY < 3 || ky - hipY < 4 || ay - ky < 4 || Math.abs(kx - ax) > 6) {
      errors.add('POSE_CHAIN/' + side);
    }
    for (const [joint, a, b] of [
      ['shoulder', 'jacket', side + '-upper-arm'], ['elbow', side + '-upper-arm', side + '-forearm'],
      ['wrist', side + '-forearm', side + '-hand'], ['hip', 'hips', side + '-thigh'],
      ['knee', side + '-thigh', side + '-shin'], ['ankle', side + '-shin', side + '-boot'],
    ]) {
      const xy = point(joint);
      joints[side + '-' + joint] = overlap(layers[a], layers[b]);
      if (!visible(layers[a], ...xy) || !visible(layers[b], ...xy) || !joints[side + '-' + joint]) {
        errors.add('JOINT/' + side + '-' + joint);
      }
    }
  }
  for (const [a, b] of attachments) if (!overlap(layers[a], layers[b])) errors.add('ATTACHMENT/' + a + '-' + b);
  for (const [name, { point, partId }] of Object.entries(plan.landmarks)) {
    if (!visible(layers[partId], ...point)) errors.add('LANDMARK/' + name);
  }

  const support = parts[spec.pose.support + '-boot'];
  const lifted = parts[(spec.pose.support === 'near' ? 'far' : 'near') + '-boot'];
  const [px, py] = plan.pivot;
  for (let at = 0; at < flat.rgba.length; at += 4) {
    if (flat.rgba[at + 3] && Math.floor(at / 4 / w) >= Math.max(py, plan.projectedGround?.near ?? py, plan.projectedGround?.far ?? py)) {
      errors.add('BELOW_GROUND');
    }
  }
  if (support.bottom + 2 !== py || (spec.version === 1 && lifted.bottom >= support.bottom) || !visible(flat, px, py - 1) ||
      !visible(layers[spec.pose.support + '-boot'], px, py - 2)) errors.add('GROUND_CONTACT');
  let torsoMass = 0, torsoSum = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (['head', 'jacket', 'hips'].some(id => visible(layers[id], x, y))) {
      torsoMass++;
      torsoSum += x;
    }
  }
  const centerX = torsoSum / torsoMass;
  if (spec.version === 1 && (centerX < support.left || centerX > support.right)) errors.add('BALANCE');

  let legGapRows = 0;
  const leg = (side: string, x: number, y: number) =>
    ['shin', 'boot'].some(name => visible(layers[side + '-' + name], x, y));
  let maxGap = 0;
  for (let y = Math.max(spec.pose.near.knee[1], spec.pose.far.knee[1]) + 2; y <= Math.min(lifted.bottom, support.bottom); y++) {
    const xs = Array.from({ length: w }, (_, x) => x);
    const near = xs.findLast(x => leg('near', x, y)), far = xs.find(x => leg('far', x, y));
    if (near === undefined || far === undefined) continue;
    const gap = xs.filter(x => x > near && x < far && !visible(silhouette, x, y)).length;
    if (gap >= 2) legGapRows++;
    maxGap = Math.max(maxGap, gap);
  }
  if (legGapRows < 2) errors.add('LEG_GAP');

  let gripPixels = 0, lampGapRows = 0;
  if (!outfit) {
    const [gx, gy] = plan.landmarks['grip-anchor'].point;
    const grip = layers['near-hand'], lamp = layers.lantern;
    gripPixels = overlap(grip, lamp);
    if (!visible(grip, gx, gy) || !visible(lamp, gx, gy) || gripPixels < 2) errors.add('GRIP_CONTACT');
    if (plan.parts.at(-1)?.id !== 'near-hand' || at(flat, [gx, gy]) !== at(grip, [gx, gy])) errors.add('GRIP_DEPTH');
    for (let y = gy + 3; y <= parts.lantern.bottom; y++) {
      let firstLamp = -1;
      for (let x = 0; x < w; x++) {
        if (!visible(lamp, x, y)) continue;
        if (firstLamp < 0) firstLamp = x;
        if (Object.entries(layers).some(([id, layer]) => id !== 'lantern' && visible(layer, x, y))) errors.add('PROP_INTERSECTION');
      }
      if (firstLamp > 2 && !visible(silhouette, firstLamp - 2, y)) lampGapRows++;
    }
    if (lampGapRows < 2) errors.add('PROP_CLEARANCE');
  }
  const poseErrors = new Set(['BELOW_GROUND', 'GROUND_CONTACT', 'LEG_GAP', 'PROP_CLEARANCE', 'POSE_CHAIN/near', 'POSE_CHAIN/far']);
  const pose = spec.version !== 1 ? checkRefinedPose(spec, plan, layers, flat, bounds, parts, centerX) : undefined;
  const structure = [...errors].every(code => poseErrors.has(code));
  const constraints = pose && !pose.errors.length && [...errors].every(code => !poseErrors.has(code));
  return {
    errors: [...errors, ...(pose?.errors ?? [])], bounds, parts, joints, centerX, plantedFoot: spec.pose.support, legGapRows, maxGap, gripPixels, lampGapRows,
    ...(pose ? {
      structure: structure ? 'STRUCTURAL_VALID' : 'STRUCTURAL_INVALID',
      constraints: constraints ? 'POSE_CONSTRAINTS_VALID' : 'POSE_CONSTRAINTS_INVALID',
      visual: 'VISUAL_REVIEW_PENDING', pose,
    } : {}),
  };
}

function checkRefinedPose(
  spec: Exclude<CharacterRender['spec'], { version: 1 }>, plan: CharacterRender['plan'], layers: CharacterRender['layers'],
  flat: Raster, bounds: ReturnType<typeof shapeStats>, parts: Record<string, ReturnType<typeof shapeStats>>, centerX: number,
) {
  const { pose, proportions } = spec;
  const errors: string[] = [];
  const support = pose.support;
  const secondary = support === 'near' ? 'far' : 'near';
  const stepping = pose.kind === 'forward-step-hold';
  const headroom = bounds.top;
  const xs = Array.from({ length: flat.w }, (_, x) => x);
  const minContact = Math.floor(proportions.boot[0] / 3);
  const feet = Object.fromEntries((['near', 'far'] as const).map(side => {
    const id = side + '-boot';
    const mask = layers[id], bottom = parts[id].bottom;
    const depth = plan.projectedGround![side];
    const contact = xs.filter(x => visible(mask, x, bottom) && visible(flat, x, bottom + 1));
    const [ax] = pose[side].ankle;
    const toe = Math.max(...xs.flatMap(x => x > ax + 2 ? Array.from({ length: mask.h }, (_, y) => y).filter(y => visible(mask, x, y)) : []));
    return [side, {
      projectedGroundY: depth, lowestContourY: bottom + 1, clearance: depth - bottom - 2,
      solePixels: contact.length, soleBand: [contact[0], contact.at(-1)!], toeRise: bottom - toe,
    }];
  }));
  const planted = feet[support], other = feet[secondary];
  if (headroom < Math.max(2, Math.ceil(proportions.head[1] / 5))) errors.push('HEADROOM');
  if (planted.clearance !== 0 || planted.solePixels < minContact || planted.toeRise > 1) errors.push('PLANTED_SOLE');
  if (stepping) {
    if (other.clearance < 1 || other.clearance > proportions.boot[1] || other.toeRise < 1) errors.push('STEP_FOOT_CLEARANCE');
    const stride = pose[secondary].ankle[0] - pose[support].ankle[0];
    if (stride < proportions.hips || pose.lean < 1 || centerX <= pose[support].ankle[0] || centerX >= pose[secondary].ankle[0]) {
      errors.push('STEP_WEIGHT_TRANSFER');
    }
  } else {
    if (other.clearance !== 0 || other.solePixels < minContact || other.toeRise > 1) errors.push('SECONDARY_SOLE');
    if (centerX < planted.soleBand[0] || centerX > planted.soleBand[1]) errors.push('STANDING_BALANCE');
  }
  if (overlap(layers['near-boot'], layers['far-boot'])) errors.push('BOOT_OVERLAP');

  const joint = (name: string) => plan.landmarks[name].point;
  const shoulderDrop = joint('near-shoulder')[1] - joint('far-shoulder')[1];
  const hipDrop = joint('near-hip')[1] - joint('far-hip')[1];
  if (shoulderDrop < 1 || hipDrop < 1 || Math.abs(joint('chest')[0] - pose.hip[0]) > proportions.jacket[0] / 3) {
    errors.push('TORSO_ALIGNMENT');
  }
  const kneeBends: Record<string, number> = {};
  for (const side of ['near', 'far'] as const) {
    const [hx, hy] = joint(side + '-hip');
    const { knee: [kx, ky], ankle: [ax, ay] } = pose[side];
    const bend = kx - (hx + (ax - hx) * (ky - hy) / (ay - hy));
    kneeBends[side] = bend;
    if (bend < -1 || bend > proportions.leg[0] * .75) errors.push('KNEE_DIRECTION/' + side);
  }
  if (spec.version === 3) {
    return { errors, intent: pose.kind, headroom, feet, shoulderDrop, hipDrop, kneeBends, openHandleRows: 0, armTorsoGapRows: 0, lampBodyGap: 0 };
  }
  const { elbow: [ex, ey], wrist: [wx, wy], palm: [mx, my] } = pose.near;
  if (ex < joint('near-shoulder')[0] || wx <= ex || (wx - ex) * (mx - wx) + (wy - ey) * (my - wy) <= 0) {
    errors.push('HOLDING_ARM_DIRECTION');
  }
  const [gx, gy] = joint('grip-anchor');
  let openHandleRows = 0, armTorsoGapRows = 0;
  for (let y = gy + 2; y < gy + 5; y++) {
    if (visible(layers.lantern, gx - 2, y) && visible(layers.lantern, gx + 2, y) && !visible(flat, gx, y)) openHandleRows++;
  }
  for (let y = Math.max(ey + 2, gy + 2); y <= parts.jacket.bottom; y++) {
    const torsoRight = xs.findLast(x => visible(layers.jacket, x, y) || visible(layers['far-hand'], x, y));
    const lampLeft = xs.find(x => visible(layers.lantern, x, y));
    if (torsoRight !== undefined && lampLeft !== undefined && xs.some(x => x > torsoRight && x < lampLeft && !visible(flat, x, y))) {
      armTorsoGapRows++;
    }
  }
  const actorLayers = Object.entries(layers).filter(([id]) => id !== 'lantern').map(([, layer]) => layer);
  const actor = [], lampBody = [];
  for (let y = bounds.top; y <= bounds.bottom; y++) for (let x = bounds.left; x <= bounds.right; x++) {
    if (actorLayers.some(layer => visible(layer, x, y))) actor.push([x, y]);
    if (y >= gy + 5 && visible(layers.lantern, x, y)) lampBody.push([x, y]);
  }
  let lampBodyGap = flat.w + flat.h;
  for (const [x, y] of lampBody) for (const [ax, ay] of actor) {
    lampBodyGap = Math.min(lampBodyGap, Math.abs(x - ax) + Math.abs(y - ay));
  }
  if (!openHandleRows) errors.push('HANDLE_OPENING');
  // A one-pixel contour on each region still leaves a transparent pixel between them.
  if (!lampBody.length || lampBodyGap < 4) errors.push('LAMP_BODY_CLEARANCE');
  if (armTorsoGapRows < Math.ceil(proportions.arm[1] / 2)) errors.push('ARM_TORSO_CLEARANCE');
  return { errors, intent: pose.kind, headroom, feet, shoulderDrop, hipDrop, kneeBends, openHandleRows, armTorsoGapRows, lampBodyGap };
}
