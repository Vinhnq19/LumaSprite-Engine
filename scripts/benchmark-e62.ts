import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { parseArgs } from 'node:util';
import { blit,makeRaster,type Raster } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { baselineRoot,loadComposition,spatialProbe } from '../src/generators/environment/composition.ts';
import { compositionPackage,verifyCompositionPackage } from '../src/generators/environment/composition-export.ts';
import { writeEnvironmentPackage } from '../src/generators/environment/export.ts';
import { inspectPng,sha256 } from '../src/quality/raster.ts';
import { actors,entranceTraversal,readLockedWalk } from './e62-entrance.ts';

const {values:{publish,out}}=parseArgs({options:{publish:{type:'boolean'},out:{type:'string'}}});
if(publish&&out)throw new Error('Use --publish or --out.');
const result=publish?'benchmarks/results/e62':out??'benchmarks/results/run/e62';
const fixtures='benchmarks/fixtures/e62';
const ids=['c1-courtyard','c2-supply-stop'] as const;
const readJson=async(path: string)=>JSON.parse((await readFile(path)).toString('utf8'));
const lock=await readJson(fixtures+'/b1-production-lock.json');
assert.equal(lock.checkpoint,'24b8ca6');
for(const [file,digest] of Object.entries(lock.sourceSha256)) assert.equal(sha256(await readFile(file)),digest,file);
const sourceFiles=(await readFile(baselineRoot+'/SHA256SUMS','utf8')).trim().split(/\r?\n/);
assert.equal(sourceFiles.length,109);
for(const line of sourceFiles) {
  const [digest,path]=line.split('  ');
  assert.equal(sha256(await readFile(path)),digest,path);
}
const paths:Record<string,string>={};
const data=(value: unknown)=>Buffer.from(JSON.stringify(value,null,2)+'\n');
async function save(path: string,bytes: Buffer) {
  const target=join(result,path);
  await mkdir(dirname(target),{recursive:true});
  try{await writeFile(target,bytes,{flag:'wx'});}
  catch(error){
    if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
    assert.deepEqual(bytes,await readFile(target),target+' differs. Choose a new --out path.');
  }
  paths[path]=sha256(bytes);
}
async function savePng(path: string,raster: Raster) {
  const bytes=encodePng(raster);
  assert.deepEqual(inspectPng(raster,bytes,raster),[],path);
  await save(path,bytes);
}
const walks=await Promise.all(actors.map(readLockedWalk));
const comparisons=[];
const sharedModules=new Map<string, unknown>();
for(const id of ids){
  const input=await loadComposition(await readJson(fixtures+'/'+id+'.json'));
  const day=compositionPackage(input,'day');
  const night=compositionPackage(input,'night');
  assert.deepEqual(day.view.scene.collisionPlane,night.view.scene.collisionPlane);
  assert.deepEqual(day.view.walkable,night.view.walkable);
  assert.deepEqual(day.view.scene.metadata.layerOrder,night.view.scene.metadata.layerOrder);
  assert.equal(day.view.scene.nightLight,undefined);
  assert.ok(night.view.scene.nightLight);
  assert.deepEqual(day.view.scene.metadata.occlusion.map(x=>[x.id,x.visible,x.hiddenBy]),
    night.view.scene.metadata.occlusion.map(x=>[x.id,x.visible,x.hiddenBy]));
  for(const [light,bundle] of [['day',day],['night',night]] as const){
    const stem=id+'-'+light, baseline=input.spec.source.kit+'-'+light;
    const reference=lock.packages[baseline];
    const original=reference.manifest.replace(/manifest.json$/,'');
    assert.equal(sha256(await readFile(reference.manifest)),reference.manifestSha256);
    assert.equal(sha256(await readFile(original+'environment-spec.json')),reference.specSha256);
    assert.equal(sha256(bundle.files.get('kit.png')!),reference.kitSha256,'Approved architecture atlas differs.');
    assert.deepEqual(bundle.files.get('kit.json'),await readFile(original+'kit.json'));
    const fixed=bundle.view.scene.metadata.atlas.cells.filter(cell=>cell.id!=='roof')
      .map(cell=>[cell.id,cell.size,cell.pivot,cell.rgbaSha256]);
    if(sharedModules.has(light)) assert.deepEqual(fixed,sharedModules.get(light),'Scene kits diverge on fixed modules.');
    else sharedModules.set(light,fixed);
    const old=await readJson(original+'qa.json'), scene=bundle.view.scene, geometry=scene.metadata.refinement!.geometry;
    assert.equal(geometry.wallHeight,66);
    assert.equal(geometry.doorHeight,58);
    assert.equal(geometry.doorWidth-2*geometry.jamb,26);
    const courier=scene.metadata.occlusion.find(x=>x.id==='courier')!;
    const oldCourier=old.occlusion.find((x:{id:string})=>x.id==='forest-courier');
    if(id==='c1-courtyard'&&light==='night')assert.ok(courier.p10LumaGap!>oldCourier.p10LumaGap,'Courtyard Night Courier edge readability regressed.');
    const dest='packages/'+stem;
    await writeEnvironmentPackage(join(result,dest),bundle);
    assert.deepEqual(await verifyCompositionPackage(join(result,dest)),bundle.manifest);
    for(const [path,bytes] of bundle.files)paths[dest+'/'+path]=sha256(bytes);
    const {w,h}=scene.raster;
    const probes=makeRaster(w*3,h*2), layers=makeRaster(w*3,h*2);
    const observed=input.spec.probes.map((probe,i)=>{
      const {view,contact}=spatialProbe(input,light,probe);
      blit(probes,view.raster,i%3*w,Math.floor(i/3)*h);
      blit(layers,view.collisionOverlay,i%3*w,Math.floor(i/3)*h);
      return { ...contact, ...probe };
    });
    await savePng('spatial/'+stem+'.png',probes);
    await savePng('spatial/'+stem+'-collision.png',layers);
    await save('spatial/'+stem+'.json',data(observed));
    for(const [i,actor] of actors.entries()){
      const {sheet,qa}=entranceTraversal(input,light,bundle.view,actor,walks[i]);
      await savePng('playback/'+stem+'-'+actor+'.png',sheet);
      await save('playback/'+stem+'-'+actor+'.json',data(qa));
    }
    comparisons.push({id,light,baseline,kitSha256:reference.kitSha256,courierEdgeP10:[oldCourier.p10LumaGap,courier.p10LumaGap],
      actors:scene.metadata.occlusion.filter(x=>x.kind==='actor'),nightLightPixels:scene.metadata.refinement!.nightLightPixels,
      seamSamples:scene.metadata.seamSamples,routes:bundle.view.routes,hierarchy:bundle.view.hierarchy,interactions:bundle.view.interactions});
  }
}
await save('comparison.json',data(comparisons));
const manifest={version:1,source:'24b8ca6',protectedBaselineFiles:109,packageCount:comparisons.length,fileCount:Object.keys(paths).length,sha256:{...paths}};
await save('benchmark.json',data(manifest));
console.log('E6.2 · '+manifest.packageCount+' C1/C2 day/night packages · '+manifest.fileCount+' SHA-256 · eight entrance clips verified');
