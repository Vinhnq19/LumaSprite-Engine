import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const root='benchmarks/results/e9h1/', replay='benchmarks/results/run/e9h1/';
const read=(p:string)=>readFileSync(p);
const json=(p:string)=>JSON.parse(read(p).toString('utf8'));
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
const published=json(root+'benchmark.json');
const checkManifest=(file:string,dir=dirname(file))=>{
  const lines=read(file).toString('utf8').trim().split(/\r?\n/);
  for(const line of lines){
    const [hash,name]=line.split('  ');
    assert.equal(sha256(read(join(dir,name))),hash,name);
  }
  return lines.length;
};

git('diff','--exit-code',published.checkpoint,'--','src/core','src/generators','src/specs','src/server','src/cli','src/adapters',
  'benchmarks/results/e85/human-review.json','benchmarks/results/e91sr',
  'docs/reports/E9.1S-R-FINAL-CHARACTER-REVIEW.html','package.json','package-lock.json');
const historical=Object.entries<number>(json('docs/e53-evidence.json').catalogs).reduce((count,[file,n])=>{
  assert.equal(checkManifest('docs/'+file,'.'),n);
  return count+n;
},0);
assert.equal(historical,805);
const prior=Object.fromEntries(Object.entries({e90:3,e91:616,e91r:277,e91s:189,e91sr:79}).map(([id,n])=>{
  const dir='benchmarks/results/'+id+'/';
  assert.equal(checkManifest(dir+'SHA256SUMS'),n);
  const v=json(dir+'portable-verification.json');
  assert.equal(sha256(read(v.html??v.report)),v.sha256);
  return [id,n];
}));
const firstPass=json('benchmarks/fixtures/e9h1/candidate-freeze.json');
assert.deepEqual(firstPass.sources,published.sources);
assert.equal(sha256(read('benchmarks/fixtures/e9h1/candidate-freeze.json')),published.freeze);
assert.deepEqual(published.cases.map((r:{seed:number})=>r.seed),[48311,firstPass.holdout.seed]);
assert.equal(published.cases[1].brief,firstPass.holdout.brief);
assert.equal(published.cases[0].provenance.length,3);
assert.equal(published.cases[1].provenance.length,3);
const n=checkManifest(root+'SHA256SUMS');
assert.equal(checkManifest(replay+'SHA256SUMS'),n);
assert.deepEqual(read(root+'SHA256SUMS'),read(replay+'SHA256SUMS'));

const frozenBenchmark='scripts/benchmark-e9h1.ts';
const sealed=git('show',published.frozenSource+':'+frozenBenchmark)+'\n';
const sealedSha=sha256(sealed);
assert.equal(sealedSha,published.sources[frozenBenchmark]);
const frozenLog=read(root+'first-holdout-attempt.txt');
const proof=json(root+'frozen-replay-proof.json');
assert.equal(sha256(frozenLog),proof.firstLogSha256);
assert.match(frozenLog.toString('utf8'),/far-shin has no visible ownership/);
assert.equal(proof.exportHarnessSha256,sha256(read(frozenBenchmark).toString('utf8').replaceAll('\r\n','\n')));
const outputDir='.cache/e9h1-frozen-review-replay/';
const substitutions=[
  ['sourceFiles.map(p=>[p,contentSha(p)])',
    "sourceFiles.map(p=>[p,p==='scripts/benchmark-e9h1.ts'?'"+sealedSha+"':contentSha(p)])"],
  ["values.publish?'benchmarks/results/e9h1/':","values.publish?'"+outputDir+"':"],
  ['  for(const candidate of [m,b])',[
    "  if(entry.role==='holdout') for(const [arm,r] of [['a',a],['matched',m],['full',b]] as const) {",
    "    const images={sprite:r.final,materials:r.mat,owners:r.ownership,day:context(r,'day').image,night:context(r,'night').image};",
    "    for(const [name,image] of Object.entries(images)) png('holdout/'+arm+'/'+name,image);",
    "  }",
    "  for(const candidate of [m,b])",
  ].join('\n')],
];
const instrumented=substitutions.reduce((source,[from,to])=>{
  assert.equal(source.split(from).length,2);
  return source.replace(from,to);
},sealed);
const replayScript='.cache/e9h1-frozen-verify.ts';
mkdirSync('.cache',{recursive:true});
writeFileSync(replayScript,instrumented);
const issue=spawnSync(process.execPath,[replayScript,'--publish'],{encoding:'utf8'});
assert.equal(issue.status,1);
assert.match(issue.stderr,/far-shin has no visible ownership/);
for(const [path,expected] of Object.entries<string>(proof.firstHoldoutMatchedRasters)) {
  assert.equal(sha256(read(outputDir+path)),expected,path);
  assert.equal(published.files[path],expected,path);
}
assert.equal(Object.keys(proof.firstHoldoutMatchedRasters).length,15);

