import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

test('Studio raw PNG round-trips the environment scene and architecture kit as raster assets', async t => {
  const studio = resolve(process.env.LUMASPRITE_STUDIO_ROOT ?? '../LumaSprite-Studio');
  const revision = execFileSync('git',['rev-parse','--short=7','HEAD'],{cwd:studio,encoding:'utf8'}).trim();
  const ref = (path:string) => pathToFileURL(join(studio,path)).href;
  const { readStudioPng } = await import(ref('studio/pixel/read-png.ts'));
  const { celFor, newDocument } = await import(ref('src/studio/pixel/model.ts'));
  const { PixelStore } = await import(ref('src/node/studio/pixel-store.ts'));
  const { exportPixel } = await import(ref('src/node/studio/pixel-render.ts'));
  const cache=resolve('.cache');
  await mkdir(cache,{recursive:true});
  const root=await mkdtemp(join(cache,'e61-studio-'));
  assert.ok(root.startsWith(cache+sep) && root.length>cache.length+sep.length);
  t.after(()=>rm(root,{recursive:true,force:true}));
  const store=new PixelStore(root);
  const edition=process.env.LUMASPRITE_ENVIRONMENT_EDITION ?? 'e61';
  assert.ok(edition==='e61' || edition==='e61r' || edition==='e62' || edition==='e63','Unknown environment edition.');
  const cases=[];
  const inputs=edition==='e63' ?
    [['r1-signal-entrance-day','scene.png'],['r1-signal-entrance-night','scene.png'],['r2-signal-clearing-day','scene.png'],
      ['r2-signal-clearing-night','scene.png'],['c2-night-quality-night','scene.png'],['r1-signal-entrance-day','kit.png'],
      ['r2-signal-clearing-night','architecture-silhouette.png']] :
    edition==='e62' ?
    [['c1-courtyard-day','scene.png'],['c1-courtyard-night','scene.png'],['c2-supply-stop-day','scene.png'],['c2-supply-stop-night','scene.png'],
      ['c2-supply-stop-day','kit.png'],['c1-courtyard-night','night-light.png'],['c2-supply-stop-night','walkable-mask.png']] :
    edition==='e61' ? [['front-court-b-day','scene.png'],['roadside-b-night','scene.png'],['front-court-b-day','kit.png']] :
    [['front-court-day','scene.png'],['front-court-night','scene.png'],['roadside-day','scene.png'],['roadside-night','scene.png'],
      ['front-court-day','kit.png'],['roadside-night','kit.png'],['roadside-night','night-light.png']];
  for (const [bundle,file] of inputs) {
    const path='benchmarks/results/'+edition+'/packages/'+bundle+'/'+file;
    const png=await readFile(path);
    const raster=decodePng(png);
    const data: Uint32Array = await readStudioPng(new Blob([Uint8Array.from(png)]), raster.w, raster.h);
    assert.equal(data.length,raster.w*raster.h);
    for (const [i,ink] of data.entries()) assert.equal(ink,raster.rgba.readUInt32BE(i*4));
    const doc=newDocument(bundle+' '+file,raster.w,raster.h);
    const asset=doc.assets[0], frame=asset.frames[0], layer=asset.layers[0];
    celFor(asset,layer.id,frame.id,true).data.set(data);
    const {id}=store.create(doc.name,raster.w,raster.h,0,doc);
    const original=store.load(id,true);
    store.save(id,original.revision,original,'Store flattened environment PNG');
    const reopened=store.load(id,true);
    const pngAgain=exportPixel({document:reopened,assetId:asset.id,frameId:frame.id,format:'png'});
    assert.deepEqual(decodePng(Buffer.from(pngAgain.data)),raster);
    cases.push({path,width:raster.w,height:raster.h,rgbaSha256:sha256(raster.rgba),saveReopen:'PASS'});
  }
  const folder='benchmarks/results/run/'+edition;
  await mkdir(folder,{recursive:true});
  await writeFile(join(folder,'studio-parity.json'), JSON.stringify({ studioRevision:revision, mode:'RAW_PNG_ONLY', cases },null,2)+'\n');
  t.diagnostic('Studio '+revision+' kept exact RGBA for '+cases.length+' PNGs.');
});
