import { readFileSync,writeFileSync } from 'node:fs';
import { sha256 } from '../src/quality/raster.ts';

const roots={e62:'benchmarks/results/e62/',e61r:'benchmarks/results/e61r/'};
const parse=(bytes: Buffer)=>JSON.parse(bytes.toString('utf8'));
const read=(file: string)=>readFileSync(file);
const manifests={e62:parse(read(roots.e62+'benchmark.json')),e61r:parse(read(roots.e61r+'benchmark.json'))};
function payload(edition:keyof typeof roots,path:string){
  const bytes=read(roots[edition]+path);
  if(sha256(bytes)!==manifests[edition].sha256[path]) throw new Error('Benchmark hash differs at '+path);
  return bytes;
}
const img=(edition:keyof typeof roots,path:string)=>{
  const bytes=payload(edition,path);
  return {src:'data:image/png;base64,'+bytes.toString('base64'),w:bytes.readUInt32BE(16),h:bytes.readUInt32BE(20)};
};
const raw=parse(payload('e62','comparison.json'));
const studio=parse(read(roots.e62+'studio-parity.json'));
const scenes={'c1-courtyard':'C1 · Survey Station Courtyard','c2-supply-stop':'C2 · Roadside Supply Stop'};
const light={day:'Ban ngày',night:'Ban đêm'};
const common={scene:'scene.png',four:'scene-4x.png',depth:'layer-overlay.png',collision:'collision-overlay.png',materials:'material-mask.png',atlas:'kit.png'};
const modes={scene:'Toàn cảnh',depth:'Layer và occlusion',collision:'Collision',walkable:'Vùng đi được',routes:'Các tuyến đi',focal:'Phân cấp bố cục',
  materials:'Mặt nạ vật liệu',atlas:'Atlas B1',illumination:'Lớp ánh sáng'};
const actorNames={surveyor:'Field Surveyor',courier:'Forest Courier'};
const probeNames={front:'Trước cửa',threshold:'Tại ngưỡng',side:'Bên công trình',rear:'Sau công trình','between-props':'Giữa props',foreground:'Sau prop tiền cảnh'};
const grades=[
  ['Bố cục',true],['Phân cấp điểm nhìn',true],['Độ rõ kiến trúc',false],['Chiều sâu không gian',true],
  ['Tỷ lệ nhân vật',false],['Che khuất',true],['Tương tác qua cửa',true],['Hài hòa palette',false],
  ['Tách vật liệu',false],['Ánh sáng',true],['Cụm pixel',false],['Mức sẵn sàng dùng trong game',true],
] as const;
const options=(obj:Record<string,string>)=>Object.entries(obj).map(([value,name])=>'<option value="'+value+'">'+name+'</option>').join('');
function media(edition:keyof typeof roots,stem:string,files:Record<string,string>){
  return Object.fromEntries(Object.entries(files).map(([id,file])=>[id,img(edition,'packages/'+stem+'/'+file)]));
}
const cases=Object.fromEntries(raw.map((row:{id:string;light:string;baseline:string})=>{
  const stem=row.id+'-'+row.light;
  const n=row.light==='night'?{illumination:'night-light.png'}:{};
  const proof='spatial/'+stem;
  const shots=Object.fromEntries(Object.keys(actorNames).map(actor=>{
    const path='playback/'+stem+'-'+actor;
    return [actor,{png:img('e62',path+'.png'),qa:parse(payload('e62',path+'.json'))}];
  }));
  return [stem,{row, current:media('e62',stem,{...common,...n,walkable:'walkable-mask.png',routes:'route-overlay.png',focal:'focal-overlay.png'}),
    baseline:media('e61r',row.baseline,{...common,...n}),spatial:img('e62',proof+'.png'),spatialCollision:img('e62',proof+'-collision.png'),
    probes:parse(payload('e62',proof+'.json')),shots}];
}));
const fig=()=>'<figure class="art"><figcaption></figcaption><div class="pixel-window" tabindex="0" role="region" aria-label="Xem ảnh pixel"><img alt="" hidden><p hidden></p></div></figure>';
const score=grades.map(([label,key],i)=>'<tr><th scope="row">'+label+(key?' <span class="target">≥ 4</span>':'')+'</th>'+
  ['C1','C2'].map(id=>'<td><select name="'+id+i+'" aria-label="'+id+' '+label+'"><option value="">—</option>'+
  [1,2,3,4,5].map(n=>'<option>'+n+'</option>').join('')+'</select></td>').join('')+'</tr>').join('');
