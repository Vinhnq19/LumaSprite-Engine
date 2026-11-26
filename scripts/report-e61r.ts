import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from '../src/quality/raster.ts';

const roots = { b0:'benchmarks/results/e61', b1:'benchmarks/results/e61r' };
const json = (path: string) => JSON.parse(readFileSync(path,'utf8'));
const indices = { b0:json(roots.b0+'/benchmark.json'), b1:json(roots.b1+'/benchmark.json') };
function bytes(version: keyof typeof roots, path: string) {
  const data=readFileSync(join(roots[version],path));
  if (sha256(data)!==indices[version].sha256[path]) throw new Error('Benchmark hash mismatch at '+path);
  return data;
}
function png(version: keyof typeof roots,path: string) {
  const data=bytes(version,path);
  return { url:'data:image/png;base64,'+data.toString('base64'), w:data.readUInt32BE(16), h:data.readUInt32BE(20) };
}
const scenes = { 'front-court':'Front Court', roadside:'Roadside' };
const lights = { day:'Ban ngày', night:'Ban đêm' };
const modes = { scene:'Toàn cảnh', architecture:'Cận kiến trúc', scale:'Thước tỷ lệ', layers:'Occlusion', collision:'Collision',
  footprint:'Mặt bằng và pivot', materials:'Vật liệu', kit:'Atlas', night:'Lớp ánh sáng' };
const files = { scene:'scene.png', zoom:'scene-4x.png', layers:'layer-overlay.png', collision:'collision-overlay.png',
  materials:'material-mask.png', kit:'kit.png' };
const cases = Object.keys(scenes).flatMap(layout=>Object.keys(lights).map(light=>{
  const id=layout+'-'+light, plate='plates/'+id+'/';
  const comparison=JSON.parse(bytes('b1',plate+'comparison.json').toString('utf8'));
  const pair=(version: keyof typeof roots)=>{
    const base='packages/'+layout+(version==='b0'?'-b':'')+'-'+light+'/';
    const media=Object.fromEntries(Object.entries(files).map(([name,path])=>[name,png(version,base+path)]));
    for(const mode of ['architecture','scale','footprint']) media[mode]=png('b1',plate+version+'-'+mode+'.png');
    if(version==='b1' && light==='night') media.night=png('b1',base+'night-light.png');
    return media;
  };
  const placements=Object.fromEntries(['surveyor','courier'].flatMap(actor=>['landing','threshold'].map(pose=>[actor+'-'+pose,png('b1',plate+actor+'-'+pose+'.png')])));
  return [id,{ b0:pair('b0'),b1:pair('b1'), comparison, placements }];
}));
const playback=Object.fromEntries(['surveyor','courier'].map(actor=>[actor,{
  strip:png('b1','playback/'+actor+'.png'),
  timing:JSON.parse(bytes('b1','playback/'+actor+'.json').toString('utf8')),
}]));
const studioPath=roots.b1+'/studio-parity.json';
const studio=json(studioPath);
const style=readFileSync('research/open-source/art-quality/report.css','utf8');
const options=(entries:Record<string,string>)=>Object.entries(entries).map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('');
const actorNames={ surveyor:'Field Surveyor',courier:'Forest Courier' };
const fixtureNames={ grass:'Cỏ', dirt:'Đất', roof:'Mái', wood:'Gỗ', stone:'Đá' };
const grades=[
  ['Silhouette công trình',false], ['Tỷ lệ kiến trúc và nhân vật',true], ['Phối cảnh nhất quán',false],
  ['Đọc rõ lối vào',true], ['Chiều sâu và che khuất',true], ['Tách vật liệu',false], ['Ánh sáng ngày và đêm',true],
  ['Cụm pixel',false], ['Độ lặp texture',false], ['Bố cục cảnh chơi',false], ['Đọc rõ nhân vật',true], ['Cảm nhận tổng thể',false],
] as const;
const gradeRows=grades.map(([label,critical],i)=>'<tr><th scope="row">'+label+(critical?' <span class="key">≥ 4</span>':'')+'</th>'+
  ['B0','B1'].map(id=>'<td><select name="'+id+'-'+(i+1)+'" aria-label="'+id+' '+label+'"><option value="">—</option>'+
  [1,2,3,4,5].map(n=>'<option>'+n+'</option>').join('')+'</select></td>').join('')+'</tr>').join('');
const legend=(items:Record<string,string>)=>'<div class="swatches">'+Object.entries(items).map(([key,value])=>
  '<span><i style="--sample:'+value+'" aria-hidden="true"></i> '+key+'</span>').join('')+'</div>';
