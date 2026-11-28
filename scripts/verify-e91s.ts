import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { dirname,join,resolve,sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { composite } from '../src/core/pixels/raster.ts';
import { decodePng,encodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';
import { crossAssetStyle,loadArtDirection } from '../src/experiments/art-direction.ts';
import { legacyBody,renderQualityCharacter } from '../src/experiments/character-v4.ts';
import { recoverCostume,wardrobeLayers } from '../src/experiments/character-v4-recovery.ts';
import { identitySteps } from '../src/experiments/character-identity-study.ts';
import { maskPixels,occupied,requireCostumeStance } from '../src/experiments/costume-stance.ts';

const root='benchmarks/results/e91s/', replay='benchmarks/results/run/e91s/';
const read=(path:string)=>readFileSync(path);
const json=(path:string)=>JSON.parse(read(path).toString('utf8'));
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
const manifest=(file:string,dir=dirname(file))=>{
  const rows=read(file).toString('utf8').trim().split(/\r?\n/);
  for(const row of rows){
    const [hash,name]=row.split('  ');
    const path=join(dir,name);
    assert.equal(sha256(read(path)),hash,path);
  }
  return rows.length;
};
const old='cb2eb3f046f0f6694100327a1baa29bc67ab7278';
git('diff','--exit-code',old,'--','src/generators','src/specs','src/cli','src/server','src/experiments/character-v4.ts',
  'src/experiments/character-v4-recovery.ts','src/experiments/costume-stance.ts','scripts/benchmark-e91.ts','scripts/benchmark-e91r.ts',
  'benchmarks/fixtures/e91','benchmarks/fixtures/e91r','benchmarks/results/e90','benchmarks/results/e91','benchmarks/results/e91r',
  'docs/reports/E9.0-ART-QUALITY-ARCHITECTURE-REVIEW.html','docs/reports/E9.1-CHARACTER-ART-QUALITY-REVIEW.html',
  'docs/reports/E9.1R-CHARACTER-ART-REVIEW.html','docs/art-quality/art-quality-rubric-v2.json','docs/art-quality/art-quality-rubric-v2-static-addendum.md',
  'package.json','package-lock.json','LICENSE','LICENSE.md','NOTICE');
const historical=Object.entries<number>(json('docs/e53-evidence.json').catalogs).reduce((sum,[file,count])=>{
  assert.equal(manifest('docs/'+file,'.'),count);return sum+count;
},0);
assert.equal(historical,805);
const catalogs=Object.fromEntries(Object.entries({e76r:142,e8:42,e83:52,e85:56,e90:3,e91:616,e91r:277}).map(([id,count])=>{
  assert.equal(manifest('benchmarks/results/'+id+'/SHA256SUMS'),count);return [id,count];
}));
for(const id of ['e90','e91','e91r']){
  const verified=json('benchmarks/results/'+id+'/portable-verification.json');
  assert.equal(sha256(read(verified.html??verified.report)),verified.sha256);
}
const e90=json('benchmarks/results/e90/audit-evidence.json');
assert.equal(sha256(read(e90.rubricV2.file)),e90.rubricV2.sha256);
assert.equal(sha256(read('docs/reports/e90-art-quality-audit.md')),e90.auditDocSha256);
for(const img of e90.evidencePngs)assert.equal(sha256(read(img.file)),img.sha256);
const rebuilt=manifest(root+'SHA256SUMS');
assert.equal(manifest(replay+'SHA256SUMS'),rebuilt);
assert.deepEqual(read(root+'SHA256SUMS'),read(replay+'SHA256SUMS'));
const result=json(root+'benchmark.json'),cfg=json('benchmarks/fixtures/e91s/study.json');
assert.ok(result.cases.slice(0,3).every((p:{errors:string[]})=>p.errors.length===0));
const hold=result.cases.find((p:{role:string})=>p.role==='holdout');
assert.equal(hold.seed,cfg.holdout.seed);
assert.deepEqual(hold.errors.map((e:string)=>e.slice(0,2)),['s1','s2','s3']);
for(const r of [cfg.preflight,cfg.containmentPreflight]){
  const path='benchmarks/fixtures/e91s/'+r.previous;
  assert.equal(sha256(read(path)),r.originalFreezeSha256);
  assert.equal(sha256(read(join(dirname(path),'study.json'))),r.originalStudySha256);
}
const {holdout}=cfg,e91=json('benchmarks/fixtures/e91/study.json');
const {profile,spec}=await loadArtDirection(json(e91.direction.file));
const {character,device}=crossAssetStyle(profile,spec);assert.ok(character);
const input=json(holdout.legacy),pose=holdout.pose;
const rig=legacyBody(holdout,holdout.seed,{...input,spec:{...input.spec,pose:{...input.spec.pose,...pose}},matched:{near:pose.near,far:pose.far}});
const baseline=recoverCostume(renderQualityCharacter(holdout,holdout.seed,rig,'b3',character,device,true,e91.e90),rig.plan,'a-line',character,false);
const variants=identitySteps(baseline,rig.plan,holdout,character);
const pixelBounds=(r:ReturnType<typeof decodePng>)=>{
  const pixels=maskPixels(r),x=pixels.map(i=>i%r.w);
  return {top:Math.floor(pixels[0]/r.w),left:Math.min(...x),right:Math.max(...x),bottom:Math.floor(pixels.at(-1)!/r.w)};
};
const diagnostic=Object.entries(variants).map(([stage,r])=>{
  const bytes=read(root+hold.scope+'/'+stage+'/sprite.png');
  assert.equal(sha256(encodePng(r.final)),sha256(bytes));
  const bounds=pixelBounds(r.final), hat=pixelBounds(r.layers.find(p=>p.id==='oilskin')!.mask);
  const topInk=maskPixels(r.final).filter(i=>i<64).map(i=>[i,r.final.rgba.readUInt32BE(i*4)]);
  const stance=requireCostumeStance(wardrobeLayers(r,rig.plan,'a-line').stance,e91.limits.minimumLegGapRows);
  assert.equal(bounds.bottom,rig.plan.pivot[1]-1);
  assert.ok(occupied(r.final,rig.plan.pivot[0],rig.plan.pivot[1]-1));
  const grips=r.props.map(prop=>{
    const hand=r.layers.find(p=>p.id===prop.hand)!.mask, tool=composite(prop.masks);
    const arm=r.layers.find(p=>p.id===prop.hand.replace('hand','forearm'))!.mask;
    const [x,y]=prop.socket, handAtSocket=occupied(hand,x,y), toolAtSocket=occupied(tool,x,y);
    const wristConnection=maskPixels(hand).filter(i=>arm.rgba[i*4+3]===255).length;
    const overlap=maskPixels(tool).filter(i=>hand.rgba[i*4+3]===255).length;
    const paint=r.ownership.rgba.readUInt32BE((y*64+x)*4);
    assert.ok(handAtSocket&&toolAtSocket&&wristConnection>=2&&overlap>=e91.limits.minimumGripOverlap);
    assert.equal(paint,r.labels[prop.hand]);
    return {hand:prop.hand,id:prop.id,overlap,wristConnection,socket:[x,y]};
  });
  assert.equal(bounds.top,stage==='s0'?hat.top-1:0);
  return {stage,bounds,hat,topInk,stance,grips,paddingGate:bounds.top>=e91.limits.padding?'PASS':'FAIL',
    scope:'independent diagnostics; primary gate and outcome remain unchanged'};
});

const studio=resolve('../LumaSprite-Studio');
const revision=git('-C',studio,'rev-parse','HEAD');
assert.equal(revision,'471ac90555d3545beff5182146e291ba97b9ae20');
assert.equal(git('-C',studio,'status','--porcelain'),'');
const url=(file:string)=>pathToFileURL(join(studio,file)).href;
const {readStudioPng}=await import(url('studio/pixel/read-png.ts'));
const {celFor,newDocument}=await import(url('src/studio/pixel/model.ts'));
const {PixelStore}=await import(url('src/node/studio/pixel-store.ts'));
const {exportPixel}=await import(url('src/node/studio/pixel-render.ts'));
const cache=resolve('.cache');mkdirSync(cache,{recursive:true});
const workspace=mkdtempSync(join(cache,'e91s-studio-'));
assert.ok(workspace.startsWith(cache+sep+'e91s-studio-'));
const samples=[];
try{
  const store=new PixelStore(workspace);
  for(const row of result.cases as Array<{scope:string}>)for(const name of ['s0/sprite','s3/sprite','s3/night']){
    const file=row.scope+'/'+name+'.png';
    const bytes=read(root+file);
    assert.equal(sha256(bytes),result.files[file]);
    const decoded=decodePng(bytes);
    const pixels:Uint32Array=await readStudioPng(new Blob([Uint8Array.from(bytes)]),decoded.w,decoded.h);
    assert.equal(pixels.length,decoded.w*decoded.h);
    assert.ok(pixels.every((value,i)=>value===decoded.rgba.readUInt32BE(i*4)));
    const doc=newDocument(file,decoded.w,decoded.h),asset=doc.assets[0],frame=asset.frames[0];
    celFor(asset,asset.layers[0].id,frame.id,true).data.set(pixels);
    const {id}=store.create(doc.name,decoded.w,decoded.h,0,doc);
    const saved=store.load(id,true);store.save(id,saved.revision,saved,'E9.1S study PNG');
    const output=exportPixel({document:store.load(id,true),assetId:asset.id,frameId:frame.id,format:'png'});
    assert.deepEqual(decodePng(Buffer.from(output.data)),decoded);
    samples.push({file,sha256:sha256(bytes),rgbaSha256:sha256(decoded.rgba)});
  }
}finally{
  rmSync(workspace,{recursive:true,force:true});
}
assert.equal(git('-C',studio,'status','--porcelain'),'');
const qa={status:result.status,historical,catalogs,e90EvidencePngs:e90.evidencePngs.length,rebuilt,
  studio:{revision,mode:'RAW_PNG_ONLY',samples},staticScenes:32,diagnostic,unityRuntime:'NOT_RUN'};
writeFileSync(root+'technical-qa.json',JSON.stringify(qa,null,2)+'\n');
console.log({status:qa.status,historical,catalogs,rebuilt,studio:samples.length,staticScenes:qa.staticScenes,
  padding:diagnostic.map(r=>[r.stage,r.bounds.top,r.hat.top,r.stance.visibleGapRows])});
