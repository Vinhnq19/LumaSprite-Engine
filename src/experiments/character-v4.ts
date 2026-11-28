import assert from 'node:assert/strict';
import { rect } from '../core/geometry/faces.ts';
import { ellipseSpans } from '../core/geometry/projection.ts';
import { cluster, fillPolygon, type Point } from '../core/geometry/shapes.ts';
import { paintSurface } from '../core/materials/surface.ts';
import { inkLuma, pack } from '../core/palette/colors.ts';
import { composite, makeRaster, put, silhouette, type Raster } from '../core/pixels/raster.ts';
import { renderOutlinedLayers } from '../core/renderer/layers.ts';
import { characterReview } from '../generators/character/export.ts';
import { characterRamps, materialPlanes, type Surface } from '../generators/character/material-planes.ts';
import { materialMaskLegend, renderCharacterMaterials, type MaterialDirection } from '../generators/character/materials.ts';
import { alphaPlane, makeShapeLock } from '../generators/character/shape-lock.ts';
import type { StyleProfile } from '../specs/environment.ts';
import { paintHandTool, planHandTool, type ToolKind } from './character-equipment.ts';
import { inspectStructure } from './structure-quality/diagnostics.ts';

export type Tool = 'valve' | 'key' | 'ladle' | 'tray';
export type Grip = 'overhand' | 'underhand' | 'pinch' | 'supporting';
export type Stage = 'a0' | 'b1' | 'b2' | 'b3' | 'b4';
export type Case = { id: string; seeds: number[]; legacy: string; role: 'development' | 'holdout'; brief: string;
  torso: 'broad' | 'narrow'; garment: 'apron' | 'a-line'; headwear: 'oilskin' | 'bun';
  equipment: [Tool, Tool]; grips: [Grip, Grip] };
type Body = ReturnType<typeof characterReview>;
type Theme = StyleProfile['illumination']['day'];
type Tone = keyof typeof characterRamps.skin;
type Ramp = Record<Tone, string>;
type Part = { id: string; role: Surface; mask: Raster; form?: [Point, Point] | undefined; accent?: Raster | undefined; tone?: Tone | undefined };
const size = 64;
const blank = () => makeRaster(size, size);
const maskInk = pack('#ffffff');
const alpha = (image: Raster, i: number) => image.rgba[i * 4 + 3] === 255;
const index = ([x, y]: Point) => y * size + x;
const at = (image: Raster, p: Point) => alpha(image, index(p));
const polygon = (points: readonly Point[]) => {
  const r = blank(); fillPolygon(r, points, maskInk); return r;
};
const shifted = ([x, y]: Point, dx: number, dy: number): Point => [x + dx, y + dy];
const box = (x: number, y: number, w: number, h: number) => polygon(rect(x, y, x + w, y + h));
const formed = (id: string, role: Surface, mask: Raster, form?: [Point, Point], accent?: Raster, tone?: Tone): Part =>
  ({ id, role, mask, form, accent, tone });

export function legacyBody(recipe: Case, seed: number, legacy: { spec: Record<string, unknown>; matched: { near: object; far: object } }) {
  const spec = legacy.spec;
  const pose = spec.pose as Record<string, object>;
  return characterReview({ ...spec, seed, name: recipe.id,
    pose: { ...pose, near: { ...pose.near, ...legacy.matched.near }, far: { ...pose.far, ...legacy.matched.far } } });
}

function segment(from: Point, to: Point, start: number, end: number): Raster {
  const dx = to[0] - from[0], dy = to[1] - from[1], length = Math.hypot(dx, dy);
  assert.ok(length > 0);
  const wing = ([x, y]: Point, width: number): Point =>
    [x + .5 - dy / length * width / 2, y + .5 + dx / length * width / 2];
  const r = polygon([wing(from, start), wing(to, end), wing(to, -end), wing(from, -start)]);
  cluster(r, maskInk, [...ellipseSpans(shifted(from, .5, .5), start, start), ...ellipseSpans(shifted(to, .5, .5), end, end)]);
  return r;
}

