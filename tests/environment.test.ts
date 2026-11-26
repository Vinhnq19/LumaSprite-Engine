import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { environmentPackage } from '../src/generators/environment/export.ts';
import { loadEnvironment, renderEnvironment } from '../src/generators/environment/render.ts';
import { environmentSpecSchema } from '../src/specs/environment.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const read = async (layout: string) => environmentSpecSchema.parse(JSON.parse(await readFile('benchmarks/fixtures/e61/' + layout + '.json','utf8')));

test('the same environment kit builds two layouts with open thresholds, silhouettes and scene-depth occlusion', async () => {
  const [court, road] = await Promise.all(['front-court','roadside'].map(async layout => loadEnvironment(await read(layout))));
  assert.deepEqual(court.style, road.style);
  for (const input of [court,road]) {
    const a = renderEnvironment(input,'A','day');
    const b = environmentPackage(input,'B','day');
    const dark = renderEnvironment(input,'B','night');
    assert.equal(a.metadata.alphaSha256,b.scene.metadata.alphaSha256);
    assert.deepEqual(a.metadata.collisions,b.scene.metadata.collisions);
    assert.deepEqual(b.scene.metadata.collisions,dark.metadata.collisions);
    assert.deepEqual(a.metadata.palette.allowed,b.scene.metadata.palette.allowed);
    assert.deepEqual(a.metadata.layerOrder,b.scene.metadata.layerOrder);
    assert.equal(b.scene.metadata.seamSamples,input.spec.building.bays.length*30);
    const [x,y]=b.scene.metadata.portal.at;
    assert.equal(b.scene.collisionPlane.rgba[(y*b.scene.raster.w+x)*4+3],0);
    assert.ok(!a.raster.rgba.equals(b.scene.raster.rgba));
    assert.ok(!b.scene.raster.rgba.equals(dark.raster.rgba));
    assert.deepEqual(decodePng(b.files.get('scene.png')!),b.scene.raster);
    assert.equal(sha256(b.files.get('kit.png')!),b.manifest.files['kit.png']);
  }
  const actor = renderEnvironment(road,'B','day').metadata.occlusion.find(x=>x.id==='forest-courier')!;
  assert.ok(actor.hiddenBy['station-shell']>0 && actor.visible>actor.visibleBefore*.8);
});

test('environment validation rejects disconnected approaches and invalid asset references', async () => {
  const input = await read('front-court');
  const outside = structuredClone(input);
  outside.assetRefs[0].file='benchmarks/results/../private.png';
  assert.throws(()=>environmentSpecSchema.parse(outside));
  const ref = structuredClone(input);
  ref.assetRefs[0].sha256='0'.repeat(64);
  await assert.rejects(loadEnvironment(ref),/provenance mismatch/);
  const blocked = structuredClone(input);
  blocked.building.bays[3]='wall';
  assert.throws(()=>environmentSpecSchema.parse(blocked),/interior door/);
  const detached = await loadEnvironment({...input,path:[[16,16],[30,16],[30,30],[16,30]]});
  assert.throws(()=>renderEnvironment(detached,'A','day'),/does not reach the door/);
});

test('environment v2 validates both actor scales and rejects undersized or occupied entries', async () => {
  const raw = JSON.parse(await readFile('benchmarks/fixtures/e61r/front-court.json','utf8'));
  assert.equal(environmentSpecSchema.parse(raw).version,2);
  const missing = structuredClone(raw);
  delete missing.assetRefs.find((x: {kind:string})=>x.kind==='actor').scaleManifestSha256;
  assert.throws(()=>environmentSpecSchema.parse(missing),/scale evidence/);
  const tampered = structuredClone(raw);
  tampered.assetRefs.find((x: {kind:string})=>x.kind==='actor').scaleManifestSha256='0'.repeat(64);
  await assert.rejects(loadEnvironment(tampered),/scale evidence checksum/);
  const input = await loadEnvironment(raw);
  assert.throws(()=>renderEnvironment(input,'A','day'),/requires finish B/);
  const scene = renderEnvironment(input,'B','day');
  const night = renderEnvironment(input,'B','night');
  assert.deepEqual(scene.collisionPlane,night.collisionPlane);
  assert.deepEqual(scene.metadata.layerOrder,night.metadata.layerOrder);
  assert.deepEqual(scene.metadata.occlusion.map(row=>[row.id,row.visible,row.hiddenBy]),
    night.metadata.occlusion.map(row=>[row.id,row.visible,row.hiddenBy]));
  assert.equal(scene.metadata.refinement?.geometry.fit.length,2);
  assert.ok(night.nightLight);
  assert.equal(scene.nightLight,undefined);
  const low=await loadEnvironment({...raw,architecture:{...raw.architecture,doorHeight:52}});
  assert.throws(()=>renderEnvironment(low,'B','day'),/does not fit/);
  const occupied=structuredClone(raw);
  occupied.placements.find((x: {id:string})=>x.id==='supply-crate').at=[scene.metadata.portal.at[0]+16,scene.metadata.portal.at[1]+8];
  assert.throws(()=>renderEnvironment({...input,spec:environmentSpecSchema.parse(occupied)},'B','day'),/body sweep touches/);
});
