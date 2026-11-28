import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { outline } from '../src/core/geometry/faces.ts';
import type { Point } from '../src/core/geometry/shapes.ts';
import { inkLuma, pack } from '../src/core/palette/colors.ts';
import { composite, makeRaster, put, silhouette, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { crossAssetStyle, loadArtDirection } from '../src/experiments/art-direction.ts';
import { paintHandTool, planHandTool } from '../src/experiments/character-equipment.ts';
import { fitIdentityHeadwear, rasterBounds } from '../src/experiments/character-headwear-fit.ts';
import { checkQualityCharacter, legacyBody, renderQualityCharacter, type Case } from '../src/experiments/character-v4.ts';
import { recoverCostume, wardrobeLayers } from '../src/experiments/character-v4-recovery.ts';
import { maskPixels, requireCostumeStance } from '../src/experiments/costume-stance.ts';
import type { PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { blank, contains, ink, layeredCharacter, offset, parseKit, pixel, placeGroup, set,
  type CharacterRender, type PaintedPart } from '../src/experiments/hybrid-character-kit.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { materialMaskLegend } from '../src/generators/character/materials.ts';
import { loadComposition } from '../src/generators/environment/composition.ts';
import { renderEnvironment } from '../src/generators/environment/render.ts';
import { sha256 } from '../src/quality/raster.ts';

const {values} = parseArgs({options:{kit:{type:'boolean'},development:{type:'boolean'},freeze:{type:'boolean'},publish:{type:'boolean'}}});
assert.ok(Object.values(values).filter(Boolean).length<=1);
const fixtureDir='benchmarks/fixtures/e9h1/', kitFile=fixtureDir+'kit.json', studyFile=fixtureDir+'study.json', seal=fixtureDir+'candidate-freeze.json';
const dev='.cache/e9h1-development/', gallery='.cache/e9h1-kit/';
const read=(file:string)=>readFileSync(file);
const json=(file:string)=>JSON.parse(read(file).toString('utf8'));
const jsonText=(data:unknown)=>JSON.stringify(data,null,2)+'\n';
const contentSha=(file:string)=>sha256(read(file).toString('utf8').replaceAll('\r\n','\n'));
const study=json(studyFile), kit=parseKit(json(kitFile)), e91=json('benchmarks/fixtures/e91/study.json');
const inputs=[kitFile,studyFile,'scripts/benchmark-e9h1.ts','package-lock.json','benchmarks/fixtures/e91/study.json',
  'benchmarks/fixtures/e61r/style-profile.json','benchmarks/fixtures/e62/c2-supply-stop.json',
  e91.direction.file,e91.scene,study.recipe.legacy,study.thresholds.rubric,'docs/art-quality/art-quality-rubric-v2.json'];
const tracked=execFileSync('git',['ls-files','src'],{encoding:'utf8'}).trim().split(/\r?\n/);
const sourceFiles=Array.from(new Set([...tracked,'src/experiments/hybrid-character-kit.ts',...inputs])).sort();
const sources=Object.fromEntries(sourceFiles.map(p=>[p,contentSha(p)]));
if(values.freeze){
  const last=json(dev+'benchmark.json'), first=json(gallery+'benchmark.json');
  assert.equal(last.status,'DEVELOPMENT_PASS');
  assert.equal(first.status,'COMPONENT_KIT_READY_FOR_HUMAN_REVIEW');
  assert.deepEqual(last.sources,sources);
  assert.deepEqual(first.sources,sources);
  assert.deepEqual(last.cases.map((c:{role:string})=>c.role),['development']);
  writeFileSync(seal,jsonText({version:1,sources,holdout:study.holdout,
    inputsUse:'Normalized UTF-8 LF source hashes. PNG and RGBA receipts use raw bytes.',
    process:'Sealed after component gallery and development verification, before the first fresh holdout raster.',
    development:sha256(read(dev+'benchmark.json')),componentGallery:sha256(read(gallery+'benchmark.json'))}),{flag:'wx'});
  process.exit(0);
}
const unfrozen=values.kit||values.development;
if(!unfrozen) {
  assert.deepEqual(json(seal).sources,sources,'FREEZE_SOURCE_MISMATCH');
  assert.deepEqual(json(seal).holdout,study.holdout,'FREEZE_BRIEF_MISMATCH');
}
const root=values.kit?gallery:values.development?dev:values.publish?'benchmarks/results/e9h1/':'benchmarks/results/run/e9h1/';
const files:Record<string,string>={};
function save(name:string, data:Buffer|string) {
  const path=join(root,name);
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,data);
  files[name]=sha256(data);
}
function png(name:string, raster:Raster) {
  const bytes=encodePng(raster);
  assert.deepEqual(decodePng(bytes),raster);
  save(name+'.png',bytes);
}
function crop(r:Raster,[x,y]:Point,w:number,h:number) {
  const out=makeRaster(w,h), u=Math.max(0,Math.min(r.w-w,x-Math.floor(w/2))), v=Math.max(0,Math.min(r.h-h,y-Math.floor(h/2)));
  for(let row=0;row<h;row++) r.rgba.copy(out.rgba,row*w*4,((v+row)*r.w+u)*4,((v+row)*r.w+u+w)*4);
  return out;
}

const {spec,profile}=await loadArtDirection(json(e91.direction.file));
await pinnedFile(e91.direction);
const {profile:style,character:direction,device}=crossAssetStyle(profile,spec);
assert.ok(direction);
assert.deepEqual([kit.style,kit.view,kit.keyLight],[spec.id,spec.view,spec.keyLight]);
assert.deepEqual([study.style,study.view,study.keyLight,study.pivot],[e91.style,e91.view,e91.keyLight,e91.pivot]);
const scene:PilotBrief=JSON.parse((await pinnedFile({file:e91.scene,sha256:e91.sceneSha256})).toString('utf8'));
const world=await loadComposition(scene.scene), actor='courier', spawn=world.spec.spawns.find(s=>s.actor===actor)!;
const environment={...world.environment,style,spec:{...world.environment.spec,building:{...world.environment.spec.building,...scene.architecture}}};
const originalActor=environment.assets.get(actor)!;

const stroke=(shape:Raster)=>outline(shape,pack('#ffffff'));
const overlap=(a:Raster,b:Raster)=>maskPixels(a).filter(i=>contains(b,i)).length;
const isEquipment=(id:string)=>id.includes('-tool')||['air-tank','tank-valve','air-hose'].includes(id);
const noEquipment=(r:CharacterRender)=>silhouette(composite(r.layers.filter(p=>!isEquipment(p.id)).map(p=>p.mask)),pack('#e6e0ce'));

type Light='day'|'night';
const lights:Light[]=['day','night'];
function context(r:CharacterRender,light:Light) {
  const assets=new Map(environment.assets), points=maskPixels(r.final);
  const colors=new Set(points.map(i=>ink(r.final,i)));
  assets.set(actor,{...originalActor,colors,raster:r.final,
    ref:{...originalActor.ref,pivot:[...r.pivot],sha256:sha256(encodePng(r.final))}});
  const rendered=renderEnvironment({...environment,assets},'B',light,{composition:world.spec,kitSeed:world.kitSeed});
  const {camera}=rendered.metadata;
  assert.deepEqual([camera.width,camera.height,camera.pixelsPerUnit],study.camera);
  const [x,y]=[spawn.at[0]-r.pivot[0],spawn.at[1]-r.pivot[1]];
  const slots=new Set<number>(), actorColor=pack(rendered.metadata.atlas.layerLegend.actor);
  let weakEdges=0, edges=0;
  for(const i of points) {
    const u=x+i%64,v=y+Math.floor(i/64), j=v*320+u;
    assert.ok(u>0&&u<319&&v>0&&v<207);
    slots.add(j);
    assert.equal(ink(rendered.layerOverlay,j),actorColor,'SCENE_OCCLUSION');
    const paint=ink(rendered.raster,j);
    assert.equal(paint,ink(r.final,i),'SCENE_RGBA');
    for(const [src,dst] of [[i-1,j-1],[i+1,j+1],[i-64,j-320],[i+64,j+320]]) if(!contains(r.final,src)) {
      edges++;
      if(Math.abs(inkLuma(paint)-inkLuma(ink(rendered.raster,dst)))<18) weakEdges++;
    }
  }
  assert.equal(rendered.metadata.occlusion.find(x=>x.id===actor)!.visible,slots.size);
  return {image:rendered.raster,slots,camera:study.camera,anchor:spawn.at,collision:sha256(rendered.collisionPlane.rgba),weakEdges,edges};
}
type Scene=ReturnType<typeof context>;
function sameContext(a:Scene,b:Scene) {
  assert.equal(a.collision,b.collision);
  let background=0;
  for(let i=0;i<320*208;i++) if(!a.slots.has(i)&&!b.slots.has(i)) {
    assert.equal(ink(a.image,i),ink(b.image,i),'SCENE_BACKGROUND');
    background++;
  }
  return background;
}

function delta(a:CharacterRender,b:CharacterRender,allowed:Raster) {
  const image=blank();
  let changed=0;
  for(let i=0;i<4096;i++) {
    const rgba=ink(a.final,i)!==ink(b.final,i);
    const mask=ink(a.ownership,i)!==ink(b.ownership,i)||ink(a.mat,i)!==ink(b.mat,i);
    if(rgba||mask) assert.ok(contains(allowed,i),'CHANGE_OUTSIDE_OWNER '+i);
    if(rgba) {
      changed++;
      set(image,i,pack(!contains(a.final,i)?'#91e8ba':!contains(b.final,i)?'#f79182':'#ffdc88'));
    }
  }
  return {image,changed,outside:0};
}
function visible(r:CharacterRender, id:string) {
  const mask=blank();
  for(const i of maskPixels(r.ownership)) if(ink(r.ownership,i)===r.labels[id]) set(mask,i,pack('#ffffff'));
  assert.ok(maskPixels(mask).length,id+' has no visible ownership');
  return mask;
}
function annotate(image:Raster, anchors:Record<string,Point>) {
  const marks=blank();
  for(const [x,y] of Object.values(anchors)) for(const d of [-2,-1,0,1,2]) {
    put(marks,x+d,y,pack('#f8b765'));
    put(marks,x,y+d,pack('#f8b765'));
  }
  return composite([image,marks]);
}

const cases=[];
const development=study.development;
const entries=unfrozen?[development]:[development,study.holdout];
for(const entry of entries) {
  const recipe:Case={...study.recipe,...entry,seeds:[entry.seed]};
  const pose={...study.basePose,near:{...study.basePose.near,...entry.near},far:{...study.basePose.far,...entry.far}};
  const legacy=json(recipe.legacy);
  const rig=legacyBody(recipe,entry.seed,{spec:{...legacy.spec,pose:{...legacy.spec.pose,...pose}},matched:pose});
  assert.deepEqual(rig.plan.pivot,study.pivot);
  const base=recoverCostume(renderQualityCharacter(recipe,entry.seed,rig,'b3',direction,device,true,e91.e90),
    rig.plan,'a-line',direction,false);
  const a: CharacterRender=fitIdentityHeadwear(base,rig.plan,study.identity,direction,e91.limits.padding).steps.s2;
  const point=(name:string)=>rig.plan.landmarks[name].point;
  const placements: PaintedPart[][]=kit.groups.map(g=>placeGroup(g,point(g.anchor),direction));
  const [helmet,suit,gear]=placements;
  const [hook,handle,hand]=gear;
  const part=(r:CharacterRender,id:string)=>r.layers.find(p=>p.id===id)!;
  const nearSocket=a.props.find(p=>p.hand==='near-hand')!.socket;
  assert.deepEqual(nearSocket,point('near-palm'));
  for(const g of kit.groups)
    for(const xy of Object.values(g.sockets)) assert.ok(offset(point(g.anchor),xy).every(i=>i>=1&&i<=62));
  const sockets=(index:number)=>Object.fromEntries(Object.entries(kit.groups[index].sockets).map(([key,xy])=>[key,offset(point(kit.groups[index].anchor),xy)]));
  const neckContact=overlap(helmet[0].mask,part(a,'neck').mask);
  const helmetSuitContact=overlap(composite(helmet.map(x=>x.mask)),suit[2].mask);
  const forearmContact=overlap(hand.mask,part(a,'near-forearm').mask);
  assert.ok(neckContact>=2&&helmetSuitContact>=2&&forearmContact>=2,'COMPONENT_CONTACT');
  assert.ok(contains(helmet.find(p=>p.id==='visor')!.mask,pixel(sockets(0).visorSeat)));
  assert.ok(contains(suit[0].mask,pixel(sockets(1).tankMount)));
  assert.deepEqual(sockets(2).grip,nearSocket);
  assert.deepEqual(sockets(2).wrist,point('near-wrist'));
  const matched=(glove:PaintedPart): CharacterRender=>layeredCharacter(a,a.layers.map(p=>p.id==='near-hand'?glove:p),[glove],direction);
  const full=(parts:PaintedPart[][]): CharacterRender=>{
    const [head,body,tools]=parts;
    const hidden=new Set(['hair','hood','bun','oilskin','shawl','sash','near-tool']);
    // Tank goes behind both arms and the suit. The near arm and hand cross the tool and suit in the foreground.
    const layers=a.layers.flatMap(p=>hidden.has(p.id)?[]:p.id==='head'?head:p.id==='torso'?body.slice(2):p.id==='near-hand'?tools:[p]);
    layers.splice(layers.findIndex(p=>p.id==='far-upper-arm'),0,...body.slice(0,2));
    const props=a.props.map(p=>p.hand==='near-hand'?{...p,id:'salvage-hook',masks:tools.slice(0,-1).map(t=>t.mask)}:p);
    return layeredCharacter(a,layers,parts.flat(),direction,props);
  };

  const b=full(placements);
  if(entry.role==='development') {
    for(const [index,g] of kit.groups.entries()) {
      const folder='kit/'+g.id, layer=placements[index], paints=composite(layer.map(p=>p.paint));
      const owners=composite(layer.map(p=>silhouette(p.mask,b.labels[p.id])));
      const materials=composite(layer.map(p=>silhouette(p.mask,pack(materialMaskLegend[p.role]))));
      for(const [name,image] of Object.entries({
        native:paints,silhouette:silhouette(paints,pack('#e6e0ce')),material:materials,ownership:owners,
        anchors:annotate(paints,{[g.anchor]:point(g.anchor),...sockets(index)}),
      })) png(folder+'/'+name,image);
    }
    png('kit/assembly/native',b.final);
    png('kit/assembly/anchors',annotate(b.final,{pivot:b.pivot,crown:point('crown'),chest:point('chest'),...sockets(2)}));
    png('kit/assembly/shaft-before-hand',composite([hook.paint,handle.paint]));
    png('kit/assembly/shaft-after-hand',composite([hook.paint,handle.paint,hand.paint]));
    for(const light of lights) png('kit/assembly/'+light,context(b,light).image);
  }

  const provenance=kit.groups.map((group,index)=>({id:group.id,revision:group.revision,source:kitFile,
    sourceSha256:sources[kitFile],revisionSha256:sha256(JSON.stringify(group)),...kit.provenance,
    anchors:sockets(index),origin:point(group.anchor),layers:group.layers.map(p=>p.id)}));
  const contacts={neckContact,helmetSuitContact,forearmContact};
  if(values.kit) {
    save('benchmark.json',jsonText({status:'COMPONENT_KIT_READY_FOR_HUMAN_REVIEW',sources,contacts,provenance,files}));
    process.exit(0);
  }

  const m=matched(hand);
  const permitted=stroke(composite([part(a,'near-hand').mask,hand.mask]));
  const fair=delta(a,m,permitted);
  assert.ok(fair.changed>0);
  assert.deepEqual(part(a,'near-tool').mask,part(m,'near-tool').mask);
  assert.deepEqual(a.props,m.props);
  for(const candidate of [m,b]) for(const side of ['near','far']) for(const limb of ['thigh','shin','boot']) {
    const id=side+'-'+limb;
    assert.deepEqual(part(a,id).mask,part(candidate,id).mask,'LEG_GEOMETRY');
    assert.deepEqual(visible(a,id),visible(candidate,id),'LEG_OWNERSHIP');
  }
  const folder=entry.role==='development'?'development':'holdout';
  png(folder+'/matched-diff',fair.image);
  png(folder+'/matched-region',permitted);
  const result=[];
  for(const [arm,r] of [['a',a],['matched',m],['full',b]] as const) {
    const prefix=folder+'/'+arm;
    const qa=checkQualityCharacter(r,e91.limits);
    const stance=requireCostumeStance(wardrobeLayers(r,rig.plan,'a-line').stance,e91.limits.minimumLegGapRows);
    const bounds=rasterBounds(r.final)!;
    assert.equal(bounds.bottom,r.pivot[1]-1);
    for(const name of ['head','torso','near-hand']) assert.ok(maskPixels(visible(r,name)).length>=2);
    const marks=Object.fromEntries(['crown','neck','chest','near-wrist','near-palm','far-palm'].map(id=>[id,point(id)]));
    for(const [name,image] of Object.entries({
      sprite:r.final,silhouette:silhouette(r.final,pack('#e6e0ce')),body:noEquipment(r),
      helmet:crop(r.final,offset(point('crown'),[0,3]),32,28),grip:crop(r.final,offset(nearSocket,[-3,-2]),36,26),
      materials:r.mat,owners:r.ownership,anchors:annotate(r.final,{...marks,pivot:r.pivot}),
    })) png(prefix+'/'+name,image);
    const scenes=lights.map(light=>{
      const ctx=context(r,light);
      const bg=sameContext(context(a,light),ctx);
      png(prefix+'/'+light,ctx.image);
      return {light,camera:ctx.camera,anchor:ctx.anchor,visible:ctx.slots.size,unchangedBackground:bg,weakEdges:ctx.weakEdges,edges:ctx.edges,collision:ctx.collision};
    });
    result.push({arm,qa,stance,scenes,labels:r.labels,rawPartBounds:Object.fromEntries(r.layers.map(p=>[p.id,rasterBounds(p.mask)]))});
  }

  const edits=[];
  if(entry.role==='development') {
    const source=structuredClone(kit), visor=source.groups[0].layers.find(p=>p.id==='visor')!;
    source.groups[0].revision++;
    const visorEdit=performance.now();
    visor.ramp='coat';
    const recolor=full([placeGroup(parseKit(source).groups[0],point('crown'),direction),suit,gear]);
    const elapsedVisorMs=performance.now()-visorEdit;

    const handSource=structuredClone(kit);
    handSource.groups[2].revision++;
    const handleEdit=performance.now();
    const handleLayer=handSource.groups[2].layers.find(p=>p.id==='near-tool-handle')!;
    for(const points of [handleLayer.points,...handleLayer.patches.map(p=>p.points)]) {
      for(const p of points) if(p[0]>=3) p[0]++;
    }
    const regrip=full([helmet,suit,placeGroup(parseKit(handSource).groups[2],nearSocket,direction)]);
    const elapsedHandleMs=performance.now()-handleEdit;

    const aEdit=performance.now();
    // The procedural arm keeps the hook head and edits the 3-pixel handle band along its existing grip axis.
    const [band,...fixedToolPlanes]=planHandTool('hook',nearSocket,[-7,-6]);
    const [topLeft,topRight,bottomRight,bottomLeft]=band.points;
    const shorten=(back:Point,front:Point):Point=>[back[0]+.16*(front[0]-back[0]),back[1]+.16*(front[1]-back[1])];
    const editedBand={...band,points:[shorten(topLeft,topRight),topRight,bottomRight,shorten(bottomLeft,bottomRight)]};
    const toolVariant=paintHandTool([editedBand,...fixedToolPlanes],device,nearSocket,false).raster;
    const aTool={...part(a,'near-tool'),mask:toolVariant,paint:toolVariant};
    const aRegrip=layeredCharacter(a,a.layers.map(p=>p.id===aTool.id?aTool:p),[aTool],direction,
      a.props.map(p=>p.hand==='near-hand'?{...p,masks:[aTool.mask]}:p));
    const elapsedAHandleMs=performance.now()-aEdit;
    const proceduralHandle=stroke(composite([band,editedBand].map(h=>paintHandTool([h],device,nearSocket,false).raster)));

    for(const [name,initial,changed,region,revision,operations,components,scriptElapsedMs,editSource] of [
      ['b-visor',b,recolor,visible(b,'visor'),2,1,1,elapsedVisorMs,source.groups[0]],
      ['b-handle',b,regrip,stroke(composite([handle.mask,part(regrip,'near-tool-handle').mask])),2,1,1,elapsedHandleMs,handSource.groups[2]],
      ['a-handle',a,aRegrip,proceduralHandle,2,1,0,elapsedAHandleMs,
        {id:'a-procedural-handle',revision:2,baseline:'character-equipment.ts',band:editedBand,socket:nearSocket}],
    ] as const) {
      const copy: CharacterRender=name.startsWith('b')?full(kit.groups.map(g=>placeGroup(g,point(g.anchor),direction))):
        fitIdentityHeadwear(base,rig.plan,study.identity,direction,e91.limits.padding).steps.s2;
      assert.deepEqual(copy.final,initial.final,'ROLLBACK_RGBA');
      assert.deepEqual(changed.pivot,initial.pivot);
      assert.deepEqual(changed.props.map(p=>p.socket),initial.props.map(p=>p.socket));
      assert.deepEqual(part(changed,'near-hand').mask,part(initial,'near-hand').mask,'EDIT_HAND_FOOTPRINT');
      if(name==='b-visor') {
        assert.deepEqual(changed.ownership,initial.ownership);
        assert.deepEqual(changed.mat,initial.mat);
      }
      const diff=delta(initial,changed,region);
      assert.ok(diff.changed>0,name);
      const qa=checkQualityCharacter(changed,e91.limits);
      const out='edits/'+name;
      png(out+'/before',initial.final);
      png(out+'/after',changed.final);
      png(out+'/diff',diff.image);
      png(out+'/allowed-owner',region);
      save(out+'/revision.json',jsonText({editSource,revision,sourceSha256:name.startsWith('b')?sources[kitFile]:sources['src/experiments/character-equipment.ts'],
        editedRevisionSha256:sha256(JSON.stringify(editSource)),provenance:name.startsWith('b')?kit.provenance:'PROCEDURALLY_GENERATED'}));
      // Mechanical latency is kept outside deterministic evidence.
      if(values.development) writeFileSync(join(root,out,'execution-time.json'),jsonText({scriptElapsedMs}));
      edits.push({name,changed:diff.changed,outside:diff.outside,operations,components,revision,qa,
        before:sha256(initial.final.rgba),after:sha256(changed.final.rgba),rollback:sha256(copy.final.rgba)});
    }
    edits.push({name:'a-visor',status:'CAPABILITY_GAP',operations:0,components:0});
  }
  cases.push({id:entry.id,name:entry.name,seed:entry.seed,role:entry.role,brief:entry.brief,folder,pose,provenance,contacts,
    results:result,matched:{changed:fair.changed,pixelsOutsideOwner:fair.outside,sameHook:true},edits,capabilityGaps:entry.capabilityGaps??[]});
  console.log(entry.id,result.map(x=>[x.arm,x.qa.bounds,x.qa.handTests[0].overlap,x.qa.handTests[0].join]),fair.changed);
}

save('benchmark.json',jsonText({status:values.development?'DEVELOPMENT_PASS':'E9_H1_READY_FOR_HUMAN_ART_QUALITY_REVIEW',
  componentGate:'COMPONENT_KIT_READY_FOR_HUMAN_REVIEW',authority:'ASSISTANT_REVIEW_RECOMMENDATION',art:'HUMAN_REVIEW_PENDING',
  checkpoint:study.checkpoint,studio:study.studio,style:study.style,keyLight:study.keyLight,
  view:study.view,camera:study.camera,pivot:study.pivot,cases,capabilityGaps:study.capabilityGaps,
  thresholds:study.thresholds,sources,freeze:values.development?null:sha256(read(seal)),files}));
writeFileSync(join(root,'SHA256SUMS'),Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([path,digest])=>digest+'  '+path).join('\n')+'\n');