function hand(variant: Grip, wrist: Point, palm: Point, side: string) {
  const dx = Math.sign(palm[0] - wrist[0]) || 1;
  const r = segment(wrist, palm, side === 'far' ? 3 : 4, variant === 'supporting' ? 3 : 4);
  const fromPalm = (u: number, y: number) => shifted(palm, dx * u, y);
  const points: Record<Grip, Point[]> = {
    overhand: [[0,-2],[2,-2],[3,-1],[2,1],[1,2],[-1,1]],
    underhand: [[-1,0],[1,-2],[2,-2],[3,0],[2,2],[0,2]],
    pinch: [[-1,0],[1,-2],[2,-2],[2,0],[1,2],[0,2]],
    supporting: [[-1,0],[0,-1],[3,-1],[3,1],[1,2],[-1,1]],
  };
  const thumb = polygon(points[variant].map(([x,y]) => fromPalm(x,y)));
  const crease = variant === 'overhand' ? fromPalm(1, 1) : fromPalm(1, -1);
  const accent = blank();
  put(accent, ...crease, maskInk);
  return formed(side + '-hand', 'skin', composite([r, thumb]), [wrist, palm], accent);
}

function model(recipe: Case, seed: number, legacy: Body, gripAware: boolean): Part[] {
  const origin = (name: string): Point => legacy.plan.landmarks[name].point;
  const [cx, hy] = origin('pelvis'), [sx, shaftY] = origin('chest'), sy = shaftY - 3;
  const broad = recipe.torso === 'broad', half = broad ? 11 : 7;
  const waist = broad ? 8 : 5;
  const torso = polygon([[sx-half+2,sy+1],[sx-half+6,sy-1],[sx+2,sy-2],[sx+half-3,sy-3],
    [sx+half,sy],[sx+half-1,sy+7],[cx+waist,hy+1],[cx-waist+1,hy+2],[cx-waist-1,hy-2],[sx-half,sy+6]]);
  const pelvis = polygon([[cx-waist,hy-2],[cx+waist-1,hy-3],[cx+waist+1,hy+3],[cx+4,hy+8],
    [cx,hy+5],[cx-5,hy+8],[cx-waist,hy+4]]);
  const [hx, cy] = origin('crown'), headW = broad ? 8 : 6;
  const head = polygon([[hx-headW+1,cy-5],[hx-3,cy-8],[hx+3,cy-8],[hx+headW-2,cy-5],
    [hx+headW-2,cy-1],[hx+headW,cy+1],[hx+headW+1,cy+3],[hx+headW-2,cy+4],
    [hx+headW-3,cy+7],[hx+1,cy+9],[hx-3,cy+8],[hx-headW+1,cy+4]]);
  const [nx, ny] = origin('neck');
  const neck = polygon([[nx-3,ny-4],[nx+4,ny-5],[nx+4,ny+4],[nx-4,ny+4]]);
  const eyes = blank();
  for (const [x,y] of [[hx+3,cy+1],[hx+4,cy+1],[hx+6,cy+5]] as const) if (at(head,[x,y])) put(eyes,x,y,maskInk);
  const hair = polygon([[hx-headW,cy-4],[hx-4,cy-8],[hx+3,cy-8],[hx+headW-2,cy-5],
    [hx+headW-3,cy-2],[hx+1,cy-4],[hx-2,cy-2],[hx-3,cy+3],[hx-5,cy+4],[hx-headW,cy+1]]);
  const headwear = recipe.headwear === 'oilskin'
    ? formed('oilskin', 'cap', polygon([[hx-headW-1,cy-3],[hx-headW,cy-8],[hx-5,cy-11],[hx+1,cy-12],
      [hx+6,cy-9],[hx+7,cy-6],[hx+11,cy-5],[hx+11,cy-3],[hx+3,cy-2],[hx-3,cy-1]]))
    : formed('bun', 'hair', polygon([[hx-headW-4,cy-8],[hx-headW-2,cy-11],[hx-headW+1,cy-11],
      [hx-headW+3,cy-8],[hx-headW+2,cy-4],[hx-headW-2,cy-3],[hx-headW-5,cy-5]]));
  const tunic = polygon([[cx-waist,hy-3],[cx+waist-1,hy-3],[cx+waist+4,hy+9],
    [cx+waist+3,hy+12],[cx+1,hy+14],[cx-waist-4,hy+13],[cx-waist-3,hy+9]]);
  const apron = polygon([[sx-5,sy+5],[sx+4,sy+4],[sx+5,sy+13],[cx+waist,hy+1],
    [cx+waist,hy+8],[cx+3,hy+10],[cx-waist+2,hy+9],[cx-waist-1,hy+6],[sx-6,sy+13]]);
  const shawl = polygon([[nx-6,ny+1],[nx+3,ny-1],[sx+half,sy+1],[sx+half,sy+6],[sx+2,sy+9],
    [sx-3,sy+17],[sx-6,sy+14],[sx-7,sy+8],[sx-half,sy+6]]);
  const trim = seed % 2;
  const seam = recipe.garment === 'apron' ? box(cx - 6 + trim, hy, 13, 2) : box(cx - 5 + trim, hy - 1, 11, 2);
  const legs: Part[] = [];
  const arms: Part[][] = [];
  for (const [selected, side] of ['far', 'near'].entries()) {
    const far = side === 'far';
    const joint = (name: string) => origin(side + '-' + name);
    const hip: Point = [cx + (far ? 5 : -4), hy + (far ? 1 : 3)];
    const knee = joint('knee'), ankle = joint('ankle');
    const pants = far ? 'far-trousers' : 'trousers';
    const cloth = far ? 'far-coat' : 'coat';
    legs.push(formed(side + '-thigh', pants, segment(hip,knee,broad ? 8 : 6,5),[hip,knee]),
      formed(side + '-shin', pants, segment(knee,ankle,5,4),[knee,ankle]),
      formed(side + '-boot','leather',legacy.layers[side + '-boot']));
    const shoulder: Point = [sx + (far ? half - 3 : -half + 3),sy + (far ? 1 : 4)];
    const elbow = joint('elbow'), wrist = joint('wrist'), palm = joint('palm');
    const upper = segment(shoulder,elbow,broad ? 8 - Number(far) : 6, 5);
    const lower = segment(elbow,wrist,5,far ? 3 : 4);
    arms.push([formed(side+'-upper-arm',cloth,upper,[shoulder,elbow]),
      formed(side+'-forearm',cloth,lower,[elbow,wrist]),
      gripAware ? hand(recipe.grips[1-selected],wrist,palm,side) : formed(side+'-hand','skin',legacy.layers[side+'-hand'])]);
  }
  const garment = recipe.garment === 'apron' ? [formed('apron','leather',apron),formed('apron-strap','leather',
    polygon([[sx-7,sy],[sx-5,sy],[sx-4,sy+8],[sx-6,sy+9]])),formed('belt','leather',seam,undefined,undefined,'shadow')]
    : [formed('a-line-tunic','coat',tunic),formed('shawl','cap',shawl),formed('sash','leather',seam,undefined,undefined,'accent')];
  return [...legs, formed('pelvis','trousers',pelvis), ...arms[0], formed('torso','coat',torso), ...garment,
    formed('neck','skin',neck), formed('head','skin',head,undefined,eyes), formed('hair','hair',hair), headwear, ...arms[1]];
}

