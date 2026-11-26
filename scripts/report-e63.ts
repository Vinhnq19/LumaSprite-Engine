import { readFileSync,writeFileSync } from 'node:fs';
import { sha256 } from '../src/quality/raster.ts';

const paths={e62:'benchmarks/results/e62/',e63:'benchmarks/results/e63/'};
const parse=(bytes:Buffer)=>JSON.parse(bytes.toString('utf8'));
const indices={e62:parse(readFileSync(paths.e62+'benchmark.json')),e63:parse(readFileSync(paths.e63+'benchmark.json'))};
const cases={
  'r1-signal-entrance':'R1 · Signal Ruins Entrance','r2-signal-clearing':'R2 · Overgrown Signal Clearing',
  'c1-courtyard':'C1 · Survey Station Courtyard','c2-supply-stop':'C2 · Roadside Supply Stop','c2-night-quality':'C2-Q · Night Readability',
};
const modes={view:'Vật liệu hoàn thiện',flat:'Hình khối phẳng',silhouette:'Silhouette kiến trúc',depth:'Layer và occlusion',
  collision:'Collision',walkable:'Vùng đi được',route:'Tuyến đi',focal:'Phân cấp điểm nhìn',materials:'Mặt nạ vật liệu',kit:'Atlas',lighting:'Lớp ánh sáng'};
const names={front:'Trước cổng',threshold:'Tại ngưỡng',side:'Bên công trình',rear:'Sau cổng','between-props':'Giữa các khối',foreground:'Sau vật cản tiền cảnh'};
function read(edition:keyof typeof paths,file:string){
  const bytes=readFileSync(paths[edition]+file);
  if(sha256(bytes)!==indices[edition].sha256[file])throw Error(file+' checksum mismatch.');
  return bytes;
}
const png=(edition:keyof typeof paths,file:string)=>{
  const bytes=read(edition,file);
  return {url:'data:image/png;base64,'+bytes.toString('base64'),w:bytes.readUInt32BE(16),h:bytes.readUInt32BE(20)};
};
const media={view:'scene.png',four:'scene-4x.png',depth:'layer-overlay.png',
  collision:'collision-overlay.png',walkable:'walkable-mask.png',route:'route-overlay.png',focal:'focal-overlay.png',materials:'material-mask.png',kit:'kit.png'};
const table=Object.fromEntries(Object.keys(cases).flatMap(id=>(id==='c2-night-quality'?['night']:['day','night']).map(light=>{
  const edition=id==='c1-courtyard'||id==='c2-supply-stop'?'e62':'e63';
  const stem=id+'-'+light;
  const ruins=id.startsWith('r');
  const files={...media,...(light==='night'?{lighting:'night-light.png'}:{}),
    ...(ruins?{flat:'flat-geometry.png',silhouette:'architecture-silhouette.png'}:{})};
  return [stem,Object.fromEntries(Object.entries(files).map(([mode,path])=>[mode,png(edition,'packages/'+stem+'/'+path)]))];
})));
const stats=parse(read('e63','comparison.json'));
const probes=Object.fromEntries(stats.map(({id,light}:{id:string;light:string})=>{
  const stem=id+'-'+light;
  return [stem,{sheet:png('e63','spatial/'+stem+'.png'),poses:parse(read('e63','spatial/'+stem+'.json'))}];
}));
const closeout=parse(read('e63','e62-quality-closeout.json'));
const style=parse(readFileSync('benchmarks/fixtures/e61r/style-profile.json'));
const studio=parse(readFileSync(paths.e63+'studio-parity.json'));
const criteria=[
 ['Silhouette kiến trúc',true],['Phối cảnh nhất quán',true],['Tỷ lệ',true],['Chiều sâu',true],['Tách vật liệu',false],
 ['Hài hòa palette',false],['Cụm pixel',false],['Ánh sáng',true],['Che khuất',true],['Phân cấp điểm nhìn',true],
 ['Bố cục',false],['Khả năng đọc khi chơi',true],['Bản sắc hình ảnh',true],['Khả năng tái sử dụng',false],
] as const;
const grades=criteria.map(([name,key],i)=>'<tr><th scope="row">'+name+(key?' <span class="target">≥ 4</span>':'')+'</th>'+
  ['R1','R2'].map(id=>'<td><select name="'+id+'-'+i+'" aria-label="'+id+' '+name+'"><option value="">—</option>'+
  [1,2,3,4,5].map(n=>'<option>'+n+'</option>').join('')+'</select></td>').join('')+'</tr>').join('');
