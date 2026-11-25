import { ellipseSpans } from '../../core/geometry/projection.ts';
import { rect } from '../../core/geometry/faces.ts';
import { type Point, type Span } from '../../core/geometry/shapes.ts';
import type { CharacterSpec } from '../../specs/character.ts';

export const characterColors = {
  contour: '#262334', jacket: '#437a76', farCoat: '#36535b', trousers: '#525768',
  farTrousers: '#424654', leather: '#8e624a', sole: '#51433d', face: '#e0af82',
  cap: '#4d5e5c', brim: '#39454c', iron: '#525869', lantern: '#edc17d',
} as const;
type Ink = keyof typeof characterColors;
type Shape = { ink: Ink } & ({ polygon: readonly Point[] } | { spans: Span[] });
type Part = { id: string; shapes: Shape[] };
type Landmark = { point: Point; partId: string };
type Link = { from: string; to: string };

const polygon = (ink: Ink, ...vertices: Point[]): Shape => ({ ink, polygon: vertices });
const box = (ink: Ink, x: number, y: number, right: number, bottom: number): Shape => ({ ink, polygon: rect(x, y, right, bottom) });
const oval = (ink: Ink, [x, y]: Point, w: number, h: number): Shape => ({ ink, spans: ellipseSpans([x + .5, y + .5], w, h) });
const shift = ([x, y]: Point, dx: number, dy: number): Point => [x + dx, y + dy];

function segment(ink: Ink, from: Point, to: Point, w0: number, w1: number): Shape[] {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  if (length < 2 || length > 20) throw new Error('Joint segment must be 2–20 pixels.');
  const flank = (p: Point, w: number) => [p[0] + .5 - dy * w / length / 2, p[1] + .5 + dx * w / length / 2] as const;
  return [
    polygon(ink, flank(from, w0), flank(to, w1), flank(to, -w1), flank(from, -w0)),
    oval(ink, from, w0, w0), oval(ink, to, w1, w1),
  ];
}

