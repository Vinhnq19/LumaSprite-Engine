import assert from 'node:assert/strict';
import { rect } from '../core/geometry/faces.ts';
import { fillPolygon, type Point } from '../core/geometry/shapes.ts';
import { paintSurface } from '../core/materials/surface.ts';
import { inkLuma, pack } from '../core/palette/colors.ts';
import { composite, makeRaster, silhouette, type Raster } from '../core/pixels/raster.ts';
import { renderOutlinedLayers } from '../core/renderer/layers.ts';
import { characterRamps, materialPlanes } from '../generators/character/material-planes.ts';
import { materialMaskLegend } from '../generators/character/materials.ts';
import { legacyBody, renderQualityCharacter } from './character-v4.ts';
import { costumePanel, inspectCostumeStance, maskPixels, type Leg } from './costume-stance.ts';

type Render = ReturnType<typeof renderQualityCharacter>;
type Part = Render['layers'][number];
type Rig = ReturnType<typeof legacyBody>['plan'];
type Direction = Parameters<typeof renderQualityCharacter>[4];
type Ramp = (typeof characterRamps)[keyof typeof characterRamps] | NonNullable<Direction['ramps']['coat']>;
export type Wardrobe = 'apron' | 'a-line' | 'cloak';
const blank = () => makeRaster(64,64);
const mask = (points: readonly Point[]) => {
  const raster=blank();
  fillPolygon(raster,points,pack('#ffffff'));
  return raster;
};
const alpha = (r:Raster,i:number) => r.rgba[i*4+3]===255;
const ink = (r:Raster,i:number) => r.rgba.readUInt32BE(i*4);
const set = (r:Raster,i:number,value:number) => r.rgba.writeUInt32BE(value,i*4);

function semanticPart(id: string, role: Part['role'], mask: Raster, tone?: Part['tone']): Part {
  return {id,role,mask,tone};
}

export function wardrobeLayers(rendered: Render, rig: Rig, wardrobe: Wardrobe) {
  const byId = new Map(rendered.layers.map(p=>[p.id,p]));
  const leg = (side:'near'|'far'): Leg => ({
    thigh:byId.get(side+'-thigh')!.mask, shin:byId.get(side+'-shin')!.mask, boot:byId.get(side+'-boot')!.mask,
    knee:rig.landmarks[side+'-knee'].point, ankle:rig.landmarks[side+'-ankle'].point, ground:rig.projectedGround![side],
  });
  const legs = [leg('near'),leg('far')] as const;
  const isOutfit = (part:Part) => ['a-line-tunic','shawl','sash','apron','apron-strap','belt','cloak-back','cloak-front','cloak-fastener'].includes(part.id);
  const withNoOutfit = rendered.layers.filter(p=>!isOutfit(p)&&!p.id.includes('-tool')&&!['hood','oilskin','bun','hair','strap','satchel'].includes(p.id));
  const body = composite(withNoOutfit.filter(p=>!/-(thigh|shin|boot)$/.test(p.id)).map(p=>p.mask));
  const base = composite(withNoOutfit.map(p=>p.mask));
  const garment=composite(rendered.layers.filter(isOutfit).map(p=>p.mask));
  const worn = composite([base,garment]);
  if(wardrobe==='a-line')assert.ok(byId.has('a-line-tunic'));
  return {body,base,garment,worn,legs,
    stance: inspectCostumeStance(legs,garment,rendered.total,rendered.pivot)};
}

function cloak(rig:Rig) {
  const [nx,ny]=rig.landmarks.neck.point, [sx,sy]=rig.landmarks.chest.point, [cx,hy]=rig.landmarks.pelvis.point;
  const [lx]=rig.landmarks['near-shoulder'].point, [rx]=rig.landmarks['far-shoulder'].point;
  const back = mask([[nx-5,ny],[nx+4,ny+1],[lx+1,sy+2],[lx-4,hy-1],[lx-5,hy+5],
    [cx-6,hy+4],[cx-2,hy+1],[sx-3,sy+4]]);
  const front = mask([[nx-5,ny],[nx+3,ny-1],[rx+3,sy+2],[rx+2,sy+6],[sx+2,hy-4],
    [sx-2,sy+5],[lx-2,sy+6],[lx-1,sy+2]]);
  return [semanticPart('cloak-back','far-coat',back), semanticPart('cloak-front','cap',front),
    semanticPart('cloak-fastener','metal',mask(rect(nx+2,ny+4,nx+5,ny+6)),'light')];
}

