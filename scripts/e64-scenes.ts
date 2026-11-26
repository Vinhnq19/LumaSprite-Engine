import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rect } from '../src/core/geometry/faces.ts';
import { fillPolygon } from '../src/core/geometry/shapes.ts';
import { inkLuma,pack } from '../src/core/palette/colors.ts';
import { blit,composite,makeRaster,put,type Raster } from '../src/core/pixels/raster.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';
import { materialLegend } from '../src/generators/environment/kit.ts';
import { checkedFile,pixelEffectPackage } from '../src/generators/pixel-effects/export.ts';
import { artStyleProfileSchema } from '../src/specs/environment.ts';
import { sceneCompositionSpec } from '../src/specs/scene-composition.ts';

type Bundle=Awaited<ReturnType<typeof pixelEffectPackage>>;
type Ref={file:string;sha256:string};
type Light='day'|'night';
export const reviewScenes=[
  {id:'r1-signal-entrance',effect:'signal-activation',holdout:false},
  {id:'c1-courtyard',effect:'pickup-sparkle',holdout:false},
  {id:'r2-signal-clearing',effect:'signal-activation',holdout:true},
] as const;
type SceneId=typeof reviewScenes[number];
export async function gameplay(scene:SceneId,light:Light,src:Ref,bundles:Record<string,Bundle>){
  const {id,effect,holdout}=scene;
  const manifest=JSON.parse((await checkedFile(src)).toString('utf8'));
  assert.equal(manifest.id,id);
  assert.equal(manifest.light,light);
  const root=src.file.replace(/manifest.json$/,'');
  const source=(file:string)=>checkedFile({file:root+file,sha256:manifest.files[file]});
  const [baseBytes,materialBytes,specBytes,focusBytes]=await Promise.all(['scene.png','material-mask.png','composition-spec.json','focal-overlay.png'].map(source));
  const base=decodePng(baseBytes), roles=decodePng(materialBytes), focus=decodePng(focusBytes);
  const spec=sceneCompositionSpec.parse(JSON.parse(specBytes.toString('utf8')));
  const fx=bundles[effect], {frames,pivot}=fx.art;
  const interaction=bundles['interaction-icon'].art;
  const inventory=bundles['inventory-barrel'].art.frames[0].raster;
  const item=spec.props.find(p=>p.ref==='barrel');
  const signal=spec.ruins?.modules.find(m=>m.kind==='signal');
  assert.ok(effect==='signal-activation'?signal:item);
  const [x,y]:[number,number]=signal?
    [signal.at[0]+Math.floor(signal.width/2)+2,signal.at[1]-signal.height+7]:
    [item!.at[0],item!.at[1]-18];
  const {w,h}=base;
  assert.deepEqual([w,h],[320,208]);
  const offset=(u:number,v:number)=>4*(v*w+u);
  assert.equal(roles.rgba.readUInt32BE(offset(x,y)),pack(materialLegend[signal?'amber':'prop']),id+' geometry anchor no longer points to the fixture.');
  const style=artStyleProfileSchema.parse(JSON.parse((await readFile(fx.spec.style.file)).toString('utf8')));
  const theme=style.illumination[light];
  const peak=fx.frames.findIndex(f=>f.id==='peak');
  const emptyUi=makeRaster(w,h);
  const hud=[272,160,314,202] as const;
  if(item){
    fillPolygon(emptyUi,rect(...hud),pack(theme.contour));
    fillPolygon(emptyUi,rect(273,161,313,201),pack(theme.surfaces.metal[1]));
    fillPolygon(emptyUi,rect(275,163,311,199),pack(theme.surfaces.metal[0]));
  }
  const occupiedByActor=pack(materialLegend.actor);
  const strip=makeRaster(w*frames.length,h);
  let peakRaster:Raster|undefined,peakLight:Raster|undefined;
  const observations=frames.map(({raster,id:phase},index)=>{
    const ui=composite([emptyUi]), vfxLayer=makeRaster(w,h), reflection=makeRaster(w,h);
    if(item){
      const Icon=interaction.frames[index>=1&&index<=peak?1:0].raster;
      blit(ui,Icon,x-interaction.pivot[0],y-15-interaction.pivot[1]);
      if(index>=peak)blit(ui,inventory,277,165);
    }
    if(signal&&light==='night'&&index>=peak-1&&index<=peak+1){
      const v=signal.at[1], l=signal.at[0], r=l+signal.width;
      const bevel=theme.surfaces.amber[index===peak?2:1];
      fillPolygon(reflection,[[x-8,y-5],[x-2,y-7],[x+6,y-4],[x+8,y],[x-5,y+6],[x-9,y+1]],pack(bevel));
      fillPolygon(reflection,[[l+5,v-5],[r-3,v-4],[r+2,v+2],[r-9,v+6],[l+2,v+4]],pack(theme.surfaces.amber[1]));
      const surfaces=new Set(['metal','stone','paving','wood','amber'].map(r=>pack(materialLegend[r as keyof typeof materialLegend])));
      for(let i=0;i<reflection.rgba.length;i+=4)if(reflection.rgba[i+3]&&
        (!surfaces.has(roles.rgba.readUInt32BE(i))||inkLuma(reflection.rgba.readUInt32BE(i))<=inkLuma(base.rgba.readUInt32BE(i))))reflection.rgba.writeUInt32BE(0,i);
    }
    blit(vfxLayer,raster,x-pivot[0],y-pivot[1]);
    const paint=composite([base,reflection,vfxLayer,ui]);
    const edge:number[]=[];
    let reflectionPixels=0,changed=0,vfxPixels=0,actorPixels=0;
    for(let i=0;i<paint.rgba.length;i+=4){
      const before=base.rgba.readUInt32BE(i), after=paint.rgba.readUInt32BE(i);
      if(roles.rgba.readUInt32BE(i)===occupiedByActor){assert.equal(before,after,id+' overlay covers actor RGBA at frame '+index);actorPixels++;}
      if(before!==after)changed++;
      if(reflection.rgba[i+3])reflectionPixels++;
      if(vfxLayer.rgba[i+3]){
        vfxPixels++;
        edge.push(Math.abs(inkLuma(vfxLayer.rgba.readUInt32BE(i))-inkLuma(before)));
      }
    }
    edge.sort((a,b)=>a-b);
    if(index===peak){peakRaster=paint;peakLight=reflection;}
    if(phase==='clear'){
      assert.equal(vfxPixels,0);
      assert.equal(reflectionPixels,0);
      if(signal)assert.deepEqual(paint,base,'Signal scene must return to exact baseline after dissipation.');
    }
    blit(strip,paint,index*w,0);
    return {phase,vfxPixels,reflectionPixels,changed,actorPixels,contrastP10:edge[Math.floor(edge.length/10)]??null,
      contrastMedian:edge[Math.floor(edge.length/2)]??null,contrastMax:edge.at(-1)??null};
  });
  assert.ok(observations[peak].contrastMax!>=80,'Peak has no readable bright core.');
  if(signal&&light==='night')assert.ok(observations[peak].reflectionPixels>0,'Night reflection failed to reach the platform.');
  const mark=(u:number,v:number,color:string)=>put(focus,u,v,pack(color));
  for(let d=-5;d<=5;d++){
    mark(x+d,y-5,'#ffd887');mark(x+d,y+5,'#ffd887');mark(x-5,y+d,'#ffd887');mark(x+5,y+d,'#ffd887');
  }
  if(item){
    for(let u=hud[0];u<hud[2];u++){mark(u,hud[1],'#a5d9bc');mark(u,hud[3]-1,'#a5d9bc');}
    for(let v=hud[1];v<hud[3];v++){mark(hud[0],v,'#a5d9bc');mark(hud[2]-1,v,'#a5d9bc');}
  }
  return {base,baseBytes,strip,peak:peakRaster!,reflection:peakLight!,focus,
    qa:{id,light,effect,holdout,anchor:[x,y],source:src,basePngSha256:sha256(baseBytes),
      actorPreservation:'EXACT_RGBA_ALL_FRAMES',reflection:'MASKED_SCENE_PASS',frames:observations,peak}};
}
