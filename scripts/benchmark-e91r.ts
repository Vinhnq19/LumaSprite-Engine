import assert from 'node:assert/strict';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { parseArgs } from 'node:util';
import { inkLuma,pack } from '../src/core/palette/colors.ts';
import { makeRaster, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng,encodePng } from '../src/core/renderer/png.ts';
import type { Point } from '../src/core/geometry/shapes.ts';
import { sha256 } from '../src/quality/raster.ts';
import { checkQualityCharacter,legacyBody,renderQualityCharacter,type Case,type Stage } from '../src/experiments/character-v4.ts';
import { recoverCostume,wardrobeLayers,type Wardrobe } from '../src/experiments/character-v4-recovery.ts';
import { costumeStanceVersion,requireCostumeStance } from '../src/experiments/costume-stance.ts';
import { crossAssetStyle,loadArtDirection } from '../src/experiments/art-direction.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { loadComposition } from '../src/generators/environment/composition.ts';
import { renderEnvironment } from '../src/generators/environment/render.ts';
import type { PilotBrief } from '../src/experiments/cross-asset-pilot.ts';

const {values}=parseArgs({options:{development:{type:'boolean'},freeze:{type:'boolean'},publish:{type:'boolean'}}});
assert.ok(Object.values(values).filter(Boolean).length<=1);
const read=(path:string)=>readFileSync(path);
const json=(path:string)=>JSON.parse(read(path).toString('utf8'));
const contents=(data:unknown)=>JSON.stringify(data,null,2)+'\n';
const fixed='benchmarks/fixtures/e91r/study.json',seal='benchmarks/fixtures/e91r/candidate-freeze.json';
const study=json(fixed), old=json(study.parentStudy);
assert.equal(study.stanceRule,costumeStanceVersion);
assert.equal(study.criteria.minimumLegGapRows,old.limits.minimumLegGapRows);
assert.equal(study.criteria.minimumExposedSolePixels,2);
assert.deepEqual(study.criteria.sceneFootAnchor,old.pivot);
const frozenFiles=[fixed,study.parentStudy,'benchmarks/fixtures/e91/candidate-freeze.json',
  'benchmarks/fixtures/e75r/ridge.json','benchmarks/fixtures/e75r/marsh.json',old.direction.file,old.scene,
  'docs/art-quality/art-quality-rubric-v2.json','docs/art-quality/art-quality-rubric-v2-static-addendum.md',
  'scripts/benchmark-e91r.ts','src/experiments/character-v4.ts','src/experiments/character-v4-recovery.ts',
  'src/experiments/costume-stance.ts'];
const hashes=Object.fromEntries(frozenFiles.map(path=>[path,sha256(read(path).toString('utf8').replaceAll('\r\n','\n'))]));
const devRoot='.cache/e91r-development/';
if(values.freeze){
  const dev=json(devRoot+'benchmark.json');
  assert.equal(dev.status,'DEVELOPMENT_PASS');
  assert.deepEqual(hashes,dev.sources,'Development run differs from candidate');
  writeFileSync(seal,contents({version:1,selection:study.preferredStage,sources:hashes,
    procedure:'Harbor development and Marsh diagnostic passed; freeze recorded before first Cliffside render.',
    benchmarkSha256:sha256(read(devRoot+'benchmark.json')),holdout:study.holdout.id}),{flag:'wx'});
  process.exit(0);
}
if(!values.development)assert.deepEqual(json(seal).sources,hashes,'HOLDOUT_FREEZE_CHANGED');
const root=values.development?devRoot:values.publish?'benchmarks/results/e91r/':'benchmarks/results/run/e91r/';
const oldRoot='benchmarks/results/e91/';
const history=json(oldRoot+'benchmark.json');
const hashesOut: Record<string,string>={};
function save(name:string,data:Buffer|string){
  const file=join(root,name);
  mkdirSync(dirname(file),{recursive:true});
  writeFileSync(file,data);
  hashesOut[name]=sha256(data);
}
function savePng(folder:string,name:string,r:Raster){
  const png=encodePng(r);
  assert.deepEqual(decodePng(png),r);
  save(folder+'/'+name+'.png',png);
}
function pixels(r:Raster) {
  return Array.from({length:r.w*r.h},(_,i)=>i).filter(i=>r.rgba[i*4+3]===255);
}
function crop(r:Raster,[x,y]:Point){
  const w=25,h=25,left=Math.max(0,Math.min(r.w-w,x-12)),top=Math.max(0,Math.min(r.h-h,y-12));
  const out=makeRaster(w,h);
  for(let j=0;j<h;j++)r.rgba.copy(out.rgba,j*w*4,((top+j)*r.w+left)*4,((top+j)*r.w+left+w)*4);
  return out;
}
function difference(before:Raster,after:Raster){
  const out=makeRaster(64,64);
  const stats={added:0,removed:0,painted:0};
  for(let i=0;i<before.rgba.length;i+=4){
    if(before.rgba.readUInt32BE(i)===after.rgba.readUInt32BE(i))continue;
    const tag=!before.rgba[i+3]?'added':!after.rgba[i+3]?'removed':'painted';
    stats[tag]++;
    out.rgba.writeUInt32BE(pack({added:'#7ad3a6',removed:'#ef8b80',painted:'#ebbf70'}[tag]),i);
  }
  return {out,stats};
}