function equipment(side:string, [x,y]:Point) {
  const part = (id:string,role:Part['role'],points:readonly Point[],tone?:Part['tone']) =>
    semanticPart(side+'-tool-'+id,role,mask(points),tone);
  if(side==='far')return [
    part('strap','leather',[[x-2,y-6],[x+2,y-6],[x+3,y+7],[x+1,y+12],[x-1,y+13],[x-2,y+9]]),
    part('clasp','metal',rect(x-1,y+7,x+3,y+10),'accent'),
  ];
  return [
    part('bail','metal',[[x-3,y+7],[x-3,y-1],[x-1,y-3],[x+2,y-3],[x+4,y-1],[x+4,y+7],
      [x+2,y+7],[x+2,y+1],[x+1,y],[x-1,y],[x-1,y+7]],'base'),
    part('case','metal',[[x-4,y+6],[x-3,y+4],[x+3,y+4],[x+5,y+7],[x+4,y+14],[x+2,y+15],
      [x-3,y+15],[x-5,y+13],[x-5,y+8]]),
    part('pane','glass',[[x-3,y+7],[x+2,y+7],[x+3,y+8],[x+2,y+13],[x-3,y+13],[x-4,y+11]]),
    part('rail','metal',rect(x+1,y+7,x+2,y+14),'shadow'),
    part('grip','leather',rect(x-2,y-1,x+3,y+1),'base'),
  ];
}

// Only altered geometry and newly exposed surfaces require repainting.
function paintPart(part:Part, ramp:Ramp, formAware:boolean) {
  const raster=blank(), indices=maskPixels(part.mask);
  assert.ok(indices.length,part.id);
  const xs=indices.map(i=>i%64),ys=indices.map(i=>Math.floor(i/64));
  const left=Math.min(...xs),right=Math.max(...xs),top=ys[0],bottom=ys.at(-1)!;
  const inks={base:pack(ramp.base),light:pack(ramp.light),shadow:pack(ramp.shadow),accent:pack(ramp.accent)};
  if(!formAware && !part.tone){
    paintSurface(raster,indices,{left,right,top,bottom},inks.base,inks,materialPlanes(part.id,part.role,true,true));
    return raster;
  }
  for(const i of indices){
    const x=i%64,y=Math.floor(i/64), u=(x-left+.5)/(right-left+1),v=(y-top+.5)/(bottom-top+1);
    let tone=part.tone??(u>.72||v>.91?'shadow':u<.58&&v<.48&&u+v<.83?'light':'base');
    if(!part.tone&&part.form){
      const [a,b]=part.form, dx=b[0]-a[0],dy=b[1]-a[1];
      const lit=(dy>=0?1:-1)*(dx*(y-a[1])-dy*(x-a[0]))/Math.hypot(dx,dy);
      tone=lit>1&&v<.85?'light':lit < -1.1?'shadow':v>.77?'accent':'base';
    }
    set(raster,i,inks[tone]);
  }
  return raster;
}

