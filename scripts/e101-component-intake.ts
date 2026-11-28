import assert from 'node:assert/strict';
import { z } from 'zod';
import { pack } from '../src/core/palette/colors.ts';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

const hash=z.string().regex(/^[0-9a-f]{64}$/);
const ink=z.string().regex(/^#[0-9a-f]{6}$/);
const xy=z.number().int().min(1).max(62);
const point=z.tuple([xy,xy]);
export const draftProvenance=z.strictObject({
  creator:z.string().trim().min(1),classification:z.literal('ENGINEER_CURATED'),
  sourceKind:z.string().trim().min(1),license:z.null(),rightsScope:z.literal('OWNER_AUTHORIZED_E101_INTERNAL_REVIEW'),
  productionRights:z.literal('OWNER_CONFIRMATION_REQUIRED'),externalArt:z.literal(false),modelGenerated:z.literal(false),
});
const descriptor=z.strictObject({
  schema:z.literal('lumasprite.e101.component-intake.v1'), state:z.literal('DRAFT'),
  id:z.string().regex(/^[a-z][a-z0-9-]+$/),ownerPart:z.string().regex(/^[a-z][a-z0-9-]+$/),
  extent:z.tuple([z.literal(64),z.literal(64)]),view:z.literal('three-quarter-right'),
  palette:z.array(ink).min(1).max(64),revision:z.number().int().min(1),parent:hash.nullable(),
  anchors:z.strictObject({grip:point,wrist:point}),sourceSha256:hash,
  pngSha256:hash,maskSha256:hash,provenance:draftProvenance,
});
export type ComponentDescriptor=z.infer<typeof descriptor>;

function decodeNative(bytes:Buffer) {
  assert.ok(bytes.length>=33&&bytes.length<=65536,'PNG size envelope');
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','PNG signature');
  assert.equal(bytes.subarray(12,16).toString(),'IHDR','PNG header');
  assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20),bytes[24],bytes[25]],[64,64,8,6],'PNG extent or format');
  return decodePng(bytes);
}

export function importDraftComponent(input:unknown,png:Buffer,ownership:Buffer) {
  const metadata=descriptor.parse(input);
  assert.equal(metadata.parent===null,metadata.revision===1,'Revision parent');
  assert.equal(sha256(png),metadata.pngSha256,'PNG digest');
  assert.equal(sha256(ownership),metadata.maskSha256,'Ownership digest');
  const raster=decodeNative(png), mask=decodeNative(ownership);
  const palette=new Set(metadata.palette.map(pack));
  assert.equal(palette.size,metadata.palette.length,'Duplicate palette ink');
  let pixels=0;
  for(let i=0;i<4096;i++) {
    const offset=i*4, color=raster.rgba.readUInt32BE(offset), owner=mask.rgba.readUInt32BE(offset);
    assert.ok(owner===0||owner===0xffffffff,'Ownership mask must be binary white');
    if(owner===0) assert.equal(color,0,'Pixel outside ownership');
    else {
      assert.ok(i%64>=1&&i%64<63&&i>=64&&i<4032,'Component margin');
      assert.ok(palette.has(color),'Pixel outside palette or opaque alpha');
      pixels++;
    }
  }
  assert.ok(pixels>0,'Empty component');
  for(const [id,[x,y]] of Object.entries(metadata.anchors))
    assert.equal(mask.rgba[(y*64+x)*4+3],255,'Anchor outside owner: '+id);
  return {metadata,raster,mask,pixels};
}
