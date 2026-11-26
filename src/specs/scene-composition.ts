import { z } from 'zod';
import { environmentSpecSchema } from './environment.ts';
import { terrainMapSpec } from './terrain.ts';

const id = z.string().regex(/^[a-z][a-z0-9-]{0,35}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const point = z.tuple([z.number().int().min(0).max(320),z.number().int().min(0).max(208)]);
const polygon = z.array(point).min(3).max(16);
const actor = z.enum(['surveyor','courier']);
const placement = z.strictObject({ id, ref:id, at:point });
const zone = z.strictObject({
  id, role:z.enum(['primary','secondary','background','foreground','rest','readability']), points:polygon,
});
const probe = z.strictObject({
  id:z.enum(['front','threshold','side','rear','between-props','foreground']),
  at:point, actor, occluder:id.optional(),
});
export const sceneCompositionSpec = z.strictObject({
  version:z.literal(1), kind:z.literal('field-outpost-composition'), id, name:z.string().min(1).max(80),
  size:z.tuple([z.literal(320),z.literal(208)]), seed:z.number().int().min(0).max(0xffffffff),
  source:z.strictObject({
    checkpoint:z.literal('24b8ca6'), kit:z.enum(['front-court','roadside']), specSha256:digest,
    styleSha256:digest, terrainSha256:digest,
  }),
  terrain:terrainMapSpec,
  building:point,
  approach:polygon,
  paving:z.array(z.strictObject({ points:polygon, role:z.enum(['route','activity']) })).min(1).max(6),
  props:z.array(placement).min(2).max(4),
  spawns:z.array(z.strictObject({ actor, at:point })).length(2),
  walkable:z.array(polygon).min(2).max(7),
  zones:z.array(zone).min(6).max(16),
  interactions:z.array(z.strictObject({ id, target:id, points:polygon })).min(2).max(4),
  routes:z.array(z.strictObject({ id, actor, points:z.array(point).min(2).max(9) })).min(1).max(6),
  probes:z.array(probe).length(6),
  depth:z.literal('ground-pivot-y'),
  collision:z.literal('kit-and-prop-footprints'),
  lighting:z.strictObject({
    door:z.literal(true), workbench:z.enum(['door','secondary']),
    fill:z.array(z.strictObject({ points:polygon, role:z.enum(['grass','dirt','paving']), tone:z.union([z.literal(1),z.literal(2),z.literal(3)]) })).min(1).max(4),
  }),
}).superRefine((spec,ctx)=>{
  for (const [field,values] of Object.entries({
    props:spec.props.map(x=>x.id), spawns:spec.spawns.map(x=>x.actor), zones:spec.zones.map(x=>x.id),
    interactions:spec.interactions.map(x=>x.id), routes:spec.routes.map(x=>x.id), probes:spec.probes.map(x=>x.id),
  })) if(new Set(values).size!==values.length) ctx.addIssue({code:'custom',path:[field],message:'IDs must be unique.'});
  for (const role of ['primary','secondary','background','foreground','rest','readability'] as const) {
    if (!spec.zones.some(z=>z.role===role)) ctx.addIssue({code:'custom',path:['zones'],message:'Missing '+role+' zone.'});
  }
  const ids = new Set(['entry','station-shell',...spec.props.map(p=>p.id)]);
  for (const [field,values] of Object.entries({interactions:spec.interactions.map(x=>x.target),probes:spec.probes.flatMap(x=>x.occluder?[x.occluder]:[])})) {
    if(values.some(id=>!ids.has(id)))ctx.addIssue({code:'custom',path:[field],message:'Unknown scene target.'});
  }
});

export type SceneCompositionSpec = z.infer<typeof sceneCompositionSpec>;
export type CompositionBase = Extract<z.infer<typeof environmentSpecSchema>,{version:2}>;
