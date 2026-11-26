import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { decodePng } from '../src/core/renderer/png.ts';
import { sha256 } from '../src/quality/raster.ts';

test('Studio preserves the pixels of E7.1 relay and ruin PNGs', async t => {
  const studio = resolve(process.env.LUMASPRITE_STUDIO_ROOT ?? '../LumaSprite-Studio');
  const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd:studio, encoding:'utf8' }).trim();
  const moduleUrl = (path:string) => pathToFileURL(join(studio,path)).href;
  const { readStudioPng } = await import(moduleUrl('studio/pixel/read-png.ts'));
  const { celFor, newDocument } = await import(moduleUrl('src/studio/pixel/model.ts'));
  const { PixelStore } = await import(moduleUrl('src/node/studio/pixel-store.ts'));
  const { exportPixel } = await import(moduleUrl('src/node/studio/pixel-render.ts'));
  const cache = resolve('.cache');
  await mkdir(cache,{recursive:true});
  const root = await mkdtemp(join(cache,'e71-studio-'));
  assert.ok(root.startsWith(cache+sep+'e71-studio-') && root.length>(cache+sep+'e71-studio-').length);
  t.after(() => rm(root,{recursive:true,force:true}));

  const store = new PixelStore(root);
  const cases = [];
  for (const file of ['relay/a0/native.png','relay/a1/native.png','relay/a1/flat.png','relay/a1/material.png',
    'ruin/r1/day/candidate/native.png','ruin/h1/night/candidate/native.png']) {
    const path = 'benchmarks/results/e71/'+file;
    const png = await readFile(path);
    const raster = decodePng(png);
    const data:Uint32Array = await readStudioPng(new Blob([Uint8Array.from(png)]),raster.w,raster.h);
    assert.equal(data.length,raster.w*raster.h);
    for (const [i,ink] of data.entries()) assert.equal(ink,raster.rgba.readUInt32BE(i*4));
    const doc = newDocument(file,raster.w,raster.h);
    const asset = doc.assets[0], frame = asset.frames[0], layer = asset.layers[0];
    celFor(asset,layer.id,frame.id,true).data.set(data);
    const { id } = store.create(doc.name,raster.w,raster.h,0,doc);
    const original = store.load(id,true);
    store.save(id,original.revision,original,'Save flattened structure PNG');
    const reopened = store.load(id,true);
    const exported = exportPixel({document:reopened,assetId:asset.id,frameId:frame.id,format:'png'});
    assert.deepEqual(decodePng(Buffer.from(exported.data)),raster);
    cases.push({path,width:raster.w,height:raster.h,rgbaSha256:sha256(raster.rgba),saveReopen:'PASS'});
  }
  const output = 'benchmarks/results/run/e71';
  await mkdir(output,{recursive:true});
  await writeFile(join(output,'studio-parity.json'),JSON.stringify({studioRevision:revision,mode:'RAW_PNG_ONLY',cases},null,2)+'\n');
  t.diagnostic('Studio '+revision+' kept exact RGBA for '+cases.length+' PNGs.');
});
