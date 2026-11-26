import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir,mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { join,resolve,sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

test('Studio preserves the locked stone benchmark PNGs on save, reopen and export',async t=>{
  const refined=process.argv.includes('--refine');
  const edition=refined?'e72r':'e72b';
  const root='benchmarks/results/'+edition+'/';
  const studio=resolve(process.env.LUMASPRITE_STUDIO_ROOT??'../LumaSprite-Studio');
  const uri=(path:string)=>pathToFileURL(join(studio,path)).href;
  const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:studio,encoding:'utf8'}).trim();
  const {readStudioPng}=await import(uri('studio/pixel/read-png.ts'));
  const {celFor,newDocument}=await import(uri('src/studio/pixel/model.ts'));
  const {PixelStore}=await import(uri('src/node/studio/pixel-store.ts'));
  const {exportPixel}=await import(uri('src/node/studio/pixel-render.ts'));

  const cache=resolve('.cache');
  await mkdir(cache,{recursive:true});
  const prefix=join(cache,edition+'-studio-');
  const folder=await mkdtemp(prefix);
  assert.ok(folder.startsWith(cache+sep+edition+'-studio-')&&folder.length>prefix.length);
  t.after(()=>rm(folder,{recursive:true,force:true}));
  const store=new PixelStore(folder);
  const cases=[];
  const files=refined?
    ['r1/day/s2/native.png','h1/night/s2/native.png','h3/night/s2/native.png','h4/day/s2/native.png',
      'h4/night/s2/material.png','h4/night/silhouette.png'] :
    ['r1/day/s0/native.png','r1/day/s1/native.png','h1/night/s1/native.png',
      'h3/day/s1/native.png','h3/night/s1/material.png','h3/night/silhouette.png'];
  for(const file of files){
    const bytes=await readFile(root+file), raster=decodePng(bytes);
    const data:Uint32Array=await readStudioPng(new Blob([Uint8Array.from(bytes)]),raster.w,raster.h);
    assert.equal(data.length,raster.w*raster.h);
    for(const [offset,ink] of data.entries())assert.equal(raster.rgba.readUInt32BE(offset*4),ink);
    const doc=newDocument(file,raster.w,raster.h),asset=doc.assets[0],frame=asset.frames[0],layer=asset.layers[0];
    celFor(asset,layer.id,frame.id,true).data.set(data);
    const {id}=store.create(doc.name,raster.w,raster.h,0,doc);
    const original=store.load(id,true);
    store.save(id,original.revision,original,'Save flattened stone benchmark');
    const reopened=store.load(id,true);
    const result=exportPixel({document:reopened,assetId:asset.id,frameId:frame.id,format:'png'});
    assert.deepEqual(decodePng(Buffer.from(result.data)),raster);
    cases.push({file,canvas:[raster.w,raster.h],pngSha256:sha256(bytes),rgbaSha256:sha256(raster.rgba)});
  }
  const flag=refined?process.env.LUMASPRITE_PUBLISH_E72R:process.env.LUMASPRITE_PUBLISH_E72B;
  const output=flag==='1'?root:'benchmarks/results/run/'+edition+'/';
  await mkdir(output,{recursive:true});
  await writeFile(output+'studio-parity.json',JSON.stringify({revision,mode:'RAW_PNG_ONLY',cases},null,2)+'\n');
  t.diagnostic('Studio '+revision.slice(0,7)+' · '+cases.length+' exact RGBA round-trips.');
});
