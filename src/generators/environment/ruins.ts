import assert from 'node:assert/strict';
import { rect } from '../../core/geometry/faces.ts';
import { riseForDepth } from '../../core/geometry/projection.ts';
import { fillPolygon,type Point } from '../../core/geometry/shapes.ts';
import { pack } from '../../core/palette/colors.ts';
import { makeRaster } from '../../core/pixels/raster.ts';
import type { EnvironmentLight,RuinModule,RuinSite,StyleProfile } from '../../specs/environment.ts';
import { materialLegend,materialPiece } from './kit.ts';
import { covered } from './refinement.ts';

export function buildRuins(site: RuinSite,style:StyleProfile,light:EnvironmentLight,seed:number,flat:boolean) {
  const theme=style.illumination[light], piece=materialPiece(theme);
  const modules=site.modules.map((module)=>{
    const {width:w,height:h,depth:d}=module, r=riseForDepth(d);
    if(module.kind==='platform')return {module, piece:piece(w+d,r+12,[0,r+12],paint=>{
      const top:Point[]=[[0,r+8],[d,d%2],[w+d,0],[w,r+8]];
      paint('paving',0,[[0,r+8],[w,r+8],[w+d,0],[w+d,3],[w,r+12],[0,r+12]]);
      paint('paving',2,top);
      if(flat)return;
      paint('paving',1,[[0,r+8],[Math.floor(w*.31),r+3],[Math.floor(w*.43),r+4],[Math.floor(w*.35),r+8]]);
      paint('paving',1,[[Math.floor(w*.43),r+4],[Math.floor(w*.47),r+4],[Math.floor(w*.55),0],[Math.floor(w*.57),0]]);
      paint('stone',1,[[Math.floor(w*.70),r+4],[Math.floor(w*.84),r+4],[Math.floor(w*.89),r+1],[Math.floor(w*.82),r+2]]);
      paint('paving',3,[[5,r+6],[15,r+4],[22,r+4],[18,r+5],[6,r+7]]);
      paint('paving',3,[[Math.floor(w*.48),r+6],[Math.floor(w*.61),r+6],[Math.floor(w*.64),r+7],[Math.floor(w*.47),r+7]]);
      paint('moss',0,[[w-13,r+7],[w-7,r+4],[w-3,r+5],[w-7,r+8],[w-13,r+9]]);
      paint('moss',1,[[2,r+8],[7,r+5],[11,r+5],[9,r+7],[5,r+7],[5,r+9],[2,r+9]]);
    })};
    if(module.kind==='signal')return {module, piece:piece(w+d,h+r,[0,h+r],paint=>{
      const m=Math.floor(w/2)+2, y=h+r;
      paint('stone',0,[[0,y-3],[5,y-7],[w-3,y-7],[w+3,y-11],[w+4,y-4],[w,y],[0,y]]);
      paint('stone',1,rect(2,y-6,w-3,y-2));
      paint('stone',2,[[4,y-6],[8,y-9],[w-1,y-9],[w-4,y-6]]);
      paint('stone',0,[[m-6,y-8],[m-6,y-20],[m-2,y-22],[m+7,y-21],[m+7,y-10],[m+4,y-7]]);
      paint('stone',1,[[m-5,y-8],[m-5,y-20],[m+4,y-20],[m+3,y-8]]);
      paint('wood',0,rect(m-2,r+9,m+3,y-17));
      paint('metal',0,[[m-8,r+3],[m-2,r],[m+4,r],[m+10,r+4],[m+10,r+11],[m+3,r+16],[m-3,r+16],[m-9,r+11]]);
      paint('metal',1,[[m-7,r+4],[m-2,r+2],[m+4,r+2],[m+7,r+5],[m+7,r+10],[m+2,r+13],[m-3,r+12],[m-7,r+9]]);
      if(flat)return;
      paint('metal',2,[[m-6,r+4],[m+1,r+2],[m+3,r+3],[m-5,r+7]]);
      paint('amber',0,[[m,r+3],[m+4,r+7],[m+1,r+12],[m-4,r+8]]);
      paint('amber',light==='night'&&module.lit?3:2,[[m,r+4],[m+2,r+7],[m,r+10],[m-2,r+7]]);
      paint('moss',0,[[5,y-3],[8,y-5],[12,y-4],[10,y-3],[8,y-2],[5,y-2]]);
    })};

    const outline=stoneCrest(module);
    const base=piece(w+d,h+r,[0,h+r],paint=>{
      const edge=outline.map(([x,y])=>[x,y+r] as Point);
      const bottom=h+r;
      const last=edge.at(-1)!;
      paint('stone',0,[last,[w+d,last[1]-r],[w+d,bottom-r],[w,bottom]]);
      for(let i=1;i<edge.length;i++){
        const [ax,ay]=edge[i-1],[bx,by]=edge[i];
        paint('stone',2,[edge[i-1],[ax+d,ay-r],[bx+d,by-r],edge[i]]);
      }
      paint('stone',1,[...edge,[w,bottom],[0,bottom]]);
      if(flat)return;
      for(const step of [9,21,33]) {
        if(bottom-step<last[1]+2)continue;
        paint('stone',1,[[w+1,bottom-step],[w+d-2,bottom-step-r+1],[w+d-2,bottom-step-r+3],[w+1,bottom-step+3]]);
        paint('contour',0,[[w+2,bottom-step+3],[w+d,bottom-step-r+3],[w+d,bottom-step-r+4],[w+2,bottom-step+4]]);
      }
      for(let i=1;i<edge.length;i++){
        const [ax,ay]=edge[i-1],[bx,by]=edge[i];
        if(ax===bx || ay!==by || bx-ax<3)continue;
        paint('stone',3,[[ax,ay],[ax+d-2,ay-r+1],[bx+d-3,by-r+1],[bx-2,by-1]]);
        paint('stone',2,rect(ax,ay,bx,ay+2));
      }
      paint('stone',2,[[0,bottom-5],[w-4,bottom-7],[w,bottom-7],[w,bottom-4],[0,bottom-3]]);
      paint('stone',0,rect(0,bottom-2,w,bottom));
      if(module.kind==='column'){
        paint('stone',0,rect(w-3,r+5,w-1,bottom-5));
        paint('stone',2,rect(2,r+5,4,bottom-6));
        paint('stone',0,rect(4,bottom-8,w,bottom-7));
        paint('stone',3,rect(1,bottom-5,8,bottom-4));
      }
    });
    const front=makeRaster(base.raster.w,base.raster.h);
    fillPolygon(front,[...outline.map(([x,y])=>[x,y+r] as Point),[w,h+r],[0,h+r]],pack('#ffffff'));
    if(!flat){
      const detail=piece(base.raster.w,base.raster.h,base.origin,paint=>{
        const stagger=seed%7;
        if(module.kind!=='column'){
          for(let row=0;row<5;row++){
            const y=h+r-6-row*10;
            if(y<r+3)continue;
            const left=2+(stagger+row*6)%11, middle=Math.trunc(w*.55)+(stagger+row*5)%7;
            paint('stone',2,[[left,y-6],[Math.min(w,left+15),y-6],[Math.min(w,left+17),y-4],[left,y-4]]);
            paint('stone',0,rect(left,y,Math.min(w,left+17),y+1));
            paint('stone',0,rect(left,y-3,left+1,y));
            paint('stone',0,rect(middle,y+2,Math.min(w,middle+12),y+3));
            paint('stone',2,rect(middle+2,y+3,Math.min(w,middle+9),y+4));
          }
        }
        if(module.kind==='column'||module.kind==='wall'){
          for(let i=0;i<module.moss;i++){
            const x=i?Math.floor(w*.64):2, y=i?h+r-17:h+r-5;
            paint('moss',0,[[x-1,y],[x+4,y-3],[x+11,y-3],[x+9,y-1],[x+6,y],[x+4,y+3],[x,y+3]]);
            paint('moss',1,[[x,y],[x+4,y-2],[x+8,y-2],[x+6,y],[x+3,y],[x+2,y+1],[x,y+1]]);
          }
        }
        if(module.kind==='gateway'){
          const l=(w-module.opening)/2, right=w-l, m=w/2, top=h+r-60;
          paint('stone',3,[[m-5,top-8],[m+5,top-8],[m+3,top+1],[m-3,top+1]]);
          paint('stone',2,[[l-2,top+35],[l-4,top+21],[l+2,top+10],[l+8,top+5],[l+12,top+4],[l+6,top+15],[l+2,top+30],[l+2,top+39]]);
          paint('stone',0,[[right-5,top+10],[right,top+18],[right+3,top+26],[right+2,top+44],[right-1,top+43],[right-1,top+25]]);
          paint('stone',2,rect(l-8,top+31,l-2,top+37));
          paint('stone',2,rect(l-9,top+45,l-3,top+51));
          for(const [x,y,dx,dy] of [[m-8,top+2,-3,-5],[m+7,top+2,3,-5],[l+4,top+13,-5,-5],[right-4,top+13,5,-5]]){
            paint('stone',0,[[x,y],[x+dx,y+dy],[x+dx+1,y+dy],[x+1,y]]);
          }
          paint('stone',3,rect(l-8,top+31,l-4,top+32));
          paint('stone',2,rect(right+2,top+37,right+7,top+39));
          paint('moss',0,[[l-6,top+54],[l-2,top+53],[l,top+54],[l-2,top+56],[l-6,top+56]]);
        }
      });
      for(let i=0;i<base.raster.rgba.length;i+=4)if(front.rgba[i+3]&&detail.raster.rgba[i+3]){
        base.raster.rgba.writeUInt32BE(detail.raster.rgba.readUInt32BE(i),i);
        base.material.rgba.writeUInt32BE(detail.material.rgba.readUInt32BE(i),i);
      }
    }
    if(module.kind==='gateway'){
      const l=(w-module.opening)/2, right=w-l, m=w/2, y=h+r-60;
      const cut=makeRaster(base.raster.w,base.raster.h);
      const arch:Point[]=module.crown==='round'?
        [[l,h+r],[l,y+20],[l+2,y+12],[l+7,y+6],[m-6,y+1],[m,y],[m+6,y+1],[right-7,y+6],[right-2,y+12],[right,y+20],[right,h+r]]:
        [[l,h+r],[l,y+18],[l+3,y+18],[l+3,y+10],[l+8,y+10],[l+8,y+4],[m-6,y+4],[m-6,y],
          [m+6,y],[m+6,y+4],[right-8,y+4],[right-8,y+10],[right-3,y+10],[right-3,y+18],[right,y+18],[right,h+r]];
      fillPolygon(cut,arch,pack('#ffffff'));
      for(let v=0;v<cut.h;v++)for(let u=0;u<cut.w;u++)if(covered(cut,u,v)){
        const i=(v*cut.w+u)*4;
        const reveal=v<h+r-4 && u<l+6 && !covered(cut,u-3,v+1);
        base.raster.rgba.writeUInt32BE(reveal?pack(theme.surfaces.stone[0]):0,i);
        base.material.rgba.writeUInt32BE(reveal?pack(materialLegend.stone):0,i);
      }
      for(let y=h+r-60;y<h+r;y++)assert.ok(!covered(base.raster,m,y),'Gateway center has no clear native-height silhouette.');
    }
    return {module,piece:base};
  });
  return {modules, gateway:modules.find(x=>x.module.kind==='gateway')!.module as Extract<RuinModule,{kind:'gateway'}>};
}

