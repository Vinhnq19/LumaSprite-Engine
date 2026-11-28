import assert from 'node:assert/strict';
import test from 'node:test';
import { makeRaster, put } from '../src/core/pixels/raster.ts';
import { encodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';
import { importDraftComponent, type ComponentDescriptor } from '../scripts/e101-component-intake.ts';

test('E10.1 imports exact component pixels and rejects inconsistent intake',()=>{
  const raw=makeRaster(64,64), mask=makeRaster(64,64);
  put(raw,31,32,0x9b6a4fff);
  put(raw,32,32,0x9b6a4fff);
  put(mask,31,32,0xffffffff);
  put(mask,32,32,0xffffffff);
  const png=encodePng(raw), ownership=encodePng(mask);
  const descriptor:ComponentDescriptor={
    schema:'lumasprite.e101.component-intake.v1',state:'DRAFT',id:'cuff',ownerPart:'hand',extent:[64,64],
    view:'three-quarter-right',palette:['#9b6a4f'],revision:1,parent:null,anchors:{grip:[31,32],wrist:[32,32]},
    sourceSha256:sha256('test-authored-source'),pngSha256:sha256(png),maskSha256:sha256(ownership),
    provenance:{creator:'Fixture',classification:'ENGINEER_CURATED',sourceKind:'Original synthetic test PNG',
      license:null,rightsScope:'OWNER_AUTHORIZED_E101_INTERNAL_REVIEW',productionRights:'OWNER_CONFIRMATION_REQUIRED',
      externalArt:false,modelGenerated:false},
  };
  assert.deepEqual(importDraftComponent(descriptor,png,ownership).raster,raw);
  assert.throws(()=>importDraftComponent({...descriptor,pngSha256:sha256('wrong')},png,ownership),/PNG digest/);
  assert.throws(()=>importDraftComponent({...descriptor,anchors:{...descriptor.anchors,grip:[33,32]}},png,ownership),/Anchor outside owner/);
  assert.throws(()=>importDraftComponent({...descriptor,palette:['#ffffff']},png,ownership),/Pixel outside palette/);
  assert.throws(()=>importDraftComponent({...descriptor,provenance:{...descriptor.provenance,creator:''}},png,ownership));
  put(mask,32,32,0);
  const wrongMask=encodePng(mask);
  assert.throws(()=>importDraftComponent({...descriptor,maskSha256:sha256(wrongMask)},png,wrongMask),/Pixel outside ownership/);
});