function expanded(tool: Tool, palm: Point) {
  const [x,y] = palm;
  if (tool === 'tray') return [
    formed('shaft','leather',box(x-4,y-1,8,3)),
    formed('tray','leather',polygon([[x-7,y-3],[x+8,y-4],[x+10,y-2],[x+7,y+1],[x-6,y+2]])),
    formed('bottle','glass',polygon([[x-4,y-5],[x-2,y-7],[x-2,y-11],[x+1,y-11],[x+1,y-7],
      [x+3,y-5],[x+3,y-3],[x-4,y-3]])),
    formed('cork','leather',box(x-2,y-12,3,2)), formed('small-bottle','glass',polygon([[x+4,y-6],[x+5,y-8],
      [x+5,y-10],[x+8,y-10],[x+8,y-7],[x+9,y-5],[x+9,y-3],[x+4,y-3]]))];
  if (tool === 'key') return [
    formed('shaft','leather',box(x-3,y-1,7,2)),
    formed('key','metal',polygon([[x+1,y-2],[x+4,y-2],[x+5,y],[x+4,y+2],[x+4,y+7],
      [x+7,y+7],[x+7,y+9],[x+3,y+9],[x+2,y+7],[x+2,y+2],[x,y+1],[x,y-1]]))];
  const tip: Point = tool === 'valve' ? [x-8,y-10] : [x-12,y-17];
  const butt: Point = [x+3,y+5];
  const shaft = formed('shaft','leather',segment(tip,butt,2.6,2.6),[tip,butt]);
  const [tx,ty] = tip;
  if (tool === 'ladle') return [shaft,
    formed('cup','metal',polygon([[tx-5,ty-4],[tx-2,ty-7],[tx+2,ty-7],[tx+5,ty-4],[tx+5,ty-1],
      [tx+2,ty+2],[tx-2,ty+2],[tx-5,ty]])),
    formed('cup-inside','glass',polygon([[tx-4,ty-4],[tx-1,ty-6],[tx+2,ty-6],[tx+4,ty-4],[tx+2,ty-2],[tx-2,ty-2]]),
      undefined,undefined,'shadow')];
  return [shaft, formed('head','glass',polygon([[tx-5,ty-4],[tx-3,ty-6],[tx+3,ty-6],[tx+6,ty-3],
    [tx+5,ty+1],[tx+2,ty+3],[tx-3,ty+2],[tx-5,ty]])),
    formed('hub','metal',box(tx-2,ty-3,5,4))];
}