function stoneCrest(module:Extract<RuinModule,{kind:'wall'|'gateway'|'column'}>):Point[]{
  const {width:w,height:h}=module;
  if(module.kind==='gateway'){
    const m=w/2;
    return [[0,Math.floor(h*.42)],[4,Math.floor(h*.42)],[4,22],[10,22],[10,10],[m-10,10],[m-10,4],[m-4,4],[m-4,0],
      [m+6,0],[m+6,3],[m+12,3],[m+12,8],[w-9,8],[w-9,17],[w-4,17],[w-4,25],[w,25]];
  }
  if(module.kind==='column')return [[0,7],[2,7],[2,3],[6,3],[6,0],[10,0],[10,3],[w-1,5],[w,8]];
  const a=Math.floor(w*.24), b=Math.floor(w*.46), c=Math.floor(w*.68);
  const steps:Point[]=[[0,5],[4,5],[4,0],[a,0],[a,4],[b,4],[b,Math.floor(h*.27)],[c,Math.floor(h*.27)],
    [c,Math.floor(h*.54)],[w-5,Math.floor(h*.54)],[w-5,Math.floor(h*.68)],[w,Math.floor(h*.68)]];
  return module.fracture==='right'?steps:steps.map(([x,y])=>[w-x,y] as Point).reverse();
}

