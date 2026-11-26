import assert from 'node:assert/strict';
import { pack } from '../core/palette/colors.ts';
import { composite,makeRaster,type Raster } from '../core/pixels/raster.ts';
import type { Point } from '../core/geometry/shapes.ts';
import { materialLegend,materialPiece,mossInk } from '../generators/environment/kit.ts';
import { renderComposition,type Composition } from '../generators/environment/composition.ts';
import type { EnvironmentLight,RuinModule,StyleProfile } from '../specs/environment.ts';
import { sha256 } from '../quality/raster.ts';
import { compareCoverage,inspectStructure } from './structure-quality/diagnostics.ts';

type Scene=ReturnType<typeof renderComposition>['scene'];
type Wall=Extract<RuinModule,{kind:'wall'}>;
type Theme=StyleProfile['illumination']['day'];
type Cell=Scene['metadata']['atlas']['cells'][number];
const stoneRole=pack(materialLegend.stone),mossRole=pack(mossInk),contourRole=pack(materialLegend.contour);
const planeLegend={side:'#647294',front:'#9e9d89',top:'#d8c5a4'};
const planeInks=[planeLegend.side,planeLegend.front,planeLegend.top].map(pack);

function atlasPixels(atlas:Raster,cell:Cell){
  const [x,y]=cell.at,[w,h]=cell.size, result=makeRaster(w,h);
  for(let row=0;row<h;row++){
    const begin=((y+row)*atlas.w+x)*4;
    atlas.rgba.copy(result.rgba,row*w*4,begin,begin+w*4);
  }
  return result;
}
function materialClusters(raster:Raster,roles:Raster){
  const masks=new Map<number,Map<number,Raster>>();
  for(let i=0;i<raster.rgba.length;i+=4){
    if(!raster.rgba[i+3])continue;
    const role=roles.rgba.readUInt32BE(i), color=raster.rgba.readUInt32BE(i);
    const shades=masks.get(role)??new Map<number,Raster>();
    masks.set(role,shades);
    const mask=shades.get(color)??makeRaster(raster.w,raster.h);
    shades.set(color,mask);
    mask.rgba.writeUInt32BE(color,i);
  }
  return Object.fromEntries([...masks].map(([role,shades])=>{
    const clusters=[...shades.values()].flatMap(mask=>inspectStructure(mask).stat.components).sort((a,b)=>b-a);
    return [role===mossRole?'moss':role===contourRole?'contour':'stone',
      {pixels:clusters.reduce((a,b)=>a+b,0),largest:clusters[0],isolated:clusters.filter(n=>n===1).length,clusters}];
  }));
}