const {spec:art,profile}=await loadArtDirection(JSON.parse((await pinnedFile(old.direction)).toString('utf8')));
const {profile:style,character,device}=crossAssetStyle(profile,art);
assert.ok(character);
const scene: PilotBrief=JSON.parse((await pinnedFile({file:old.scene,sha256:old.sceneSha256})).toString('utf8'));
const base=await loadComposition(scene.scene);
const actor='courier', spawn=base.spec.spawns.find(x=>x.actor===actor)!;
const environment={...base.environment,style,spec:{...base.environment.spec,building:{...base.environment.spec.building,...scene.architecture}}};
const initial=environment.assets.get(actor)!;
type Render=ReturnType<typeof renderQualityCharacter>;
function context(r:Render, light:'day'|'night'){
  const assets=new Map(environment.assets);
  const colors=new Set(pixels(r.final).map(i=>r.final.rgba.readUInt32BE(i*4)));
  assets.set(actor,{...initial,raster:r.final,colors,ref:{...initial.ref,pivot:[...r.pivot],sha256:sha256(encodePng(r.final))}});
  const out=renderEnvironment({...environment,assets},'B',light,{composition:base.spec,kitSeed:base.kitSeed});
  const width=out.raster.w;
  const actorInk=pack(out.metadata.atlas.layerLegend.actor), p=new Set<number>();
  const pixel=(i:number)=>out.raster.rgba.readUInt32BE(i*4);
  const [left,top]=[spawn.at[0]-r.pivot[0],spawn.at[1]-r.pivot[1]];
  const edges=[];
  for(const i of pixels(r.final)){
    const x=i%64,y=Math.floor(i/64);
    const target=(top+y)*width+left+x;
    assert.ok(left+x>0 && left+x<width-1 && top+y>0 && top+y<out.raster.h-1);
    p.add(target);
    assert.equal(out.layerOverlay.rgba.readUInt32BE(target*4),actorInk,'ACTOR_OCCLUSION');
    assert.equal(pixel(target),r.final.rgba.readUInt32BE(i*4),'ACTOR_RGBA');
    const sides=[[i-1,target-1],[i+1,target+1],[i-64,target-width],[i+64,target+width]];
    for(const [native,canvas] of sides)if(!r.final.rgba[native*4+3])edges.push(Math.abs(inkLuma(pixel(target))-inkLuma(pixel(canvas))));
  }
  const camera=out.metadata.camera;
  assert.deepEqual([camera.width,camera.height,camera.pixelsPerUnit],[320,208,32]);
  assert.equal(out.metadata.occlusion.find(p=>p.id===actor)!.visible,p.size);
  return {out:out.raster,p,geometry:sha256(out.collisionPlane.rgba),camera,anchor:spawn.at,edge:{
    total:edges.length,weak:edges.filter(x=>x<study.criteria.nightWeakEdgeLuma).length,
    p10:edges.sort((a,b)=>a-b)[Math.floor(edges.length/10)]}};
}
function compareContext(a:ReturnType<typeof context>,b:ReturnType<typeof context>){
  assert.deepEqual([a.geometry,a.camera,a.anchor],[b.geometry,b.camera,b.anchor]);
  for(let i=0;i<a.out.w*a.out.h;i++)if(!a.p.has(i)&&!b.p.has(i))
    assert.equal(a.out.rgba.readUInt32BE(i*4),b.out.rgba.readUInt32BE(i*4),'BACKGROUND_RGBA');
}

