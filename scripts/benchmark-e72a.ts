import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { parseArgs } from 'node:util';
import { pack,unpack,inkLuma } from '../src/core/palette/colors.ts';
import { blit,makeRaster,nearestNeighbor,type Raster } from '../src/core/pixels/raster.ts';
import { decodePng,encodePng } from '../src/core/renderer/png.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { renderRelay } from '../src/experiments/structure-quality/relay.ts';
import { materialLegend } from '../src/generators/environment/kit.ts';
import { inspectPng,sha256 } from '../src/quality/raster.ts';
import { artStyleProfileSchema } from '../src/specs/environment.ts';

const {values:{publish,out}}=parseArgs({options:{publish:{type:'boolean'},out:{type:'string'}}});
assert.ok(!publish||!out);
const root=publish?'benchmarks/results/e72a':out??'benchmarks/results/run/e72a';
const fixture='benchmarks/fixtures/e72a/';
const sha:Record<string,string>={};
async function save(file:string,data:Buffer) {
  const path=join(root,file);
  await mkdir(dirname(path),{recursive:true});
  try{await writeFile(path,data,{flag:'wx'});}
  catch(error){
    if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
    assert.deepEqual(await readFile(path),data,file+' differs from the independently rendered bytes.');
  }
  sha[file]=sha256(data);
}
const json=(file:string,value:unknown)=>save(file,Buffer.from(JSON.stringify(value,null,2)+'\n'));
async function png(file:string,raster:Raster){
  const bytes=encodePng(raster);
  assert.deepEqual(inspectPng(raster,bytes,raster),[],file);
  await save(file+'.png',bytes);
}
const lock=JSON.parse((await pinnedFile({file:fixture+'a1-lock.json',
  sha256:'639fd39f12ea43a5cfc32fe5599a501eb411274d0cc760d4944d94d5faf477bc'})).toString());
const holdout=JSON.parse((await pinnedFile({file:fixture+'holdout-lock.json',
  sha256:'363695b2c0e9033c4a81033e9b811ee939b054b9a5231d586bd0ba7502253d3d'})).toString());
const loadSpec=async(ref:{file:string;sha256:string})=>JSON.parse((await pinnedFile(ref)).toString());
const style=artStyleProfileSchema.parse(await loadSpec(lock.style));
const theme=style.illumination.day;
const bright=theme.surfaces.paving[3],dark=theme.surfaces.roof[0];
const roles=new Map(Object.entries(materialLegend).map(([role,ink])=>[pack(ink),role]));
const ramps=new Map(Object.entries(theme.surfaces).map(([role,inks])=>[role,new Set<number>(inks.map(pack))]));
ramps.set('contour',new Set([pack(theme.contour)]));

function clusters(raster:Raster,material:Raster){
  const {w,h}=raster;
  const seen=new Uint8Array(w*h);
  const result:Record<string,{pixels:number;counts:number[];isolated:number;tones:Record<string,number>}>={};
  for(let i=0;i<w*h;i++){
    const ink=raster.rgba.readUInt32BE(i*4),mask=material.rgba.readUInt32BE(i*4);
    assert.equal(ink&255,mask&255,'Material mask alpha differs from the sprite.');
    if(!ink)continue;
    const role=roles.get(mask);
    assert.ok(role&&ramps.get(role)?.has(ink),'Pixel ink is outside its material role ramp.');
    const record=result[role]??={pixels:0,counts:[],isolated:0,tones:{}};
    record.pixels++;
    const color=unpack(ink);
    record.tones[color]=(record.tones[color]??0)+1;
    if(seen[i])continue;
    const queue=[i];seen[i]=1;
    for(const position of queue){
      const x=position%w,y=Math.floor(position/w);
      for(const [u,v] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
        const at=v*w+u;
        if(u>=0&&v>=0&&u<w&&v<h&&!seen[at]&&raster.rgba.readUInt32BE(at*4)===ink&&material.rgba.readUInt32BE(at*4)===mask){
          seen[at]=1;queue.push(at);
        }
      }
    }
    record.counts.push(queue.length);
    if(queue.length===1)record.isolated++;
  }
  for(const record of Object.values(result))record.counts.sort((a,b)=>b-a);
  return result;
}

function background(sprite:Raster,color:string){
  const frame=makeRaster(sprite.w,sprite.h);
  for(let i=0;i<frame.rgba.length;i+=4)frame.rgba.writeUInt32BE(pack(color),i);
  blit(frame,sprite,0,0);
  return frame;
}

