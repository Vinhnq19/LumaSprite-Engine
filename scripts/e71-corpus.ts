import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sha256 } from '../src/quality/raster.ts';

const json=async(file:string)=>JSON.parse((await readFile(file)).toString('utf8'));
const reference=async(file:string)=>({file,sha256:sha256(await readFile(file))});
const profile='benchmarks/fixtures/e61r/style-profile.json';
type Input={id:string;family:string;spec:string;image:string;style:string;decision:string;limitations:string[];sidecars?:string[];canvas?:number[]};
const approved='APPROVED', limited='APPROVED_WITH_LIMITATIONS';
async function entry(input:Input){
  const envelope=await json(input.spec);
  const spec=envelope.authored??envelope.spec??envelope;
  assert.ok(Number.isInteger(spec.version),input.spec+' is missing a source spec version.');
  const frame=await readFile(input.image);
  return {class:'A',id:input.id,family:input.family,
    canvas:input.canvas??[frame.readUInt32BE(16),frame.readUInt32BE(20)],
    style:{name:input.style,reference:await reference(input.style==='Art Style Profile v1'?profile:input.spec)},
    sourceSpec:await reference(input.spec),seed:spec.seed??null,
    specVersion:spec.version,artistic:input.decision,limitations:input.limitations,
    ...(input.family==='terrain'?{mapCanvas:[envelope.image.width,envelope.image.height],tileSize:spec.tileSize}:{}),
    outputs:await Promise.all([input.image,...(input.sidecars??[])].map(reference))};
}
export async function makeCorpus(){
  const definition:Input[]=[];
  for(const id of ['compact','domed','travel','crate','barrel-wide','barrel-tall']){
    const p='benchmarks/results/e24/'+id;
    definition.push({id,family:'prop',spec:p+'-spec.json',image:p+'-1x.png',style:'E2.4 authored palette',decision:approved,
      limitations:id==='barrel-tall'?['Low stave separation in the separate four-ink preset.']:id==='travel'?['Front rail prominent on bright backgrounds.']:['Approved for the reviewed authored 32×32 art.']});
  }
  for(const id of ['outdoor','organic','large','storage','stress']){
    const p='benchmarks/results/e34/packages/b-'+id+'/';
    definition.push({id:'terrain-b-'+id,family:'terrain',spec:p+'map.json',image:p+'atlas.png',
      style:'E3.4 Direction B authored terrain',decision:limited,sidecars:[p+'map.png'],
      limitations:['Dirt is simple and long transitions can expose the tile grid. Static Studio atlas for editable maps.']});
  }
  for(const [id,folder] of [['surveyor','r2'],['courier','courier-rev']]){
    const p='benchmarks/results/e44/packages/'+folder+'/';
    definition.push({id,family:'character',spec:p+'character-spec.json',image:p+'final.png',style:'E4.4 Authored',decision:limited,
      sidecars:[p+'shape-lock.json',p+'material-mask.png'],limitations:['Single right-facing view with limited 3/4 depth or material contrast.']});
    for(const clip of ['idle','walk']){
      const a='benchmarks/results/e54/packages/'+id+'/'+clip+'/';
      const standing=id==='courier'&&clip==='idle', timing=await json(a+'timing.json');
      definition.push({id:id+'-'+(standing?'standing':clip),family:'animation',spec:standing?p+'character-spec.json':a+'animation-spec.json',
        canvas:[timing.canvas.w,timing.canvas.h],image:a+'spritesheet.png',sidecars:[a+'timing.json'],
        style:'Locked E4/E5 animation material',decision:standing?'APPROVED_STANDING_REFERENCE':limited,
        limitations:['Single view. Production uses the selected discrete-root playback policy when applicable.']});
    }
  }
  for(const [id,edition] of [['front-court','e61r'],['roadside','e61r'],['c1-courtyard','e62'],['c2-supply-stop','e62'],
    ['r1-signal-entrance','e63'],['r2-signal-clearing','e63']])for(const light of ['day','night']){
    const p='benchmarks/results/'+edition+'/packages/'+id+'-'+light+'/';
    definition.push({id:id+'-'+light,family:'environment',spec:p+(edition==='e61r'?'environment-spec.json':'composition-spec.json'),image:p+'scene.png',
      sidecars:[p+'manifest.json',p+'kit.png'],style:'Art Style Profile v1',decision:limited,
      limitations:[edition==='e63'?'Crest rhythm, moss attachment and signal hierarchy still need review.':
        edition==='e62'?'Some character edges remain low-contrast at night.':'Limited visual depth in the doorway.']});
  }
  for(const id of ['interaction-icon','inventory-barrel','signal-activation','pickup-sparkle']){
    const p='benchmarks/results/e64/packages/'+id+'/', meta=await json(p+'qa.json'),family=id.endsWith('icon')||id==='inventory-barrel'?'ui':'vfx';
    definition.push({id,family,spec:p+'spec.json',image:p+'spritesheet.png',canvas:meta.native,
      sidecars:[p+(family==='ui'?'states.json':'timing.json'),p+'manifest.json'],style:'Art Style Profile v1',
      decision:id==='inventory-barrel'?approved:limited,limitations:[id==='interaction-icon'?'Semantics weaken outside context.':
        id==='signal-activation'?'Activation reads like a magical spark and the device change is subtle.':
          id==='pickup-sparkle'?'The action is hard to read at gameplay scale.':'Approved inventory reference.']});
  }
  return {version:1,checkpoint:'77fbaa5',historical:await Promise.all(definition.map(entry)),
    experiments:[
      {class:'B',id:'relay-box',family:'prop',canvas:[32,32],specVersion:1,seed:127,style:await reference(profile),sourceSpec:await reference('benchmarks/fixtures/e71/relay-box.json'),artistic:'PENDING_HUMAN_REVIEW'},
      {class:'B',id:'r1-wall-study',family:'environment',canvas:[320,208],specVersion:1,seed:83,style:await reference(profile),sourceSpec:await reference('benchmarks/fixtures/e63/r1-signal-entrance.json'),artistic:'PENDING_HUMAN_REVIEW'},
      {class:'C',id:'h1-switchback-depot',family:'environment',canvas:[320,208],specVersion:1,seed:2117,style:await reference(profile),sourceSpec:await reference('benchmarks/fixtures/e71/h1-switchback-depot.json'),
        protocol:await reference('benchmarks/fixtures/e71/holdout-lock.json'),artistic:'PENDING_HUMAN_REVIEW'},
    ]};
}
