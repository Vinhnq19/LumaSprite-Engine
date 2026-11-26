import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from '../src/quality/raster.ts';
import type { renderEnvironment } from '../src/generators/environment/render.ts';

const root='benchmarks/results/e61';
type Entry={layout:string; id:string; finish:'a'|'b'; light:'day'|'night'; changedPixels:number; relative:string};
type QA=ReturnType<typeof renderEnvironment>['metadata'];
const benchmark=JSON.parse(readFileSync(join(root,'benchmark.json'),'utf8')) as {packages:Entry[];fileCount:number;sha256:Record<string,string>};
const read=(file:string)=>{
  const bytes=readFileSync(join(root,file));
  if (benchmark.sha256[file]!==sha256(bytes)) throw new Error('Benchmark hash mismatch at '+file);
  return bytes;
};
const image=(file:string)=>{
  const bytes=read(file);
  return {url:'data:image/png;base64,'+bytes.toString('base64'),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
};
const display={
  scene:'Scene', materials:'Mặt nạ vật liệu', layers:'Layer / occlusion', collision:'Collision',
  kit:'Atlas kiến trúc', kitMaterials:'Mặt nạ atlas',
};
const images={
  scene:'scene.png', materials:'material-mask.png', layers:'layer-overlay.png', collision:'collision-overlay.png',
  kit:'kit.png', kitMaterials:'kit-material-mask.png',
};
const titles:Record<string,string>={'front-court':'Front Court · Sân trước',roadside:'Roadside · Trạm ven đường'};
const candidates=Object.fromEntries(benchmark.packages.map(entry=>{
  const qa=JSON.parse(read(entry.relative+'/qa.json').toString('utf8')) as QA;
  return [entry.id,{...entry,qa,media:Object.fromEntries(Object.entries({...images,zoom:'scene-4x.png'}).map(([id, file])=>
    [id,image(entry.relative+'/'+file)]))}];
}));
const sheet=(columns:string[], rows:(string|number)[][])=>'<div class="scroll" tabindex="0"><table><thead><tr>'+
  columns.map(x=>'<th scope="col">'+x+'</th>').join('')+'</tr></thead><tbody>'+
  rows.map(row=>'<tr>'+row.map((x,i)=>i?'<td>'+x+'</td>':'<th scope="row">'+x+'</th>').join('')+'</tr>').join('')+'</tbody></table></div>';
const ref=(label:string,file:string)=>'<a href="../'+root+'/'+file+'">'+label+'</a>';
const criteria=['Silhouette công trình','Đọc kiến trúc','Phối cảnh nhất quán','Tách vật liệu','Hài hòa palette',
  'Cụm pixel','Hướng sáng','Bóng tiếp xúc','Layer và che khuất','Đọc ở gameplay scale','Bố cục','Cảm nhận tổng thể'];
const score=criteria.map(criterion=>[criterion,...['A','B'].map(finish=>'<select name="'+finish+' · '+criterion+'" aria-label="'+finish+' '+criterion+
  '"><option value="">—</option>'+[1,2,3,4,5].map(n=>'<option>'+n+'</option>').join('')+'</select>')]);
const rgba=(ink:string)=>'<span><i style="--sample:'+ink+'" aria-hidden="true"></i> '+ink+'</span>';
const swatchRow=(colors:readonly string[])=>'<div class="swatches">'+colors.map(rgba).join('')+'</div>';
const legend=(sources:Record<string,string>)=>'<div class="swatches">'+Object.entries(sources).map(([key,value])=>
  '<span><i style="--sample:'+value+'" aria-hidden="true"></i> '+key+'</span>').join('')+'</div>';
const day=candidates['front-court-b-day'].qa, night=candidates['front-court-b-night'].qa;
const mainRows=Object.values(candidates).filter(c=>c.finish==='b').map(({layout,light,qa,changedPixels})=>[
  titles[layout],light,qa.seamSamples,changedPixels,
  qa.occlusion.filter(x=>x.kind==='actor').map(x=>x.visible+'/'+x.visibleBefore).join(' · '),
  qa.occlusion.filter(x=>x.kind==='actor').map(x=>x.p10LumaGap ?? '—').join(' · '),
]);
const settings=readFileSync('research/open-source/art-quality/report.css','utf8')+`
header {padding:2.6rem 0 1.45rem}
h1 {max-width:24ch;font-size:clamp(2.1rem,6.3vw,4.65rem)}
.dual {display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,328px),1fr));gap:.65rem}
.dual.zoom {grid-template-columns:1fr}
.dual .art {display:block;overflow:hidden}
.art .pixels {overflow:auto}
.art img {display:block;margin:auto;max-width:none;image-rendering:pixelated}
.zoom .art img {margin:0}
.controls .check {display:flex;align-items:center;min-height:44px}
#pair-note {margin:.75rem 0 0;color:var(--muted)}
`;
const data=Object.fromEntries(Object.entries(candidates).map(([id,x])=>[id,{
  media:x.media, relative:x.relative, changed:x.changedPixels, seams:x.qa.seamSamples,
}]));
const figure=(finish:string,name:string)=>{
  const initial=data['front-court-'+finish+'-day'].media.scene;
  return '<figure class="art"><figcaption>ENV-'+finish.toUpperCase()+' · '+name+'</figcaption><div class="pixels"><img width="'+initial.width+
    '" height="'+initial.height+'" src="'+initial.url+'" alt="'+name+' · Front Court · Day"></div></figure>';
};
const script=`
const index=JSON.parse(document.querySelector('#visual-data').textContent)
const pick=id=>document.querySelector('#'+id)
const fields=['layout','light','mode','zoom'].map(pick)
const pictures=[...document.querySelectorAll('#comparison img')]
const panel=pick('comparison')
const pretty={scene:'Scene',materials:'Mặt nạ vật liệu',layers:'Layer / occlusion',collision:'Collision',kit:'Atlas',kitMaterials:'Mặt nạ atlas'}
function show() {
 const [layout,light,mode,zoom]=fields.map(x=>x.value)
 const scale=+zoom
 const runs=['a','b'].map(finish=>index[layout+'-'+finish+'-'+light])
 panel.classList.toggle('zoom',scale===4)
 runs.forEach((run,i)=>{
   const png=mode==='scene'&&scale===4?run.media.zoom:run.media[mode]
   const k=mode==='scene'&&scale===4?1:scale
   pictures[i].src=png.url
   pictures[i].width=png.width*k
   pictures[i].height=png.height*k
   pictures[i].style.width=png.width*k+'px'
   pictures[i].style.height=png.height*k+'px'
   pictures[i].alt='ENV-'+['A','B'][i]+' · '+layout+' · '+light+' · '+pretty[mode]+' · '+scale+'×'
 })
 pick('pair-note').textContent=runs[1].changed.toLocaleString('vi-VN')+' pixel màu khác giữa A và B · '+runs[1].seams+' mẫu mối nối đạt'
}
for(const input of fields)input.addEventListener('change',show)
show()
pick('rubric').addEventListener('submit',event=>{
 event.preventDefault()
 const data={layout:pick('layout').value,lighting:pick('light').value,...Object.fromEntries(new FormData(event.currentTarget))}
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))
 const a=document.createElement('a')
 a.href=url
 a.download='e61-human-environment-review.json'
 a.click()
 setTimeout(()=>URL.revokeObjectURL(url),3000)
})
`;
const html=`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · RPG Field Outpost</title><style>${settings}</style></head>
<body><header><div class="wrap">
<p class="eyebrow">LumaSprite Engine · E6.1</p><h1>RPG Field Outpost</h1>
<p class="lede">Hai cách tô vật liệu cho cùng công trình, ở đúng tỷ lệ game. So ở 1× trong cảnh sáng và tối trước khi mở atlas, mask hoặc các chỉ số.</p>
<p class="status">E6_1_READY_FOR_HUMAN_ENVIRONMENT_REVIEW</p>
</div></header>
<nav aria-label="Báo cáo"><div class="wrap"><a href="#scene">So sánh</a><a href="#review">Phiếu chấm</a><a href="#qa">Kỹ thuật</a><a href="#exports">Gói xuất</a></div></nav>
<main class="wrap">
<section id="scene"><h2>Functional và Art-Directed</h2>
<p>Hai bản dùng chung hướng nhìn, bố cục, các mảnh ghép, props, collision và điểm đứng. ENV-A giữ mặt phẳng gọn. ENV-B thêm lớp ngói, mạch đá, vệt lát nhỏ và bóng tiếp xúc có hướng. Bối cảnh tối dùng ramp riêng trong cùng profile.</p>
<div class="viewer"><div class="controls">
<label>Bố cục <select id="layout">${Object.entries(titles).map(([id,title])=>'<option value="'+id+'">'+title+'</option>').join('')}</select></label>
<label>Ánh sáng <select id="light"><option value="day">Sáng</option><option value="night">Tối</option></select></label>
<label>Hiển thị <select id="mode">${Object.entries(display).map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join('')}</select></label>
<label>Tỷ lệ <select id="zoom"><option value="1">1× native</option><option value="4">4× nearest-neighbor</option></select></label>
</div><div class="dual" id="comparison">${figure('a','Functional Outpost')}${figure('b','Art-Directed Outpost')}</div>
<p id="pair-note">So sánh trên cùng bố cục và ánh sáng</p></div>
<details><summary>Chú giải lớp và vật liệu</summary><h3>Layer nhìn thấy sau khi vẽ</h3>${legend(day.atlas.layerLegend)}
<h3>Vùng vật liệu</h3>${legend(day.atlas.materialLegend)}<p>Collision dùng đỏ cho tường và mặt bằng công trình, cam cho prop và xanh cho đường giữa cửa. Các phần trong atlas có pivot và kích thước gốc trong kit.json.</p></details>
</section>
<section id="review"><h2>Phiếu duyệt độc lập</h2>
<p>Xem cả hai bố cục ở 1×. Chấm 1 = cần sửa, 3 = dùng được, 5 = rõ và nhất quán. Mục tiêu đề xuất là 4/5 cho nhóm tiêu chí chính. Ghi rõ cảnh và mức zoom khi có lỗi.</p>
<form id="rubric" class="score">${sheet(['Tiêu chí','ENV-A','ENV-B'],score)}
<label>Quyết định<select name="decision"><option value="">Đang chờ</option><option>ENV-A</option><option>ENV-B</option><option>Cần sửa</option></select></label>
<label>Nhận xét<textarea name="notes" rows="3"></textarea></label><button type="submit">Tải phiếu JSON</button>
</form></section>
<section id="qa"><h2>Vật liệu, kết nối và che khuất</h2>
<p>Mặt quay lên và sang trái nhận tone sáng hơn. Mái và mặt đá dùng mảng lớn. Chân cột, bậc và bàn dùng mảng nhỏ hơn. Bóng dưới công trình và đồ vật có biên cứng. Ảnh nhân vật và prop lấy đúng palette đã khóa. Hai nhân vật vẫn giữ khung 64×64 ở kích thước gốc.</p>
${sheet(['Bố cục','Ánh sáng','Mẫu mối nối','Pixel đổi A/B','Pixel nhân vật thấy/gốc','P10 Δ luma biên nhân vật'],mainRows)}
<p>Ở Roadside, tường phía đông che một phần Courier từ pose sau nhà. Metadata ghi ID lớp che, số pixel còn thấy và pivot đặt chân. Cửa có hai jamb chắn và đường vào giữa thông. Số đo luma biên là chẩn đoán đọc hình ở 1×.</p>
${sheet(['Vật liệu','Ramp sáng','Ramp tối'],day.palette.ramps.map((x,i)=>[x.material,swatchRow(x.ramp),swatchRow(night.palette.ramps[i].ramp)]))}
<details><summary>Chênh luma và cảnh báo cặp ramp</summary>${sheet(['Ánh sáng','Cặp vật liệu','Chênh luma trung độ','Màu trùng'],[['Sáng',day],['Tối',night]].flatMap(([light,qa])=>
  (qa as QA).palette.warnings.map(x=>[String(light),x.materials.join(' / '),x.midtoneGap,x.equalInks.join(', ')||'0'])))}
<p>Ngưỡng cảnh báo là 10 trên thang 0–255. Những cặp gần độ sáng vẫn cần chủ động xem cạnh nhau trong ngữ cảnh. Các màu chính xác được kiểm tra theo palette chung của mỗi điều kiện sáng.</p></details>
</section>
<section id="exports"><h2>Gói xuất và hồi quy</h2>
<p>Đã xác minh ${benchmark.packages.length} gói và ${benchmark.fileCount} SHA-256. Mỗi gói có scene PNG 1×/4×, atlas, mask, overlay, EnvironmentSpec, Style Profile và manifest. Studio đã qua kiểm tra PNG raster cho scene và atlas. Dữ liệu cấu trúc scene được giữ trong sidecar.</p>
<p class="downloads">${Object.values(candidates).map(x=>ref(x.layout+' '+x.finish.toUpperCase()+' '+x.light,x.relative+'/manifest.json')).join('')}</p>
<p>${ref('Benchmark SHA-256','benchmark.json')} · <a href="e61-environment-foundation.md">Audit, PR draft và kế hoạch E6.2</a> · <a href="e5-final-acceptance.md">E5 Final Acceptance</a></p>
</section>
</main><script type="application/json" id="visual-data">${JSON.stringify(data)}</script><script>${script}</script></body></html>`;
writeFileSync('docs/LumaSprite-Engine-E6.1-Report.html',html);
