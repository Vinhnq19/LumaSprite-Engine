import { rect } from '../../core/geometry/faces.ts';
import { cluster,fillPolygon,type Point } from '../../core/geometry/shapes.ts';
import { pack } from '../../core/palette/colors.ts';
import { makeRaster } from '../../core/pixels/raster.ts';
import type { StyleProfile } from '../../specs/environment.ts';
import type { VFXSpec } from '../../specs/pixel-effects.ts';

type Tone=0|1|2|3|4;
export function renderVfx(spec:VFXSpec,style:StyleProfile){
  const [w,h]=spec.size, signal=spec.kind==='signal-activation';
  const pivot=signal?[24,30] as const:[16,20] as const;
  const ramp=signal?[...style.illumination.day.surfaces.amber,'#fff5d4']:['#254856','#3e7881','#82c4af','#b4f0cd','#ebffe5'];
  const frames=spec.frames.map(({phase,durationMs},i)=>{
    const raster=makeRaster(w,h);
    const [x,y]=pivot;
    const stamp=(tone:Tone,points:readonly Point[])=>fillPolygon(raster,points.map(([u,v])=>[x+u,y+v]),pack(ramp[tone]));
    const diamond=(tone:Tone,u:number,v:number,r:number)=>cluster(raster,pack(ramp[tone]),
      Array.from({length:2*r+1},(_,j)=>[y+v+j-r,x+u-r+Math.abs(j-r),x+u+r-Math.abs(j-r)]));
    const bar=(tone:Tone,l:number,t:number,r:number,b:number)=>stamp(tone,rect(l,t,r,b));
    if(phase==='clear')return {id:phase,raster,durationMs};
    if(signal){
      const radius=[7,11,14,17,20,21][i],rise=[0,0,-2,-5,-6,-6][i];
      const arcTone:Tone=([1,1,2,3,2,1] as const)[i];
      const arc=(tone:Tone,side:number,rows:readonly (readonly [number,number,number])[])=>cluster(raster,pack(ramp[tone]),
        rows.map(([v,a,b])=>[y+rise+v,x+Math.min(side*(radius+a),side*(radius+b)),x+Math.max(side*(radius+a),side*(radius+b))]));
      for(const side of [-1,1]){
        arc(arcTone,side,[[-3,-7,-5],[-2,-5,-3],[-1,-3,-2],[0,-2,-1],[1,-1,0]]);
        if(i>=2&&i<=4)arc(i===3?2:1,side,[[3,-3,-1],[4,-5,-3],[5,-8,-5]]);
      }
      if(i<=4){
        diamond(i===3?3:2,0,-1,i===3?4:i===2?3:2);
        if(i===3){
          stamp(3,[[0,-23],[2,-11],[4,-4],[3,1],[-3,1],[-3,-4],[-1,-11]]);
          bar(4,-1,-12,1,-1);
          diamond(4,0,-1,2);
          diamond(3,-10,-12,1);
          diamond(3,10,-12,1);
          stamp(2,[[0,5],[2,4],[11,6],[12,8],[5,7],[1,7],[-2,6]]);
        }else{
          if(i>=1&&i<=2)bar(i===2?3:2,0,i===2?-10:-6,1,0);
          if(i===2)diamond(2,-8,-6,1);
          if(i===4){
            bar(2,0,-18,1,-15);
            diamond(2,-12,-11,1);
            diamond(2,12,-11,1);
          }
          diamond(i===4?2:3,0,-1,1);
        }
      }else{
        bar(1,-1,-2,1,-1);
        bar(1,0,-19,1,-17);
      }
    }else{
      if(i<4){
        const radius=[1,2,3,1][i], height=[0,-2,-4,-6][i];
        diamond(i===2?3:2,0,height,radius);
        if(i===1){bar(3,0,-6,1,-2);diamond(2,-6,-4,1);}
        if(i===2){
          bar(3,0,-11,1,-4);bar(3,-5,-4,5,-3);
          diamond(4,0,-4,1);
          diamond(2,-8,-6,1);diamond(3,7,-9,1);
          bar(2,4,0,6,1);
        }
        if(i===3){diamond(2,-9,-8,1);diamond(2,8,-11,1);bar(2,1,-10,2,-8);}
      }else{
        bar(1,-9,-11,-8,-9);
        bar(1,9,-14,10,-12);
        bar(2,0,-8,1,-6);
      }
    }
    return {id:phase,raster,durationMs};
  });
  return {frames,ramp,pivot};
}

export function sampleEffect(frames:readonly {durationMs:number}[],elapsedMs:number,loop:VFXSpec['loop']){
  const total=frames.reduce((ms,frame)=>ms+frame.durationMs,0);
  if(elapsedMs>=total&&loop==='once')return null;
  let time=Math.max(0,elapsedMs)%total;
  for(const [i,frame] of frames.entries()){
    if(time<frame.durationMs)return i;
    time-=frame.durationMs;
  }
  throw Error('Invalid effect timeline.');
}