function bounds(mask: Raster) {
  const indices = Array.from({ length: size * size },(_,i)=>i).filter(i=>alpha(mask,i));
  assert.ok(indices.length);
  return { indices, left: Math.min(...indices.map(i=>i%size)), right: Math.max(...indices.map(i=>i%size)),
    top: Math.floor(indices[0]/size), bottom: Math.floor(indices.at(-1)!/size) };
}

function material(part: Part, ramp: Ramp, style: boolean) {
  const { indices, ...box } = bounds(part.mask);
  const inks = Object.fromEntries(Object.entries(ramp).map(([tone,hex])=>[tone,pack(hex)])) as Record<Tone,number>;
  const result = blank();
  if (!style) paintSurface(result,indices,box,inks.base,inks,materialPlanes(part.id,part.role,true,true));
  for (const i of indices) {
    const x=i%size, y=Math.floor(i/size), u=(x-box.left+.5)/(box.right-box.left+1), v=(y-box.top+.5)/(box.bottom-box.top+1);
    if (style || part.tone) {
      let tone: Tone = part.tone ?? (u > .72 || v > .91 ? 'shadow' : 'base');
      if (!part.tone && part.form) {
        const [a,b]=part.form, dx=b[0]-a[0], dy=b[1]-a[1];
        const axis=(dx*(y-a[1])-dy*(x-a[0]))/Math.hypot(dx,dy);
        const lit=dy >= 0 ? axis : -axis;
        tone=lit>1 && v<.85?'light':lit < -1.1?'shadow':v>.77?'accent':'base';
      } else if (!part.tone && u<.58 && v<.48 && u+v<.83) tone='light';
      if (part.id==='torso' && v>.44 && v<.77 && u>.19 && u<.55 && Math.abs(v-u*.42-.41)<.05) tone='accent';
      if (part.id==='apron' && u>.12 && u<.78 && v>.73 && Math.abs(v-.87+u*.10)<.047) tone='accent';
      result.rgba.writeUInt32BE(inks[tone],i*4);
    }
    if (part.accent && alpha(part.accent,i)) result.rgba.writeUInt32BE(inks[part.id==='head'?'accent':'shadow'],i*4);
  }
  return result;
}

