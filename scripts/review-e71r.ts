import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { parseArgs } from 'node:util';
import { pack } from '../src/core/palette/colors.ts';
import { makeRaster,nearestNeighbor,type Raster } from '../src/core/pixels/raster.ts';
import { decodePng,encodePng } from '../src/core/renderer/png.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { bondedFracture } from '../src/experiments/structure-quality/masonry.ts';
import { compareRuinStructure } from '../src/experiments/structure-quality/ruins.ts';
import { loadComposition } from '../src/generators/environment/composition.ts';
import { inspectPng,sha256 } from '../src/quality/raster.ts';

const {values:{publish,out}}=parseArgs({options:{publish:{type:'boolean'},out:{type:'string'}}});
assert.ok(!publish||!out);
const published='benchmarks/results/e72a/ruin-review/';
const root=publish?published:out??'benchmarks/results/run/e72a/ruin-review/';
const e71='benchmarks/results/e71/',e71r='benchmarks/results/e71r/';
const payloads:Record<string,string>={};
const evidence:Record<string,string>={};
const legend={actor:'#94e4bd',architectureOverlap:'#f9bb51',base:'scene RGB × 0.45'};
const suites=[
  {id:'r1',fixture:'benchmarks/fixtures/e63/r1-signal-entrance.json'},
  {id:'h1',fixture:'benchmarks/fixtures/e71/h1-switchback-depot.json'},
  {id:'h2',fixture:'benchmarks/fixtures/e71r/h2-culvert-lookout.json'},
] as const;
const variants=[];
async function save(file:string,bytes:Buffer){
  const path=join(root,file);
  await mkdir(dirname(path),{recursive:true});
  try{await writeFile(path,bytes,{flag:'wx'});}
  catch(e){
    if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
    assert.deepEqual(await readFile(path),bytes,file);
  }
  payloads[file]=sha256(bytes);
  return published+file;
}
async function png(file:string,raster:Raster){
  const bytes=encodePng(raster);
  assert.deepEqual(inspectPng(raster,bytes,raster),[]);
  return save(file,bytes);
}

function occlusionOverlay(frame:Raster,owners:{map:Int16Array;overlaps:Uint8Array},actors:readonly boolean[]){
  const raster=makeRaster(frame.w,frame.h);
  let actorPixels=0,architectureOverlap=0;
  for(let i=0;i<owners.map.length;i++){
    const offset=i*4;
    const actor=actors[owners.map[i]];
    if(actor){
      actorPixels++;
      raster.rgba.writeUInt32BE(pack(legend.actor),offset);
    }else if(owners.overlaps[i]){
      architectureOverlap++;
      raster.rgba.writeUInt32BE(pack(legend.architectureOverlap),offset);
    }else{
      for(let c=0;c<3;c++)raster.rgba[offset+c]=Math.round(frame.rgba[offset+c]*.45);
      raster.rgba[offset+3]=255;
    }
  }
  return {raster,actorPixels,architectureOverlap};
}

for(const milestone of [e71,e71r]){
  const index=JSON.parse(await readFile(milestone+'benchmark.json','utf8'));
  for(const [name,sha] of Object.entries(index.sha256))await pinnedFile({file:milestone+name,sha256:String(sha)});
}
for(const suite of suites){
  const input=await loadComposition(JSON.parse(await readFile(suite.fixture,'utf8')));
  for(const light of ['day','night'] as const){
    const bonded=compareRuinStructure(input,light,false,bondedFracture);
    const q=suite.id==='h2'?undefined:compareRuinStructure(input,light);
    const key=suite.id+'/'+light+'/';
    const historic=e71+'ruin/'+key;
    const current=e71r+key;
    const entries=[
      {variant:'production',prefix:q?historic+'current/':current+'control/',frame:bonded.control.scene.raster,
        owners:bonded.ownership.before,actors:bonded.ownership.actors,has4x:!!q},
      ...(q?[{variant:'q',prefix:historic+'candidate/',frame:q.edited.raster,owners:q.ownership.after,actors:q.ownership.actors,has4x:true}]:[]),
      {variant:'bonded',prefix:current+'bonded/',frame:bonded.edited.raster,owners:bonded.ownership.after,
        actors:bonded.ownership.actors,has4x:false}
    ];
    for(const entry of entries){
      const paths=Object.fromEntries(['native','flat','silhouette','material','contour','collision'].map(type=>[type,entry.prefix+type+'.png']));
      assert.deepEqual(decodePng(await readFile(paths.native)),entry.frame);
      const zoom=nearestNeighbor(entry.frame,4);
      const variantKey=key+entry.variant+'/';
      if(entry.has4x){
        paths.nearest4x=entry.prefix+'native-4x.png';
        assert.deepEqual(decodePng(await readFile(paths.nearest4x)),zoom);
      }else paths.nearest4x=await png(variantKey+'native-4x.png',zoom);
      const occlusion=occlusionOverlay(entry.frame,entry.owners,entry.actors);
      assert.equal(occlusion.actorPixels,bonded.qa.actors.reduce((total,row)=>total+row.after,0));
      paths.occlusion=await png(variantKey+'occlusion.png',occlusion.raster);
      for(const file of Object.values(paths)){
        if(!file.startsWith(published))evidence[file]=sha256(await readFile(file));
      }
      variants.push({layout:suite.id,light,variant:entry.variant,paths,
        overlap:{actorVisible:occlusion.actorPixels,architectureAboveAnotherLayer:occlusion.architectureOverlap}});
    }
  }
}
await save('index.json',Buffer.from(JSON.stringify({version:1,checkpoint:'ee8a4c9',variants,legend,sourceSha256:evidence,sha256:payloads},null,2)+'\n'));
console.log('E7.1R review pack · 16 scene variants · 16 occlusion overlays · 8 additional 4× PNGs.');
