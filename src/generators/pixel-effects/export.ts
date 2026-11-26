import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { chestColors,inkLuma,pack,unpack } from '../../core/palette/colors.ts';
import { blit,makeRaster,nearestNeighbor,silhouette,type Raster } from '../../core/pixels/raster.ts';
import { decodePng,encodePng } from '../../core/renderer/png.ts';
import { inspectPng,sha256 } from '../../quality/raster.ts';
import { artStyleProfileSchema } from '../../specs/environment.ts';
import { uiSpecSchema,vfxSpecSchema } from '../../specs/pixel-effects.ts';
import { unpackAnimationStrip } from '../character/animation-export.ts';
import { renderUi } from './ui.ts';
import { renderVfx,sampleEffect } from './vfx.ts';

const specSchema=z.union([uiSpecSchema,vfxSpecSchema]);
const json=(value:unknown)=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const alpha=(r:Raster,i:number)=>r.rgba[4*i+3]===255;
export async function checkedFile(ref:{file:string;sha256:string}){
  const data=await readFile(ref.file);
  assert.equal(sha256(data),ref.sha256,ref.file+' provenance mismatch.');
  return data;
}

function examine(raster:Raster,legal:ReadonlySet<number>){
  const {w,h,rgba}=raster, used=new Map<number,number>();
  let left=w,top=h,right=-1,bottom=-1;
  const visited=new Uint8Array(w*h),components:number[]=[];
  for(let i=0;i<w*h;i++){
    const ink=rgba.readUInt32BE(i*4);
    assert.ok(ink===0 || (rgba[i*4+3]===255&&legal.has(ink)),'Bad alpha, transparent RGB or unauthorized ink.');
    if(!ink)continue;
    const x=i%w,y=Math.floor(i/w);
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    used.set(ink,(used.get(ink)??0)+1);
    if(visited[i])continue;
    const queue=[i];
    visited[i]=1;
    for(const a of queue){
      const x=a%w,y=Math.floor(a/w);
      for(const [u,v] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
        if(u<0||v<0||u>=w||v>=h)continue;
        const at=v*w+u;
        if(!visited[at]&&alpha(raster,at)){visited[at]=1;queue.push(at);}
      }
    }
    components.push(queue.length);
  }
  return {coverage:[...used.values()].reduce((n,m)=>n+m,0),bounds:right<0?null:{left,top,right,bottom},
    components:components.sort((a,b)=>b-a),
    colors:Object.fromEntries([...used].sort(([a],[b])=>a-b).map(([ink,n])=>[unpack(ink),n])),
    rgbaSha256:sha256(rgba),alphaSha256:sha256(silhouette(raster,pack('#ffffff')).rgba)};
}

function barrelSignature(raster:Raster,iron:readonly string[]){
  const metal=new Set(iron.map(pack)), bands: number[][]=[];
  const width:number[]=[];
  for(let y=0;y<raster.h;y++){
    let count=0, rowWidth=0;
    for(let x=0;x<raster.w;x++){
      const i=y*raster.w+x;
      if(alpha(raster,i))rowWidth++;
      if(metal.has(raster.rgba.readUInt32BE(i*4)))count++;
    }
    if(rowWidth)width.push(rowWidth);
    if(count<9)continue;
    if(bands.at(-1)?.at(-1)===y-1)bands.at(-1)!.push(y);
    else bands.push([y]);
  }
  assert.equal(bands.length,2,'A readable barrel retains both metal hoops.');
  assert.ok(width[0]<Math.max(...width)-5 && width.at(-1)!<Math.max(...width)-5,'Barrel contour loses its rounded ends.');
  return {bands,endWidths:[width[0],width.at(-1)],widest:Math.max(...width)};
}

function measureEdges(a:Raster,b:Raster){
  let overlap=0,added=0,removed=0,changed=0;
  for(let i=0;i<a.w*a.h;i++){
    if(alpha(a,i)&&alpha(b,i))overlap++;
    if(alpha(a,i)&&!alpha(b,i))removed++;
    if(!alpha(a,i)&&alpha(b,i))added++;
    if(a.rgba.readUInt32BE(4*i)!==b.rgba.readUInt32BE(4*i))changed++;
  }
  return {overlap,added,removed,changed};
}