export function renderQualityCharacter(recipe: Case, seed: number, body: Body, stage: Stage, direction: MaterialDirection,
  theme: Theme, shared: boolean, revision: string) {
  const ramps = { ...characterRamps, ...direction.ramps } as Record<Surface,Ramp>;
  const imported = stage==='a0';
  assert.ok(!imported || shared);
  const shape = imported ? body.plan.parts.map(({id})=>{
    const role: Surface = id==='head'||id==='neck'||id.endsWith('-hand') ? 'skin' :
      id==='hood'?'cap':id.startsWith('far-')?'far-coat':'coat';
    return formed(id,role,body.layers[id]);
  }) : model(recipe,seed,body,stage!=='b1');
  const legacy = imported ? renderCharacterMaterials(body,makeShapeLock(body,revision,recipe.id),'m2p',undefined,direction) : null;
  const props: Array<{ id: string; masks: Raster[]; socket: Point; hand: string }> = [];
  const layers: Part[] = [];
  const sharedArt = new Map<string,Raster>();
  for (const part of shape) {
    if (part.id.endsWith('-hand')) {
      const side=part.id.split('-')[0], which=side==='near'?0:1;
      const socket=body.plan.landmarks[side+'-palm'].point;
      const tool = recipe.equipment[which];
      let built: Part[];
      if (shared) {
        const kind: ToolKind = which===1?'toolbox':tool==='valve'?'wrench':'hook';
        const ink = paintHandTool(planHandTool(kind,socket,which===0?[-7,-6]:[1,0]),theme,socket,false).raster;
        built=[formed(side+'-tool','metal',ink)];
        sharedArt.set(side+'-tool',ink);
      } else {
        built=expanded(tool,socket).map(chunk=>({ ...chunk, id: side+'-tool-'+chunk.id }));
      }
      layers.push(...built);
      props.push({id:tool,masks:built.map(p=>p.mask),socket,hand:part.id});
    }
    layers.push(part);
  }
  const formAware=stage==='b3'||stage==='b4';
  const inks=layers.map(part=>sharedArt.get(part.id)??legacy?.layers[part.id]??material(part,ramps[part.role],formAware));
  const filled=composite(inks);
  const outline=pack(direction.outline);
  const {final,silhouette: total}=renderOutlinedLayers(inks,inks,outline);
  const distinct=layers.map((p,i)=>[p.id, ((0x456678+i*104729)&0xffffff)*256+255] as const);
  const ownership=composite(layers.map((p,i)=>silhouette(p.mask,distinct[i][1])));
  const mat=composite(layers.map(p=>silhouette(p.mask,pack(materialMaskLegend[p.role]))));
  let lit=0, shadow=0, contact=0, internal=0;
  const inkBoundary=blank();
  for (let y=1;y<63;y++) for(let x=1;x<63;x++) {
    const i=y*size+x;
    if (!alpha(total,i)) continue;
    if (!alpha(filled,i)) {
      const light = alpha(filled,i+1)||alpha(filled,i+size);
      const dark = alpha(filled,i-1)||alpha(filled,i-size);
      if (light && !dark && y<body.plan.pivot[1]-3) {
        lit++;
        put(inkBoundary,x,y,pack('#fbc86d'));
        const hit = alpha(filled,i+size) ? i+size : i+1;
        const paint = filled.rgba.readUInt32BE(hit*4);
        const part = layers.find((_,j)=>distinct[j][1]===ownership.rgba.readUInt32BE(hit*4));
        if (stage==='b4' && part && !part.id.includes('-tool') && inkLuma(paint)>86) {
          const change = pack(ramps[part.role].shadow);
          if (inkLuma(change)>=55 && inkLuma(change)<=inkLuma(paint)-12) put(final,x,y,change);
        }
      } else if (y>=body.plan.pivot[1]-3) {
        contact++;
        put(inkBoundary,x,y,pack('#9be6b7'));
      } else {
        shadow++;
        put(inkBoundary,x,y,pack('#6972a1'));
      }
      put(ownership,x,y,outline);
      put(mat,x,y,pack(materialMaskLegend.contour));
    } else if (legacy && !layers.some((part,j)=>part.id.endsWith('-tool')&&distinct[j][1]===ownership.rgba.readUInt32BE(i*4))) {
      const legacyInk=legacy.mask.rgba.readUInt32BE(i*4);
      if (legacyInk && legacyInk!==pack(materialMaskLegend.contour)) mat.rgba.writeUInt32BE(legacyInk,i*4);
    } else if (alpha(filled,i+1) && mat.rgba.readUInt32BE(i*4)!==mat.rgba.readUInt32BE((i+1)*4)) {
      put(inkBoundary,x,y,pack('#ee947c')); internal++;
    }
  }
  const showBody=shape.filter(p=>!['hood','oilskin','bun','hair','satchel','strap'].includes(p.id));
  const bald=composite(showBody.map(p=>p.mask));
  const bodySilhouette=silhouette(bald,outline);
  const palette=new Set([outline,...Object.values(ramps).flatMap(r=>Object.values(r)).map(pack),
    ...Object.values(theme.surfaces).flat().map(pack),...(legacy?.usedColors.map(pack)??[])]);
  return { final,total,ownership,mat,inkBoundary,bodySilhouette,props,layers,labels:Object.fromEntries(distinct),palette,
    outline:{lit,shadow,contact,internal},pivot:body.plan.pivot,shared,stage };
}