function weatherWall(module:Wall,old:Raster,oldMask:Raster,flat:Raster,theme:Theme,flatInks:readonly number[]){
  const {w,h}=old,width=module.width;
  const palette=theme.surfaces.stone.map(pack);
  const front=Array(width).fill(h) as number[],sideTop=Array(w).fill(h) as number[];
  const planes=new Int8Array(w*h).fill(-1);
  const sourceRole=new Set([stoneRole,mossRole,contourRole]);
  for(let i=0;i<planes.length;i++){
    const offset=i*4;
    if(!old.rgba[offset+3])continue;
    assert.ok(sourceRole.has(oldMask.rgba.readUInt32BE(offset)));
    if(!flat.rgba[offset+3])continue;
    const tone=flatInks.indexOf(flat.rgba.readUInt32BE(offset));
    assert.ok(tone>=0&&tone<=2,'Unknown production wall plane');
    planes[i]=tone;
    const x=i%w,y=Math.floor(i/w);
    if(tone===1&&x<width)front[x]=Math.min(front[x],y);
    if(tone===0)sideTop[x]=Math.min(sideTop[x],y);
  }
  const course=Math.max(7,Math.min(12,Math.ceil(module.height/4)));
  const direction=module.fracture==='right'?1:-1;
  const fracture=front.slice(1).map((y,i)=>({x:y>front[i]?i+1:i,gap:Math.abs(y-front[i])}))
    .filter(p=>p.gap>=3&&p.x>4&&p.x<width-4&&front[p.x]<h)
    .sort((a,b)=>b.gap-a.gap||Math.abs(a.x-width/2)-Math.abs(b.x-width/2))[0];
  const crackX=fracture?.x??Math.floor(width/2),crackY=front[crackX];
  const bed=h-5;
  const moisture=Math.round(width*(direction===1?.61:.29));
  const paintDetails=materialPiece(theme)(w,h,[0,h],paint=>{
    const x=(position:number)=>Math.round(width*(direction===1?position:1-position));
    const [start,end]=[x(.11),x(.34)].sort((a,b)=>a-b);
    const rim=front[Math.floor((start+end)/2)]+3;
    paint('stone',2,[[start,rim+2],[start+3,rim],[end-3,rim],[end,rim+1],[end-2,rim+3],
      [start+5,rim+4],[start,rim+3]]);
    // Staggered beds meet short joints and leave the rest of each face as a solid mass.
    for(let level=1;level<=3;level++){
      const y=bed-course*level+level%2;
      const [left,right]=[[.21,.68],[.48,.9],[.10,.42]][level-1].map(x).sort((a,b)=>a-b);
      const joint=left+Math.floor((right-left)*.38);
      const end=right-(level===2?4:0);
      paint('stone',0,[[left,y],[joint,y],[joint,y+1],[end,y+1],[end,y+2],[joint-3,y+2],[joint-3,y+1],[left,y+1]]);
      const jointEnd=y+Math.min(5,course-2);
      paint('stone',0,[[joint-1,y+1],[joint+1,y+1],[joint,jointEnd],[joint-1,jointEnd]]);
      if(level!==3)paint('stone',2,[[left-2,y+3],[joint-3,y+3],[joint-3,y+5],[left+2,y+6],[left-2,y+5]]);
    }
    // The scar begins on an existing step and runs in toward the supporting bed.
    const elbow=crackX+3*direction, toe=elbow-2*direction;
    const crack:Point[]=[[crackX,crackY],[crackX+2,crackY],[elbow+2,crackY+4],
      [toe+1,crackY+course],[toe,crackY+course],[elbow,crackY+4]];
    paint('stone',0,crack);
    if(module.moss){
      paint('moss',0,[[moisture-8,bed+1],[moisture-4,bed-2],[moisture+2,bed-2],[moisture+5,bed-4],
        [moisture+8,bed-3],[moisture+6,bed+1],[moisture,bed+2],[moisture-5,bed+3],[moisture-10,bed+3]]);
      paint('moss',1,[[moisture-5,bed],[moisture+1,bed-1],[moisture+5,bed-3],[moisture+6,bed-2],
        [moisture+3,bed+1],[moisture-4,bed+2]]);
      if(module.moss>1){
        const lower=crackY+course-2;
        paint('moss',0,[[toe-2,lower+1],[toe,lower-1],[toe+2,lower],[toe+4,lower+3],[toe+1,lower+4],[toe-3,lower+3]]);
      }
    }
  });
  const raster=makeRaster(w,h),material=makeRaster(w,h),planeMask=makeRaster(w,h);
  const atPlane=(x:number,y:number)=>x>=0&&x<w&&y>=0&&y<h?planes[y*w+x]:-1;
  const legalStone=new Set([...palette,...theme.grass.map(pack),pack(theme.contour)]);
  for(let i=0;i<planes.length;i++){
    const plane=planes[i], offset=i*4, x=i%w,y=Math.floor(i/w);
    if(plane<0){
      // Keep existing edge ink outside the flat plane map byte-for-byte.
      old.rgba.copy(raster.rgba,offset,offset,offset+4);
      oldMask.rgba.copy(material.rgba,offset,offset,offset+4);
      continue;
    }
    let ink=palette[plane],role=stoneRole;
    if(plane===1){
      if(y>=h-2)ink=palette[0];
      else if(paintDetails.raster.rgba[offset+3]){
        ink=paintDetails.raster.rgba.readUInt32BE(offset);role=paintDetails.material.rgba.readUInt32BE(offset);
      }
    }else if(plane===2&&x<width*.86&&[x-1,x,x+1].every(col=>atPlane(col,y)===2&&atPlane(col,y+1)===1)){
      ink=palette[3];
    }else if(plane===0&&x>=width&&x<width+Math.floor(module.depth*.6)&&y>sideTop[x]&&y<=sideTop[x]+3){
      ink=palette[1];
    }
    assert.ok(legalStone.has(ink)&&sourceRole.has(role));
    raster.rgba.writeUInt32BE(ink,offset);
    material.rgba.writeUInt32BE(role,offset);
    planeMask.rgba.writeUInt32BE(planeInks[plane],offset);
  }
  const geometry=compareCoverage(old,raster);
  assert.equal(geometry.added+geometry.removed,0);
  assert.deepEqual(compareCoverage(material,raster),geometry);
  return {raster,material,planeMask,qa:{
    id:module.id,course,fracture:[crackX,crackY],moisture:[moisture,bed],geometry,
    baseline:inspectStructure(old,undefined,oldMask).stat,
    candidate:inspectStructure(raster,legalStone,material).stat,
    clusters:{before:materialClusters(old,oldMask),after:materialClusters(raster,material)}
  }};
}

