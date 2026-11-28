import assert from 'node:assert/strict';
import { rect } from '../core/geometry/faces.ts';
import { fillPolygon, type Point } from '../core/geometry/shapes.ts';
import { pack } from '../core/palette/colors.ts';
import { composite, makeRaster, silhouette, type Raster } from '../core/pixels/raster.ts';
import { renderOutlinedLayers } from '../core/renderer/layers.ts';
import { characterRamps } from '../generators/character/material-planes.ts';
import { materialMaskLegend } from '../generators/character/materials.ts';
import type { legacyBody, renderQualityCharacter } from './character-v4.ts';
import { maskPixels } from './costume-stance.ts';

type Render = ReturnType<typeof renderQualityCharacter>;
type Part = Render['layers'][number];
type Rig = ReturnType<typeof legacyBody>['plan'];
type Direction = Parameters<typeof renderQualityCharacter>[4];
type Tone = keyof typeof characterRamps.skin;
export type Archetype = 'braced' | 'tapered' | 'mantled' | 'tailored';
type Outfit = 'apron' | 'shawl' | 'cape' | 'collar';
export type ToolSet = 'wheel-and-pin' | 'vial-rack' | 'tether' | 'survey-kit';
export type Identity = { archetype: Archetype; outfit: Outfit; tools: ToolSet };
type Profile = { shoulder: number; waist: number; lean: number; skull: number; jaw: number; rise: number };
const morphology: Record<Archetype,Profile> = {
  braced:  {shoulder:12,waist:8,lean:-1,skull:8,jaw:6,rise:0},
  tapered: {shoulder:7, waist:4,lean:1, skull:5,jaw:3,rise:-1},
  mantled: {shoulder:8, waist:6,lean:1, skull:6,jaw:4,rise:0},
  tailored:{shoulder:6, waist:4,lean:0, skull:5,jaw:4,rise:-2},
};
const hats = new Set(['hood','oilskin','bun','hair','cap']);
const blank = () => makeRaster(64,64);
const get = (r:Raster,i:number) => r.rgba.readUInt32BE(i*4);
const set = (r:Raster,i:number,ink:number) => r.rgba.writeUInt32BE(ink,i*4);
const alpha = (r:Raster,i:number) => r.rgba[i*4+3]===255;
const polygon = (points:readonly Point[]) => {
  const r=blank();
  fillPolygon(r,points,pack('#ffffff'));
  return r;
};
const part = (id:string,role:Part['role'],points:readonly Point[],tone?:Tone):Part => ({id,role,mask:polygon(points),tone});
const marked = (p: Part, tone: Tone, points: readonly Point[]) => ({ ...p, accent:polygon(points), tone });
function strip(a:Point,b:Point,width:number):Point[] {
  const dx=b[0]-a[0],dy=b[1]-a[1],t=width/2/Math.hypot(dx,dy);
  const off:Point=[-dy*t,dx*t];
  return [[a[0]+off[0],a[1]+off[1]],[b[0]+off[0],b[1]+off[1]],
    [b[0]-off[0],b[1]-off[1]],[a[0]-off[0],a[1]-off[1]]];
}
const locate = (rig:Rig,name:string) => rig.landmarks[name].point;
function headOrigin(rig:Rig,p:Profile):Point {
  const [x,y]=locate(rig,'crown');
  return [x+p.lean,y+p.rise];
}

