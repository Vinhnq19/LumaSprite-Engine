import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { rect } from '../../core/geometry/faces.ts';
import { fillPolygon, type Point } from '../../core/geometry/shapes.ts';
import { pack } from '../../core/palette/colors.ts';
import { makeRaster, type Raster } from '../../core/pixels/raster.ts';
import { sha256 } from '../../quality/raster.ts';
import type { EnvironmentSpec, StyleProfile } from '../../specs/environment.ts';
import { unpackPartMask } from '../character/production.ts';
import { materialLegend } from './kit.ts';

export const covered = (r: Raster, x: number, y: number) =>
  x >= 0 && x < r.w && y >= 0 && y < r.h && r.rgba[(y * r.w + x) * 4 + 3] === 255;

export async function readActorScale(ref: EnvironmentSpec['assetRefs'][number], raster: Raster) {
  const folder = dirname(ref.file);
  const pinnedJson = async (file: string, expected: string) => {
    const bytes = await readFile(join(folder,file));
    if (sha256(bytes) !== expected) throw new Error(ref.id + ': scale evidence checksum mismatch at ' + file);
    return JSON.parse(bytes.toString('utf8'));
  };
  const manifest = await pinnedJson('manifest.json', ref.scaleManifestSha256!);
  if (manifest.files['final.png'] !== ref.sha256 || String(manifest.groundPivot) !== String(ref.pivot)) {
    throw new Error(ref.id + ': scale evidence references a different sprite or pivot.');
  }
  const { landmarks } = await pinnedJson('shape-lock.json', manifest.files['shape-lock.json']);
  const { masks, w, h } = await pinnedJson('part-masks.json', manifest.files['part-masks.json']);
  if (w !== raster.w || h !== raster.h) throw new Error(ref.id + ': scale mask dimensions differ from the sprite.');
  const jacket = unpackPartMask(masks.jacket, w*h);
  const extent = (includes: (x: number, y: number) => boolean) => {
    let left = w, right = -1, top = h, bottom = -1;
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) if (includes(x,y)) {
      left = Math.min(left,x); right = Math.max(right,x); top = Math.min(top,y); bottom = Math.max(bottom,y);
    }
    if (right < left) throw new Error(ref.id + ': empty scale reference.');
    return { left, right, top, bottom, width: right-left+1, height: bottom-top+1 };
  };
  const silhouette = extent((x,y)=>covered(raster,x,y));
  const torso = extent((x,y)=>jacket[y*w+x] !== 0);
  if (silhouette.bottom+1 !== ref.pivot[1]) throw new Error(ref.id + ': pivot must sit one pixel below ground contact.');
  return {
    silhouette, jacket: torso,
    shoulderSpan: Math.abs(landmarks['near-shoulder'].point[0] - landmarks['far-shoulder'].point[0]),
    // The projected fit includes clearance around the jacket. Equipment can overlap a jamb.
    bodyHalfWidth: Math.max(ref.pivot[0]-torso.left, torso.right-ref.pivot[0])+1,
  };
}

export function quietTerrain(ground: Raster, materials: Raster, areas: readonly Point[][], theme: StyleProfile['illumination']['day']) {
  const mask = makeRaster(ground.w,ground.h);
  for (const polygon of areas) fillPolygon(mask,polygon,pack('#ffffff'));
  let changed = 0;
  for (const kind of ['grass','dirt'] as const) {
    const material = pack(materialLegend[kind]), base = pack(theme[kind][1]), dark = pack(theme[kind][0]);
    for (let y=3;y<ground.h-3;y++) for (let x=3;x<ground.w-3;x++) {
      const at = (y*ground.w+x)*4, step = ground.w*4;
      if (!mask.rgba[at+3] || materials.rgba.readUInt32BE(at) !== material) continue;
      const ink = ground.rgba.readUInt32BE(at);
      if (ink === base || (kind === 'grass' && ink === dark) || ![-12,12,-3*step,3*step].every(offset =>
        materials.rgba.readUInt32BE(at+offset) === material)) continue;
      ground.rgba.writeUInt32BE(base,at);
      changed++;
    }
  }
  return changed;
}

export function lanternLight(ground: Raster, shell: Raster, wallMaterials: Raster, groundMaterials: Raster,
  theme: StyleProfile['illumination']['night'], door: { x: number; y: number; width: number; top: number; jamb: number },
  lamp: Point, windows: readonly Point[], bench?: Point) {
  const { x, y, width, top, jamb } = door;
  const [lx,ly] = lamp;
  const glaze = makeRaster(ground.w,ground.h);
  const pools = makeRaster(ground.w,ground.h);
  const amber = theme.surfaces.amber;
  const plot = (target: Raster, tone: number, points: readonly Point[]) => fillPolygon(target,points,pack(amber[tone]));
  // Broken planes keep the walls cool and the entrance distinctly warmer.
  plot(glaze,0,[[lx+1,ly+8],[x+jamb,ly+4],[x+jamb+1,ly+29],[lx-8,ly+34],[lx-5,ly+18]]);
  plot(glaze,1,[[lx-3,ly+9],[x+jamb+1,ly+7],[x+jamb,ly+22],[lx-5,ly+22]]);
  plot(glaze,2,rect(x+1,ly+10,x+2,ly+23));
  plot(glaze,1,rect(x+3,top-2,x+width-6,top-1));
  windows.forEach(([wx,wy], index) => {
    plot(glaze,index === 0 ? 1 : 0,[[wx+4,wy+18],[wx+11,wy+18],[wx+10,wy+32],[wx+4,wy+34]]);
    plot(glaze,index === 0 ? 2 : 1,rect(wx+4,wy+19,wx+6,wy+25));
    plot(glaze,1,rect(wx+9,wy+28,wx+11,wy+31));
  });
  plot(pools,0,[[x+1,y+1],[x+width-2,y+1],[x+width+4,y+10],[x+width-9,y+15],[x-6,y+9]]);
  plot(pools,1,[[x+4,y],[x+width-5,y],[x+width+4,y+8],[x+width-12,y+11],[x-3,y+7]]);
  plot(pools,2,rect(x+4,y+3,x+width-6,y+4));
  if (bench) {
    const [bx,by] = bench;
    plot(pools,0,[[bx-8,by-1],[bx+8,by-1],[bx+12,by+4],[bx+2,by+7],[bx-10,by+4]]);
    plot(pools,1,rect(bx-6,by+2,bx+5,by+3));
  }
  const paving = pack(materialLegend.paving), wood = pack(materialLegend.wood), metal = pack(materialLegend.metal);
  for (let at=0;at<glaze.rgba.length;at+=4) {
    const role = wallMaterials.rgba.readUInt32BE(at);
    if (glaze.rgba[at+3] && role !== wood && role !== metal) glaze.rgba.writeUInt32BE(0,at);
    if (pools.rgba[at+3] && groundMaterials.rgba.readUInt32BE(at) !== paving) pools.rgba.writeUInt32BE(0,at);
    if (pools.rgba[at+3]) ground.rgba.writeUInt32BE(pools.rgba.readUInt32BE(at),at);
    if (glaze.rgba[at+3]) shell.rgba.writeUInt32BE(glaze.rgba.readUInt32BE(at),at);
  }
  return { glaze, pools };
}