export function compareStone(input:Composition,light:EnvironmentLight){
  const {spec,environment}=input;
  assert.ok(spec.ruins&&spec.props.length===0,'Stone pilot expects a ruin stack and its actor layers.');
  const baseline=renderComposition(input,light),scene=baseline.scene;
  const flat=renderComposition(input,'day',true).scene;
  const flatInks=environment.style.illumination.day.surfaces.stone.map(pack);
  const theme=environment.style.illumination[light];
  const owner=new Int16Array(scene.raster.w*scene.raster.h).fill(-1);
  const cells=new Map(scene.metadata.atlas.cells.map(cell=>[cell.id,cell]));
  const layers=scene.metadata.occlusion.map(layer=>{
    const cell=cells.get(layer.id);
    const actor=environment.assets.get(layer.id);
    assert.ok(cell||actor?.ref.kind==='actor',layer.id);
    const old=cell?atlasPixels(scene.atlas,cell):actor!.raster;
    assert.deepEqual([old.w,old.h],[layer.w,layer.h]);
    return {...layer,old,cell};
  });
  const visible=Array(layers.length).fill(0) as number[];
  for(const [i,layer] of layers.entries()){
    const {left,top,w,h,old}=layer;
    assert.ok(left>=0&&top>=0&&left+w<=scene.raster.w&&top+h<=scene.raster.h,layer.id);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(old.rgba[(y*w+x)*4+3])owner[(top+y)*scene.raster.w+left+x]=i;
  }
  for(const index of owner)if(index>=0)visible[index]++;
  assert.deepEqual(visible,layers.map(layer=>layer.visible));

  const walls=new Map(spec.ruins.modules.filter((module):module is Wall=>module.kind==='wall').map(module=>[module.id,module]));
  const raster=composite([scene.raster]),material=composite([scene.materialMask]), planeMask=makeRaster(raster.w,raster.h);
  const diff=makeRaster(raster.w,raster.h), changedByWall:Record<string,number>={};
  const flatCells=new Map(flat.metadata.atlas.cells.map(cell=>[cell.id,cell]));
  const edits=layers.map(layer=>{
    const module=walls.get(layer.id);
    if(!module)return;
    const local=atlasPixels(flat.atlas,flatCells.get(layer.id)!);
    const mask=atlasPixels(scene.atlasMaterials,layer.cell!);
    return {mask,...weatherWall(module,layer.old,mask,local,theme,flatInks)};
  });
  for(let i=0;i<owner.length;i++){
    const index=owner[i],edit=edits[index];
    if(!edit)continue;
    const layer=layers[index],offset=i*4;
    const local=((Math.floor(i/raster.w)-layer.top)*layer.w+i%raster.w-layer.left)*4;
    const before=layer.old.rgba.readUInt32BE(local),after=edit.raster.rgba.readUInt32BE(local);
    assert.equal(before,scene.raster.rgba.readUInt32BE(offset),'Stone source is not the visible production layer.');
    assert.equal(edit.mask.rgba.readUInt32BE(local),scene.materialMask.rgba.readUInt32BE(offset));
    assert.equal(before&255,after&255);
    raster.rgba.writeUInt32BE(after,offset);
    material.rgba.writeUInt32BE(edit.material.rgba.readUInt32BE(local),offset);
    planeMask.rgba.writeUInt32BE(edit.planeMask.rgba.readUInt32BE(local),offset);
    diff.rgba.writeUInt32BE(pack(before!==after?'#94e4bd':'#303443'),offset);
    if(before!==after)changedByWall[layer.id]=(changedByWall[layer.id]??0)+1;
  }
  assert.equal(Object.keys(changedByWall).length,walls.size);
  const legal=new Set(scene.metadata.palette.allowed.map(pack));
  const before=inspectStructure(scene.raster,legal,scene.materialMask).stat;
  const after=inspectStructure(raster,legal,material).stat;
  assert.equal(before.alphaSha256,after.alphaSha256);
  assert.deepEqual(compareCoverage(scene.materialMask,material),compareCoverage(scene.raster,raster));
  return {baseline,edited:{raster,material,planeMask,diff},flat,qa:{
    before,after,changedByWall,walls:edits.flatMap(edit=>edit?[edit.qa]:[]),
    structure:{silhouetteSha256:sha256(scene.architectureSilhouette!.rgba),collisionSha256:sha256(scene.collisionPlane.rgba),
      layerOrder:scene.metadata.layerOrder,anchors:layers.map(({id,at,alphaSha256})=>({id,at,alphaSha256})),
      occlusion:scene.metadata.occlusion.map(({id,visible,hiddenBy})=>({id,visible,hiddenBy})),routes:baseline.routes},
    camera:scene.metadata.camera,palette:{stone:theme.surfaces.stone,moss:theme.grass,contour:[theme.contour]},
    planeLegend
  }};
}
