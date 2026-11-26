import { readFileSync,writeFileSync } from 'node:fs';
import { sha256 } from '../src/quality/raster.ts';

const root='benchmarks/results/e64/';
const parse=(data:Buffer)=>JSON.parse(data.toString('utf8'));
const index=parse(readFileSync(root+'benchmark.json'));
const studio=parse(readFileSync(root+'studio-parity.json'));
function read(path:string){
  const bytes=readFileSync(root+path);
  if(sha256(bytes)!==index.sha256[path])throw new Error(path+' differs from benchmark.');
  return bytes;
}
function image(bytes:Buffer){
  return {src:'data:image/png;base64,'+bytes.toString('base64'),w:bytes.readUInt32BE(16),h:bytes.readUInt32BE(20)};
}
const png=(name:string)=>image(read(name));
const barrel=readFileSync('benchmarks/results/e24/barrel-tall-1x.png');
const barrelReference=parse(read('packages/inventory-barrel/spec.json')).source;
if(sha256(barrel)!==barrelReference.sha256)throw Error('Barrel source hash mismatch.');
const assetNames={
  'interaction-icon':'Dấu tương tác','inventory-barrel':'Icon thùng gỗ',
  'signal-activation':'Signal Activation','pickup-sparkle':'Item Pickup Sparkle',
};
const sceneNames={'r1-signal-entrance':'R1 · Signal Ruins Entrance','c1-courtyard':'C1 · Survey Station Courtyard','r2-signal-clearing':'R2 · Holdout'};
const art=Object.fromEntries(Object.keys(assetNames).map(id=>{
  const path='packages/'+id+'/', qa=parse(read(path+'qa.json'));
  return [id,{sheet:png(path+'spritesheet.png'),zoom:png(path+'spritesheet-4x.png'),alpha:png(path+'alpha.png'),
    frames:qa.frames.map((_:unknown,i:number)=>png(path+'frame-'+i+'.png')),qa}];
}));
const gameplay=Object.fromEntries(index.cases.map(({id,light}:{id:string;light:string})=>{
  const key=id+'-'+light,path='gameplay/'+key+'/';
  return [key,{before:png(path+'before.png'),peak:png(path+'peak.png'),zoom:png(path+'peak-4x.png'),frames:png(path+'frames.png'),
    focal:png(path+'focal.png'),...(index.sha256[path+'reflection.png']?{reflection:png(path+'reflection.png')}:{}),qa:parse(read(path+'qa.json'))}];
}));
const uiCriteria=['Độ rõ ở 1×','Nhận dạng','Silhouette','Hài hòa palette','Cụm pixel','Nhất quán phong cách','Đường bao','Đọc trạng thái','Nền sáng và tối','Sử dụng trong game'];
const vfxCriteria=['Đọc chuyển động','Timing','Tăng và giảm năng lượng','Nhất quán hình khối','Liên tục cụm pixel','Phân cấp điểm nhìn','Hòa vào cảnh','Cảm nhận tổng thể'];
const opt=(o:Record<string,string>)=>Object.entries(o).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('');
const uiOptions={'interaction-icon':assetNames['interaction-icon'],'inventory-barrel':assetNames['inventory-barrel']};
const vfxOptions={'signal-activation':assetNames['signal-activation'],'pickup-sparkle':assetNames['pickup-sparkle']};
const rubric=(names:string[],prefix:string,ids:string[])=>names.map((name,index)=>'<tr><th scope="row">'+name+
  ([0,1,2,6].includes(index)?' <span class="target">≥ 4</span>':'')+'</th>'+ids.map((id,i)=>'<td><select name="'+prefix+i+'-'+index+'" aria-label="'+id+' '+name+
  '"><option value="">—</option>'+[1,2,3,4,5].map(n=>'<option>'+n+'</option>').join('')+'</select></td>').join('')+'</tr>').join('');
