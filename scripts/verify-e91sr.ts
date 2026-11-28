import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { dirname,join,resolve,sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const root='benchmarks/results/e91sr/', locked='benchmarks/fixtures/e91sr/', replay='benchmarks/results/run/e91sr/';
const read=(p:string)=>readFileSync(p);
const json=(p:string)=>JSON.parse(read(p).toString('utf8'));
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
const manifest=(p:string,base=dirname(p))=>{
  const lines=read(p).toString('utf8').trim().split(/\r?\n/);
  for(const l of lines){
    const [hash,name]=l.split('  '), file=join(base,name);
    assert.equal(sha256(read(file)),hash,file);
  }
  return lines.length;
};
const checkpoint='c4a78e771cd1698354f01d6ee8e612a0e5474c9e';
assert.equal(git('rev-parse',checkpoint+'^'),'fa28feeca9117f8da4ab747851b7922e9441785e');
git('diff','--exit-code',checkpoint,'--','src/generators','src/specs','src/cli','src/server','src/core',
  'src/experiments/character-v4.ts','src/experiments/character-v4-recovery.ts','src/experiments/costume-stance.ts',
  'src/experiments/character-identity-study.ts','scripts/benchmark-e91s.ts','benchmarks/fixtures/e91','benchmarks/fixtures/e91r',
  'benchmarks/fixtures/e91s','benchmarks/results/e90','benchmarks/results/e91','benchmarks/results/e91r','benchmarks/results/e91s',
  'docs/reports/E9.0-ART-QUALITY-ARCHITECTURE-REVIEW.html','docs/reports/E9.1-CHARACTER-ART-QUALITY-REVIEW.html',
  'docs/reports/E9.1R-CHARACTER-ART-REVIEW.html','docs/reports/E9.1S-SEMANTIC-CHARACTER-REVIEW.html',
  'docs/art-quality/art-quality-rubric-v2.json','docs/art-quality/art-quality-rubric-v2-static-addendum.md',
  'package.json','package-lock.json','LICENSE','LICENSE.md','NOTICE');
const historical=Object.entries<number>(json('docs/e53-evidence.json').catalogs).reduce((sum,[path,expected])=>{
  assert.equal(manifest('docs/'+path,'.'),expected);return sum+expected;
},0);
assert.equal(historical,805);
const catalogs=Object.fromEntries(Object.entries({e76r:142,e8:42,e83:52,e85:56,e90:3,e91:616,e91r:277,e91s:189}).map(([id,n])=>{
  assert.equal(manifest('benchmarks/results/'+id+'/SHA256SUMS'),n);return [id,n];
}));
for(const id of ['e90','e91','e91r','e91s']){
  const v=json('benchmarks/results/'+id+'/portable-verification.json');
  assert.equal(sha256(read(v.html??v.report)),v.sha256);
}
const e90=json('benchmarks/results/e90/audit-evidence.json');
assert.equal(sha256(read(e90.rubricV2.file)),e90.rubricV2.sha256);
for(const image of e90.evidencePngs)assert.equal(sha256(read(image.file)),image.sha256);
assert.equal(manifest('benchmarks/results/run/e91s/SHA256SUMS'),catalogs.e91s);
assert.deepEqual(read('benchmarks/results/run/e91s/SHA256SUMS'),read('benchmarks/results/e91s/SHA256SUMS'));
const regenerated=manifest(root+'SHA256SUMS');
assert.equal(manifest(replay+'SHA256SUMS'),regenerated);
assert.deepEqual(read(root+'SHA256SUMS'),read(replay+'SHA256SUMS'));
const result=json(root+'benchmark.json'), old=json('benchmarks/results/e91s/benchmark.json');
const proof=json(locked+'type-only-replay-proof.json');
const first=json(locked+'first-render-freeze.json'), current=json(locked+'candidate-freeze.json');
assert.equal(sha256(read(locked+'first-render-freeze.json')),proof.firstFreezeSha256);
assert.deepEqual(first.holdout,current.holdout);
assert.deepEqual(first.seed,current.seed);
assert.deepEqual(first.sources,{...current.sources,'scripts/benchmark-e91sr.ts':proof.sourceSha256Before});
assert.equal(current.sources['scripts/benchmark-e91sr.ts'],proof.sourceSha256After);
assert.deepEqual(proof.firstPngs,result.files);
const cart=result.cases.find((r:{role:string})=>r.role==='diagnostic');
const fresh=result.cases.find((r:{role:string})=>r.role==='holdout');
assert.deepEqual([cart.audits.before.headwear.top,cart.audits.before.outline.top,cart.audits.after.headwear.top,
  cart.audits.after.outline.top,cart.audits.before.final.top,cart.audits.after.final.top],[1,0,2,1,0,1]);
assert.equal(cart.audits.after.skull.top,cart.audits.before.skull.top);
assert.equal(fresh.audits.after.final.top,1);

const studio=resolve('../LumaSprite-Studio');
const revision=git('-C',studio,'rev-parse','HEAD');
assert.equal(revision,'471ac90555d3545beff5182146e291ba97b9ae20');
assert.equal(git('-C',studio,'status','--porcelain'),'');
const uri=(p:string)=>pathToFileURL(join(studio,p)).href;
const {readStudioPng}=await import(uri('studio/pixel/read-png.ts'));
const {celFor,newDocument}=await import(uri('src/studio/pixel/model.ts'));
const {PixelStore}=await import(uri('src/node/studio/pixel-store.ts'));
const {exportPixel}=await import(uri('src/node/studio/pixel-render.ts'));
const cache=resolve('.cache');mkdirSync(cache,{recursive:true});
const temp=mkdtempSync(join(cache,'e91sr-studio-'));
assert.ok(temp.startsWith(cache+sep+'e91sr-studio-'));
const pngs=[];
type Row={variants:Array<{stage:string;folder:string;milestone:'e91s'|'e91sr'}>};
try{
  const store=new PixelStore(temp);
  for(const row of result.cases as Row[])for(const [stage,kind] of [['s0','sprite'],['s3','sprite'],['s3','night']]){
    const v=row.variants.find(v=>v.stage===stage)!;
    const file=v.folder+'/'+kind+'.png', bytes=read('benchmarks/results/'+v.milestone+'/'+file);
    assert.equal(sha256(bytes),(v.milestone==='e91s'?old:result).files[file]);
    const original=decodePng(bytes);
    const pixels:Uint32Array=await readStudioPng(new Blob([Uint8Array.from(bytes)]),original.w,original.h);
    assert.equal(pixels.length,original.w*original.h);
    assert.ok(pixels.every((pixel,i)=>pixel===original.rgba.readUInt32BE(i*4)));
    const doc=newDocument(file,original.w,original.h),asset=doc.assets[0],frame=asset.frames[0];
    celFor(asset,asset.layers[0].id,frame.id,true).data.set(pixels);
    const {id}=store.create(doc.name,original.w,original.h,0,doc);
    const saved=store.load(id,true);store.save(id,saved.revision,saved,'Verify E9.1S-R pixel bytes');
    const out=exportPixel({document:store.load(id,true),assetId:asset.id,frameId:frame.id,format:'png'});
    assert.deepEqual(decodePng(Buffer.from(out.data)),original);
    pngs.push({file,milestone:v.milestone,pngSha256:sha256(bytes),rgbaSha256:sha256(original.rgba)});
  }
}finally{
  rmSync(temp,{recursive:true,force:true});
}
assert.equal(git('-C',studio,'status','--porcelain'),'');
const qa={status:result.status,historical,catalogs,regenerated,firstHoldoutPngsUnchanged:Object.keys(proof.firstPngs).length,
  firstFreeze:proof.firstFreezeSha256,studio:{revision,mode:'RAW_PNG_ONLY',pngs},
  staticScenes:result.cases.reduce((sum:number,row:Row)=>sum+row.variants.length*2,0),
  unityRuntime:'NOT_RUN',productionDefaults:'UNCHANGED',owner:'STATIC_ART_REVIEW_PENDING'};
writeFileSync(root+'technical-qa.json',JSON.stringify(qa,null,2)+'\n');
console.log({status:qa.status,historical,catalogs,regenerated,firstHoldoutPngsUnchanged:qa.firstHoldoutPngsUnchanged,
  studio:pngs.length,staticScenes:qa.staticScenes});
