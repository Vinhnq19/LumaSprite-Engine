import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pack, unpack, nearestInk, inkLuma, chestColors } from '../../../src/core/palette/colors.ts';
import { terrainMaterials } from '../../../src/generators/terrain/materials.ts';
import { materialMaskLegend } from '../../../src/generators/character/materials.ts';
import { verifyCharacterProductionPackage } from '../../../src/generators/character/production.ts';
import { nearestNeighbor, type Raster } from '../../../src/core/pixels/raster.ts';
import { sha256 } from '../../../src/quality/raster.ts';
import type { Point } from '../../../src/core/geometry/shapes.ts';
import { compareTime, crop, hex, inkAt, inspect, json, loadPng, placed, png, round, scenes, visible } from './common.ts';
import { delta, lchInk, toLab, toLch, toSrgb } from './oklab.ts';

const r2 = await verifyCharacterProductionPackage('benchmarks/results/e44/packages/r2');
const courier = await verifyCharacterProductionPackage('benchmarks/results/e44/packages/courier-rev');
const terrain = terrainMaterials({ mode: 'authored' }, true);
const terrainFile = 'benchmarks/results/e34/b-palette-authored-1x.png';
const { backgrounds } = await scenes();
const dungeon = backgrounds.find(scene => scene.id === 'dungeon')!;
const outdoor = backgrounds.find(scene => scene.id === 'outdoor')!;
const target = ['#1c2434', '#536da0', '#f7ba5b', '#eaf1f7'];
const rgbTarget = target.map(pack);
const labTarget = target.map(toLab);
const rgbPick = (color: string) => unpack(nearestInk(color, rgbTarget));
const oklabPick = (color: string) => {
  const lab = toLab(color);
  let best = 0;
  for (let i = 1; i < target.length; i++) if (delta(lab, labTarget[i]) < delta(lab, labTarget[best])) best = i;
  return target[best];
};
function prop(id: string) {
  const file = 'benchmarks/results/e24/' + id + '-1x.png';
  const qa = JSON.parse(readFileSync('benchmarks/results/e24/' + id + '-qa.json', 'utf8'));
  const ramps = qa.authored.palette.ramps as Record<string, string[]>;
  if (id === 'travel') ramps.brass = [chestColors.brassShadow, chestColors.brass, chestColors.brassLight];
  return { file, frame: loadPng(file), ramps, pairs: [['wood', 'iron']], pivot: [16, 29] as Point };
}

