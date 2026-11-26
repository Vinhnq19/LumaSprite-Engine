import assert from 'node:assert/strict';
import { riseForDepth } from '../../core/geometry/projection.ts';
import { blit,composite,makeRaster,silhouette,type Raster } from '../../core/pixels/raster.ts';
import { type Point } from '../../core/geometry/shapes.ts';
import { pack } from '../../core/palette/colors.ts';
import { renderComposition,type Composition } from '../../generators/environment/composition.ts';
import { materialLegend,materialPiece } from '../../generators/environment/kit.ts';
import { renderEnvironment } from '../../generators/environment/render.ts';
import { buildRuins,connectedPixels } from '../../generators/environment/ruins.ts';
import type { EnvironmentLight,RuinModule,StyleProfile } from '../../specs/environment.ts';
import { compareCoverage,inspectStructure } from './diagnostics.ts';

type Wall=Extract<RuinModule,{kind:'wall'}>;
type Piece=ReturnType<ReturnType<typeof materialPiece>>;
type Theme=StyleProfile['illumination']['day'];
type WallShape={painted:Piece;geometry:{support:number;origin:readonly [number,number]}};
type WallBuilder=(module:Wall,theme:Theme,seed:number)=>WallShape;

function masonryStructure(module:Wall,seed:number){
  const {width,height,depth}=module, rise=riseForDepth(depth);
  const support=height-4;
  const pitches=[.31,.53,.69,.87,1], masses=[.91,.94,.50,.63,.29];
  const rhythm=seed%3-1;
  const runs=pitches.map((end,i)=>{
    const start=pitches[i-1]??0;
    const [l,r]=module.fracture==='right'?[start,end]:[1-end,1-start];
    const left=Math.round(l*width), w=Math.round(r*width)-left;
    const h=Math.round(height*masses[i])+rhythm*(i%2===0?-1:1);
    const top=Math.min(support-1,height+rise-Math.min(height,h));
    const thickness=depth-(i===2||i===4?Math.min(4,depth-3):0);
    return {left,top,width:w,depth:thickness,bottom:support+2,taper:0};
  }).sort((a,b)=>a.left-b.left);
  return {runs,support,origin:[0,height+rise] as const};
}

function steppedWall(module:Wall,theme:Theme,seed:number) {
  const geometry=masonryStructure(module,seed);
  const painted=materialPiece(theme)(module.width+module.depth,geometry.origin[1],geometry.origin,paint=>{
    for(const [i,run] of geometry.runs.entries()){
      const {left,top,width,bottom,depth}=run, right=left+width, next=geometry.runs[i+1];
      const end=next?Math.min(bottom,next.top+1):bottom;
      const reveal=next?Math.max(3,depth-4):depth;
      const rise=riseForDepth(reveal);
      if(end>top+2)paint('stone',0,[[right-1,top],[right+reveal-1,top-rise],
        [right+reveal-1,end-rise],[right-1,end]]);
    }
    for(const {left,top,width,depth} of geometry.runs){
      const right=left+width, rise=riseForDepth(depth);
      paint('stone',2,[[left,top+1],[left+2,top],[right-2,top],[right,top+1],
        [right+depth,top-rise+1],[right+depth-2,top-rise],[left+depth+3,top-rise]]);
    }
    for(const {left,top,width,bottom} of geometry.runs){
      const right=left+width;
      const block:Point[]=[[left,top+2],[left+2,top+2],[left+2,top],[right-2,top],
        [right-2,top+1],[right,top+1],[right,bottom],[left,bottom]];
      paint('stone',1,block);
    }
  });
  return {painted,geometry};
}

function siteWall(module:Wall,old:Piece,referenceFlat:Piece,theme:Theme,seed:number,flat:boolean,build:WallBuilder){
  const {painted,geometry}=build(module,theme,seed);
  assert.deepEqual([painted.raster.w,painted.raster.h,painted.origin],[old.raster.w,old.raster.h,old.origin]);
  const {w, h, rgba}=painted.raster;
  const material=painted.material.rgba, placed=Buffer.from(rgba);
  const frontInk=pack(theme.surfaces.stone[1]);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4, flatPixel=placed.readUInt32BE(i);
    if(y>=geometry.support || (!flat&&flatPixel&&referenceFlat.raster.rgba.readUInt32BE(i)===flatPixel)){
      rgba.writeUInt32BE(old.raster.rgba.readUInt32BE(i),i);
      material.writeUInt32BE(old.material.rgba.readUInt32BE(i),i);
    }else if(!flat&&flatPixel===frontInk){
      const exposed = y===0 || !placed[(i-w*4)+3];
      if(exposed) rgba.writeUInt32BE(pack(theme.surfaces.stone[2]),i);
    }
  }
  const coverage=connectedPixels(painted.raster);
  const qa=inspectStructure(painted.raster,undefined,painted.material);
  assert.deepEqual(qa.mask,silhouette(painted.material,pack('#ffffff')));
  return {painted,geometry,coverage,diff:compareCoverage(old.raster,painted.raster),detail:{baseline:inspectStructure(old.raster,undefined,old.material).stat.detail,candidate:qa.stat.detail}};
}