export function planCharacter(spec: CharacterSpec) {
  const { proportions: p, pose } = spec;
  const turn = spec.version === 1 ? 0 : spec.pose.turn;
  const outfit = spec.version === 3 ? spec.outfit : undefined;
  const revision = spec.version === 1 ? undefined : spec.geometryRevision;
  const opening = revision?.headOpening ?? 0;
  const torsoPlaneOffset = revision?.torsoPlaneOffset ?? 0;
  const [bagDx, bagDy] = spec.version === 3 ? spec.geometryRevision?.satchelOffset ?? [0, 0] : [0, 0];
  const [cx, hipY] = pose.hip;
  const [shoulderWidth, bodyHeight] = p.jacket;
  const sy = hipY - bodyHeight;
  const sx = cx + pose.lean;
  const neck: Point = [sx + 1, sy - 2];
  const [headW, headH] = p.head;
  const crown = shift(neck, 2, -Math.floor(headH / 2) + 1);
  const [headX, headY] = crown;
  const shoulderInset = Math.floor(shoulderWidth * .36);
  const hipInset = Math.floor(p.hips / 3);
  const shoulders = { near: [sx - shoulderInset - (turn ? 1 : 0), sy + (turn || 1)],
    far: [sx + shoulderInset - (turn ? 1 : 0), sy - Math.floor(turn / 2)] } as const;
  const hips = { near: [cx - hipInset, hipY + 1], far: [cx + hipInset, hipY - Math.floor(turn / 2)] } as const;
  const landmarks: Record<string, Landmark> = {
    crown: { point: crown, partId: 'head' }, neck: { point: neck, partId: 'neck' },
    chest: { point: [sx, sy + 3], partId: 'jacket' }, pelvis: { point: pose.hip, partId: 'hips' },
  };
  const links: Link[] = [{ from: 'crown', to: 'neck' }, { from: 'neck', to: 'chest' }, { from: 'chest', to: 'pelvis' }];
  const part = (id: string, ...shapes: Shape[]): Part => ({ id, shapes });
  const limbs = Object.fromEntries((['far', 'near'] as const).map(side => {
    const far = side === 'far';
    const limb = pose[side];
    const shoulder = shoulders[side], hip = hips[side], { elbow, wrist, palm, knee, ankle } = limb;
    const dims = far ? 1 : 0;
    const sleeve = far ? 'farCoat' : 'jacket';
    const pants = far ? 'farTrousers' : 'trousers';
    const [ax, ay] = ankle;
    const bootWidth = p.boot[0] - dims;
    const sole = ay + p.boot[1];
    const heel = ax - Math.floor(bootWidth * .33);
    const toe = heel + bootWidth;
    const pitch = pose.kind === 'forward-step-hold' && side !== pose.support ? Math.ceil(p.boot[1] / 2) : 0;
    for (const [joint, point, name] of [
      ['shoulder', shoulder, 'upper-arm'], ['elbow', elbow, 'forearm'], ['wrist', wrist, 'forearm'], ['palm', palm, 'hand'],
      ['hip', hip, 'thigh'], ['knee', knee, 'shin'], ['ankle', ankle, 'boot'],
      ['ground', [pitch ? heel + 1 : ax, sole - 1], 'boot'],
    ] as const) landmarks[side + '-' + joint] = { point, partId: side + '-' + name };
    for (const chain of [['chest', 'shoulder', 'elbow', 'wrist', 'palm'], ['pelvis', 'hip', 'knee', 'ankle', 'ground']]) {
      for (let i = 1; i < chain.length; i++) {
        links.push({ from: i === 1 ? chain[0] : side + '-' + chain[i - 1], to: side + '-' + chain[i] });
      }
    }
    return [side, {
      arm: [
        part(side + '-upper-arm', ...segment(sleeve, shoulder, elbow, p.arm[0] - dims, p.arm[1] + 1 - dims)),
        part(side + '-forearm', ...segment(sleeve, elbow, wrist, p.arm[1] + 1 - dims, p.arm[1] - dims)),
        part(side + '-hand', ...segment('face', wrist, palm, 4 - dims, 4 - dims)),
      ],
      leg: [
        part(side + '-thigh', ...segment(pants, hip, knee, p.leg[0] - dims, p.leg[1] + 1 - dims)),
        part(side + '-shin', ...segment(pants, knee, ankle, p.leg[1] + 1 - dims, p.leg[1] - dims)),
        part(side + '-boot', polygon('sole', [heel, ay - 2], [ax + 2, ay - 2], [ax + 3, ay],
          [toe - 1, ay + 1 - pitch], [toe, ay + 3 - pitch], [toe - 1, sole - pitch],
          ...(pitch ? [[ax, sole] as const] : []), [heel, sole])),
      ],
    }];
  })) as Record<'far' | 'near', { arm: Part[]; leg: Part[] }>;

  const [bagW, bagH] = p.satchel;
  const bagX = outfit?.satchel === 'crossbody' ? cx - Math.floor(bagW * .6) + bagDx : shoulders.near[0] - Math.floor(bagW * .68) + (turn ? 1 : 0);
  const bagY = outfit?.satchel === 'crossbody' ? hipY - 5 + bagDy : sy + (turn ? 5 : 3);
  const [gx, gy] = shift(pose.near.palm, turn ? 1 : 0, turn ? 1 : 0);
  const [inward, outward] = [-Math.floor(shoulderWidth / 2), Math.ceil(shoulderWidth / 2)];
  const waist = Math.ceil(p.hips / 2);
  const jaw = headY + Math.floor(headH / 2);
  const topOfCap = headY - Math.floor(headH / 2) - 2;
  const headLeft = headX - Math.floor(headW / 2), headRight = headLeft + headW;
  const trim = (spec.seed ^ (spec.seed >>> 7)) & 1;
  const jacket = polygon('jacket', [sx + inward + 2, sy + (turn ? 1 : 0)], [sx + outward - 2, sy - 1 - Math.floor(turn / 2)],
    [sx + outward, sy + 4], [cx + waist - 1, hipY - 2], [cx + waist + 1, hipY + 2 - (turn ? 1 : 0)],
    [cx - waist + 1, hipY + 3], [cx - waist - 1, hipY - 2], [sx + inward, sy + 5]);
  const jacketPlane = polygon('farCoat', [sx + 1 + torsoPlaneOffset, sy + 1], [sx + outward - 2, sy - 1 - Math.floor(turn / 2)],
    [sx + outward, sy + 4], [cx + waist - 1, hipY - 2], [cx + waist + 1, hipY + 1], [cx + 2 + torsoPlaneOffset, hipY + 2]);
  let held: Part[] = [];
  if (spec.version !== 3) {
    const [lampW, lampH] = spec.proportions.lantern;
    const left = gx - Math.floor(lampW / 2), top = gy + (turn ? 5 : 4), right = left + lampW, bottom = top + lampH;
    const handle = turn ? [
      box('iron', gx - 2, gy - 1, gx + 3, gy + 1),
      box('iron', gx - 2, gy, gx - 1, top + 2),
      box('iron', gx + 2, gy, gx + 3, top + 2),
    ] : [polygon('iron', [gx, gy - 1], [gx + 2, gy], [gx + 2, top + 1], [gx, top + 1])];
    landmarks['grip-anchor'] = { point: [gx, gy], partId: 'lantern' };
    links.push({ from: 'near-wrist', to: 'grip-anchor' });
    held = [part('lantern', ...handle,
      polygon('iron', [left + 2, top], [right - 2, top], [right, top + 3],
        [right - 1, bottom - 1], [right - 3, bottom], [left + 1, bottom], [left, top + 3]),
      box('lantern', left + 2, top + 3, right - 2, bottom - 2))];
  }
  const bag = part('satchel', polygon('leather', [bagX + 2, bagY], [bagX + bagW - 1, bagY + 1], [bagX + bagW, bagY + bagH - 3],
    [bagX + bagW - 3, bagY + bagH], [bagX + 1, bagY + bagH - 1], [bagX, bagY + 4]));
  if (spec.version === 3 && spec.geometryRevision?.satchelFlap) {
    const flap = bagX + Math.floor(bagW / 2);
    bag.shapes.push(polygon('contour', [bagX + 1, bagY + 3], [flap, bagY + 4], [bagX + bagW - 1, bagY + 2],
      [bagX + bagW - 1, bagY + 3], [flap, bagY + 6], [bagX + 1, bagY + 4]));
  }
  const strap = outfit?.satchel === 'crossbody'
    ? part('strap', ...segment('leather', [sx + 5, sy + 1], [bagX + 2, bagY + 4], 2, 2))
    : part('strap', ...segment('leather', [sx - 5, sy + 1], [cx + 4, hipY - 2], 2, 2));
  const headwear = outfit?.headwear === 'hood' ? part('hood', polygon('cap',
    [headLeft - 2, headY], [headLeft, topOfCap + 4], [headLeft + 4, topOfCap + 1], [headX + 1, topOfCap],
    [headRight - 3, topOfCap + 4], [headRight, headY - 2], [headRight - 2, headY + 1 - opening], [headX + 3, headY - 1 - opening],
    [headX - 2 - opening, headY + 1 - opening], [headLeft + 4 - opening, headY + 5], [headX - 1, jaw], [headX + 1, jaw + 4],
    [headLeft, jaw + 2], [headLeft - 2, headY + 5]),
    polygon('brim', [headLeft - 1, jaw - 1], [headX - 2, jaw - 1], [headX + 2, jaw + 1], [headX, jaw + 4], [headLeft + 2, jaw + 4]))
    : part('cap', polygon('cap', [headLeft - 1, headY - 1], [headLeft, topOfCap + 5],
      [headLeft + 3, topOfCap + 1 + trim], [headLeft + 7, topOfCap], [headRight - 4, topOfCap + 1],
      [headRight - 1, topOfCap + 4], [headRight, headY - 2]),
    polygon('brim', [headLeft, headY - 2], [headRight - 1, headY - 3], [headRight + 4 - opening, headY - 1],
      [headRight + 2 - opening, headY + 1 - opening], [headLeft + 3, headY + 1]));
  const parts = [
    ...limbs.far.leg, ...limbs.far.arm, ...limbs.near.leg,
    ...(outfit ? [] : [bag]),
    part('hips', oval('trousers', pose.hip, p.hips + 2, 7)),
    part('jacket', jacket, ...(turn ? [jacketPlane] : [])),
    strap, ...(outfit ? [bag] : []),
    part('neck', oval('face', neck, 6, 8)),
    part('head', polygon('face', [headLeft + 1, headY - 3], [headX + 5, headY - 4],
      [headRight - 2, headY - 2], [headRight, headY + 1 + Math.floor(opening / 2)], [headRight - 1, headY + 3],
      [headRight - 2, jaw - 1], [headX + 1 + Math.floor(opening / 2), jaw + 1],
      [headLeft + 3 - opening, jaw - 1], [headLeft, headY + 2 + opening])),
    headwear,
    ...limbs.near.arm.slice(0, 2),
    ...held,
    turn && held.length ? part('near-hand', ...limbs.near.arm[2].shapes,
      oval('face', shift(pose.near.palm, 1, -1), 3, 3)) : limbs.near.arm[2],
  ];

  return { parts, landmarks, links, pivot: pose.pivot, support: pose.support, facing: spec.view,
    ...(spec.version !== 1 ? { poseIntent: spec.pose.kind, projectedGround: {
      near: pose.pivot[1] + (pose.support === 'near' ? 0 : spec.pose.secondaryGroundOffset),
      far: pose.pivot[1] + (pose.support === 'far' ? 0 : spec.pose.secondaryGroundOffset),
    } } : {}),
  };
}
