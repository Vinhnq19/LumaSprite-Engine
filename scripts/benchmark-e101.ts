import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { fillPolygon } from '../src/core/geometry/shapes.ts';
import { pack } from '../src/core/palette/colors.ts';
import { composite, makeRaster, put, silhouette, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { inspectPng, sha256 } from '../src/quality/raster.ts';
import { draftProvenance, importDraftComponent, type ComponentDescriptor } from './e101-component-intake.ts';

const {values}=parseArgs({options:{publish:{type:'boolean'}}});
const root=values.publish?'benchmarks/results/e101/':'benchmarks/results/run/e101/';
const input='benchmarks/fixtures/e101/reference-source.json';
const read=(path:string)=>readFileSync(path);
const text=(value:unknown)=>JSON.stringify(value,null,2)+'\n';
const json=(path:string)=>JSON.parse(read(path).toString('utf8'));
const sourceSha256=sha256(read(input));
const closeout='996b01032d346d69e808e80d2fd62d1f3efe1dd8', studioRevision='471ac90555d3545beff5182146e291ba97b9ae20';
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
const name=z.string().regex(/^[a-z][a-z0-9-]+$/);
const coordinate=z.number().int().min(1).max(63);
const point=z.tuple([coordinate,coordinate]);
const plate=z.strictObject({id:name,group:name,brief:name,title:z.string().min(1),intendedUse:z.string().min(1),
  proposedFeatures:z.array(z.string().min(1)).min(1),forbiddenCopying:z.string().min(1),
  layers:z.array(z.strictObject({id:name,shapes:z.array(z.strictObject({
    ink:z.string().min(1),points:z.array(point).min(3),
  })).min(1)})).min(1)});
const source=z.strictObject({schema:z.literal('lumasprite.e101.reference-source.v1'),canvas:z.tuple([z.literal(64),z.literal(64)]),
  view:z.literal('three-quarter-right'),light:z.literal('upper-left'),style:name,revision:z.literal(1),
  provenance:draftProvenance,palette:z.record(z.string(),z.string().regex(/^#[0-9a-f]{6}$/)),
  proof:z.strictObject({plate:name,owner:name,behind:name,anchors:z.strictObject({grip:point,wrist:point}),
    allowedRect:z.tuple([coordinate,coordinate,coordinate,coordinate]),
    edit:z.strictObject({from:z.string(),to:z.string(),intent:z.string().min(1)})}),plates:z.array(plate).min(1),
}).parse(json(input));
const {proof}=source;
const palette=Object.values(source.palette);
assert.equal(new Set(palette).size,palette.length);
const groups=['overall-silhouette','head-and-face','body-proportions','outfit-and-garment','material-clusters',
  'pixel-shading','equipment','hand-grip','outline-hierarchy'];
assert.deepEqual([...new Set(source.plates.map(p=>p.group))].sort(),groups.slice().sort());
assert.equal(new Set(source.plates.map(p=>p.id)).size,source.plates.length);

const files:Record<string,string>={};
function save(name:string,bytes:string|Buffer) {
  mkdirSync(dirname(root+name),{recursive:true});
  writeFileSync(root+name,bytes);
  files[name]=sha256(bytes);
  return files[name];
}
function png(name:string,image:Raster) {
  const bytes=encodePng(image);
  assert.deepEqual(inspectPng(image,bytes,image),[]);
  return save(name+'.png',bytes);
}
const blank=()=>makeRaster(64,64);
const layer=(definition:z.infer<typeof plate>['layers'][number])=>{
  const raster=blank();
  for(const polygon of definition.shapes) {
    assert.ok(Object.hasOwn(source.palette,polygon.ink),polygon.ink);
    fillPolygon(raster,polygon.points,pack(source.palette[polygon.ink]));
  }
  return raster;
};
const referenceRows=[];
let owner:Raster|undefined, behind:Raster|undefined;
for(const study of source.plates) {
  assert.equal(new Set(study.layers.map(p=>p.id)).size,study.layers.length);
  const layers=new Map(study.layers.map(p=>[p.id,layer(p)]));
  const image=composite([...layers.values()]);
  const file='references/'+study.id;
  const digest=png(file,image);
  const {layers:sourceLayers,...summary}=study;
  referenceRows.push({...summary,kind:'REFERENCE_STUDY',source:input,sourceSha256,revision:source.revision,
    plateSha256:sha256(text(sourceLayers)),pngPath:'benchmarks/results/e101/'+file+'.png',pngSha256:digest,
    extent:[64,64],view:source.view,style:source.style,light:source.light,provenance:source.provenance,
    license:null,licenseStatus:'INTERNAL_REVIEW_SCOPE_ONLY',approvedFeatures:[],humanReview:'PENDING'});
  if(study.id===proof.plate) {owner=layers.get(proof.owner);behind=layers.get(proof.behind);}
}

const historical=json('benchmarks/results/e9h1-closeout/benchmark.json');
const diagnosticRows=historical.references.map((row:{id:string;source:string;sha256:string;role:string;preserve:string;avoid:string;provenance:string;humanApproval:string})=>{
  assert.equal(row.humanApproval,'PENDING');
  const bytes=read(row.source), image=decodePng(bytes);
  assert.equal(sha256(bytes),row.sha256,row.id);
  return {id:row.id,kind:'DIAGNOSTIC_REFERENCE',pngPath:row.source,pngSha256:row.sha256,view:source.view,
    extent:[image.w,image.h],style:historical.style,intendedUse:row.role,proposedFeatures:[row.preserve],forbiddenCopying:row.avoid,
    source:row.source,provenance:row.provenance,license:null,licenseStatus:'RESEARCH_DIAGNOSTIC_ONLY',approvedFeatures:[],humanReview:'PENDING'};
});
assert.equal(diagnosticRows.length,9);
save('reference-pack.json',text({schema:'lumasprite.e101.reference-pack.v1',state:'PENDING_OWNER_ART_DIRECTION',checkpoint:closeout,
  referenceGroups:groups,candidates:referenceRows,diagnostics:diagnosticRows}));

assert.ok(owner&&behind,'Missing proof layers');
const mask=silhouette(owner,0xffffffff);
const originalMeta:ComponentDescriptor={
  schema:'lumasprite.e101.component-intake.v1',state:'DRAFT',id:'kiln-glove-study',ownerPart:proof.owner,
  extent:source.canvas,view:source.view,palette,revision:1,parent:null,anchors:proof.anchors,
  sourceSha256,pngSha256:png('proof/input-r1',owner),maskSha256:png('proof/ownership',mask),provenance:source.provenance,
};
const originalDescriptor=save('proof/r1.json',text(originalMeta));
const maskBytes=read(root+'proof/ownership.png'), inputBytes=read(root+'proof/input-r1.png');
const original=importDraftComponent(json(root+'proof/r1.json'),inputBytes,maskBytes);
assert.deepEqual(original.raster,owner);
const [gx,gy]=original.metadata.anchors.grip, iGrip=gy*64+gx;
assert.ok(behind.rgba[iGrip*4+3]===255&&original.raster.rgba[iGrip*4+3]===255,'Grip anchor must intersect both layers');
const preview=(component:Raster)=>composite([behind,component]);
const before=preview(original.raster), marks=blank();
const shafts=[0,0];
for(let i=0;i<4096;i++) if(behind.rgba[i*4+3]&&!original.raster.rgba[i*4+3]) {
  if(i%64<gx)shafts[0]++;
  if(i%64>gx)shafts[1]++;
}
assert.ok(shafts.every(n=>n>0),'Shaft must remain visible on both sides');
for(const [id,[x,y]] of Object.entries(original.metadata.anchors)) for(let d=-2;d<=2;d++){
  const color=pack(id==='grip'?'#92e9cd':'#ffce81');
  put(marks,x+d,y,color);
  put(marks,x,y+d,color);
}
png('proof/anchor-preview',composite([before,marks]));
png('proof/shaft-context',behind);
png('proof/preview-r1',before);
const region=blank(), delta=blank();
const edited={...original.raster,rgba:Buffer.from(original.raster.rgba)};
const [l,t,r,b]=proof.allowedRect;
assert.ok(l<r&&t<b,'Invalid edit rectangle');
assert.ok(Object.hasOwn(source.palette,proof.edit.from)&&Object.hasOwn(source.palette,proof.edit.to));
const from=pack(source.palette[proof.edit.from]),to=pack(source.palette[proof.edit.to]);
assert.notEqual(from,to,'Edit must change tone');
for(let y=t;y<b;y++) for(let x=l;x<r;x++) {
  const i=(y*64+x)*4;
  if(!original.mask.rgba[i+3])continue;
  put(region,x,y,0xffffffff);
  if(edited.rgba.readUInt32BE(i)===from)put(edited,x,y,to);
}
const revisedMeta:ComponentDescriptor={...originalMeta,revision:2,parent:originalDescriptor,pngSha256:png('proof/export-r2',edited)};
save('proof/r2.json',text(revisedMeta));
const revised=importDraftComponent(json(root+'proof/r2.json'),read(root+'proof/export-r2.png'),maskBytes);
assert.deepEqual(revised.metadata.provenance,original.metadata.provenance);
assert.deepEqual(revised.metadata.anchors,original.metadata.anchors);
assert.deepEqual(revised.mask,original.mask);
const after=preview(revised.raster);
let changed=0,outside=0,previewChanged=0;
for(let i=0;i<4096;i++){
  const at=i*4;
  const local=original.raster.rgba.readUInt32BE(at)!==revised.raster.rgba.readUInt32BE(at);
  const previewEdit=before.rgba.readUInt32BE(at)!==after.rgba.readUInt32BE(at);
  if((local||previewEdit)&&!region.rgba[at+3])outside++;
  if(local){changed++;put(delta,i%64,Math.floor(i/64),pack('#ffce81'));}
  if(previewEdit)previewChanged++;
}
assert.ok(changed>0);
assert.equal(outside,0);
assert.equal(changed,previewChanged);
png('proof/allowed-mask',region);
png('proof/diff',delta);
png('proof/preview-r2',after);
const rollback=importDraftComponent(originalMeta,read(root+'proof/input-r1.png'),maskBytes);
assert.deepEqual(rollback.raster,original.raster);
assert.deepEqual(preview(rollback.raster),before);

const studio=resolve('../LumaSprite-Studio');
assert.equal(git('-C',studio,'rev-parse','HEAD'),studioRevision);
assert.equal(git('-C',studio,'status','--porcelain'),'');
const uri=(path:string)=>pathToFileURL(join(studio,path)).href;
const {readStudioPng}=await import(uri('studio/pixel/read-png.ts'));
const {celFor,newDocument}=await import(uri('src/studio/pixel/model.ts'));
const {PixelStore}=await import(uri('src/node/studio/pixel-store.ts'));
const {exportPixel}=await import(uri('src/node/studio/pixel-render.ts'));
const cache=resolve('.cache');
mkdirSync(cache,{recursive:true});
const temporary=mkdtempSync(join(cache,'e101-studio-'));
assert.ok(temporary.startsWith(cache+sep+'e101-studio-'));
const studioImages=[];
try {
  const store=new PixelStore(temporary);
  for(const name of ['input-r1','export-r2','preview-r1','preview-r2']){
    const bytes=read(root+'proof/'+name+'.png'), source=decodePng(bytes);
    const rgba:Uint32Array=await readStudioPng(new Blob([Uint8Array.from(bytes)]),64,64);
    assert.ok(rgba.length===4096&&rgba.every((p,i)=>p===source.rgba.readUInt32BE(i*4)),name);
    const doc=newDocument(name,64,64), asset=doc.assets[0], frame=asset.frames[0];
    celFor(asset,asset.layers[0].id,frame.id,true).data.set(rgba);
    const {id}=store.create(doc.name,64,64,0,doc);
    const loaded=store.load(id,true);
    store.save(id,loaded.revision,loaded,'Verify E10.1 exact component pixels');
    const exported=exportPixel({document:store.load(id,true),assetId:asset.id,frameId:frame.id,format:'png'});
    const returned=decodePng(Buffer.from(exported.data));
    assert.deepEqual(returned,source,name);
    studioImages.push({name,pngSha256:sha256(bytes),rgbaSha256:sha256(returned.rgba)});
  }
} finally {
  rmSync(temporary,{recursive:true});
}
assert.equal(git('-C',studio,'status','--porcelain'),'');
const report={status:'TECHNICAL_VALID',owner:'PENDING',authority:'ASSISTANT_REVIEW_RECOMMENDATION',
  checkpoint:closeout,source:{path:input,sha256:sourceSha256,creator:source.provenance.creator,state:'DRAFT'},
  refs:{groups:groups.length,candidates:referenceRows.length,diagnostics:diagnosticRows.length},
  proof:{component:originalMeta.id,width:64,height:64,ownershipPixels:original.pixels,anchors:proof.anchors,
    shaftVisibleOnGripSides:shafts,editIntent:proof.edit.intent,changed,outside,previewChanged,rollbackRgbaSha256:sha256(rollback.raster.rgba),
    revision1RgbaSha256:sha256(original.raster.rgba),revision2RgbaSha256:sha256(revised.raster.rgba),
    revisions:[{revision:1,sha256:files['proof/r1.json']},{revision:2,sha256:files['proof/r2.json'],parent:originalDescriptor}]},
  studio:{revision:studioRevision,operation:'PNG_IMPORT_DOCUMENT_SAVE_PNG_EXPORT',samples:studioImages},
  files};
save('workflow-proof.json',text(report));
writeFileSync(root+'SHA256SUMS',Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([p,h])=>h+'  '+p).join('\n')+'\n');
console.log(report.status,report.refs,'changed',changed,'outside',outside,'Studio',studioImages.length);
