import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { sha256 } from '../src/quality/raster.ts';
import { environmentPackage, verifyEnvironmentPackage, writeEnvironmentPackage } from '../src/generators/environment/export.ts';
import { loadEnvironment } from '../src/generators/environment/render.ts';

const { values } = parseArgs({ options: { publish: { type: 'boolean' } } });
const output = values.publish ? 'benchmarks/results/e61' : 'benchmarks/results/run/e61';
const entries = [];
const files: Record<string, string> = {};
for (const layout of ['front-court','roadside']) {
  const input = await loadEnvironment(JSON.parse(await readFile('benchmarks/fixtures/e61/' + layout + '.json','utf8')));
  for (const light of ['day','night'] as const) {
    const a = environmentPackage(input,'A',light), b = environmentPackage(input,'B',light);
    assert.equal(a.scene.metadata.alphaSha256,b.scene.metadata.alphaSha256);
    assert.deepEqual(a.scene.metadata.collisions,b.scene.metadata.collisions);
    assert.deepEqual(a.scene.metadata.portal,b.scene.metadata.portal);
    assert.deepEqual(a.scene.metadata.mounts,b.scene.metadata.mounts);
    assert.deepEqual(a.scene.metadata.palette.allowed,b.scene.metadata.palette.allowed);
    assert.deepEqual(a.scene.metadata.layerOrder,b.scene.metadata.layerOrder);
    assert.deepEqual(a.scene.metadata.atlas.cells.map(({id, at, size, pivot, alphaSha256})=>({id,at,size,pivot,alphaSha256})),
      b.scene.metadata.atlas.cells.map(({id, at, size, pivot, alphaSha256})=>({id,at,size,pivot,alphaSha256})));
    assert.deepEqual(a.scene.metadata.occlusion.map(({id,visible,hiddenBy})=>({id,visible,hiddenBy})),
      b.scene.metadata.occlusion.map(({id,visible,hiddenBy})=>({id,visible,hiddenBy})));
    assert.ok(!a.scene.raster.rgba.equals(b.scene.raster.rgba), 'Surfaces must differ.');
    let changedPixels = 0;
    for (let at=0; at<a.scene.raster.rgba.length; at+=4) {
      if (a.scene.raster.rgba.readUInt32BE(at)!==b.scene.raster.rgba.readUInt32BE(at)) changedPixels++;
    }
    for (const [finish, bundle] of [['a',a],['b',b]] as const) {
      const id = [layout,finish,light].join('-');
      const relative = 'packages/' + id;
      const dest = join(output, relative);
      await writeEnvironmentPackage(dest,bundle);
      assert.deepEqual(await verifyEnvironmentPackage(dest),bundle.manifest);
      for (const [name, data] of bundle.files) files[relative + '/' + name] = sha256(data);
      entries.push({ layout, id, finish, light, changedPixels, relative });
    }
  }
}
const record = { version: 1, layouts: ['front-court','roadside'], packages: entries, fileCount: Object.keys(files).length, sha256: files };
const bytes = Buffer.from(JSON.stringify(record,null,2)+'\n');
await mkdir(output,{recursive:true});
const path=join(output,'benchmark.json');
try { await writeFile(path, bytes, { flag: 'wx' }); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  assert.deepEqual(bytes, await readFile(path), 'Existing benchmark index differs.');
}
console.log('E6.1 · ' + entries.length + ' independently verified packages, ' + Object.keys(files).length + ' payload SHA-256');
