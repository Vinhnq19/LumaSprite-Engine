import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { parseArgs } from 'node:util';
import { pack } from '../src/core/palette/colors.ts';
import { makeRaster,nearestNeighbor,type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { compareStone } from '../src/experiments/stone-material.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { loadComposition } from '../src/generators/environment/composition.ts';
import { inspectPng,sha256 } from '../src/quality/raster.ts';

const {values:{publish,out}}=parseArgs({options:{publish:{type:'boolean'},out:{type:'string'}}});
assert.ok(!publish||!out);
const root=publish?'benchmarks/results/e72r':out??'benchmarks/results/run/e72r';
const newPrefix='benchmarks/results/e72r/';
const oldPrefix='benchmarks/results/e72b/';
const sha:Record<string,string>={},sourceSha256:Record<string,string>={};
async function save(file:string,data:Buffer){
  const path=join(root,file);
  await mkdir(dirname(path),{recursive:true});
  try{await writeFile(path,data,{flag:'wx'});}
  catch(error){
    if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
    assert.deepEqual(await readFile(path),data,file+' differs from the published evidence.');
  }
  sha[file]=sha256(data);
}
const json=(file:string,data:unknown)=>save(file,Buffer.from(JSON.stringify(data,null,2)+'\n'));
async function png(path:string,raster:Raster,expected?:string){
  const data=encodePng(raster),file=path+'.png';
  assert.deepEqual(inspectPng(raster,data,raster),[],file);
  if(expected){
    const original=oldPrefix+file;
    assert.deepEqual(await pinnedFile({file:original,sha256:expected}),data,'S0/S1 baseline mismatch.');
    sourceSha256[original]=expected;
    return original;
  }
  await save(file,data);
  return newPrefix+file;
}

type Reference={file:string;sha256:string};
type Crop={id:string;rect:number[]};
type Case={id:string;light:'day'|'night';seed:number;source:Reference;qa:string;crops:Crop[]};
const checkpoint='ff101af29617f7b80d6f5aab03da31a06e754939';
const deliverable={file:oldPrefix+'benchmark.json',sha256:'b2590b416d83711883858f4254e0945d170ad004bb4347c28f0795bfce96bffc'};
const prior=JSON.parse((await pinnedFile(deliverable)).toString()) as {payloads:number;cases:Case[];sha256:Record<string,string>};
assert.equal(prior.payloads,72);
const lockRef={file:'benchmarks/fixtures/e72r/holdout-lock.json',sha256:'664312a38d1cb69712ad2f632de86f548c90449eb356cf86e20c37eed2c445f5'};
const rule={file:'src/experiments/stone-material.ts',sha256:'726c819862151e3c64897d73c86fadb811b283ad9261d93ad9f7ac00b26438f6'};
await pinnedFile(rule);
const lock=JSON.parse((await pinnedFile(lockRef)).toString()) as {
  source:Reference;derivedFrom:Reference;seed:number;style:string;controls:{size:number[];view:string};
};
await pinnedFile(lock.derivedFrom);
const cases=[];
for(const id of ['r1','h1','h3','h4']){
  const isHoldout=id==='h4';
  const previous=prior.cases.filter(row=>row.id===id);
  const source=isHoldout?lock.source:previous[0].source;
  const input=await loadComposition(JSON.parse((await pinnedFile(source)).toString()));
  assert.equal(input.spec.source.styleSha256,lock.style);
  assert.equal(input.spec.seed,isHoldout?lock.seed:previous[0].seed);
  assert.deepEqual(input.spec.size,lock.controls.size);
  assert.equal(input.environment.style.view,lock.controls.view);
  const crops=previous[0]?.crops??input.spec.ruins!.modules.filter(m=>m.kind==='wall').sort((a,b)=>a.at[0]-b.at[0]).map(module=>{
    const [x,y]=module.at,left=Math.max(0,x-5),top=Math.max(0,y-module.height-Math.ceil(module.depth/2)-4);
    return {id:module.id,rect:[left,top,Math.min(input.spec.size[0],x+module.width+module.depth+5)-left,
      Math.min(input.spec.size[1],y+4)-top]};
  });
  let dayStructure;
  for(const light of ['day','night'] as const){
    const s1=compareStone(input,light);
    const s2=compareStone(input,light,'s2');
    assert.deepEqual(s1.qa.structure,s2.qa.structure,'World geometry or ownership changed.');
    assert.deepEqual(s1.qa.camera,s2.qa.camera);
    assert.deepEqual(s1.qa.palette,s2.qa.palette);
    assert.deepEqual(s1.flat.raster,s2.flat.raster);
    if(light==='day')dayStructure=s2.qa.structure;
    else assert.deepEqual(dayStructure,s2.qa.structure);
    const {scene}=s1.baseline;
    const diff=makeRaster(scene.raster.w,scene.raster.h), features=s2.edited.features!;
    const tones={structural:pack('#f5c687'),material:pack('#94e4bd')};
    const visible={structural:0,material:0};
    let touched=0;
    for(let i=0;i<diff.rgba.length;i+=4){
      const rgba=s2.edited.raster.rgba.readUInt32BE(i),prior=s1.edited.raster.rgba.readUInt32BE(i);
      const role=s2.edited.material.rgba.readUInt32BE(i),priorRole=s1.edited.material.rgba.readUInt32BE(i);
      assert.equal(rgba&255,scene.raster.rgba[i+3]);
      assert.equal(role&255,rgba&255);
      if(rgba!==prior||role!==priorRole){
        const classInk=features.rgba.readUInt32BE(i);
        assert.ok(classInk===tones.structural||classInk===tones.material);
        if(classInk===tones.structural)visible.structural++;
        else visible.material++;
        diff.rgba.writeUInt32BE(classInk,i);
        touched++;
      }
    }
    assert.ok(touched>0);
    const path=id+'/'+light+'/';
    const lockedFile=(name:string)=>isHoldout?undefined:prior.sha256[path+name+'.png'];
    const common:Record<string,string>={};
    for(const [name,raster] of Object.entries({flat:s1.flat.raster,silhouette:scene.architectureSilhouette!,
      collision:scene.collisionPlane,planes:s1.edited.planeMask})){
      const digest=lockedFile(name);
      if(!isHoldout)assert.ok(digest);
      common[name]=await png(path+name,raster,digest);
    }
    common.treatments=await png(path+'treatments',features);
    common.diff=await png(path+'s1-s2-diff',diff);
    const variants:Record<string,Record<string,string>>={};
    for(const [variant,raster,material] of [['s0',scene.raster,scene.materialMask],['s1',s1.edited.raster,s1.edited.material],
      ['s2',s2.edited.raster,s2.edited.material]] as const){
      const paths:Record<string,string>={};
      for(const [layer,img] of Object.entries({native:raster,'native-4x':nearestNeighbor(raster,4),material})){
        const name=variant+'/'+layer;
        const digest=variant==='s2'?undefined:lockedFile(name);
        if(!isHoldout&&variant!=='s2')assert.ok(digest);
        paths[layer]=await png(path+name,img,digest);
      }
      variants[variant]=paths;
    }
    const qaPath=path+'qa.json';
    await json(qaPath,{id,name:input.spec.name,light,seed:input.spec.seed,source,
      caseRole:isHoldout?'frozen-holdout':id==='h3'?'known-diagnostic':'development',
      changedFromS1:touched,visibleFootprint:visible,
      structure:s2.qa.structure,camera:s2.qa.camera,palette:s2.qa.palette,planes:s2.qa.planeLegend,
      walls:s2.qa.walls.map((wall,i)=>({id:wall.id,refinement:wall.refinement,
        stone:[s1.qa.walls[i].clusters.before.stone,s1.qa.walls[i].clusters.after.stone,wall.clusters.after.stone],
        moss:[s1.qa.walls[i].clusters.before.moss,s1.qa.walls[i].clusters.after.moss,wall.clusters.after.moss],
        detail:[wall.baseline.detail, s1.qa.walls[i].candidate.detail,wall.candidate.detail]})),
      technical:'PASS',art:'PENDING_HUMAN_REVIEW'});
    cases.push({id,light,seed:input.spec.seed,source,crops,variants,common,qa:qaPath});
  }
}
await json('benchmark.json',{version:1,checkpoint,rule,prior:deliverable,holdout:lockRef,cases,
  payloads:Object.keys(sha).length,sha256:sha,sourceSha256,art:'PENDING_HUMAN_REVIEW'});
console.log('E7.2-R · R1/H1 development, H3 diagnostic, frozen H4 · '+(Object.keys(sha).length-1)+' payloads.');
