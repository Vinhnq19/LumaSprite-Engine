import { z } from 'zod';

const integer = (min: number, max: number) => z.number().int().min(min).max(max);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const offset = z.tuple([integer(-1, 1), integer(-1, 1)]);
const phases = ['neutral', 'inhale', 'return', 'recovery'] as const;
const keyPose = z.strictObject({
  phase: z.enum(phases),
  durationMs: integer(100, 2000),
  joints: z.strictObject({ nearElbow: offset, farElbow: offset }),
  body: z.strictObject({ jacketWidth: integer(-1, 1), jacketHeight: integer(-1, 1) }),
});

export const animationSpecSchema = z.strictObject({
  version: z.literal(1),
  kind: z.literal('humanoid-animation'),
  source: z.strictObject({
    checkpoint: z.string().regex(/^[a-f0-9]{7,40}$/),
    characterSpecVersion: z.union([z.literal(2), z.literal(3)]),
    geometryRevision: integer(1, 255),
    productionManifestSha256: hash,
    characterSpecSha256: hash,
    shapeLockSha256: hash,
  }),
  name: z.string().trim().min(1).max(80),
  intent: z.literal('standing-idle'),
  frameCount: integer(2, 4),
  loop: z.literal('repeat'),
  pivot: z.tuple([integer(2, 61), integer(2, 61)]),
  layerOrder: z.array(z.string().min(1)).min(1).max(30),
  seed: integer(0, 0xffffffff),
  contact: z.strictObject({ feet: z.literal('planted'), equipment: z.literal('preserve-source'), jointStepPx: z.literal(1) }),
  keyPoses: z.array(keyPose).min(2).max(4),
  output: z.strictObject({ frameWidth: z.literal(64), frameHeight: z.literal(64), layout: z.literal('horizontal-strip'), background: z.literal('transparent') }),
}).superRefine((spec, ctx) => {
  const fail = (message: string, path: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (spec.frameCount !== spec.keyPoses.length) fail('Frame count must equal the key-pose count.', 'frameCount');
  if (new Set(spec.layerOrder).size !== spec.layerOrder.length) fail('Layer IDs must be unique.', 'layerOrder');
  const order = spec.keyPoses.map(pose => phases.indexOf(pose.phase));
  if (order[0] !== 0 || order.some((phase, i) => i > 0 && phase <= order[i - 1])) {
    fail('Start at neutral and use each following phase at most once in breathing order.', 'keyPoses');
  }
  for (const pose of spec.keyPoses) {
    if ((pose.phase === 'neutral' || pose.phase === 'return') &&
        [...pose.joints.nearElbow, ...pose.joints.farElbow, pose.body.jacketWidth, pose.body.jacketHeight].some(Boolean)) {
      fail('Neutral and return retain the exact source geometry.', 'keyPoses');
    }
  }
});

export type AnimationSpec = z.infer<typeof animationSpecSchema>;
