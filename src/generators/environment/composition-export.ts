import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { nearestNeighbor } from '../../core/pixels/raster.ts';
import { encodePng } from '../../core/renderer/png.ts';
import { inspectPng,sha256 } from '../../quality/raster.ts';
import type { EnvironmentLight } from '../../specs/environment.ts';
import { loadComposition,renderComposition,type Composition } from './composition.ts';

const json=(value: unknown)=>Buffer.from(JSON.stringify(value,null,2)+'\n');
export function compositionPackage(input: Composition, light: EnvironmentLight) {
  const view=renderComposition(input,light), repeat=renderComposition(input,light);
  const files=new Map<string,Buffer>();
  const flat=input.spec.ruins ? renderComposition(input,'day',true).scene : undefined;
  if(flat){
    assert.deepEqual(flat.architectureSilhouette,view.scene.architectureSilhouette,'Material pass changes the approved structural silhouette.');
    assert.deepEqual(flat.collisionPlane,view.scene.collisionPlane,'Material pass changes structural collision.');
  }
  const images = {
    'scene.png':view.scene.raster,
    'layer-overlay.png':view.scene.layerOverlay,
    'material-mask.png':view.scene.materialMask,
    'collision-mask.png':view.scene.collisionPlane,
    'collision-overlay.png':view.scene.collisionOverlay,
    'walkable-mask.png':view.walkable,
    'route-overlay.png':view.routeOverlay,
    'focal-overlay.png':view.focalOverlay,
    'kit.png':view.scene.atlas,
    'kit-material-mask.png':view.scene.atlasMaterials,
    ...(view.scene.nightLight?{'night-light.png':view.scene.nightLight}:{}),
    'scene-4x.png':nearestNeighbor(view.scene.raster,4),
    ...(flat?{'flat-geometry.png':flat.raster,'architecture-silhouette.png':flat.architectureSilhouette!}:{}),
  };
  assert.deepEqual(view,repeat,'Composition render and diagnostics must be deterministic.');
  for(const [path,raster] of Object.entries(images)){
    const png=encodePng(raster);
    const errors=inspectPng(raster,png,raster);
    if(errors.length) throw new Error(path+' failed PNG validation: '+errors.join(','));
    files.set(path,png);
  }
  files.set('composition-spec.json',json(input.spec));
  files.set('kit.json',json(view.scene.metadata.atlas));
  files.set('qa.json',json({geometry:view.scene.metadata,routes:view.routes,hierarchy:view.hierarchy,interactions:view.interactions,zoneLegend:view.zoneLegend}));
  const manifest={
    version:1,kind:'lumasprite-scene-composition',id:input.spec.id,light,source:input.spec.source,
    camera:view.scene.metadata.camera,review:'HUMAN_ART_REVIEW_PENDING',
    files:Object.fromEntries([...files].map(([path,bytes])=>[path,sha256(bytes)])),
  };
  files.set('manifest.json',json(manifest));
  return {manifest,files,view};
}

const header=z.object({version:z.literal(1),kind:z.literal('lumasprite-scene-composition'),light:z.enum(['day','night'])});
export async function verifyCompositionPackage(folder: string) {
  const read=async(file: string)=>readFile(join(folder,file));
  const manifest=header.parse(JSON.parse((await read('manifest.json')).toString('utf8')));
  const input=await loadComposition(JSON.parse((await read('composition-spec.json')).toString('utf8')));
  const rebuilt=compositionPackage(input,manifest.light);
  assert.deepEqual((await readdir(folder)).sort(),[...rebuilt.files.keys()].sort(),'Unexpected composition package files.');
  for(const [path,bytes] of rebuilt.files) assert.deepEqual(await read(path),bytes,path+' differs from regeneration.');
  return rebuilt.manifest;
}