const writeFrom=(target:Raster,at:number,src:Raster,from:number)=>target.rgba.writeUInt32BE(src.rgba.readUInt32BE(from),at);
export function compareRuinStructure(input:Composition,light:EnvironmentLight,flat=false,build:WallBuilder=steppedWall){
  const {spec,environment,kitSeed}=input, ruins=spec.ruins!;
  assert.ok(ruins&&spec.props.length===0,'This harness compares the ruin module stack and the locked actors.');
  const control=renderComposition(input,light,flat), scene=control.scene, {w,h}=scene.raster;
  const alias={composition:spec,kitSeed,flat};
  const withoutWalls={...spec,ruins:{...ruins,modules:ruins.modules.filter(m=>m.kind!=='wall')}};
  const underneath=renderEnvironment(environment,'B',light,{...alias,composition:withoutWalls});
  const old=buildRuins(ruins,environment.style,light,spec.seed,flat).modules;
  const flatSet=flat?old:buildRuins(ruins,environment.style,light,spec.seed,true).modules;
  const theme=environment.style.illumination[light];
  const stone=old.filter(m=>m.module.kind==='wall').map(({module,piece})=>({
    id:module.id,...siteWall(module as Wall,piece,flatSet.find(x=>x.module.id===module.id)!.piece,theme,spec.seed,flat,build),
  }));
  const changes=new Map(stone.map(s=>[s.id,s.painted]));
  const layers=scene.metadata.layerOrder.map(id=>{
    const record=old.find(m=>m.module.id===id);
    if(record){
      const {piece,module}=record, spatial=changes.get(id);
      return {id,at:module.at,old:piece,next:spatial??piece,wall:!!spatial,isActor:false};
    }
    const p=environment.spec.placements.find(item=>item.id===id)!;
    const actor=environment.assets.get(p.ref)!;
    assert.equal(actor.ref.kind,'actor');
    const piece={raster:actor.raster,material:silhouette(actor.raster,pack(materialLegend.actor)),origin:actor.ref.pivot};
    return {id,at:p.at,old:piece,next:piece,wall:false,isActor:true};
  });
  const owners=(field:'old'|'next')=>{
    const map=new Int16Array(w*h).fill(-1);
    layers.forEach((row,i)=>{
      const piece=row[field], [x,y]=row.at;
      const left=x-piece.origin[0],top=y-piece.origin[1];
      for(let v=0;v<piece.raster.h;v++)for(let u=0;u<piece.raster.w;u++)if(piece.raster.rgba[(v*piece.raster.w+u)*4+3]){
        map[(top+v)*w+left+u]=i;
      }
    });
    return map;
  };
  const start=owners('old'), end=owners('next');
  const beforeCount=Array(layers.length).fill(0) as number[];
  const afterCount=Array(layers.length).fill(0) as number[];
  const raster=composite([scene.raster]), material=composite([scene.materialMask]);
  let touched=0;
  for(let i=0;i<start.length;i++){
    const a=start[i], b=end[i];
    if(a>=0)beforeCount[a]++;
    if(b>=0)afterCount[b]++;
    const aware=layers[a], next=layers[b];
    const at=i*4;
    if(aware?.isActor || next?.isActor)assert.equal(a,b,'E7.1 wall cannot change approved actor coverage.');
    if(!aware?.wall&&!next?.wall)continue;
    if(!next?.wall){
      writeFrom(raster,at,underneath.raster,at);
      writeFrom(material,at,underneath.materialMask,at);
    }else{
      const u=i%w-next.at[0]+next.next.origin[0],v=Math.floor(i/w)-next.at[1]+next.next.origin[1];
      const p=(v*next.next.raster.w+u)*4;
      writeFrom(raster,at,next.next.raster,p);
      writeFrom(material,at,next.next.material,p);
    }
    if(raster.rgba.readUInt32BE(at)!==scene.raster.rgba.readUInt32BE(at))touched++;
  }
  assert.deepEqual(beforeCount,scene.metadata.occlusion.map(row=>row.visible),'Pilot ownership disagrees with production z-order.');
  assert.ok(touched>0);
  const arch=makeRaster(w,h);
  for(const {module,piece} of old){
    const next=changes.get(module.id)??piece, x=module.at[0]-next.origin[0], y=module.at[1]-next.origin[1];
    const fill=silhouette(next.raster,pack('#ffffff'));
    blit(arch,fill,x,y);

  }
  const legal=new Set(scene.metadata.palette.allowed.map(pack));
  const q=inspectStructure(raster,legal,material), v=inspectStructure(arch), orig=inspectStructure(scene.architectureSilhouette!);
  const collision=composite([raster]);
  for(let i=0;i<collision.rgba.length;i+=4)if(scene.collisionOverlay.rgba.readUInt32BE(i)!==scene.raster.rgba.readUInt32BE(i)){
    writeFrom(collision,i,scene.collisionOverlay,i);
  }
  return {control,edited:{raster,material,arch,edge:v.edge,collision},qa:{light,flat,touched,
    baseline:orig.stat,candidate:v.stat,coverage:compareCoverage(scene.architectureSilhouette!,arch),surface:q.stat,
    walls:stone.map(({id,geometry,coverage,diff,detail})=>({id,geometry,coverage,diff,detail})),
    actors:layers.flatMap((row,i)=>row.isActor?[{id:row.id,before:beforeCount[i],after:afterCount[i]}]:[]),
    routes:control.routes,collision:'SAME_APPROVED_FOOTPRINTS',occlusion:'SAME_SORT_WITH_RENDERER_CHECKED_OWNERSHIP'}};
}
