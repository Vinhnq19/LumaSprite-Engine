import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import type { Point } from '../src/core/geometry/shapes.ts';
import { pack } from '../src/core/palette/colors.ts';
import { composite, put, silhouette, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { checkQualityCharacter } from '../src/experiments/character-v4.ts';
import { wardrobeLayers } from '../src/experiments/character-v4-recovery.ts';
import { maskPixels, requireCostumeStance } from '../src/experiments/costume-stance.ts';
import { blank, ink, parseKit, type CharacterRender, type Kit } from '../src/experiments/hybrid-character-kit.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import type { PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { loadComposition } from '../src/generators/environment/composition.ts';
import { renderEnvironment } from '../src/generators/environment/render.ts';
import { sha256 } from '../src/quality/raster.ts';
import { assessPose, authorKnees, withPose } from './e9h1-closeout-pose.ts';
import { buildArms, e91, json, part, procedural, recoverCase, style, studyH1, type Entry } from './e9h1r-composition.ts';
import { inspectVisibility } from './e9h1r-visibility.ts';

const {values}=parseArgs({options:{development:{type:'boolean'},freeze:{type:'boolean'},publish:{type:'boolean'}}});
assert.ok(Object.values(values).filter(Boolean).length<=1);
const fixed='benchmarks/fixtures/e9h1-closeout/', h1r='benchmarks/fixtures/e9h1r/', past='benchmarks/results/e9h1r/';
const seal=fixed+'candidate-freeze.json', published='benchmarks/results/e9h1-closeout/';
const root=values.development?'.cache/e9h1-closeout-development/':values.publish?published:'benchmarks/results/run/e9h1-closeout/';
const dev='.cache/e9h1-closeout-development/';
const read=(p:string)=>readFileSync(p);
const hash=(p:string)=>sha256(read(p));
const text=(x:unknown)=>JSON.stringify(x,null,2)+'\n';
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
const study=json(fixed+'study.json'), old=json(h1r+'study.json');
const baseCase:Entry={...old.holdout,role:'diagnostic'};
const kitDraft=parseKit(json('benchmarks/fixtures/e9h1/kit.json')), recipes=json(h1r+'revisions.json');
const kit:Kit=parseKit({...kitDraft,groups:kitDraft.groups.map((g,i)=>({...g,revision:2,
  layers:g.layers.map(p=>({...p,...recipes.groups[i].layers.find((q:{id:string})=>q.id===p.id)}))}))});
const references=json(fixed+'reference-classes.json'), original=json(past+'benchmark.json');
const refs=original.referenceEvidence.map((ref:{id:string;source:string;sha256:string;humanApproval:string})=>{
  assert.equal(hash(ref.source),ref.sha256);
  assert.equal(ref.humanApproval,'PENDING');
  return {...ref,classification:references.classes[ref.id]};
});
assert.equal(refs.length,9);
assert.equal(Object.keys(references.classes).length,9);
assert.ok(refs.every((ref:{classification:string})=>['Diagnostic Reference','Style Candidate','Material Candidate','Geometry Reference'].includes(ref.classification)));
const vis=json(h1r+'visibility.json');
const sourceFiles=[...git('ls-files','src').split(/\r?\n/),'scripts/benchmark-e9h1-closeout.ts','scripts/e9h1-closeout-pose.ts',
  'scripts/e9h1r-composition.ts','scripts/e9h1r-visibility.ts',fixed+'study.json',fixed+'reference-classes.json',
  h1r+'study.json',h1r+'revisions.json',h1r+'visibility.json',h1r+'references.json',
  'benchmarks/fixtures/e9h1/study.json','benchmarks/fixtures/e9h1/kit.json',past+'benchmark.json',past+'SHA256SUMS',
  'benchmarks/results/e9h1/SHA256SUMS','benchmarks/fixtures/e91/study.json',studyH1.recipe.legacy,e91.direction.file,e91.scene,
  'benchmarks/fixtures/e61r/style-profile.json','benchmarks/fixtures/e62/c2-supply-stop.json',study.criteria.review,'package-lock.json'];
const sources=Object.fromEntries(sourceFiles.sort().map(p=>[p,sha256(read(p).toString('utf8').replaceAll('\r\n','\n'))]));
if(values.freeze) {
  const proof=json(dev+'benchmark.json');
  assert.deepEqual(proof.sources,sources);
  assert.equal(proof.status,'DEVELOPMENT_PASS');
  assert.deepEqual(proof.cases.map((row:{role:string})=>row.role),['diagnostic']);
  writeFileSync(seal,text({version:1,posePolicy:study.posePolicy,holdout:study.holdout,style:study.style,criteria:study.criteria,sources,
    developmentSha256:hash(dev+'benchmark.json'),procedure:'Sealed after the pose matrix and Breakwater diagnostic, before fresh synthesis.'}),{flag:'wx'});
  process.exit(0);
}
if(!values.development) {
  const frozen=json(seal);
  assert.deepEqual(frozen.sources,sources,'SEAL_SOURCE_DRIFT');
  assert.deepEqual(frozen.holdout,study.holdout);
  assert.equal(frozen.style,study.style);
  assert.deepEqual(frozen.criteria,study.criteria);
}
if(values.publish) assert.ok(!existsSync(published+'first-attempt.json')&&!existsSync(published+'benchmark.json'),'Use deterministic replay after publication.');

const files:Record<string,string>={};
function save(name:string,data:string|Buffer) {
  mkdirSync(dirname(root+name),{recursive:true});
  writeFileSync(root+name,data);
  files[name]=sha256(data);
}
function png(name:string,image:Raster) {
  const bytes=encodePng(image);
  assert.deepEqual(decodePng(bytes),image);
  save(name+'.png',bytes);
}
const matrix=[];
for(const item of study.matrix) {
  const entry=item.fixture==='breakwater'?baseCase:studyH1.development;
  const pose=entry.pose??{}, patch=item.pose??{};
  const spec=withPose({...entry,pose:{...pose,...patch,near:{...pose.near,...patch.near},far:{...pose.far,...patch.far}}},item.size);
  const audit=assessPose(item.bend?authorKnees(spec,item.bend):spec);
  if(item.rejectOnly||!item.expect.length) assert.deepEqual(audit.qa.errors,item.expect,item.id);
  else for(const code of item.expect) assert.ok(audit.qa.errors.includes(code),item.id+' missing '+code);
  if(item.verifyLeft) assert.ok(audit.joints.find(j=>j.side===item.verifyLeft)!.relativeToHip<0);
  png('pose/'+item.id,audit.render.flat);
  const anchors=blank();
  for(const joint of audit.joints) for(const [index,[x,y]] of [joint.hip,joint.knee,joint.ankle].entries())
    for(const pad of [-1,0,1]) {
      const color=pack(index===1?'#f7bb63':'#82e3b9');
      put(anchors,x+pad,y,color);
      put(anchors,x,y+pad,color);
    }
  png('pose/'+item.id+'-joints',composite([audit.render.flat,anchors]));
  matrix.push({id:item.id,outcome:audit.qa.errors.length?'EXPECTED_REJECTION':'PASS',errors:audit.qa.errors,
    joints:audit.joints,centerX:audit.qa.centerX,legGapRows:audit.qa.legGapRows,proportions:audit.proportions,tolerance:audit.forwardTolerance});
}

const scene:PilotBrief=JSON.parse((await pinnedFile({file:e91.scene,sha256:e91.sceneSha256})).toString('utf8'));
const world=await loadComposition(scene.scene), actor='courier', originalActor=world.environment.assets.get(actor)!;
const spawn=world.spec.spawns.find(s=>s.actor===actor)!;
const environment={...world.environment,style,spec:{...world.environment.spec,building:{...world.environment.spec.building,...scene.architecture}}};
const lightModes=['day','night'] as const;
function context(r:CharacterRender,light:typeof lightModes[number]) {
  const pixels=maskPixels(r.final);
  const assets=new Map(environment.assets);
  assets.set(actor,{...originalActor,colors:new Set(pixels.map(i=>ink(r.final,i))),raster:r.final,
    ref:{...originalActor.ref,pivot:[...r.pivot],sha256:sha256(encodePng(r.final))}});
  const rendered=renderEnvironment({...environment,assets},'B',light,{composition:world.spec,kitSeed:world.kitSeed});
  const {camera}=rendered.metadata;
  assert.deepEqual([camera.width,camera.height,camera.pixelsPerUnit],study.criteria.camera);
  const slots=new Set<number>(), color=pack(rendered.metadata.atlas.layerLegend.actor);
  for(const i of pixels) {
    const x=spawn.at[0]-r.pivot[0]+i%64,y=spawn.at[1]-r.pivot[1]+Math.floor(i/64);
    assert.ok(x>0&&x<319&&y>0&&y<207);
    const j=y*320+x;
    assert.equal(ink(rendered.raster,j),ink(r.final,i),'SCENE_RGBA');
    assert.equal(ink(rendered.layerOverlay,j),color,'SCENE_OCCLUSION');
    slots.add(j);
  }
  assert.equal(rendered.metadata.occlusion.find(s=>s.id===actor)!.visible,slots.size);
  return {raster:rendered.raster,collision:sha256(rendered.collisionPlane.rgba),slots};
}
function category(error:unknown) {
  const detail=String(error);
  if(/geometry failed|Joint segment|invalid ankle|POSE_|KNEE_DIRECTION/.test(detail))return 'POSE_GEOMETRY_FAILURE';
  if(/GRIP|COMPONENT|raw margin|headwear|body silhouette/i.test(detail))return 'COMPONENT_CAPABILITY_GAP';
  return 'COMPOSITION_FAILURE';
}
const entries=[{entry:baseCase,bend:study.breakwaterSourceIntent},...values.development?[]:[study.holdout]];
const cases=[];
for(const {entry,bend} of entries) {
  try {
    const authored=authorKnees(withPose(entry),bend);
    const poseEvidence=assessPose(authored);
    assert.equal(poseEvidence.qa.errors.length,0,'POSE_GEOMETRY_FAILURE '+poseEvidence.qa.errors.join(','));
    const input:Entry={...entry,pose:{...entry.pose,near:{...entry.pose?.near,knee:authored.pose.near.knee},
      far:{...entry.pose?.far,knee:authored.pose.far.knee}}};
    const {a,rig,headwear}=procedural(input);
    for(const leg of poseEvidence.joints) {
      for(const [name,point] of [['hip',leg.hip],['knee',leg.knee],['ankle',leg.ankle]] as const)
        assert.deepEqual(rig.landmarks[leg.side+'-'+name].point,point);
    }
    png(entry.role+'/authored-rig',poseEvidence.render.flat);
    const layout=recoverCase(a,vis.constraint,vis.layouts);
    assert.ok(layout.selected,'COMPOSITION_VISIBILITY');
    const base=layout.render, locate=(name:string):Point=>rig.landmarks[name].point;
    const d=buildArms(base,locate,kitDraft,input), r=buildArms(base,locate,kit,input);
    for(const matched of [d.matched,r.matched]) {
      assert.deepEqual(matched.props,base.props,'CAPABILITY_MATCH');
      for(const id of ['near-tool','far-tool']) assert.deepEqual(part(matched,id).mask,part(base,id).mask);
    }
    const arms=[['a0',base],['matched-r1',d.matched],['matched-r2',r.matched],['full-r1',d.full],['full-r2',r.full]] as const;
    const sceneBase=lightModes.map(mode=>context(base,mode));
    const variants=[];
    const failures=[];
    for(const [arm,sprite] of arms) {
      const folder=entry.role+'/'+arm;
      png(folder+'/sprite',sprite.final);
      png(folder+'/silhouette',silhouette(sprite.final,pack('#e6e0ce')));
      png(folder+'/ownership',sprite.ownership);
      png(folder+'/materials',sprite.mat);
      const scenes=[];
      try {
        for(const [i,mode] of lightModes.entries()) {
          const current=context(sprite,mode), compare=sceneBase[i];
          png(folder+'/'+mode,current.raster);
          assert.equal(current.collision,compare.collision);
          for(let at=0;at<320*208;at++) if(!current.slots.has(at)&&!compare.slots.has(at))
            assert.equal(ink(current.raster,at),ink(compare.raster,at),'SCENE_BACKGROUND');
          scenes.push({mode,visible:current.slots.size,collision:current.collision});
        }
        const qa=checkQualityCharacter(sprite,e91.limits);
        const stance=requireCostumeStance(wardrobeLayers(sprite,rig,'a-line').stance,e91.limits.minimumLegGapRows);
        const visibility=inspectVisibility(sprite.layers,vis.constraint);
        const shown=maskPixels(sprite.ownership).filter(i=>ink(sprite.ownership,i)===sprite.labels['far-shin']).length;
        assert.equal(shown,visibility.visible,'VISIBILITY_MASK');
        assert.ok(visibility.pass,'COMPOSITION_VISIBILITY');
        assert.deepEqual(sprite.pivot,study.criteria.pivot);
        variants.push({arm,qa,stance,visibility,scenes});
      } catch(error) {
        failures.push({arm,code:category(error),detail:String(error)});
      }
    }
    cases.push({id:entry.id,seed:entry.seed,role:entry.role,brief:entry.brief,pose:authored.pose,
      joints:poseEvidence.joints,headwear,layout:{id:layout.selected,attempts:layout.attempts},
      variants,status:failures.length?'TECHNICAL_BLOCKED':'TECHNICAL_PASS',failures});
  } catch(error) {
    cases.push({id:entry.id,seed:entry.seed,role:entry.role,brief:entry.brief,status:'TECHNICAL_BLOCKED',
      failures:[{code:category(error),detail:String(error)}]});
  }
}
const blocked=cases.some(row=>row.status!=='TECHNICAL_PASS');
const status=blocked?'E9_H1_CLOSEOUT_TECHNICAL_BLOCKED':values.development?'DEVELOPMENT_PASS':'TECHNICAL_PASS';
save('benchmark.json',text({status,checkpoint:study.checkpoint,style:study.style,poseRule:'EXISTING_VALIDATOR_RETAINED',
  authoring:'RESEARCH_POSE_SOURCE_ONLY',referenceStatus:references.status,owner:'PENDING',
  seal:values.development?null:hash(seal),sources,componentRevisions:original.revisions,matrix,cases,references:refs,files}));
writeFileSync(root+'SHA256SUMS',Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([p,h])=>h+'  '+p).join('\n')+'\n');
if(values.publish) writeFileSync(root+'first-attempt.json',text({
  status,sourceCommit:git('rev-parse','HEAD'),sealSha256:hash(seal),benchmarkSha256:hash(root+'benchmark.json'),
  manifestSha256:hash(root+'SHA256SUMS'),holdout:cases[1],exitCode:Number(blocked),
}),{flag:'wx'});
console.log(status,matrix.length,cases.map(x=>[x.role,x.status,x.layout?.id,x.failures]));
if(blocked)process.exitCode=1;
