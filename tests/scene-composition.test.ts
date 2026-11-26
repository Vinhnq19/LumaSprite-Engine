import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { loadComposition,renderComposition,routeFits,spatialProbe } from '../src/generators/environment/composition.ts';
import { sceneCompositionSpec } from '../src/specs/scene-composition.ts';

const read=async(id: string)=>JSON.parse(await readFile('benchmarks/fixtures/e62/'+id+'.json','utf8'));
test('scene composition pins the kit, rejects blocked routes and distinguishes intentional depth occlusion',async()=>{
  const raw=await read('c2-supply-stop');
  assert.throws(()=>sceneCompositionSpec.parse({...raw,depth:'sprite-top'}));
  await assert.rejects(loadComposition({...raw,source:{...raw.source,specSha256:'0'.repeat(64)}}),/Kit spec provenance/);
  const input=await loadComposition(raw);
  const day=renderComposition(input,'day'),night=renderComposition(input,'night');
  assert.deepEqual(day.walkable,night.walkable);
  assert.equal(day.scene.nightLight,undefined);
  assert.ok(night.scene.nightLight);
  const [x,y]=day.scene.metadata.portal.at;
  const half=input.environment.assets.get('surveyor')!.scale!.bodyHalfWidth;
  assert.throws(()=>routeFits(day.walkable,[[x,y+3],[x+10,y-2]],half,'blocked route'),/hits collision/);
  routeFits(day.walkable,[[x,y+3],[x,y-5]],half,'open threshold');
  const bucket=Object.fromEntries(input.spec.probes.map(p=>[p.id,spatialProbe(input,'day',p).contact]));
  assert.equal(bucket.front.visible,bucket.front.visibleBefore);
  assert.equal(bucket.rear.visible,0);
  assert.ok(bucket.threshold.hiddenBy['station-shell']>0);
  assert.ok(bucket.foreground.hiddenBy['supply-crate']>0);
});
