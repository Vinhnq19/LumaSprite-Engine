import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { rect } from '../src/core/geometry/faces.ts';
import { fillPolygon, type Point } from '../src/core/geometry/shapes.ts';
import { inkLuma, pack } from '../src/core/palette/colors.ts';
import { blit, composite, makeRaster, put, type Raster } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import { environmentPackage, verifyEnvironmentPackage, writeEnvironmentPackage } from '../src/generators/environment/export.ts';
import { materialLegend } from '../src/generators/environment/kit.ts';
import { covered } from '../src/generators/environment/refinement.ts';
import { loadEnvironment, renderEnvironment } from '../src/generators/environment/render.ts';
import { sha256 } from '../src/quality/raster.ts';

const { values } = parseArgs({ options: { publish: { type: 'boolean' }, out: { type: 'string' } } });
const baseline = 'benchmarks/results/e61';
if (values.publish && values.out) throw new Error('Choose --publish or --out.');
const output = values.publish ? 'benchmarks/results/e61r' : values.out ?? 'benchmarks/results/run/e61r';
const readJson = async (path: string) => JSON.parse(await readFile(path,'utf8'));
const oldIndex = await readJson(baseline+'/benchmark.json');
for (const [file,digest] of Object.entries(oldIndex.sha256)) assert.equal(sha256(await readFile(join(baseline,file))),digest,file);
assert.equal(Object.keys(oldIndex.sha256).length,104);
const historical = '537f604';
const files: Record<string,string> = {};
async function publish(path: string, bytes: Buffer) {
  const target = join(output,path);
  await mkdir(join(target,'..'),{recursive:true});
  try { await writeFile(target,bytes,{flag:'wx'}); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    assert.deepEqual(bytes,await readFile(target),target+' differs. Use a fresh run directory.');
  }
  files[path] = sha256(bytes);
}
const png = (name: string, raster: Raster) => publish(name,encodePng(raster));
const actorIds = ['surveyor','courier'] as const;
const plateInk = pack('#435061'), axisInk = pack('#82a898');
function cut(raster: Raster, left: number, top: number, w: number, h: number) {
  assert.ok(left >= 0 && top >= 0 && left+w <= raster.w && top+h <= raster.h);
  const cropped = makeRaster(w,h);
  for (let y=0;y<h;y++) {
    const offset = ((top+y)*raster.w+left)*4;
    raster.rgba.copy(cropped.rgba,y*w*4,offset,offset+w*4);
  }
  return cropped;
}

function metrics(scene: ReturnType<typeof renderEnvironment>, light: 'day'|'night') {
  const { raster: { w,h,rgba }, materialMask } = scene;
  const lumas = Array.from({length:w*h},(_,i)=>inkLuma(rgba.readUInt32BE(i*4)));
  const roles = Array.from({length:w*h},(_,i)=>materialMask.rgba.readUInt32BE(i*4));
  const textures = Object.fromEntries((['grass','dirt','roof','wood','stone'] as const).map(name=> {
    const role=pack(materialLegend[name]);
    let samples=0, edges=0, compared=0, repeated=0;
    for (let y=0;y<h-1;y++) for (let x=0;x<w-1;x++) {
      const i=y*w+x;
      if (roles[i] !== role || roles[i+1] !== role || roles[i+w] !== role) continue;
      samples++;
      const edge=(at: number)=>Math.max(Math.abs(lumas[at]-lumas[at+1]),Math.abs(lumas[at]-lumas[at+w])) >= 6;
      if (!edge(i)) continue;
      edges++;
      if (x+16>=w-1 || roles[i+16] !== role || roles[i+17] !== role || roles[i+w+16] !== role) continue;
      compared++;
      if (edge(i+16)) repeated++;
    }
    return [name,{samples, edges, per100:Number((100*edges/samples).toFixed(1)), repeatedAt16: compared ? Number((100*repeated/compared).toFixed(1)) : null}];
  }));
  const pairs: [keyof typeof materialLegend,keyof typeof materialLegend][] = light==='day' ?
    [['roof','metal'],['stone','roof'],['wood','roof']] : [['wood','roof'],['stone','metal']];
  const boundaries = pairs.map(([a,b])=>{
    const colorA=pack(materialLegend[a]), colorB=pack(materialLegend[b]), gaps:number[]=[];
    for (let y=0;y<h-1;y++) for (let x=0;x<w-1;x++) {
      const i=y*w+x;
      for (const j of [i+1,i+w]) {
        if ((roles[i]===colorA && roles[j]===colorB) || (roles[i]===colorB && roles[j]===colorA)) gaps.push(Math.abs(lumas[i]-lumas[j]));
      }
    }
    gaps.sort((a,b)=>a-b);
    return { pair:[a,b], samples:gaps.length, median:gaps[Math.floor(gaps.length/2)] ?? null, p10:gaps[Math.floor(gaps.length/10)] ?? null };
  });
  return { textures,boundaries };
}

