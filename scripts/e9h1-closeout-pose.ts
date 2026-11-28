import assert from 'node:assert/strict';
import type { Point } from '../src/core/geometry/shapes.ts';
import { renderCharacter } from '../src/generators/character/render.ts';
import { checkCharacter } from '../src/quality/character.ts';
import { characterSpecSchema, type CharacterSpec } from '../src/specs/character.ts';
import { json, studyH1, type Entry } from './e9h1r-composition.ts';

type Spec = Extract<CharacterSpec,{version:3}>;
type Side = 'near'|'far';
type Bend = { depth:number; forward:number };
export type LegIntent = Record<Side,Bend>;
export const sides=['near','far'] as const;

const baseSpec=characterSpecSchema.parse(json(studyH1.recipe.legacy).spec);
assert.equal(baseSpec.version,3);
const raw:Spec=baseSpec;

export function withPose(entry:Entry, size:Partial<Spec['proportions']>={}):Spec {
  const base=studyH1.basePose, local=entry.pose??{};
  const spec=characterSpecSchema.parse({...raw,name:entry.id,seed:entry.seed,proportions:{...raw.proportions,...size},
    pose:{...raw.pose,...base,...local,near:{...base.near,...local.near},far:{...base.far,...local.far}}});
  assert.equal(spec.version,3);
  return spec;
}

// Static three-quarter-right projection. The boot toe points toward +x on both sides.
function projectedHips(spec:Spec):Record<Side,Point> {
  const [x,y]=spec.pose.hip, inset=Math.floor(spec.proportions.hips/3);
  return {near:[x-inset,y+1],far:[x+inset,y-Math.floor(spec.pose.turn/2)]};
}

export function authorKnees(spec:Spec, intent:LegIntent) {
  const pose=structuredClone(spec.pose);
  const hips=projectedHips(spec);
  for(const side of sides) {
    const [hx,hy]=hips[side],[ax,ay]=pose[side].ankle;
    const {depth,forward}=intent[side];
    assert.ok(depth>=.33&&depth<=.67&&Number.isInteger(forward)&&forward>=0&&forward<=3,side+' invalid source bend intent');
    assert.ok(ay>hy+5,side+' invalid ankle depth');
    const y=Math.round(hy+depth*(ay-hy));
    const x=Math.round(hx+(ax-hx)*(y-hy)/(ay-hy)+forward);
    pose[side].knee=[x,y];
  }
  return {...spec,pose};
}

export function assessPose(spec:Spec) {
  const render=renderCharacter(spec), qa=checkCharacter(render);
  const inputHips=projectedHips(spec);
  const joints=sides.map(side=>{
    const hip=render.plan.landmarks[side+'-hip'].point;
    assert.deepEqual(hip,inputHips[side],'Research projection diverges from Engine plan');
    const knee=render.plan.landmarks[side+'-knee'].point, ankle=render.plan.landmarks[side+'-ankle'].point;
    assert.deepEqual(knee,spec.pose[side].knee);
    assert.deepEqual(ankle,spec.pose[side].ankle);
    const forward=qa.pose!.kneeBends[side];
    const projectedBoot=render.layers[side+'-boot'];
    const toePixels=Array.from({length:projectedBoot.w*projectedBoot.h},(_,i)=>i).filter(i=>
      projectedBoot.rgba[i*4+3]!==0&&i%64>=ankle[0]+3).length;
    assert.ok(toePixels>0,'Expected forward-pointing boot');
    return {side,hip,knee,ankle,forward,toePixels,relativeToHip:knee[0]-hip[0],foot:qa.pose!.feet[side]};
  });
  return {render,qa,joints,forwardTolerance:[-1,spec.proportions.leg[0]*.75],proportions:spec.proportions};
}
