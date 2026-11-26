import assert from 'node:assert/strict';
import { verifyCharacterProductionPackage } from '../../../src/generators/character/production.ts';
import { makeShapeLock } from '../../../src/generators/character/shape-lock.ts';
import { characterReview } from '../../../src/generators/character/export.ts';
import { characterMaterialReview } from '../../../src/generators/character/material-export.ts';
import { pack, chestColors } from '../../../src/core/palette/colors.ts';
import type { Point } from '../../../src/core/geometry/shapes.ts';
import { makeRaster, nearestNeighbor, put, silhouette } from '../../../src/core/pixels/raster.ts';
import { compareTime, inspect, json, placed, png, round, scenes, visible } from './common.ts';

type Vec = readonly [number, number, number];
type Face = { part: string; role: string; axis: 'front' | 'side' | 'top' | 'bevel' | 'back'; corners: readonly Vec[]; tone?: number };
type Tier = readonly [x: number, y: number, z: number, width: number, depth: number, bevel: number];
const pivot: Point = [30, 59];
const source = await verifyCharacterProductionPackage('benchmarks/results/e44/packages/r2');
const ramps = source.material.diagnostics.ramps;
const projectRole = (name: string) => ramps[name as keyof typeof ramps];
const legal = [chestColors.contour, ...Object.values(ramps).flat()];
const yaw = 43, pitch = 18;
const normalLight = [-0.54, 0.78, 0.3];
const faces: Face[] = [];

function add(part: string, role: string, axis: Face['axis'], corners: readonly Vec[], tone?: number) {
  faces.push({ part, role, axis, corners, ...(tone === undefined ? {} : { tone }) });
}

function solid(part: string, role: string, tiers: readonly Tier[]) {
  const rings = tiers.map(([x, y, z, w, d, b]) => {
    const l = x - w / 2, r = x + w / 2, n = z - d / 2, f = z + d / 2;
    return [[l + b, y, f], [r - b, y, f], [r, y, f - b], [r, y, n + b],
      [r - b, y, n], [l + b, y, n], [l, y, n + b], [l, y, f - b]] as Vec[];
  });
  for (let k = 0; k < rings.length - 1; k++) {
    const lo = rings[k], hi = rings[k + 1];
    const labels = ['front', 'bevel', 'side', 'bevel', 'back', 'bevel', 'side', 'bevel'] as const;
    for (let i = 0; i < 8; i++) add(part, role, labels[i], [lo[i], lo[(i + 1) % 8], hi[(i + 1) % 8], hi[i]]);
  }
  add(part, role, 'top', rings.at(-1)!);
  add(part, role, 'back', [...rings[0]].reverse());
}

function box(part: string, role: string, x: number, y: number, z: number, w: number, h: number, d: number, b = 0.65) {
  solid(part, role, [[x, y, z, w, d, b], [x, y + h, z, w, d, b]]);
}

function decal(part: string, role: string, x: number, y: number, z: number, w: number, h: number, tone: number) {
  add(part, role, 'front', [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]], tone);
}

// Original Surveyor-inspired coordinates, in pixel units. Highest Y is the crown.
box('far-boot', 'leather', 7.4, 0.7, 3.5, 6.3, 3.6, 10.7, 1.25);
box('near-boot', 'leather', -4, 0, 7, 7.5, 4.5, 11.4, 1.5);
solid('far-leg', 'far-trousers', [[7.4, 4, 1.6, 5.4, 5.1, 0.8], [6.2, 10, 2.0, 5.6, 6.2, 1.2], [3.8, 19, 1.6, 6.4, 7, 1.4]]);
solid('near-leg', 'trousers', [[-4, 4, 5, 5.6, 5.4, 1], [-4.3, 11, 4.3, 6.4, 6.5, 1.2], [-3.8, 19, 0, 7, 7.3, 1.4]]);
solid('hips', 'trousers', [[0, 17, 0.5, 13, 7.5, 1.5], [0, 23, 0, 14, 8, 1.5]]);
solid('jacket', 'coat', [[0, 21, 0, 13, 9, 1.5], [0, 27, 0.3, 14, 10, 2], [0, 36, 0.8, 16, 9, 2.4], [0, 38, 1, 12, 7.5, 2]]);
box('collar', 'coat', 0, 36.6, 1, 9.6, 3.2, 9.4, 1.1);
box('neck', 'skin', 0.3, 37, 1, 6.4, 5.4, 6, 0.9);
solid('head', 'skin', [[0.5, 40, 2.2, 8.3, 7.2, 1.1], [0, 42.6, 1.5, 12, 9.8, 1.8],
  [0, 50, 0.6, 12, 11.0, 2], [0, 51.8, 0.2, 9, 9.4, 1.6]]);
