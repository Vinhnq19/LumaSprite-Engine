import assert from 'node:assert/strict';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { parseArgs } from 'node:util';
import { inkLuma,pack } from '../src/core/palette/colors.ts';
import { composite, makeRaster,type Raster } from '../src/core/pixels/raster.ts';
import { decodePng,encodePng } from '../src/core/renderer/png.ts';
import type { Point } from '../src/core/geometry/shapes.ts';
import { sha256 } from '../src/quality/raster.ts';
import { identitySteps,type Identity } from '../src/experiments/character-identity-study.ts';
import { checkQualityCharacter,legacyBody,renderQualityCharacter,type Case } from '../src/experiments/character-v4.ts';
import { recoverCostume,wardrobeLayers,type Wardrobe } from '../src/experiments/character-v4-recovery.ts';
import { costumeStanceVersion,maskPixels,requireCostumeStance } from '../src/experiments/costume-stance.ts';
import { crossAssetStyle,loadArtDirection } from '../src/experiments/art-direction.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { loadComposition } from '../src/generators/environment/composition.ts';
import { renderEnvironment } from '../src/generators/environment/render.ts';
import type { PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { characterSpecSchema } from '../src/specs/character.ts';

const {values}=parseArgs({options:{development:{type:'boolean'},freeze:{type:'boolean'},publish:{type:'boolean'}}});
assert.ok(Object.values(values).filter(Boolean).length<=1);
const read=(p:string)=>readFileSync(p);
const json=(p:string)=>JSON.parse(read(p).toString('utf8'));
const serialize=(v:unknown)=>JSON.stringify(v,null,2)+'\n';
const path='benchmarks/fixtures/e91s/study.json',seal='benchmarks/fixtures/e91s/candidate-freeze.json';
const oldRoot='benchmarks/results/e91r/';
const cfg=json(path), e91=json('benchmarks/fixtures/e91/study.json'), e91r=json('benchmarks/fixtures/e91r/study.json');
const locked=json(oldRoot+'benchmark.json');
assert.deepEqual([cfg.canvas,cfg.pivot,cfg.style,cfg.view,cfg.keyLight],[e91.canvas,e91.pivot,e91.style,e91.view,e91.keyLight]);
assert.deepEqual([cfg.criteria.minimumLegGapRows,cfg.criteria.minimumGripOverlap,cfg.criteria.minimumShaftVisible,cfg.criteria.pad,cfg.criteria.stanceVersion],
  [e91.limits.minimumLegGapRows,e91.limits.minimumGripOverlap,e91.limits.minimumShaftVisible,e91.limits.padding,costumeStanceVersion]);
const filesToFreeze=[path,'scripts/benchmark-e91s.ts','src/experiments/character-identity-study.ts','src/experiments/character-v4.ts',
  'src/experiments/character-v4-recovery.ts','src/experiments/costume-stance.ts','benchmarks/fixtures/e91/study.json',
  'benchmarks/fixtures/e91r/study.json','benchmarks/fixtures/e91r/candidate-freeze.json',oldRoot+'benchmark.json',oldRoot+'SHA256SUMS',
  'benchmarks/fixtures/e75r/ridge.json','benchmarks/fixtures/e75r/marsh.json',e91.direction.file,e91.scene,
  'docs/art-quality/art-quality-rubric-v2.json','docs/art-quality/art-quality-rubric-v2-static-addendum.md'];
const sources=Object.fromEntries(filesToFreeze.map(p=>[p,sha256(read(p).toString('utf8').replaceAll('\r\n','\n'))]));
const dev='.cache/e91s-development/';
if(values.freeze){
  const data=json(dev+'benchmark.json');
  assert.equal(data.status,'DEVELOPMENT_PASS');
  assert.deepEqual(sources,data.sources);
  writeFileSync(seal,serialize({version:1,source:sources,selected:'s3',beforeFirstRender:cfg.holdout.id,seed:cfg.holdout.seed,
    developmentResult:sha256(read(dev+'benchmark.json'))}),{flag:'wx'});
  process.exit(0);
}
if(!values.development)assert.deepEqual(json(seal).source,sources,'HOLDOUT_FREEZE_CHANGED');
const root=values.development?dev:values.publish?'benchmarks/results/e91s/':'benchmarks/results/run/e91s/';
const hashes:Record<string,string>={};
function save(path:string,bytes:Buffer|string){
  const file=join(root,path);mkdirSync(dirname(file),{recursive:true});
  writeFileSync(file,bytes);hashes[path]=sha256(bytes);
}
function png(folder:string,name:string,r:Raster){
  const bytes=encodePng(r);assert.deepEqual(decodePng(bytes),r);save(folder+'/'+name+'.png',bytes);
}
function crop(r:Raster,[x,y]:Point,w:number,h:number){
  const left=Math.max(0,Math.min(r.w-w,x-Math.floor(w/2))), top=Math.max(0,Math.min(r.h-h,y-Math.floor(h/2)));
  const o=makeRaster(w,h);
  for(let j=0;j<h;j++)r.rgba.copy(o.rgba,j*w*4,((top+j)*r.w+left)*4,((top+j)*r.w+left+w)*4);
  return o;
}
function compare(a:Raster,b:Raster){
  let added=0,removed=0,colors=0;
  const diff=makeRaster(a.w,a.h);
  for(let i=0;i<a.rgba.length;i+=4){
    if(a.rgba.readUInt32BE(i)===b.rgba.readUInt32BE(i))continue;
    const ink=!a.rgba[i+3]?(added++, '#9de7ae'):!b.rgba[i+3]?(removed++, '#ee9383'):(colors++, '#f3cc87');
    diff.rgba.writeUInt32BE(pack(ink),i);
  }
  return {diff,stats:{added,removed,colors}};
}
function limits(mask:Raster){
  const px=maskPixels(mask),xs=px.map(i=>i%mask.w);
  return {width:Math.max(...xs)-Math.min(...xs)+1,height:Math.floor(px.at(-1)!/mask.w)-Math.floor(px[0]/mask.w)+1,pixels:px.length};
}
function outfit(r:Render){
  return composite(r.layers.filter(p=>['apron','apron-strap','belt','shawl','sash','a-line-tunic','cloak-back','cloak-front','cloak-fastener']
    .includes(p.id)).map(p=>p.mask));
}
const {spec,profile}=await loadArtDirection(JSON.parse((await pinnedFile(e91.direction)).toString('utf8')));
const {profile:style,character,device}=crossAssetStyle(profile,spec);
assert.ok(character);
const scene:PilotBrief=JSON.parse((await pinnedFile({file:e91.scene,sha256:e91.sceneSha256})).toString('utf8'));
const base=await loadComposition(scene.scene);
const actor='courier',spawn=base.spec.spawns.find(x=>x.actor===actor)!;
const environment={...base.environment,style,spec:{...base.environment.spec,building:{...base.environment.spec.building,...scene.architecture}}};
const previous=environment.assets.get(actor)!;
type Render=ReturnType<typeof renderQualityCharacter>;
function sceneImage(r:Render,light:'day'|'night'){
  const assets=new Map(environment.assets), alpha=maskPixels(r.final);
  const colors=new Set(alpha.map(i=>r.final.rgba.readUInt32BE(i*4)));
  assets.set(actor,{...previous,raster:r.final,colors,ref:{...previous.ref,pivot:[...r.pivot],sha256:sha256(encodePng(r.final))}});
  const s=renderEnvironment({...environment,assets},'B',light,{composition:base.spec,kitSeed:base.kitSeed});
  const camera=s.metadata.camera, layers=pack(s.metadata.atlas.layerLegend.actor);
  assert.deepEqual([camera.width,camera.height,camera.pixelsPerUnit],[320,208,32]);
  const [x,y]=[spawn.at[0]-r.pivot[0],spawn.at[1]-r.pivot[1]], p=new Set<number>(), contrast:number[]=[];
  for(const i of alpha){
    const u=x+i%64,v=y+Math.floor(i/64), j=v*320+u;
    assert.ok(u>0&&u<319&&v>0&&v<207);
    p.add(j);
    assert.equal(s.layerOverlay.rgba.readUInt32BE(j*4),layers,'SCENE_OCCLUSION');
    const value=s.raster.rgba.readUInt32BE(j*4);
    assert.equal(value,r.final.rgba.readUInt32BE(i*4),'SCENE_RGBA');
    for(const [a,b] of [[i-1,j-1],[i+1,j+1],[i-64,j-320],[i+64,j+320]])if(!r.final.rgba[a*4+3])
      contrast.push(Math.abs(inkLuma(value)-inkLuma(s.raster.rgba.readUInt32BE(b*4))));
  }
  assert.equal(s.metadata.occlusion.find(p=>p.id===actor)!.visible,p.size);
  contrast.sort((a,b)=>a-b);
  return {image:s.raster,p,geometry:sha256(s.collisionPlane.rgba),camera,anchor:spawn.at,
    contrast:{edges:contrast.length,weak:contrast.filter(x=>x<18).length,p10:contrast[Math.floor(contrast.length/10)]}};
}

type Study=Identity & {id:string;seed:number;role:'known'|'holdout';wardrobe:Wardrobe;reference?:string};
const cases=[...cfg.cases,...(values.development?[]:[cfg.holdout])] as Study[];
const results=[];
for(const item of cases){
  const fresh=item.role==='holdout', scope=item.id+'/'+item.seed;
  const case_= (fresh?cfg.holdout:e91.cases.find((c:Case)=>c.id===item.id)??e91r.holdout) as Case;
  const pose=fresh?cfg.holdout.pose:item.wardrobe==='cloak'?e91r.holdout.pose:null;
  const input=json(case_.legacy);
  const source=pose?{...input,spec:{...input.spec,pose:{...input.spec.pose,...pose}},matched:{near:pose.near,far:pose.far}}:input;
  const rig=legacyBody(case_,item.seed,source);
  assert.ok(characterSpecSchema.safeParse(rig.spec).success);
  assert.equal(characterSpecSchema.safeParse({version:4,kind:'character-pilot',identity:item}).success,false);
  assert.deepEqual(rig.plan.pivot,cfg.pivot);
  const baseline=recoverCostume(renderQualityCharacter(case_,item.seed,rig,'b3',character,device,fresh,e91.e90),rig.plan,item.wardrobe,character,!fresh);
  const reference=fresh?null:scope+'/'+item.reference+'/sprite.png';
  if(reference){
    assert.equal(sha256(read(oldRoot+reference)),locked.files[reference]);
    assert.equal(sha256(encodePng(baseline.final)),locked.files[reference],'S0_MUST_MATCH');
  }
  const variants=identitySteps(baseline,rig.plan,item,character), repeat=identitySteps(baseline,rig.plan,item,character);
  const maskById=(r:Render)=>Object.fromEntries(r.layers.map(p=>[p.id,sha256(p.mask.rgba)]));
  const m1=maskById(variants.s1),m2=maskById(variants.s2),m3=maskById(variants.s3),m0=maskById(variants.s0);
  assert.deepEqual(m2,m1,'S2_GEOMETRY_CHANGED');
  assert.deepEqual(variants.s2.ownership,variants.s1.ownership);
  for(let i=0;i<4096;i++){
    const a=variants.s1.final.rgba.readUInt32BE(i*4),b=variants.s2.final.rgba.readUInt32BE(i*4);
    const owner=variants.s1.ownership.rgba.readUInt32BE(i*4);
    if(a!==b)assert.ok([variants.s1.labels.head,variants.s1.labels.neck].includes(owner),'S2_OUTSIDE_FACE');
  }
  if(item.tools==='tether')for(const part of variants.s2.layers.filter(p=>p.id.startsWith('near-tool'))){
    for(const i of maskPixels(part.mask))if(variants.s2.ownership.rgba.readUInt32BE(i*4)===variants.s2.labels[part.id]){
      assert.equal(variants.s3.ownership.rgba.readUInt32BE(i*4),variants.s3.labels[part.id]);
      assert.equal(variants.s3.final.rgba.readUInt32BE(i*4),variants.s2.final.rgba.readUInt32BE(i*4),'LANTERN_CHANGED');
    }
  }
  for(const id of Object.keys(m0)){
    if(id.includes('-tool')||/-hand$|-shin$|-boot$|-thigh$/.test(id))assert.equal(m0[id],m1[id],id);
    if(!id.includes('-tool')||item.tools==='tether'&&id.startsWith('near-tool'))assert.equal(m2[id],m3[id],id);
  }
  const row=[],errors:string[]=[];
  const baseContext=new Map((['day','night'] as const).map(light=>[light,sceneImage(variants.s0,light)]));
  let prior:Render|undefined;
  for(const [stage,r] of Object.entries(variants) as Array<[keyof typeof variants,Render]>){
    const folder=scope+'/'+stage;
    assert.deepEqual(r.final,repeat[stage].final);
    assert.deepEqual(r.ownership,repeat[stage].ownership);
    let qa=null,stance=null;
    try{
      qa=checkQualityCharacter(r,e91.limits);
      stance=requireCostumeStance(wardrobeLayers(r,rig.plan,item.wardrobe).stance,e91.limits.minimumLegGapRows);
      assert.deepEqual(r.pivot,cfg.pivot);
    }catch(error){errors.push(stage+': '+String(error));}
    const head=r.layers.find(p=>p.id==='head')!, torso=r.layers.find(p=>p.id==='torso')!;
    const images:Record<string,Raster>={sprite:r.final,silhouette:r.total,body:r.bodySilhouette,
      outfit:outfit(r),parts:r.ownership,material:r.mat,face:crop(r.final,rig.plan.landmarks.crown.point,26,27)};
    for(const p of r.props)images[p.hand.split('-')[0]]=crop(r.final,p.socket,30,29);
    const difference=prior?compare(prior.final,r.final):null;
    if(difference)images.diff=difference.diff;
    for(const [name,image] of Object.entries(images))png(folder,name,image);
    const contexts=[];
    for(const light of ['day','night'] as const){
      const old=baseContext.get(light)!, ctx=stage==='s0'?old:sceneImage(r,light);
      assert.deepEqual([ctx.geometry,ctx.camera,ctx.anchor],[old.geometry,old.camera,old.anchor]);
      for(let i=0;i<320*208;i++)if(!old.p.has(i)&&!ctx.p.has(i))
        assert.equal(ctx.image.rgba.readUInt32BE(i*4),old.image.rgba.readUInt32BE(i*4),'SCENE_BACKGROUND');
      png(folder,light,ctx.image);
      contexts.push({light,weak:ctx.contrast.weak,edges:ctx.contrast.edges,p10:ctx.contrast.p10,anchor:ctx.anchor});
    }
    row.push({stage,path:folder,qa,stance,shape:{head:limits(head.mask),torso:limits(torso.mask),bare:limits(r.bodySilhouette)},
      delta:difference?.stats??null,grip:r.props.map(p=>p.id),contexts});
    prior=r;
  }
  results.push({id:item.id,role:item.role,seed:item.seed,reference,brief:fresh?cfg.holdout.brief:case_.brief,scope,steps:row,errors});
  console.log(item.id,row.map(r=>[r.stage,r.stance?.visibleGapRows,r.qa?.handTests.map(p=>p.shown)]),errors);
}
const failed=results.some(r=>r.errors.length);
const status=failed?'E9_1S_TECHNICAL_BLOCKED':values.development?'DEVELOPMENT_PASS':'E9_1S_READY_FOR_FINAL_HUMAN_STATIC_ART_REVIEW';
save('benchmark.json',serialize({status,base:cfg.e91r,baselineSource:cfg.e91rSource,style:cfg.style,freeze:values.development?null:sha256(read(seal)),
  sources,human:'STATIC_ART_REVIEW_PENDING',cases:results,files:hashes}));
writeFileSync(join(root,'SHA256SUMS'),Object.entries(hashes).sort(([a],[b])=>a.localeCompare(b)).map(([file,hash])=>hash+'  '+file).join('\n')+'\n');
if(failed)process.exitCode=1;
