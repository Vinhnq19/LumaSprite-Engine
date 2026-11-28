import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const root='benchmarks/results/e9h1r/', replay='benchmarks/results/run/e9h1r/';
const previous='benchmarks/results/e9h1/';
const read=(path:string)=>readFileSync(path);
const json=(path:string)=>JSON.parse(read(path).toString('utf8'));
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
const run=(file:string)=>execFileSync(process.execPath,[file],{encoding:'utf8'});
const benchmark=json(root+'benchmark.json'), first=json(root+'first-holdout-attempt.json');
const checkpoint='5fef43d97ddfc09404754c5f027ca93f7037017d';
const seal='benchmarks/fixtures/e9h1r/candidate-freeze.json';
const freeze=json(seal);
assert.equal(benchmark.checkpoint,checkpoint);
assert.equal(benchmark.freeze,sha256(read(seal)));
assert.deepEqual(benchmark.sources,freeze.sources);
assert.deepEqual(benchmark.cases.map((r:{role:string})=>r.role),['development','diagnostic','fresh']);
assert.equal(benchmark.cases[2].seed,freeze.holdout.seed);
assert.equal(benchmark.cases[2].brief,freeze.holdout.brief);
assert.equal(first.benchmarkSha256,sha256(read(root+'benchmark.json')));
assert.equal(first.manifestSha256,sha256(read(root+'SHA256SUMS')));
assert.equal(git('show',first.sealCommit+':'+seal),read(seal).toString('utf8').trim());
assert.equal(first.exitCode,benchmark.status==='E9_H1R_TECHNICAL_BLOCKED'?1:0);
git('diff','--exit-code',checkpoint,'--','src','package.json','package-lock.json','scripts/benchmark-e9h1.ts','scripts/verify-e9h1.ts',
  'benchmarks/results/e9h1','benchmarks/fixtures/e9h1','benchmarks/results/e85/human-review.json',
  'docs/reports/E9-H1-HYBRID-CHARACTER-PILOT.html','docs/reports/E9.1S-R-FINAL-CHARACTER-REVIEW.html');

const log=run('scripts/benchmark-e9h1.ts');
assert.match(log,/far-shin has no visible ownership/);
run('scripts/verify-e9h1.ts');
const historical=json(previous+'technical-qa.json');
assert.equal(historical.historical,805);
assert.equal(historical.deterministicEntries,101);
assert.equal(historical.studio.pngs.length,24);
for(const id of ['e9h1','e91sr','e91s','e91r','e91','e90']){
  const v=json('benchmarks/results/'+id+'/portable-verification.json');
  assert.equal(sha256(read(v.html??v.report)),v.sha256);
}
function manifest(path:string) {
  const base=dirname(path), items=read(path).toString('utf8').trim().split(/\r?\n/);
  for(const item of items){
    const [hash,name]=item.split('  ');
    assert.equal(sha256(read(join(base,name))),hash,name);
  }
  return items.length;
}
const count=manifest(root+'SHA256SUMS');
assert.equal(manifest(replay+'SHA256SUMS'),count);
assert.deepEqual(read(root+'SHA256SUMS'),read(replay+'SHA256SUMS'));
for(const ref of benchmark.referenceEvidence){
  assert.equal(sha256(read(ref.source)),ref.sha256,ref.id);
  assert.equal(ref.humanApproval,'PENDING');
}
assert.equal(benchmark.referenceEvidence.length,9);
assert.equal(benchmark.revisions.length,3);
assert.ok(benchmark.revisions.every((r:{revision:number})=>r.revision===2));
assert.equal(benchmark.cases[1].layout.attempts[0].visible,0);
assert.ok(benchmark.cases[1].results.every((r:{visibility:{visible:number;pass:boolean}})=>r.visibility.visible===15&&r.visibility.pass));
assert.ok(benchmark.cases[0].local.length===3&&benchmark.cases[0].local.every((e:{changed:number;outside:number;before:string;rollback:string})=>
  e.changed>0&&e.outside===0&&e.before===e.rollback));

const studio=resolve('../LumaSprite-Studio');
const revision=git('-C',studio,'rev-parse','HEAD');
assert.equal(revision,'471ac90555d3545beff5182146e291ba97b9ae20');
assert.equal(git('-C',studio,'status','--porcelain'),'');
const uri=(path:string)=>pathToFileURL(join(studio,path)).href;
const {readStudioPng}=await import(uri('studio/pixel/read-png.ts'));
const {celFor,newDocument}=await import(uri('src/studio/pixel/model.ts'));
const {PixelStore}=await import(uri('src/node/studio/pixel-store.ts'));
const {exportPixel}=await import(uri('src/node/studio/pixel-render.ts'));
const cache=resolve('.cache');
mkdirSync(cache,{recursive:true});
const temp=mkdtempSync(join(cache,'e9h1r-studio-'));
assert.ok(temp.startsWith(cache+sep+'e9h1r-studio-'));
const files=Object.keys(benchmark.files).filter(name=>
  /^(development|diagnostic|fresh)\/(a0|matched-refined|full-refined)\/(sprite|day|night)\.png$/.test(name)||
  /^edits\/[^/]+\/(before|after)\.png$/.test(name));
assert.ok(files.length>=24);
const images=[];
try {
  const store=new PixelStore(temp);
  for(const file of files) {
    const bytes=read(root+file), reference=decodePng(bytes);
    const pixels:Uint32Array=await readStudioPng(new Blob([Uint8Array.from(bytes)]),reference.w,reference.h);
    const document=newDocument(file,reference.w,reference.h), asset=document.assets[0], frame=asset.frames[0];
    assert.ok(pixels.length===reference.w*reference.h&&pixels.every((p,i)=>p===reference.rgba.readUInt32BE(i*4)),file);
    celFor(asset,asset.layers[0].id,frame.id,true).data.set(pixels);
    const {id}=store.create(document.name,reference.w,reference.h,0,document);
    const saved=store.load(id,true);
    store.save(id,saved.revision,saved,'Verify E9.H1R pixel round trip');
    const out=exportPixel({document:store.load(id,true),assetId:asset.id,frameId:frame.id,format:'png'});
    assert.deepEqual(decodePng(Buffer.from(out.data)),reference,file);
    images.push({file,pngSha256:sha256(bytes),rgbaSha256:sha256(reference.rgba),dimensions:[reference.w,reference.h]});
  }
} finally {
  rmSync(temp,{recursive:true});
}
assert.equal(git('-C',studio,'status','--porcelain'),'');
const result={status:'PASS',pilotStatus:benchmark.status,historical:historical.historical,protectedE9:historical.prior,
  previousE9H1:{deterministicEntries:historical.deterministicEntries,studioSamples:historical.studio.pngs.length,
  originalHoldoutStillFails:true,protectedReportSha256:json(previous+'portable-verification.json').sha256},
  deterministicEntries:count,firstHoldout:true,studio:{revision,mode:'PNG_IMPORT_DOCUMENT_SAVE_PNG_EXPORT',images},
  unity:'NOT_RUN_STATIC_RESEARCH',owner:'UNSIGNED'};
writeFileSync(root+'technical-qa.json',JSON.stringify(result,null,2)+'\n');
console.log({status:result.status,pilotStatus:result.pilotStatus,historical:result.historical,deterministic:count,studio:images.length});
