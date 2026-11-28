import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const root='benchmarks/results/e9h1-closeout/', prior='benchmarks/results/e9h1r/', replay='benchmarks/results/run/e9h1-closeout/';
const read=(p:string)=>readFileSync(p), hash=(p:string)=>sha256(read(p));
const json=(p:string)=>JSON.parse(read(p).toString('utf8'));
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
const snap=json(root+'benchmark.json'), first=json(root+'first-attempt.json');
const seal='benchmarks/fixtures/e9h1-closeout/candidate-freeze.json', frozen=json(seal);
const method=json(root+'decision.json'), workspace=json(root+'workspace-audit.json');
const art=json(root+'native-observation.json');
const status=snap.status==='TECHNICAL_PASS'?'E9_H1_NO_MEANINGFUL_ART_QUALITY_GAIN':'E9_H1_CLOSEOUT_TECHNICAL_BLOCKED';
assert.equal(method.status,status);
assert.equal(method.owner,'PENDING');
assert.equal(method.option,'OPTION_B_ARTIST_DIRECTED_HYBRID_COMPONENTS');
assert.equal(art.additionalArtRevision,false);
assert.equal(workspace.unstagedDeletionCount,38);
assert.equal(workspace.stagedCount,0);
assert.equal(first.sealSha256,hash(seal));
assert.equal(snap.seal,first.sealSha256);
assert.equal(first.benchmarkSha256,hash(root+'benchmark.json'));
assert.equal(first.manifestSha256,hash(root+'SHA256SUMS'));
assert.equal(git('show',first.sourceCommit+':'+seal),read(seal).toString('utf8').trimEnd());
assert.deepEqual(snap.sources,frozen.sources);
assert.deepEqual(snap.cases.map((x:{role:string})=>x.role),['diagnostic','fresh']);
assert.equal(snap.cases[1].seed,frozen.holdout.entry.seed);
assert.equal(snap.cases[1].brief,frozen.holdout.entry.brief);

git('diff','--exit-code',snap.checkpoint,'--','src','package.json','package-lock.json',
  'scripts/benchmark-e9h1.ts','scripts/benchmark-e9h1r.ts','scripts/e9h1r-composition.ts','scripts/e9h1r-visibility.ts',
  'benchmarks/fixtures/e9h1','benchmarks/fixtures/e9h1r','benchmarks/results/e9h1','benchmarks/results/e9h1r',
  'docs/reports/E9-H1-HYBRID-CHARACTER-PILOT.html','docs/reports/E9-H1R-ART-DIRECTED-QUALITY-REVIEW.html');
const old=spawnSync(process.execPath,['scripts/benchmark-e9h1r.ts'],{encoding:'utf8'});
assert.equal(old.status,1);
assert.match(old.stdout,/KNEE_DIRECTION\/near/);
execFileSync(process.execPath,['scripts/verify-e9h1r.ts'],{encoding:'utf8'});
const history=json(prior+'technical-qa.json');
assert.equal(history.historical,805);
assert.equal(history.previousE9H1.deterministicEntries,101);
assert.equal(history.deterministicEntries,172);
for(const id of ['e9h1','e9h1r']) {
  const v=json('benchmarks/results/'+id+'/portable-verification.json');
  assert.equal(hash(v.html),v.sha256,v.html);
}
const protectedBaseline=json(prior+'benchmark.json');
const locked=Object.fromEntries(['a0','matched-draft','matched-refined','full-draft','full-refined'].map(arm=>{
  const file='development/'+arm+'/sprite.png', sha=hash(prior+file);
  assert.equal(sha,protectedBaseline.files[file]);
  return [arm,sha];
}));

