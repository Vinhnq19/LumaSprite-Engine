import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { loadComposition,renderComposition } from '../src/generators/environment/composition.ts';
import { buildRuins,connectedPixels } from '../src/generators/environment/ruins.ts';
import { sceneCompositionSpec } from '../src/specs/scene-composition.ts';

test('ruin structure is independent of material, lighting and seed and accepts a second gateway topology',async()=>{
  const inputs=await Promise.all(['r1-signal-entrance','r2-signal-clearing'].map(async id=>
    loadComposition(JSON.parse(await readFile('benchmarks/fixtures/e63/'+id+'.json','utf8')))));
  const silhouettes=[];
  for(const input of inputs){
    const day=renderComposition(input,'day'), flat=renderComposition(input,'day',true), night=renderComposition(input,'night');
    assert.deepEqual(flat.scene.architectureSilhouette,day.scene.architectureSilhouette);
    assert.deepEqual(day.scene.architectureSilhouette,night.scene.architectureSilhouette);
    assert.deepEqual(flat.walkable,night.walkable);
    assert.notDeepEqual(flat.scene.raster,day.scene.raster);
    assert.equal(day.scene.nightLight,undefined);
    assert.ok(night.scene.nightLight);
    const site=input.spec.ruins!, seed=input.spec.seed;
    const old=buildRuins(site,input.environment.style,'day',seed,false);
    const seeded=buildRuins(site,input.environment.style,'day',seed+1,false);
    assert.notDeepEqual(old.modules[0].piece.raster,seeded.modules[0].piece.raster);
    assert.deepEqual(old.modules.map(m=>connectedPixels(m.piece.raster)),seeded.modules.map(m=>connectedPixels(m.piece.raster)));
    silhouettes.push(day.scene.architectureSilhouette);
    const invalid=structuredClone(input.spec);
    invalid.ruins!.modules.find(m=>m.kind==='gateway')!.width=42;
    assert.throws(()=>sceneCompositionSpec.parse(invalid),/load-bearing piers/);
  }
  assert.notDeepEqual(silhouettes[0],silhouettes[1]);
});
