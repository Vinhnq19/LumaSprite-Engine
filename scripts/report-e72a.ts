import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { sha256 } from '../src/quality/raster.ts';

const base='benchmarks/results/e72a/';
const assets='../../'+base;
const index=JSON.parse(await readFile(base+'benchmark.json','utf8'));
for(const [file,digest] of Object.entries(index.sha256))assert.equal(sha256(await readFile(base+file)),digest,file);
const css=await readFile('research/open-source/art-quality/report.css','utf8');
const subjects={relay:'Relay A1',receiver:'Ridge Survey Receiver · Holdout'};
const data:Record<string,unknown>={};
for(const id of Object.keys(subjects)){
  const q=JSON.parse(await readFile(base+id+'/qa.json','utf8'));
  data[id]={seed:q.seed,coverage:q.m0.coverage,diff:q.diff,ambers:[q.m0.clusters.amber.pixels,q.m1.clusters.amber.pixels],
    boundary:[q.m0.materialBoundaries,q.m1.materialBoundaries].map(items=>items.find((x:{roles:string})=>x.roles==='#98a0be/#bc8862')),
    clusters:[q.m0.clusters,q.m1.clusters].map(c=>Object.fromEntries(['wood','metal','amber'].map(role=>[role,{first:c[role].counts[0],isolated:c[role].isolated}]))),
    ramps:['wood','metal','amber'].map(role=>[role,q.ramps[role]]),backgrounds:q.backgrounds};
}
const options=(entries:Record<string,string>)=>Object.entries(entries).map(([v,label])=>'<option value="'+v+'">'+label+'</option>').join('');
const field=(id:string,label:string,entries:Record<string,string>)=>'<label>'+label+'<select id="'+id+'">'+options(entries)+'</select></label>';
const criteria=['Nhận diện vật liệu','Nhận diện chức năng','Bảo toàn hình khối','Hướng sáng','Chất lượng cụm pixel',
  'Chất lượng đường viền','Độ đọc ở 1×','Nhất quán phong cách game'];
const figure=(variant:string,label:string)=>'<figure class="art" id="'+variant+'"><figcaption>'+label+
  '</figcaption><div class="pixel-window" tabindex="0"><img alt="'+label+'" width="32" height="32" src="'+assets+'relay/'+variant+'/native.png"></div></figure>';
