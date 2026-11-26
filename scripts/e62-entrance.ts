import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Point } from '../src/core/geometry/shapes.ts';
import { blit,makeRaster } from '../src/core/pixels/raster.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { unpackAnimationStrip } from '../src/generators/character/animation-export.ts';
import type { buildWalkAnimation } from '../src/generators/character/walk.ts';
import { anchoredScene,routeFits,type Composition } from '../src/generators/environment/composition.ts';
import type { renderComposition } from '../src/generators/environment/composition.ts';
import { sha256 } from '../src/quality/raster.ts';
import type { EnvironmentLight } from '../src/specs/environment.ts';

type Timing = ReturnType<typeof buildWalkAnimation>['timing'];
export const actors=['surveyor','courier'] as const;
type Actor=typeof actors[number];
const json=async(path: string)=>JSON.parse((await readFile(path)).toString('utf8'));
export async function readLockedWalk(actor: Actor) {
  const directory='benchmarks/results/e54/packages/'+actor+'/';
  const parent=await json(directory+'manifest.json');
  const manifestBytes=await readFile(directory+'walk/manifest.json');
  assert.equal(sha256(manifestBytes),parent.files['walk/manifest.json']);
  const pinned=JSON.parse(manifestBytes.toString('utf8'));
  const bytes=async(path: string)=>{
    const raw=await readFile(directory+'walk/'+path);
    assert.equal(sha256(raw),pinned.files[path],path+' differs from the locked E5.4 clip.');
    return raw;
  };
  const timing=JSON.parse((await bytes('timing.json')).toString('utf8')) as Timing;
  const frames=unpackAnimationStrip(decodePng(await bytes('spritesheet.png')),timing);
  assert.equal(timing.rootMotion.mode,'frame-stepped');
  assert.equal(timing.frames.length,8);
  assert.equal(timing.frames.reduce((ms,f)=>ms+f.durationMs,0),timing.totalDurationMs);
  return { timing,frames,source:directory+'walk/',hashes:pinned.files };
}

export function entranceTraversal(input: Composition,light:EnvironmentLight,base:ReturnType<typeof renderComposition>,actor:Actor,walk:Awaited<ReturnType<typeof readLockedWalk>>) {
  const { timing,frames,source,hashes }=walk;
  const actorAsset=input.environment.assets.get(actor)!;
  assert.deepEqual(timing.pivot,actorAsset.ref.pivot);
  const [x,y]=base.scene.metadata.portal.at;
  const {w,h}=base.scene.raster;
  const motion=timing.rootMotion;
  const offset=actor==='surveyor'?2:1;
  const startX=x-offset-motion.frames[4].rootX-motion.cyclePx;
  // The front-facing doorway needs a short projection into depth. The clip itself supplies only +X.
  const depth=[6,4,2,0,-2,-4,-6,-6,-6];
  const steps=Array.from({length:17},(_,index)=>{
    const frame=index%frames.length;
    const rootX=motion.frames[frame].rootX+Math.floor(index/frames.length)*motion.cyclePx;
    const depthOffset=index<8?depth[0]:depth[index-8];
    const at:Point=[startX+rootX,y+depthOffset];
    const stage=index<8?'approach':depthOffset>=0?'landing':depthOffset>=-4?'threshold':'exit';
    return { frame, stage, phase:timing.frames[frame].phase, rootX, at, ms:timing.frames[frame].durationMs };
  });
  const tested=routeFits(base.walkable,steps.map(s=>s.at),actorAsset.scale!.bodyHalfWidth,actor+' continuous entrance');
  assert.deepEqual([...new Set(steps.map(s=>s.stage))],['approach','landing','threshold','exit']);
  assert.equal(steps.at(-1)!.at[1],y-6);
  const columns=5, sheet=makeRaster(w*columns,h*Math.ceil(steps.length/columns));
  let maxForwardSlip=0, maxScreenDepthSlip=0, plantedPairs=0;
  const evidence=steps.map((step,i)=>{
    const f=motion.frames[step.frame], raster=frames[step.frame], [px,py]=timing.pivot;
    const contacts=(['near','far'] as const).map(side=>{
      const foot=f.feet[side];
      const at:Point=[step.at[0]+foot.canvas[0]-px,step.at[1]+foot.canvas[1]-py];
      assert.ok(foot.state!=='planted'||foot.solePixels>0,'Missing planted contact pixel.');
      assert.equal(foot.world[0],foot.canvas[0]+f.rootX);
      return {side,state:foot.state,at};
    });
    if(i) {
      const prev=steps[i-1], last=motion.frames[prev.frame];
      assert.equal(step.rootX-prev.rootX,last.advancePx,'Walk displaced outside E5.4 frame boundaries.');
      for(const c of contacts) if(c.state==='planted' && last.feet[c.side].state==='planted'){
        const [cx,cy]=last.feet[c.side].canvas;
        maxForwardSlip=Math.max(maxForwardSlip,Math.abs(c.at[0]-(prev.at[0]+cx-px)));
        maxScreenDepthSlip=Math.max(maxScreenDepthSlip,Math.abs(c.at[1]-(prev.at[1]+cy-py)));
        plantedPairs++;
      }
    }
    const colors=new Set<number>();
    for(let offset=0;offset<raster.rgba.length;offset+=4) if(raster.rgba[offset+3]) colors.add(raster.rgba.readUInt32BE(offset));
    const scene=anchoredScene(input,light,actor,step.at,{...actorAsset,raster,colors});
    const visibility=scene.metadata.occlusion.find(item=>item.id===actor)!;
    assert.ok(visibility.visible>0 && visibility.visibleContactPixels!>0,'Walk pose or ground contact disappears at '+step.stage);
    blit(sheet,scene.raster,(i%columns)*w,Math.floor(i/columns)*h);
    return { ...step, contacts, visible:visibility.visible, original:visibility.visibleBefore,
      visibleContactPixels:visibility.visibleContactPixels, hiddenBy:visibility.hiddenBy };
  });
  assert.equal(maxForwardSlip,0);
  assert.equal(maxScreenDepthSlip,2);
  assert.ok(evidence.some(step=>step.stage==='threshold' && step.hiddenBy['station-shell']>0),'Jamb never occludes the moving actor.');
  assert.ok(evidence.filter(step=>step.stage==='approach').every(step=>step.visible===step.original),'Opening approach is obstructed.');
  return {sheet,qa:{actor,source,hashes,pivot:timing.pivot,width:w,height:h,columns,mode:'Discrete Root A',end:'inside-threshold-apron',
    cyclePx:motion.cyclePx,tested,maxForwardSlip,maxScreenDepthSlip,plantedPairs,steps:evidence}};
}