export function checkQualityCharacter(r: ReturnType<typeof renderQualityCharacter>, limits: { padding: number; alphaComponents: number; minimumGripOverlap: number; minimumShaftVisible: number; minimumLegGapRows: number }) {
  const { final, total, ownership, mat, props, layers, labels, palette, pivot }=r;
  assert.deepEqual([final.w,final.h],[64,64]);
  const silhouetteData=inspectStructure(final,palette,mat).stat;
  assert.equal(silhouetteData.components.length,limits.alphaComponents,'DISCONNECTED_SILHOUETTE');
  assert.ok(silhouetteData.bounds!.left>=limits.padding && silhouetteData.bounds!.right<size-limits.padding && silhouetteData.bounds!.top>=limits.padding);
  assert.equal(silhouetteData.bounds!.bottom,pivot[1]-1,'GROUND_DELTA');
  assert.ok(at(final,[pivot[0],pivot[1]-1]),'PIVOT_CONTACT');
  for (const image of [total, ownership, mat]) assert.deepEqual(alphaPlane(image),alphaPlane(final),'MASK_ALPHA');
  const hasPixels=(part: Part)=>bounds(part.mask).indices.length;
  assert.ok(layers.every(p=>hasPixels(p)>0));
  const part=(name:string)=>layers.find(p=>p.id===name)!.mask;
  const handTests = props.map(prop=>{
    const hand=part(prop.hand), equipment=composite(prop.masks);
    const pixel=bounds(equipment).indices;
    const overlap=pixel.filter(i=>alpha(hand,i)).length;
    const shown=pixel.filter(i=>layers.some(p=>p.id.startsWith(prop.hand.replace('hand','tool'))&&labels[p.id]===ownership.rgba.readUInt32BE(i*4))).length;
    const join=bounds(hand).indices.filter(i=>alpha(part(prop.hand.replace('hand','forearm')),i)).length;
    const owner = ownership.rgba.readUInt32BE(index(prop.socket)*4);
    assert.ok(join>=2 && at(hand,prop.socket) && at(equipment,prop.socket) && overlap>=limits.minimumGripOverlap &&
      ((r.stage==='a0'||r.stage==='b1') || owner===labels[prop.hand]) && shown>=limits.minimumShaftVisible, 'GRIP_CONTACT '+prop.hand);
    return {id:prop.id, hand:prop.hand,socket:prop.socket,overlap,join,shown,occludes:owner===labels[prop.hand],total:pixel.length};
  });
  let legGapRows=0;
  for(let y=47;y<56;y++){
    const left=Array.from({length:64},(_,x)=>x).findLast(x=>at(part('near-shin'),[x,y])||at(part('near-boot'),[x,y]));
    const right=Array.from({length:64},(_,x)=>x).find(x=>at(part('far-shin'),[x,y])||at(part('far-boot'),[x,y]));
    if(left!==undefined && right!==undefined && right-left>=4 && !at(total,[Math.floor((left+right)/2),y])) legGapRows++;
  }
  assert.ok(legGapRows>=limits.minimumLegGapRows,'STANCE_GAP');
  const torso=layers.find(p=>p.id==='torso'||p.id==='jacket')!;
  const b=bounds(torso.mask);
  let mass=0,sumX=0;
  for (const i of bounds(r.bodySilhouette).indices){mass++;sumX+=i%64;}
  const feet=['near-boot','far-boot'].map(id=>bounds(part(id)));
  assert.ok(sumX/mass>=feet[0].left && sumX/mass<=feet[1].right,'CENTER_OUTSIDE_SUPPORT');
  return {bounds:silhouetteData.bounds,pixels:silhouetteData.coverage, isolatedOutline:silhouetteData.isolatedOutline,place:pivot,torsoWidth:b.right-b.left+1,
    legGapRows, handTests, centerX:Math.round(sumX/mass*10)/10, outline:r.outline };
}