for(const [id,ref] of [['relay',lock.spec],['receiver',holdout.spec]] as const){
  const raw=await loadSpec(ref);
  const m0=await renderRelay(raw,'a1'),m1=await renderRelay(raw,'a1','readout');
  assert.deepEqual(m0.structure,m1.structure);
  assert.deepEqual(m0.flat,m1.flat);
  assert.deepEqual(m0.mask,m1.mask);
  assert.equal(m0.spec.seed,id==='relay'?lock.seed:holdout.seed);
  if(id==='relay'){
    const historical=await loadSpec(lock.geometry);
    assert.deepEqual(m0.structure,lock.projectedGeometry);
    assert.deepEqual(m0.structure.contact,lock.pivot);
    assert.deepEqual(m0.structure,historical.structuralIntent);
    assert.deepEqual(m0.spec.placement,lock.place);
    assert.deepEqual(m0.spec.sourceStyle,lock.style);
    assert.equal(m0.stat.alphaSha256,lock.alphaSha256);
    assert.deepEqual([m0.final.w,m0.final.h],lock.canvas);
    assert.equal(style.view,lock.camera);
    assert.equal(style.keyLight,lock.keyLight);
    for(const [raster,reference] of [[m0.final,lock.rgba],[m0.flat,lock.flat],[m0.mask,lock.silhouette],
      [m0.material,lock.material],[m0.inScene,lock.context]] as const){
      const original=await pinnedFile(reference);
      assert.deepEqual(decodePng(original),raster);
      assert.deepEqual(encodePng(raster),original,'M0 did not reproduce the locked PNG.');
    }
  }

  const overlay=makeRaster(m0.final.w,m0.final.h);
  let colors=0,roleChanges=0,lumaMax=0;
  for(let i=0;i<m0.final.rgba.length;i+=4){
    const a=m0.final.rgba.readUInt32BE(i),b=m1.final.rgba.readUInt32BE(i);
    assert.equal(a&255,b&255,'Refinement changed a locked alpha pixel.');
    const roleChange=m0.material.rgba.readUInt32BE(i)!==m1.material.rgba.readUInt32BE(i);
    if(roleChange)roleChanges++;
    if(a!==b){
      colors++;
      lumaMax=Math.max(lumaMax,Math.abs(inkLuma(a)-inkLuma(b)));
    }
    if(b)overlay.rgba.writeUInt32BE(pack(roleChange?'#f9bb51':a!==b?'#94e4bd':'#303443'),i);
  }
  assert.ok(colors>0&&roleChanges>0&&roleChanges<m0.stat.coverage);
  const left=m0.spec.placement.pivot[0]-m0.structure.contact[0];
  const top=m0.spec.placement.pivot[1]-m0.structure.contact[1];
  const expectedScene=Buffer.from(m0.inScene.rgba);
  for(let y=0;y<m1.final.h;y++)for(let x=0;x<m1.final.w;x++){
    const source=(y*m1.final.w+x)*4;
    if(m1.final.rgba[source+3])m1.final.rgba.copy(expectedScene,((top+y)*m1.inScene.w+left+x)*4,source,source+4);
  }
  assert.deepEqual(m1.inScene.rgba,expectedScene,'C1 differs outside the locked sprite at its anchored position.');
  for(const [variant,frame] of [['m0',m0],['m1',m1]] as const){
    const path=id+'/'+variant+'/';
    for(const [name,raster] of Object.entries({native:frame.final,'native-4x':nearestNeighbor(frame.final,4),
      material:frame.material,bright:background(frame.final,bright),dark:background(frame.final,dark),context:frame.inScene})){
      await png(path+name,raster);
    }
  }
  await png(id+'/flat',m0.flat);
  await png(id+'/silhouette',m0.mask);
  await png(id+'/rgba-diff',overlay);
  await json(id+'/qa.json',{id,label:m0.spec.label,seed:m0.spec.seed,holdout:id==='receiver',
    canvas:[m0.final.w,m0.final.h],structure:m0.structure,alphaSha256:m0.stat.alphaSha256,placement:m0.spec.placement,
    style:m0.spec.sourceStyle,camera:style.view,light:style.keyLight,ramps:theme.surfaces,backgrounds:{bright,dark},
    diff:{rgbaPixels:colors,rolePixels:roleChanges,alphaPixels:0,maxLumaDelta:lumaMax},
    m0:{...m0.stat,clusters:clusters(m0.final,m0.material)},m1:{...m1.stat,clusters:clusters(m1.final,m1.material)},
    art:'PENDING_HUMAN_REVIEW'});
}
await json('benchmark.json',{version:1,checkpoint:'ee8a4c9',rule:'readout',holdout:holdout.spec,
  count:Object.keys(sha).length,sha256:sha,art:'PENDING_HUMAN_REVIEW'});
console.log('E7.2-A · Relay A1 and frozen Receiver · 30 PNGs · 2 diagnostic records.');