box('hair', 'hair', -4.85, 44.5, -1.9, 2.75, 6.3, 7.2, 0.64);
box('ear', 'skin', -5.9, 43.9, 2.3, 2.3, 3.6, 2.9, 0.52);
box('nose', 'skin', 0.7, 44.4, 6.5, 2.35, 2.5, 1.7, 0.45);
decal('eyes', 'ink', -3.2, 46.2, 6.42, 2.1, 1.4, 0);
decal('eyes', 'ink', 2.6, 46.2, 6.42, 1.65, 1.4, 0);
decal('mouth', 'skin', -0.7, 42.5, 6.40, 2.4, 0.9, 0);
solid('cap', 'cap', [[0, 49.2, 0.4, 14, 12.2, 2], [0, 52.8, -0.4, 13.4, 11.8, 2.7],
  [-0.3, 55, -1, 9, 8.4, 2], [-0.6, 55.8, -1.3, 5.9, 5.9, 1.4]]);
box('brim', 'brim', 0.8, 49.2, 6.2, 12.3, 1.6, 7.6, 1.6);
solid('far-sleeve', 'far-coat', [[8.5, 23, 2.2, 4.5, 5.2, 0.8], [7.7, 29, 1.0, 5.8, 6, 1.3],
  [6.8, 35.8, 1, 6.0, 6, 1.1]]);
box('far-hand', 'skin', 8.3, 20.5, 2.6, 3.4, 3.9, 3.8, 0.6);
box('satchel', 'leather', -7.5, 18.6, -1.8, 5.4, 9.4, 6.8, 1);
box('satchel-flap', 'leather', -8.3, 25, -1.45, 5.0, 2.3, 7.1, 1);
add('strap', 'leather', 'front', [[-6.2, 22, 4.8], [-4.6, 22, 4.8], [5.9, 37.2, 5.9], [4.3, 37.2, 5.9]], 1);
add('strap', 'leather', 'front', [[-6.2, 22, 4.81], [-5.6, 22, 4.81], [4.9, 37.2, 5.91], [4.3, 37.2, 5.91]], 2);
solid('near-sleeve', 'coat', [[-8.5, 26.7, 2.5, 5.2, 5.3, 1], [-7.5, 32.0, 1.2, 6.6, 7, 1.6],
  [-6.35, 37.2, 1, 6.9, 6.5, 1.7]]);
solid('forearm', 'coat', [[-8.7, 26.6, 3.5, 5.1, 5.9, 1], [-8.4, 28.3, 8.2, 4.8, 10.8, 1.4],
  [-8.1, 31.3, 11, 4.6, 7.7, 1.2]]);
box('cuff', 'far-coat', -8.05, 27.7, 14.5, 4.6, 3.9, 2.1, 0.68);
box('hand', 'skin', -7.7, 28.2, 16.6, 4.5, 4, 4.6, 0.8);
box('handle', 'metal', -8.0, 25.2, 18.8, 1.05, 4.1, 1.4, 0.28);
box('handle', 'metal', -4.6, 25.2, 18.8, 1.05, 4.1, 1.4, 0.28);
box('handle', 'metal', -6.3, 28.2, 18.8, 4.4, 1.0, 1.4, 0.3);
box('lantern', 'metal', -6.3, 17.7, 18.8, 6.9, 2.2, 6.3, 1.2);
box('glass', 'glass', -6.3, 19.2, 18.8, 4.4, 5.8, 5.0, 0.85);
box('lantern', 'metal', -6.3, 24.2, 18.8, 6.3, 2.1, 6.0, 1);
box('lantern', 'metal', -8.64, 19.1, 20.43, 0.88, 5.4, 1.8, 0.23);
box('lantern', 'metal', -4.13, 19.1, 20.43, 0.90, 5.4, 1.8, 0.23);
decal('glass', 'glass', -7.4, 20.5, 21.35, 1.5, 2.7, 2);

