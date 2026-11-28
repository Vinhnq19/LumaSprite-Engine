import assert from 'node:assert/strict';
import { fillPolygon, type Point } from '../core/geometry/shapes.ts';
import { pack } from '../core/palette/colors.ts';
import { composite, makeRaster, type Raster } from '../core/pixels/raster.ts';

export const costumeStanceVersion = 'costume-stance-v2';
export type Costume = 'short-jacket' | 'long-coat' | 'tunic' | 'a-line' | 'cloak' | 'apron';
export type Leg = { thigh: Raster; shin: Raster; boot: Raster; knee: Point; ankle: Point; ground: number };
const hemProfile: Record<Costume, [number, number, number]> = {
  'short-jacket': [.42, 0, 1],
  'long-coat': [1.24, .14, 2],
  tunic: [.82, .07, 1],
  'a-line': [1.10, .25, 2],
  cloak: [.38, 0, 2],
  apron: [1.00, .20, 1],
};

export function costumePanel(costume: Costume, hip: Point, knees: readonly Point[], ankles: readonly Point[], waist: number) {
  const [x, y] = hip;
  const knee = Math.max(...knees.map(p => p[1]));
  const ankle = Math.min(...ankles.map(p => p[1]));
  assert.ok(y < knee && knee < ankle, 'COSTUME_LANDMARKS');
  const [length, flare, slope] = hemProfile[costume];
  const hem = Math.min(ankle - 3, y + Math.round((knee - y) * length));
  const spread = waist + Math.round((hem-y) * flare);
  const raster = makeRaster(64, 64);
  fillPolygon(raster, [[x-waist,y-3],[x+waist,y-3],[x+spread,hem-slope-2],
    [x+spread-1,hem-1],[x+1,hem+1],[x-spread,hem-1],[x-spread+1,hem-4]], pack('#ffffff'));
  return { raster, hem };
}

export const occupied = (mask: Raster, x: number, y: number) =>
  x>=0 && x<mask.w && y>=0 && y<mask.h && mask.rgba[(y*mask.w+x)*4+3]===255;
export const maskPixels = (mask: Raster) => Array.from({length:mask.w*mask.h},(_,i)=>i)
  .filter(i=>mask.rgba[i*4+3]===255);

export function inspectCostumeStance(legs: readonly [Leg,Leg], garment: Raster, silhouette: Raster, pivot: Point) {
  const limbs = legs.map(leg => composite([leg.shin,leg.boot]));
  const rows = [];
  for(let y=Math.max(...legs.map(leg=>leg.knee[1]))+2;y<pivot[1]-2;y++){
    const span=(mask:Raster)=>Array.from({length:mask.w},(_,x)=>x).filter(x=>occupied(mask,x,y));
    const left=span(limbs[0]).at(-1), right=span(limbs[1])[0];
    if(left===undefined||right===undefined||right-left<4)continue;
    const mid=Math.floor((left+right)/2);
    rows.push({y,left,right,mid,cloth:occupied(garment,mid,y),clear:!occupied(silhouette,mid,y)});
  }
  const feet=legs.map(leg=>{
    const pixels=maskPixels(leg.boot);
    const left=Math.min(...pixels.map(i=>i%leg.boot.w)), right=Math.max(...pixels.map(i=>i%leg.boot.w));
    const contact=Math.floor((pixels.at(-1)??-1)/leg.boot.w);
    const shin=pixels.some(i=>occupied(leg.shin,i%leg.boot.w,Math.floor(i/leg.boot.w)));
    const knee=occupied(leg.thigh,...leg.knee)&&occupied(leg.shin,...leg.knee);
    const ankle=occupied(leg.shin,...leg.ankle)&&occupied(leg.boot,...leg.ankle);
    const exposedSole=pixels.filter(i=>Math.floor(i/leg.boot.w)===contact && !occupied(garment,i%leg.boot.w,contact) &&
      occupied(silhouette,i%leg.boot.w,contact)).length;
    return {left,right,contact,expected:leg.ground-2,knee,ankle,shin,exposedSole};
  });
  return {rows, anatomicalGapRows:rows.length, visibleGapRows:rows.filter(row=>row.clear).length, feet};
}

export function requireCostumeStance(metrics: ReturnType<typeof inspectCostumeStance>, minimumGapRows: number) {
  const [near,far] = metrics.feet;
  assert.ok(near.left<far.left && near.right<far.right && metrics.feet.every(foot=>foot.contact===foot.expected &&
    foot.knee && foot.ankle && foot.shin && foot.exposedSole>=2), 'STANCE_SUPPORT');
  assert.ok(metrics.anatomicalGapRows>=minimumGapRows,'STANCE_LEG_GEOMETRY');
  assert.ok(metrics.visibleGapRows>=minimumGapRows && metrics.rows.every(row=>!row.cloth||!row.clear),'STANCE_GAP');
  return metrics;
}