const entries = [
  { id: 'surveyor', name: 'Field Surveyor', file: 'benchmarks/results/e44/packages/r2/final.png', frame: r2.material.final, ramps: r2.material.diagnostics.ramps,
    pairs: [['coat', 'leather'], ['coat', 'far-coat'], ['leather', 'trousers']], pivot: [r2.lock.groundPivot[0], r2.lock.groundPivot[1]] as Point },
  { id: 'courier', name: 'Forest Courier', file: 'benchmarks/results/e44/packages/courier-rev/final.png', frame: courier.material.final, ramps: courier.material.diagnostics.ramps,
    pairs: [['coat', 'leather'], ['far-coat', 'leather'], ['leather', 'trousers']], pivot: [courier.lock.groundPivot[0], courier.lock.groundPivot[1]] as Point },
  { id: 'chest', name: 'Travel Chest', ...prop('travel') },
  { id: 'barrel', name: 'Tall Barrel', ...prop('barrel-tall') },
  { id: 'terrain', name: 'Grass / Dirt', file: terrainFile, frame: loadPng(terrainFile), ramps: terrain.diagnostics.ramps, pairs: [['grass', 'dirt']], pivot: [0, 0] as Point },
];
const gap = (a: string, b: string) => ({
  luma: Math.abs(inkLuma(pack(a)) - inkLuma(pack(b))), lightness: round(Math.abs(toLab(a)[0] - toLab(b)[0])),
  distance: round(delta(toLab(a), toLab(b))),
});
for (const expected of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', ...target]) assert.equal(toSrgb(toLab(expected)), expected);
const reference = toLab('#ff0000');
assert.ok(delta(reference, [0.62795536, 0.22486306, 0.1258463]) < 0.000001);

function measurePairs(pairs: string[][], ramps: Record<string, string[]>) {
  return pairs.map(([a, b]) => {
    const tonesA = ramps[a], tonesB = ramps[b];
    const pairs = tonesA.flatMap(x => tonesB.map(y => ({ a: x, b: y, ...gap(x, y) })));
    const left = tonesA[tonesA.length === 5 ? 2 : 1], right = tonesB[tonesB.length === 4 && b === 'dirt' ? 2 : 1];
    return { a, b, mid: { a: left, b: right, ...gap(left, right) },
      closest: pairs.sort((x, y) => x.distance - y.distance)[0],
      exact: pairs.filter(pair => pair.a === pair.b).length,
      near: pairs.filter(pair => pair.a !== pair.b && pair.distance <= 0.035).length };
  });
}

function boundary(frame: Raster, background: Raster, origin: Point, anchor: Point) {
  const edges: (ReturnType<typeof gap> & { tone: string })[] = [];
  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
  for (let y = 0; y < frame.h; y++) for (let x = 0; x < frame.w; x++) {
    if (!visible(frame, x, y)) continue;
    for (const [dx, dy] of offsets) {
      if (visible(frame, x + dx, y + dy)) continue;
      const bx = x + dx + anchor[0] - origin[0], by = y + dy + anchor[1] - origin[1];
      if (!visible(background, bx, by)) continue;
      const tone = hex(inkAt(frame, x, y)), nearby = hex(inkAt(background, bx, by));
      edges.push({ tone, ...gap(tone, nearby) });
    }
  }
  function summarize(samples: typeof edges) {
    const tenth = (key: 'luma' | 'lightness' | 'distance') => samples.map(item => item[key]).sort((a, b) => a - b)[Math.floor(samples.length / 10)] ?? null;
    return { samples: samples.length, p10Luma: tenth('luma'), p10Lightness: tenth('lightness'), p10Distance: tenth('distance') };
  }
  return { edges: summarize(edges), contour: summarize(edges.filter(edge => edge.tone === chestColors.contour)) };
}

function paint(frame: Raster, map: (color: string, offset: number) => string): Raster {
  const out = { ...frame, rgba: Buffer.from(frame.rgba) };
  for (let offset = 0; offset < out.rgba.length; offset += 4) {
    const p = out.rgba.readUInt32BE(offset);
    if (p) out.rgba.writeUInt32BE(pack(map(hex(p), offset)), offset);
  }
  return out;
}
function pairCollisions(mapping: string[]) {
  return mapping.reduce((total, ink, i) => total + mapping.slice(i + 1).filter(other => other === ink).length, 0);
}

const evidence = entries.map(({ id, name, file, frame, ramps, pairs, pivot }) => {
  const raster = inspect(frame);
  const used = new Set(raster.colors.map(([color]) => color));
  for (const color of used) assert.equal(toSrgb(toLab(color)), color);
  const mapped = raster.colors.map(([color, pixels]) => ({ color, pixels, rgb: rgbPick(color), lab: oklabPick(color) }));
  const changed = mapped.filter(ink => ink.rgb !== ink.lab);
  const rampsEvidence = Object.entries(ramps).filter(([, colors]) => colors.some(color => used.has(color))).map(([role, colors]) => ({
    role, tones: colors.map(color => ({
      color, present: used.has(color), luma: inkLuma(pack(color)), lch: toLch(toLab(color)).map(round),
    })),
    lumaMain: colors.slice(0, colors.length === 4 && role !== 'dirt' ? 3 : colors.length).map(color => inkLuma(pack(color))),
    lMain: colors.slice(0, colors.length === 4 && role !== 'dirt' ? 3 : colors.length).map(color => round(toLab(color)[0])),
  }));
  const mapRgb = new Map(mapped.map(row => [row.color, row.rgb]));
  const mapLab = new Map(mapped.map(row => [row.color, row.lab]));
  const previews = [frame, paint(frame, color => mapRgb.get(color)!), paint(frame, color => mapLab.get(color)!)];
  previews.slice(1).forEach(image => inspect(image, target));
  previews.forEach((image, i) => png('color-' + id + '-' + ['original', 'rgb', 'oklab'][i] + '.png',
    id === 'terrain' ? crop(image, 54, 61, 144, 80) : image));
  return {
    id, name, file, pngSha256: sha256(readFileSync(file)), dims: [frame.w, frame.h], sourceInks: used.size, ramps: rampsEvidence,
    pairs: measurePairs(pairs, ramps),
    boundary: id === 'terrain' ? null : { outdoor: boundary(frame, outdoor.background, pivot, outdoor.pivot),
      dungeon: boundary(frame, dungeon.background, pivot, dungeon.pivot) },
    remap: { distinctChanged: changed.length, pixelsChanged: changed.reduce((n, a) => n + a.pixels, 0),
      rgbCollisions: pairCollisions(mapped.map(row => row.rgb)), oklabCollisions: pairCollisions(mapped.map(row => row.lab)), mapped },
  };
});

const courierRamps = courier.material.diagnostics.ramps;
const beforeLeather = courierRamps.leather;
const afterLeather = beforeLeather.map((color, i) => lchInk([0.36, 0.61, 0.74, 0.49][i], [0.045, 0.08, 0.095, 0.066][i], 74));
assert.equal(new Set(afterLeather).size, beforeLeather.length);
assert.ok(afterLeather.every(color => !courier.material.usedColors.includes(color)));
const substitute = new Map(beforeLeather.map((ink, i) => [ink, afterLeather[i]]));
const candidate = () => paint(courier.material.final, (color, offset) =>
  courier.material.mask.rgba.readUInt32BE(offset) === pack(materialMaskLegend.leather) ? (substitute.get(color) ?? color) : color);
const altered = candidate();
assert.deepEqual(candidate(), altered);
let changed = 0;
for (let i = 0; i < altered.rgba.length; i += 4) {
  assert.equal(altered.rgba[i + 3], courier.material.final.rgba[i + 3]);
  if (altered.rgba.readUInt32BE(i) === courier.material.final.rgba.readUInt32BE(i)) continue;
  assert.equal(courier.material.mask.rgba.readUInt32BE(i), pack(materialMaskLegend.leather));
  changed++;
}
assert.ok(changed > 0);
const mixedRamps = { ...courierRamps, leather: afterLeather };
const afterPairs = measurePairs(entries[1].pairs, mixedRamps);
assert.ok(afterPairs[0].mid.distance > evidence[1].pairs[0].mid.distance);
const groundPivot: Point = [courier.lock.groundPivot[0], courier.lock.groundPivot[1]];
for (const [id, frame] of [['original', courier.material.final], ['candidate', altered]] as const) {
  png('courier-leather-' + id + '.png', frame);
  png('courier-leather-' + id + '-4x.png', nearestNeighbor(frame, 4));
  for (const scene of backgrounds) png('courier-leather-' + id + '-' + scene.id + '.png', placed(scene.background, frame, scene.pivot, groundPivot));
}
const candidateReport = {
  name: 'Courier ochre leather', source: entries[1].file, beforeLeather, afterLeather, changed,
  after: inspect(altered, [...courier.material.usedColors, ...afterLeather]),
  afterPairs, boundary: { outdoor: boundary(altered, outdoor.background, groundPivot, outdoor.pivot),
    dungeon: boundary(altered, dungeon.background, groundPivot, dungeon.pivot) },
};
json('color-candidate.json', candidateReport);
json('color-qa.json', { target, nearThreshold: 0.035, evidence, candidate: candidateReport });
const distinct = evidence.flatMap(asset => asset.remap.mapped.map(row => row.color));
json('color-perf.json', compareTime(
  () => distinct.map(rgbPick), () => distinct.map(oklabPick), 31,
));
console.log(JSON.stringify({ stats: evidence.map(row => [row.id, row.remap.distinctChanged, row.remap.rgbCollisions, row.remap.oklabCollisions]),
  original: beforeLeather, candidate: afterLeather, changed, afterPairs }));


export type ColorEvidence = { target: typeof target; nearThreshold: number; evidence: typeof evidence; candidate: typeof candidateReport };
