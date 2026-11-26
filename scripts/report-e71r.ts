import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { sha256 } from '../src/quality/raster.ts';

const directory='benchmarks/results/e71r/';
const edition=JSON.parse(await readFile(directory+'benchmark.json','utf8'));
for (const [path,hash] of Object.entries(edition.sha256)) assert.equal(sha256(await readFile(directory+path)),hash,path);
const base='../../benchmarks/results/';
const css=await readFile('research/open-source/art-quality/report.css','utf8');
const scenes={r1:'R1 · Signal Ruins Entrance',h1:'H1 · Switchback Depot',h2:'H2 · Dry Culvert Lookout'};
const diagnostics:Record<string,unknown>={};
for (const scene of Object.keys(scenes)) for (const light of ['day','night']) {
  const q=JSON.parse(await readFile(directory+scene+'/'+light+'/qa.json','utf8'));
  diagnostics[scene+'/'+light]={seed:q.seed,coverage:q.coverage,priorQ:q.priorQ,actors:q.actors,
    outline:q.candidate.outline,walls:q.walls.map(({id,coverage,detail}:Record<string,unknown>)=>({id,coverage,detail})),
    routes:q.routes.map(({id,tested}:Record<string,unknown>)=>({id,tested}))};
}
const opts=(entries:Record<string,string>)=>Object.entries(entries).map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('');
const field=(id:string,label:string,entries:Record<string,string>)=>'<label>'+label+'<select id="'+id+'">'+opts(entries)+'</select></label>';
const figure=(id:string,label:string,url:string)=>'<figure id="'+id+'" class="art"><figcaption>'+label+
  '</figcaption><div class="pixel-window" tabindex="0" aria-label="'+label+'"><img src="'+url+'" width="320" height="208" alt="'+label+'"></div></figure>';
const controls=[
  field('scene','Bố cục',scenes),
  field('light','Ánh sáng',{day:'Ngày',night:'Đêm'}),
  field('layer','Lớp ảnh',{native:'Vật liệu',flat:'Hình khối phẳng',silhouette:'Silhouette',material:'Material mask',contour:'Contour',collision:'Collision'}),
  field('zoom','Tỷ lệ',{'1':'1× native','4':'4× nearest'})
].join('');
const criteria=['Kết cấu kiến trúc','Silhouette','Vết gãy tự nhiên','Chiều sâu','Khoảng trống',
  'Cụm pixel','Khả năng tô vật liệu','Độ đọc gameplay','Khả năng áp dụng sang bố cục khác'];