export function connectedPixels(raster:ReturnType<typeof makeRaster>){
  const visited=new Uint8Array(raster.w*raster.h);
  const queue:number[]=[];
  let count=0;
  for(let i=0;i<visited.length;i++)if(raster.rgba[i*4+3]){
    count++;
    if(!queue.length){queue.push(i);visited[i]=1;}
  }
  for(let i=0;i<queue.length;i++){
    const at=queue[i], x=at%raster.w,y=Math.floor(at/raster.w);
    for(const [u,v] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
      const next=v*raster.w+u;
      if(!covered(raster,u,v)||visited[next])continue;
      visited[next]=1;
      queue.push(next);
    }
  }
  assert.ok(count>0 && count===queue.length,'Structural module has disconnected pixels: '+count+'/'+queue.length);
  assert.ok(queue.some(i=>Math.floor(i/raster.w)===raster.h-1),'Module lacks a front-face ground contact.');
  return count;
}

export function canopyGround(ground:ReturnType<typeof makeRaster>,materials:ReturnType<typeof makeRaster>,areas:readonly Point[][],
  theme:StyleProfile['illumination']['day'],seed:number){
  const boundary=makeRaster(ground.w,ground.h), shadow=makeRaster(ground.w,ground.h);
  for(const area of areas)fillPolygon(boundary,area,pack('#ffffff'));
  // Large leaf masses stay along the clearing edge and leave the ground near the gate open.
  for(let x=-10,i=0;x<ground.w;x+=31,i++){
    const shift=(seed+i*13)%15, base=28+(i%3)*5+shift;
    const leaves:Point[]=[[x,0],[x+49,0],[x+46,base-17],[x+40,base-13],
      [x+37,base-5],[x+27,base-5],[x+25,base],[x+12,base],[x+12,base-6],[x+4,base-6],[x+4,base-15],[x,base-15]];
    fillPolygon(shadow,leaves.map(([u,v])=>[Math.max(0,Math.min(ground.w,u)),v]),pack('#ffffff'));
  }
  const grass=pack(materialLegend.grass), ink=pack(theme.grass[0]);
  for(let i=0;i<shadow.rgba.length;i+=4)if(shadow.rgba[i+3]&&boundary.rgba[i+3]&&materials.rgba.readUInt32BE(i)===grass){
    ground.rgba.writeUInt32BE(ink,i);
  }
}