function manifest(path:string) {
  const lines=read(path).toString('utf8').trim().split(/\r?\n/);
  for(const record of lines) {
    const [digest,file]=record.split('  ');
    assert.equal(hash(join(dirname(path),file)),digest,file);
  }
  return lines.length;
}
const n=manifest(root+'SHA256SUMS');
assert.equal(manifest(replay+'SHA256SUMS'),n);
assert.deepEqual(read(root+'SHA256SUMS'),read(replay+'SHA256SUMS'));
const failed=snap.matrix.find((x:{id:string})=>x.id==='breakwater-original');
assert.deepEqual(failed.errors,['KNEE_DIRECTION/near']);
assert.equal(failed.joints[0].forward,-2);
assert.deepEqual(failed.tolerance,[-1,5.25]);
const corrected=snap.cases[0];
assert.equal(corrected.status,'TECHNICAL_PASS');
assert.ok(corrected.joints.every((j:{forward:number})=>j.forward>0));
for(const [i,newLeg] of corrected.joints.entries()) {
  const originalLeg=failed.joints[i];
  assert.deepEqual([newLeg.hip,newLeg.ankle,newLeg.foot],[originalLeg.hip,originalLeg.ankle,originalLeg.foot]);
}
assert.equal(snap.matrix.length,9);
assert.equal(snap.matrix.filter((x:{outcome:string})=>x.outcome==='PASS').length,4);
assert.equal(snap.references.filter((r:{humanApproval:string})=>r.humanApproval==='PENDING').length,9);
for(const r of snap.references) assert.equal(hash(r.source),r.sha256);
const form=json(root+'human-review.json');
assert.equal(form.signature,null);
assert.equal(form.state,'UNSIGNED');

const studio=resolve('../LumaSprite-Studio');
const revision=git('-C',studio,'rev-parse','HEAD');
assert.equal(revision,history.studio.revision);
assert.equal(git('-C',studio,'status','--porcelain'),'');
const uri=(p:string)=>pathToFileURL(join(studio,p)).href;
const {readStudioPng}=await import(uri('studio/pixel/read-png.ts'));
const {celFor,newDocument}=await import(uri('src/studio/pixel/model.ts'));
const {PixelStore}=await import(uri('src/node/studio/pixel-store.ts'));
const {exportPixel}=await import(uri('src/node/studio/pixel-render.ts'));
const cache=resolve('.cache');
mkdirSync(cache,{recursive:true});
const temp=mkdtempSync(join(cache,'e9h1-closeout-studio-'));
assert.ok(temp.startsWith(cache+sep+'e9h1-closeout-studio-'));
const areas=Object.keys(snap.files).filter(x=>/^(diagnostic|fresh)\/(a0|matched-r2|full-r2)\/(sprite|day|night)\.png$/.test(x));
if(snap.status==='TECHNICAL_PASS') assert.equal(areas.length,18);
const images=[];
try {
  const store=new PixelStore(temp);
  for(const name of areas) {
    const input=read(root+name), original=decodePng(input);
    const rgba:Uint32Array=await readStudioPng(new Blob([Uint8Array.from(input)]),original.w,original.h);
    assert.ok(rgba.length===original.w*original.h&&rgba.every((p,i)=>p===original.rgba.readUInt32BE(i*4)),name);
    const doc=newDocument(name,original.w,original.h), asset=doc.assets[0], frame=asset.frames[0];
    celFor(asset,asset.layers[0].id,frame.id,true).data.set(rgba);
    const {id}=store.create(doc.name,original.w,original.h,0,doc);
    const loaded=store.load(id,true);
    store.save(id,loaded.revision,loaded,'Verify exact closeout RGBA');
    const exported=exportPixel({document:store.load(id,true),assetId:asset.id,frameId:frame.id,format:'png'});
    assert.deepEqual(decodePng(Buffer.from(exported.data)),original,name);
    images.push({name,sha256:sha256(input),rgbaSha256:sha256(original.rgba),dimensions:[original.w,original.h]});
  }
} finally {
  rmSync(temp,{recursive:true});
}
assert.equal(git('-C',studio,'status','--porcelain'),'');
const qa={status:'PASS',closeoutStatus:status,originalH1:101,originalH1R:172,historical:805,baselineSha256:locked,deterministicEntries:n,
  poseMatrix:{passed:4,expectedRejections:5},studio:{revision,images},holdout:snap.cases[1].status,owner:'PENDING',unity:'NOT_RUN_STATIC_RESEARCH'};
writeFileSync(root+'technical-qa.json',JSON.stringify(qa,null,2)+'\n');
console.log({status:qa.status,closeout:status,historical:qa.historical,deterministic:n,studio:images.length});