const opt=(values:Record<string,string>,selected?:string)=>Object.entries(values).map(([id,label])=>
  '<option value="'+id+'"'+(id===selected?' selected':'')+'>'+label+'</option>').join('');
const card='<figure class="art"><figcaption></figcaption><div class="pixels" role="region" aria-label="Ảnh pixel" tabindex="0"><img alt="" hidden><p hidden></p></div></figure>';
const css=readFileSync('research/open-source/art-quality/report.css','utf8');
const script=String.raw`
const d=JSON.parse(document.getElementById('data').textContent)
const q=id=>document.getElementById(id)
const choice=id=>q(id).value
const rows=(values)=>values.map(row=>'<tr>'+row.map((x,i)=>i?'<td>'+x+'</td>':'<th scope="row">'+x+'</th>').join('')+'</tr>').join('')
function view(){
 const mode=choice('mode'),sample=Number(choice('zoom')),light=choice('light')
 const gallery=q('comparison')
 gallery.classList.toggle('stack',sample===4)
 ;[...gallery.querySelectorAll('figure')].forEach((fig,i)=>{
  const id=choice(i?'right':'left')
  fig.querySelector('figcaption').textContent=d.cases[id]
  const image=d.table[id+'-'+light]?.[mode==='view'&&sample===4?'four':mode]
  const node=fig.querySelector('img'),message=fig.querySelector('p')
  node.hidden=!image
  message.hidden=!!image
  if(!image){
   message.textContent=id==='c2-night-quality'&&light==='day'?'C2-Q có ở bản đêm.':'Lớp này không có cho lựa chọn hiện tại.'
   return
  }
  const zoom=mode==='view'?1:sample
  node.src=image.url
  node.width=image.w*zoom
  node.height=image.h*zoom
  node.alt=d.cases[id]+' · '+q('mode').selectedOptions[0].text+' · '+sample+'×'
 })
 showStats()
}
function showStats(){
 const light=choice('light'),scope=choice('ruin')
 const selected=d.stats.find(s=>s.id===scope&&s.light===light)
 q('state').textContent=d.cases[scope]+' · Seed '+selected.seed+' · '+selected.modules.length+' mô-đun · '+selected.supportPixels+' pixel kết nối'
 q('modules').innerHTML=rows(selected.modules.map(m=>[m.id,m.kind,m.at.join(', '),m.width+' × '+m.height+' × '+m.depth]))
 q('texture').innerHTML=rows(selected.hierarchy.map(z=>[z.id,z.role,z.samples,z.per100??'—']))
 q('routes').innerHTML=rows(selected.routes.map((r,i)=>[r.id,r.tested,selected.routeVisibility[i].samples,selected.routeVisibility[i].minPixels]))
 const palettes=[...selected.swatches,{material:'moss / grass',ramp:d.grass[light]}]
 q('palette').innerHTML=palettes.map(p=>'<h3>'+p.material+'</h3><div class="swatches">'+p.ramp.map(c=>'<span><i aria-hidden="true" style="--sample:'+c+'"></i> '+c+'</span>').join('')+'</div>').join('')
 const root='../benchmarks/results/e63/packages/'+scope+'-'+light+'/'
 q('package').href=root+'manifest.json'
 q('spec').href=root+'composition-spec.json'
}
let request=0
async function showProbe(){
 const requestId=++request
 const data=d.probes[choice('ruin')+'-'+choice('light')]
 const i=data.poses.findIndex(p=>p.id===choice('probe'))
 const img=new Image()
 img.src=data.sheet.url
 await img.decode()
 if(request!==requestId)return
 const context=q('sample').getContext('2d')
 context.imageSmoothingEnabled=false
 context.drawImage(img,i%3*320,Math.floor(i/3)*208,320,208,0,0,320,208)
 const p=data.poses[i]
 const actors={surveyor:'Field Surveyor',courier:'Forest Courier'}
 const covers=Object.entries(p.hiddenBy).map(([id,pixels])=>id+' '+pixels+' px').join(' · ')
 q('pose').textContent=actors[p.actor]+' · ('+p.at.join(', ')+') · hiện '+p.visible+'/'+p.visibleBefore+' px'+(covers?' · '+covers:'')
}
for(const id of ['left','right','light','mode','zoom'])q(id).addEventListener('change',view)
q('light').addEventListener('change',showProbe)
q('ruin').addEventListener('change',()=>{showStats();showProbe()})
q('probe').addEventListener('change',showProbe)
q('quality').addEventListener('click',()=>{
 q('left').value='c2-supply-stop'
 q('right').value='c2-night-quality'
 q('light').value='night'
 q('mode').value='view'
 q('zoom').value='1'
 view();showProbe();q('gallery').scrollIntoView()
})
q('rubric').addEventListener('submit',event=>{
 event.preventDefault()
 const f=Object.fromEntries(new FormData(event.currentTarget))
 const scores=Object.fromEntries(['R1','R2'].map(id=>[id,Object.fromEntries(d.criteria.map(([name],i)=>[name,Number(f[id+'-'+i])||null]))]))
 const link=document.createElement('a')
 link.href=URL.createObjectURL(new Blob([JSON.stringify({milestone:'E6.3',reviewer:f.reviewer,notes:f.notes,scores},null,2)],{type:'application/json'}))
 link.download='e63-human-variety-review.json'
 link.click()
 setTimeout(()=>URL.revokeObjectURL(link.href),3000)
})
view()
showProbe()
`;
const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · E6.3 Forest Signal Ruins</title><style>${css}
header{padding:clamp(1.7rem,6vw,3rem) 0 1.1rem}
h1{max-width:none;font-size:clamp(2.35rem,6vw,4.8rem)}
section{padding-top:2rem}
.dual{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,325px),1fr));gap:.75rem}
.dual.stack{grid-template-columns:1fr}
.art{display:block}
.pixels{overflow:auto;max-width:100%;text-align:center}
.pixels img,.pixels canvas{margin:auto;max-width:none}
.pixels:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
[hidden]{display:none!important}
select,.controls label{max-width:100%}
.controls input[type=text]{min-height:44px;background:var(--picture);color:var(--ink);font:inherit;border:1px solid #5e776d;border-radius:6px}
.target{color:var(--gold);white-space:nowrap;font-weight:500}
#palette{display:grid;gap:.65rem}
#palette h3{margin:.5rem 0 0}
</style></head><body>
<header><div class="wrap"><p class="eyebrow">LumaSprite Engine · E6.3</p><h1>Forest Signal Ruins</h1>
<p class="lede">Vòm đá, tường đổ và trạm tín hiệu rừng. So bố cục authored và holdout với C1, C2 và bản C2-Q ở kích thước gốc.</p>
<p class="status">E6_3_READY_FOR_HUMAN_VARIETY_REVIEW</p></div></header>
<nav aria-label="Báo cáo"><div class="wrap"><a href="#gallery">Gallery</a><a href="#quality-closeout">C2-Q</a><a href="#spatial">Chiều sâu</a><a href="#qa">Chỉ số</a><a href="#review">Phiếu duyệt</a></div></nav>
<main class="wrap"><section id="gallery"><h2>Hai bố cục tàn tích</h2><div class="viewer"><div class="controls">
<label>Cảnh trái <select id="left">${opt(cases,'r1-signal-entrance')}</select></label><label>Cảnh phải <select id="right">${opt(cases,'r2-signal-clearing')}</select></label>
<label>Ánh sáng <select id="light">${opt({day:'Ban ngày',night:'Ban đêm'})}</select></label>
<label>Lớp hiển thị <select id="mode">${opt(modes)}</select></label><label>Tỷ lệ <select id="zoom">${opt({'1':'1× native','4':'4× nearest-neighbor'})}</select></label>
</div><div id="comparison" class="dual">${card}${card}</div><p class="quiet">320 × 208 native · 32 px/unit · hướng 3/4 phải · ánh sáng trên-trái</p></div></section>
<section id="quality-closeout"><h2>C2 Night và C2-Q</h2>
<p>P10 chênh luma viền tăng từ 11 lên 16 cho Surveyor và từ 15 lên 25 cho Courier. Ánh sáng nền thay đổi theo polygon vật liệu. Hình actor, pivot và collision giữ nguyên.</p>
<button class="primary" id="quality" type="button">So C2 Night ở 1×</button>
<p>Tuyến vòng có ${closeout.rear.samples.length} điểm mẫu, tất cả còn pixel actor. Probe che hoàn toàn nằm ngoài vùng đi được. Hai clip E5.4 giữ tiếp điểm thế giới dọc trục clip, độ dịch chiều sâu chiếu lên màn hình là 2 px.</p>
<div class="downloads"><a href="e62-artistic-closeout.md">Quyết định và closeout E6.2</a><a href="../${paths.e63}e62-quality-closeout.json">Số liệu đối chiếu</a></div></section>
<section id="spatial"><h2>Chiều sâu và vật cản</h2><div class="viewer"><div class="controls">
<label>Cảnh tàn tích <select id="ruin">${opt({'r1-signal-entrance':cases['r1-signal-entrance'],'r2-signal-clearing':cases['r2-signal-clearing']})}</select></label>
<label>Điểm thử <select id="probe">${opt(names)}</select></label></div>
<figure class="art"><div class="pixels"><canvas id="sample" width="320" height="208" role="img" aria-label="Ảnh kiểm occlusion ở 1×"></canvas></div><figcaption id="pose"></figcaption></figure></div></section>
<section id="qa"><h2>Vật liệu, mật độ và nguồn</h2><p id="state"></p>
<p>Overlay thấy các vùng trọng tâm, tương tác và nghỉ. Bảng mật độ đếm cạnh luma ≥ 6 trong cùng vật liệu trên 100 mẫu.</p>
<div class="scroll" tabindex="0"><table><thead><tr><th>Mô-đun</th><th>Họ hình học</th><th>Anchor</th><th>Rộng × cao × sâu</th></tr></thead><tbody id="modules"></tbody></table></div>
<div class="scroll" tabindex="0"><table><thead><tr><th>Vùng</th><th>Vai trò</th><th>Mẫu</th><th>Cạnh / 100 mẫu</th></tr></thead><tbody id="texture"></tbody></table></div>
<div class="scroll" tabindex="0"><table><thead><tr><th>Tuyến</th><th>Pixel quét thân</th><th>Điểm đo occlusion</th><th>Pixel actor tối thiểu</th></tr></thead><tbody id="routes"></tbody></table></div>
<details><summary>Swatch từ Art Style Profile v1</summary><div id="palette"></div></details>
<p>5 gói · ${indices.e63.fileCount} SHA-256 payload · Studio ${studio.studioRevision} giữ RGBA cho ${studio.cases.length} PNG.</p>
<div class="downloads"><a id="package" href="#">Manifest PNG</a><a id="spec" href="#">Spec và seed</a><a href="../${paths.e63}SHA256SUMS">Danh mục SHA-256</a>
<a href="../${paths.e63}studio-parity.json">Studio parity</a><a href="e63-environment-variety.md">Audit, QA và PR summary</a></div></section>
<section id="review"><h2>Phiếu duyệt R1 và R2</h2><p>Chấm mỗi cảnh độc lập từ 1 đến 5 sau khi xem cả ngày và đêm ở 1×. Các mục có dấu ≥ 4 là trọng yếu. Ghi riêng lỗi hình học, không gian hoặc khả năng đọc khi chơi.</p>
<form id="rubric" class="score"><div class="controls"><label>Người duyệt <input name="reviewer" type="text"></label></div>
<div class="scroll" tabindex="0"><table><thead><tr><th>Tiêu chí</th><th>R1</th><th>R2</th></tr></thead><tbody>${grades}</tbody></table></div>
<label>Nhận xét <textarea name="notes" rows="4"></textarea></label><div><button class="primary">Tải phiếu JSON</button></div></form></section></main>
<script id="data" type="application/json">${JSON.stringify({table,cases,stats,probes,criteria,grass:{day:style.illumination.day.grass,night:style.illumination.night.grass}}).replaceAll('<','\\u003c')}</script>
<script>${script}</script></body></html>
`;
writeFileSync('docs/LumaSprite-Engine-E6.3-Report.html',html);
console.log('Offline E6.3 report generated.');