const html=`<!doctype html>
<html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · E7.2-A Relay Material</title>
<style>${css}
.wrap {width:min(1040px,calc(100% - 32px));}
.compare {grid-template-columns:repeat(auto-fit,minmax(min(100%,326px),1fr));}
.compare .art {display:block;justify-items:stretch;}
.art[hidden] {display:none;}
.pixel-window {display:block;width:100%;overflow:auto;max-height:75vh;}
.pixel-window img {max-width:none;height:auto;margin-inline:auto;}
.pixel-window img.context {margin-inline:0;}
.pixel-window:focus-visible {outline:3px solid var(--gold);outline-offset:2px;}
.swatches span {min-width:80px}
.swatches i {background:var(--sample);}
@media(max-width:570px){ .viewer {padding:.55rem;} }
</style>
<header><div class="wrap">
<h1>E7.2-A Relay Material</h1>
<p class="status">E7_2A_READY_FOR_HUMAN_MATERIAL_REVIEW</p>
<p class="lede">Cùng một hình khối. So sánh thân gỗ, viền kim loại và cửa tín hiệu amber ở kích thước gameplay.</p>
</div></header>
<nav aria-label="Các mục"><div class="wrap"><a href="#compare">So sánh</a><a href="#review">Phiếu duyệt</a><a href="e72a-material-and-qa.md">QA</a><a href="INDEX.md">Report index</a></div></nav>
<main class="wrap">
<section id="compare"><h2>Relay và holdout</h2>
<div class="viewer"><div class="controls">
${field('subject','Mẫu',subjects)}
${field('view','Lớp ảnh',{native:'Sprite RGBA',bright:'Nền sáng',dark:'Nền tối',context:'Cảnh gameplay C1',
  material:'Material mask',flat:'Hình khối phẳng',silhouette:'Silhouette',diff:'RGBA và material diff'})}
${field('zoom','Tỷ lệ',{'1':'1× native','4':'4× nearest'})}
</div><div class="compare">${figure('m0','M0 · Vật liệu hiện hành')}${figure('m1','M1 · Vật liệu tinh chỉnh')}</div>
<p id="summary" class="quiet" aria-live="polite"></p></div>
<details><summary>Material boundaries, palette và pixel clusters</summary>
<pre id="diagnostics"></pre><div id="ramps"></div><a id="full-qa" href="${assets}relay/qa.json">QA của mẫu đang xem</a></details>
<p class="quiet">Ở diff, vàng là đổi vai trò vật liệu, xanh mint là đổi màu trong cùng vai trò và tối là giữ nguyên. Chiếu sáng từ trên trái.</p>
</section>
<section id="review"><h2>Phiếu duyệt nghệ thuật</h2>
<p>Chấm ở 1× rồi dùng 4× để kiểm cụm pixel. Chấm holdout độc lập và ghi những chi tiết còn khó đọc.</p>
<form id="review-form" class="score">
<div class="scroll" tabindex="0" aria-label="Điểm từng tiêu chí"><table><thead><tr><th scope="col">Tiêu chí</th><th scope="col">M0</th><th scope="col">M1</th></tr></thead><tbody>
${criteria.map((label,i)=>'<tr><th scope="row">'+label+'</th>'+['M0','M1'].map(slot=>
  '<td><select aria-label="'+label+' '+slot+'" data-criterion="'+i+'" data-slot="'+slot+'"><option value="">—</option>'+
  options({'1':'1','2':'2','3':'3','4':'4','5':'5'})+'</select></td>').join('')+'</tr>').join('')}
</tbody></table></div>
<label>Nhận xét<textarea id="notes" rows="4"></textarea></label>
<button class="primary" type="submit">Tải điểm của mẫu đang xem</button>
</form>
<p><a id="workbench" href="${assets}review/relay.workbench.json">Review JSON cho Studio Workbench</a> · <a href="e71r-human-review.md">Bộ duyệt kiến trúc E7.1R</a></p>
</section></main>
<script>
'use strict';
const data=${JSON.stringify(data)}, criteria=${JSON.stringify(criteria)};
const el=id=>document.getElementById(id);
const value=id=>el(id).value;
const asset='${assets}';
const shared={flat:'Hình khối chung',silhouette:'Silhouette chung',diff:'RGBA và material diff'};
const fields=[...document.querySelectorAll('[data-criterion]')];
const draft=new Map();
let active='relay';

function frame(id,path,width,height,zoom,label){
  const panel=el(id),img=panel.querySelector('img');
  if(img.getAttribute('src')!==path)img.src=path;
  img.width=width*zoom;
  img.height=height*zoom;
  img.alt=label;
  img.classList.toggle('context',width===320);
  panel.querySelector('figcaption').textContent=label;
}

function update(){
  const subject=value('subject'),view=value('view'),zoom=Number(value('zoom'));
  if(active!==subject){
    draft.set(active,{points:fields.map(f=>f.value),notes:value('notes')});
    const previous=draft.get(subject);
    fields.forEach((f,i)=>f.value=previous?.points[i]??'');
    el('notes').value=previous?.notes??'';
    active=subject;
  }
  const common=Object.hasOwn(shared,view);
  const path=asset+subject+'/';
  el('m1').hidden=common;
  if(common)frame('m0',path+(view==='diff'?'rgba-diff':view)+'.png',32,32,zoom,shared[view]);
  else{
    const [w,h]=view==='context'?[320,208]:[32,32];
    frame('m0',path+'m0/'+view+'.png',w,h,zoom,'M0 · Vật liệu hiện hành');
    frame('m1',path+'m1/'+view+'.png',w,h,zoom,'M1 · Vật liệu tinh chỉnh');
  }
  const q=data[subject];
  el('summary').textContent='Seed '+q.seed+' · '+q.coverage+' pixel silhouette · '+q.diff.rgbaPixels+' pixel RGBA đổi · alpha trùng khớp';
  el('diagnostics').textContent=[
    'Amber · '+q.ambers.join(' → ')+' px',
    'Gỗ–kim loại · median '+q.boundary.map(x=>x.median).join(' → ')+' · P10 '+q.boundary.map(x=>x.p10).join(' → '),
    ...['wood','metal','amber'].map(role=>role+' · cụm cùng màu lớn nhất '+q.clusters.map(c=>c[role].first).join(' → ')+
      ' · cụm một pixel '+q.clusters.map(c=>c[role].isolated).join(' → '))
  ].join('\\n');
  const ramps=el('ramps');
  ramps.replaceChildren();
  for(const [role,colors] of q.ramps){
    const row=document.createElement('div');row.className='swatches';row.setAttribute('aria-label',role);
    for(const color of colors){
      const span=document.createElement('span'),chip=document.createElement('i');
      chip.style.setProperty('--sample',color);
      span.append(chip,' '+color);row.append(span);
    }
    ramps.append(row);
  }
  el('workbench').href=asset+'review/'+subject+'.workbench.json';
  el('full-qa').href=path+'qa.json';
}
for(const id of ['subject','view','zoom'])el(id).addEventListener('change',update);
el('review-form').addEventListener('submit',event=>{
  event.preventDefault();
  const ratings=fields.map(f=>({criterion:criteria[Number(f.dataset.criterion)],variant:f.dataset.slot,value:f.value?Number(f.value):null}));
  const data={version:1,asset:value('subject'),ratings,notes:value('notes')};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='e72a-'+value('subject')+'-art-review.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
update();
</script></html>\n`;
await writeFile('docs/reports/E7.2-A-Relay-Material.html',html);
console.log('E7.2-A · compact offline comparison with referenced PNGs.');
