import assert from 'node:assert/strict';
import { composite,makeRaster,type Raster } from '../core/pixels/raster.ts';
import type { Point } from '../core/geometry/shapes.ts';
import { identitySteps,type Archetype,type Identity } from './character-identity-study.ts';
import { maskPixels } from './costume-stance.ts';

const cannotFit = 'HEADWEAR_CANNOT_FIT_WITHOUT_DESIGN_CHANGE';
const headwear = new Set(['oilskin','cap','hood']);
// E9.1S is frozen. The wrapper verifies the planned offsets against its rendered part masks.
const offsets: Record<Archetype,Point> = {
  braced:[-1,0], tapered:[1,-1], mantled:[1,0], tailored:[0,-2],
};

export function rasterBounds(raster: Raster) {
  const pixels=maskPixels(raster);
  if(!pixels.length)return null;
  const xs=pixels.map(i=>i%raster.w);
  return {left:Math.min(...xs),right:Math.max(...xs),
    top:Math.floor(pixels[0]/raster.w),bottom:Math.floor(pixels.at(-1)!/raster.w)};
}

function shiftMask(raster:Raster,[dx,dy]:Point) {
  if(dx===0&&dy===0)return raster;
  const output=makeRaster(raster.w,raster.h);
  for(const i of maskPixels(raster)){
    const x=i%raster.w+dx,y=Math.floor(i/raster.w)+dy;
    assert.ok(x>=0&&x<raster.w&&y>=0&&y<raster.h,cannotFit);
    output.rgba.writeUInt32BE(raster.rgba.readUInt32BE(i*4),(y*raster.w+x)*4);
  }
  return output;
}

export function planHeadwearFit(mask:Raster, [dx,dy]:Point, padding:number) {
  const raw=rasterBounds(mask);
  if(!raw)return {adjustment:[0,0] as Point,nominal:null,placed:null};
  const nominal={left:raw.left+dx,right:raw.right+dx,top:raw.top+dy,bottom:raw.bottom+dy};
  const inset=padding+1; // The renderer adds one cardinal pixel around the union.
  const adjust=(lo:number,hi:number,extent:number)=>{
    const minimum=inset-lo, maximum=extent-1-inset-hi;
    assert.ok(minimum<=maximum,cannotFit);
    return Math.max(minimum,Math.min(0,maximum));
  };
  const x=adjust(nominal.left,nominal.right,mask.w), y=adjust(nominal.top,nominal.bottom,mask.h);
  return {adjustment:[x,y] as Point,nominal,placed:{left:nominal.left+x,right:nominal.right+x,top:nominal.top+y,bottom:nominal.bottom+y}};
}

export function requireHeadwearContact(skull:Raster,cap:Raster) {
  const pixels=maskPixels(cap);
  if(pixels.length)assert.ok(pixels.filter(i=>skull.rgba[i*4+3]===255).length>=2,cannotFit);
}

export function fitIdentityHeadwear(
  baseline:Parameters<typeof identitySteps>[0], rig:Parameters<typeof identitySteps>[1], identity:Identity,
  direction:Parameters<typeof identitySteps>[3], padding:number, input=baseline,
) {
  const hats=input.layers.filter(p=>headwear.has(p.id));
  const mask=composite([makeRaster(input.final.w,input.final.h),...hats.map(p=>p.mask)]);
  const plan=planHeadwearFit(mask,offsets[identity.archetype],padding);
  const layers=input.layers.map(p=>headwear.has(p.id)?{...p,mask:shiftMask(p.mask,plan.adjustment)}:p);
  const steps=identitySteps({...input,layers},rig,identity,direction);
  for(const r of [steps.s1,steps.s2,steps.s3]){
    const placed=composite([makeRaster(r.final.w,r.final.h),...r.layers.filter(p=>headwear.has(p.id)).map(p=>p.mask)]);
    assert.deepEqual(rasterBounds(placed),plan.placed,'E91S_HEADWEAR_OFFSET_DRIFT');
    requireHeadwearContact(r.layers.find(p=>p.id==='head')!.mask,placed);
  }
  return {steps:{...steps,s0:baseline},plan};
}