const qa=json(roots.b1+'/packages/front-court-day/qa.json');
const fig=(caption: string)=>'<figure class="art"><figcaption>'+caption+'</figcaption><div class="pixel-window" role="region" tabindex="0" aria-label="'+caption+'"><img alt="" hidden><p hidden></p></div></figure>';
const script=String.raw`
const data=JSON.parse(document.querySelector('#data').textContent)
const q=id=>document.getElementById(id)
const fields=['layout','light','mode','zoom'].map(q)
const names=['B0 nguyên bản','B1 tinh chỉnh']
const panel=q('comparison')
const forms=[...panel.querySelectorAll('.pixel-window')]
const active=()=>data.cases[q('layout').value+'-'+q('light').value]
const clip=q('walk').getContext('2d')
clip.imageSmoothingEnabled=false
const n=(value)=>value==null?'—':String(value)
function row(cells){return '<tr>'+cells.map((v,i)=>i===0?'<th scope="row">'+n(v)+'</th>':'<td>'+n(v)+'</td>').join('')+'</tr>'}
function show() {
  const current=active()
  const mode=q('mode').value, scale=Number(q('zoom').value)
  panel.classList.toggle('stack',scale===4)
  for (const [i,key] of ['b0','b1'].entries()) {
    const picture=forms[i].querySelector('img'), placeholder=forms[i].querySelector('p')
    const image=current[key][mode==='scene'&&scale===4?'zoom':mode]
    picture.hidden=!image
    placeholder.hidden=!!image
    if (!image) {
      placeholder.textContent=i===0 ? 'B0 tô ánh sáng trực tiếp vào cảnh.' : 'Lớp ánh sáng chỉ có trong cảnh đêm.'
      continue
    }
    const factor=mode==='scene'?1:scale
    picture.src=image.url
    picture.width=image.w*factor
    picture.height=image.h*factor
    picture.alt=names[i]+' · '+q('layout').selectedOptions[0].text+' · '+q('light').selectedOptions[0].text+' · '+q('mode').selectedOptions[0].text+' · '+scale+'×'
  }
  const a=current.comparison.b0,b=current.comparison.b1
  q('summary').textContent='320 × 208 · 32 px/unit · 16 px/ô · rộng collision 10 → 26 px · cao vùng cửa 24 → 58 px'
  q('textures').innerHTML=Object.keys(data.roles).map(k=>row([data.roles[k],a.textures[k].per100,b.textures[k].per100,a.textures[k].repeatedAt16,b.textures[k].repeatedAt16])).join('')
  q('edges').innerHTML=a.boundaries.map((edge,i)=>row([edge.pair.join(' / '),edge.samples,b.boundaries[i].samples,edge.median,b.boundaries[i].median,edge.p10,b.boundaries[i].p10])).join('')
  q('depth').textContent='Courier '+a.courier.at.join(', ')+' → '+b.courier.at.join(', ')+' · hiện '+a.courier.visible+' → '+b.courier.visible+'/'+b.courier.visibleBefore+' px · chân hiện '+b.courier.visibleContactPixels+'/'+b.courier.contactPixels+' px · p10 luma biên '+a.courier.p10LumaGap+' → '+b.courier.p10LumaGap
  q('compare-json').href='../benchmarks/results/e61r/plates/'+current.comparison.layout+'-'+current.comparison.light+'/comparison.json'
  q('fit').innerHTML=b.geometry.fit.map(fit=>row([data.actors[fit.id],fit.silhouette.height,fit.shoulderSpan,fit.jacket.width,fit.pivot.join(', '),fit.testedPixels])).join('')
  updateStance()
}
function updateStance(){
  const current=active(), actor=q('stance-actor').value
  const items=[...q('stances').querySelectorAll('img')]
  for(const [i,pose] of ['landing','threshold'].entries()){
    const png=current.placements[actor+'-'+pose]
    items[i].src=png.url
    items[i].width=png.w
    items[i].height=png.h
    items[i].hidden=false
    items[i].alt=data.actors[actor]+' · '+(i?'trong ngưỡng cửa':'trước cửa')
  }
}
for(const field of fields) field.addEventListener('change',show)
q('stance-actor').addEventListener('change',updateStance)
let request=0, frameImage
let loadId=0
async function selectWalk(){
  const id=++loadId
  cancelAnimationFrame(request)
  frameImage=null
  q('play').disabled=true
  const source=data.playback[q('walker').value]
  const img=new Image()
  img.src=source.strip.url
  await img.decode()
  if(id!==loadId)return
  frameImage=img
  renderFrame(source,0)
  q('play').disabled=false
}
function renderFrame(source,index){
  const {width,height,steps}=source.timing
  const step=steps[index]
  clip.drawImage(frameImage,index*width,0,width,height,0,0,width,height)
  q('frame').max=steps.length-1
  q('frame').value=index
  q('pose').textContent=(index===steps.length-1?'Đã tới sân ngay trước cửa':step.phase)+' · pivot ('+step.at.join(', ')+')'
}
q('walker').addEventListener('change',selectWalk)
q('frame').addEventListener('input',()=>{
  cancelAnimationFrame(request)
  if(frameImage)renderFrame(data.playback[q('walker').value],Number(q('frame').value))
})
q('play').addEventListener('click',()=>{
  cancelAnimationFrame(request)
  const source=data.playback[q('walker').value]
  const start=performance.now(), steps=source.timing.steps
  function tick(now){
    let i=0,end=steps[0].ms
    while(i<steps.length-1 && now-start>=end){i++;end+=steps[i].ms}
    renderFrame(source,i)
    if(i<steps.length-1)request=requestAnimationFrame(tick)
  }
  request=requestAnimationFrame(tick)
})
q('rubric').addEventListener('submit',event=>{
  event.preventDefault()
  const form=Object.fromEntries(new FormData(event.currentTarget))
  const scores=Object.fromEntries(names.map((_,i)=>['B'+i,Object.fromEntries(data.grades.map(([label],j)=>[label,Number(form['B'+i+'-'+(j+1)])||null]))]))
  const value={milestone:'E6.1R',reviewer:form.reviewer,notes:form.notes,scores}
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}))
  const a=document.createElement('a')
  a.href=url
  a.download='e61r-human-art-review.json'
  a.click()
  setTimeout(()=>URL.revokeObjectURL(url),3000)
})
show()
selectWalk()
`;
const html=`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · E6.1R Field Outpost</title>
<style>${style}
header{padding:clamp(1.45rem,5vw,3rem) 0 1rem}
h1{max-width:none;font-size:clamp(2.3rem,6vw,4.8rem)}
h2{scroll-margin-top:1rem}
section{padding-top:2rem}
.dual{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,325px),1fr));gap:.75rem}
.dual.stack{grid-template-columns:1fr}
.art{display:block}
.pixel-window{overflow:auto;min-height:5.7rem;text-align:center;max-width:100%}
.pixel-window img{margin:auto;max-width:none}
.pixel-window:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
[hidden]{display:none!important}
select{max-width:100%}
.controls label{max-width:100%}
.key{color:var(--gold);white-space:nowrap;font-weight:500}
.walk-controls{margin-top:.8rem}
input[type=text]{font:inherit;color:var(--ink);background:var(--picture);border:1px solid #5e776d;border-radius:6px;min-height:44px}
</style></head>
<body><header><div class="wrap"><p class="eyebrow">LumaSprite Engine · E6.1R</p><h1>Field Outpost</h1>
<p class="lede">Duyệt tỷ lệ cửa, chiều sâu và ánh sáng của kiến trúc sau tinh chỉnh trên Front Court và Roadside.</p>
<p class="status">E6_1R_READY_FOR_HUMAN_ART_REVIEW</p></div></header>
<nav aria-label="Báo cáo"><div class="wrap"><a href="#gallery">So sánh</a><a href="#entrance">Lối vào</a><a href="#qa">Chỉ số</a><a href="#review">Phiếu duyệt</a></div></nav>
<main class="wrap">
<section id="gallery"><h2>Đối chiếu B0 / B1</h2>
<div class="viewer"><div class="controls">
<label>Bố cục <select id="layout">${options(scenes)}</select></label>
<label>Ánh sáng <select id="light">${options(lights)}</select></label>
<label>Lớp hiển thị <select id="mode">${options(modes)}</select></label>
<label>Tỷ lệ <select id="zoom">${options({'1':'1× native','4':'4× nearest-neighbor'})}</select></label></div>
<div class="dual" id="comparison">${fig('B0 · ENV-B E6.1')}${fig('B1 · ENV-B E6.1R')}</div>
<p id="summary" class="quiet"></p></div>
<details><summary>Chú giải lớp và vật liệu</summary>${legend(qa.atlas.layerLegend)}${legend(qa.atlas.materialLegend)}
<p>Ở chế độ mặt bằng, vàng vạch footprint của nhà, đỏ đánh dấu collider kiến trúc, cam là collider prop, xanh bạc hà là hành lang và pivot.</p></details></section>
<section id="entrance"><h2>Lối vào ở 1×</h2>
<p>Thước tỷ lệ dùng cùng đường chân. Hai tư thế thực tế bên dưới dùng cùng ảnh nhân vật đã khóa.</p>
<div class="viewer"><div class="controls"><label>Nhân vật <select id="stance-actor">${options(actorNames)}</select></label></div>
<div id="stances" class="dual">${fig('Trước cửa · y + 12')}${fig('Trong ngưỡng · y − 4')}</div></div>
<h3>Playback tới sân trước cửa</h3><p>Clip E5.4 dùng thời lượng từng frame và root motion frame-stepped. Tư thế trong cửa được thử riêng với compositor và collision.</p>
<div class="viewer"><div class="controls"><label>Clip tại Front Court <select id="walker">${options(actorNames)}</select></label>
<button id="play" class="primary" type="button" disabled>Phát một lượt</button></div>
<figure class="art"><div class="pixel-window"><canvas id="walk" width="320" height="208" role="img" aria-label="Playback bước tới cửa"></canvas></div><figcaption id="pose"></figcaption></figure>
<div class="controls walk-controls"><label class="frame">Chọn frame <input id="frame" type="range" min="0" max="8" value="0"></label></div></div>
</section>
<section id="qa"><h2>Kỹ thuật và vật liệu</h2>
<p>Studio <code>${studio.studioRevision}</code> lưu, mở lại và xuất đúng RGBA cho ${studio.cases.length} PNG. Benchmark lưu ${indices.b1.fileCount} SHA-256 và đối chiếu đủ 104 SHA-256 E6.1.</p>
<p id="depth"></p><div class="scroll" tabindex="0"><table><thead><tr>
<th>Nhân vật</th><th>Cao (px)</th><th>Ngang vai (px)</th><th>Áo (px)</th><th>Pivot</th><th>Sweep (pixel)</th>
</tr></thead><tbody id="fit"></tbody></table></div>
<h3>Mật độ viền texture</h3><p>Đếm cạnh luma ≥ 6 trong cùng vật liệu trên 100 mẫu. Cột lặp đo tỷ lệ cạnh còn xuất hiện ở đúng độ lệch 16 px. Đường chân tường và các mạch dài cũng được tính.</p>
<div class="scroll" tabindex="0"><table><thead><tr><th>Vật liệu</th><th>Mật độ B0</th><th>Mật độ B1</th><th>Lặp B0 (%)</th><th>Lặp B1 (%)</th></tr></thead><tbody id="textures"></tbody></table></div>
<h3>Độ tách vật liệu tại cạnh tiếp xúc</h3><p>Chênh luma theo mẫu kề nhau. Dấu — dành cho cặp không có cạnh tiếp xúc trực tiếp.</p>
<div class="scroll" tabindex="0"><table><thead><tr><th>Cặp</th><th>Mẫu B0</th><th>Mẫu B1</th><th>Median B0</th><th>Median B1</th><th>P10 B0</th><th>P10 B1</th></tr></thead><tbody id="edges"></tbody></table></div>
<div class="downloads"><a href="e61r-environment-refinement.md">Audit và bản nháp PR</a><a id="compare-json" href="#">JSON cảnh đang chọn</a>
<a href="../${roots.b1}/benchmark.json">Manifest SHA-256</a><a href="../${studioPath}">Kết quả Studio</a></div></section>
<section id="review"><h2>Phiếu duyệt độc lập</h2><p>Chấm từng phiên bản từ 1 đến 5 sau khi xem cả bốn cảnh ở 1×. Các mục đánh dấu ≥ 4 là trọng yếu. Ghi riêng lỗi tỷ lệ, cửa hoặc occlusion dù các mục còn lại đạt điểm cao.</p>
<form id="rubric" class="score"><div class="controls"><label>Người duyệt <input name="reviewer" type="text"></label></div>
<div class="scroll" tabindex="0"><table><thead><tr><th>Tiêu chí</th><th>B0</th><th>B1</th></tr></thead><tbody>${gradeRows}</tbody></table></div>
<label>Nhận xét <textarea name="notes" rows="4"></textarea></label><div><button class="primary">Tải phiếu JSON</button></div></form>
</section></main>
<script id="data" type="application/json">${JSON.stringify({cases:Object.fromEntries(cases),playback,actors:actorNames,roles:fixtureNames,grades}).replaceAll('<','\\u003c')}</script>
<script>${script}</script></body></html>
`;
writeFileSync('docs/LumaSprite-Engine-E6.1R-Report.html',html);
console.log('Offline E6.1R report generated.');
