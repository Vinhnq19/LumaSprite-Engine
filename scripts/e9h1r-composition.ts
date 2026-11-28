import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Point } from '../src/core/geometry/shapes.ts';
import { crossAssetStyle, loadArtDirection } from '../src/experiments/art-direction.ts';
import { fitIdentityHeadwear } from '../src/experiments/character-headwear-fit.ts';
import type { Identity } from '../src/experiments/character-identity-study.ts';
import { legacyBody, renderQualityCharacter, type Case } from '../src/experiments/character-v4.ts';
import { recoverCostume } from '../src/experiments/character-v4-recovery.ts';
import { layeredCharacter, placeGroup, type CharacterRender, type Kit } from '../src/experiments/hybrid-character-kit.ts';
import { pinnedFile } from '../src/experiments/structure-quality/diagnostics.ts';
import { selectCaseLayout, type VisibilityRule } from './e9h1r-visibility.ts';

export const json=(file:string)=>JSON.parse(readFileSync(file,'utf8'));
export const history= 'benchmarks/results/e9h1/';
export const studyH1=json('benchmarks/fixtures/e9h1/study.json');
export const e91=json('benchmarks/fixtures/e91/study.json');
const {spec,profile}=await loadArtDirection(JSON.parse((await pinnedFile(e91.direction)).toString('utf8')));
const stylePackage=crossAssetStyle(profile,spec);
assert.ok(stylePackage.character);
export const style=stylePackage.profile, direction=stylePackage.character, device=stylePackage.device;
type Joint = {elbow:Point;wrist:Point;palm:Point;knee:Point;ankle:Point};
export type Entry = {
  id:string; name:string; seed:number; role:'development'|'diagnostic'|'fresh'; brief:string;
  torso?: Case['torso']; identity?: Identity; hookFamily?: 'screen';
  pose?: {hip?:Point;lean?:number;turn?:number;near?:Partial<Joint>;far?:Partial<Joint>};
};
type Layout = Parameters<typeof selectCaseLayout>[2][number];

export function procedural(entry:Entry) {
  const recipe:Case={...studyH1.recipe,id:entry.id,brief:entry.brief,seeds:[entry.seed],
    ...(entry.torso?{torso:entry.torso}:{})};
  const p=studyH1.basePose, local=entry.pose??{};
  const pose={...p,...local,near:{...p.near,...local.near},far:{...p.far,...local.far}};
  const legacy=json(recipe.legacy);
  const rig=legacyBody(recipe,entry.seed,{spec:{...legacy.spec,pose:{...legacy.spec.pose,...pose}},matched:pose});
  assert.deepEqual(rig.plan.pivot,studyH1.pivot);
  const s0=recoverCostume(renderQualityCharacter(recipe,entry.seed,rig,'b3',direction,device,true,e91.e90),
    rig.plan,'a-line',direction,false);
  const fitted=fitIdentityHeadwear(s0,rig.plan,entry.identity??studyH1.identity,direction,e91.limits.padding);
  return {a:fitted.steps.s2,rig:rig.plan,pose,headwear:fitted.plan};
}

export function recoverCase(base:CharacterRender, rule:VisibilityRule, layouts:Layout[]) {
  const result=selectCaseLayout(base,device,layouts,rule);
  const {part,layers,props}=result;
  if(!part) return {...result,render:base};
  const render=result.selected==='original'?base:layeredCharacter(base,layers,[part],direction,props);
  return {...result,render};
}

export function buildArms(a:CharacterRender, point:(name:string)=>Point, kit:Kit, entry:Entry) {
  const placed=kit.groups.map(g=>placeGroup(g,point(g.anchor),direction));
  const [head,suit,tools]=placed;
  if(entry.hookFamily==='screen') {
    const hook=structuredClone(kit.groups[2]);
    const scale=([x,y]:Point):[number,number]=>[x < -4?Math.round(-4+(x+4)*.67):x,y];
    const p=hook.layers[0];
    p.points=p.points.map(scale);
    for(const patch of p.patches) patch.points=patch.points.map(scale);
    hook.sockets.hookTip=scale(hook.sockets.hookTip);
    tools[0]=placeGroup(hook,point(hook.anchor),direction)[0];
  }
  const glove=tools[2];
  const matched=layeredCharacter(a,a.layers.map(p=>p.id==='near-hand'?glove:p),[glove],direction);
  const hidden=new Set(['hair','hood','bun','oilskin','shawl','sash','near-tool']);
  const layers=a.layers.flatMap(p=>hidden.has(p.id)?[]:p.id==='head'?head:p.id==='torso'?suit.slice(2):p.id==='near-hand'?tools:[p]);
  layers.splice(layers.findIndex(p=>p.id==='far-upper-arm'),0,...suit.slice(0,2));
  const props=a.props.map(p=>p.hand==='near-hand'?{...p,id:entry.hookFamily==='screen'?'compact-screen-hook':'salvage-hook',
    masks:tools.slice(0,-1).map(t=>t.mask)}:p);
  const full=layeredCharacter(a,layers,placed.flat(),direction,props);
  return {matched,full,placed};
}

export function part(r:CharacterRender,id:string) {
  const selected=r.layers.find(p=>p.id===id);
  assert.ok(selected,id);
  return selected;
}