export function recoverCostume(original: Render, rig: Rig, wardrobe: Wardrobe, direction: Direction, expanded: boolean) {
  if(wardrobe==='apron' || original.stage==='a0')return original;
  const landmarks=(name:string)=>rig.landmarks[name].point;
  const {legs}=wardrobeLayers(original,rig,'a-line');
  const edited=wardrobe==='a-line'?[semanticPart('a-line-tunic','coat',
    costumePanel(wardrobe,landmarks('pelvis'),legs.map(p=>p.knee),legs.map(p=>p.ankle),5).raster)]:cloak(rig);
  const bySide=new Map(original.props.map(prop=>[prop.hand.split('-')[0],prop]));
  const fieldTools=wardrobe==='cloak'&&expanded?new Map([...bySide].map(([side,prop])=>[side,equipment(side,prop.socket)])):new Map<string,Part[]>();
  const replaced=new Set(wardrobe==='a-line'?['a-line-tunic']:['a-line-tunic','shawl','sash']);
  const layers: Part[]=[...original.layers.flatMap(part=>{
    if(part.id==='a-line-tunic')return edited.slice(wardrobe==='cloak'?1:0);
    if(replaced.has(part.id))return [];
    const side=part.id.split('-')[0];
    if(fieldTools.has(side)){
      if(part.id.includes('-tool'))return [];
      if(part.id.endsWith('-hand'))return [...fieldTools.get(side)!,part];
    }
    return [part];
  })];
  if(wardrobe==='cloak')layers.unshift(edited[0]);
  const changed = new Set([...edited,...[...fieldTools.values()].flat()]);
  const labels = Object.fromEntries(layers.map((part,j)=>[part.id,((0x456678+j*104729)&0xffffff)*256+255]));
  const owner = composite(layers.map(part=>silhouette(part.mask,labels[part.id])));
  const parts = new Map(layers.map(part=>[labels[part.id],part]));
  const ramps={...characterRamps,...direction.ramps};
  const painted = blank(), material=blank(), outlineMap=blank();
  const fallback=new Map<string,Raster>();
  for(let i=0;i<4096;i++){
    const part=parts.get(ink(owner,i));
    if(!part)continue;
    if(!changed.has(part)&&ink(original.ownership,i)===original.labels[part.id]){
      set(painted,i,ink(original.final,i));
      set(material,i,ink(original.mat,i));
      continue;
    }
    if(!fallback.has(part.id))fallback.set(part.id,paintPart(part,ramps[part.role],original.stage==='b3'||original.stage==='b4'));
    set(painted,i,ink(fallback.get(part.id)!,i));
    set(material,i,pack(materialMaskLegend[part.role]));
  }
  const contour=pack(direction.outline);
  const {final,silhouette:total}=renderOutlinedLayers([painted],[owner],contour);
  const outlineStats={lit:0,shadow:0,contact:0,internal:0};
  for(let i=65;i<4031;i++){
    if(!alpha(total,i))continue;
    if(alpha(painted,i)){
      if(i%64!==63 && alpha(painted,i+1)&&ink(material,i)!==ink(material,i+1)){
        set(outlineMap,i,pack('#ee947c'));
        outlineStats.internal++;
      }
      continue;
    }
    set(owner,i,contour);
    set(material,i,pack(materialMaskLegend.contour));
    const y=Math.floor(i/64), light=alpha(painted,i+1)||alpha(painted,i+64);
    const dark=alpha(painted,i-1)||alpha(painted,i-64);
    const edge=y>=rig.pivot[1]-3?'contact':light&&!dark?'lit':'shadow';
    const edgeColor={lit:'#fbc86d',shadow:'#6972a1',contact:'#9be6b7'};
    set(outlineMap,i,pack(edgeColor[edge]));
    outlineStats[edge]++;
    if(original.stage==='b4' && edge==='lit'){
      const hit=alpha(painted,i+64)?i+64:i+1;
      const part=parts.get(ink(owner,hit))!;
      const change=pack(ramps[part.role].shadow), tone=inkLuma(ink(painted,hit));
      if(!part.id.includes('-tool')&&tone>86&&inkLuma(change)>=55&&inkLuma(change)<=tone-12)set(final,i,change);
    }
  }
  const props=original.props.map(prop=>{
    const side=prop.hand.split('-')[0];
    return fieldTools.has(side)?{...prop,id:side==='near'?'lantern':'strap',masks:fieldTools.get(side)!.map(part=>part.mask)}:prop;
  });
  const body = composite(layers.filter(p=>!p.id.includes('-tool')&&!['hood','oilskin','bun','hair'].includes(p.id)).map(p=>p.mask));
  return {...original,final,total,ownership:owner,mat:material,inkBoundary:outlineMap,
    bodySilhouette:silhouette(body,contour),labels,layers,props,outline:outlineStats};
}
