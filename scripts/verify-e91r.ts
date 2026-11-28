import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { join,resolve,sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const result='benchmarks/results/e91r/';
const replay='benchmarks/results/run/e91r/';
const json=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
const manifest=(file:string,dir:string)=>{
  const rows=readFileSync(file,'utf8').trim().split(/\r?\n/);
  for(const row of rows){
    const [wanted,name]=row.split('  ');
    assert.equal(sha256(readFileSync(join(dir,name))),wanted,join(dir,name));
  }
  return rows.length;
};
const v9='a37870e1806c306790a8a2c01364fc57d57f9b12';
const source='2fa4f441b319eca97b0e993688637e6f52a56c4c';
assert.equal(git('rev-parse',v9+'^'),source);
git('diff','--exit-code',v9,'--','src/generators','src/specs','src/cli','src/server','src/experiments/character-v4.ts',
  'scripts/benchmark-e91.ts','benchmarks/fixtures/e91','benchmarks/results/e91','docs/reports/E9.1-CHARACTER-ART-QUALITY-REVIEW.html',
  'docs/art-quality/art-quality-rubric-v2.json','docs/art-quality/art-quality-rubric-v2-static-addendum.md',
  'package.json','package-lock.json','LICENSE','LICENSE.md','NOTICE');
const historical=Object.entries<number>(json('docs/e53-evidence.json').catalogs)
  .reduce((sum,[file,expected])=>{const count=manifest('docs/'+file,'.');assert.equal(count,expected);return sum+count;},0);
assert.equal(historical,805);
const catalogs=Object.fromEntries(Object.entries({e76r:142,e8:42,e83:52,e85:56,e90:3,e91:616}).map(([id,count])=>{
  const root='benchmarks/results/'+id+'/';
  assert.equal(manifest(root+'SHA256SUMS',root),count);
  return [id,count];
}));
for(const id of ['e90','e91']){
  const verified=json('benchmarks/results/'+id+'/portable-verification.json');
  assert.equal(sha256(readFileSync(verified.html??verified.report)),verified.sha256);
}
const audit=json('benchmarks/results/e90/audit-evidence.json');
assert.equal(sha256(readFileSync(audit.rubricV2.file)),audit.rubricV2.sha256);
assert.equal(sha256(readFileSync('docs/reports/e90-art-quality-audit.md')),audit.auditDocSha256);
for(const item of audit.evidencePngs)assert.equal(sha256(readFileSync(item.file)),item.sha256);
const count=manifest(result+'SHA256SUMS',result);
assert.equal(manifest(replay+'SHA256SUMS',replay),count);
assert.deepEqual(readFileSync(result+'SHA256SUMS'),readFileSync(replay+'SHA256SUMS'));

const studio=resolve('../LumaSprite-Studio');
const revision=git('-C',studio,'rev-parse','HEAD');
assert.equal(revision,'471ac90555d3545beff5182146e291ba97b9ae20');
assert.equal(git('-C',studio,'status','--porcelain'),'');
const pathAt=(file:string)=>pathToFileURL(join(studio,file)).href;
const {readStudioPng}=await import(pathAt('studio/pixel/read-png.ts'));
const {celFor,newDocument}=await import(pathAt('src/studio/pixel/model.ts'));
const {PixelStore}=await import(pathAt('src/node/studio/pixel-store.ts'));
const {exportPixel}=await import(pathAt('src/node/studio/pixel-render.ts'));
const cache=resolve('.cache');
mkdirSync(cache,{recursive:true});
const workspace=mkdtempSync(join(cache,'e91r-studio-'));
assert.ok(workspace.startsWith(cache+sep+'e91r-studio-'));
const benchmarks=json(result+'benchmark.json');
const pngs=[];
try{
  const store=new PixelStore(workspace);
  for(const row of benchmarks.cases as Array<{scope:string;role:string}>){
    const variant=row.role==='holdout'?'b3-field':'recovered-field';
    for(const diagnostic of ['sprite','parts','night']){
      const file=row.scope+'/'+variant+'/'+diagnostic+'.png';
      const bytes=readFileSync(result+file);
      assert.equal(sha256(bytes),benchmarks.files[file]);
      const decoded=decodePng(bytes);
      const pix:Uint32Array=await readStudioPng(new Blob([Uint8Array.from(bytes)]),decoded.w,decoded.h);
      assert.equal(pix.length,decoded.w*decoded.h);
      assert.ok(pix.every((value,i)=>value===decoded.rgba.readUInt32BE(i*4)));
      const doc=newDocument(file,decoded.w,decoded.h),asset=doc.assets[0],frame=asset.frames[0];
      celFor(asset,asset.layers[0].id,frame.id,true).data.set(pix);
      const {id}=store.create(doc.name,decoded.w,decoded.h,0,doc);
      const saved=store.load(id,true);
      store.save(id,saved.revision,saved,'E9.1R PNG verification');
      const output=exportPixel({document:store.load(id,true),assetId:asset.id,frameId:frame.id,format:'png'});
      assert.deepEqual(decodePng(Buffer.from(output.data)),decoded);
      pngs.push({file,sha256:sha256(bytes),rgbaSha256:sha256(decoded.rgba)});
    }
  }
}finally{
  rmSync(workspace,{recursive:true,force:true});
}
assert.equal(git('-C',studio,'rev-parse','HEAD'),revision);
assert.equal(git('-C',studio,'status','--porcelain'),'');
const qa={historical,catalogs,htmlE90E91:'MATCH',deterministicFiles:count,studio:{revision,mode:'RAW_PNG_ONLY',pngs},
  verifiedScenes:benchmarks.cases.reduce((sum:number,row:{variants:unknown[]})=>sum+row.variants.length*2,0),
  production:'UNCHANGED',runtime:'NOT_RUN',art:'STATIC_ART_REVIEW_PENDING'};
writeFileSync(result+'technical-qa.json',JSON.stringify(qa,null,2)+'\n');
console.log({historical,catalogs,deterministicFiles:count,studio:pngs.length,scenes:qa.verifiedScenes});