function costumeLayers(base:Render, rig:Rig, identity:Identity) {
  const profile=morphology[identity.archetype], {shoulder:w,waist:d,skull:b,jaw:j}=profile;
  const [hx,hy]=locate(rig,'pelvis'), [cx,cy]=locate(rig,'chest'), sy=cy-3;
  const [nx,ny]=locate(rig,'neck'), [x,y]=headOrigin(rig,profile);
  const sx=cx+profile.lean;
  const byId=new Map(base.layers.map(p=>[p.id,p]));
  const changed=new Map<string,Part>();
  const put = (name:string,item:Part) => { changed.set(name,item); return item; };
  put('torso',part('torso','coat',[
    [sx-w+2,sy+1],[sx-w+5,sy-2],[sx+w-4,sy-3],[sx+w-1,sy],[sx+w,sy+5],
    [hx+d,hy-3],[hx+d-2,hy+2],[hx-d,hy+1],[hx-d-1,hy-3],[sx-w,sy+6],
  ]));
  put('head',part('head','skin',[
    [x-b+1,y-4],[x-3,y-8],[x+3,y-8],[x+b-2,y-5],[x+b-1,y-1],
    [x+b+2,y+2],[x+b,y+4],[x+j,y+4],[x+j-1,y+7],[x+1,y+9],[x-j+1,y+8],[x-b,y+2],
  ]));
  put('neck',part('neck','skin',[[x-3,y+5],[x+j-1,y+6],[nx+3,ny+3],[nx-3,ny+4]],'shadow'));
  if(identity.outfit==='apron'){
    const bib=part('apron','leather',[[sx-5,sy+4],[sx+3,sy+4],[sx+5,sy+11],[hx+7,hy+1],
      [hx+6,hy+7],[hx+1,hy+9],[hx-8,hy+8],[hx-8,hy+3],[sx-6,sy+11]]);
    put('apron',marked(bib,'base',[[sx-4,sy+5],[sx-1,sy+5],[sx-1,sy+12],[hx-4,hy+5],[hx-7,hy+6],[sx-5,sy+10]]));
  }else if(identity.outfit==='shawl'){
    put('shawl',marked(part('shawl','cap',[[nx-5,ny+1],[nx+4,ny],[sx+w+1,sy+2],[sx+w,sy+6],
      [sx+1,sy+8],[sx-1,sy+13],[sx-4,sy+13],[sx-5,sy+8],[sx-w+1,sy+5]]),'base',
      [[nx-4,ny+2],[nx+3,ny+2],[sx+w-1,sy+3],[sx+1,sy+7],[sx-2,sy+9],[sx-4,sy+7]]));
  }else if(identity.outfit==='cape'){
    const rear=part('cloak-back','far-coat',[[nx+3,ny],[nx-5,ny],[sx-9,sy+4],[sx-11,hy-3],
      [sx-13,hy+7],[hx-5,hy+5],[hx+1,hy+2],[sx-2,sy+5]]);
    put('cloak-back',marked(rear,'base',[[nx-4,ny+2],[sx-7,sy+4],[sx-8,hy-1],
      [sx-11,hy+5],[sx-10,sy+7],[sx-8,sy+2]]));
    put('cloak-front',marked(part('cloak-front','cap',[[nx-4,ny+1],[nx+4,ny],[sx+w+2,sy+1],
      [sx+w+2,sy+5],[sx+4,sy+9],[sx+1,sy+7],[sx-5,sy+8],[sx-9,sy+5],[sx-7,sy+2]]),'base',
      [[nx-3,ny+2],[nx+3,ny+2],[sx+w,sy+2],[sx+3,sy+6],[sx-5,sy+6],[sx-6,sy+4]]));
  }else{
    const collar=part('shawl','cap',[[nx-4,ny-1],[nx-1,ny],[nx+4,ny+1],[sx+w+1,sy+1],
      [sx+4,sy+5],[sx+1,sy+10],[sx-2,sy+7],[sx-w,sy+4]]);
    put('shawl',marked(collar,'base',[[nx-3,ny+1],[nx-1,ny+1],[sx+1,sy+6],[sx-1,sy+7],[sx-3,sy+4]]));
    put('a-line-tunic',part('a-line-tunic','coat',[[hx-d,hy-3],[hx+d,hy-3],[hx+d+1,hy+3],
      [hx+3,hy+6],[hx-1,hy+3],[hx-5,hy+5],[hx-d-2,hy+1]]));
  }
  // Existing hair and headwear follow the neck pitch, and never create separate pixels.
  for(const id of hats){
    const p=byId.get(id);
    if(!p)continue;
    const raster=blank();
    for(const i of maskPixels(p.mask)){
      const u=i%64+profile.lean,v=Math.floor(i/64)+profile.rise;
      assert.ok(u>=1&&u<63&&v>=1&&v<63,id);
      set(raster,v*64+u,get(p.mask,i));
    }
    changed.set(id,{...p,mask:raster});
  }
  const layers=base.layers.map(p=>changed.get(p.id)??p);
  return {layers,changed:new Set(changed.keys())};
}