const ui=read('research/open-source/art-quality/report.css').toString('utf8');
const script=String.raw`
const content=JSON.parse(document.getElementById('data').textContent)
const get=id=>document.getElementById(id)
const setText=(id,value)=>get(id).textContent=value
const lookup=(scene)=>content.cases[scene+'-'+get('light').value]
const active=()=>lookup(get('scene').value)
const line=(v)=>'<tr>'+v.map((x,i)=>i?'<td>'+x+'</td>':'<th scope="row">'+x+'</th>').join('')+'</tr>'
const stageNames={approach:'Tiếp cận',landing:'Sân trước cửa',threshold:'Trong ngưỡng',exit:'Ngay sau ngưỡng'}
function gallery(){
 const current=get('scene').value, other=current==='c1-courtyard'?'c2-supply-stop':'c1-courtyard'
 const project=get('compare').value==='paired'
 const data=[lookup(current),lookup(project?other:current)]
 const scale=Number(get('zoom').value), mode=get('mode').value
 get('comparison').classList.toggle('stack',scale===4)
 for(const [i,fig] of [...get('comparison').querySelectorAll('figure')].entries()){
  const isBaseline=i===0&&!project
  const item=data[isBaseline?0:project?i:0]
  const label=isBaseline?'B1 · '+item.row.baseline:content.scenes[item.row.id]
  fig.querySelector('figcaption').textContent=label
  const map=item[isBaseline?'baseline':'current']
  const image=map[mode==='scene'&&scale===4?'four':mode]
  const node=fig.querySelector('img'), missing=fig.querySelector('p')
  node.hidden=!image
  missing.hidden=!!image
  if(!image){missing.textContent=isBaseline?'Lớp này thuộc SceneCompositionSpec E6.2.':'Lớp ánh sáng chỉ có ban đêm.';continue}
  const factor=mode==='scene'?1:scale
  node.src=image.src
  node.width=image.w*factor
  node.height=image.h*factor
  node.alt=label+' · '+get('mode').selectedOptions[0].text+' · '+scale+'×'
 }
 const row=active().row
 setText('focus-caption',content.scenes[row.id]+' · 320 × 208 native · 32 px/unit · atlas đối chiếu đúng SHA-256 B1')
 setText('metrics',row.seamSamples+' mẫu nối đạt · Courier p10 luma B1 → E6.2 là '+row.courierEdgeP10.join(' → ')+' · '+row.nightLightPixels+' px lớp sáng')
 const roles={primary:'Điểm chính',secondary:'Khu thao tác',background:'Hậu cảnh',foreground:'Tiền cảnh',rest:'Vùng nghỉ',readability:'Vùng nhân vật'}
 get('zones').innerHTML=row.hierarchy.map(z=>line([z.id,roles[z.role],z.samples,z.per100??'—'])).join('')
 get('paths').innerHTML=row.routes.map(r=>line([r.id,content.actors[r.actor],2*r.halfWidth+1,r.tested])).join('')
 const stem=row.id+'-'+row.light
 get('qa-link').href='../benchmarks/results/e62/packages/'+stem+'/qa.json'
}
let probeVersion=0
async function showProbe(){
 const id=++probeVersion, item=active(), select=get('probe').value
 const img=new Image()
 img.src=(get('probe-mode').value==='collision'?item.spatialCollision:item.spatial).src
 await img.decode()
 if(id!==probeVersion)return
 const context=get('probe-canvas').getContext('2d')
 const index=item.probes.findIndex(row=>row.id===select), row=item.probes[index]
 context.imageSmoothingEnabled=false
 context.drawImage(img,index%3*320,Math.floor(index/3)*208,320,208,0,0,320,208)
 const covers=Object.entries(row.hiddenBy).map(([who,n])=>who+' '+n+' px').join(' · ')
 setText('probe-info',content.actors[row.actor]+' · pivot ('+row.at.join(', ')+') · hiện '+row.visible+'/'+row.visibleBefore+' px'+(covers?' · '+covers:''))
}
let waitFrame=0, clipGeneration=0, clipImage, currentClip
const clip=get('walk').getContext('2d')
clip.imageSmoothingEnabled=false
async function loadWalk(){
 const id=++clipGeneration
 cancelAnimationFrame(waitFrame)
 get('play').disabled=true
 clipImage=null
 const shot=active().shots[get('actor').value], sprite=new Image()
 sprite.src=shot.png.src
 await sprite.decode()
 if(id!==clipGeneration)return
 currentClip=shot.qa
 clipImage=sprite
 get('frame').max=currentClip.steps.length-1
 showFrame(0)
 get('play').disabled=false
 setText('motion-metrics',currentClip.tested+' mẫu thân thông · trượt theo trục clip '+currentClip.maxForwardSlip+' px · dịch chân theo chiều sâu tối đa '+currentClip.maxScreenDepthSlip+' px')
 get('proof').href='../benchmarks/results/e62/playback/'+active().row.id+'-'+active().row.light+'-'+get('actor').value+'.json'
}
function showFrame(i){
 const {width,height,columns,steps}=currentClip
 const s=steps[i]
 clip.drawImage(clipImage,i%columns*width,Math.floor(i/columns)*height,width,height,0,0,width,height)
 if(get('marks').checked){
  for(const sample of steps){
   const [x,y]=sample.at
   clip.fillStyle=sample.stage==='threshold'?'#ffd88e':'#9ae6bc'
   clip.fillRect(x,y,2,2)
  }
  for(const foot of s.contacts){
   const [x,y]=foot.at
   clip.fillStyle=foot.state==='planted'?'#ffd88e':'#a6d9ff'
   clip.fillRect(x-2,y,5,1)
   clip.fillRect(x,y-2,1,5)
  }
 }
 get('frame').value=i
 setText('position',stageNames[s.stage]+' · '+s.phase+' · ('+s.at.join(', ')+') · '+s.visible+'/'+s.original+' px')
}
get('play').addEventListener('click',()=>{
 cancelAnimationFrame(waitFrame)
 const steps=currentClip.steps,start=performance.now()
 const tick=now=>{
  let i=0,ms=steps[0].ms
  while(i<steps.length-1 && now-start>=ms) {i++;ms+=steps[i].ms}
  showFrame(i)
  if(i<steps.length-1)waitFrame=requestAnimationFrame(tick)
 }
 waitFrame=requestAnimationFrame(tick)
})
get('frame').addEventListener('input',()=>{cancelAnimationFrame(waitFrame);if(clipImage)showFrame(Number(get('frame').value))})
get('marks').addEventListener('change',()=>{if(clipImage)showFrame(Number(get('frame').value))})
for(const id of ['scene','light'])get(id).addEventListener('change',()=>{gallery();showProbe();loadWalk()})
for(const id of ['compare','mode','zoom'])get(id).addEventListener('change',gallery)
for(const id of ['probe','probe-mode'])get(id).addEventListener('change',showProbe)
get('actor').addEventListener('change',loadWalk)
get('rubric').addEventListener('submit',event=>{
 event.preventDefault()
 const values=Object.fromEntries(new FormData(event.currentTarget))
 const scores=Object.fromEntries(['C1','C2'].map(id=>[id,Object.fromEntries(content.grades.map(([label],i)=>[label,Number(values[id+i])||null]))]))
 const url=URL.createObjectURL(new Blob([JSON.stringify({milestone:'E6.2',reviewer:values.reviewer,notes:values.notes,scores},null,2)],{type:'application/json'}))
 const save=document.createElement('a')
 save.href=url
 save.download='e62-human-scene-review.json'
 save.click()
 setTimeout(()=>URL.revokeObjectURL(url),3000)
})
gallery()
showProbe()
loadWalk()
`;
const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · E6.2 Scene Composition</title><style>${ui}
header{padding:clamp(1.7rem,6vw,3rem) 0 1.1rem}
h1{max-width:none;font-size:clamp(2.4rem,6vw,4.8rem)}
section{padding-top:2rem}
.dual{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,325px),1fr));gap:.75rem}
.dual.stack{grid-template-columns:1fr}
.art{display:block}
.pixel-window{overflow:auto;max-width:100%;text-align:center}
.pixel-window img,.pixel-window canvas{margin:auto;max-width:none}
.pixel-window:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
[hidden]{display:none!important}
select,.controls label{max-width:100%}
.controls input[type=text]{min-height:44px;background:var(--picture);color:var(--ink);font:inherit;border:1px solid #5e776d;border-radius:6px}
.target{color:var(--gold);white-space:nowrap;font-weight:500}
.controls label.check{display:flex;align-items:center;min-height:44px;gap:.45rem}
</style></head><body>
<header><div class="wrap"><p class="eyebrow">LumaSprite Engine · E6.2</p><h1>Field Outpost</h1>
<p class="lede">Một kit kiến trúc B1 dùng cho sân khảo sát và trạm tiếp tế. Duyệt đường đi, khu thao tác và chiều sâu ở đúng kích thước trong game.</p>
<p class="status">E6_2_READY_FOR_HUMAN_SCENE_REVIEW</p></div></header>
<nav aria-label="Báo cáo"><div class="wrap"><a href="#gallery">So sánh</a><a href="#spatial">Độ sâu</a><a href="#entrance">Qua cửa</a><a href="#qa">Chỉ số</a><a href="#review">Phiếu duyệt</a></div></nav>
<main class="wrap"><section id="gallery"><h2>Hai bố cục, cùng kit</h2>
<div class="viewer"><div class="controls">
<label>Cảnh <select id="scene">${options(scenes)}</select></label><label>So với <select id="compare">${options({paired:'Cảnh E6.2 còn lại',baseline:'B1 đã duyệt'})}</select></label>
<label>Ánh sáng <select id="light">${options(light)}</select></label>
<label>Lớp hiển thị <select id="mode">${options(modes)}</select></label><label>Tỷ lệ <select id="zoom">${options({'1':'1× native','4':'4× nearest-neighbor'})}</select></label>
</div><div class="dual" id="comparison">${fig()}${fig()}</div><p id="focus-caption" class="quiet"></p></div>
<details><summary>Chú giải overlay</summary><p>Trong lớp bố cục, vàng cam là điểm chính, xanh lam là điểm phụ, xanh xám là mặt nền hỗ trợ và vùng nghỉ, tím là tiền cảnh, xanh lục là vùng nhân vật. Vàng nhạt đánh dấu vùng thao tác. Trong lớp tuyến đi, chấm bạc hà là vùng đi được, đường vàng là tuyến đã quét theo bề rộng thân.</p></details></section>
<section id="spatial"><h2>Sáu điểm kiểm chiều sâu</h2>
<div class="viewer"><div class="controls"><label>Điểm thử <select id="probe">${options(probeNames)}</select></label><label>Hiển thị <select id="probe-mode">${options({scene:'Cảnh và actor',collision:'Collision'})}</select></label></div>
<figure class="art"><div class="pixel-window"><canvas id="probe-canvas" width="320" height="208" role="img" aria-label="Ảnh kiểm che khuất"></canvas></div><figcaption id="probe-info"></figcaption></figure></div></section>
<section id="entrance"><h2>Chạy liên tục qua ngưỡng cửa</h2>
<p>Từ mặt sân tới phần nền ngay phía trong cửa. Dùng frame, pivot và timing đã khóa của E5.4. Chọn frame để kiểm thời điểm jamb che tay, đồ mang và silhouette.</p>
<div class="viewer"><div class="controls"><label>Nhân vật <select id="actor">${options(actorNames)}</select></label><button class="primary" id="play" type="button" disabled>Phát một lượt</button><label class="check"><input id="marks" type="checkbox"> Hiện pivot và chân trụ</label></div>
<figure class="art"><div class="pixel-window"><canvas id="walk" width="320" height="208" role="img" aria-label="Playback qua ngưỡng cửa"></canvas></div><figcaption id="position"></figcaption></figure>
<div class="controls"><label class="frame">Frame <input id="frame" type="range" min="0" max="16" value="0"></label></div>
<p id="motion-metrics" class="quiet"></p><a id="proof" href="#">Tọa độ, contact và timing</a></div></section>
<section id="qa"><h2>Chỉ số kỹ thuật và vật liệu</h2><p id="metrics"></p>
<p>Studio <code>${studio.studioRevision}</code> giữ đúng RGBA cho ${studio.cases.length} PNG. Bốn gói và bằng chứng benchmark có ${manifests.e62.fileCount} SHA-256.</p>
<h3>Texture theo vùng</h3><div class="scroll" tabindex="0"><table><thead><tr><th>Vùng</th><th>Vai trò</th><th>Mẫu cùng vật liệu</th><th>Cạnh luma / 100 mẫu</th></tr></thead><tbody id="zones"></tbody></table></div>
<h3>Quét bề rộng theo tuyến</h3><div class="scroll" tabindex="0"><table><thead><tr><th>Tuyến</th><th>Nhân vật chuẩn</th><th>Rộng (px)</th><th>Mẫu thông</th></tr></thead><tbody id="paths"></tbody></table></div>
<div class="downloads"><a id="qa-link" href="#">QA cảnh hiện tại</a><a href="e62-scene-composition.md">Audit, QA và PR summary</a>
<a href="../benchmarks/fixtures/e62/b1-production-lock.json">Khóa B1</a><a href="../${roots.e62}benchmark.json">SHA-256 payload</a>
<a href="../${roots.e62}studio-parity.json">Studio parity</a><a href="../${roots.e62}unity-import.json">Unity Editor import</a></div></section>
<section id="review"><h2>Phiếu duyệt C1 và C2</h2>
<p>Chấm độc lập từ 1 đến 5 ở 1×. Các tiêu chí đánh dấu có mục tiêu từ 4/5. Ghi riêng lỗi không gian, collision hoặc lối qua cửa nếu thấy.</p>
<form id="rubric" class="score"><div class="controls"><label>Người duyệt <input name="reviewer" type="text"></label></div>
<div class="scroll" tabindex="0"><table><thead><tr><th>Tiêu chí</th><th>C1</th><th>C2</th></tr></thead><tbody>${score}</tbody></table></div>
<label>Nhận xét <textarea name="notes" rows="4"></textarea></label><div><button class="primary">Tải phiếu JSON</button></div></form>
</section></main>
<script id="data" type="application/json">${JSON.stringify({cases,grades,scenes,actors:actorNames}).replaceAll('<','\\u003c')}</script><script>${script}</script>
</body></html>
`;
writeFileSync('docs/LumaSprite-Engine-E6.2-Report.html',html);
console.log('Offline E6.2 report generated.');
