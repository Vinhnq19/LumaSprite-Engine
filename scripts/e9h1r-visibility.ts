import assert from 'node:assert/strict';
import type { Point } from '../src/core/geometry/shapes.ts';
import { paintHandTool, planHandTool } from '../src/experiments/character-equipment.ts';
import { contains, type CharacterRender, type PaintedPart } from '../src/experiments/hybrid-character-kit.ts';
import { maskPixels } from '../src/experiments/costume-stance.ts';

type Device = Parameters<typeof paintHandTool>[1];
type Plane = ReturnType<typeof planHandTool>[number];
type Layout = {id:string; advance:number; lift:number};
export type VisibilityRule = {part:string; minimumPixels:number; minimumRows:number; minimumFraction:number};

export function inspectVisibility(parts: CharacterRender['layers'], rule: VisibilityRule) {
  const start=parts.findIndex(p=>p.id===rule.part);
  assert.ok(start>=0,rule.part);
  const pixels=maskPixels(parts[start].mask);
  const higher=parts.slice(start+1).reverse();
  const obscured:Record<string,number>={};
  const rows=new Set<number>();
  let visible=0;
  for (const i of pixels) {
    const occluder=higher.find(p=>contains(p.mask,i));
    if(occluder) obscured[occluder.id]=(obscured[occluder.id]??0)+1;
    else { visible++; rows.add(Math.floor(i/64)); }
  }
  let consecutive=0,longest=0,last=-2;
  for(const row of [...rows].sort((a,b)=>a-b)) {
    consecutive=row===last+1?consecutive+1:1;
    longest=Math.max(longest,consecutive);
    last=row;
  }
  return {raw:pixels.length,visible,obscured,rows:[...rows],longest,
    pass:visible>=rule.minimumPixels&&longest>=rule.minimumRows&&visible/pixels.length>=rule.minimumFraction};
}

function compactCase(stock:Plane[], [x,y]:Point, layout:Layout) {
  if(layout.lift===0&&layout.advance===0) return stock;
  const [bar,leftBail,rightBail,...body]=stock;
  const translated=body.map(p=>({...p,points:p.points.map(([u,v]):Point=>[u+layout.advance,v-layout.lift])}));
  const slantedBail=(plane:Plane,left:number):Plane=>({...plane,points:[
    [left,y],[left+1,y],[left+1+layout.advance,y+9-layout.lift],[left+layout.advance,y+9-layout.lift],
  ]});
  return [bar,slantedBail(leftBail,x-3),slantedBail(rightBail,x+3),...translated];
}

export function selectCaseLayout(base:CharacterRender,device:Device,layouts:Layout[],rule:VisibilityRule) {
  const index=base.layers.findIndex(p=>p.id==='far-tool');
  assert.ok(index>=0);
  const far=base.props.find(p=>p.hand==='far-hand')!;
  const [x,y]=far.socket;
  const stock=planHandTool('toolbox',far.socket,[1,0]);
  const attempts=[];
  for(const layout of layouts) {
    assert.ok(Number.isInteger(layout.advance)&&Number.isInteger(layout.lift),layout.id);
    const planes=compactCase(stock,far.socket,layout);
    const margin=planes.every(p=>p.points.every(([u,v])=>u>=2&&u<62&&v>=2&&v<62));
    if(!margin) {attempts.push({id:layout.id,pass:false,reason:'CASE_RAW_BOUNDS'});continue;}
    const paint=paintHandTool(planes,device,far.socket,false).raster;
    assert.ok(contains(paint,y*64+x),'CASE_GRIP_SOCKET');
    const tool:PaintedPart={...base.layers[index],mask:paint,paint};
    const layers=base.layers.map((p,i)=>i===index?tool:p);
    const visibility=inspectVisibility(layers,rule);
    attempts.push({id:layout.id,...visibility});
    if(visibility.pass) {
      // The bail still crosses the palm. Only lower case geometry moves.
      return {selected:layout.id,layout,attempts,visibility,part:tool,layers,
        props:base.props.map(p=>p===far?{...p,masks:[paint]}:p)};
    }
  }
  return {selected:null,layout:null,attempts,visibility:null,part:null,layers:base.layers,props:base.props};
}
