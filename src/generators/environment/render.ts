import { readFile } from 'node:fs/promises';
import { rect } from '../../core/geometry/faces.ts';
import { fillPolygon, type Point } from '../../core/geometry/shapes.ts';
import { inkLuma, pack, unpack } from '../../core/palette/colors.ts';
import { blit, composite, makeRaster, silhouette, type Raster } from '../../core/pixels/raster.ts';
import { decodePng } from '../../core/renderer/png.ts';
import { artStyleProfileSchema, environmentSpecSchema, type EnvironmentFinish, type EnvironmentLight } from '../../specs/environment.ts';
import type { SceneCompositionSpec } from '../../specs/scene-composition.ts';
import { sha256 } from '../../quality/raster.ts';
import { renderTerrain, renderTileGrid, tileIdsForMap } from '../terrain/render.ts';
import { environmentKit, materialLegend, mossInk, wallReturnPx, wallRisePx } from './kit.ts';

import { covered, lanternLight, quietTerrain, readActorScale } from './refinement.ts';
import { buildRuins,canopyGround,connectedPixels } from './ruins.ts';

type Footprint = { id: string; kind: 'architecture' | 'prop'; points: readonly Point[] };
type Piece = ReturnType<typeof environmentKit>['wall'];
type Layer = { id: string; kind: 'building' | 'prop' | 'actor'; at: Point; piece: Piece };
const ownerColors = { terrain: '#364950', path: '#8c735a', shadow: '#3b2c55', building: '#81aeba', prop: '#dc9f64', actor: '#98e2c4' } as const;

const coverage = (r: Raster, x: number, y: number) => r.rgba[(y * r.w + x) * 4 + 3] === 255;
function requireThat(condition: boolean, error: string): asserts condition {
  if (!condition) throw new Error(error);
}
function audit(raster: Raster, legal?: Set<number>) {
  const colors = new Set<number>();
  const alpha = Buffer.alloc(raster.w * raster.h);
  for (let at = 0; at < raster.rgba.length; at += 4) {
    const ink = raster.rgba.readUInt32BE(at);
    requireThat(ink === 0 || (ink & 255) === 255, 'Raster violates binary alpha or transparent RGB.');
    if (ink) {
      requireThat(!legal || legal.has(ink), 'Ink outside scene palette: ' + unpack(ink));
      colors.add(ink);
      alpha[at / 4] = 255;
    }
  }
  requireThat(colors.size > 0, 'Empty raster.');
  return { rgbaSha256: sha256(raster.rgba), alphaSha256: sha256(alpha), colors };
}

export async function loadEnvironment(input: unknown) {
  const spec = environmentSpecSchema.parse(input);
  const profile = await readFile(spec.style.file);
  requireThat(sha256(profile) === spec.style.sha256, 'Style profile provenance mismatch.');
  const style = artStyleProfileSchema.parse(JSON.parse(profile.toString('utf8')));
  const terrainRef = await readFile(spec.terrain.manifest);
  requireThat(sha256(terrainRef) === spec.terrain.sha256, 'Terrain provenance mismatch.');
  const reference = JSON.parse(terrainRef.toString('utf8')) as { kind: unknown; spec: unknown };
  const source = renderTerrain(reference.spec);
  requireThat(reference.kind === 'lumasprite-baked-terrain' && source.spec.version === 4 &&
    source.spec.direction === 'art-directed' && source.spec.variation === 'world', 'Expected a world-baked E3.4 terrain source.');
  const terrain = renderTerrain({ ...source.spec, seed: spec.seed });
  const ground = renderTileGrid(terrain, tileIdsForMap(spec.terrain.map.rows), spec.terrain.map.origin);
  const assets = new Map(await Promise.all(spec.assetRefs.map(async ref => {
    const bytes = await readFile(ref.file);
    requireThat(sha256(bytes) === ref.sha256, ref.id + ': PNG provenance mismatch.');
    requireThat(bytes.length >= 33 && bytes.length < 512 * 1024 && bytes.readUInt32BE(16) <= 128 && bytes.readUInt32BE(20) <= 128, 'Invalid asset PNG bounds.');
    const raster = decodePng(bytes);
    requireThat(ref.kind !== 'actor' || (raster.w === style.actorCanvasPx && raster.h === style.actorCanvasPx), ref.id + ': native actor scale.');
    requireThat(ref.pivot[0] < raster.w && ref.pivot[1] < raster.h && ref.footprint[0] <= raster.w && ref.footprint[1] <= raster.h, ref.id + ': invalid pivot/footprint.');
    requireThat(ref.pivot[1] > 0 && Array.from({ length: raster.w }, (_, x) => x).some(x => coverage(raster, x, ref.pivot[1] - 1)),
      ref.id + ': pivot does not follow the contact row.');
    const scale = spec.version === 2 && ref.kind === 'actor' ? await readActorScale(ref, raster) : undefined;
    return [ref.id, { ref, raster, colors: audit(raster).colors, scale }] as const;
  })));
  return { spec, style, ground, terrain: terrain.material.diagnostics.ramps, assets };
}

