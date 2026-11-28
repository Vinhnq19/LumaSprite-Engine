import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeRaster,composite,blit } from '../src/core/pixels/raster.ts';
import { rect,outline } from '../src/core/geometry/faces.ts';
import { fillPolygon,type Point } from '../src/core/geometry/shapes.ts';
import { planHeadwearFit,rasterBounds,requireHeadwearContact } from '../src/experiments/character-headwear-fit.ts';

const ink=0xffffffff;
function box(left:number,top:number,right:number,bottom:number) {
  const r=makeRaster(64,64);
  fillPolygon(r,rect(left,top,right,bottom),ink);
  return r;
}
function shift(mask:ReturnType<typeof box>,[dx,dy]:Point) {
  const b=rasterBounds(mask)!;
  const piece=makeRaster(b.right-b.left+1,b.bottom-b.top+1);
  for(let y=b.top;y<=b.bottom;y++)mask.rgba.copy(piece.rgba,(y-b.top)*piece.w*4,(y*64+b.left)*4,(y*64+b.right+1)*4);
  const result=makeRaster(64,64);
  blit(result,piece,b.left+dx,b.top+dy);
  return result;
}

test('low profile and no headwear retain their position on narrow and wide skulls',()=>{
  const low=box(26,7,36,12),empty=makeRaster(64,64);
  assert.deepEqual(planHeadwearFit(low,[0,-1],1).adjustment,[0,0]);
  const none=planHeadwearFit(empty,[0,-2],1);
  assert.deepEqual(none,{adjustment:[0,0],nominal:null,placed:null});
  for(const skull of [box(28,8,36,25),box(23,8,41,25)]){
    requireHeadwearContact(skull,low);
    assert.equal(rasterBounds(outline(composite([skull,empty]),ink))?.top,7);
  }
});

test('high crown meets the raw and final top margins without dropping a pixel',()=>{
  const crown=box(27,3,36,16),skull=box(26,10,38,27);
  const old=shift(crown,[0,-2]);
  assert.equal(rasterBounds(outline(composite([skull,old]),ink))?.top,0);
  const plan=planHeadwearFit(crown,[0,-2],1);
  assert.deepEqual(plan.adjustment,[0,1]);
  const safe=shift(crown,[0,-2+plan.adjustment[1]]);
  assert.deepEqual(rasterBounds(safe),plan.placed);
  assert.equal(rasterBounds(safe)?.top,2);
  assert.equal(rasterBounds(outline(composite([skull,safe]),ink))?.top,1);
  assert.deepEqual(shift(safe,[0,1]),crown);
});

test('wide brim reserves one cardinal contour pixel on either edge',()=>{
  for(const [left,right,dx,expected] of [[1,43,-1,2],[21,63,1,-2]]){
    const mask=box(left,10,right,15), plan=planHeadwearFit(mask,[dx,0],1);
    assert.equal(plan.adjustment[0],expected);
    const raster=outline(shift(mask,[dx+expected,0]),ink);
    const b=rasterBounds(raster)!;
    assert.ok(b.left>=1&&b.right<=62);
  }
});

test('impossible width, height or detached headwear emits a design error',()=>{
  assert.throws(()=>planHeadwearFit(box(1,3,63,14),[0,0],1),/HEADWEAR_CANNOT_FIT_WITHOUT_DESIGN_CHANGE/);
  assert.throws(()=>planHeadwearFit(box(22,0,34,63),[0,0],1),/HEADWEAR_CANNOT_FIT_WITHOUT_DESIGN_CHANGE/);
  assert.throws(()=>requireHeadwearContact(box(26,19,37,32),box(12,3,37,8)),/HEADWEAR_CANNOT_FIT_WITHOUT_DESIGN_CHANGE/);
});
