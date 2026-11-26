import type { Point } from '../../core/geometry/shapes.ts';
import type { CharacterSpec } from '../../specs/character.ts';
import type { GaitPose } from './geometry.ts';

export const feet = ['near', 'far'] as const;
type Side = (typeof feet)[number];
export type WalkingCharacter = Extract<CharacterSpec, { version: 2 | 3 }>;
export type WalkKey = {
  lead: Side;
  phase: Exclude<GaitPose['phase'], 'transition'>;
  advancePx: number;
  bob: number;
  swingX: number;
  swingLift: number;
  armSwing: number;
  gripShift: [number, number];
  sway: number;
};

export function solveWalkPose(source: WalkingCharacter, ground: GaitPose['ground'], key: WalkKey, halfStep: number, progress: number) {
  const base = source.pose;
  const { lead, phase, bob } = key;
  const swing = lead === 'near' ? 'far' : 'near';
  const contact = phase === 'contact';
  const left = base.near.ankle[0] - Math.round(halfStep / 2) + 1;
  const center = { near: left + halfStep, far: base.far.ankle[0] - halfStep };
  const hip: [number, number] = [base.hip[0], base.hip[1] + bob];
  const [gx, gy] = key.gripShift;
  const arm = key.armSwing * (lead === 'near' ? 1 : -1);
  const free = source.version === 3;
  const pose = {
    ...base, support: lead, hip, lean: Number(phase === 'down') + (free ? base.lean : 0),
    near: free ? {
      ...base.near,
      elbow: shift(base.near.elbow, -arm, bob),
      wrist: shift(base.near.wrist, -2 * arm, bob),
      palm: shift(base.near.palm, -2 * arm, bob),
    } : {
      ...base.near,
      elbow: shift(base.near.elbow, gx, Math.min(1, bob) - Number(phase === 'passing')),
      wrist: shift(base.near.wrist, gx, gy), palm: shift(base.near.palm, gx, gy),
    },
    far: {
      ...base.far,
      elbow: shift(base.far.elbow, arm, bob),
      wrist: shift(base.far.wrist, arm * 2, bob), palm: shift(base.far.palm, arm * 2, bob),
    },
  };
  for (const side of feet) {
    const planted = side === lead;
    const lift = planted || contact ? 0 : key.swingLift + Number(side === 'near' && phase === 'passing');
    const offset = planted ? halfStep - progress : contact ? -halfStep : key.swingX;
    const ankle: [number, number] = [center[side] + offset, ground[side] - source.proportions.boot[1] - 1 - lift];
    const hipX = hip[0] + (side === 'near' ? -1 : 1) * Math.floor(source.proportions.hips / 3);
    const hipY = hip[1] + (side === 'near' ? 1 : -Math.floor(base.turn / 2));
    const kneeBend = planted ? (phase === 'down' ? 2 : 1) : contact ? 1 : phase === 'passing' ? 3 : 2;
    const knee: [number, number] = [Math.round((hipX + ankle[0]) / 2) + kneeBend, Math.floor((hipY + ankle[1]) / 2)];
    pose[side] = { ...pose[side], knee, ankle };
  }
  const gait: GaitPose = {
    phase, ground, planted: { near: swing !== 'near' || contact, far: swing !== 'far' || contact },
    pushOff: phase === 'up' ? lead : null, lanternSway: key.sway,
  };
  return { pose, gait };
}

function shift([x, y]: Point, dx: number, dy: number): [number, number] {
  return [x + dx, y + dy];
}