const rows=[];
const controls=study.controls as Array<{id:string;role:string;seeds:number[];wardrobe:Wardrobe}>;
const fixtures=[...controls,...(values.development?[]:[study.holdout as typeof controls[number]])];
for(const entry of fixtures)for(const seed of entry.seeds){
  const fresh=entry.role==='holdout', scope=entry.id+'/'+seed;
  const recipe=(fresh?study.holdout:old.cases.find((c:Case)=>c.id===entry.id)) as Case;
  const data=json(recipe.legacy);
  const pose=study.holdout.pose;
  const lockedRig=fresh?{...data,spec:{...data.spec,pose:{...data.spec.pose,...pose}},matched:{near:pose.near,far:pose.far}}:data;
  const rig=legacyBody(recipe,seed,lockedRig);
  assert.deepEqual(rig.plan.pivot,old.pivot);
  const render=(stage:Stage,shared:boolean):Render=>renderQualityCharacter(recipe,seed,rig,stage,character,device,shared,old.e90);
  const a0=render('a0',true);
  const reference=new Map((['day','night'] as const).map(light=>[light,context(a0,light)]));
  const variants=[];
  const errors:string[]=[];
  const before=render('b3',false);
  const recovery=(stage:Stage,shared:boolean):Render=>recoverCostume(render(stage,shared),rig.plan,entry.wardrobe,character,!shared);
  const original=fresh?null:wardrobeLayers(before,rig.plan,entry.wardrobe);
  if(original){
    const ref=scope+'/b3/sprite.png';
    assert.equal(sha256(encodePng(before.final)),history.files[ref],ref);
    if(entry.role==='diagnostic')assert.throws(()=>requireCostumeStance(original.stance,old.limits.minimumLegGapRows),/STANCE_GAP/);
    savePng(scope+'/original','body-bare',original.body);
    savePng(scope+'/original','with-legs',original.base);
    savePng(scope+'/original','garment',original.garment);
    savePng(scope+'/original','body-worn',original.worn);
  }
  const variantsToRender:Array<{id:string;stage:Stage;shared:boolean}>=fresh?
    [{id:'a0',stage:'a0',shared:true},
      ...(['b1','b2','b3','b4'] as const).map(stage=>({id:stage,stage,shared:true})),
      ...(['b1','b2','b3','b4'] as const).map(stage=>({id:stage+'-field',stage,shared:false}))]:
    [{id:'recovered-shared',stage:'b3',shared:true},{id:'recovered-field',stage:'b3',shared:false},
      {id:'recovered-outline',stage:'b4',shared:false}];
  let previous:Render|undefined;
  for(const {id,stage,shared} of variantsToRender){
    const folder=scope+'/'+id;
    const r=recovery(stage,shared);
    const d=recovery(stage,shared);
    assert.deepEqual(r.final,d.final);
    assert.deepEqual(r.ownership,d.ownership);
    if(!fresh) {
      const fixedParts=(item:Render)=>item.layers.filter(p=>p.id!=='a-line-tunic').map(p=>[p.id,sha256(p.mask.rgba)]);
      const locked=render(stage,shared);
      assert.deepEqual(fixedParts(r),fixedParts(locked),'POSE_OR_NON_GARMENT_MASK_CHANGED');
      if(entry.wardrobe==='apron')assert.deepEqual(r.final,locked.final);
    }
    const relevant=stage==='a0'?null:wardrobeLayers(r,rig.plan,entry.wardrobe);
    let checks:null|ReturnType<typeof checkQualityCharacter>=null;
    try{
      if(relevant)requireCostumeStance(relevant.stance,old.limits.minimumLegGapRows);
      checks=checkQualityCharacter(r,old.limits);
      assert.ok(r.final.rgba.every((value,i)=>i%4!==3||value===0||value===255));
    }catch(error){errors.push(id+': '+String(error));}
    for(const [name,data] of Object.entries({sprite:r.final,silhouette:r.total,body:r.bodySilhouette,parts:r.ownership,
      materials:r.mat,outline:r.inkBoundary}))savePng(folder,name,data);
    if(relevant)for(const [name,data] of Object.entries({'body-bare':relevant.body,'with-legs':relevant.base,
      garment:relevant.garment,'body-worn':relevant.worn}))savePng(folder,name,data);
    for(const prop of r.props)savePng(folder,prop.hand.split('-')[0],crop(r.final,prop.socket));
    const compared:Render|undefined|null=stage==='a0'?null:fresh?(id.endsWith('field')&&stage==='b1'?null:previous):render(stage,shared);
    const diff=compared?difference(compared.final,r.final):null;
    if(diff)savePng(folder,'diff',diff.out);
    if(fresh&&compared&&stage==='b2'){
      const nonHand=(x:Render)=>x.layers.filter(p=>!p.id.endsWith('-hand')).map(p=>[p.id,sha256(p.mask.rgba)]);
      assert.deepEqual(nonHand(r),nonHand(compared),'B2_NON_HAND_MASK');
    }
    if(fresh&&compared&&(stage==='b3'||stage==='b4')){
      assert.deepEqual(r.ownership,compared.ownership);
      assert.deepEqual(r.mat,compared.mat);
    }
    if(stage==='b4'&&previous)assert.deepEqual(r.total,previous.total);
    previous=r;
    const scenes=[];
    for(const light of ['day','night'] as const){
      const ctx=context(r,light);
      compareContext(reference.get(light)!,ctx);
      savePng(folder,light,ctx.out);
      scenes.push({light,edge:ctx.edge,anchor:ctx.anchor,camera:ctx.camera});
    }
    variants.push({id,stage,shared,path:folder,sha256:hashesOut[folder+'/sprite.png'],checks,stance:relevant?.stance??null,
      hem:relevant?Math.floor((pixels(relevant.garment).at(-1)??-1)/64):null,delta:diff?.stats??null,scenes});
  }
  rows.push({id:entry.id,role:entry.role,seed,scope,brief:recipe.brief,wardrobe:entry.wardrobe,rig:{pose:rig.spec.pose,ground:rig.plan.projectedGround},
    original:original?.stance??null,variants,errors});
  console.log(entry.id,seed,original?.stance.visibleGapRows,variants.map(v=>[v.id,v.stance?.visibleGapRows]),errors);
}
const blocked=rows.some(c=>c.errors.length);
const status=blocked?'E9_1R_TECHNICAL_BLOCKED':values.development?'DEVELOPMENT_PASS':'E9_1R_READY_FOR_HUMAN_STATIC_ART_REVIEW';
save('benchmark.json',contents({status,base:study.base,legacySource:study.sourceE91,style:old.style,keyLight:old.keyLight,
  version:costumeStanceVersion,selection:study.preferredStage,sources:hashes,freeze:values.development?null:sha256(read(seal)),
  human:'STATIC_ART_REVIEW_PENDING',gameReady:'GAME_READY_ART_NOT_APPROVED',cases:rows,files:hashesOut}));
writeFileSync(join(root,'SHA256SUMS'),Object.entries(hashesOut).sort(([a],[b])=>a.localeCompare(b)).map(([f,h])=>h+'  '+f).join('\n')+'\n');
if(blocked)process.exitCode=1;
