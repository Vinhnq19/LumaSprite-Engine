import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { parseArgs } from 'node:util';
import { blit,makeRaster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { anchoredScene,loadComposition,pointSweep,spatialProbe,type Composition } from '../src/generators/environment/composition.ts';
import { compositionPackage,verifyCompositionPackage } from '../src/generators/environment/composition-export.ts';
import { writeEnvironmentPackage } from '../src/generators/environment/export.ts';
import { covered } from '../src/generators/environment/refinement.ts';
import { inspectPng,sha256 } from '../src/quality/raster.ts';

const {values:{publish,out}}=parseArgs({options:{publish:{type:'boolean'},out:{type:'string'}}});
if(publish && out)throw new Error('Use --publish or --out.');
const root=publish?'benchmarks/results/e63':out??'benchmarks/results/run/e63';
const fixtures='benchmarks/fixtures/e63/';
const e62='benchmarks/results/e62/';
const entries:Record<string,string>={};
const json=(value:unknown)=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const read=async(path:string)=>JSON.parse((await readFile(path)).toString('utf8'));
const load=async(id:string)=>loadComposition(await read(fixtures+id+'.json'));
async function save(path:string,bytes:Buffer){
  const file=join(root,path);
  await mkdir(dirname(file),{recursive:true});
  try{await writeFile(file,bytes,{flag:'wx'});}
  catch(error){
    if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
    assert.deepEqual(await readFile(file),bytes,file+' differs. Use a fresh output folder.');
  }
  entries[path]=sha256(bytes);
}
async function verifyIndex(edition:string,count:number){
  const lines=(await readFile('benchmarks/results/'+edition+'/SHA256SUMS','utf8')).trim().split(/\r?\n/);
  assert.equal(lines.length,count);
  for(const row of lines){
    const [hash,file]=row.split('  ');
    assert.equal(sha256(await readFile(file)),hash,file);
  }
}
const lock=await read(fixtures+'e62-composition-lock.json');
for(const [path,digest] of Object.entries(lock.files))assert.equal(sha256(await readFile(path)),digest,path);
await verifyIndex('e61r',109);
await verifyIndex('e62',100);

async function writePackage(input:Composition,light:'day'|'night'){
  const bundle=compositionPackage(input,light), dest='packages/'+input.spec.id+'-'+light;
  await writeEnvironmentPackage(join(root,dest),bundle);
  assert.deepEqual(await verifyCompositionPackage(join(root,dest)),bundle.manifest);
  for(const [path,bytes] of bundle.files)entries[dest+'/'+path]=sha256(bytes);
  return bundle;
}
const c2=await loadComposition(await read('benchmarks/fixtures/e62/c2-supply-stop.json'));
const before=compositionPackage(c2,'night');
for(const [file,bytes] of before.files)assert.deepEqual(bytes,await readFile(e62+'packages/c2-supply-stop-night/'+file),file);
const quality=await load('c2-night-quality'), after=await writePackage(quality,'night');
const comparable=(spec:Composition['spec'])=>({...spec,id:'c2',name:'c2',lighting:{...spec.lighting,fill:[]}});
const beforeSettings=comparable(c2.spec), afterSettings=comparable(quality.spec);
assert.deepEqual(beforeSettings,afterSettings,'Only the night fill can change in the C2 closeout.');
const project=(x:typeof before.view)=>x.scene.metadata.occlusion.filter(a=>a.kind==='actor');
const contrast=project(before.view).map((old,i)=>{
  const next=project(after.view)[i];
  assert.ok(next.p10LumaGap!>old.p10LumaGap!);
  assert.deepEqual([old.at,old.visible,old.alphaSha256,old.hiddenBy],[next.at,next.visible,next.alphaSha256,next.hiddenBy]);
  return {id:old.id,edgeP10:[old.p10LumaGap,next.p10LumaGap],visible:next.visible};
});
assert.deepEqual(before.view.scene.collisionPlane,after.view.scene.collisionPlane);
assert.deepEqual(before.view.walkable,after.view.walkable);
assert.deepEqual(before.view.scene.atlas,after.view.scene.atlas);
const route=c2.spec.routes.find(r=>r.id==='rear-turn')!, rear=c2.spec.probes.find(p=>p.id==='rear')!;
const rearPose=spatialProbe(c2,'night',rear).contact;
const allowed=covered(before.view.walkable,...rear.at);
const rearSamples=pointSweep(route.points).map(at=>{
  const view=anchoredScene(c2,'night',route.actor,at);
  const actor=view.metadata.occlusion.find(a=>a.id===route.actor)!;
  return {at,visible:actor.visible,total:actor.visibleBefore};
});
assert.equal(rearPose.visible,0);
assert.equal(allowed,false,'Rear probe needs gameplay assessment if made walkable.');
assert.ok(rearSamples.every(s=>s.visible>0),'Authored rear route has a totally hidden sample.');
const clips=[];
for(const scene of ['c1-courtyard','c2-supply-stop'])for(const light of ['day','night'])for(const actor of ['surveyor','courier']){
  const trace=await read(e62+'playback/'+scene+'-'+light+'-'+actor+'.json');
  type Step={at:[number,number];contacts:{side:string;state:string;at:[number,number]}[]};
  const steps=trace.steps as Step[];
  let maxDepth=0,maxForward=0,maxAfterProjection=0,pairs=0;
  for(let i=1;i<steps.length;i++){
    const [prev,next]=[steps[i-1],steps[i]];
    for(const p of prev.contacts.filter(c=>c.state==='planted')){
      const n=next.contacts.find(c=>c.side===p.side && c.state==='planted');
      if(!n)continue;
      maxForward=Math.max(maxForward,Math.abs(n.at[0]-p.at[0]));
      maxDepth=Math.max(maxDepth,Math.abs(n.at[1]-p.at[1]));
      maxAfterProjection=Math.max(maxAfterProjection,Math.abs(n.at[1]-p.at[1]-(next.at[1]-prev.at[1])));
      pairs++;
    }
  }
  assert.deepEqual([maxForward,maxDepth,maxAfterProjection,pairs],[0,2,0,16]);
  clips.push({scene,light,actor,maxForward,maxDepth,maxAfterProjection,pairs});
}
await save('e62-quality-closeout.json',json({contrast,source:lock.verifiedCheckpoint,nightMasks:[before.view.scene.metadata.refinement!.nightLightPixels,
  after.view.scene.metadata.refinement!.nightLightPixels],rear:{probe:{at:rear.at,visible:rearPose.visible,walkable:allowed},
    route:route.id,samples:rearSamples,fullyHiddenSamples:0,minVisible:Math.min(...rearSamples.map(r=>r.visible)),hiddenMsAtAuthoredRoute:0},contacts:clips}));

const results=[];
for(const id of ['r1-signal-entrance','r2-signal-clearing']){
  const input=await load(id);
  const day=await writePackage(input,'day'),night=await writePackage(input,'night');
  for(const key of ['walkable'] as const)assert.deepEqual(day.view[key],night.view[key]);
  for(const key of ['collisionPlane','architectureSilhouette'] as const)assert.deepEqual(day.view.scene[key],night.view.scene[key]);
  assert.deepEqual(project(day.view).map(x=>[x.id,x.visible,x.hiddenBy]),project(night.view).map(x=>[x.id,x.visible,x.hiddenBy]));
  assert.equal(day.view.scene.nightLight,undefined);
  assert.ok(night.view.scene.nightLight);
  const routeVisibility=input.spec.routes.map(route=>{
    const positions=pointSweep(route.points), seen=positions.map(at=>
      anchoredScene(input,'day',route.actor,at).metadata.occlusion.find(a=>a.id===route.actor)!.visible);
    assert.ok(seen.every(n=>n>0),route.id+' contains a fully obscured actor.');
    return {id:route.id,samples:seen.length,minPixels:Math.min(...seen)};
  });
  for(const [light,bundle] of [['day',day],['night',night]] as const){
    const {w,h}=bundle.view.scene.raster;
    const sheet=makeRaster(w*3,h*2);
    const probes=input.spec.probes.map((probe,i)=>{
      const {view,contact}=spatialProbe(input,light,probe);
      blit(sheet,view.raster,i%3*w,Math.floor(i/3)*h);
      return {...contact,...probe};
    });
    const bytes=encodePng(sheet);
    assert.deepEqual(inspectPng(sheet,bytes,sheet),[]);
    await save('spatial/'+id+'-'+light+'.png',bytes);
    await save('spatial/'+id+'-'+light+'.json',json(probes));
    const meta=bundle.view.scene.metadata;
    results.push({id,light,seed:input.spec.seed,portal:meta.portal,modules:meta.ruins!.modules,
      supportPixels:meta.ruins!.supportPixels,style:input.spec.source.styleSha256,routes:bundle.view.routes,routeVisibility,
      hierarchy:bundle.view.hierarchy,interactions:bundle.view.interactions,
      swatches:meta.palette.ramps,actors:project(bundle.view),nightLightPixels:meta.refinement!.nightLightPixels,
      silhouetteSha256:sha256(bundle.files.get('architecture-silhouette.png')!)});
  }
}
assert.notEqual(results[0].silhouetteSha256,results[2].silhouetteSha256,'Holdout must test a different footprint.');
await save('comparison.json',json(results));
const index={version:1,checkpoint:lock.verifiedCheckpoint,packageCount:5,fileCount:Object.keys(entries).length,sha256:{...entries}};
await save('benchmark.json',json(index));
console.log('E6.3 · 4 ruin packages plus C2-Q · '+index.fileCount+' SHA-256 · E6.2 rear route and E5.4 contact verified');
