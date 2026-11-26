import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir,mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { basename,join,resolve,sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const root='benchmarks/results/e72a/';
const directory=resolve(process.env.LUMASPRITE_STUDIO_ROOT??'../LumaSprite-Studio');
const url=(name:string)=>pathToFileURL(join(directory,name)).href;
const publish=process.env.LUMASPRITE_PUBLISH_E72A==='1';
const pack=(data:unknown)=>JSON.stringify(data,null,2)+'\n';

test('Studio Workbench accepts all material and ruins review pairs and retains PNG pixels',async t=>{
  const revision=execFileSync('git',['rev-parse','--short=7','HEAD'],{cwd:directory,encoding:'utf8'}).trim();
  const {createEmptyReviewSession,serializeReviewJson,parseReviewJson}=await import(url('src/studio/art-review/report.ts'));
  const {DEFAULT_WORKBENCH_RUBRIC}=await import(url('src/studio/art-review/rubrics.ts'));
  const {readStudioPng}=await import(url('studio/pixel/read-png.ts'));
  const {celFor,newDocument}=await import(url('src/studio/pixel/model.ts'));
  const {PixelStore}=await import(url('src/node/studio/pixel-store.ts'));
  const {exportPixel}=await import(url('src/node/studio/pixel-render.ts'));
  const cases=[];
  const {variants}=JSON.parse(await readFile(root+'ruin-review/index.json','utf8')) as {
    variants:{layout:string;light:string;variant:string;paths:{native:string}}[];
  };
  const pairs=['relay','receiver'].map(id=>({id,family:'prop',base:root+id+'/m0/native.png',candidate:root+id+'/m1/native.png',
    note:'Material pilot. Both variants share a locked silhouette and placement. Human review pending.'}));
  for(const row of variants.filter(item=>item.variant!=='production')){
    const base=variants.find(item=>item.variant==='production'&&item.layout===row.layout&&item.light===row.light)!;
    pairs.push({id:[row.layout,row.light,row.variant].join('-'),family:'environment',base:base.paths.native,candidate:row.paths.native,
      note:row.variant==='bonded'?'Bonded Fracture. Compare at native scale; independent art review pending.':
        row.layout==='r1'?'Project Owner: R1 Structure Q RESEARCH_ONLY. Score sheet pending.':
          'Project Owner: H1 Structure Q REVISION_REQUIRED. Score sheet pending.'});
  }
  const reviews=[];
  if(publish)await mkdir(root+'review',{recursive:true});
  for(const row of pairs){
    const legacy=row.id==='r1-day-q'?'r1-q':row.id==='h1-day-q'?'h1-q':row.id==='h2-day-bonded'?'h2-bonded':undefined;
    const file=legacy?'benchmarks/results/e71r/review/'+legacy+'.workbench.json':root+'review/'+row.id+'.workbench.json';
    const base=await readFile(row.base),candidate=await readFile(row.candidate);
    if(publish&&!legacy){
      const session=createEmptyReviewSession(row.family,DEFAULT_WORKBENCH_RUBRIC);
      session.summaryNote=row.note;
      for(const [slot,source,bytes] of [['baseline',row.base,base],['candidate',row.candidate,candidate]] as const){
        const raster=decodePng(bytes);
        session[slot+'Ref']={slot,name:row.id+' '+slot,fileName:basename(source),sourceSha256:sha256(bytes),
          frameWidth:raster.w,frameHeight:raster.h,sourceWidth:raster.w,sourceHeight:raster.h,frameCount:1,
          frameDurationsMs:[100],timingSource:'single-frame'};
      }
      await writeFile(file,serializeReviewJson(session)+'\n',{flag:'wx'});
    }
    const review=parseReviewJson(await readFile(file,'utf8'));
    assert.equal(review.assetFamily,row.family);
    assert.equal(review.decision,'undecided');
    assert.ok(Object.values(review.scores as Record<string,{score:number|null}>).every(score=>score.score===null));
    assert.equal(review.baselineRef.sourceSha256,sha256(base));
    assert.equal(review.candidateRef.sourceSha256,sha256(candidate));
    reviews.push({id:row.id,family:row.family,baseline:row.base,candidate:row.candidate,file});
  }
  assert.equal(reviews.length,12);

  const cache=resolve('.cache');
  await mkdir(cache,{recursive:true});
  const scratch=await mkdtemp(join(cache,'e72a-studio-'));
  assert.ok(scratch.startsWith(cache+sep+'e72a-studio-')&&scratch.length>(cache+sep+'e72a-studio-').length);
  t.after(()=>rm(scratch,{recursive:true,force:true}));
  const store=new PixelStore(scratch);
  for(const file of ['relay/m0/native.png','relay/m1/native.png','relay/m1/material.png','relay/m1/context.png',
    'receiver/m0/native.png','receiver/m1/native.png','ruin-review/h2/night/bonded/occlusion.png']){
    const bytes=await readFile(root+file), raster=decodePng(bytes);
    const pixels:Uint32Array=await readStudioPng(new Blob([Uint8Array.from(bytes)]),raster.w,raster.h);
    assert.equal(pixels.length,raster.w*raster.h);
    for(const [i,ink] of pixels.entries())assert.equal(ink,raster.rgba.readUInt32BE(i*4));
    const doc=newDocument(file,raster.w,raster.h);
    const asset=doc.assets[0],frame=asset.frames[0],layer=asset.layers[0];
    celFor(asset,layer.id,frame.id,true).data.set(pixels);
    const {id}=store.create(doc.name,raster.w,raster.h,0,doc);
    const original=store.load(id,true);
    store.save(id,original.revision,original,'Save review PNG');
    const reopened=store.load(id,true);
    const output=exportPixel({document:reopened,assetId:asset.id,frameId:frame.id,format:'png'});
    assert.deepEqual(decodePng(Buffer.from(output.data)),raster);
    cases.push({file,canvas:[raster.w,raster.h],rgbaSha256:sha256(raster.rgba)});
  }
  const index=pack({schemaVersion:1,reviews});
  if(publish)await writeFile(root+'review/index.json',index,{flag:'wx'});
  else assert.equal(await readFile(root+'review/index.json','utf8'),index);
  const info=pack({revision,mode:'RAW_PNG_ONLY',cases,workbenchReviews:reviews.length});
  const output=publish?root:'benchmarks/results/run/e72a/';
  await mkdir(output,{recursive:true});
  await writeFile(output+'studio-parity.json',info);
  t.diagnostic('Studio '+revision+': 7 pixel-exact PNGs and 12 Workbench review pairs.');
});