function render() {
  const radians = (n: number) => n * Math.PI / 180;
  const c = Math.cos(radians(yaw)), s = Math.sin(radians(yaw));
  const a = Math.cos(radians(pitch)), b = Math.sin(radians(pitch));
  // Camera basis follows SpriteKiln's orthographic projection concept. Rasterizer is original.
  const project = ([x, y, z]: Vec): Vec => {
    const near = z * c - x * s;
    return [x * c + z * s + 29, 54.1 - y * a * 0.88 + near * b, y * b + near * a];
  };
  const depth = new Float64Array(64 * 64).fill(-Infinity);
  const owners = new Int16Array(64 * 64).fill(-1);
  const raster = makeRaster(64, 64);
  const edge = (p: Vec, q: Vec, x: number, y: number) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  const subtract = (p: Vec, q: Vec): Vec => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const colors = faces.map(face => {
    if (face.role === 'ink') return pack(chestColors.contour);
    const u = subtract(face.corners[1], face.corners[0]), v = subtract(face.corners[2], face.corners[0]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const left = n[0] * c + n[2] * s;
    const front = n[2] * c - n[0] * s;
    const light = (left * normalLight[0] + n[1] * normalLight[1] + front * normalLight[2]) / Math.hypot(...n);
    let index = face.tone ?? (face.axis === 'top' ? 2 : light > 0.63 ? 2 : light > 0.12 ? 1 : 0);
    if (face.role === 'glass') index = Math.max(1, index);
    const role = projectRole(face.role);
    assert.ok(role, face.role);
    return pack(role[Math.min(index, role.length - 1)]);
  });
  faces.forEach(({ corners }, id) => {
    const points = corners.map(project);
    for (let i = 1; i < points.length - 1; i++) {
      const [p, q, r] = [points[0], points[i], points[i + 1]];
      const area = edge(p, q, r[0], r[1]);
      if (Math.abs(area) < 1e-6) continue;
      for (let y = Math.max(0, Math.floor(Math.min(p[1], q[1], r[1]))); y < Math.min(64, Math.ceil(Math.max(p[1], q[1], r[1]))); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(p[0], q[0], r[0]))); x < Math.min(64, Math.ceil(Math.max(p[0], q[0], r[0]))); x++) {
          const u = edge(q, r, x + 0.5, y + 0.5) / area;
          const v = edge(r, p, x + 0.5, y + 0.5) / area;
          const w = 1 - u - v;
          if (Math.min(u, v, w) < -1e-7) continue;
          const z = u * p[2] + v * q[2] + w * r[2];
          if (z > depth[y * 64 + x]) {
            depth[y * 64 + x] = z;
            owners[y * 64 + x] = id;
          }
        }
      }
    }
  });
  const adjacent = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
  const idAt = (x: number, y: number) => x < 0 || x >= 64 || y < 0 || y >= 64 ? -1 : owners[y * 64 + x];
  const getPart = (x: number, y: number) => faces[idAt(x, y)]?.part;
  const partPixels: Record<string, number> = {};
  const planes: Record<string, Record<string, number>> = {};
  const planeMap = makeRaster(64, 64);
  const mask = makeRaster(64, 64);
  const planeInk = { front: '#f1c478', side: '#7ac1c2', top: '#b9d887', bevel: '#7492b5', back: '#5d576b' };
  let handHandleEdges = 0;
  let soleY = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const id = idAt(x, y);
    if (id < 0) {
      if (adjacent.some(([dx, dy]) => getPart(x + dx, y + dy))) put(raster, x, y, pack(chestColors.contour));
      continue;
    }
    const { part, axis, role } = faces[id];
    partPixels[part] = (partPixels[part] ?? 0) + 1;
    const buckets = planes[part] ?? (planes[part] = {});
    buckets[axis] = (buckets[axis] ?? 0) + 1;
    const draw = colors[id];
    put(raster, x, y, draw);
    put(planeMap, x, y, pack(planeInk[axis]));
    put(mask, x, y, role === 'ink' ? pack(chestColors.contour) : pack(projectRole(role)[1]));
    if (part.endsWith('-boot')) soleY = Math.max(soleY, y);
    if (part === 'hand') handHandleEdges += adjacent.filter(([dx, dy]) => getPart(x + dx, y + dy) === 'handle').length;
  }
  const points = { crown: [0, 55.8, -1], nearShoulder: [-6.35, 36.4, 1], farShoulder: [6.8, 35.8, 1],
    nearHip: [-3.8, 19, 0], farHip: [3.8, 19, 1.6], pelvis: [0, 20, 0.8],
    nearElbow: [-8.7, 27.8, 3.5], nearWrist: [-8.05, 29.6, 14.5], nearPalm: [-7.7, 30.2, 16.6],
    farElbow: [7.7, 29, 1], farWrist: [8.5, 23, 2.2], farPalm: [8.3, 22.3, 2.6],
    nearKnee: [-4.3, 11, 4.3], farKnee: [6.2, 10, 2], nearAnkle: [-4, 4, 5], farAnkle: [7.4, 4, 1.6] } satisfies Record<string, Vec>;
  const landmarks = Object.fromEntries(Object.entries(points).map(([id, point]) => [id, project(point).slice(0, 2).map(round)]));
  return { raster, planeMap, mask, partPixels, planes, handHandleEdges, soleY, landmarks };
}