export async function pixelEffectPackage(raw:unknown) {
  const spec=specSchema.parse(raw);
  const styleBytes=await checkedFile(spec.style);
  const style=artStyleProfileSchema.parse(JSON.parse(styleBytes.toString('utf8')));
  const source='source' in spec?await checkedFile(spec.source):undefined;
  const isVfx='frames' in spec;
  const render=()=>isVfx?renderVfx(spec,style):renderUi(spec,style);
  const art=render(),repeat=render();
  assert.deepEqual(art,repeat,'Non-deterministic pixel effect.');
  const palette=new Set(Object.values(art.ramp).map(pack));
  const [w,h]=spec.size, sheet=makeRaster(w*art.frames.length,h);
  const files=new Map<string,Buffer>();
  function addPng(file:string,raster:Raster){
    const bytes=encodePng(raster);
    assert.deepEqual(inspectPng(raster,bytes,raster),[],file);
    files.set(file,bytes);
  }
  const frames=art.frames.map((f,index)=>{
    assert.deepEqual([f.raster.w,f.raster.h],[w,h]);
    const stats=examine(f.raster,palette);
    blit(sheet,f.raster,index*w,0);
    addPng('frame-'+index+'.png',f.raster);
    return {id:f.id,rect:{x:index*w,y:0,w,h},...('durationMs' in f?{durationMs:(f as {durationMs:number}).durationMs}:{}),...stats};
  });
  const transitions=art.frames.slice(1).map((f,i)=>measureEdges(art.frames[i].raster,f.raster));
  const detail:Record<string,unknown>={};
  if(isVfx){
    assert.equal(frames.at(-1)!.coverage,0,'The final frame must clear the scene.');
    assert.ok(frames.slice(0,-1).every(f=>f.coverage>0&&f.components.at(-1)!>=2),'Detached single-pixel particles or empty active frame.');
    assert.ok(transitions.slice(0,-1).every(t=>t.overlap>0),'Adjacent active frames should share a deliberate cluster.');
    const peak=frames.find(f=>f.id==='peak')!;
    assert.equal(peak.coverage,Math.max(...frames.map(f=>f.coverage)),'Activation peak should have the largest energy cluster.');
    const keys=Object.values(art.ramp).map(x=>inkLuma(pack(x)));
    assert.ok(keys.every((v,i)=>i===0||v>keys[i-1]),'Bad effect ramp ordering.');
    assert.ok((peak.colors[Object.values(art.ramp).at(-1)!]??0)>0,'The brightest ink should mark the peak.');
    const total=spec.frames.reduce((n,f)=>n+f.durationMs,0);
    let start=0;
    for(const [i,f] of spec.frames.entries()){
      assert.equal(sampleEffect(spec.frames,start,'once'),i);
      assert.equal(sampleEffect(spec.frames,start+f.durationMs-1,'repeat'),i);
      start+=f.durationMs;
    }
    assert.equal(sampleEffect(spec.frames,total,'once'),null);
    assert.equal(sampleEffect(spec.frames,total,'repeat'),0);
    detail.timing={loops:spec.loop,totalMs:total,clearTailMs:spec.frames.at(-1)!.durationMs,onceAtEnd:null,repeatAtEnd:0};
    files.set('timing.json',json({version:1,kind:'lumasprite-vfx-timing',name:spec.name,pivot:art.pivot,
      canvas:{w,h},sampling:'nearest',loop:spec.loop,totalDurationMs:total,
      frames:frames.map(({id,rect,rgbaSha256},i)=>({phase:id,durationMs:spec.frames[i].durationMs,rect,rgbaSha256}))}));
  }else if(spec.kind==='inventory-icon'){
    const approved=decodePng(source!);
    assert.equal(approved.w,32);
    assert.equal(approved.h,32);
    assert.notDeepEqual(approved,art.frames[0].raster,'Inventory icon must be redrawn.');
    const sourceSignature=barrelSignature(approved,[chestColors.ironShadow,chestColors.iron,chestColors.ironLight]);
    const ink=style.illumination.day.surfaces.metal;
    const iconSignature=barrelSignature(art.frames[0].raster,[ink[0],ink[1],ink[3]]);
    assert.equal(frames[0].components.length,1);
    detail.recognition={item:'E2.4 tall barrel',source:sourceSignature,icon:iconSignature,
      design:'rounded wooden body, lid and two bands',method:'redrawn at 32×32'};
  }else{
    assert.equal(frames[0].alphaSha256,frames[1].alphaSha256,'Normal and Active should keep their anchor and silhouette.');
    assert.equal(frames[0].components.length,1);
    assert.ok(transitions[0].changed>=26,'Interaction states must read as distinct.');
    detail.panelGlyphLumaGap=inkLuma(pack(style.illumination.day.surfaces.amber[3]))-inkLuma(pack(style.illumination.day.surfaces.metal[0]));
  }
  if(!isVfx)files.set('states.json',json({version:1,canvas:{w,h},pivot:art.pivot,sampling:'nearest',
    states:frames.map(({id,rect,rgbaSha256})=>({id,rect,rgbaSha256}))}));
  addPng('spritesheet.png',sheet);
  addPng('spritesheet-4x.png',nearestNeighbor(sheet,4));
  addPng('alpha.png',silhouette(sheet,pack('#edf6e9')));
  const cells=unpackAnimationStrip(decodePng(files.get('spritesheet.png')!),{canvas:{w,h},frames});
  assert.deepEqual(cells,art.frames.map(f=>f.raster));
  files.set('spec.json',json(spec));
  files.set('qa.json',json({native:[w,h],pivot:art.pivot,alpha:'binary',sampling:'nearest',ramp:art.ramp,frames,transitions,...detail}));
  const manifest={version:1,kind:'lumasprite-pixel-effect',id:spec.id,family:isVfx?'vfx':'ui',style:spec.style,
    ...('source' in spec?{source:spec.source}:{}),review:'HUMAN_ART_REVIEW_PENDING',
    files:Object.fromEntries([...files].map(([file,bytes])=>[file,sha256(bytes)]))};
  files.set('manifest.json',json(manifest));
  return {spec,art,manifest,files,frames};
}
export async function verifyPixelEffectPackage(folder:string){
  const rebuilt=await pixelEffectPackage(JSON.parse((await readFile(join(folder,'spec.json'))).toString('utf8')));
  assert.deepEqual((await readdir(folder)).sort(),[...rebuilt.files.keys()].sort());
  for(const [file,bytes] of rebuilt.files)assert.deepEqual(await readFile(join(folder,file)),bytes,file+' differs from deterministic generation.');
  return rebuilt.manifest;
}
