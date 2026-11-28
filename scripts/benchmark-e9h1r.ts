import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { outline, rect } from '../src/core/geometry/faces.ts';
import { fillPolygon, type Point } from '../src/core/geometry/shapes.ts';
import { inkLuma, pack } from '../src/core/palette/colors.ts';
import { composite, makeRaster, put, silhouette, type Raster } from '../src/core/pixels/raster.ts';
import { encodePng, decodePng } from '../src/core/renderer/png.ts';
import { checkQualityCharacter } from '../src/experiments/character-v4.ts';
import { rasterBounds } from '../src/experiments/character-headwear-fit.ts';
import { requireCostumeStance, maskPixels } from '../src/experiments/costume-stance.ts';
import { wardrobeLayers } from '../src/experiments/character-v4-recovery.ts';
import { blank, contains, ink, offset, parseKit, pixel, set, type CharacterRender, type Kit, type PaintedPart } from '../src/experiments/hybrid-character-kit.ts';
import { materialMaskLegend } from '../src/generators/character/materials.ts';
import { loadComposition } from '../src/generators/environment/composition.ts';
import { renderEnvironment } from '../src/generators/environment/render.ts';
import type { PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { sha256 } from '../src/quality/raster.ts';
import { buildArms, e91, history, json, part, procedural, recoverCase, style, studyH1, type Entry } from './e9h1r-composition.ts';
import { inspectVisibility, type VisibilityRule } from './e9h1r-visibility.ts';

type EditIntent={id:string; group:number; layer:string; description:string; reference:string;
  region?:readonly [number,number,number,number]; tone?:'shadow'|'accent'|'base'; ramp?:'coat'|'cap'|'metal'};
const {values}=parseArgs({options:{development:{type:'boolean'},freeze:{type:'boolean'},publish:{type:'boolean'}}});
assert.ok(Object.values(values).filter(Boolean).length<=1);
const fixture='benchmarks/fixtures/e9h1r/', output='benchmarks/results/e9h1r/';
const seal=fixture+'candidate-freeze.json', dev='.cache/e9h1r-development/';
const root=values.development?dev:values.publish?output:'benchmarks/results/run/e9h1r/';
const writer=(data:unknown)=>JSON.stringify(data,null,2)+'\n';
const read=(file:string)=>readFileSync(file);
const textSha=(file:string)=>sha256(read(file).toString('utf8').replaceAll('\r\n','\n'));
const study=json(fixture+'study.json'), vis=json(fixture+'visibility.json');
const rule:VisibilityRule=vis.constraint;
assert.ok(rule.minimumPixels>=9&&rule.minimumRows>=3&&rule.minimumFraction>=.25);
const refs=json(fixture+'references.json');
const revisions=json(fixture+'revisions.json');
const edits:EditIntent[]=json(fixture+'masked-edits.json');
assert.equal(revisions.schema,'lumasprite.e9h1r.revisions.v1');
assert.equal(revisions.classification,'ENGINEER_CURATED');
assert.equal(revisions.review,'DRAFT');
assert.equal(revisions.licence,null);
const old=JSON.parse(read(history+'benchmark.json').toString('utf8'));
const draft=parseKit(json(revisions.base));
const lockedInputs=[fixture+'study.json',fixture+'visibility.json',fixture+'revisions.json',fixture+'references.json',
  fixture+'masked-edits.json','scripts/benchmark-e9h1r.ts','scripts/e9h1r-composition.ts','scripts/e9h1r-visibility.ts',
  'benchmarks/fixtures/e9h1/kit.json','benchmarks/fixtures/e9h1/study.json',history+'benchmark.json',history+'SHA256SUMS',
  'benchmarks/fixtures/e91/study.json','benchmarks/fixtures/e61r/style-profile.json','benchmarks/fixtures/e62/c2-supply-stop.json',
  e91.direction.file,e91.scene,studyH1.recipe.legacy,studyH1.thresholds.rubric,'package-lock.json'];
const tracked=execFileSync('git',['ls-files','src'],{encoding:'utf8'}).trim().split(/\r?\n/);
const sources=Object.fromEntries([...new Set([...tracked,...lockedInputs])].sort().map(file=>[file,textSha(file)]));
const baseSha = sha256(read(history+'SHA256SUMS'));
assert.equal(refs.sourceCommit,study.checkpoint);
const referenceEvidence=[];
assert.equal(refs.references.length,9);
const ids=new Set(refs.references.map((r:{id:string})=>r.id));
assert.equal(ids.size,9);
for(const ref of refs.references) {
  const digest=sha256(read(ref.source));
  assert.equal(digest,old.files[ref.source.slice(history.length)]);
  assert.equal(ref.humanApproval,'PENDING');
  referenceEvidence.push({...ref,sha256:digest});
}
assert.equal(revisions.groups.length,3);
for(const [i,revision] of revisions.groups.entries()) {
  assert.equal(revision.id,draft.groups[i].id);
  assert.equal(revision.revision,2);
  assert.ok(revision.references.every((id:string)=>ids.has(id)));
  assert.equal(new Set(revision.layers.map((p:{id:string})=>p.id)).size,revision.layers.length);
}
const revised:Kit=parseKit({...draft,groups:draft.groups.map((group,i)=>({...group,revision:2,
  layers:group.layers.map(p=>({...p,...revisions.groups[i].layers.find((change:{id:string})=>change.id===p.id)}))
}))});
assert.deepEqual(revised.groups.map(g=>g.sockets),draft.groups.map(g=>g.sockets));

if(values.freeze) {
  const evidence=json(dev+'benchmark.json');
  assert.equal(evidence.status,'DEVELOPMENT_PASS');
  assert.deepEqual(evidence.cases.map((c:{role:string})=>c.role),['development','diagnostic']);
  assert.deepEqual(evidence.sources,sources);
  writeFileSync(seal,writer({version:1,holdout:study.holdout,criteria:study.require,sources,baseSha,
    developmentSha256:sha256(read(dev+'benchmark.json')),process:'Sealed after development and Saltmarsh diagnostic, before first Breakwater holdout raster.'}),{flag:'wx'});
  process.exit(0);
}
if(!values.development) {
  const fixed=json(seal);
  assert.deepEqual(fixed.sources,sources,'FREEZE_INPUTS_CHANGED');
  assert.deepEqual(fixed.holdout,study.holdout);
  assert.deepEqual(fixed.criteria,study.require);
  assert.equal(fixed.baseSha,baseSha);
}

const files:Record<string,string>={};
function save(name:string,data:string|Buffer) {
  mkdirSync(dirname(root+name),{recursive:true});
  writeFileSync(root+name,data);
  files[name]=sha256(data);
}
function png(name:string,r:Raster) {
  const bytes=encodePng(r);
  assert.deepEqual(decodePng(bytes),r);
  save(name+'.png',bytes);
}
function crop(r:Raster,[x,y]:Point,w:number,h:number) {
  const out=makeRaster(w,h), u=Math.max(0,Math.min(r.w-w,x-Math.floor(w/2))), v=Math.max(0,Math.min(r.h-h,y-Math.floor(h/2)));
  for(let row=0;row<h;row++) r.rgba.copy(out.rgba,row*w*4,((v+row)*r.w+u)*4,((v+row)*r.w+u+w)*4);
  return out;
}
const maskInk=pack('#e6e0ce');
const join=(...images:Raster[])=>composite(images);
const stroke=(r:Raster)=>outline(r,pack('#ffffff'));
const bodyOnly=(r:CharacterRender)=>silhouette(composite(r.layers.filter(p=>
  !p.id.includes('-tool')&&!['air-tank','tank-valve','air-hose'].includes(p.id)).map(p=>p.mask)),maskInk);
function owned(r:CharacterRender,id:string){
  const out=blank();
  for(const i of maskPixels(r.ownership)) if(ink(r.ownership,i)===r.labels[id]) set(out,i,maskInk);
  return out;
}
function difference(before:CharacterRender,after:CharacterRender,allowed:Raster) {
  const diff=blank();
  let changed=0,outside=0;
  for(let i=0;i<4096;i++) {
    const rgba=ink(before.final,i)!==ink(after.final,i);
    const masks=ink(before.ownership,i)!==ink(after.ownership,i)||ink(before.mat,i)!==ink(after.mat,i);
    if((rgba||masks)&&!contains(allowed,i)) outside++;
    if(rgba) { changed++; set(diff,i,pack(!contains(before.final,i)?'#91e8ba':!contains(after.final,i)?'#f79182':'#ffdc88')); }
  }
  assert.equal(outside,study.require.maxOutsideMaskedPixels,'CHANGE_OUTSIDE_MASK');
  return {diff,changed,outside};
}
const cross=(r:Raster,points:Point[])=>{
  const view=blank();
  for(const [x,y] of points) for(const i of [-2,-1,0,1,2]) {
    put(view,x+i,y,pack('#ffcc7c'));
    put(view,x,y+i,pack('#ffcc7c'));
  }
  return join(r,view);
};

const pilot:PilotBrief=JSON.parse((await pinnedFile({file:e91.scene,sha256:e91.sceneSha256})).toString('utf8'));
const world=await loadComposition(pilot.scene), actor='courier', spawn=world.spec.spawns.find(s=>s.actor===actor)!;
const env={...world.environment,style,spec:{...world.environment.spec,building:{...world.environment.spec.building,...pilot.architecture}}};
const initial=env.assets.get(actor)!;
const lights=['day','night'] as const;
function context(r:CharacterRender,light:typeof lights[number]) {
  const assets=new Map(env.assets), slots=new Set<number>(), point=spawn.at;
  const pixels=maskPixels(r.final);
  assets.set(actor,{...initial,raster:r.final,colors:new Set(pixels.map(i=>ink(r.final,i))),
    ref:{...initial.ref,pivot:[...r.pivot],sha256:sha256(encodePng(r.final))}});
  const out=renderEnvironment({...env,assets},'B',light,{composition:world.spec,kitSeed:world.kitSeed});
  const camera=out.metadata.camera, color=pack(out.metadata.atlas.layerLegend.actor);
  assert.deepEqual([camera.width,camera.height,camera.pixelsPerUnit],study.require.context);
  let edgeCount=0,weakEdges=0;
  for(const i of pixels) {
    const x=point[0]-r.pivot[0]+i%64,y=point[1]-r.pivot[1]+Math.floor(i/64),j=y*320+x;
    assert.ok(x>0&&x<319&&y>0&&y<207);
    assert.equal(ink(out.layerOverlay,j),color,'SCENE_OCCLUSION');
    assert.equal(ink(out.raster,j),ink(r.final,i),'SCENE_RGBA');
    slots.add(j);
    for(const [u,v] of [[i-1,j-1],[i+1,j+1],[i-64,j-320],[i+64,j+320]]) if(!contains(r.final,u)){
      edgeCount++;
      if(Math.abs(inkLuma(ink(r.final,i))-inkLuma(ink(out.raster,v)))<18) weakEdges++;
    }
  }
  assert.equal(out.metadata.occlusion.find(x=>x.id===actor)!.visible,slots.size);
  return {raster:out.raster,slots,collision:sha256(out.collisionPlane.rgba),visible:slots.size,edgeCount,weakEdges};
}
function compareContext(a:ReturnType<typeof context>,b:ReturnType<typeof context>){
  assert.equal(a.collision,b.collision);
  let outside=0;
  for(let i=0;i<320*208;i++) if(!a.slots.has(i)&&!b.slots.has(i)) {
    assert.equal(ink(a.raster,i),ink(b.raster,i),'SCENE_BACKGROUND');
    outside++;
  }
  return outside;
}
function classOf(error:unknown) {
  const message=String(error);
  if(/grip|near-hand|forearm/i.test(message))return 'GRIP_FAILURE';
  if(/palette|rgba/i.test(message))return 'STYLE_DRIFT';
  if(/layer|socket|raw margin|contact|component/i.test(message))return 'COMPONENT_CAPABILITY_GAP';
  return 'COMPOSITION_FAILURE';
}

const entries:Entry[]=[studyH1.development,{...studyH1.holdout,role:'diagnostic',pose:{near:studyH1.holdout.near,far:studyH1.holdout.far}},
  ...values.development?[]:[study.holdout]];
const rows=[];
for(const entry of entries) {
  const scope=entry.role;
  const problems:{code:string;detail:string}[]=[];
  const addError=(error:unknown)=>problems.push({code:classOf(error),detail:String(error)});
  try {
    const {a,rig,pose,headwear}=procedural(entry);
    const locate=(name:string):Point=>rig.landmarks[name].point;
    const current=recoverCase(a,rule,vis.layouts), base=current.render;
    if(!current.selected)problems.push({code:'COMPOSITION_FAILURE',detail:'No declared case layout preserved the far-shin requirements.'});
    const oldArms=buildArms(a,locate,draft,entry), fixedDraft=buildArms(base,locate,draft,entry), fixed=buildArms(base,locate,revised,entry);
    const [stopHead,stopSuit,stopGrip]=fixed.placed;
    const overlap=(a:Raster,b:Raster)=>maskPixels(a).filter(i=>contains(b,i)).length;
    const contacts={neck:overlap(stopHead[0].mask,part(base,'neck').mask),
      suit:overlap(composite(stopHead.map(p=>p.mask)),stopSuit[2].mask),wrist:overlap(stopGrip[2].mask,part(base,'near-forearm').mask)};
    assert.ok(Object.values(contacts).every(n=>n>=2),'COMPONENT_CONTACT');
    for(const [i,group] of revised.groups.entries()) {
      const anchors=Object.fromEntries(Object.entries(group.sockets).map(([name,xy])=>[name,offset(locate(group.anchor),xy)]));
      assert.ok(Object.values(anchors).every(xy=>xy.every(v=>Number.isInteger(v)&&v>=1&&v<=62)));
      if(i===0) assert.ok(contains(part(fixed.full,'visor').mask,pixel(anchors.visorSeat)));
      if(i===1) assert.ok(contains(part(fixed.full,'air-tank').mask,pixel(anchors.tankMount)));
      if(i===2) {
        assert.deepEqual(anchors.grip,locate('near-palm'));
        assert.deepEqual(anchors.wrist,locate('near-wrist'));
      }
    }
    if(scope!=='fresh') {
      const folder=scope==='diagnostic'?'holdout':scope;
      for(const [name,r] of [['a',a],['matched',oldArms.matched],['full',oldArms.full]] as const)
        assert.equal(sha256(encodePng(r.final)),old.files[folder+'/'+name+'/sprite.png'],'E9_H1_CONTROL_DRIFT');
    }
    for(const candidate of [fixedDraft.matched,fixed.matched,fixedDraft.full,fixed.full])
      for(const p of base.layers.filter(p=>/-(thigh|shin|boot)$/.test(p.id)))
        assert.deepEqual(part(candidate,p.id).mask,p.mask,'LEG_GEOMETRY_DRIFT');
    for(const candidate of [fixed.matched,fixedDraft.matched]){
      assert.deepEqual(candidate.props,base.props,'PAIRED_CAPABILITY_DRIFT');
      for(const id of ['near-tool','far-tool'])assert.deepEqual(part(candidate,id).mask,part(base,id).mask);
    }
    const allowed=stroke(join(part(base,'near-hand').mask,part(fixedDraft.matched,'near-hand').mask,part(fixed.matched,'near-hand').mask));
    const pairedDiff=difference(fixedDraft.matched,fixed.matched,allowed);
    const controlDiff=difference(base,fixed.matched,allowed);
    png(scope+'/paired-change',pairedDiff.diff);
    png(scope+'/paired-allowed',allowed);
    const originalShin=part(a,'far-shin').mask;
    assert.deepEqual(originalShin,part(base,'far-shin').mask);
    if(scope==='diagnostic'){
      for(const [label,r] of [['before-a0',a],['before-matched',oldArms.matched],['before-full',oldArms.full],['after-a0',base]] as const){
        png('diagnostic/'+label+'/sprite',r.final);
        png('diagnostic/'+label+'/shin-visible',owned(r,'far-shin'));
        png('diagnostic/'+label+'/equipment',part(r,'far-tool').mask);
      }
      png('diagnostic/raw-shin',originalShin);
      assert.deepEqual(current.attempts[0],{id:'original',raw:48,visible:0,obscured:{'far-tool':36,'far-boot':12},rows:[],longest:0,pass:false});
    }
    const arms=[['a0',base],['matched-draft',fixedDraft.matched],['matched-refined',fixed.matched],
      ['full-draft',fixedDraft.full],['full-refined',fixed.full]] as const;
    const scenes=lights.map(l=>context(base,l));
    const results=[];
    for(const [id,r] of arms){
      const folder=scope+'/'+id, visibility=inspectVisibility(r.layers,rule);
      const found=maskPixels(owned(r,'far-shin')).length;
      assert.equal(found,visibility.visible,'VISIBILITY_OWNER_MISMATCH');
      if(!visibility.pass)problems.push({code:'COMPOSITION_FAILURE',detail:id+' required far-shin visibility: '+found});
      const point=locate('near-palm');
      for(const [name,image] of Object.entries({sprite:r.final,silhouette:silhouette(r.final,maskInk),body:bodyOnly(r),
        head:crop(r.final,offset(locate('crown'),[0,3]),32,28),grip:crop(r.final,offset(point,[-4,-2]),36,26),
        material:r.mat,ownership:r.ownership,anchors:cross(r.final,[r.pivot,point,locate('neck'),locate('far-palm')]),
      }))png(folder+'/'+name,image);
      const scenery=[];
      for(const [i,light] of lights.entries()) {
        try {
          const scene=context(r,light);
          png(folder+'/'+light,scene.raster);
          scenery.push({light,visible:scene.visible,edgeCount:scene.edgeCount,weakEdges:scene.weakEdges,
            unchangedBackground:compareContext(scenes[i],scene),collision:scene.collision});
        }catch(error){addError(error);}
      }
      try {
        const qa=checkQualityCharacter(r,e91.limits);
        const stance=requireCostumeStance(wardrobeLayers(r,rig,'a-line').stance,e91.limits.minimumLegGapRows);
        results.push({id,visibility,qa,stance,scenery});
      } catch(error){addError(error);results.push({id,visibility,scenery});}
    }
    const local=[];
    if(scope==='development') {
      for(const [index,revision] of revisions.groups.entries()) {
        const record=(parts:PaintedPart[],kit:Kit,label:string,assembled:CharacterRender)=>{
          const group=kit.groups[index], name='kit/'+group.id+'/'+label;
          const native=composite(parts.map(p=>p.paint));
          png(name+'/native',native);
          png(name+'/silhouette',silhouette(native,maskInk));
          png(name+'/material',composite(parts.map(p=>silhouette(p.mask,pack(materialMaskLegend[p.role])))));
          png(name+'/owners',composite(parts.map(p=>silhouette(p.mask,assembled.labels[p.id]))));
          png(name+'/anchors',cross(native,Object.values(group.sockets).map(p=>offset(locate(group.anchor),p))));
        };
        record(fixedDraft.placed[index],draft,'draft',fixedDraft.full);
        record(fixed.placed[index],revised,'refined',fixed.full);
        const single=parseKit({...draft,groups:draft.groups.map((group,i)=>i===index?revised.groups[i]:group)});
        const trial=buildArms(base,locate,single,entry).full;
        png('kit/'+revision.id+'/single-group-trial',trial.final);
        png('kit/'+revision.id+'/single-group-day',context(trial,'day').raster);
        png('kit/'+revision.id+'/single-group-night',context(trial,'night').raster);
      }
      for(const intent of edits) {
        assert.ok(ids.has(intent.reference)&&Number.isInteger(intent.group));
        const copy=structuredClone(revised), group=copy.groups[intent.group];
        const edit=group.layers.find(p=>p.id===intent.layer)!;
        group.revision++;
        const area=owned(fixed.full,intent.layer);
        if(intent.ramp) edit.ramp=intent.ramp;
        if(intent.region&&intent.tone) {
          const [l,t,r,b]=intent.region;
          const region=blank();
          fillPolygon(region,rect(l,t,r,b).map(p=>offset(locate(group.anchor),p)),maskInk);
          for(const i of maskPixels(area)) if(!contains(region,i)) set(area,i,0);
          edit.patches.push({tone:intent.tone,points:rect(l,t,r,b).map(([x,y]):[number,number]=>[x,y])});
        }
        const edited=buildArms(base,locate,parseKit(copy),entry).full;
        const diff=difference(fixed.full,edited,area);
        assert.ok(diff.changed>0,'EDIT_MUST_CHANGE_PIXELS '+intent.id);
        assert.deepEqual(edited.props,fixed.full.props);
        assert.deepEqual(edited.pivot,fixed.full.pivot);
        assert.deepEqual(edited.mat,fixed.full.mat);
        assert.deepEqual(edited.ownership,fixed.full.ownership);
        const rollback=buildArms(base,locate,revised,entry).full;
        assert.deepEqual(rollback.final,fixed.full.final);
        const out='edits/'+intent.id;
        png(out+'/before',fixed.full.final);png(out+'/after',edited.final);
        png(out+'/allowed-owner',area);png(out+'/diff',diff.diff);
        save(out+'/revision.json',writer({intent,group,baseRevision:2,revision:3,provenance:copy.provenance,
          sourceSha256:sha256(JSON.stringify(group)),rgbaSha256:sha256(edited.final.rgba)}));
        local.push({intent,revision:3,changed:diff.changed,outside:diff.outside,before:sha256(fixed.full.final.rgba),
          after:sha256(edited.final.rgba),rollback:sha256(rollback.final.rgba)});
      }
    }
    const status=problems.length?'TECHNICAL_BLOCKED':'TECHNICAL_PASS';
    rows.push({id:entry.id,name:entry.name,role:scope,seed:entry.seed,brief:entry.brief,pose,headwear,contacts,status,problems,
      layout:{selected:current.selected,attempts:current.attempts},paired:{refinementChanged:pairedDiff.changed,controlChanged:controlDiff.changed,outside:pairedDiff.outside},results,local,
      fullParts:{helmet:rasterBounds(stopHead[0].mask),torso:rasterBounds(stopSuit[2].mask),hook:rasterBounds(stopGrip[0].mask)}});
    console.log(scope,status,current.selected,current.visibility?.visible,pairedDiff.changed,problems);
  }catch(error){
    addError(error);
    rows.push({id:entry.id,name:entry.name,role:scope,seed:entry.seed,brief:entry.brief,status:'TECHNICAL_BLOCKED',problems});
    console.log(scope,problems);
  }
}

const blocked=rows.some(c=>c.status!=='TECHNICAL_PASS');
save('benchmark.json',writer({status:blocked?'E9_H1R_TECHNICAL_BLOCKED':values.development?'DEVELOPMENT_PASS':'E9_H1R_READY_FOR_HUMAN_ART_QUALITY_REVIEW',
  checkpoint:study.checkpoint,art:'UNSIGNED',authority:'ASSISTANT_REVIEW_RECOMMENDATION',referenceStatus:'PENDING',production:'ISOLATED_RESEARCH_ONLY',
  freeze:values.development?null:sha256(read(seal)),sources,referenceEvidence,revisionSource:sources[fixture+'revisions.json'],
  originalKit:sources[revisions.base],revisions:revised.groups.map((g,i)=>({id:g.id,revision:g.revision,anchors:g.sockets,
    sha256:sha256(JSON.stringify(g)),title:revisions.groups[i].title,intent:revisions.groups[i].intent,refs:revisions.groups[i].references})),
  caseConstraint:vis, cases:rows,files}));
writeFileSync(root+'SHA256SUMS',Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([path,sha])=>sha+'  '+path).join('\n')+'\n');
if(blocked)process.exitCode=1;
