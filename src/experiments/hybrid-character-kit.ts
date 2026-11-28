import assert from 'node:assert/strict';
import { z } from 'zod';
import { fillPolygon, type Point } from '../core/geometry/shapes.ts';
import { pack } from '../core/palette/colors.ts';
import { composite, makeRaster, silhouette, type Raster } from '../core/pixels/raster.ts';
import { renderOutlinedLayers } from '../core/renderer/layers.ts';
import { characterRamps } from '../generators/character/material-planes.ts';
import { materialMaskLegend, type MaterialDirection } from '../generators/character/materials.ts';
import { maskPixels } from './costume-stance.ts';
import type { renderQualityCharacter } from './character-v4.ts';

export type CharacterRender = ReturnType<typeof renderQualityCharacter>;
type Part = CharacterRender['layers'][number];
const id = z.string().regex(/^[a-z][a-zA-Z-]+$/);
const role = z.enum(['skin','hair','cap','brim','coat','far-coat','trousers','far-trousers','leather','metal','glass']);
const tone = z.enum(['shadow','accent','base','light']);
const coord = z.number().int().min(-20).max(20);
const point = z.tuple([coord, coord]);
const polygon = z.array(point).min(3);
const patch = z.strictObject({ tone, points: polygon });
const layer = z.strictObject({ id, role, tone, points: polygon, patches: z.array(patch), ramp: role.optional() });
const group = z.strictObject({
  id, revision: z.number().int().positive(), anchor: z.enum(['crown','chest','near-palm']),
  sockets: z.record(id,point), layers: z.array(layer).min(1),
});
const schema = z.strictObject({
  schema: z.literal('lumasprite.e9h1.component-kit.v1'), view: z.literal('three-quarter-right'),
  style: z.literal('weathered-station-v1'), keyLight: z.literal('upper-left'),
  provenance: z.strictObject({
    classification: z.literal('ENGINEER_CURATED'), creator: z.string().min(1), review: z.literal('DRAFT'),
    origin: z.string().min(1), usage: z.string().min(1), externalArtwork: z.literal(false), legalLicense: z.null(),
  }),
  groups: z.tuple([group,group,group]),
});
export type Kit = z.infer<typeof schema>;
export type Group = Kit['groups'][number];

export function parseKit(source: unknown): Kit {
  const kit = schema.parse(source);
  assert.deepEqual(kit.groups.map(g=>[g.id,g.anchor]), [
    ['helmet-visor','crown'],['suit-torso','chest'],['hand-salvage-hook','near-palm'],
  ]);
  const ids = kit.groups.flatMap(g=>g.layers.map(p=>p.id));
  assert.equal(new Set(ids).size,ids.length);
  for (const [index, names] of [
    ['neck','visorSeat'],['tankMount','neck','hip'],['grip','wrist','hookTip'],
  ].entries()) assert.deepEqual(Object.keys(kit.groups[index].sockets).sort(),names.sort());
  assert.deepEqual(kit.groups[2].layers.map(p=>p.id),['near-tool-hook','near-tool-handle','near-hand']);
  return kit;
}

export const blank = () => makeRaster(64,64);
export const ink = (r: Raster, i: number) => r.rgba.readUInt32BE(i*4);
export const set = (r: Raster, i: number, value: number) => r.rgba.writeUInt32BE(value,i*4);
export const contains = (r: Raster, i: number) => r.rgba[i*4+3] === 255;
export const pixel = ([x,y]: Point) => y*64+x;
export const offset = ([x,y]: Point,[u,v]: Point): Point => [x+u,y+v];
const rampsFor = (direction: MaterialDirection) => ({...characterRamps,...direction.ramps});

export type PaintedPart = Part & { paint: Raster };

export function placeGroup(group: Group, origin: Point, direction: MaterialDirection): PaintedPart[] {
  const at = (points: Point[]) => points.map(p=>{
    const [x,y] = offset(origin,p);
    assert.ok(Number.isInteger(x)&&Number.isInteger(y)&&x>=1&&y>=1&&x<63&&y<63,group.id+' raw margin');
    return [x,y] as Point;
  });
  const ramps = rampsFor(direction);
  return group.layers.map(source=>{
    const shape = at(source.points), mask = blank(), paint = blank();
    const ramp = ramps[source.ramp??source.role];
    fillPolygon(mask,shape,pack('#ffffff'));
    fillPolygon(paint,shape,pack(ramp[source.tone]));
    for (const patch of source.patches) fillPolygon(paint,at(patch.points),pack(ramp[patch.tone]));
    for (const i of maskPixels(paint)) if (!contains(mask,i)) set(paint,i,0);
    assert.ok(maskPixels(mask).length>0,source.id);
    return {id:source.id,role:source.role,mask,paint};
  });
}

export function layeredCharacter(
  base: CharacterRender, layers: Part[], painted: PaintedPart[], direction: MaterialDirection,
  props = base.props,
): CharacterRender {
  const palette = base.palette;
  const custom = new Map(painted.map(p=>[p.id,p.paint]));
  const ramps = rampsFor(direction), stroke = pack(direction.outline);
  const labels: CharacterRender['labels'] = {...base.labels};
  let ordinal = Object.keys(labels).length;
  for (const layer of layers) if (labels[layer.id]===undefined)
    labels[layer.id]=((0x456678+ordinal++*104729)&0xffffff)*256+255;
  const activeLabels = Object.fromEntries(layers.map(p=>[p.id,labels[p.id]]));
  const byOwner = new Map(layers.map(p=>[labels[p.id],p]));
  assert.equal(byOwner.size,layers.length);
  const ownership = composite(layers.map(p=>silhouette(p.mask,labels[p.id])));
  const paint = blank(), mat = blank();
  for (const i of maskPixels(ownership)) {
    const part = byOwner.get(ink(ownership,i))!;
    const authored = custom.get(part.id);
    const same = !authored && ink(base.ownership,i)===base.labels[part.id];
    const rgba = authored ? ink(authored,i) : same ? ink(base.final,i) : pack(ramps[part.role][part.tone??'base']);
    assert.ok(palette.has(rgba) && (rgba&255)===255,part.id+' palette');
    set(paint,i,rgba);
    set(mat,i,same?ink(base.mat,i):pack(materialMaskLegend[part.role]));
  }
  const {final,silhouette:total} = renderOutlinedLayers([paint],[ownership],stroke);
  for (const i of maskPixels(total)) if (!contains(paint,i)) {
    set(ownership,i,stroke);
    set(mat,i,pack(materialMaskLegend.contour));
  }
  const bodySilhouette = silhouette(composite(layers.filter(p=>
    !p.id.includes('-tool')&&!['oilskin','hood','bun','hair','air-tank','tank-valve','air-hose'].includes(p.id)).map(p=>p.mask)),stroke);
  return {...base,layers,labels:activeLabels,final,total,ownership,mat,bodySilhouette,props};
}
