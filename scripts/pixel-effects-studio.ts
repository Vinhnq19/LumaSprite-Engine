import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir,mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { join,resolve,sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

test('Studio keeps native UI PNGs and both VFX strips, timing, pivot and one-shot tags',async t=>{
  const studio=resolve(process.env.LUMASPRITE_STUDIO_ROOT??'../LumaSprite-Studio');
  const revision=execFileSync('git',['rev-parse','--short=7','HEAD'],{cwd:studio,encoding:'utf8'}).trim();
  const url=(path:string)=>pathToFileURL(join(studio,path)).href;
  const { readStudioPng }=await import(url('studio/pixel/read-png.ts'));
  const { materializeEngineResultV1,negotiateEngineV1 }=await import(url('src/studio/engine-adapter.ts'));
  const { celFor,newDocument,playback }=await import(url('src/studio/pixel/model.ts'));
  const { sampleMotionPlayback }=await import(url('src/studio/quality/playback.ts'));
  const { PixelStore }=await import(url('src/node/studio/pixel-store.ts'));
  const { exportPixel }=await import(url('src/node/studio/pixel-render.ts'));
  const cache=resolve('.cache');
  await mkdir(cache,{recursive:true});
  const scratch=await mkdtemp(join(cache,'e64-studio-'));
  assert.ok(scratch.startsWith(cache+sep+'e64-studio-'));
  t.after(()=>rm(scratch,{recursive:true,force:true}));
  const store=new PixelStore(scratch);
  const packages='benchmarks/results/e64/packages/';
  const cases=[];
  async function storeDoc(doc:ReturnType<typeof newDocument>,w:number,h:number){
    const {id}=store.create(doc.name,w,h,0,doc);
    const original=store.load(id,true);
    store.save(id,original.revision,original,'Store E6.4 pixel asset');
    return store.load(id,true);
  }
  for(const [id,file] of [['interaction-icon','frame-0.png'],['interaction-icon','frame-1.png'],['inventory-barrel','frame-0.png']]){
    const png=await readFile(packages+id+'/'+file);
    const raster=decodePng(png);
    const rgba:Uint32Array=await readStudioPng(new Blob([Uint8Array.from(png)]),raster.w,raster.h);
    const doc=newDocument(id+' '+file,raster.w,raster.h),asset=doc.assets[0],frame=asset.frames[0];
    celFor(asset,asset.layers[0].id,frame.id,true).data.set(rgba);
    const reopened=await storeDoc(doc,raster.w,raster.h);
    const output=exportPixel({document:reopened,assetId:asset.id,frameId:frame.id,format:'png'});
    assert.deepEqual(decodePng(Buffer.from(output.data)),raster);
    cases.push({id,file,contract:'RAW_PNG',rgbaSha256:sha256(raster.rgba),saveReopen:'PASS'});
  }
  for(const id of ['signal-activation','pickup-sparkle']){
    const directory=packages+id+'/';
    const timing=JSON.parse((await readFile(directory+'timing.json')).toString('utf8')) as {
      name:string;canvas:{w:number;h:number};pivot:[number,number];loop:'once'|'repeat';totalDurationMs:number;
      frames:{durationMs:number;rgbaSha256:string;rect:{x:number}}[];
    };
    const {w,h}=timing.canvas, count=timing.frames.length, sheetWidth=w*count;
    const png=await readFile(directory+'spritesheet.png');
    const data:Uint32Array=await readStudioPng(new Blob([Uint8Array.from(png)]),sheetWidth,h);
    const frames=timing.frames.map(({durationMs,rect})=>{
      const rgba=new Uint32Array(w*h);
      for(let y=0;y<h;y++)rgba.set(data.subarray(y*sheetWidth+rect.x,y*sheetWidth+rect.x+w),y*w);
      return {durationMs,rgba};
    });
    const palette=[0,...new Set([...data].filter(Boolean))];
    const loop=timing.loop==='repeat',frameDurationsMs=frames.map(f=>f.durationMs);
    const request={version:1,requestId:id,assetType:'animation',brief:timing.name,canvas:{w,h},frameDurationsMs,loop,alpha:'binary',palette};
    assert.equal(negotiateEngineV1({versions:[1],assetTypes:['animation'],features:[],limits:{width:64,height:64,frames:8}},request),1);
    const asset=materializeEngineResultV1({version:1,jobId:id,versionId:'pilot',name:timing.name,w,h,loop,frames},request,id,'pilot');
    asset.metadata.pivot={x:timing.pivot[0]/w,y:timing.pivot[1]/h};
    const doc=newDocument(timing.name,w,h);
    doc.assets=[asset];
    const reopened=await storeDoc(doc,w,h), stored=reopened.assets[0];
    const sequence=playback(stored,stored.tags[0].id) as {frame:{id:string;duration:number}}[];
    assert.deepEqual(sequence.map(s=>s.frame.duration),frameDurationsMs);
    assert.deepEqual(stored.metadata.pivot,asset.metadata.pivot);
    assert.equal(stored.tags[0].loop,false);
    const frameHashes=sequence.map(({frame})=>{
      const result=exportPixel({document:reopened,assetId:stored.id,frameId:frame.id,format:'png'});
      return sha256(decodePng(Buffer.from(result.data)).rgba);
    });
    assert.deepEqual(frameHashes,timing.frames.map(f=>f.rgbaSha256));
    assert.deepEqual(sampleMotionPlayback(frames,timing.totalDurationMs,false),{index:count-1,done:true,delayMs:0});
    assert.deepEqual(sampleMotionPlayback(frames,timing.totalDurationMs,true),{index:0,done:false,delayMs:frames[0].durationMs});
    cases.push({id,file:'spritesheet.png',contract:'ENGINE_RESULT_V1_OFFLINE',frameHashes,frameDurationsMs,pivot:timing.pivot,
      loop:'once',terminal:'clear',saveReopen:'PASS'});
  }
  const output='benchmarks/results/run/e64';
  await mkdir(output,{recursive:true});
  await writeFile(join(output,'studio-parity.json'),JSON.stringify({studioRevision:revision,cases},null,2)+'\n');
  t.diagnostic('Studio '+revision+' preserved 3 native UI PNGs and 13 timed VFX cells.');
});
