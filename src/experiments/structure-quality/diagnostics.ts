import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inkLuma,pack,unpack } from '../../core/palette/colors.ts';
import { composite,makeRaster,silhouette,type Raster } from '../../core/pixels/raster.ts';
import { covered } from '../../generators/environment/refinement.ts';
import { sha256 } from '../../quality/raster.ts';

export async function pinnedFile(ref:{file:string;sha256:string}){
  const data=await readFile(ref.file);
  assert.equal(sha256(data),ref.sha256,ref.file+' differs from locked provenance.');
  return data;
}

export function inspectStructure(r:Raster,legal?:ReadonlySet<number>,material?:Raster){
  const {w,h,rgba}=r, seen=new Uint8Array(w*h), colors=new Set<number>(),components:number[]=[];
  const materialGaps=new Map<string,number[]>();
  let coverage=0,outline=0,isolatedOutline=0,detail=0,comparable=0, left=w, top=h,right=-1,bottom=-1;
  const edge=makeRaster(w,h), mask=silhouette(r,pack('#ffffff'));
  for(let i=0;i<w*h;i++){
    const ink=rgba.readUInt32BE(i*4), x=i%w,y=Math.floor(i/w);
    assert.ok(ink===0 || ((ink&255)===255&&(!legal||legal.has(ink))),'Invalid alpha or palette membership.');
    if(!ink)continue;
    coverage++;colors.add(ink);
    left=Math.min(x,left);right=Math.max(x,right);top=Math.min(y,top);bottom=Math.max(y,bottom);
    const touches=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([u,v])=>covered(r,u,v));
    if(touches.length<4){
      outline++;
      if(!touches.length)isolatedOutline++;
      edge.rgba.writeUInt32BE(pack('#f3c890'),i*4);
    }
    for(const [u,v] of [[x+1,y],[x,y+1]])if(covered(r,u,v)){
      const at=(v*w+u)*4;
      const gap=Math.abs(inkLuma(ink)-inkLuma(rgba.readUInt32BE(at)));
      if(material){
        const role=material.rgba.readUInt32BE(i*4),neighbor=material.rgba.readUInt32BE(at);
        if(role!==neighbor){
          if(role&&neighbor){
            const key=[unpack(role),unpack(neighbor)].sort().join('/');
            const values=materialGaps.get(key)??[];
            values.push(gap);materialGaps.set(key,values);
          }
          continue;
        }
      }
      comparable++;
      if(gap>=6)detail++;
    }
    if(seen[i])continue;
    const spread=[i];
    seen[i]=1;
    for(const at of spread){
      const u=at%w,v=Math.floor(at/w);
      for(const [px,py] of [[u-1,v],[u+1,v],[u,v-1],[u,v+1]]){
        const j=py*w+px;
        if(covered(r,px,py)&&!seen[j]){spread.push(j);seen[j]=1;}
      }
    }
    components.push(spread.length);
  }
  return { mask,edge,stat:{coverage,outline,isolatedOutline,components:components.sort((a,b)=>b-a),
    bounds:coverage?{left,top,right,bottom}:null,detail:{edges:detail,samples:comparable,per100:comparable?Number((100*detail/comparable).toFixed(1)):null},
    materialBoundaries:[...materialGaps].sort(([a],[b])=>a.localeCompare(b)).map(([roles,values])=>{
      values.sort((a,b)=>a-b);
      return {roles,samples:values.length,p10:values[Math.floor(values.length/10)],median:values[Math.floor(values.length/2)]};
    }),used:[...colors].map(unpack).sort(),rgbaSha256:sha256(rgba),alphaSha256:sha256(mask.rgba)}};
}

export function compareCoverage(a:Raster,b:Raster){
  assert.deepEqual([a.w,a.h],[b.w,b.h]);
  let added=0,removed=0,shared=0;
  for(let i=3;i<a.rgba.length;i+=4){
    if(a.rgba[i]&&b.rgba[i])shared++;
    else if(a.rgba[i])removed++;
    else if(b.rgba[i])added++;
  }
  return {added,removed,shared};
}

export const outlineOn=(base:Raster,edge:Raster)=>composite([base,edge]);
