import assert from 'node:assert/strict';
import { z } from 'zod';
import { projectBox } from '../../core/geometry/projection.ts';
import { rect } from '../../core/geometry/faces.ts';
import { fillPolygon } from '../../core/geometry/shapes.ts';
import { pack } from '../../core/palette/colors.ts';
import { blit,composite,silhouette } from '../../core/pixels/raster.ts';
import { renderOutlinedLayers } from '../../core/renderer/layers.ts';
import { decodePng } from '../../core/renderer/png.ts';
import { materialLegend,materialPiece } from '../../generators/environment/kit.ts';
import { artStyleProfileSchema } from '../../specs/environment.ts';
import { inspectStructure,pinnedFile } from './diagnostics.ts';

const hash=z.string().regex(/^[a-f0-9]{64}$/);
const relaySpec=z.strictObject({
  version:z.literal(1),kind:z.literal('field-signal-relay-box'),label:z.string().min(1).max(65),
  canvas:z.strictObject({w:z.literal(32),h:z.literal(32)}),seed:z.number().int().min(0).max(65535),
  sourceStyle:z.strictObject({file:z.literal('benchmarks/fixtures/e61r/style-profile.json'),sha256:hash}),
  body:z.strictObject({width:z.number().int().min(16).max(20),depth:z.number().int().min(5).max(8),height:z.number().int().min(12).max(16)}),
  placement:z.strictObject({file:z.literal('benchmarks/results/e62/packages/c1-courtyard-day/manifest.json'),sha256:hash,
    pivot:z.tuple([z.number().int().min(25).max(290),z.number().int().min(30).max(204)])}),brief:z.string().min(15).max(200),
});
type Relay=z.infer<typeof relaySpec>;
type Volume=Parameters<typeof projectBox>[0];
interface RelayStructure {
  box: Volume;
  skids: Volume[];
  shoulder: Volume[];
  window: ReturnType<typeof rect>;
  contact: readonly [number, number];
  glint: number;
}

function relayStructure(spec:Relay,variant:'a0'|'a1'):RelayStructure {
  const {width,depth,height}=spec.body, x=Math.floor((32-width-depth)/2), bottom=26, top=bottom-height;
  const one=(left:number,y:number,w:number,d:number,end:number,taper=0):Volume=>({left,top:y,width:w,depth:d,bottom:end,taper});
  const fit=variant==='a0'?{
    box:one(x,top+2,width,depth,bottom+2), skids:[], shoulder:[] as Volume[],
  }:{
    box:one(x+1,top+2,width-2,depth,bottom-1,1),
    skids:[one(x+1,bottom-3,5,depth-2,bottom+2),one(x+width-7,bottom-3,5,depth-2,bottom+2)],
    shoulder:[one(x+2,top,width-4,depth,top+3),one(x+6,top-3,Math.floor(width/2),depth-2,top+1)],
  };
  const box=fit.box;
  const center=box.left+Math.floor(box.width/2);
  return {...fit,window:rect(center-4,box.top+4,center+5,box.top+8),
    contact:[x+Math.floor(width/2),bottom+3] as const, glint:spec.seed%2};
}

