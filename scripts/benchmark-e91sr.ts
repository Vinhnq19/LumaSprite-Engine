import assert from 'node:assert/strict';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { parseArgs } from 'node:util';
import { outline,rect } from '../src/core/geometry/faces.ts';
import { fillPolygon,type Point } from '../src/core/geometry/shapes.ts';
import { inkLuma,pack } from '../src/core/palette/colors.ts';
import { composite,makeRaster,type Raster } from '../src/core/pixels/raster.ts';
import { decodePng,encodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';
import { fitIdentityHeadwear,rasterBounds } from '../src/experiments/character-headwear-fit.ts';
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
const text=(x:unknown)=>JSON.stringify(x,null,2)+'\n';
const dir='benchmarks/fixtures/e91sr/', fixed=dir+'study.json', seal=dir+'candidate-freeze.json';
const prior='benchmarks/results/e91s/';
const study=json(fixed), e91=json('benchmarks/fixtures/e91/study.json'), e91r=json('benchmarks/fixtures/e91r/study.json');
const e91s=json('benchmarks/fixtures/e91s/study.json'), locked=json(prior+'benchmark.json');
assert.deepEqual([study.style,study.keyLight,study.view,study.canvas,study.pivot],[e91.style,e91.keyLight,e91.view,e91.canvas,e91.pivot]);
assert.deepEqual([study.padding,study.outlineRadius,study.acceptance.minimumLegGapRows,study.acceptance.minimumGripOverlap,
  study.acceptance.minimumShaftVisible,study.acceptance.stanceVersion,study.acceptance.capSkullContact],
  [e91.limits.padding,1,e91.limits.minimumLegGapRows,e91.limits.minimumGripOverlap,e91.limits.minimumShaftVisible,costumeStanceVersion,2]);
const pinned=[fixed,'scripts/benchmark-e91sr.ts','src/experiments/character-headwear-fit.ts','src/experiments/character-identity-study.ts',
  'src/experiments/character-v4.ts','src/experiments/character-v4-recovery.ts','src/experiments/costume-stance.ts',
  'src/core/geometry/faces.ts','src/core/renderer/layers.ts','benchmarks/fixtures/e91/study.json','benchmarks/fixtures/e91r/study.json',
  'benchmarks/fixtures/e91s/study.json','benchmarks/fixtures/e91s/candidate-freeze.json',prior+'benchmark.json',prior+'SHA256SUMS',
  'benchmarks/fixtures/e75r/ridge.json','benchmarks/fixtures/e75r/marsh.json',e91.direction.file,e91.scene,
  'docs/art-quality/art-quality-rubric-v2.json',study.acceptance.rubric];
const sources=Object.fromEntries(pinned.map(p=>[p,sha256(read(p).toString('utf8').replaceAll('\r\n','\n'))]));
const dev='.cache/e91sr-development/';
if(values.freeze){
  const data=json(dev+'benchmark.json');
  assert.equal(data.status,'DEVELOPMENT_PASS');
  assert.equal(data.cases.length,4);
  assert.deepEqual(sources,data.sources);
  writeFileSync(seal,text({version:1,sources,selected:'s3-with-headwear-fit',holdout:study.holdout.id,seed:study.holdout.seed,
    procedure:'Frozen after known/diagnostic verification and before first Highland raster.',developmentSha256:sha256(read(dev+'benchmark.json'))}),{flag:'wx'});
  process.exit(0);
}
if(!values.development)assert.deepEqual(json(seal).sources,sources,'FRESH_HOLDOUT_FREEZE_CHANGED');
const root=values.development?dev:values.publish?'benchmarks/results/e91sr/':'benchmarks/results/run/e91sr/';
const files:Record<string,string>={};
function save(name:string,data:Buffer|string){
  const path=join(root,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,data);
  files[name]=sha256(data);
}
function png(name:string,r:Raster){
  const bytes=encodePng(r);assert.deepEqual(decodePng(bytes),r);save(name+'.png',bytes);
}
function crop(r:Raster,[x,y]:Point,w:number,h:number){
  const out=makeRaster(w,h),u=Math.max(0,Math.min(r.w-w,x-Math.floor(w/2))),v=Math.max(0,Math.min(r.h-h,y-Math.floor(h/2)));
  for(let j=0;j<h;j++)r.rgba.copy(out.rgba,j*w*4,((v+j)*r.w+u)*4,((v+j)*r.w+u+w)*4);
  return out;
}
const oldSha=(scope:string,stage:string,image:Raster,suffix='sprite')=>{
  const path=scope+'/'+stage+'/'+suffix+'.png';
  const digest=locked.files[path];
  assert.equal(sha256(read(prior+path)),digest,path);
  assert.equal(sha256(encodePng(image)),digest,path);
};
const {spec,profile}=await loadArtDirection(JSON.parse((await pinnedFile(e91.direction)).toString('utf8')));
const {profile:style,character,device}=crossAssetStyle(profile,spec);assert.ok(character);
const scene:PilotBrief=JSON.parse((await pinnedFile({file:e91.scene,sha256:e91.sceneSha256})).toString('utf8'));
const world=await loadComposition(scene.scene),actor='courier',spawn=world.spec.spawns.find(x=>x.actor===actor)!;
const environment={...world.environment,style,spec:{...world.environment.spec,building:{...world.environment.spec.building,...scene.architecture}}};
const initial=environment.assets.get(actor)!;
type Render=ReturnType<typeof renderQualityCharacter>;
type Rig=ReturnType<typeof legacyBody>['plan'];
type Part=Render['layers'][number];
function sceneImage(r:Render,light:'day'|'night'){
  const assets=new Map(environment.assets), points=maskPixels(r.final);
  const colors=new Set(points.map(i=>r.final.rgba.readUInt32BE(i*4)));
  assets.set(actor,{...initial,colors,raster:r.final,ref:{...initial.ref,pivot:[...r.pivot],sha256:sha256(encodePng(r.final))}});
  const out=renderEnvironment({...environment,assets},'B',light,{composition:world.spec,kitSeed:world.kitSeed});
  const c=out.metadata.camera;
  assert.deepEqual([c.width,c.height,c.pixelsPerUnit],study.acceptance.requireScene);
  const [x,y]=[spawn.at[0]-r.pivot[0],spawn.at[1]-r.pivot[1]], layer=pack(out.metadata.atlas.layerLegend.actor);
  const slots=new Set<number>(), gap:number[]=[];
  for(const i of points){
    const u=x+i%64,v=y+Math.floor(i/64), j=v*320+u;
    assert.ok(u>0&&u<319&&v>0&&v<207);
    slots.add(j);
    assert.equal(out.layerOverlay.rgba.readUInt32BE(j*4),layer,'SCENE_OCCLUSION');
    const ink=out.raster.rgba.readUInt32BE(j*4);
    assert.equal(ink,r.final.rgba.readUInt32BE(i*4),'SCENE_RGBA');
    for(const [src,dst] of [[i-1,j-1],[i+1,j+1],[i-64,j-320],[i+64,j+320]])
      if(!r.final.rgba[src*4+3])gap.push(Math.abs(inkLuma(ink)-inkLuma(out.raster.rgba.readUInt32BE(dst*4))));
  }
  assert.equal(out.metadata.occlusion.find(x=>x.id===actor)!.visible,slots.size);
  gap.sort((a,b)=>a-b);
  return {image:out.raster,slots,collision:sha256(out.collisionPlane.rgba),weak:gap.filter(x=>x<18).length,
    edges:gap.length,p10:gap[Math.floor(gap.length/10)]};
}

const worn=new Set(['oilskin','hood','cap']);
const mask=(shape:readonly Point[])=>{const r=makeRaster(64,64);fillPolygon(r,shape,pack('#ffffff'));return r;};
const hat=(r:Render)=>composite([makeRaster(64,64),...r.layers.filter(p=>worn.has(p.id)).map(p=>p.mask)]);
const skull=(r:Render)=>r.layers.find(p=>p.id==='head')!.mask;
function partsAudit(folder:string,r:Render){
  const face=skull(r), cap=hat(r), assembled=composite([face,cap]), stroke=outline(assembled,pack('#91b4c7'));
  for(const [key,image] of Object.entries({skull:face,headwear:cap,'skull-and-headwear':assembled,outline:stroke}))png(folder+'/'+key,image);
  return {skull:rasterBounds(face),headwear:rasterBounds(cap),combined:rasterBounds(assembled),outline:rasterBounds(stroke),final:rasterBounds(r.final)};
}

function observerFixture(baseline:Render,rig:Rig){
  const [cx,cy]=rig.landmarks.crown.point;
  const crown=mask([[cx-7,cy-7],[cx-7,cy-13],[cx-5,cy-15],[cx+2,cy-15],[cx+5,cy-12],[cx+6,cy-7],
    [cx+11,cy-6],[cx+10,cy-3],[cx+3,cy-2],[cx-5,cy-3],[cx-8,cy-5]]);
  const [x,y]=rig.landmarks['near-palm'].point;
  const gear=(id:string,role:Part['role'],shape:readonly Point[],tone:Part['tone']):Part=>({id:'near-tool-'+id,role,mask:mask(shape),tone});
  const wind=[
    gear('wind-stem','leather',rect(x-1,y-12,x+2,y+4),'base'),
    gear('rotor-axis','metal',rect(x-9,y-13,x+8,y-11),'light'),
    gear('rotor-near-cup','metal',[[x-10,y-15],[x-5,y-15],[x-4,y-13],[x-6,y-11],[x-9,y-11]],'base'),
    gear('rotor-far-cup','metal',[[x+4,y-14],[x+9,y-14],[x+8,y-11],[x+5,y-10],[x+3,y-11]],'light'),
    gear('brass-collar','glass',rect(x-2,y-11,x+3,y-8),'base'),
  ];
  const layers=baseline.layers.flatMap(p=>worn.has(p.id)?[{...p,mask:crown}]:p.id.includes('near-tool')?[]:
    p.id==='near-hand'?[...wind,p]:[p]);
  const props=baseline.props.map(p=>p.hand==='near-hand'?{...p,id:'twin-cup-wind-reader',masks:wind.map(g=>g.mask)}:p);
  return {...baseline,layers,props};
}

type Entry=Identity & {id:string;seed:number;role:string;wardrobe:Wardrobe};
const cases=[...e91s.cases,e91s.holdout,...(values.development?[]:[study.holdout])] as Entry[];
const rows=[];
for(const item of cases){
  const fresh=item.id===study.holdout.id,diagnostic=item.id===e91s.holdout.id,scope=item.id+'/'+item.seed;
  const recipe=(fresh?study.holdout:diagnostic?e91s.holdout:e91.cases.find((p:Case)=>p.id===item.id)??e91r.holdout) as Case;
  const pose=fresh?study.holdout.pose:diagnostic?e91s.holdout.pose:item.wardrobe==='cloak'?e91r.holdout.pose:null;
  const source=json(recipe.legacy);
  const input=pose?{...source,spec:{...source.spec,pose:{...source.spec.pose,...pose}},matched:{near:pose.near,far:pose.far}}:source;
  const rig=legacyBody(recipe,item.seed,input);
  assert.ok(characterSpecSchema.safeParse(rig.spec).success);
  assert.deepEqual(rig.plan.pivot,study.pivot);
  const shared=fresh||diagnostic;
  const base=recoverCostume(renderQualityCharacter(recipe,item.seed,rig,'b3',character,device,shared,e91.e90),
    rig.plan,item.wardrobe,character,!shared);
  const original: ReturnType<typeof identitySteps>|null=fresh?null:identitySteps(base,rig.plan,item,character);
  const {steps,plan}=fitIdentityHeadwear(base,rig.plan,item,character,study.padding,fresh?observerFixture(base,rig.plan):base);
  const audits=diagnostic?{before:partsAudit(scope+'/before',original!.s3),after:partsAudit(scope+'/after',steps.s3)}
    :fresh?{after:partsAudit(scope+'/after',steps.s3)}:null;
  const contexts=new Map((['day','night'] as const).map(light=>[light,sceneImage(steps.s0,light)]));
  const variants=[],errors:string[]=[];
  for(const [stage,r] of Object.entries(steps) as Array<[keyof typeof steps,Render]>){
    const folder=scope+'/'+stage;
    const old: Render|undefined=original?.[stage];
    let changedPixels=0;
    if(old){
      oldSha(scope,stage,old.final);
      if(stage==='s0'||!diagnostic)assert.deepEqual(old.final,r.final,'KNOWN_SPRITE_CHANGED');
      assert.deepEqual(old.pivot,r.pivot);
      assert.deepEqual(old.bodySilhouette,r.bodySilhouette);
      assert.deepEqual(old.props,r.props);
      for(const [j,part] of r.layers.entries())if(!worn.has(part.id))assert.deepEqual(part,old.layers[j],'NON_HEADWEAR_GEOMETRY');
      const permitted=outline(composite([hat(old),hat(r)]),0xffffffff);
      const delta=makeRaster(64,64);
      for(let i=0;i<4096;i++){
        const o=i*4;
        if(!permitted.rgba[o+3]){
          assert.equal(old.ownership.rgba.readUInt32BE(o),r.ownership.rgba.readUInt32BE(o),'OWNERSHIP_OUTSIDE_HAT');
          assert.equal(old.mat.rgba.readUInt32BE(o),r.mat.rgba.readUInt32BE(o),'MATERIAL_MASK_OUTSIDE_HAT');
        }
        if(old.final.rgba.readUInt32BE(o)===r.final.rgba.readUInt32BE(o))continue;
        assert.ok(permitted.rgba[o+3],'RGBA_OUTSIDE_HAT');changedPixels++;
        delta.rgba.writeUInt32BE(pack(!old.final.rgba[o+3]?'#9de7ae':!r.final.rgba[o+3]?'#ee9383':'#f3cc87'),o);
      }
      if(changedPixels)png(folder+'/diff',delta);
    }
    const publish=fresh||changedPixels>0;
    if(publish){
      for(const [key,img] of Object.entries({sprite:r.final,silhouette:r.total,body:r.bodySilhouette,parts:r.ownership,
        face:crop(r.final,rig.plan.landmarks.crown.point,26,27)}))png(folder+'/'+key,img);
      for(const prop of r.props)png(folder+'/'+prop.hand.split('-')[0],crop(r.final,prop.socket,30,29));
    }
    let qa=null,stance=null;
    try{
      qa=checkQualityCharacter(r,e91.limits);
      const b=rasterBounds(r.final)!;assert.ok(b.bottom<=63-study.padding);
      stance=requireCostumeStance(wardrobeLayers(r,rig.plan,item.wardrobe).stance,e91.limits.minimumLegGapRows);
      if(old&&diagnostic&&stage!=='s0'){
        const before=requireCostumeStance(wardrobeLayers(old,rig.plan,item.wardrobe).stance,e91.limits.minimumLegGapRows);
        assert.deepEqual(before,stance,'STANCE_CHANGED');
      }
    }catch(error){errors.push(stage+': '+String(error));}
    const sceneProof=[];
    for(const light of ['day','night'] as const){
      const reference=contexts.get(light)!, ctx=stage==='s0'?reference:sceneImage(r,light);
      assert.equal(reference.collision,ctx.collision);
      for(let i=0;i<320*208;i++)if(!reference.slots.has(i)&&!ctx.slots.has(i))
        assert.equal(reference.image.rgba.readUInt32BE(i*4),ctx.image.rgba.readUInt32BE(i*4),'SCENE_BACKGROUND');
      if(publish)png(folder+'/'+light,ctx.image);
      else oldSha(scope,stage,ctx.image,light);
      sceneProof.push({light,weak:ctx.weak,edges:ctx.edges,p10:ctx.p10,anchor:spawn.at});
    }
    variants.push({stage,folder,milestone:publish?'e91sr':'e91s',qa,stance,changedPixels,tools:r.props.map(p=>p.id),sceneProof});
  }
  rows.push({id:item.id,seed:item.seed,role:fresh?'holdout':diagnostic?'diagnostic':'known',scope,plan,audits,variants,errors});
  console.log(item.id,plan.adjustment,variants.map(x=>[x.stage,x.qa?.bounds?.top,x.stance?.visibleGapRows,x.changedPixels]),errors);
}
const blocked=rows.some(row=>row.errors.length);
const status=blocked?'E9_1SR_TECHNICAL_BLOCKED':values.development?'DEVELOPMENT_PASS':'E9_1SR_READY_FOR_FINAL_OWNER_STATIC_ART_REVIEW';
save('benchmark.json',text({status,base:study.checkpoint,sourceE91S:study.previousSource,sources,freeze:values.development?null:sha256(read(seal)),
  art:'STATIC_ART_REVIEW_PENDING',cases:rows,files}));
writeFileSync(join(root,'SHA256SUMS'),Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([p,h])=>h+'  '+p).join('\n')+'\n');
if(blocked)process.exitCode=1;
