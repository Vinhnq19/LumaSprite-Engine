import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pack, unpack } from '../src/core/palette/colors.ts';
import { nearestNeighbor } from '../src/core/pixels/raster.ts';
import { materialMaskLegend } from '../src/generators/character/materials.ts';
import { verifyCharacterProductionPackage } from '../src/generators/character/production.ts';
import type { Point } from '../src/core/geometry/shapes.ts';
import { sha256 } from '../src/quality/raster.ts';
import { inspect, placed, round, scenes } from '../research/open-source/art-quality/common.ts';
import { delta, lchInk, toLab, toLch } from '../research/open-source/art-quality/oklab.ts';
import { courierSource, json, png, surveyorSource } from './e53-common.ts';

type Package = Awaited<ReturnType<typeof verifyCharacterProductionPackage>>;
const [courier, surveyor, game] = await Promise.all([
  verifyCharacterProductionPackage(courierSource), verifyCharacterProductionPackage(surveyorSource), scenes(),
]);
const threshold = 0.035;
function rampDistance(first: string[], second: string[]) {
  const pairs = first.flatMap(a => second.map(b => {
    const x = toLab(a), y = toLab(b);
    return { a, b, deltaL: round(Math.abs(x[0] - y[0])), deltaE: round(delta(x, y)) };
  }));
  const closest = [...pairs].sort((a, b) => a.deltaE - b.deltaE)[0];
  const mid = pairs[second.length + 1];
  return { mid, closest, exact: pairs.filter(p => p.a === p.b).length,
    near: pairs.filter(p => p.a !== p.b && p.deltaE <= threshold).length };
}

function diagnose(source: Package) {
  const used = new Set(source.material.usedColors);
  const { ramps } = source.material.diagnostics;
  return {
    name: source.geometry.spec.name,
    ramps: Object.entries(ramps).filter(([, colors]) => colors.some(color => used.has(color))).map(([role, colors]) => ({
      role, colors, used: colors.map(color => used.has(color)), oklch: colors.map(color => toLch(toLab(color)).map(round)),
      compressed: new Set(colors.slice(0, 3)).size < 3,
      ascending: colors.slice(0, 2).every((color, i) => toLab(color)[0] < toLab(colors[i + 1])[0]),
    })),
    pairs: [['coat', 'leather'], ['far-coat', 'leather'], ['coat', 'far-coat'], ['leather', 'trousers']].map(([a, b]) => {
      const info = rampDistance(ramps[a], ramps[b]);
      const warnings = [info.exact ? 'PALETTE_COLLISION' : null, info.near ? 'NEAR_INK_COLLISION' : null,
        info.mid.deltaL <= 0.05 ? 'LOW_MIDTONE_LIGHTNESS_GAP' : null].filter(Boolean);
      return { a, b, ...info, warnings };
    }),
  };
}

const original = courier.material.final;
const layers = courier.geometry.layers;
const label = pack(materialMaskLegend.leather);
const before = courier.material.diagnostics.ramps.leather;
const satchel = [lchInk(.349, .05, 57), lchInk(.584, .076, 67), lchInk(.705, .086, 69), lchInk(.471, .06, 62)];
const strap = [lchInk(.36, .048, 57), lchInk(.608, .075, 68), lchInk(.718, .083, 70), lchInk(.504, .061, 65)];
const partRamps = { satchel, strap };
const originalRgba = sha256(original.rgba);

function recolor() {
  const result = { ...original, rgba: Buffer.from(original.rgba) };
  const eligible = { satchel: 0, strap: 0 };
  const changed = { satchel: 0, strap: 0 };
  let bootPixels = 0;
  for (let at = 0; at < result.rgba.length; at += 4) {
    const owner = courier.lock.layerOrder.findLast(part => layers[part].rgba[at + 3] === 255);
    if (owner?.endsWith('-boot')) bootPixels++;
    if (owner !== 'satchel' && owner !== 'strap') continue;
    if (courier.material.mask.rgba.readUInt32BE(at) !== label) continue;
    const current = original.rgba.readUInt32BE(at);
    const tone = before.indexOf(unpack(current));
    if (tone === -1) continue;
    eligible[owner]++;
    const next = pack(partRamps[owner][tone]);
    if (next !== current) {
      result.rgba.writeUInt32BE(next, at);
      changed[owner]++;
    }
  }

  for (let at = 0; at < result.rgba.length; at += 4) {
    assert.equal(result.rgba[at + 3], original.rgba[at + 3]);
    if (layers['near-boot'].rgba[at + 3] || layers['far-boot'].rgba[at + 3]) {
      assert.equal(result.rgba.readUInt32BE(at), original.rgba.readUInt32BE(at), 'Boot pixels are protected.');
    }
    if (result.rgba.readUInt32BE(at) === original.rgba.readUInt32BE(at)) continue;
    const owner = courier.lock.layerOrder.findLast(part => layers[part].rgba[at + 3]);
    assert.ok(owner === 'satchel' || owner === 'strap');
    assert.equal(courier.material.mask.rgba.readUInt32BE(at), label);
  }
  assert.ok(changed.satchel && changed.strap && bootPixels);
  return { result, eligible, changed, bootPixels };
}

const candidate = recolor();
assert.deepEqual(recolor(), candidate);
assert.equal(sha256(original.rgba), originalRgba);
assert.equal(sha256(readFileSync(courierSource + '/final.png')), courier.manifest.files['final.png']);
const legal = [...new Set([...courier.material.usedColors, ...strap, ...satchel])];
const candidateRaster = inspect(candidate.result, legal);
const { coat, 'far-coat': farCoat } = courier.material.diagnostics.ramps;
const measurements = Object.entries(partRamps).flatMap(([part, ramp]) => ([['coat', coat], ['far-coat', farCoat]] as const).map(([role, material]) => ({
  part, role, before: rampDistance(material, before), after: rampDistance(material, ramp),
})));
assert.ok(measurements.every(m => m.after.mid.deltaE > m.before.mid.deltaE));
const [pivotX, pivotY] = courier.lock.groundPivot;
const pivot: Point = [pivotX, pivotY];
for (const [name, sprite] of [['original', original], ['localized', candidate.result]] as const) {
  png('leather/' + name, sprite);
  png('leather/' + name + '-4x', nearestNeighbor(sprite, 4));
  for (const scene of game.backgrounds) {
    const frame = placed(scene.background, sprite, scene.pivot, pivot);
    png('leather/' + name + '-' + scene.id, frame);
    png('leather/' + name + '-' + scene.id + '-4x', nearestNeighbor(frame, 4));
  }
}

const report = {
  name: 'Courier-Leather-Localized', mode: 'opt-in', threshold,
  baseline: [diagnose(courier), diagnose(surveyor)], recommendedPaletteCandidates: partRamps,
  referenceLeather: before, measurements, eligible: candidate.eligible, changed: candidate.changed, bootPixels: candidate.bootPixels,
  shapeLock: courier.lock.silhouetteAlphaSha256, originalRgba, candidateRgba: candidateRaster.rgba,
};
json('leather/qa.json', report);
console.log(JSON.stringify({ changed: candidate.changed, preservedBootPixels: candidate.bootPixels, pairs: measurements.map(m =>
  ({ part: m.part, role: m.role, before: m.before.mid, after: m.after.mid })) }));

export type ColorReview = typeof report;
