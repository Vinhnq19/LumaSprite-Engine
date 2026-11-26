import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { pixelEffectPackage } from '../src/generators/pixel-effects/export.ts';
import { sampleEffect } from '../src/generators/pixel-effects/vfx.ts';
import { uiSpecSchema,vfxSpecSchema } from '../src/specs/pixel-effects.ts';

const fixture=async(id:string)=>JSON.parse((await readFile('benchmarks/fixtures/e64/'+id+'.json')).toString('utf8'));
test('UI provenance and native size are validated and state changes keep their footprint',async()=>{
  const input=await fixture('interaction-icon');
  assert.throws(()=>uiSpecSchema.parse({...input,size:[32,32]}));
  await assert.rejects(pixelEffectPackage({...input,style:{...input.style,sha256:'0'.repeat(64)}}),/provenance mismatch/);
  const {frames}=await pixelEffectPackage(input);
  assert.deepEqual(frames.map(f=>f.id),['normal','active']);
  assert.equal(frames[0].alphaSha256,frames[1].alphaSha256);
  assert.notEqual(frames[0].rgbaSha256,frames[1].rgbaSha256);
});
test('VFX rejects incorrect phase order and exports distinct one-shot and repeat semantics',async()=>{
  const input=vfxSpecSchema.parse(await fixture('pickup-sparkle'));
  assert.throws(()=>vfxSpecSchema.parse({...input,frames:[...input.frames].reverse()}),/Invalid phase order/);
  const noTail=input.frames.map(f=>f.phase==='clear'?{...f,durationMs:40}:f);
  assert.throws(()=>vfxSpecSchema.parse({...input,frames:noTail}),/clear recovery/);
  const once=await pixelEffectPackage(input), repeat=await pixelEffectPackage({...input,loop:'repeat'});
  assert.deepEqual(once.files.get('spritesheet.png'),repeat.files.get('spritesheet.png'));
  assert.notDeepEqual(once.files.get('timing.json'),repeat.files.get('timing.json'));
  const total=input.frames.reduce((sum,f)=>sum+f.durationMs,0);
  assert.equal(sampleEffect(input.frames,total,'once'),null);
  assert.equal(sampleEffect(input.frames,total,'repeat'),0);
  assert.equal(sampleEffect(input.frames,total-1,'once'),input.frames.length-1);
  assert.equal(once.frames.at(-1)!.coverage,0);
});