const markup=`<!doctype html>
<html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · E7.1R Ruin Structure</title>
<style>${css}
.wrap { width:min(1170px,calc(100% - 32px)); }
.compare { grid-template-columns:repeat(auto-fit,minmax(min(100%,326px),1fr)); }
.compare .art { display:block; justify-items:stretch; }
.art[hidden] { display:none; }
.pixel-window { display:block; width:100%; overflow:auto; max-height:75vh; }
.pixel-window:focus-visible { outline:3px solid var(--gold); outline-offset:2px; }
.pixel-window img { max-width:none; height:auto; }
@media(max-width:570px){ .viewer { padding:.55rem; } }
</style>
<header><div class="wrap">
<h1>E7.1R Ruin Structure</h1>
<p class="status">E7_1R_READY_FOR_HUMAN_ART_REVIEW</p>
<p class="lede">So sánh vách gãy Production, Structure Q và Bonded Fracture trong cùng cảnh. Xem 1× để đánh giá hình khối, rồi chuyển 4× để soi mép đá.</p>
</div></header>
<nav aria-label="Các mục"><div class="wrap"><a href="#compare">So sánh</a><a href="#review">Phiếu duyệt</a><a href="INDEX.md">Report index</a></div></nav>
<main class="wrap"><section id="compare">
<h2>Vách gãy trong cảnh</h2>
<div class="viewer"><div class="controls">${controls}</div>
<div class="compare">
${figure('control','Production · Control',base+'e71/ruin/r1/day/current/native.png')}
${figure('prior','E7.1 · Structure Q',base+'e71/ruin/r1/day/candidate/native.png')}
${figure('bonded','E7.1R · Bonded Fracture',base+'e71r/r1/day/bonded/native.png')}
</div><p id="case-note" class="quiet" aria-live="polite"></p></div>
<details><summary>QA của bố cục đang xem</summary><pre id="stats"></pre><a id="qa" href="${base}e71r/r1/day/qa.json">QA đầy đủ và geometry</a></details>
<p>H1 dùng để phân tích vết gãy cơ học. H2 được khóa trước khi dựng ứng viên. <a href="../../benchmarks/fixtures/e71r/holdout-lock.json">Brief và seed H2</a></p>
</section>
<section id="review"><h2>Phiếu duyệt nghệ thuật</h2>
<p>Chấm riêng từng tiêu chí trên ảnh 1×. Giữ lỗi nghiêm trọng trong nhận xét. Đánh giá H2 độc lập.</p>
<form id="review-form" class="score">
<div class="scroll" tabindex="0" aria-label="Điểm từng tiêu chí"><table><thead><tr><th scope="col">Tiêu chí</th><th scope="col">Control</th><th scope="col">Bonded</th></tr></thead>
<tbody>${criteria.map((label,i)=>'<tr><th scope="row">'+label+'</th>'+['Control','Bonded'].map(slot=>
  '<td><select aria-label="'+label+' '+slot+'" data-criterion="'+i+'" data-slot="'+slot+'"><option value="">—</option>'+
  opts({'1':'1','2':'2','3':'3','4':'4','5':'5'})+'</select></td>').join('')+'</tr>').join('')}</tbody></table></div>
<label>Nhận xét<textarea id="review-notes" rows="4"></textarea></label>
<button class="primary" type="submit">Tải điểm của bố cục đang xem</button>
</form>
<p><a href="${base}e71r/review/h2-bonded.workbench.json">Mẫu Workbench cho H2</a> · <a href="e71-artistic-decision.md">Quyết định của Owner về E7.1</a> · <a href="e71r-structure-and-qa.md">Geometry audit và QA</a></p>
</section></main>
<script>
'use strict';
const cases=${JSON.stringify(diagnostics)};
const criteria=${JSON.stringify(criteria)};
const get=id=>document.getElementById(id);
const value=id=>get(id).value;
const saved=new Map();
let active='r1';
const fields=[...document.querySelectorAll('[data-criterion]')];
function pick(slot,path,zoom){
  const img=get(slot).querySelector('img');
  if(img.getAttribute('src')!==path) img.src=path;
  img.width=320*zoom;
  img.height=208*zoom;
}
function update(){
  const scene=value('scene'),light=value('light'),layer=value('layer'),zoom=Number(value('zoom'));
  const root='${base}',key=scene+'/'+light, path=root+'e71r/'+key+'/', old=root+'e71/ruin/'+key+'/';
  const isHoldout=scene==='h2';
  if(active!==scene){
    saved.set(active,{points:fields.map(x=>x.value),notes:value('review-notes')});
    const previous=saved.get(scene);
    fields.forEach((field,i)=>field.value=previous?.points[i]??'');
    get('review-notes').value=previous?.notes??'';
    active=scene;
  }
  pick('control',(isHoldout?path+'control/':old+'current/')+layer+'.png',zoom);
  get('prior').hidden=isHoldout;
  if(!isHoldout)pick('prior',old+'candidate/'+layer+'.png',zoom);
  pick('bonded',path+'bonded/'+layer+'.png',zoom);
  const q=cases[key], diff=q.coverage;
  const label=isHoldout?'Holdout H2':scene==='h1'?'H1 · Đã quan sát':'R1 · Development';
  get('case-note').textContent=label+' · seed '+q.seed+' · silhouette +'+diff.added+' / −'+diff.removed+' px so với Control';
  get('stats').textContent=[
    'Viền ứng viên: '+q.outline+' px',
    ...(q.priorQ?['So với Q: +'+q.priorQ.added+' / −'+q.priorQ.removed+' px silhouette']:[]),
    ...q.walls.map(w=>w.id+' · '+w.coverage+' px liên kết · biên cùng vật liệu /100: '+w.detail.baseline.per100+' → '+w.detail.candidate.per100),
    ...q.actors.map(a=>a.id+' · '+a.before+' / '+a.after+' pixel hiển thị'),
    ...q.routes.map(r=>r.id+' · '+r.tested+' mẫu pixel')
  ].join('\\n');
  get('qa').href=path+'qa.json';
}
for(const id of ['scene','light','layer','zoom'])get(id).addEventListener('change',update);
get('review-form').addEventListener('submit',event=>{
  event.preventDefault();
  const ratings=fields.map(f=>({criterion:criteria[Number(f.dataset.criterion)],slot:f.dataset.slot,value:f.value?Number(f.value):null}));
  const data={version:1,scene:value('scene'),light:value('light'),ratings,notes:value('review-notes')};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');
  a.href=url;
  a.download='e71r-'+value('scene')+'-art-review.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
update();
</script></html>\n`;
await mkdir('docs/reports',{recursive:true});
await writeFile('docs/reports/E7.1R-Ruin-Structure.html',markup);
console.log('E7.1R · local gallery with linked, checksum-verified PNGs.');