function footprint(scene: ReturnType<typeof renderEnvironment>, points: readonly number[][]) {
  const raster=composite([scene.collisionOverlay]);
  const mark=(x: number,y: number,color: number)=>{ if (x>=0 && y>=0 && x<raster.w && y<raster.h) put(raster,x,y,color); };
  points.forEach(([x,y],i)=>{
    const [tx,ty]=points[(i+1)%points.length], distance=Math.max(Math.abs(tx-x),Math.abs(ty-y));
    for(let t=0;t<=distance;t++) mark(Math.round(x+(tx-x)*t/distance),Math.round(y+(ty-y)*t/distance),pack('#f9da83'));
  });
  for (const row of scene.metadata.occlusion.filter(item=>item.kind==='actor')) {
    const [x,y]=row.at;
    for(let d=-3;d<=3;d++) { mark(x+d,y,axisInk); mark(x,y+d,axisInk); }
  }
  return raster;
}

for (const layout of ['front-court','roadside']) {
  const original = await loadEnvironment(await readJson('benchmarks/fixtures/e61/'+layout+'.json'));
  const input = await loadEnvironment(await readJson('benchmarks/fixtures/e61r/'+layout+'.json'));
  assert.equal(input.spec.version,2);
  const oldRefs=input.spec.assetRefs.map(ref=>{
    const copy={...ref};
    delete copy.scaleManifestSha256;
    return copy;
  });
  assert.deepEqual(oldRefs,original.spec.assetRefs);
  assert.deepEqual(input.spec.terrain,original.spec.terrain);
  for (const light of ['day','night'] as const) {
    const id = layout+'-'+light;
    const basePath = baseline+'/packages/'+layout+'-b-'+light;
    const b0 = environmentPackage(original,'B',light);
    for (const [name, bytes] of b0.files) assert.deepEqual(bytes,await readFile(basePath+'/'+name),basePath+'/'+name);
    const b1 = environmentPackage(input,'B',light);
    const relative = 'packages/'+id;
    await writeEnvironmentPackage(join(output,relative), b1);
    assert.deepEqual(await verifyEnvironmentPackage(join(output,relative)),b1.manifest);
    for (const [name,bytes] of b1.files) files[relative+'/'+name] = sha256(bytes);
    const a = b0.scene, b = b1.scene;
    const detail = b.metadata.refinement!;
    assert.equal(b.metadata.camera.sampling,'nearest');
    assert.equal(b.metadata.camera.pixelsPerUnit,32);
    assert.equal(detail.geometry.fit.length,2);
    const occupied=makeRaster(b.raster.w,b.raster.h);
    const solid=pack('#ffffff');
    for (const wall of b.metadata.collisions.filter(box=>box.kind==='architecture')) fillPolygon(occupied,wall.points,solid);
    for (const prop of b.metadata.collisions.filter(box=>box.kind==='prop')) {
      const floor=makeRaster(b.raster.w,b.raster.h);
      fillPolygon(floor,prop.points,solid);
      for(let at=3;at<floor.rgba.length;at+=4) {
        if (!floor.rgba[at]) continue;
        assert.equal(occupied.rgba[at],0,prop.id+' overlaps the wall or another prop.');
        occupied.rgba[at]=255;
        assert.equal(b.collisionPlane.rgba[at],255,prop.id+' must appear in the collision mask.');
      }
    }
    assert.ok(detail.quietedTerrainPixels>0);
    assert.equal(detail.nightLightPixels>0,light==='night');
    const oldCourier = a.metadata.occlusion.find(x=>x.id==='forest-courier')!;
    const courier = b.metadata.occlusion.find(x=>x.id==='forest-courier')!;
    if (layout==='roadside') {
      assert.ok(courier.hiddenBy['station-shell']>0,'Roadside Courier must still be behind the shell.');
      assert.equal(courier.visibleContactPixels,courier.contactPixels);
      assert.ok(courier.groundClearance! >= 6);
      const pad = b.metadata.portal.at[1];
      assert.ok(courier.at[1]<pad && courier.at[1]>pad-8,'Rear courtyard anchor must align with the right return.');
    }
    let revision = 0;
    for (const [scene,spec] of [[a,original.spec],[b,input.spec]] as const) {
      const [x,y]=scene.metadata.portal.at;
      const path='plates/'+id+'/b'+revision;
      const [bx,by]=spec.building.at;
      const width=16*(spec.building.bays.length+revision);
      const foot=[[bx,by],[bx+width,by],[bx+width+16,by-8],[bx+16,by-8]];
      await png(path+'-architecture.png',cut(scene.raster,x-64,y-106,128,126));
      await png(path+'-footprint.png',footprint(scene,foot));
      const plate=makeRaster(244,92);
      fillPolygon(plate,rect(0,0,plate.w,plate.h),plateInk);
      fillPolygon(plate,rect(0,78,plate.w,79),axisInk);
      for(let h=8;h<=64;h+=8) fillPolygon(plate,rect(0,78-h,5,79-h),axisInk);
      const cell=scene.metadata.atlas.cells.find(cell=>cell.id==='door')!;
      // Dark fill reveals the transparent opening of the revised module.
      fillPolygon(plate,rect(25,78-cell.size[1],25+cell.size[0],78),pack('#1f232f'));
      blit(plate,cut(scene.atlas,...cell.at,cell.size[0],cell.size[1]),25,78-cell.size[1]);
      for (const [i,key] of actorIds.entries()) {
        const {ref,raster}=input.assets.get(key)!;
        const anchor=101+i*75;
        blit(plate,raster,anchor-ref.pivot[0],78-ref.pivot[1]);
        fillPolygon(plate,rect(anchor,79,anchor+1,83),axisInk);
      }
      await png(path+'-scale.png',plate);
      revision++;
    }

    const x=b.metadata.portal.at[0], y=b.metadata.portal.at[1];
    const stances=[];
    for (const actor of actorIds) {
      const otherActors = input.spec.placements.filter(p=>input.assets.get(p.ref)?.ref.kind !== 'actor');
      const actorPlacement = input.spec.placements.find(p=>p.ref===actor)!;
      for (const [pose,offset] of [['landing',12],['threshold',-4]] as const) {
        const at: Point = [x-(pose === 'threshold' ? 2 : 0),y+offset];
        const placement = {...actorPlacement,at:[...at] as [number,number]};
        const scene=renderEnvironment({...input,spec:{...input.spec,placements:[...otherActors,placement]}},'B',light);
        const row=scene.metadata.occlusion.find(item=>item.id===placement.id)!;
        assert.ok(row.visibleContactPixels! >= row.contactPixels!*.90,pose+' boot contact must remain legible.');
        if (pose === 'threshold') assert.ok(row.hiddenBy['station-shell']>0,'A jamb must occlude the threshold stance.');
        await png('plates/'+id+'/'+actor+'-'+pose+'.png',cut(scene.raster,x-46,y-84,92,110));
        stances.push({ actor, pose, at, visible:row.visible, original:row.visibleBefore, hiddenBy:row.hiddenBy, boots:row.visibleContactPixels });
      }
    }
    const record={
      layout, light, baseline: { checkpoint:historical, originalPackage:basePath, manifestSha256:sha256(b0.files.get('manifest.json')!) },
      revision: { package:relative, spec:'benchmarks/fixtures/e61r/'+layout+'.json', manifestSha256:sha256(b1.files.get('manifest.json')!) },
      camera:b.metadata.camera, b0:{ geometry:{ wallHeight:32, doorWidth:16, paintedDoorHeight:24, clearCollisionWidth:10 },
        building:original.spec.building, placements:original.spec.placements, portal:a.metadata.portal,
        mounts:a.metadata.mounts, materialWarnings:a.metadata.palette.warnings, courier:oldCourier, ...metrics(a,light) },
      b1:{ ...detail, building:input.spec.building, placements:input.spec.placements, portal:b.metadata.portal,
        mounts:b.metadata.mounts, materialWarnings:b.metadata.palette.warnings, courier, ...metrics(b,light) }, stances,
    };
    await publish('plates/'+id+'/comparison.json',Buffer.from(JSON.stringify(record,null,2)+'\n'));

    if(id!=='front-court-day') continue;
    for (const actor of actorIds) {
      const base='benchmarks/results/e54/packages/'+actor+'/walk/';
      const manifest=await readJson(base+'manifest.json'), timingBytes=await readFile(base+'timing.json'), spriteBytes=await readFile(base+'spritesheet.png');
      assert.equal(sha256(timingBytes),manifest.files['timing.json']);
      assert.equal(sha256(spriteBytes),manifest.files['spritesheet.png']);
      const timing=JSON.parse(timingBytes.toString('utf8'));
      assert.equal(timing.rootMotion.mode,'frame-stepped');
      const ref=input.assets.get(actor)!;
      assert.deepEqual(timing.pivot,ref.ref.pivot);
      const sprite=decodePng(spriteBytes);
      const frames=timing.frames as { phase: string; durationMs: number; rgbaSha256: string; rect: { x:number; y:number; w:number; h:number } }[];
      const root=timing.rootMotion.frames as { rootX:number }[];
      const strip=makeRaster(b.raster.w*(frames.length+1),b.raster.h);
      const placements=input.spec.placements.filter(p=>input.assets.get(p.ref)?.ref.kind !== 'actor');
      const start=x-timing.rootMotion.cyclePx, landing=y+12;
      const half=ref.scale!.bodyHalfWidth;
      for (let pivot=start;pivot<=x;pivot++) for (let u=pivot-half;u<=pivot+half;u++) {
        assert.ok(!covered(b.collisionPlane,u,landing),'Walk route intersects collision.');
      }
      const steps=[];
      for (let i=0;i<=frames.length;i++) {
        const frame=frames[i%frames.length], advance=root[i]?.rootX ?? timing.rootMotion.cyclePx;
        const raster=cut(sprite,frame.rect.x,frame.rect.y,frame.rect.w,frame.rect.h);
        assert.equal(sha256(raster.rgba),frame.rgbaSha256);
        const colors=new Set<number>();
        for(let a=0;a<raster.rgba.length;a+=4) if(raster.rgba[a+3]) colors.add(raster.rgba.readUInt32BE(a));
        const assets=new Map(input.assets).set(actor,{...ref,raster,colors});
        const at:[number,number]=[start+advance,landing];
        const view=renderEnvironment({...input,assets,spec:{...input.spec,placements:[...placements,{id:'walk-actor',ref:actor,at}]}},'B','day');
        blit(strip,view.raster,i*b.raster.w,0);
        steps.push({ phase:frame.phase, at, ms:i===frames.length?0:frame.durationMs });
      }
      await png('playback/'+actor+'.png',strip);
      await publish('playback/'+actor+'.json',Buffer.from(JSON.stringify({ source:base, mode:timing.rootMotion.mode,
        sourceFiles:manifest.files, cyclePx:timing.rootMotion.cyclePx, width:b.raster.w,height:b.raster.h,steps },null,2)+'\n'));
    }
  }
}
const index = { version:1, checkpoint:historical, protectedBaselineHashes:104, packageCount:4, fileCount:Object.keys(files).length, sha256:{...files} };
await publish('benchmark.json',Buffer.from(JSON.stringify(index,null,2)+'\n'));
console.log('E6.1R · 4 packages, '+index.fileCount+' SHA-256, 104 original hashes protected, both E5.4 walk clips verified');
