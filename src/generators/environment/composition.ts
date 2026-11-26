import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fillPolygon, type Point } from '../../core/geometry/shapes.ts';
import { inkLuma,pack } from '../../core/palette/colors.ts';
import { composite,makeRaster,put,type Raster } from '../../core/pixels/raster.ts';
import { sha256 } from '../../quality/raster.ts';
import type { EnvironmentLight } from '../../specs/environment.ts';
import { sceneCompositionSpec, type CompositionBase, type SceneCompositionSpec } from '../../specs/scene-composition.ts';
import { covered } from './refinement.ts';
import { loadEnvironment,renderEnvironment } from './render.ts';

type Environment = Awaited<ReturnType<typeof loadEnvironment>>;
type Asset = NonNullable<ReturnType<Environment['assets']['get']>>;
type Scene = ReturnType<typeof renderEnvironment>;
export type Composition = Awaited<ReturnType<typeof loadComposition>>;
export const baselineRoot = 'benchmarks/results/e61r';
const maskInk = pack('#ffffff');
const colors = {
  primary:'#ffca78',secondary:'#a6d9ff',background:'#82b3b5',foreground:'#c2aaf5',rest:'#91a7a4',readability:'#a7e8b2',
};

export async function loadComposition(raw: unknown) {
  const spec=sceneCompositionSpec.parse(raw);
  const baseline = baselineRoot+'/packages/'+spec.source.kit+'-day/';
  const bytes=await readFile(baseline+'environment-spec.json');
  assert.equal(sha256(bytes),spec.source.specSha256,'Environment Kit spec provenance mismatch.');
  const base = JSON.parse(bytes.toString('utf8')) as CompositionBase;
  assert.equal(base.version,2);
  assert.equal(base.style.sha256,spec.source.styleSha256,'Style profile provenance mismatch.');
  assert.equal(base.terrain.sha256,spec.source.terrainSha256,'Terrain source provenance mismatch.');
  assert.ok(spec.props.every(item=>item.ref==='workbench' || base.assetRefs.some(ref=>ref.kind==='prop'&&ref.id===item.ref)),
    'Composition props must come from the pinned kit or E2.4.');
  assert.ok(spec.props.some(p=>p.ref==='workbench'),'The pinned survey bench anchors an interaction.');
  assert.ok(spec.props.every(p=>!['surveyor','courier','station-shell','entry'].includes(p.id)),'Reserved placement ID.');
  const environment=await loadEnvironment({
    ...base, name:spec.name, seed:spec.seed, terrain:{...base.terrain,map:spec.terrain},
    building:{...base.building,at:spec.building}, path:spec.approach,
    architecture:{...base.architecture, terrainRest:spec.zones.filter(z=>z.role==='rest').map(z=>z.points)},
    placements:[...spec.props,...spec.spawns.map(s=>({id:s.actor,ref:s.actor,at:s.at}))],
  });
  assert.deepEqual([environment.ground.w,environment.ground.h],spec.size,'Terrain grid does not match scene dimensions.');
  return {spec,environment,kitSeed:base.seed};
}

export function anchoredScene(input: Composition, light: EnvironmentLight, actor: string, at: Point, asset?: Asset) {
  const environment = input.environment;
  const assets = asset ? new Map(environment.assets).set(actor,asset) : environment.assets;
  const placements = [...input.spec.props,{id:actor,ref:actor,at:[at[0],at[1]] as [number,number]}];
  return renderEnvironment({...environment,assets,spec:{...environment.spec,placements}},'B',light,{composition:input.spec,kitSeed:input.kitSeed,probe:actor});
}

function region(w: number,h: number,polygons: readonly (readonly Point[])[]) {
  const mask=makeRaster(w,h);
  for(const points of polygons) fillPolygon(mask,points,maskInk);
  return mask;
}

function stain(raster: Raster, mask: Raster, color: number) {
  for(let y=0;y<mask.h;y++) for(let x=0;x<mask.w;x++) if(covered(mask,x,y)) {
    const edge=!covered(mask,x-1,y)||!covered(mask,x+1,y)||!covered(mask,x,y-1)||!covered(mask,x,y+1);
    if(edge || (x+y)%11===0) put(raster,x,y,color);
  }
}

export function pointSweep(points: readonly Point[]) {
  const samples: Point[]=[points[0]];
  for(let i=1;i<points.length;i++) {
    const [x,y]=points[i-1], [tx,ty]=points[i];
    const count=Math.max(Math.abs(tx-x),Math.abs(ty-y));
    for(let t=1;t<=count;t++) samples.push([Math.round(x+(tx-x)*t/count),Math.round(y+(ty-y)*t/count)]);
  }
  return samples;
}

export function routeFits(walkable: Raster, points: readonly Point[], halfWidth: number, label: string) {
  let checked=0;
  for (const [x,y] of pointSweep(points)) for(let dx=-halfWidth;dx<=halfWidth;dx++) {
    assert.ok(covered(walkable,x+dx,y),label+' body hits collision or exits its walkable zone at '+[x+dx,y].join(','));
    checked++;
  }
  return checked;
}

