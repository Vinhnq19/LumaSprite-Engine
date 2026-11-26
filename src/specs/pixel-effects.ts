import { z } from 'zod';

const sha256=z.string().regex(/^[a-f0-9]{64}$/);
const sourceStyle=z.strictObject({file:z.literal('benchmarks/fixtures/e61r/style-profile.json'),sha256});
const barrel=z.strictObject({file:z.literal('benchmarks/results/e24/barrel-tall-1x.png'),sha256});
const signal=z.strictObject({file:z.literal('benchmarks/results/e63/packages/r1-signal-entrance-day/manifest.json'),sha256});
const common={version:z.literal(1),id:z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),name:z.string().min(1).max(80),style:sourceStyle};
const square=<const T extends number>(side:T)=>z.tuple([z.literal(side),z.literal(side)]);

export const uiSpecSchema=z.discriminatedUnion('kind',[
  z.strictObject({...common,kind:z.literal('interaction-icon'),size:square(16)}),
  z.strictObject({...common,kind:z.literal('inventory-icon'),size:square(32),source:barrel}),
]);
export const effectPhases={
  'signal-activation':['anticipation','buildup','buildup','peak','dissipation','dissipation','clear'],
  'pickup-sparkle':['anticipation','buildup','peak','dissipation','dissipation','clear'],
} as const;
const vfxFields={
  ...common,loop:z.enum(['once','repeat']),
  frames:z.array(z.strictObject({
    phase:z.enum(['anticipation','buildup','peak','dissipation','clear']),durationMs:z.number().int().min(40).max(400),
  })).min(6).max(7),
};
export const vfxSpecSchema=z.discriminatedUnion('kind',[
  z.strictObject({...vfxFields,kind:z.literal('signal-activation'),size:square(48),source:signal}),
  z.strictObject({...vfxFields,kind:z.literal('pickup-sparkle'),size:square(32),source:barrel}),
]).superRefine((spec,ctx)=>{
  const actual=spec.frames.map(f=>f.phase);
  if(actual.join('/')!==effectPhases[spec.kind].join('/'))ctx.addIssue({code:'custom',path:['frames'],message:'Invalid phase order for this effect.'});
  if((spec.frames.at(-1)?.durationMs??0)<80)ctx.addIssue({code:'custom',path:['frames'],message:'Keep at least 80 ms of clear recovery for replay.'});
});

export type UISpec=z.infer<typeof uiSpecSchema>;
export type VFXSpec=z.infer<typeof vfxSpecSchema>;