const studio=resolve('../LumaSprite-Studio');
const revision=git('-C',studio,'rev-parse','HEAD');
assert.equal(revision,published.studio);
assert.equal(git('-C',studio,'status','--porcelain'),'');
const uri=(file:string)=>pathToFileURL(join(studio,file)).href;
const {readStudioPng}=await import(uri('studio/pixel/read-png.ts'));
const {celFor,newDocument}=await import(uri('src/studio/pixel/model.ts'));
const {PixelStore}=await import(uri('src/node/studio/pixel-store.ts'));
const {exportPixel}=await import(uri('src/node/studio/pixel-render.ts'));
const cache=resolve('.cache');mkdirSync(cache,{recursive:true});
const temp=mkdtempSync(join(cache,'e9h1-studio-'));
assert.ok(temp.startsWith(cache+sep+'e9h1-studio-'));
const pngs=[];
const samples=Object.keys(published.files).filter(name=>
  /^(development|holdout)\/(a|matched|full)\/(sprite|day|night)\.png$/.test(name)||
  /^edits\/[^/]+\/(before|after)\.png$/.test(name));
assert.equal(samples.length,24);
try{
  const store=new PixelStore(temp);
  for(const file of samples){
    const bytes=read(root+file), original=decodePng(bytes);
    const input:Uint32Array=await readStudioPng(new Blob([Uint8Array.from(bytes)]),original.w,original.h);
    assert.equal(input.length,original.w*original.h);
    assert.ok(input.every((p,i)=>p===original.rgba.readUInt32BE(i*4)),file);
    const doc=newDocument(file,original.w,original.h), asset=doc.assets[0], frame=asset.frames[0];
    celFor(asset,asset.layers[0].id,frame.id,true).data.set(input);
    const {id}=store.create(doc.name,original.w,original.h,0,doc);
    const saved=store.load(id,true);
    store.save(id,saved.revision,saved,'Verify E9.H1 exact RGBA');
    const exported=exportPixel({document:store.load(id,true),assetId:asset.id,frameId:frame.id,format:'png'});
    const output=decodePng(Buffer.from(exported.data));
    assert.deepEqual(output,original,file);
    pngs.push({file,pngSha256:sha256(bytes),rgbaSha256:sha256(output.rgba),dimensions:[output.w,output.h]});
  }
}finally{
  rmSync(temp,{recursive:true});
}
assert.equal(git('-C',studio,'status','--porcelain'),'');
const result={status:'PASS',historical,prior,deterministicEntries:n,frozenReplayPngs:15,
  studio:{revision,mode:'PNG_IMPORT_DOCUMENT_SAVE_PNG_EXPORT',pngs},unity:'NOT_RUN_STATIC_PILOT'};
writeFileSync(root+'technical-qa.json',JSON.stringify(result,null,2)+'\n');
console.log({status:result.status,historical,prior,deterministicEntries:n,studio:pngs.length});
