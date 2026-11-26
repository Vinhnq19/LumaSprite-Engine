import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { decodePng } from '../src/core/renderer/png.ts';
import { unpackAnimationStrip, verifyAnimationPackage } from '../src/generators/character/animation.ts';
import { verifyCharacterProductionPackage } from '../src/generators/character/production.ts';
import { buildWalkAnimation, plantedDisplacement } from '../src/generators/character/walk.ts';
import { sha256 } from '../src/quality/raster.ts';
import { walkSpecSchema } from '../src/specs/animation.ts';

const sourcePath = 'benchmarks/results/e44/packages/r2';
const inputs = async (id: string) => {
  const [source, json] = await Promise.all([
    verifyCharacterProductionPackage(sourcePath), readFile('benchmarks/fixtures/e52/' + id + '.json', 'utf8'),
  ]);
  return { source, spec: walkSpecSchema.parse(JSON.parse(json)) };
};

test('both gaits simulate forward world travel with fixed planted contacts including the wrap', async () => {
  for (const [id, count, cycle] of [['w1', 6, 24], ['w2', 8, 32]] as const) {
    const { source, spec } = await inputs(id);
    const walk = buildWalkAnimation(source, spec);
    const motion = walk.timing.rootMotion;
    assert.equal(motion.cyclePx, cycle);
    assert.equal(walk.frames.length, count);
    assert.equal(new Set(walk.qa.frames.map(f => f.alphaSha256)).size, count);
    assert.deepEqual(walk.qa.frames.filter(f => f.phase === 'contact').map(f => f.lead), ['far', 'near']);
    assert.ok(walk.qa.frames.every(f => f.gripPixels === 7 && f.openHandleRows === 2));
    for (const [i, frame] of walk.qa.frames.entries()) {
      const next = motion.frames[(i + 1) % count], wrap = i === count - 1 ? cycle : 0;
      assert.equal(next.rootX + wrap - frame.rootX, frame.advancePx);
      for (const side of ['near', 'far'] as const) {
        const f = frame.feet[side];
        assert.equal(f.world[0], f.canvas[0] + frame.rootX);
        assert.equal(f.clearance, f.groundY - f.canvas[1]);
        assert.equal(f.state === 'planted', f.clearance === 0);
        const b = next.feet[side];
        if (f.state === 'planted' && b.state === 'planted') {
          assert.deepEqual(plantedDisplacement(f, b, wrap), [0, 0]);
        }
      }
      assert.equal(walk.qa.transitions[i].flicker.length, 0);
      assert.ok(walk.qa.transitions[i].contacts.some(c => c.plantedDelta !== null));
    }
    assert.equal(walk.qa.transitions.at(-1)!.wrap, true);
    assert.deepEqual(walk.bridge.geometry.layers['far-boot'], source.geometry.layers['far-boot']);
    assert.deepEqual(walk.frames[0].geometry.layers['far-boot'], source.geometry.layers['far-boot']);
    assert.deepEqual(walk.frames.map(f => f.material.final),
      unpackAnimationStrip(decodePng(walk.files.get('spritesheet.png')!), walk.timing));
    assert.deepEqual((await verifyAnimationPackage('benchmarks/results/e52/' + id + '/package', sourcePath)).files, walk.files);
  }
});

test('rejects unknown phase ordering and in-place foot errors hidden by a fixed pivot', async () => {
  const { source, spec } = await inputs('w2');
  const badPhase = structuredClone(spec);
  badPhase.keyPoses[1].lead = 'near';
  assert.throws(() => walkSpecSchema.parse(badPhase), /Walk phases/);
  const badStride = structuredClone(spec);
  badStride.keyPoses[0].advancePx = 3;
  assert.throws(() => buildWalkAnimation(source, badStride), /half-cycle/);
  const { qa } = buildWalkAnimation(source, spec);
  const a = qa.frames[0].feet.far, b = qa.frames[1].feet.far;
  assert.notEqual(a.canvas[0], b.canvas[0]);
  assert.deepEqual(plantedDisplacement(a, b, 0), [0, 0]);
  assert.deepEqual(plantedDisplacement(a, { ...b, world: [b.world[0] + 1, b.world[1]] }, 0), [1, 0]);
  assert.equal(plantedDisplacement(a, { ...b, state: 'swing' }, 0), null);
});

test('E5.1 original idle and E4 source remain byte-exact after sharing the walk renderer', async () => {
  const catalog = await readFile('docs/e51-benchmark-sha256.txt', 'utf8');
  for (const row of catalog.trim().split(/\r?\n/)) {
    const [hash, file] = row.split('  ');
    assert.equal(sha256(await readFile(file)), hash, file);
  }
  const idle = await verifyAnimationPackage('benchmarks/results/e51/package', sourcePath);
  assert.equal(idle.spec.version, 1);
  assert.equal(idle.timing.totalDurationMs, 1800);
  assert.equal(idle.timing.frames[0].rgbaSha256, idle.timing.frames[2].rgbaSha256);
});

test('walk-free keeps Courier anatomy, both hands, satchel and world contact in the shared walk package', async () => {
  const source = await verifyCharacterProductionPackage('benchmarks/results/e44/packages/courier-rev');
  const spec = walkSpecSchema.parse(JSON.parse(await readFile('benchmarks/fixtures/e53/courier-walk.json', 'utf8')));
  assert.throws(() => walkSpecSchema.parse({ ...spec, contact: { ...spec.contact, equipment: 'held-lantern' } }), /match the standing pose/);
  const swaying = structuredClone(spec);
  swaying.keyPoses[1].sway = 1;
  assert.throws(() => buildWalkAnimation(source, swaying), /no held-equipment motion/);
  const walk = buildWalkAnimation(source, spec);
  assert.equal(walk.timing.totalDurationMs, 960);
  assert.equal(walk.timing.rootMotion.cyclePx, 24);
  assert.deepEqual(walk.bridge.geometry.layers['far-boot'], source.geometry.layers['far-boot']);
  assert.deepEqual(walk.frames.map(frame => frame.material.final), unpackAnimationStrip(walk.sheet, walk.timing));
  for (const [i, frame] of walk.frames.entries()) {
    assert.deepEqual(frame.geometry.spec.proportions, source.geometry.spec.proportions);
    assert.equal(frame.lock.gripAnchor, null);
    assert.ok(frame.lock.bodyParts.satchel.pixels > 0 && frame.lock.bodyParts.strap.pixels > 0);
    assert.equal(walk.qa.transitions[i].flicker.length, 0);
    for (const contact of walk.qa.transitions[i].contacts) {
      if (contact.plantedDelta) assert.deepEqual(contact.plantedDelta, [0, 0]);
    }
  }
  assert.ok(new Set(walk.frames.map(frame => frame.geometry.spec.pose.near.palm.join(','))).size > 2);
  assert.ok(new Set(walk.frames.map(frame => frame.geometry.spec.pose.far.palm.join(','))).size > 2);
});