const model = render();
assert.deepEqual(render().raster, model.raster);
for (const part of ['cap', 'head', 'jacket', 'near-sleeve', 'far-sleeve', 'near-leg', 'far-leg', 'satchel', 'hand', 'handle', 'glass']) {
  assert.ok(model.partPixels[part] > 0, part);
}
for (const part of ['head', 'jacket', 'hips']) {
  assert.ok(model.planes[part].front > 0 && model.planes[part].side > 0, part + ' needs both planes');
}
assert.ok(model.handHandleEdges > 0, 'Hand and handle do not touch at 1×');
const before = source.material.final;
const after = model.raster;
const input = source.geometry.spec;
assert.equal(input.version, 2);
const point = (id: string) => model.landmarks[id].map(Math.round);
const projectedPose = {
  ...input.pose, hip: point('pelvis'),
  near: { elbow: point('nearElbow'), wrist: point('nearWrist'), palm: point('nearPalm'), knee: point('nearKnee'), ankle: point('nearAnkle') },
  far: { elbow: point('farElbow'), wrist: point('farWrist'), palm: point('farPalm'), knee: point('farKnee'), ankle: point('farAnkle') },
};
let mapping: Record<string, unknown>;
try {
  const geometry = characterReview({ ...input, pose: projectedPose });
  const lock = makeShapeLock(geometry, 'research', 'projected-3q');
  const recovered = characterMaterialReview(geometry, lock, source.manifest.style).final;
  mapping = { result: 'LOSSY', exact: recovered.rgba.equals(after.rgba), rgba: inspect(recovered, legal).rgba };
  png('3q-character-spec-proxy.png', recovered);
} catch (error) {
  mapping = { result: 'REJECTED_BY_CURRENT_GEOMETRY', reason: error instanceof Error ? error.message : String(error) };
}
const supportPixels = 59 - (model.soleY + 1);
const qa = { camera: { yaw, pitch, sampling: 'pixel-center' }, pivot, rawBootBottom: model.soleY, soleToPivotPx: supportPixels,
  landmarks: model.landmarks, r2Landmarks: Object.fromEntries(['crown', 'near-shoulder', 'far-shoulder', 'near-hip', 'far-hip', 'near-palm'].map(id => [id, source.lock.landmarks[id].point])),
  handHandleEdges: model.handHandleEdges, mapping,
  before: inspect(before, legal), after: inspect(after, legal), partPixels: model.partPixels, planes: model.planes };
assert.equal(model.soleY + 1, 58);
assert.equal(after.w, 64);
assert.equal(after.h, 64);
for (let i = 0; i < 64; i++) assert.ok(!visible(after, 0, i) && !visible(after, 63, i) && !visible(after, i, 0) && !visible(after, i, 63));
const { backgrounds, source: sceneSources } = await scenes();
for (const [id, frame, mask] of [['r2', before, source.material.mask], ['3q', after, model.mask]] as const) {
  png(id + '-final.png', frame);
  png(id + '-4x.png', nearestNeighbor(frame, 4));
  png(id + '-silhouette.png', silhouette(frame, pack('#b7d6ce')));
  png(id + '-materials.png', mask);
  for (const scene of backgrounds) png(id + '-' + scene.id + '.png', placed(scene.background, frame, scene.pivot, pivot));
}
png('3q-planes.png', model.planeMap);
json('3q-qa.json', { ...qa, sceneSources });
json('3q-model.json', { version: 1, upstream: '17ae0ea8d822b9bb543e539118516ae37d25b114', camera: { yaw, pitch }, pivot, faces });
json('3q-perf.json', compareTime(
  () => characterMaterialReview(characterReview(source.geometry.spec), source.lock, source.manifest.style).final.rgba.length,
  () => render().raster.rgba.length, 23,
));
console.log(JSON.stringify({ pixels: qa.after.area, sole: model.soleY, grip: model.handHandleEdges, head: model.planes.head, jacket: model.planes.jacket,
  ratio: round(qa.after.area / qa.before.area), parts: model.partPixels }));


export type GeometryEvidence = typeof qa;