function gripEquipment(identity:Identity, rig:Rig, base:Render) {
  const sockets=Object.fromEntries(base.props.map(p=>[p.hand.split('-')[0],p.socket])) as Record<'near'|'far',Point>;
  const [x,y]=sockets.near,[u,v]=sockets.far;
  const near=(id:string,role:Part['role'],shape:readonly Point[],tone?:Tone)=>part('near-tool-'+id,role,shape,tone);
  const far=(id:string,role:Part['role'],shape:readonly Point[],tone?:Tone)=>part('far-tool-'+id,role,shape,tone);
  const additions = new Map<'near'|'far',Part[]>();
  let tether: Part|undefined;
  const names:Partial<Record<'near'|'far',string>>={};
  if(identity.tools==='wheel-and-pin'){
    const a=Math.max(7,x-10),b=y-10;
    additions.set('near',[
      near('stem','leather',strip([a,b],[x+4,y+5],3),'base'),
      near('rim','glass',[[a-5,b-2],[a-3,b-5],[a+2,b-5],[a+5,b-2],[a+5,b+1],[a+2,b+3],[a-2,b+3],[a-5,b+1]]),
      near('inset','metal',[[a-3,b-1],[a-2,b-3],[a+1,b-3],[a+3,b-1],[a+2,b+1],[a-2,b+1]],'shadow'),
      near('crossbar','glass',strip([a-3,b],[a+3,b-2],1.8),'light'),
      near('hub','metal',rect(a-1,b-1,a+2,b+2),'base'),
    ]);
    additions.set('far',[
      far('pin-grip','leather',strip([u-3,v+1],[u+4,v-1],2.5),'base'),
      far('pin','metal',[[u+1,v-2],[u+4,v-2],[u+5,v+2],[u+5,v+6],[u+8,v+6],
        [u+8,v+8],[u+3,v+8],[u+2,v+5],[u+2,v+2],[u-1,v+1]],'light'),
    ]);
    names.near='valve-wheel'; names.far='lock-pin';
  }else if(identity.tools==='vial-rack'){
    additions.set('far',[
      far('under-rail','leather',rect(u-6,v-1,u+6,v+2),'shadow'),
      far('rack','leather',[[u-6,v-5],[u+7,v-5],[u+7,v-1],[u+5,v+1],[u-6,v+1]]),
      far('tall-vial','cap',[[u-4,v-5],[u-4,v-10],[u-3,v-11],[u-3,v-14],[u,v-14],
        [u,v-11],[u+1,v-10],[u+1,v-5]]),
      far('cork','leather',rect(u-3,v-15,u,v-13),'light'),
      far('vial-reflection','cap',rect(u-4,v-9,u-3,v-6),'light'),
      far('short-vial','glass',[[u+2,v-5],[u+2,v-9],[u+3,v-10],[u+5,v-10],[u+6,v-8],[u+6,v-5]],'base'),
      far('small-cork','leather',rect(u+3,v-11,u+5,v-9),'light'),
      far('front-rail','leather',strip([u-6,v-4],[u+7,v-4],2),'light'),
    ]);
    names.far='apothecary-vial-rack';
  }else if(identity.tools==='tether'){
    const [cx,cy]=locate(rig,'chest');
    tether=far('sling-anchor','leather',strip([cx-5,cy-3],[u-1,v-1],2),'light');
    additions.set('far',[
      far('sling-top','leather',strip([u-6,v-4],[u+3,v+1],2),'base'),
      far('sling-loop','leather',[[u+3,v-1],[u+5,v+2],[u+4,v+7],[u+1,v+9],
        [u-2,v+9],[u-5,v+6],[u-6,v+3],[u-4,v+3],[u-3,v+6],[u,v+7],[u+2,v+5],[u+2,v]],'base'),
    ]);
    names.far='shoulder-tether';
  }else{
    const a=x-5,b=y-8;
    additions.set('near',[
      near('stem','leather',strip([a,b],[x+2,y+3],2.4),'base'),
      near('dial-frame','metal',[[a-4,b-2],[a-2,b-4],[a+2,b-4],[a+4,b-2],[a+4,b+2],
        [a+2,b+4],[a-2,b+4],[a-4,b+2]],'base'),
      near('dial-face','glass',[[a-3,b-1],[a-1,b-3],[a+2,b-2],[a+3,b],[a+1,b+2],[a-2,b+2]],'light'),
      near('needle','metal',strip([a-2,b+2],[a+2,b-2],1.6),'shadow'),
    ]);
    additions.set('far',[
      far('chart-back','leather',[[u-7,v-8],[u-1,v-10],[u+3,v-8],[u+9,v-10],[u+10,v-2],
        [u+5,v+2],[u-2,v],[u-6,v+1]],'shadow'),
      far('western-leaf','glass',[[u-6,v-7],[u-1,v-9],[u+2,v-7],[u+2,v-1],[u-2,v-2],[u-5,v]],'light'),
      far('eastern-leaf','glass',[[u+2,v-7],[u+8,v-9],[u+9,v-3],[u+5,v],[u+2,v-1]],'base'),
      far('chart-coast','cap',[[u-4,v-7],[u-3,v-7],[u-2,v-5],[u+3,v-5],[u+5,v-6],
        [u+6,v-5],[u+3,v-3],[u-1,v-3],[u-4,v-5]],'shadow'),
      far('chart-spine','leather',strip([u+1,v-4],[u-3,v+2],2),'base'),
    ]);
    names.near='survey-compass'; names.far='folded-chart';
  }
  const layers=base.layers.flatMap(p=>{
    const side=p.id.split('-')[0] as 'near'|'far';
    const gear=additions.get(side);
    if(gear&&p.id.includes('-tool'))return [];
    if(gear&&p.id===side+'-hand')return [...gear,p];
    if(tether&&p.id==='neck')return [tether,p];
    return [p];
  });
  const props=base.props.map(p=>{
    const side=p.hand.split('-')[0] as 'near'|'far', parts=additions.get(side);
    return parts?{...p,id:names[side]!,masks:[...parts.map(p=>p.mask),...(side==='far'&&tether?[tether.mask]:[])]}:p;
  });
  return {layers,props,changed:new Set([...additions.values()].flat().map(p=>p.id).concat(tether?[tether.id]:[]))};
}