export async function renderRelay(raw:unknown,variant:'a0'|'a1',look:'current'|'readout'='current'){
  const spec=relaySpec.parse(raw), structure=relayStructure(spec,variant);
  const style=artStyleProfileSchema.parse(JSON.parse((await pinnedFile(spec.sourceStyle)).toString('utf8')));
  const theme=style.illumination.day, factory=materialPiece(theme);
  const finish=(flat:boolean)=>factory(32,32,structure.contact,(paint,patch)=>{
    const refined=look==='readout'&&!flat;
    const block=(src:Volume,role:'wood'|'metal',housing=false)=>{
      const f=projectBox(src);
      const timber=refined&&housing;
      paint(timber?'wood':role,timber?1:0,f.side);
      paint(timber?'wood':role,timber?2:1,f.front);
      paint(role,2,f.top);
      if(flat)return;
      if(refined){
        if(role==='metal')patch('metal',3,f.top,.06,0,.76,.24);
        patch(timber?'wood':role,0,f.front,0,.83,1,1);
        if(timber){
          patch('wood',0,f.side,0,.65,1,1);
          patch('metal',1,f.front,0,0,.12,1);
          patch('metal',1,f.front,.88,0,1,1);
          patch('metal',0,f.side,0,0,.22,1);
          patch('metal',0,f.side,.84,0,1,1);
          patch('metal',2,f.front,0,0,1,.18);
        }
        return;
      }
      patch(role,3,f.top,.06,.05,.8,.21);
      patch(role,0,f.front,0,.83,1,1);
      patch(role,2,f.front,.07,.13,.16,.7);
    };
    structure.skids.forEach(s=>block(s,'wood'));
    block(structure.box,'metal',true);
    structure.shoulder.forEach(s=>block(s,'metal'));
    const f=projectBox(structure.box);
    const [l,t]=structure.window[0], [r,b]=structure.window[2];
    if(refined){
      // The recessed plane carries a continuous display and a dim terminal on the far side.
      paint('metal',0,structure.window);
      paint('amber',2,rect(l+1,t+1,r-1,b-1));
      paint('amber',3,rect(l+1,t+1,l+4,t+2));
      paint('amber',1,rect(r-3,t+1,r-1,b-1));
      paint('metal',1,rect(l,t-1,r,t));
    }else{
      patch('wood',0,f.side,.05,.72,1,.94);
      patch('wood',2,f.front,.03,.72,.97,.9);
      paint('metal',0,structure.window);
      paint('amber',flat?2:3,rect(l+2+structure.glint,t+1,l+3+structure.glint,b-1));
      paint('amber',2,rect(l+4,t+1,r-2,t+2));
      if(!flat){
        paint('metal',3,rect(l,t-1,r-2,t));
        paint('wood',3,rect(l-2,b+2,r-2,b+3));
        paint('metal',2,rect(l-2,t+1,l-1,t+2));
      }
    }
  });
  const ink=pack(theme.contour), flat=finish(true);
  const legal=new Set(Object.values(theme.surfaces).flat().concat(theme.contour).map(pack));
  const flatOutline=renderOutlinedLayers([flat.raster],[flat.raster],ink);
  const shape=inspectStructure(flatOutline.flat,legal);
  assert.equal(shape.stat.components.length,1,'Relay needs a connected grounded silhouette.');
  assert.equal(shape.stat.bounds?.bottom,structure.contact[1]-1,'Relay floats above contact line.');

  const native=finish(false);
  const outline=renderOutlinedLayers([native.raster],[flat.raster],ink);
  const material=renderOutlinedLayers([native.material],[flat.material],pack(materialLegend.contour)).final;
  const qa=inspectStructure(outline.final,legal,material);
  assert.deepEqual(qa.mask,shape.mask,'Material pass changed the approved shape for this variant.');
  assert.deepEqual(qa.mask,silhouette(material,pack('#ffffff')));
  const sceneFile=spec.placement.file.replace(/manifest.json$/,'');
  const manifest=JSON.parse((await pinnedFile(spec.placement)).toString('utf8'));
  const [scene,sceneMask]=await Promise.all(['scene.png','material-mask.png'].map(async file=>decodePng(await pinnedFile({file:sceneFile+file,sha256:manifest.files[file]}))));
  const inScene=composite([scene]), [x,y]=spec.placement.pivot;
  const at:[number,number]=[x-structure.contact[0],y-structure.contact[1]];
  fillPolygon(inScene,[[x-12,y-1],[x+9,y-1],[x+15,y+2],[x+8,y+4],[x-11,y+3]],pack(theme.surfaces.paving[0]));
  blit(inScene,outline.final,...at);
  for(let i=0;i<scene.rgba.length;i+=4)if(sceneMask.rgba.readUInt32BE(i)===pack(materialLegend.actor)){
    assert.equal(inScene.rgba.readUInt32BE(i),scene.rgba.readUInt32BE(i),'Relay occludes approved actor pixels.');
  }
  return {spec,structure,final:outline.final,flat:outline.flat,material,inScene,...qa};
}