function summarizeTexture(scene: Scene, mask: Raster) {
  const {w,h,rgba}=scene.raster, material=scene.materialMask.rgba;
  let samples=0,edges=0;
  for(let y=0;y<h-1;y++) for(let x=0;x<w-1;x++) {
    if(!covered(mask,x,y)) continue;
    const i=(y*w+x)*4, role=material.readUInt32BE(i);
    if(material.readUInt32BE(i+4)!==role || material.readUInt32BE(i+4*w)!==role) continue;
    samples++;
    const luma=inkLuma(rgba.readUInt32BE(i));
    if(Math.max(Math.abs(luma-inkLuma(rgba.readUInt32BE(i+4))),Math.abs(luma-inkLuma(rgba.readUInt32BE(i+4*w))))>=6) edges++;
  }
  return {samples,edges,per100:samples?Number((edges*100/samples).toFixed(1)):null};
}

export function renderComposition(input: Composition, light: EnvironmentLight) {
  const {spec,environment}=input;
  const scene=renderEnvironment(environment,'B',light,{composition:spec,kitSeed:input.kitSeed});
  const {w,h}=scene.raster;
  const walkable=region(w,h,spec.walkable);
  for(let i=0;i<walkable.rgba.length;i+=4) if(scene.collisionPlane.rgba[i+3]) walkable.rgba.writeUInt32BE(0,i);
  const collisionOverlap=makeRaster(w,h);
  for(const box of scene.metadata.collisions.filter(x=>x.kind==='architecture')) fillPolygon(collisionOverlap,box.points,maskInk);
  for(const box of scene.metadata.collisions.filter(x=>x.kind==='prop')){
    const spot=region(w,h,[box.points]);
    for(let i=0;i<spot.rgba.length;i+=4) if(spot.rgba[i+3]){
      assert.ok(!collisionOverlap.rgba[i+3],box.id+' overlaps a collider.');
      collisionOverlap.rgba.writeUInt32BE(maskInk,i);
    }
  }
  const routeOverlay=composite([scene.collisionOverlay]);
  stain(routeOverlay,walkable,pack('#8adab0'));
  const routes=spec.routes.map(route=>{
    const half=environment.assets.get(route.actor)!.scale!.bodyHalfWidth;
    const tested=routeFits(walkable,route.points,half,route.id);
    for(const [x,y] of pointSweep(route.points)) put(routeOverlay,x,y,pack('#ffe192'));
    return { ...route,halfWidth:half,tested };
  });
  const focalOverlay=composite([scene.raster]);
  const hierarchy=spec.zones.map(zone=>{
    const mask=region(w,h,[zone.points]);
    stain(focalOverlay,mask,pack(colors[zone.role]));
    return {id:zone.id,role:zone.role,...summarizeTexture(scene,mask)};
  });
  const [px,py]=scene.metadata.portal.at;
  const has = (role: SceneCompositionSpec['zones'][number]['role'],x: number,y: number) =>
    spec.zones.some(zone=>zone.role===role&&covered(region(w,h,[zone.points]),x,y));
  assert.ok(has('primary',px,py-12),'Primary focus must contain the entrance.');
  const bench=spec.props.find(p=>p.ref==='workbench')!;
  assert.ok(has('secondary',bench.at[0],bench.at[1]-5),'Secondary focus must contain the survey bench.');
  assert.ok(hierarchy.filter(z=>z.role==='rest').every(z=>z.samples>=300),'Rest areas need a real material surface.');
  for(const spawn of spec.spawns) {
    assert.ok(has('readability',...spawn.at),spawn.actor+' spawn leaves readability zone.');
    routeFits(walkable,[spawn.at],environment.assets.get(spawn.actor)!.scale!.bodyHalfWidth,spawn.actor+' spawn');
  }
  const interactions=spec.interactions.map(zone=>{
    const mask=region(w,h,[zone.points]);
    stain(focalOverlay,mask,pack('#f4e69b'));
    const at=zone.target==='entry'?[px,py+5] as const:spec.props.find(p=>p.id===zone.target)!.at;
    let open=0, nearest=Infinity;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(covered(mask,x,y) && covered(walkable,x,y)){
      open++;
      nearest=Math.min(nearest,Math.abs(x-at[0])+Math.abs(y-at[1]));
    }
    assert.ok(open>=24 && nearest<=16,zone.id+' is not reachable near its target.');
    return {id:zone.id,target:zone.target,walkablePixels:open,nearest};
  });
  return {scene,walkable,routeOverlay,focalOverlay,routes,hierarchy,interactions,zoneLegend:colors};
}

export function spatialProbe(input: Composition, light: EnvironmentLight, probe: SceneCompositionSpec['probes'][number]) {
  const view=anchoredScene(input,light,probe.actor,probe.at);
  const contact=view.metadata.occlusion.find(row=>row.id===probe.actor)!;
  if(probe.occluder) assert.ok(contact.hiddenBy[probe.occluder]>0,input.spec.id+' '+probe.id+' lacks '+probe.occluder+' overlap.');
  else assert.equal(contact.visible,contact.visibleBefore,input.spec.id+' '+probe.id+' should read unobstructed.');
  return {view,contact};
}
