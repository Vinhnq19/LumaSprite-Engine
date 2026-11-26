import assert from 'node:assert/strict';
import { riseForDepth } from '../../core/geometry/projection.ts';
import type { Point } from '../../core/geometry/shapes.ts';
import { materialPiece } from '../../generators/environment/kit.ts';
import type { RuinModule,StyleProfile } from '../../specs/environment.ts';

type Wall=Extract<RuinModule,{kind:'wall'}>;
type Theme=StyleProfile['illumination']['day'];

export function bondedFracture(module:Wall,theme:Theme) {
  const {width:w,height:h,depth:d,fracture}=module;
  const rise=riseForDepth(d);
  const bottom=h+rise, support=h-4;
  const course=Math.max(5,Math.round(h/5));
  const high=rise+Math.round(h*.06);
  const firstJoint=high+course+1, secondJoint=firstJoint+course-2, fall=secondJoint+course;
  const shoulder=Math.round(w*.35), cleft=Math.round(w*.58), foot=Math.round(w*.86);

  // The cut travels across staggered beds, leaving a backed head and a low toe.
  const edge:Point[]=[
    [0,high+6],[4,high+3],[Math.round(w*.17),high+3],[Math.round(w*.21),high],
    [shoulder-3,high+1],[shoulder,high+4],[shoulder+4,firstJoint],
    [cleft-6,firstJoint+3],[cleft-3,secondJoint-1],[cleft,secondJoint+2],
    [cleft+5,secondJoint-1],[Math.round(w*.73),secondJoint+1],
    [foot-3,fall+1],[foot+1,fall+3],[w-3,fall+2],[w,fall+5],
  ];
  const front=edge.map(([x,y]):Point=>[fracture==='right'?x:w-x,Math.min(y,support-1)]);
  if(fracture==='left') front.reverse();
  const thickness=front.map(([x])=>{
    const distance=(fracture==='right'?x:w-x)/w;
    return distance<.36?d:distance<.68?Math.max(4,d-3):Math.max(3,Math.round(d*.57));
  });
  const rear=front.map(([x,y],i):Point=>[x+thickness[i],y-riseForDepth(thickness[i])]);
  const origin=[0,bottom] as const;
  const painted=materialPiece(theme)(w+d,bottom,origin,paint=>{
    const tail=front.at(-1)!, back=rear.at(-1)!;
    const lastDepth=thickness.at(-1)!;
    paint('stone',0,[tail,back,[w+lastDepth,bottom-riseForDepth(lastDepth)],[w,bottom]]);
    for(let i=0;i<front.length-1;i++){
      const [a,b]=front.slice(i,i+2), [c,e]=rear.slice(i,i+2);
      const steep=Math.abs(a[1]-b[1])>Math.abs(a[0]-b[0])+2;
      paint('stone',steep?0:2,[a,c,e,b]);
    }
    paint('stone',1,[...front,[w,bottom],[0,bottom]]);
  });
  assert.ok(front.every(([x,y],i)=>x>=0&&x<=w&&y<support&&rear[i][1]>=0&&rear[i][0]<=w+d));
  return {painted,geometry:{support,origin,course,front,rear,brokenBeds:[firstJoint,secondJoint,fall]}};
}
