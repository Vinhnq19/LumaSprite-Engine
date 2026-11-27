import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { inkLuma, pack } from '../src/core/palette/colors.ts';
import { makeRaster, nearestNeighbor, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { checkQualityCharacter, legacyBody, renderQualityCharacter, type Case, type Stage } from '../src/experiments/character-v4.ts';
import { crossAssetStyle, loadArtDirection } from '../src/experiments/art-direction.ts';
import type { PilotBrief } from '../src/experiments/cross-asset-pilot.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { loadComposition } from '../src/generators/environment/composition.ts';
import { renderEnvironment } from '../src/generators/environment/render.ts';
import { characterSpecSchema } from '../src/specs/character.ts';
import { sha256 } from '../src/quality/raster.ts';

const { values } = parseArgs({ options:{ development:{type:'boolean'}, freeze:{type:'boolean'}, publish:{type:'boolean'}, out:{type:'string'} } });
assert.ok([values.development, values.freeze, values.publish, values.out].filter(Boolean).length <= 1);
const inputs='benchmarks/fixtures/e91/', results='benchmarks/results/e91/';
const read=readFileSync;
const json=(bytes:Buffer)=>JSON.parse(bytes.toString('utf8'));
const contents=(obj:unknown)=>JSON.stringify(obj,null,2)+'\n';
const lock=json(read(inputs+'study.json'));
const e90=lock.e90 as string;
const chart=read('docs/art-quality/art-quality-rubric-v2.json');
assert.equal(sha256(chart),lock.rubricSha256);
assert.equal(sha256(read('docs/reports/e90-art-quality-audit.md')),lock.e90BriefSha256);
assert.deepEqual([lock.canvas,lock.pivot,lock.view,lock.keyLight,lock.style],[64,[32,58],'three-quarter-right','upper-left','weathered-station-v1']);
const cases=lock.cases as Case[];
assert.deepEqual(cases.map(c=>[c.role,c.seeds]),[['development',[24137,24138]],['holdout',[55271]]]);
const normalized=(path:string)=>read(path,'utf8').replaceAll('\r\n','\n');
const fixed=[inputs+'study.json','src/experiments/character-v4.ts','scripts/benchmark-e91.ts',
  ...cases.map(c=>c.legacy),lock.direction.file,lock.scene,'docs/reports/e90-art-quality-audit.md','docs/art-quality/art-quality-rubric-v2.json'];
const seal=inputs+'candidate-freeze.json';
const fingerprints=Object.fromEntries(fixed.map(path=>[path,sha256(normalized(path))]));
if(values.freeze){
  const raw=read('.cache/e91-development/benchmark.json'), old=json(raw);
  assert.equal(old.cases.length,2);
  assert.ok(old.cases.every((c:{role:string; failures:unknown[]})=>c.role==='development' && !c.failures.length));
  writeFileSync(seal,contents({ version:1, procedure:'Frozen after development and before first Marsh Apothecary render.',
    selected:'b4', source:fingerprints, developmentManifestSha256:sha256(raw) }),{flag:'wx'});
  process.exit(0);
}
if(!values.development)assert.deepEqual(json(read(seal)).source,fingerprints,'HOLDOUT_FREEZE_CHANGED');
const root=values.out??(values.development?'.cache/e91-development':values.publish?results:'benchmarks/results/run/e91');
const files:Record<string,string>={};
const save=(name:string,value:Buffer|string)=>{
  const path=join(root,name);
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,value);
  files[name]=sha256(Buffer.from(value));
};
const png=(name:string,r:Raster)=>{
  const bytes=encodePng(r);
  assert.deepEqual(decodePng(bytes),r);
  save(name+'.png',bytes);
  return sha256(bytes);
};
const pair=(name:string,r:Raster)=>{
  const native=png(name,r);
  png(name+'-4x',nearestNeighbor(r,4));
  return native;
};
const {spec: art,profile}=await loadArtDirection(json(await pinnedFile(lock.direction)));
const { profile:style,device,character }=crossAssetStyle(profile,art);
const heritage:PilotBrief=json(await pinnedFile({file:lock.scene,sha256:lock.sceneSha256}));
const base=await loadComposition(heritage.scene);
const actor='courier', entry=base.spec.spawns.find(s=>s.actor===actor);
assert.ok(entry);
const at=entry.at, original=base.environment.assets.get(actor)!;
const environment = {...base.environment,style,spec:{...base.environment.spec,building:{...base.environment.spec.building,...heritage.architecture}}};
function context(r:ReturnType<typeof renderQualityCharacter>, light:'day'|'night'){
  const assets=new Map(environment.assets);
  const colors=new Set<number>();
  for(let i=0;i<r.final.rgba.length;i+=4) if(r.final.rgba[i+3]) colors.add(r.final.rgba.readUInt32BE(i));
  assets.set(actor,{...original,ref:{...original.ref,pivot:[...r.pivot],sha256:sha256(encodePng(r.final))},raster:r.final,colors});
  const out=renderEnvironment({...environment,assets},'B',light,{composition:base.spec,kitSeed:base.kitSeed});
  const measured=out.metadata.occlusion.find(p=>p.id===actor)!;
  const inks = pack(out.metadata.atlas.layerLegend.actor);
  const [left,top]=[at[0]-r.pivot[0],at[1]-r.pivot[1]];
  const projected=new Set<number>();
  const edge:number[]=[];
  const img=out.raster;
  const pixel=(x:number,y:number)=>img.rgba.readUInt32BE((y*img.w+x)*4);
  for(let y=0;y<64;y++) for(let x=0;x<64;x++) if(r.final.rgba[(y*64+x)*4+3]){
    const u=left+x,v=top+y;
    assert.ok(u>0&&v>0&&u<img.w-1&&v<img.h-1);
    projected.add(v*img.w+u);
    assert.equal(out.layerOverlay.rgba.readUInt32BE((v*img.w+u)*4),inks,'SCENE_ACTOR_OCCLUDED');
    assert.equal(pixel(u,v),r.final.rgba.readUInt32BE((y*64+x)*4),'SCENE_ACTOR_RGB');
    for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
      if(r.final.rgba[((y+dy)*64+x+dx)*4+3])continue;
      edge.push(Math.abs(inkLuma(pixel(u,v))-inkLuma(pixel(u+dx,v+dy))));
    }
  }
  assert.equal(projected.size,measured.visible);
  assert.deepEqual([out.metadata.camera.width,out.metadata.camera.height,out.metadata.camera.pixelsPerUnit],[320,208,32]);
  assert.equal(pixel(at[0],at[1]-1),r.final.rgba.readUInt32BE(((r.pivot[1]-1)*64+r.pivot[0])*4));
  return {image:img,projected,geometry:sha256(out.collisionPlane.rgba),camera:out.metadata.camera,
    edges:{ samples:edge.length,weak:edge.filter(gap=>gap<lock.limits.minimumNightEdgeLuma).length,
      p10:[...edge].sort((a,b)=>a-b)[Math.floor(edge.length*.1)]},visible:measured.visible,anchor:at};
}
function compareScene(a:ReturnType<typeof context>,b:ReturnType<typeof context>){
  assert.deepEqual([a.geometry,a.anchor,a.camera],[b.geometry,b.anchor,b.camera]);
  for(let i=0;i<a.image.w*a.image.h;i++)if(!a.projected.has(i)&&!b.projected.has(i))
    assert.equal(a.image.rgba.readUInt32BE(i*4),b.image.rgba.readUInt32BE(i*4),'SCENE_CHANGED_OUTSIDE_SUBJECT');
}
function diff(a:Raster,b:Raster){
  const image=makeRaster(a.w,a.h);
  let added=0,removed=0,paint=0;
  for(let i=0;i<a.rgba.length;i+=4){
    if(a.rgba.readUInt32BE(i)===b.rgba.readUInt32BE(i))continue;
    if(!a.rgba[i+3])added++;
    else if(!b.rgba[i+3])removed++;
    else paint++;
    image.rgba.writeUInt32BE(pack(!a.rgba[i+3]?'#7bd9a7':!b.rgba[i+3]?'#ee8e83':'#efbe71'),i);
  }
  return {image,added,removed,paint};
}
function zoomHand(r:Raster,socket:readonly [number,number]){
  const w=25,h=25,out=makeRaster(w,h);
  const x=Math.max(0,Math.min(r.w-w,socket[0]-12)),y=Math.max(0,Math.min(r.h-h,socket[1]-12));
  for(let j=0;j<h;j++)r.rgba.copy(out.rgba,j*w*4,((y+j)*r.w+x)*4,((y+j)*r.w+x+w)*4);
  return out;
}