export function renderEnvironment(input: Awaited<ReturnType<typeof loadEnvironment>>, finish: EnvironmentFinish,
  illumination: EnvironmentLight, options?: { composition: SceneCompositionSpec; kitSeed: number; probe?: string; flat?: boolean }) {
  const composition = options?.composition;
  const site = composition?.ruins;
  const flat = !!(site && options?.flat);
  const { spec, style, ground, terrain, assets } = input;
  const { w, h } = ground;
  const { seed } = spec;
  const theme = style.illumination[illumination];
  const varied = finish === 'B';
  const architecture = spec.version === 2 ? spec.architecture : undefined;
  requireThat(!architecture || varied, 'Revised architecture requires finish B.');
  const kit = environmentKit(style, finish, illumination, options?.kitSeed ?? seed, architecture);
  const ruins = site ? buildRuins(site,style,illumination,seed,flat) : undefined;
  const blank = () => makeRaster(w, h);
  const testPoint = ([x,y]: Point) => x >= 0 && y >= 0 && x <= w && y <= h;
  const indexAt = (x: number, y: number) => ((y * w) + x) * 4;
  const solid = (r: Raster, color: string, shape: readonly Point[]) => {
    requireThat(shape.every(testPoint), 'Shape lies outside the scene.');
    fillPolygon(r, shape, pack(color));
  };
  const paintGround = blank(), groundMask = blank(), groundOwners = blank();
  const palette = new Set(Object.values(theme.surfaces).flat().concat(theme.grass, theme.dirt, theme.contour).map(pack));
  for (const source of assets.values()) for (const ink of source.colors) palette.add(ink);
  const terrainInks = new Map(['grass','dirt'].flatMap(kind => {
    const key = kind as 'grass' | 'dirt';
    return terrain[key].map((old, i) => [pack(old), [pack(theme[key][i]), pack(materialLegend[key])]] as const);
  }));
  for (let at = 0; at < ground.rgba.length; at += 4) {
    const from = terrainInks.get(ground.rgba.readUInt32BE(at));
    requireThat(from !== undefined, 'Terrain uses an unmapped role.');
    const ink = flat ? pack(from[1] === pack(materialLegend.grass) ? theme.grass[1] : theme.dirt[1]) : from[0];
    paintGround.rgba.writeUInt32BE(ink, at);
    groundMask.rgba.writeUInt32BE(from[1], at);
    groundOwners.rgba.writeUInt32BE(pack(ownerColors.terrain), at);
  }

  requireThat(!architecture || architecture.terrainRest.every(poly => poly.every(testPoint)), 'Terrain rest region exceeds scene.');
  const quietedTerrainPixels = architecture ? quietTerrain(paintGround,groundMask,architecture.terrainRest,theme) : 0;
  if(site && !flat)canopyGround(paintGround,groundMask,composition.zones.filter(z=>z.role==='background').map(z=>z.points),theme,seed);
  const place = (target: Raster, mask: Raster, piece: Piece, [x, y]: Point) => {
    blit(target, piece.raster, x - piece.origin[0], y - piece.origin[1]);
    blit(mask, piece.material, x - piece.origin[0], y - piece.origin[1]);
  };
  const paintPaving = () => {
    if(!composition)return;
    for(const paving of composition.paving){
      solid(paintGround,theme.surfaces.paving[paving.role==='activity'?2:1],paving.points);
      solid(groundMask,materialLegend.paving,paving.points);
      solid(groundOwners,ownerColors.path,paving.points);
    }
  };
  const fillGroundLight = () => {
    const ambient = composition && !flat && illumination === 'night' ? blank() : undefined;
    if (ambient && composition) {
      for (const fill of composition.lighting.fill) {
        const mask = blank();
        solid(mask,'#ffffff',fill.points);
        const role = pack(materialLegend[fill.role]);
        const ink = pack(fill.role === 'paving' ? theme.surfaces.paving[fill.tone] : theme[fill.role][fill.tone] ?? theme.grass[2]);
        for (let i=0;i<mask.rgba.length;i+=4) if (mask.rgba[i+3] && groundMask.rgba.readUInt32BE(i)===role && paintGround.rgba.readUInt32BE(i)!==ink) {
          paintGround.rgba.writeUInt32BE(ink,i);
          ambient.rgba.writeUInt32BE(ink,i);
        }
      }
    }
    return ambient;
  };
  function outpostPlan() {
    const { at: [bx, by], bays, signBay } = spec.building;
    const doorIndex = bays.indexOf('door');
    const doorWidth = kit.door.raster.w;
    const wallHeight = kit.wall.raster.h;
    const doorHeight = architecture?.doorHeight ?? 24;
    const jamb = architecture?.jamb ?? 3;
    const bayX = (index: number) => bx + index * style.tilePx + (index > doorIndex ? doorWidth-style.tilePx : 0);
    const right = bayX(bays.length), width = right-bx, door = bayX(doorIndex);
    requireThat(bx >= 12 && by >= wallHeight+40 && right + 26 < w && by + 25 < h, 'Building exceeds native scene.');
    const portal: Point = [door + doorWidth/2, by];
    const entry = rect(door + jamb, by - 4, door + doorWidth-jamb, by + 4);
    const pathOnly = blank();
    solid(pathOnly, '#ffffff', spec.path);
    requireThat(coverage(pathOnly, portal[0], by + 12), 'Approach path does not reach the door.');
    const pad = [[bx - 13, by + 3], [bx + 16, by - 18], [right + 23, by - 18],
      [right + 20, by + 10], [right + 3, by + 22], [bx - 8, by + 22]] as const;
    paintPaving();
    solid(paintGround, theme.surfaces.paving[1], spec.path);
    solid(groundMask, materialLegend.paving, spec.path);
    solid(groundOwners, ownerColors.path, spec.path);
    solid(paintGround, theme.surfaces.paving[0], pad);
    solid(paintGround, theme.surfaces.paving[2], pad.map(([x,y]) => [x,y - 2] as Point));
    solid(groundMask, materialLegend.paving, pad.map(([x,y]) => [x,y - 2] as Point));
    solid(groundMask, materialLegend.paving, pad);
    solid(groundOwners, ownerColors.path, pad.map(([x,y]) => [x,y - 2] as Point));
    solid(groundOwners, ownerColors.path, pad);
    if (varied && !architecture) {
      for (let row = 0; row < 3; row++) {
        const y = by + 3 + row * 5;
        for (let x = bx - 9 + (row % 2) * 6; x < right + 9; x += 13) {
          if (groundMask.rgba.readUInt32BE(indexAt(x, y)) !== pack(materialLegend.paving)) continue;
          for (let i = 0; i < style.detailSpan && x + i < w; i++) {
            if (groundMask.rgba.readUInt32BE(indexAt(x + i, y)) === pack(materialLegend.paving)) {
              paintGround.rgba.writeUInt32BE(pack(theme.surfaces.paving[i < 2 ? 3 : 1]), indexAt(x + i, y));
            }
          }
        }
      }
      for (let y = by + 29; y < h - 2; y += 12) {
        const left = Array.from({ length: w }, (_, x) => x).find(x => coverage(pathOnly, x, y));
        if (left === undefined) continue;
        for (let i = 2; i < 2 + style.detailSpan && left + i < w; i++) {
          if (coverage(pathOnly, left + i, y)) {
            paintGround.rgba.writeUInt32BE(pack(theme.surfaces.paving[2]), indexAt(left + i, y));
          }
        }
      }
      if (illumination === 'night') {
        solid(paintGround, theme.surfaces.wood[2], [[door-9,by+3],[door+2,by+3],[door+5,by+7],[door-7,by+7]]);
      }
    }
    if (architecture) {
      // Sparse, staggered clusters along the landing rather than a regular tiling grid.
      for (const [dx,dy,length] of [[-25,7,7],[-19,8,5],[-14,17,8],[-2,13,4],[14,15,8],[33,8,5],[37,7,9],[51,14,8]]) {
        for (let x=door+dx;x<door+dx+length;x++) {
          const at=indexAt(x,by+dy);
          if (x>=0 && x<w && groundMask.rgba.readUInt32BE(at) === pack(materialLegend.paving)) {
            paintGround.rgba.writeUInt32BE(pack(theme.surfaces.paving[1]),at);
          }
        }
      }
    }
    const tread = rect(door + 1, by, door + doorWidth-1, by + 5);
    solid(paintGround, theme.surfaces.paving[1], tread);
    solid(paintGround, theme.surfaces.paving[3], rect(door + 1, by + 3, door + doorWidth-1, by + 4));
    solid(groundMask, materialLegend.paving, tread);
    solid(groundOwners, ownerColors.path, tread);

    if (composition) {
      const work=composition.props.find(p=>p.ref==='workbench');
      if (work) {
        const [x,y]=work.at;
        for (const [dx,dy,length] of [[-14,5,7],[4,8,8],[-19,15,6],[10,17,11]]) {
          for (let u=x+dx;u<x+dx+length;u++) if (u>=0 && u<w && y+dy<h) {
            const i=indexAt(u,y+dy);
            if (groundMask.rgba.readUInt32BE(i)===pack(materialLegend.paving)) {
              paintGround.rgba.writeUInt32BE(pack(theme.surfaces.paving[1]),i);
            }
          }
        }
      }
    }
    const ambient = fillGroundLight();

    const wallRaster = blank(), wallMaterials = blank();
    bays.forEach((bay, index) => place(wallRaster, wallMaterials, kit[bay], [bayX(index), by]));
    place(wallRaster, wallMaterials, kit.corner, [right, by]);
    let seamSamples = 0;
    for (let i = 1; i <= bays.length; i++) for (let y = by - wallHeight + 2; y < by; y++) {
      requireThat(coverage(wallRaster, bayX(i) - 1, y) && coverage(wallRaster, bayX(i), y), 'Open seam at front or corner.');
      seamSamples++;
    }
    const roof = kit.roof(width);
    const mounts = { sign: [bayX(signBay) + 8, by - (architecture ? 27 : 21)] as Point,
      lamp: [door - 5, by - (architecture ? 42 : 24)] as Point,
      nearestPost: [bx + 2, by] as Point, farPost: [right - 2, by] as Point, eave: [bx, by - wallHeight + 3] as Point };
    if (architecture) {
      for (let y=by-doorHeight;y<by;y++) for (let x=door+jamb;x<door+doorWidth-jamb;x++) {
        requireThat(!coverage(wallRaster,x,y), 'Revised entrance aperture is painted shut.');
      }
    }
    place(wallRaster, wallMaterials, kit.post, mounts.nearestPost);
    place(wallRaster, wallMaterials, kit.post, mounts.farPost);
    place(wallRaster, wallMaterials, roof, mounts.eave);
    if (architecture) {
      const row = roof.origin[1]-2;
      for (let x=bx;x<right;x++) {
        requireThat(covered(roof.raster,x-bx+roof.origin[0],row), 'Roof eave lifts away from the wall.');
        seamSamples++;
      }
    }
    place(wallRaster, wallMaterials, kit.sign, mounts.sign);
    const bench = spec.placements.find(item=>item.ref === 'workbench');
    const lights = architecture && illumination === 'night' ? lanternLight(paintGround,wallRaster,wallMaterials,groundMask,theme,
      { x: door, y: by, width: doorWidth, top: by-doorHeight, jamb }, mounts.lamp,
      bays.flatMap((bay,i)=>bay === 'window' ? [[bayX(i),by-wallHeight] as Point] : []),
      bench?.at, composition?.lighting.workbench) : undefined;
    place(wallRaster, wallMaterials, kit.lamp, mounts.lamp);
    const recess = blank(), recessMaterials = blank();
    if (architecture) {
      const top = by-doorHeight, end = door+doorWidth-jamb;
      solid(recess,theme.contour,rect(door+jamb,top,end,by));
      solid(recess,theme.surfaces.wood[0],[[end-6,top],[end,top],[end,by],[end-9,by-6]]);
      solid(recess,theme.surfaces.paving[0],[[door+jamb,by-4],[end-7,by-6],[end,by],[door+jamb,by]]);
      solid(recess,theme.surfaces.wood[illumination === 'night' ? 0 : 1],
        [[end-4,top],[end-2,top],[end-2,by-6],[end-4,by-8]]);
      solid(recessMaterials,materialLegend.contour,rect(door+jamb,top,end,by));
      if (composition) {
        const left=door+jamb;
        solid(recess,theme.surfaces.wood[0],[[left,top],[left+7,top+5],[left+7,by-10],[left,by-4]]);
        solid(recess,theme.surfaces.wood[1],[[left+2,top+5],[left+4,top+7],[left+4,by-10],[left+2,by-8]]);
        solid(recess,theme.surfaces.paving[1],[[left,by-1],[left+8,by-7],[end-9,by-7],[end,by-1]]);
        solid(recess,theme.surfaces.paving[2],rect(left+4,by-3,end-4,by-2));
        if (illumination === 'night') {
          solid(recess,theme.surfaces.amber[0],[[left+1,by-3],[left+8,by-6],[end-10,by-6],[end-6,by-3]]);
          solid(ambient!,theme.surfaces.amber[0],[[left+1,by-3],[left+8,by-6],[end-10,by-6],[end-6,by-3]]);
        }
        solid(recessMaterials,materialLegend.wood,[[left,top],[left+7,top+5],[left+7,by-10],[left,by-4]]);
        solid(recessMaterials,materialLegend.paving,[[left,by-1],[left+8,by-7],[end-9,by-7],[end,by-1]]);
      }
    }
    const layers: Layer[] = [{ id: 'station-shell', kind: 'building', at: spec.building.at,
      piece: { raster: wallRaster, material: wallMaterials, origin: spec.building.at } }];
    const collision: Footprint[] = [
      { id: 'left-return', kind: 'architecture', points: [[bx,by],[bx+4,by],[bx+4+wallReturnPx,by-wallRisePx],[bx+wallReturnPx,by-wallRisePx]] },
      { id: 'right-return', kind: 'architecture', points: [[right-4,by],[right,by],[right+wallReturnPx,by-wallRisePx],[right+wallReturnPx-4,by-wallRisePx]] },
      { id: 'back-wall', kind: 'architecture', points: rect(bx+wallReturnPx,by-wallRisePx-4,right+wallReturnPx,by-wallRisePx) },
    ];
    bays.forEach((bay, index) => {
      const x = bayX(index);
      const strips = bay === 'door' ? [[x,x+jamb],[x+doorWidth-jamb,x+doorWidth]] : [[x,x+style.tilePx]];
      strips.forEach(([left, end], j) => collision.push({ id: 'front-' + index + '-' + j, kind: 'architecture', points: rect(left,by-4,end,by) }));
    });
    return { bx,by,right,door,portal,entry,doorWidth,doorHeight,jamb,wallHeight,mounts,seamSamples,layers,collision,ambient,lights,recess,recessMaterials,roof,
      roofOverhang:[roof.origin[0],roof.raster.w-width-roof.origin[0]-wallReturnPx],
      footprint:[[bx,by],[right,by],[right+wallReturnPx,by-wallRisePx],[bx+wallReturnPx,by-wallRisePx]],
      windowSillsY:bays.flatMap((bay,i)=>bay === 'window' ? [[bayX(i),by-wallHeight+38]] : []) };
  }
  function ruinsPlan(plan: NonNullable<typeof ruins>) {
    const {gateway}=plan;
    const {at:[bx,by],width:doorWidth,height:wallHeight,opening,depth}=gateway;
    const jamb=(doorWidth-opening)/2, right=bx+doorWidth, x=bx+doorWidth/2;
    const portal:[number,number]=[x,by];
    const entry=rect(bx+jamb,by-4,right-jamb,by+4);
    const pathMask=blank();
    solid(pathMask,'#ffffff',spec.path);
    requireThat(covered(pathMask,x,by+12),'Ruins approach does not reach the gateway.');
    solid(paintGround,theme.dirt[2],spec.path);
    solid(groundMask,materialLegend.dirt,spec.path);
    solid(groundOwners,ownerColors.path,spec.path);
    const layers:Layer[]=[], collision:Footprint[]=[];
    paintPaving();
    const signal=plan.modules.find(m=>m.module.kind==='signal')!.module;
    let seamSamples=0;
    for(const {module,piece} of plan.modules){
      seamSamples+=connectedPixels(piece.raster);
      const [mx,my]=module.at;
      const end=mx+module.width, rise=Math.floor(module.depth/2);
      if(module.kind==='platform'){
        place(paintGround,groundMask,piece,module.at);
        blit(groundOwners,silhouette(piece.raster,pack(ownerColors.path)),mx,my-piece.origin[1]);
        continue;
      }
      layers.push({id:module.id,kind:'building',at:module.at,piece});
      const strips=module.kind==='gateway'?[[mx,mx+jamb],[end-jamb,end]]:[[mx,end]];
      for(const [i,[left,stop]] of strips.entries()){
        const points:Point[]=[[left,my],[stop,my],[stop,my-4],[stop+rise,my-rise-4],[left+rise,my-rise-4],[left,my-4]];
        collision.push({id:module.id+(strips.length>1?'-'+i:''),kind:'architecture',points});
      }
    }
    const ambient=fillGroundLight(), pools=blank(), glaze=blank();
    let lights: {pools:Raster;glaze:Raster}|undefined;
    if(illumination==='night' && !flat && signal.kind==='signal' && signal.lit){
      const [u,v]=signal.at, c=u+Math.floor(signal.width/2)+2, crown=v-signal.height+7;
      solid(pools,theme.surfaces.amber[0],[[u-4,v+1],[u+signal.width+2,v],[u+signal.width+7,v+7],[u+12,v+11],[u-8,v+7]]);
      solid(pools,theme.surfaces.amber[1],[[u+1,v+3],[u+signal.width-2,v+3],[u+signal.width+1,v+6],[u+6,v+7]]);
      solid(glaze,theme.surfaces.amber[3],rect(c,crown,c+1,crown+1));
      for(let i=0;i<pools.rgba.length;i+=4)if(pools.rgba[i+3]){
        const role=groundMask.rgba.readUInt32BE(i);
        if(role===pack(materialLegend.paving) || role===pack(materialLegend.dirt)) paintGround.rgba.writeUInt32BE(pools.rgba.readUInt32BE(i),i);
        else pools.rgba.writeUInt32BE(0,i);
      }
      lights={pools,glaze};
    }
    return {bx,by,right,door:bx,portal,entry,doorWidth,doorHeight:60,jamb,wallHeight,mounts:{signal:signal.at},seamSamples,
      layers,collision,ambient,lights,recess:blank(),recessMaterials:blank(),roof:undefined,roofOverhang:[],
      footprint:[[bx,by],[right,by],[right+depth,by-Math.floor(depth/2)],[bx+depth,by-Math.floor(depth/2)]],windowSillsY:[]};
  }
  const { bx,by,right,door,portal,entry,doorWidth,doorHeight,jamb,wallHeight,mounts,seamSamples,layers,collision,ambient,lights,
    recess,recessMaterials,roof,roofOverhang,footprint,windowSillsY } = ruins ? ruinsPlan(ruins) : outpostPlan();
  for (const item of spec.placements) {
    requireThat(item.id !== 'station-shell', 'Placement conflicts with building layer.');
    const [x,y] = item.at;
    if (item.ref === 'workbench') {
      layers.push({ id: item.id, kind: 'prop', at: item.at, piece: kit.workbench });
      collision.push({ id: item.id, kind: 'prop', points: rect(x-13,y-5,x+12,y) });
      continue;
    }
    const { ref, raster } = assets.get(item.ref)!;
    layers.push({ id: item.id, kind: ref.kind, at: item.at,
      piece: { raster, material: silhouette(raster, pack(materialLegend[ref.kind])), origin: ref.pivot } });
    if (ref.kind === 'prop') {
      const [width, depth] = ref.footprint, left = x - Math.floor(width / 2);
      collision.push({ id: item.id, kind: 'prop', points: rect(left,y-depth,left+width,y) });
    }
  }
  const collisionPlane = blank();
  for (const box of collision) solid(collisionPlane, box.kind === 'prop' ? '#ffbf76' : '#e87e82', box.points);
  for (let y = by - 8; y <= by + 12; y++) requireThat(!coverage(collisionPlane, portal[0], y), 'Threshold is blocked.');
  const entryPixel = portal[0], leftJamb = door + 1, rightJamb = door + doorWidth - 2;
  requireThat(coverage(collisionPlane,leftJamb,by-2) && coverage(collisionPlane,rightJamb,by-2), 'Door jambs must be solid.');
  for (const layer of layers.filter(x => x.kind === 'actor')) {
    const [x,y] = layer.at;
    requireThat(x < w && y < h && !coverage(collisionPlane,x,y), 'Actor stands in collision: ' + layer.id);
  }

  const groundClearance = (x: number, y: number) => {
    for (let radius=0;radius<16;radius++) {
      for (let d=-radius;d<=radius;d++) {
        if (covered(collisionPlane,x+d,y-radius) || covered(collisionPlane,x+d,y+radius) ||
            covered(collisionPlane,x-radius,y+d) || covered(collisionPlane,x+radius,y+d)) return radius;
      }
    }
    return 16;
  };
  const fit = architecture ? [...assets.values()].filter(asset=>asset.scale).map(({ scale, ref })=>{
    const { silhouette, jacket, shoulderSpan, bodyHalfWidth } = scale!;
    const clearWidth = doorWidth - 2*jamb;
    requireThat(doorHeight >= silhouette.height+2 && clearWidth >= 2*bodyHalfWidth+3, ref.id + ': entrance does not fit the reference actor.');
    let testedPixels = 0;
    for (let y=by-7;y<=by+12;y++) for (let x=portal[0]-bodyHalfWidth;x<=portal[0]+bodyHalfWidth;x++) {
      requireThat(!coverage(collisionPlane,x,y), ref.id + ': projected body sweep touches a collider.');
      testedPixels++;
    }
    return { id: ref.id, nativeCanvas: style.actorCanvasPx, pivot: ref.pivot, silhouette, jacket, shoulderSpan,
      bodyHalfWidth, testedPixels, clearWidth, doorHeight };
  }) : [];
  const contact = blank(), shadow = blank();
  const [sx, sy] = varied ? style.cast : [2, 2];
  if(ruins){
    for(const {module} of ruins.modules) {
      if(module.kind==='platform')continue;
      const [x,y]=module.at;
      const strips=module.kind==='gateway'?[[x,x+jamb],[x+module.width-jamb,x+module.width]]:[[x,x+module.width]];
      for(const [left,end] of strips)solid(contact,'#ffffff',[[left,y-1],[end,y-2],[end+sx+2,y+sy],[left+2,y+sy]]);
    }
  }else{
    solid(contact,'#ffffff',[[bx-1,by-1],[right,by-1],[right+14,by-wallRisePx],[right+17+sx,by-wallRisePx+1+sy],
      [right+sx,by+sy],[bx-1,by+sy]]);
  }
  for (const layer of layers) {
    if (layer.kind === 'building') continue;
    const [x,y] = layer.at, radius = layer.kind === 'actor' ? 7 : 10;
    solid(contact,'#ffffff',[[x-radius,y-1],[x+radius-2,y-1],[x+radius+sx,y+sy-1],[x-radius+3,y+sy]]);
  }
  for (let at = 0; at < contact.rgba.length; at += 4) {
    if (!contact.rgba[at + 3] || (architecture && lights?.pools.rgba[at + 3] &&
      (at/4 % w < door-2 || at/4 % w > door+doorWidth+2 || Math.floor(at/4/w) > by+2))) continue;
    const region = groundMask.rgba.readUInt32BE(at);
    const ink = region === pack(materialLegend.grass) ? theme.grass[0]
      : region === pack(materialLegend.dirt) ? theme.dirt[0] : theme.surfaces.paving[0];
    shadow.rgba.writeUInt32BE(pack(ink), at);
  }

  const raster = composite([paintGround, shadow, recess]);
  const materialMask = composite([groundMask, silhouette(shadow, pack(materialLegend.shadow)), recessMaterials]);
  const layerOverlay = composite([groundOwners, silhouette(shadow, pack(ownerColors.shadow)), silhouette(recess,pack(ownerColors.building))]);
  const owners = new Int16Array(w * h).fill(-1);
  layers.sort((a,b) => a.at[1] - b.at[1] || a.id.localeCompare(b.id));
  const bounds = layers.map(({ id, kind, at, piece }, layerIndex) => {
    const [left, top] = [at[0] - piece.origin[0], at[1] - piece.origin[1]];
    place(raster, materialMask, piece, at);
    blit(layerOverlay, silhouette(piece.raster, pack(ownerColors[kind])), left, top);
    let visibleBefore = 0;
    for (let y = 0; y < piece.raster.h; y++) for (let x = 0; x < piece.raster.w; x++) {
      if (!coverage(piece.raster,x,y)) continue;
      owners[(top+y)*w+left+x] = layerIndex;
      visibleBefore++;
    }
    return { id, kind, at, left, top, w: piece.raster.w, h: piece.raster.h, visibleBefore, alphaSha256: audit(piece.raster).alphaSha256 };
  });

  const collisionOverlay = composite([raster]);
  for (let at = 0; at < collisionPlane.rgba.length; at += 4) {
    const x = at / 4 % w, y = Math.floor(at / 4 / w);
    if (collisionPlane.rgba[at+3] && (x+y)%3 === 0) collisionOverlay.rgba.writeUInt32BE(collisionPlane.rgba.readUInt32BE(at),at);
  }
  solid(collisionOverlay,'#96efca',rect(entryPixel-1,by-8,entryPixel+1,by+8));
  if (architecture) {
    const half = Math.max(0,...fit.map(actor=>actor.bodyHalfWidth));
    for (const x of [entryPixel-half,entryPixel+half]) solid(collisionOverlay,'#96efca',rect(x,by-7,x+1,by+13));
  }

  const occlusion = bounds.map((item, i) => {
    const hiddenBy: Record<string, number> = {};
    let visible = 0, contactPixels = 0, visibleContactPixels = 0;
    const source = layers[i].piece.raster;
    const contrast: number[] = [];
    for (let y = 0; y < item.h; y++) for (let x = 0; x < item.w; x++) {
      if (!coverage(source,x,y)) continue;
      const gx = item.left+x, gy = item.top+y, occupant = owners[gy*w+gx];
      const onContact = item.kind === 'actor' && gy >= item.at[1]-3 && gy < item.at[1];
      if (onContact) contactPixels++;
      if (occupant !== i) {
        const id = bounds[occupant].id;
        hiddenBy[id] = (hiddenBy[id] ?? 0) + 1;
        continue;
      }
      visible++;
      if (onContact) visibleContactPixels++;
      if (item.kind !== 'actor') continue;
      if (architecture) requireThat(raster.rgba.readUInt32BE(indexAt(gx,gy)) === source.rgba.readUInt32BE((y*source.w+x)*4),
        'Visible character colors differ from the locked reference.');
      const a = raster.rgba.readUInt32BE(indexAt(gx,gy));
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = gx + dx, ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || owners[ny*w+nx] === i) continue;
        contrast.push(Math.abs(inkLuma(a) - inkLuma(raster.rgba.readUInt32BE(indexAt(nx,ny)))));
      }
    }
    contrast.sort((a,b)=>a-b);
    requireThat(item.kind !== 'actor' || item.id === options?.probe || visible >= item.visibleBefore * .65, 'Actor is obscured by scene layers: ' + item.id);
    return { ...item, visible, hiddenBy, edgeSamples: contrast.length, p10LumaGap: contrast[Math.floor(contrast.length / 10)] ?? null,
      ...(architecture && item.kind === 'actor' ? { contactPixels, visibleContactPixels, groundClearance: groundClearance(...item.at) } : {}) };
  });

  const inkRows = Object.entries(theme.surfaces).map(([name, ramp]) => {
    const luma = ramp.map(ink => inkLuma(pack(ink)));
    requireThat(new Set(ramp).size === 4 && luma.every((v,i) => i === 0 || v > luma[i-1]), 'Invalid material ramp order: ' + name);
    return { material: name, ramp, luma };
  });
  const separation = inkRows.flatMap((a,i) => inkRows.slice(i+1).map(b => ({
    materials: [a.material,b.material], equalInks: a.ramp.filter(ink => b.ramp.includes(ink)),
    midtoneGap: Math.abs(a.luma[1] - b.luma[1]),
  })));
  const qa = audit(raster,palette);
  const kitEntries = { wall: kit.wall, door: kit.door, window: kit.window, corner: kit.corner,
    column: kit.post, roof:roof!, compass: kit.sign, lamp: kit.lamp, workbench: kit.workbench };
  const pieces = ruins ? ruins.modules.map(({module,piece})=>[module.id,piece] as const) : Object.entries(kitEntries);
  const atlas = makeRaster(pieces.reduce((sum, [,v]) => sum+v.raster.w+3,3), Math.max(...pieces.map(([,v])=>v.raster.h))+6);
  const atlasMaterials = makeRaster(atlas.w,atlas.h);
  let left = 3;
  const atlasCells = pieces.map(([id, piece]) => {
    const at = [left,3] as const;
    blit(atlas,piece.raster,...at);
    blit(atlasMaterials,piece.material,...at);
    left += piece.raster.w+3;
    const { rgbaSha256, alphaSha256 } = audit(piece.raster,palette);
    return { id, at, size: [piece.raster.w,piece.raster.h], pivot: piece.origin, rgbaSha256, alphaSha256 };
  });
  requireThat(audit(atlas,palette).alphaSha256 === audit(atlasMaterials).alphaSha256, 'Atlas material coverage differs.');
  const nightLight = lights ? composite(ambient ? [ambient,lights.pools,lights.glaze] : [lights.pools,lights.glaze]) :
    ruins && ambient?.rgba.some((value,i)=>i%4===3 && value===255) ? ambient : undefined;
  const architectureSilhouette=ruins ? blank() : undefined;
  if(architectureSilhouette && ruins)for (const {module,piece} of ruins.modules) {
    blit(architectureSilhouette,silhouette(piece.raster,pack('#ffffff')),module.at[0],module.at[1]-piece.origin[1]);
  }
  if (nightLight) audit(nightLight,palette);
  const metadata = {
    version: 1, camera: { width: w, height: h, sampling: 'nearest', view: style.view, pixelsPerUnit: style.pixelsPerUnit },
    finish: 'ENV-' + finish, illumination, keyLight: style.keyLight, mounts, seamSamples, portal: { at: portal, points: entry },
    collisions: collision, layerOrder: bounds.map(x => x.id), occlusion, palette: {
      allowed: [...palette].map(unpack).sort(), used: [...qa.colors].map(unpack).sort(), ramps: inkRows,
      warnings: separation.filter(x=> x.equalInks.length || x.midtoneGap < style.minMaterialLumaGap),
    }, atlas: { cells: atlasCells, materialLegend:ruins?{...materialLegend,moss:mossInk}:materialLegend, layerLegend: ownerColors }, rgbaSha256: qa.rgbaSha256, alphaSha256: qa.alphaSha256,
    ...(architecture ? { refinement: { geometry: { wallHeight, doorWidth, doorHeight, jamb, fit,
      roofOverhang, footprint, windowSillsY,
    }, quietedTerrainPixels, nightLightPixels: nightLight?.rgba.filter((value,i)=>i%4===3 && value===255).length ?? 0 } } : {}),
    ...(ruins ? {ruins:{ modules:ruins.modules.map(({module})=>module), flat, supportPixels:seamSamples }} : {}),
  };
  return { raster, materialMask, layerOverlay, collisionOverlay, collisionPlane, atlas, atlasMaterials, metadata, nightLight,architectureSilhouette };
}