const figure=(caption:string,id:string)=>'<figure class="art"><figcaption>'+caption+'</figcaption><div class="pixels" tabindex="0" role="region" aria-label="'+caption+'"><img id="'+id+'" alt=""></div></figure>';
const css=readFileSync('research/open-source/art-quality/report.css','utf8');
const script=String.raw`
const d=JSON.parse(document.getElementById('data').textContent)
const q=id=>document.getElementById(id)
const input=id=>q(id).value
function img(node,media,label,mult=1){
 node.src=media.src
 node.width=media.w*mult
 node.height=media.h*mult
 node.alt=label
}
function rows(cells){
 return cells.map(row=>'<tr>'+row.map((x,i)=>i?'<td>'+x+'</td>':'<th scope="row">'+x+'</th>').join('')+'</tr>').join('')
}
function palette(box,inks){
 const entries=Array.isArray(inks)?inks.map((ink,i)=>[String(i+1),ink]):Object.entries(inks)
 q(box).innerHTML=entries.map(([role,ink])=>'<span><i aria-hidden="true" style="--sample:'+ink+'"></i> '+role+' '+ink+'</span>').join('')
}
function showUI(){
 const id=input('ui'),asset=d.art[id],zoom=Number(input('ui-zoom'))
 const interaction=id==='interaction-icon'
 q('icon-l').querySelector('figcaption').textContent=interaction?'Normal':'E2.4 · Barrel gốc'
 q('icon-r').querySelector('figcaption').textContent=interaction?'Active':'Icon inventory vẽ lại'
 img(q('ui-original'),interaction?asset.frames[0]:d.barrel,interaction?'Interaction normal':'E2.4 barrel',zoom)
 img(q('ui-variant'),asset.frames.at(-1),interaction?'Interaction active':'Inventory barrel',zoom)
 q('ui-board').dataset.backdrop=input('ui-backdrop')
 q('ui-summary').textContent=interaction?'16 × 16 · cùng silhouette · 75 pixel đổi màu giữa Normal và Active':'32 × 32 · thân gỗ tròn, nắp và hai đai kim loại'
 palette('ui-palette',asset.qa.ramp)
 q('ui-qa').href='../benchmarks/results/e64/packages/'+id+'/qa.json'
}
function effectView(){
 const id=input('effect'), a=d.art[id],k=Number(input('fx-zoom')),mode=input('fx-layer')
 const image=mode==='alpha'?a.alpha:k===4?a.zoom:a.sheet
 img(q('strip'),image,d.assetNames[id]+' · dải frame',mode==='alpha'?k:1)
 q('vfx-data').innerHTML=rows(a.qa.frames.map((f,i)=>[i+1,f.id,f.durationMs,f.coverage,f.components.join(', ')||'—',a.qa.transitions[i-1]?.overlap??'—']))
 palette('fx-palette',a.qa.ramp)
 q('fx-info').textContent=a.qa.timing.totalMs+' ms · '+a.qa.frames.length+' frame · clear '+a.qa.timing.clearTailMs+' ms'
 q('fx-qa').href='../benchmarks/results/e64/packages/'+id+'/qa.json'
}
function scenes(){
 const id=input('scene'),light=input('light'),mode=input('scene-layer'),zoom=Number(input('scene-zoom'))
 const file=d.gameplay[id+'-'+light],media=file[mode==='peak'&&zoom===4?'zoom':mode]
 img(q('before'),file.before,'Cảnh gốc '+d.sceneNames[id],zoom)
 q('comparison').classList.toggle('stack',zoom===4)
 q('after').hidden=!media
 q('no-layer').hidden=!!media
 if(media)img(q('after'),media,q('scene-layer').selectedOptions[0].text+' · '+d.sceneNames[id],mode==='peak'?1:zoom)
 const stat=file.qa.frames[file.qa.peak]
 q('scene-info').textContent='Anchor ('+file.qa.anchor.join(', ')+') · peak '+stat.vfxPixels+
  ' px · phản sáng '+stat.reflectionPixels+' px · giữ '+stat.actorPixels+' px RGBA nhân vật'
 q('scene-qa').href='../benchmarks/results/e64/gameplay/'+id+'-'+light+'/qa.json'
}
function player(prefix,source){
 const canvas=q(prefix+'-canvas'), context=canvas.getContext('2d')
 let ticket=0,request=0,bits,config
 function display(i){
  const {w,h,timeline}=config
  context.clearRect(0,0,w,h)
  context.drawImage(bits,w*i,0,w,h,0,0,w,h)
  q(prefix+'-frame').value=i
  q(prefix+'-caption').textContent=(i+1)+' · '+timeline[i].id+' · '+timeline[i].durationMs+' ms'
 }
 async function load(){
  const id=++ticket
  cancelAnimationFrame(request)
  bits=null
  q(prefix+'-play').disabled=true
  const next=source(), image=new Image()
  image.src=next.sheet.src
  await image.decode()
  if(id!==ticket)return
  config=next
  bits=image
  canvas.width=next.w
  canvas.height=next.h
  context.imageSmoothingEnabled=false
  q(prefix+'-frame').max=next.timeline.length-1
  display(next.peak)
  q(prefix+'-play').disabled=false
 }
 q(prefix+'-play').addEventListener('click',()=>{
  if(!bits)return
  cancelAnimationFrame(request)
  const t=config.timeline,total=t.reduce((n,f)=>n+f.durationMs,0), repeat=q(prefix+'-repeat').checked
  const start=performance.now()
  function run(at){
   let elapsed=Math.max(0,at-start)
   if(!repeat && elapsed>=total){
    display(t.length-1)
    q(prefix+'-caption').textContent+=' · đã kết thúc'
    return
   }
   elapsed%=total
   let i=0
   while(i<t.length-1&&elapsed>=t[i].durationMs){elapsed-=t[i].durationMs;i++}
   display(i)
   request=requestAnimationFrame(run)
  }
  request=requestAnimationFrame(run)
 })
 q(prefix+'-stop').addEventListener('click',()=>cancelAnimationFrame(request))
 q(prefix+'-frame').addEventListener('input',()=>{
  cancelAnimationFrame(request)
  if(bits)display(Number(q(prefix+'-frame').value))
 })
 return load
}
const loadFx=player('fx',()=>{
 const a=d.art[input('effect')]
 return {sheet:a.sheet,w:a.qa.native[0],h:a.qa.native[1],timeline:a.qa.frames,peak:a.qa.frames.findIndex(f=>f.id==='peak')}
})
const loadScene=player('game',()=>{
 const r=d.gameplay[input('scene')+'-'+input('light')]
 return {sheet:r.frames,w:320,h:208,timeline:d.art[r.qa.effect].qa.frames,peak:r.qa.peak}
})
for(const id of ['ui','ui-zoom','ui-backdrop'])q(id).addEventListener('change',showUI)
for(const id of ['effect','fx-zoom','fx-layer'])q(id).addEventListener('change',effectView)
q('effect').addEventListener('change',loadFx)
for(const id of ['scene','light','scene-layer','scene-zoom'])q(id).addEventListener('change',scenes)
for(const id of ['scene','light'])q(id).addEventListener('change',loadScene)
q('rubric').addEventListener('submit',event=>{
 event.preventDefault()
 const fields=Object.fromEntries(new FormData(event.currentTarget))
 const grades=(prefix,ids,names)=>Object.fromEntries(ids.map((id,i)=>[id,Object.fromEntries(names.map((name,j)=>[name,Number(fields[prefix+i+'-'+j])||null]))]))
 const review={milestone:'E6.4',reviewer:fields.reviewer,notes:fields.notes,ui:grades('ui',d.uiIds,d.uiCriteria),vfx:grades('fx',d.fxIds,d.vfxCriteria)}
 const link=document.createElement('a')
 link.href=URL.createObjectURL(new Blob([JSON.stringify(review,null,2)],{type:'application/json'}))
 link.download='e64-human-ui-vfx-review.json'
 link.click()
 setTimeout(()=>URL.revokeObjectURL(link.href),3000)
})
showUI()
effectView()
scenes()
loadFx()
loadScene()
`;
const playback=(id:string,label:string,w:number,h:number)=>`<div class="controls">
<button class="primary" type="button" id="${id}-play" disabled>Phát</button><button type="button" id="${id}-stop">Dừng</button>
<label class="check"><input id="${id}-repeat" type="checkbox"> Lặp để duyệt</label></div>
<figure class="art"><div class="pixels" tabindex="0" role="region" aria-label="${label}"><canvas id="${id}-canvas" width="${w}" height="${h}" role="img" aria-label="${label}"></canvas></div><figcaption id="${id}-caption"></figcaption></figure>
<div class="controls"><label class="frame">Frame <input id="${id}-frame" type="range" min="0" max="6" value="0"></label></div>`;
const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · E6.4 Pixel UI/VFX</title><style>${css}
header{padding:clamp(1.7rem,6vw,3rem) 0 1.1rem}
h1{max-width:none;font-size:clamp(2.35rem,6vw,4.8rem)}
section{padding-top:2rem}
.dual{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,325px),1fr));gap:.75rem}
.dual.stack{grid-template-columns:1fr}
.art{display:block}
.pixels{overflow:auto;max-width:100%;text-align:center}
.pixels img,.pixels canvas{margin:auto;max-width:none}
.pixels:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.icon-board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem}
.icon-board .pixels{min-height:136px;display:grid;place-items:center;background:#171b25}
.icon-board[data-backdrop=light] .pixels{background:#e8d7b5}

[hidden]{display:none!important}
select,.controls label{max-width:100%}
.controls label.check{display:flex;align-items:center;min-height:44px;gap:.45rem}
.controls input[type=text]{min-height:44px;background:var(--picture);color:var(--ink);font:inherit;border:1px solid #5e776d;border-radius:6px}
.target{color:var(--gold);white-space:nowrap;font-weight:500}
</style></head><body>
<header><div class="wrap"><p class="eyebrow">LumaSprite Engine · E6.4</p><h1>Tín hiệu và vật tư</h1>
<p class="lede">Hai icon và hai hiệu ứng pixel thử trong sân khảo sát và tàn tích, với đối chiếu ở đúng kích thước game.</p>
<p class="status">E6_4_READY_FOR_HUMAN_UI_VFX_REVIEW</p></div></header>
<nav aria-label="Báo cáo"><div class="wrap"><a href="#ui-section">Icon</a><a href="#vfx">Chuyển động</a><a href="#gameplay">Trong cảnh</a><a href="#review">Phiếu duyệt</a></div></nav>
<main class="wrap"><section id="ui-section"><h2>Icon tương tác và inventory</h2><div class="viewer">
<div class="controls"><label>Icon <select id="ui">${opt(uiOptions)}</select></label><label>Nền <select id="ui-backdrop">${opt({dark:'Tối',light:'Sáng'})}</select></label>
<label>Tỷ lệ <select id="ui-zoom">${opt({'1':'1× native','4':'4×'})}</select></label></div>
<div id="ui-board" class="icon-board"><figure class="art" id="icon-l"><figcaption></figcaption><div class="pixels"><img id="ui-original" alt=""></div></figure>
<figure class="art" id="icon-r"><figcaption></figcaption><div class="pixels"><img id="ui-variant" alt=""></div></figure></div>
<p class="quiet" id="ui-summary"></p><div id="ui-palette" class="swatches"></div><a id="ui-qa" href="#">QA icon</a></div></section>
<section id="vfx"><h2>Nhịp kích hoạt và nhặt đồ</h2><div class="viewer"><div class="controls">
<label>Hiệu ứng <select id="effect">${opt(vfxOptions)}</select></label><label>Dải frame <select id="fx-layer">${opt({color:'Màu',alpha:'Alpha'})}</select></label>
<label>Tỷ lệ dải <select id="fx-zoom">${opt({'1':'1× native','4':'4× nearest-neighbor'})}</select></label></div>
<div class="pixels" tabindex="0" role="region" aria-label="Dải frame"><img id="strip" alt=""></div>
<p id="fx-info" class="quiet"></p>
${playback('fx','Hiệu ứng tại 1×',48,48)}<div id="fx-palette" class="swatches"></div></div>
<h3>Cụm pixel và thời lượng</h3>
<div class="scroll" tabindex="0"><table><thead><tr><th>Frame</th><th>Pha</th><th>ms</th><th>Pixel</th><th>Kích thước cụm</th><th>Giao với frame trước</th></tr></thead><tbody id="vfx-data"></tbody></table></div>
<a id="fx-qa" href="#">QA và ramp hiệu ứng</a></section>
<section id="gameplay"><h2>Before / after trong cảnh thật</h2><div class="viewer"><div class="controls">
<label>Cảnh <select id="scene">${opt(sceneNames)}</select></label><label>Ánh sáng <select id="light">${opt({day:'Ban ngày',night:'Ban đêm'})}</select></label>
<label>Lớp bên phải <select id="scene-layer">${opt({peak:'Peak composite',focal:'Phân cấp điểm nhìn',reflection:'Phản sáng trên bề mặt'})}</select></label>
<label>Tỷ lệ <select id="scene-zoom">${opt({'1':'1× native','4':'4× nearest-neighbor'})}</select></label></div>
<div class="dual" id="comparison">${figure('Cảnh đã khóa','before')}
<figure class="art"><figcaption>Composite hoặc lớp kiểm</figcaption><div class="pixels" role="region" tabindex="0" aria-label="Gameplay composite"><img id="after" alt="" hidden><p id="no-layer" hidden>Phản sáng chỉ có ở cảnh tín hiệu ban đêm.</p></div></figure></div>
<p id="scene-info" class="quiet"></p>${playback('game','Gameplay playback tại 1×',320,208)}<a id="scene-qa" href="#">QA cảnh đang chọn</a></div>
<p>R1 và R2 dùng cùng dải Signal Activation. C1 thử dấu tương tác, pickup sparkle và ô inventory. Studio ${studio.studioRevision} giữ đúng RGBA cho 3 PNG và 13 frame VFX.</p>
<div class="downloads"><a href="e64-pixel-ui-vfx.md">Kiến trúc, QA và PR summary</a><a href="e63-artistic-acceptance.md">Quyết định E6.3</a>
<a href="../${root}SHA256SUMS">SHA-256</a><a href="../${root}studio-parity.json">Studio parity</a></div></section>
<section id="review"><h2>Phiếu duyệt mỹ thuật</h2><p>Chấm từng asset từ 1 đến 5 sau khi xem ở 1×. Dấu ≥ 4 là mục tiêu cho tiêu chí trọng yếu. Ghi nhận xét về nền sáng, nền tối và holdout R2.</p>
<form id="rubric" class="score"><div class="controls"><label>Người duyệt <input name="reviewer" type="text"></label></div>
<div class="scroll" tabindex="0"><table><thead><tr><th>UI</th><th>Tương tác</th><th>Inventory</th></tr></thead>
<tbody>${rubric(uiCriteria,'ui',Object.values(uiOptions))}</tbody></table></div>
<div class="scroll" tabindex="0"><table><thead><tr><th>VFX</th><th>Signal</th><th>Pickup</th></tr></thead>
<tbody>${rubric(vfxCriteria,'fx',Object.values(vfxOptions))}</tbody></table></div>
<label>Nhận xét <textarea name="notes" rows="4"></textarea></label><div><button class="primary">Tải phiếu JSON</button></div></form></section></main>
<script id="data" type="application/json">${JSON.stringify({art,gameplay,assetNames,sceneNames,barrel:image(barrel),uiCriteria,vfxCriteria,uiIds:Object.keys(uiOptions),fxIds:Object.keys(vfxOptions)}).replaceAll('<','\\u003c')}</script>
<script>${script}</script></body></html>`;
writeFileSync('docs/LumaSprite-Engine-E6.4-Report.html',html);
console.log('Offline E6.4 report generated.');
