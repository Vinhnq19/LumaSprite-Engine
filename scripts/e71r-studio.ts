import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir,mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { basename,join,resolve,sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const old='benchmarks/results/e71/';
const current='benchmarks/results/e71r/';
const studio=resolve(process.env.LUMASPRITE_STUDIO_ROOT??'../LumaSprite-Studio');
const url=(name:string)=>pathToFileURL(join(studio,name)).href;
const publish=process.env.LUMASPRITE_PUBLISH_E71R==='1';
const reportRoot=publish?current:'benchmarks/results/run/e71r/';
const pack=(data:unknown)=>JSON.stringify(data,null,2)+'\n';

test('Workbench accepts unscored E7.1 decisions and Studio preserves E7.1R PNG pixels',async t=>{
  const revision=execFileSync('git',['rev-parse','--short=7','HEAD'],{cwd:studio,encoding:'utf8'}).trim();
  const {createEmptyReviewSession,serializeReviewJson,parseReviewJson}=await import(url('src/studio/art-review/report.ts'));
  const {DEFAULT_WORKBENCH_RUBRIC}=await import(url('src/studio/art-review/rubrics.ts'));
  const {readStudioPng}=await import(url('studio/pixel/read-png.ts'));
  const {celFor,newDocument}=await import(url('src/studio/pixel/model.ts'));
  const {PixelStore}=await import(url('src/node/studio/pixel-store.ts'));
  const {exportPixel}=await import(url('src/node/studio/pixel-render.ts'));
  const records=[
    {id:'relay',family:'prop',base:old+'relay/a0/native.png',alt:old+'relay/a1/native.png',
      selection:'candidate',note:'Project Owner brief: A1 SELECTED_FOR_MATERIAL_REFINEMENT. Score sheet pending. Device semantics and material separation need work.'},
    {id:'r1-q',family:'environment',base:old+'ruin/r1/day/current/native.png',alt:old+'ruin/r1/day/candidate/native.png',
      selection:'undecided',note:'Project Owner brief: R1 Structure Q RESEARCH_ONLY. The silhouette change was marginal. Score sheet pending.'},
    {id:'h1-q',family:'environment',base:old+'ruin/h1/day/current/native.png',alt:old+'ruin/h1/day/candidate/native.png',
      selection:'undecided',note:'Project Owner brief: H1 Structure Q REVISION_REQUIRED. Some fractures look stair-stepped or machine-cut. Score sheet pending.'},
    {id:'h2-bonded',family:'environment',base:current+'h2/day/control/native.png',alt:current+'h2/day/bonded/native.png',
      selection:'undecided',note:'E7.1R holdout. Independent artistic review pending. Assistant observation: clearer tall break; the low parapet changes little at 1×.'},
  ];
  const reviews=[];
  await mkdir(join(reportRoot,'review'),{recursive:true});
  for (const row of records) {
    const path=join(reportRoot,'review',row.id+'.workbench.json');
    if (publish) {
      const session=createEmptyReviewSession(row.family,DEFAULT_WORKBENCH_RUBRIC);
      session.decision=row.selection;
      session.summaryNote=row.note;
      for (const [slot,source] of [['baseline',row.base],['candidate',row.alt]] as const) {
        const bytes=await readFile(source), raster=decodePng(bytes);
        session[slot+'Ref']={slot,name:row.id+' '+slot,fileName:basename(source),
          frameWidth:raster.w,frameHeight:raster.h,sourceWidth:raster.w,sourceHeight:raster.h,frameCount:1,
          sourceSha256:sha256(bytes),frameDurationsMs:[100],timingSource:'single-frame'};
      }
      await writeFile(path,serializeReviewJson(session)+'\n',{flag:'wx'});
    }
    const relative='review/'+row.id+'.workbench.json';
    const parsed=parseReviewJson(await readFile(current+relative,'utf8'));
    assert.equal(parsed.assetFamily,row.family);
    assert.equal(parsed.decision,row.selection);
    assert.ok(Object.values(parsed.scores as Record<string,{score:number|null}>).every(score=>score.score===null));
    assert.equal(parsed.baselineRef.sourceSha256,sha256(await readFile(row.base)));
    assert.equal(parsed.candidateRef.sourceSha256,sha256(await readFile(row.alt)));
    reviews.push(relative);
  }

  const cache=resolve('.cache');
  await mkdir(cache,{recursive:true});
  const scratch=await mkdtemp(join(cache,'e71r-studio-'));
  assert.ok(scratch.startsWith(cache+sep+'e71r-studio-')&&scratch.length>(cache+sep+'e71r-studio-').length);
  t.after(()=>rm(scratch,{recursive:true,force:true}));
  const store=new PixelStore(scratch);
  const cases=[];
  for(const file of ['r1/day/bonded/native.png','h1/day/bonded/flat.png',
    'h2/day/bonded/material.png','h2/night/bonded/native.png']) {
    const png=await readFile(current+file), raster=decodePng(png);
    const pixels:Uint32Array=await readStudioPng(new Blob([Uint8Array.from(png)]),raster.w,raster.h);
    assert.equal(pixels.length,raster.w*raster.h);
    for(const [i,ink] of pixels.entries()) assert.equal(ink,raster.rgba.readUInt32BE(i*4));
    const doc=newDocument(basename(file),raster.w,raster.h);
    const asset=doc.assets[0],frame=asset.frames[0],layer=asset.layers[0];
    celFor(asset,layer.id,frame.id,true).data.set(pixels);
    const {id}=store.create(doc.name,raster.w,raster.h,0,doc);
    const original=store.load(id,true);
    store.save(id,original.revision,original,'Save flattened E7.1R PNG');
    const reopened=store.load(id,true);
    const output=exportPixel({document:reopened,assetId:asset.id,frameId:frame.id,format:'png'});
    assert.deepEqual(decodePng(Buffer.from(output.data)),raster);
    cases.push({file,canvas:[raster.w,raster.h],rgbaSha256:sha256(raster.rgba)});
  }
  await writeFile(join(reportRoot,'studio-parity.json'),pack({revision,mode:'RAW_PNG_ONLY',cases,workbenchReviews:reviews}));
  t.diagnostic('Studio '+revision+': four pixel-exact PNGs and four Workbench reviews.');
});