function repaint(original:Render,layers:Part[],changed:Set<string>,direction:Direction,face:Map<string,Raster>|null) {
  const ramps={...characterRamps,...direction.ramps};
  const labels=Object.fromEntries(layers.map((p,j)=>[p.id,((0x456678+j*104729)&0xffffff)*256+255]));
  const owner=composite(layers.map(p=>silhouette(p.mask,labels[p.id])));
  const byOwner=new Map(layers.map(p=>[labels[p.id],p]));
  const paint=blank(),material=blank();
  const bounds=new Map(layers.map(p=>{
    const i=maskPixels(p.mask),x=i.map(i=>i%64);
    assert.ok(i.length,p.id);
    return [p.id,[Math.min(...x),Math.max(...x),Math.floor(i[0]/64),Math.floor(i.at(-1)!/64)] as const];
  }));
  for(const i of maskPixels(owner)){
    const p=byOwner.get(get(owner,i))!, special=face?.get(p.id);
    if(!special&&!changed.has(p.id)&&get(original.ownership,i)===original.labels[p.id]){
      set(paint,i,get(original.final,i));
      set(material,i,get(original.mat,i));
      continue;
    }
    const [l,r,t,b]=bounds.get(p.id)!, u=(i%64-l+.5)/(r-l+1),v=(Math.floor(i/64)-t+.5)/(b-t+1);
    const val=p.accent&&alpha(p.accent,i)?'light':p.tone&&p.tone!=='base'?p.tone:
      u>.76||v>.91?'shadow':u<.52&&v<.55&&u+v<.82?'light':'base';
    set(paint,i,special&&get(special,i)||pack(ramps[p.role][val]));
    set(material,i,pack(materialMaskLegend[p.role]));
  }
  const contour=pack(direction.outline),{final,silhouette:total}=renderOutlinedLayers([paint],[owner],contour);
  for(const i of maskPixels(total))if(!alpha(paint,i)){
    set(owner,i,contour);
    set(material,i,pack(materialMaskLegend.contour));
  }
  const bodySilhouette=silhouette(composite(layers.filter(p=>!p.id.includes('-tool')&&!hats.has(p.id)).map(p=>p.mask)),contour);
  return {...original,layers,labels,final,total,ownership:owner,mat:material,bodySilhouette};
}

function facePlanes(rig:Rig,profile:Profile,direction:Direction) {
  const skin={...characterRamps,...direction.ramps}.skin, [x,y]=headOrigin(rig,profile);
  const face=blank(), neck=blank(), b=profile.skull, j=profile.jaw;
  const plane=(tone:Tone,points:readonly Point[])=>fillPolygon(face,points,pack(skin[tone]));
  plane('base',rect(x-12,y-12,x+12,y+13));
  plane('shadow',[[x-b,y-5],[x-3,y-4],[x-2,y+1],[x-1,y+5],[x+2,y+7],[x+j,y+5],
    [x+j,y+10],[x-b,y+10]]);
  plane('light',[[x+1,y-3],[x+b-2,y-4],[x+b-2,y-1],[x+b+1,y+1],[x+b,y+3],[x+3,y+4],[x+1,y+3]]);
  plane('base',[[x+2,y+1],[x+5,y+1],[x+5,y+3],[x+3,y+4],[x+1,y+3]]);
  plane('accent',rect(x+b-4,y-1,x+b-1,y+1));
  plane('base',rect(x+b-2,y-1,x+b-1,y));
  plane('shadow',rect(x+j-2,y+4,x+j+1,y+5));
  fillPolygon(neck,rect(x-12,y-12,x+12,y+16),pack(skin.shadow));
  fillPolygon(neck,[[x-2,y+5],[x,y+6],[x+1,y+8],[x-1,y+10],[x-3,y+9]],pack(skin.base));
  return new Map([['head',face],['neck',neck]]);
}

export function identitySteps(base:Render,rig:Rig,identity:Identity,direction:Direction) {
  assert.equal(base.stage,'b3');
  const shape=costumeLayers(base,rig,identity);
  const s1=repaint(base,shape.layers,shape.changed,direction,null);
  const s2=repaint(s1,shape.layers,new Set(),direction,facePlanes(rig,morphology[identity.archetype],direction));
  const gear=gripEquipment(identity,rig,s2);
  const s3={...repaint(s2,gear.layers,gear.changed,direction,null),props:gear.props};
  return {s0:base,s1,s2,s3};
}
