import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rect,outline } from '../src/core/geometry/faces.ts';
import { fillPolygon } from '../src/core/geometry/shapes.ts';
import { composite,makeRaster,type Raster } from '../src/core/pixels/raster.ts';
import { pack } from '../src/core/palette/colors.ts';
import { costumePanel,inspectCostumeStance,maskPixels,requireCostumeStance,type Costume,type Leg } from '../src/experiments/costume-stance.ts';

const solid = pack('#ffffff');
function box(x:number,y:number,right:number,bottom:number) {
  const mask=makeRaster(64,64);
  fillPolygon(mask,rect(x,y,right,bottom),solid);
  return mask;
}
const legs = [
  {thigh:box(26,37,34,48),shin:box(28,45,33,55),boot:box(27,52,35,57),knee:[30,45],ankle:[30,53],ground:58},
  {thigh:box(38,37,45,47),shin:box(39,44,44,54),boot:box(38,51,47,56),knee:[41,44],ankle:[40,52],ground:57},
] satisfies [Leg,Leg];
const fill=(stance:readonly [Leg,Leg],clothes:Raster)=>outline(composite([...stance.flatMap(l=>[l.thigh,l.shin,l.boot]),clothes]),solid);

test('costume panels follow anatomy and keep the original visible separation threshold',()=>{
  const contours = new Set<string>();
  for(const kind of ['short-jacket','long-coat','tunic','a-line','cloak','apron'] satisfies Costume[]){
    const panel=costumePanel(kind,[34,37],legs.map(l=>l.knee),legs.map(l=>l.ankle),5);
    const qa=inspectCostumeStance(legs,panel.raster,fill(legs,panel.raster),[32,58]);
    assert.ok(maskPixels(panel.raster).length>=36);
    assert.ok(panel.hem<=49);
    requireCostumeStance(qa,2);
    contours.add(panel.raster.rgba.toString('hex'));
  }
  assert.equal(contours.size,6);
  const shorterRig=costumePanel('a-line',[34,37],[[30,43],[41,42]],[[30,51],[40,50]],5);
  assert.equal(shorterRig.hem,44);
});

test('garment occlusion and silhouette closure still block a structurally separated stance',()=>{
  const oldHem=box(27,36,44,54);
  const qa=inspectCostumeStance(legs,oldHem,fill(legs,oldHem),[32,58]);
  assert.ok(qa.anatomicalGapRows>=2);
  assert.ok(qa.visibleGapRows<2);
  assert.throws(()=>requireCostumeStance(qa,2),/STANCE_GAP/);
  assert.throws(()=>requireCostumeStance(
    inspectCostumeStance(legs,oldHem,fill(legs,box(29,33,38,42)),[32,58]),2),/STANCE_GAP/);
});

test('qa distinguishes merged legs and broken ground support from a garment failure',()=>{
  const overlap: [Leg,Leg]=[legs[0],{...legs[1],shin:box(31,43,44,54),boot:box(32,51,45,56)}];
  const none=makeRaster(64,64);
  assert.throws(()=>requireCostumeStance(inspectCostumeStance(overlap,none,fill(overlap,none),[32,58]),2),/STANCE_LEG_GEOMETRY/);
  const lifted:[Leg,Leg]=[{...legs[0],boot:box(27,51,35,55)},legs[1]];
  assert.throws(()=>requireCostumeStance(inspectCostumeStance(lifted,none,fill(lifted,none),[32,58]),2),/STANCE_SUPPORT/);
});
