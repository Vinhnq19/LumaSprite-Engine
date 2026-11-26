import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { parseArgs } from 'node:util';
import { decodePng,encodePng } from '../src/core/renderer/png.ts';
import type { Raster } from '../src/core/pixels/raster.ts';
import { compareCoverage,inspectStructure,outlineOn,pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { bondedFracture } from '../src/experiments/structure-quality/masonry.ts';
import { compareRuinStructure } from '../src/experiments/structure-quality/ruins.ts';
import { loadComposition } from '../src/generators/environment/composition.ts';
import { inspectPng,sha256 } from '../src/quality/raster.ts';

const {values:{publish,out}}=parseArgs({options:{publish:{type:'boolean'},out:{type:'string'}}});
assert.ok(!publish||!out,'Choose --publish or --out.');
const root=publish?'benchmarks/results/e71r':out??'benchmarks/results/run/e71r';
const index:Record<string,string>={};
async function save(file:string,data:Buffer) {
  const path=join(root,file);
  await mkdir(dirname(path),{recursive:true});
  try { await writeFile(path,data,{flag:'wx'}); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code!=='EEXIST') throw error;
    assert.deepEqual(await readFile(path),data,file+' differs from the independently rendered bytes.');
  }
  index[file]=sha256(data);
}
const json=async(file:string,data:unknown)=>save(file,Buffer.from(JSON.stringify(data,null,2)+'\n'));
async function png(file:string,raster:Raster) {
  const bytes=encodePng(raster);
  assert.deepEqual(inspectPng(raster,bytes,raster),[],file);
  await save(file+'.png',bytes);
}

const closeout=JSON.parse(await readFile('benchmarks/fixtures/e71r/e71-baseline-lock.json','utf8'));
assert.ok(closeout.checkpoint.startsWith('3315425'));
for(const ref of closeout.sources) await pinnedFile(ref);
for(const record of closeout.decisions) await pinnedFile(record.comparison);

const historical='benchmarks/results/e71/';
const locked=JSON.parse(await readFile(historical+'benchmark.json','utf8'));
assert.equal(locked.fileCount,79);
for(const [file,hash] of Object.entries(locked.sha256)) await pinnedFile({file:historical+file,sha256:String(hash)});
const file='benchmarks/fixtures/e71r/holdout-lock.json';
const h2=JSON.parse((await pinnedFile({file,sha256:'269e2bf63f3178ac6e3ecf109c85020a84309511f991deef5149ce636644a43e'})).toString());
await pinnedFile(h2.derivedFrom);
const h2Spec=JSON.parse((await pinnedFile(h2.spec)).toString());
assert.equal(h2Spec.seed,h2.seed);
assert.equal(h2Spec.source.styleSha256,h2.controls.style);

for(const [id,source] of [['r1','benchmarks/fixtures/e63/r1-signal-entrance.json'],
  ['h1','benchmarks/fixtures/e71/h1-switchback-depot.json'],['h2',h2.spec.file]] as const) {
  const input=await loadComposition(JSON.parse(await readFile(source,'utf8')));
  const flat=compareRuinStructure(input,'day',true,bondedFracture);
  for(const light of ['day','night'] as const) {
    const result=compareRuinStructure(input,light,false,bondedFracture);
    const {control:{scene},edited,qa}=result;
    assert.deepEqual(edited.arch,flat.edited.arch,'Lighting or material changed candidate silhouette.');
    assert.deepEqual(qa.actors,flat.qa.actors);
    assert.deepEqual(scene.collisionPlane,flat.control.scene.collisionPlane);
    assert.ok(qa.coverage.removed>0&&qa.candidate.isolatedOutline===0);
    const path=id+'/'+light+'/';
    const current={native:scene.raster,flat:flat.control.scene.raster,
      silhouette:scene.architectureSilhouette!,material:scene.materialMask,collision:scene.collisionOverlay};
    if(id==='h2') {
      for(const [name,raster] of Object.entries(current)) await png(path+'control/'+name,raster);
      await png(path+'control/contour',outlineOn(scene.raster,inspectStructure(current.silhouette).edge));
    } else {
      for(const [name,raster] of Object.entries(current)) {
        const stored=decodePng(await readFile(historical+'ruin/'+path+'current/'+name+'.png'));
        assert.deepEqual(stored,raster,path+'changed a locked control.');
      }
    }

    const candidate={native:edited.raster,flat:flat.edited.raster,
      silhouette:edited.arch,material:edited.material,contour:outlineOn(edited.raster,edited.edge),collision:edited.collision};
    for(const [name,raster] of Object.entries(candidate)) await png(path+'bonded/'+name,raster);
    const previous=id==='h2'?null:decodePng(await readFile(historical+'ruin/'+path+'candidate/silhouette.png'));
    const {light:observedLight,...stats}=qa;
    assert.equal(observedLight,light);
    await json(path+'qa.json',{scene:input.spec.id,seed:input.spec.seed,holdout:id==='h2',light,
      review:'PENDING_HUMAN_REVIEW',priorQ:previous?compareCoverage(previous,edited.arch):null,...stats});
  }
}
await json('benchmark.json',{version:1,checkpoint:'3315425',rule:'bonded-fracture',holdout:h2.spec,
  count:Object.keys(index).length,sha256:index,review:'PENDING_HUMAN_REVIEW'});
console.log('E7.1R · R1, observed H1 and frozen H2 · 48 independently exported PNGs · 6 QA records.');
