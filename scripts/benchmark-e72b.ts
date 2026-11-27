import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { parseArgs } from 'node:util';
import { nearestNeighbor,type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { compareStone } from '../src/experiments/stone-material.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { loadComposition } from '../src/generators/environment/composition.ts';
import { inspectPng,sha256 } from '../src/quality/raster.ts';

const {values:{publish,out}}=parseArgs({options:{publish:{type:'boolean'},out:{type:'string'}}});
assert.ok(!publish||!out);
const root=publish?'benchmarks/results/e72b':out??'benchmarks/results/run/e72b';
const fixture='benchmarks/fixtures/e72b/';
const sha:Record<string,string>={};
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
const json=(file:string,value:unknown)=>save(file,Buffer.from(JSON.stringify(value,null,2)+'\n'));
async function png(file:string,raster:Raster){
  const bytes=encodePng(raster);
  assert.deepEqual(inspectPng(raster,bytes,raster),[],file);
  await save(file+'.png',bytes);
}

type Reference={file:string;sha256:string};
type Baseline={id:string;source:Reference;lights:Record<string,Record<string,Reference>>};
const lockRef={file:fixture+'production-lock.json',sha256:'7b4c1663ec935c5808b56819998048c8875a515c4669ae8a4c22a06419441c82'};
const holdoutRef={file:fixture+'holdout-lock.json',sha256:'1cfe539d65ba4dd924010df41373b49b6ce9e2369c2292e11f4a5872efc1c3bf'};
const lock=JSON.parse((await pinnedFile(lockRef)).toString('utf8')) as {checkpoint:string;style:Reference;scenes:Baseline[]};
const holdout=JSON.parse((await pinnedFile(holdoutRef)).toString('utf8')) as {
  spec:Reference;derivedFrom:Reference;seed:number;style:string;controls:{canvas:number[];camera:string;lighting:string[]}
};
await pinnedFile(lock.style);
await pinnedFile(holdout.derivedFrom);

const cases=[];
for(const [id,source,control] of [...lock.scenes.map(s=>[s.id,s.source,s.lights] as const),
  ['h3',holdout.spec,undefined] as const]){
  const input=await loadComposition(JSON.parse((await pinnedFile(source)).toString('utf8')));
  assert.equal(input.spec.source.styleSha256,lock.style.sha256);
  assert.equal(input.environment.style.view,holdout.controls.camera);
  assert.deepEqual(input.spec.size,holdout.controls.canvas);
  if(id==='h3')assert.equal(input.spec.seed,holdout.seed);
  const regionOrder=[...input.spec.ruins!.modules].filter(module=>module.kind==='wall').sort((a,b)=>a.at[0]-b.at[0]);
  const crops=regionOrder.map(module=>{
    const [x,y]=module.at,height=module.height+Math.ceil(module.depth/2);
    const top=Math.max(0,y-height-4),left=Math.max(0,x-5);
    const right=Math.min(input.spec.size[0],x+module.width+module.depth+5);
    return {id:module.id,rect:[left,top,right-left,Math.min(input.spec.size[1],y+4)-top]};
  });
  let dayStructure;
  for(const light of ['day','night'] as const){
    const {baseline,edited,flat,qa}=compareStone(input,light);
    assert.equal(qa.camera.sampling,'nearest');
    assert.equal(qa.camera.view,holdout.controls.camera);
    const {scene}=baseline;
    // Color can differ across light passes. Alpha, ownership and collision cannot.
    if(light==='day')dayStructure=qa.structure;
    else assert.deepEqual(qa.structure,dayStructure);
    const s0={native:scene.raster,material:scene.materialMask};
    const s1={native:edited.raster,material:edited.material};
    const shared={flat:flat.raster,silhouette:scene.architectureSilhouette!,collision:scene.collisionPlane,
      planes:edited.planeMask,'rgba-diff':edited.diff};
    if(control){
      const expected=control[light];
      for(const [name,raster] of Object.entries({...s0,flat:shared.flat,silhouette:shared.silhouette,collision:scene.collisionOverlay})){
        assert.deepEqual(encodePng(raster),await pinnedFile(expected[name]),id+' '+light+' '+name+' baseline differs.');
      }
    }
    for(let i=0;i<s0.native.rgba.length;i+=4){
      assert.equal(s0.native.rgba[i+3],s1.native.rgba[i+3]);
      if(!edited.diff.rgba[i+3]){
        assert.equal(s0.native.rgba.readUInt32BE(i),s1.native.rgba.readUInt32BE(i));
        assert.equal(s0.material.rgba.readUInt32BE(i),s1.material.rgba.readUInt32BE(i));
      }
    }
    const path=id+'/'+light+'/';
    for(const [variant,images] of [['s0',s0],['s1',s1]] as const){
      await png(path+variant+'/native',images.native);
      await png(path+variant+'/native-4x',nearestNeighbor(images.native,4));
      await png(path+variant+'/material',images.material);
    }
    for(const [name,raster] of Object.entries(shared))await png(path+name,raster);
    await json(path+'qa.json',{id,name:input.spec.name,seed:input.spec.seed,light,source,crops,
      role:id==='h3'?'holdout':'development',technical:'PASS',art:'PENDING_HUMAN_REVIEW',...qa});
    cases.push({id,light,seed:input.spec.seed,source,qa:path+'qa.json',crops,changedByWall:qa.changedByWall});
  }
}
await json('benchmark.json',{version:1,checkpoint:lock.checkpoint,rule:'production-plane-weathering',
  production:lockRef,holdout:holdoutRef,cases,payloads:Object.keys(sha).length,sha256:sha,art:'PENDING_HUMAN_REVIEW'});
console.log('E7.2-B · 3 layouts × Day/Night · 66 PNGs · 6 QA records.');
