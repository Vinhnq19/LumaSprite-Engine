import { z } from 'zod';
import { unpack } from '../../core/palette/colors.ts';
import { supportsBarrelBrief, supportsSupplyChest } from '../../providers/mock/planner.ts';
import { chestSize } from '../../specs/asset.ts';

const features = ['previews', 'progress', 'masks'] as const;
export const capabilities = {
  name: 'LumaSprite Engine',
  versions: [1],
  assetTypes: ['prop'],
  features,
  limits: { width: chestSize, height: chestSize, frames: 1 },
};

const pixelCount = chestSize * chestSize;
const base64Length = (bytes: number) => 4 * Math.ceil(bytes / 3);

const requestSchema = z.strictObject({
  version: z.literal(1),
  requestId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).refine(
    id => !Object.hasOwn(Object.prototype, id) && id !== 'prototype', 'Reserved request ID.',
  ),
  assetType: z.literal('prop'),
  brief: z.string().trim().min(1).max(2000).refine(
    brief => supportsSupplyChest(brief) || supportsBarrelBrief(brief), 'Supported briefs: wooden supply chest or wooden barrel.',
  ),
  canvas: z.strictObject({ w: z.literal(chestSize), h: z.literal(chestSize) }),
  frameDurationsMs: z.tuple([z.number().int().min(1).max(60000)]),
  loop: z.boolean(),
  alpha: z.literal('binary'),
  palette: z.array(z.number().int().min(0).max(0xffffffff)).min(1).max(4096),
  requiredFeatures: z.array(z.enum(features)).max(features.length).optional(),
  region: z.strictObject({
    rgba: z.string().length(base64Length(pixelCount * 4)),
    editable: z.string().length(base64Length(pixelCount)),
  }).optional(),
});

function canonicalBytes(value: string, length: number, label: string) {
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== length || bytes.toString('base64') !== value) throw new Error(label + ' must be canonical base64.');
  return bytes;
}

export function parseStudioRequest(value: unknown) {
  const request = requestSchema.parse(value);
  const locked = new Set(request.palette.filter(ink => (ink & 255) === 255));
  if (locked.size === 0) throw new Error('palette must supply an opaque color.');
  let protection: { rgba: Buffer; editable: Buffer } | undefined;
  if (request.region) {
    const rgba = canonicalBytes(request.region.rgba, pixelCount * 4, 'region.rgba');
    const editable = canonicalBytes(request.region.editable, pixelCount, 'region.editable');
    if (!editable.includes(1) || editable.some(value => value > 1)) throw new Error('region.editable must contain a nonempty 0/1 selection.');
    for (let i = 0; i < pixelCount; i++) {
      const ink = rgba.readUInt32BE(i * 4);
      if (ink !== 0 && !locked.has(ink)) throw new Error('region.rgba must use binary alpha and the locked palette.');
    }
    protection = { rgba, editable };
  }
  return { request, palette: [...locked].map(unpack), protection };
}

export type StudioInput = ReturnType<typeof parseStudioRequest>;

export interface StudioResult {
  version: 1;
  jobId: string;
  versionId: string;
  name: string;
  w: number;
  h: number;
  loop: boolean;
  frames: [{ durationMs: number; rgba: string; sha256: string }];
}
