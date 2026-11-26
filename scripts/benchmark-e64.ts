import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { parseArgs } from 'node:util';
import { nearestNeighbor,type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { inspectPng,sha256 } from '../src/quality/raster.ts';
import { writeEnvironmentPackage } from '../src/generators/environment/export.ts';
import { checkedFile,pixelEffectPackage,verifyPixelEffectPackage } from '../src/generators/pixel-effects/export.ts';
import { gameplay,reviewScenes } from './e64-scenes.ts';

const {values:{publish,out}}=parseArgs({options:{publish:{type:'boolean'},out:{type:'string'}}});
if(publish && out)throw new Error('Choose --publish or --out.');
const directory=publish?'benchmarks/results/e64':out??'benchmarks/results/run/e64';
const fixture='benchmarks/fixtures/e64/';
const json=(value:unknown)=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const read=async(path:string)=>JSON.parse((await readFile(path)).toString('utf8'));
const hashes:Record<string,string>={};
async function save(path:string,bytes:Buffer){
  const file=join(directory,path);
  await mkdir(dirname(file),{recursive:true});
  try{await writeFile(file,bytes,{flag:'wx'});}
  catch(error){
    if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
    assert.deepEqual(await readFile(file),bytes,file+' differs from regenerated output.');
  }
  hashes[path]=sha256(bytes);
}
async function png(path:string,raster:Raster){
  const bytes=encodePng(raster);
  assert.deepEqual(inspectPng(raster,bytes,raster),[],path);
  await save(path,bytes);
}
const lock=await read(fixture+'e63-environment-lock.json');
assert.equal(lock.checkpoint,'6efc683');
for(const file of lock.files)await checkedFile(file);
for(const [edition,count] of [['e61r',109],['e62',100],['e63',105]] as const){
  const lines=(await readFile('benchmarks/results/'+edition+'/SHA256SUMS','utf8')).trim().split(/\r?\n/);
  assert.equal(lines.length,count);
  for(const line of lines){const [sha256,file]=line.split('  ');await checkedFile({file,sha256});}
}
for(const scene of lock.scenes)for(const entry of Object.values(scene.packages) as {file:string;sha256:string}[])await checkedFile(entry);
const bundles:Record<string,Awaited<ReturnType<typeof pixelEffectPackage>>>={};
for(const id of ['interaction-icon','inventory-barrel','signal-activation','pickup-sparkle']){
  const bundle=await pixelEffectPackage(await read(fixture+id+'.json'));
  bundles[id]=bundle;
  const path='packages/'+id;
  await writeEnvironmentPackage(join(directory,path),bundle);
  assert.deepEqual(await verifyPixelEffectPackage(join(directory,path)),bundle.manifest);
  for(const [name,bytes] of bundle.files)hashes[path+'/'+name]=sha256(bytes);
}
const scenes=[];
for(const item of reviewScenes){
  const ref=lock.scenes.find((s:{id:string})=>s.id===item.id);
  for(const light of ['day','night'] as const){
    const scene=await gameplay(item,light,ref.packages[light],bundles);
    assert.deepEqual(scene,await gameplay(item,light,ref.packages[light],bundles),'Gameplay composite differs between runs.');
    const path='gameplay/'+item.id+'-'+light+'/';
    await save(path+'before.png',scene.baseBytes);
    await png(path+'frames.png',scene.strip);
    await png(path+'peak.png',scene.peak);
    await png(path+'peak-4x.png',nearestNeighbor(scene.peak,4));
    await png(path+'focal.png',scene.focus);
    if(item.effect==='signal-activation'&&light==='night')await png(path+'reflection.png',scene.reflection);
    await save(path+'qa.json',json(scene.qa));
    scenes.push(scene.qa);
  }
}
const index={version:1,checkpoint:lock.checkpoint,assetPackages:Object.keys(bundles).length,gameplayCases:scenes.length,
  fileCount:Object.keys(hashes).length,sha256:{...hashes},cases:scenes.map(({id,light,effect,holdout,peak,anchor})=>({id,light,effect,holdout,peak,anchor}))};
await save('benchmark.json',json(index));
console.log('E6.4 · 4 UI/VFX packages · 6 scene cases · '+index.fileCount+' SHA-256');
