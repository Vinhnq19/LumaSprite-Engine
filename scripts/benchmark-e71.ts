import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { parseArgs } from 'node:util';
import { nearestNeighbor,type Raster } from '../src/core/pixels/raster.ts';
import { decodePng,encodePng } from '../src/core/renderer/png.ts';
import { compareCoverage,inspectStructure,outlineOn,pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { renderRelay } from '../src/experiments/structure-quality/relay.ts';
import { compareRuinStructure } from '../src/experiments/structure-quality/ruins.ts';
import { loadComposition } from '../src/generators/environment/composition.ts';
import { inspectPng,sha256 } from '../src/quality/raster.ts';
import { makeCorpus } from './e71-corpus.ts';

const {values:{publish,out}}=parseArgs({options:{publish:{type:'boolean'},out:{type:'string'}}});
if(publish&&out)throw Error('Choose --publish or --out.');
const base=publish?'benchmarks/results/e71':out??'benchmarks/results/run/e71';
const fixtures='benchmarks/fixtures/e71/';
const readJson=async(file:string)=>JSON.parse((await readFile(file)).toString('utf8'));
const json=(v:unknown)=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const hashes:Record<string,string>={};
async function save(file:string,bytes:Buffer){
  const target=join(base,file);
  await mkdir(dirname(target),{recursive:true});
  try{await writeFile(target,bytes,{flag:'wx'});}
  catch(e){
    if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
    assert.deepEqual(await readFile(target),bytes,file+' differs from regenerated output.');
  }
  hashes[file]=sha256(bytes);
}
async function png(file:string,raster:Raster){
  const bytes=encodePng(raster);
  assert.deepEqual(inspectPng(raster,bytes,raster),[]);
  await save(file+'.png',bytes);
}

const e64=await readJson(fixtures+'e64-baseline-lock.json');
for(const file of e64.files)await pinnedFile(file);
for(const pkg of e64.packages)for(const file of [pkg.manifest,pkg.spec,...pkg.files])await pinnedFile(file);
for(const [edition,count] of [['e61r',109],['e62',100],['e63',105],['e64',94]] as const){
  const rows=(await readFile('benchmarks/results/'+edition+'/SHA256SUMS','utf8')).trim().split(/\r?\n/);
  assert.equal(rows.length,count);
  for(const row of rows){const [sha256,file]=row.split('  ');await pinnedFile({file,sha256});}
}
const holdout=JSON.parse((await pinnedFile({
  file:fixtures+'holdout-lock.json',sha256:'7e701dd364dfdd3deda1116f42cbb3438a8257667ed920a7b06f00bf9ad7616c',
})).toString('utf8'));
const holdoutRaw=JSON.parse((await pinnedFile(holdout.spec)).toString('utf8'));
assert.equal(holdout.seed,holdoutRaw.seed);
await pinnedFile(holdout.derivedFrom);
const corpus=await makeCorpus();
await save('corpus.json',json(corpus));

const relaySpec=await readJson(fixtures+'relay-box.json');
const replays=await Promise.all((['a0','a1'] as const).map(async variant=>{
  const asset=await renderRelay(relaySpec,variant);
  assert.deepEqual(asset,await renderRelay(relaySpec,variant),'Relay determinism.');
  const path='relay/'+variant+'/';
  for(const [name,raster] of Object.entries({native:asset.final,flat:asset.flat,material:asset.material,
    silhouette:asset.mask,contour:outlineOn(asset.final,asset.edge),context:asset.inScene})){
    await png(path+name,raster);
  }
  await png(path+'native-4x',nearestNeighbor(asset.final,4));
  await save(path+'qa.json',json({variant,canvas:[32,32],sampling:'nearest',spec:asset.spec,structuralIntent:asset.structure,
    alpha:asset.stat,review:'PENDING_HUMAN_REVIEW'}));
  return asset;
}));
assert.deepEqual(replays[0].structure.contact,replays[1].structure.contact);
const relayDiff=compareCoverage(replays[0].final,replays[1].final);
assert.ok(relayDiff.added>0&&relayDiff.removed>0);
await save('relay/compare.json',json({coverage:relayDiff,placement:replays[0].spec.placement.pivot,
  current:'projectBox single-volume',candidate:'projectBox articulated volumes',a0:replays[0].stat,a1:replays[1].stat}));

const decisions=[];
for(const [id,raw] of [['r1',await readJson('benchmarks/fixtures/e63/r1-signal-entrance.json')],['h1',holdoutRaw]] as const){
  const composition=await loadComposition(raw);
  const flat=compareRuinStructure(composition,'day',true);
  for(const light of ['day','night'] as const){
    const result=compareRuinStructure(composition,light);
    assert.deepEqual(result,compareRuinStructure(composition,light),'Wall scene determinism.');
    assert.deepEqual(result.qa.actors,flat.qa.actors);
    assert.deepEqual(result.edited.arch,flat.edited.arch,'The wall silhouette changed after painting.');
    assert.deepEqual(result.control.scene.collisionPlane,flat.control.scene.collisionPlane,'Unexpected footprint change.');
    const {control:c,edited:e}=result;
    if(id==='r1'){
      const historical=decodePng(await readFile('benchmarks/results/e63/packages/r1-signal-entrance-'+light+'/scene.png'));
      assert.deepEqual(c.scene.raster,historical,'Production control differs from historical R1.');
    }
    const original=inspectStructure(c.scene.architectureSilhouette!);
    const path='ruin/'+id+'/'+light+'/';
    for(const [key,set] of Object.entries({
      current:{native:c.scene.raster,material:c.scene.materialMask,flat:flat.control.scene.raster,
        silhouette:c.scene.architectureSilhouette!,contour:outlineOn(c.scene.raster,original.edge),collision:c.scene.collisionOverlay},
      candidate:{native:e.raster,material:e.material,flat:flat.edited.raster,
        silhouette:e.arch,contour:outlineOn(e.raster,e.edge),collision:e.collision},
    })){
      for(const [name,raster] of Object.entries(set))await png(path+key+'/'+name,raster);
      await png(path+key+'/native-4x',nearestNeighbor(set.native,4));
    }
    const qa={scene:composition.spec.id,holdout:id==='h1',seed:composition.spec.seed,review:'PENDING_HUMAN_REVIEW',...result.qa};
    await save(path+'qa.json',json(qa));
    decisions.push({id,light,seed:qa.seed,coverage:qa.coverage,routes:qa.routes.map(r=>[r.id,r.tested]),actors:qa.actors});
  }
}
await save('ruin/compare.json',json(decisions));
const index={version:1,checkpoint:'77fbaa5',historical:corpus.historical.length,development:2,holdout:1,
  fileCount:Object.keys(hashes).length,sha256:Object.fromEntries(Object.entries(hashes).sort(([a],[b])=>a.localeCompare(b))),review:'PENDING_HUMAN_REVIEW'};
await save('benchmark.json',json(index));
console.log('E7.1 · '+index.historical+' locked corpus entries · 2 relay shapes · R1 and frozen H1 in day/night · '+index.fileCount+' payload SHA-256');