const hypotheses={
  a0:'Production v3 silhouette and M2P, with shared E7.5 equipment proxies at the identical sockets.',
  b1:'Rebuild torso, head, shoulders, pelvis and garment; retain legacy hand shape and the M2P plane family.',
  b2:'Replace only hand masks and local thumb/crease motifs; preserve every other part and tool geometry.',
  b3:'Change paint planes inside unchanged masks; preserve palette, pose, silhouettes and tools.',
  b4:'Retint selected upper-left outline pixels; preserve material ownership, geometry and all contact/dark edges.',
};
const rows=[];
for(const recipe of cases.filter(c=>!values.development||c.role==='development'))for(const seed of recipe.seeds){
  const scope=recipe.id+'/'+seed+'/';
  const body=legacyBody(recipe,seed,json(read(recipe.legacy)));
  const invalidV4={version:4,kind:'experimental-part-character',seed,id:recipe.id,profile:art.id,
    canvas:{w:64,h:64},pivot:lock.pivot,view:lock.view,equipment:recipe.equipment,grips:recipe.grips};
  assert.equal(characterSpecSchema.safeParse(body.spec).success,true);
  assert.equal(characterSpecSchema.safeParse(invalidV4).success,false);
  assert.deepEqual(body.plan.pivot,[32,58]);
  const entries: Array<{id:string;stage:Stage;shared:boolean}> = [
    {id:'a0',stage:'a0',shared:true},
    ...(['b1','b2','b3','b4'] as const).map(stage=>({id:stage,stage,shared:false})),
    ...(['b1','b2','b3','b4'] as const).map(stage=>({id:stage+'-shared',stage,shared:true})),
  ];
  const previous=new Map<string,ReturnType<typeof renderQualityCharacter>>();
  const originalContext=new Map<string,ReturnType<typeof context>>();
  const qa=[];
  const failures:string[]=[];
  for(const {id,stage,shared} of entries){
    const folder=scope+id+'/';
    const rendered=renderQualityCharacter(recipe,seed,body,stage,character!,device,shared,e90);
    const same=renderQualityCharacter(recipe,seed,body,stage,character!,device,shared,e90);
    assert.deepEqual(rendered.final,same.final);
    assert.deepEqual(rendered.ownership,same.ownership);
    let checks:unknown=null;
    try{
      checks=checkQualityCharacter(rendered,lock.limits);
      for(let i=0;i<rendered.final.rgba.length;i+=4){
        if(rendered.final.rgba[i+3]===255)continue;
        assert.equal(rendered.final.rgba.readUInt32BE(i),0,'TRANSPARENT_RGBA');
      }
    }catch(err){failures.push(id+':'+String(err));}
    const native=pair(folder+'sprite',rendered.final);
    pair(folder+'silhouette',rendered.total);
    pair(folder+'body',rendered.bodySilhouette);
    pair(folder+'parts',rendered.ownership);
    pair(folder+'material-mask',rendered.mat);
    pair(folder+'outline-map',rendered.inkBoundary);
    for(const prop of rendered.props)pair(folder+prop.hand.split('-')[0],zoomHand(rendered.final,prop.socket));
    const scopeKey=shared?'shared':'expanded', before=previous.get(scopeKey);
    let changes=null;
    if(before){
      const delta=diff(before.final,rendered.final);
      pair(folder+'diff',delta.image);
      changes={added:delta.added,removed:delta.removed,paint:delta.paint};
      if(stage==='b2'){
        const exclude=(r:typeof rendered)=>r.layers.filter(p=>!p.id.endsWith('-hand')).map(p=>[p.id,sha256(p.mask.rgba)]);
        assert.deepEqual(exclude(before),exclude(rendered),'B2_CHANGED_NON_HAND_PARTS');
      }
      if(stage==='b3'||stage==='b4'){
        assert.deepEqual(rendered.ownership,before.ownership);
        assert.deepEqual(rendered.mat,before.mat);
      }
      if(stage==='b4')for(let i=0;i<before.final.rgba.length;i+=4)if(before.final.rgba.readUInt32BE(i)!==rendered.final.rgba.readUInt32BE(i)){
        assert.equal(rendered.inkBoundary.rgba.readUInt32BE(i),pack('#fbc86d'),'SELOUT_ESCAPED_LIT_EDGE');
      }
    }
    previous.set(scopeKey,rendered);
    const scenes=[];
    for(const light of ['day','night'] as const){
      const ctx=context(rendered,light);
      if(id==='a0')originalContext.set(light,ctx);
      else compareScene(originalContext.get(light)!,ctx);
      pair(folder+light,ctx.image);
      scenes.push({light,edge:ctx.edges,visible:ctx.visible,anchor:ctx.anchor,camera:ctx.camera});
    }
    const review={id,stage,shared,native,changes,sourceRevision:e90,seed,checks,scenes,hypothesis:hypotheses[stage],
      techniqueStatus:checks?'VERIFIED_BY_TEST':'TECHNICAL_FAILURE',
      parts:Object.fromEntries(rendered.layers.map(p=>[p.id,{role:p.role,maskSha256:sha256(p.mask.rgba),
        owner:'#'+((rendered.labels[p.id]>>>8).toString(16).padStart(6,'0'))}]))};
    save(folder+'qa.json',contents(review));
    qa.push(review);
  }
  save(scope+'v4-spec.json',contents(invalidV4));
  save(scope+'a0-v3-spec.json',contents(body.spec));
  rows.push({ id:recipe.id, role:recipe.role, seed, hypothesis:recipe.brief, scope, variants:qa, failures });
  console.log(recipe.id,seed,qa.length,'variants',failures);
}
const blocked=rows.some(c=>c.failures.length);
const status=values.development?'DEVELOPMENT_ONLY':blocked?'E9_1_TECHNICAL_BLOCKED':'E9_1_READY_FOR_HUMAN_CHARACTER_ART_REVIEW';
save('benchmark.json',contents({version:1,status,base:e90,source:lock.e90Source,e85:lock.e85,freeze:values.development?null:sha256(read(seal)),
  a2:'A2_ARTIST_AUTHORED_REFERENCE_NOT_AVAILABLE',artist:'HUMAN_REVIEW_PENDING',profile:art.id,
  studio:'STUDIO_V4_CONTRACT_GAP',aiCalls:0,cases:rows,files}));
writeFileSync(join(root,'SHA256SUMS'),Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([name,digest])=>digest+'  '+name).join('\n')+'\n');
if(blocked)process.exitCode=1;
