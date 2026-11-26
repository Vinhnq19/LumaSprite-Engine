import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { sha256 } from '../src/quality/raster.ts';

const base = 'benchmarks/results/e71/';
async function json(path:string) { return JSON.parse(await readFile(path,'utf8')); }
const index = await json(base+'benchmark.json');
const contract = await json('benchmarks/fixtures/e71/quality-contract-v1.json');
const holdout = await json('benchmarks/fixtures/e71/holdout-lock.json');
const relay = await json(base+'relay/compare.json');
const corpus = await json(base+'corpus.json');
const data = new Map<string,Buffer>();
for (const [name,digest] of Object.entries(index.sha256)) {
  const bytes = await readFile(base+name);
  assert.equal(sha256(bytes),digest,name);
  data.set(name,bytes);
}
assert.equal(data.size,index.fileCount);
const png = (bytes:Buffer) => 'data:image/png;base64,'+bytes.toString('base64');
const images = Object.fromEntries([...data].filter(([name]) => name.endsWith('.png') && !name.endsWith('-4x.png'))
  .map(([name,bytes]) => [name.slice(0,-4),png(bytes)]));
const diagnostics = Object.fromEntries([...data].filter(([name]) => name.startsWith('ruin/') && name.endsWith('/qa.json'))
  .map(([name,bytes]) => [name.slice(5,-8),JSON.parse(bytes.toString('utf8'))]));
const barrel = png(await readFile('benchmarks/results/e24/barrel-tall-1x.png'));
const css = await readFile('research/open-source/art-quality/report.css','utf8');
const e = (string:string) => string.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const options = (values:Record<string,string>) => Object.entries(values).map(([id,label]) =>
  '<option value="'+e(id)+'">'+e(label)+'</option>').join('');
const common = {native:'Tô vật liệu',flat:'Hình khối phẳng',silhouette:'Silhouette',material:'Material mask',contour:'Contour overlay'};
const select = (id:string,label:string,values:Record<string,string>) =>
  '<label>'+label+'<select id="'+id+'">'+options(values)+'</select></label>';
const zoom = {'1':'1× native','4':'4× nearest'};
const figure = (id:string,label:string,width:number,height:number,path:string) =>
  '<figure class="art"><figcaption>'+label+'</figcaption><div class="pixel-window" tabindex="0" aria-label="'+label+
  '"><img id="'+id+'" src="'+images[path]+'" width="'+width+'" height="'+height+'" alt="'+label+'"></div></figure>';
const familyCounts = new Map<string,number>();
for (const row of corpus.historical) familyCounts.set(row.family,(familyCounts.get(row.family)??0)+1);
const ratings = '<option value="">—</option>'+options({'1':'1','2':'2','3':'3','4':'4','5':'5'});
function rubric(family:string,criteria:string[],panels:string[]) {
  return '<div class="scroll" tabindex="0" aria-label="'+e(family)+'"><table><thead><tr><th scope="col">Tiêu chí</th>'+
    panels.map(panel => '<th scope="col">'+e(panel)+'</th>').join('')+'</tr></thead><tbody>'+
    criteria.map(criterion => '<tr><th scope="row">'+e(criterion)+'</th>'+panels.map(panel => '<td><select data-family="'+e(family)+
      '" data-asset="'+e(panel)+'" data-criterion="'+e(criterion)+'" aria-label="'+e(panel+' '+criterion)+'">'+ratings+
      '</select></td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
const embed = (value:unknown) => JSON.stringify(value).replaceAll('<','\\u003c');
const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · E7.1 Structure & Silhouette</title>
<style>${css}
.compare { grid-template-columns: repeat(auto-fit,minmax(min(100%,345px),1fr)); }
.compare .art { display: block; justify-items: stretch; }
.pixel-window { display: block; width: calc(100% - .9rem); overflow: auto; margin: .25rem .45rem; max-height: 72vh; border-radius: 4px; }
.pixel-window:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
.pixel-window img { max-width: none; height: auto; }
.ref { display: flex; align-items: center; gap: .75rem; margin-top: 1.1rem; }
.ref img { image-rendering: pixelated; }
@media (max-width: 570px) {
  html { scroll-padding-top: 7rem; }
  .viewer { padding: .6rem; }
  .pixel-window { width: calc(100% - .5rem); margin-inline: .25rem; }
}
</style></head>
<body><header><div class="wrap">
<h1>E7.1 Structure &amp; Silhouette</h1>
<p class="status">E7_1_READY_FOR_HUMAN_STRUCTURE_REVIEW</p>
<p class="lede">Đối chiếu Relay Box, R1 Signal Ruins Entrance và holdout H1 đã khóa. Xem ở 1× trước khi soi cụm pixel ở 4×.</p>
</div></header>
<nav aria-label="Các mục"><div class="wrap">
<a href="#relay">Relay Box</a><a href="#ruin">Ruin Structure</a><a href="#review">Phiếu duyệt</a><a href="#qa">QA và corpus</a>
</div></nav>
<main class="wrap">
<section id="relay"><h2>Field Signal Relay Box</h2>
<p>Cùng khung 32×32, seed 127, góc chiếu, vật liệu và điểm đặt trên nền C1. A0 dùng một thể tích hộp. A1 thêm vai lùi và hai chân đỡ.</p>
<div class="viewer"><div class="controls">${select('relay-view','Lớp ảnh',{...common,context:'Trong cảnh C1'})}${select('relay-zoom','Tỷ lệ',zoom)}</div>
<div class="compare">${figure('relay-a0','A0 · Hộp đơn',32,32,'relay/a0/native')}${figure('relay-a1','A1 · Vai lùi và chân đỡ',32,32,'relay/a1/native')}</div></div>
<p class="ref"><img src="${barrel}" width="32" height="32" alt="E2.4 Tall Barrel"> E2.4 Tall Barrel. Mẫu tham khảo về nhận diện vật liệu ở 32×32.</p>
<details><summary>Diagnostics hình khối và cụm pixel</summary><pre id="relay-stat"></pre>
<a href="../benchmarks/results/e71/relay/compare.json">Coverage, biên vật liệu và SHA-256 Relay Box</a></details>
</section>
<section id="ruin"><h2>Ruin Structure</h2>
<p>So hai vách gãy trong cùng bố cục. Ứng viên thay nhịp đỉnh và mặt đá lộ, giữ footprint, collision và thứ tự che khuất. Chế độ hình khối hiển thị vách bằng màu phẳng trong cảnh.</p>
<div class="viewer"><div class="controls">
${select('ruin-scene','Bố cục',{r1:'R1 Signal Ruins Entrance',h1:'H1 Abandoned Switchback Depot'})}
${select('ruin-light','Ánh sáng',{day:'Ngày',night:'Đêm'})}${select('ruin-view','Lớp ảnh',{...common,collision:'Collision overlay'})}${select('ruin-zoom','Tỷ lệ',zoom)}
</div>
<div class="compare">${figure('ruin-current','Control · Production',320,208,'ruin/r1/day/current/native')}${figure('ruin-candidate','Candidate · Structure Q',320,208,'ruin/r1/day/candidate/native')}</div>
<p id="ruin-status" class="quiet" aria-live="polite"></p></div>
<details><summary>Diagnostics theo cảnh</summary><pre id="ruin-stat"></pre>
<a id="ruin-qa" href="../benchmarks/results/e71/ruin/r1/day/qa.json">QA chi tiết của cặp đang xem</a></details>
<p><strong>H1.</strong> ${e(holdout.brief)} Seed ${holdout.seed}. <a href="../benchmarks/fixtures/e71/holdout-lock.json">Brief, spec và SHA-256 khóa trước thử nghiệm</a>.</p>
</section>
<section id="review"><h2>Phiếu duyệt nghệ thuật</h2>
<p>Chấm từng tiêu chí từ 1 đến 5. Mục tiêu cho tiêu chí cốt lõi là 4/5. Ghi lỗi chặn riêng và đánh giá H1 độc lập. Các ô trống giữ trạng thái chờ.</p>
<form id="review-form" class="score"><h3>Relay Box</h3>
${rubric('Prop',contract.assetRubrics.prop,['A0','A1'])}
<h3>Kiến trúc</h3>
<p class="quiet">Ở mục chiều sâu, xem phối cảnh và che khuất. Ở mục gameplay, xem khả năng tìm lối, cổng và điểm tín hiệu.</p>
${rubric('Environment',contract.assetRubrics.environment,['R1 Control','R1 Q','H1 Control','H1 Q'])}
<label>Nhận xét và lỗi chặn<textarea id="review-notes" rows="4"></textarea></label>
<button class="primary" type="submit">Tải phiếu duyệt JSON</button>
</form></section>
<section id="qa"><h2>QA và corpus</h2>
<div class="cards">
<div class="card"><h3>A · Historical</h3><p>${index.historical} mẫu đã khóa. ${[...familyCounts].map(([family,count])=>e(family)+' '+count).join(' · ')}.</p></div>
<div class="card"><h3>B · Development</h3><p>Relay Box và R1 dùng để dựng và đối chiếu ứng viên.</p></div>
<div class="card"><h3>C · Holdout</h3><p>H1 dùng cùng thuật toán, ở cả ánh sáng ngày và đêm.</p></div>
</div>
<p>${index.fileCount} payload được đối chiếu theo SHA-256. Studio giữ nguyên RGBA khi mở lại sáu PNG thử nghiệm.</p>
<div class="downloads">
<a href="e71-structure-quality.md">Báo cáo E7.1 và cách tái tạo</a>
<a href="e64-artistic-acceptance.md">E6.4 acceptance</a>
<a href="art-quality/e7-root-cause.md">Root-cause audit</a>
<a href="art-quality/quality-contract-v1.md">Quality Contract v1</a>
<a href="../benchmarks/results/e71/corpus.json">Corpus JSON</a>
<a href="../benchmarks/results/e71/SHA256SUMS">SHA-256 manifest</a>
<a href="../benchmarks/results/e71/studio-parity.json">Studio parity</a>
</div></section>
</main><footer><div class="wrap">LumaSprite Engine · E7.1</div></footer>
<script>
'use strict';
const images = ${embed(images)};
const relay = ${embed(relay)};
const ruins = ${embed(diagnostics)};
const get = id => document.getElementById(id);
const value = id => get(id).value;
function showImage(id,path,width,height,scale) {
  const img = get(id);
  img.width = width * scale;
  img.height = height * scale;
  img.src = images[path];
}
function updateRelay() {
  const mode = value('relay-view');
  const [width,height] = mode === 'context' ? [320,208] : [32,32];
  for (const variant of ['a0','a1']) showImage('relay-'+variant,'relay/'+variant+'/'+mode,width,height,Number(value('relay-zoom')));
}
function describe(stat) {
  return stat.coverage+' px · viền '+stat.outline+' px · cụm '+stat.components.join(', ')+' · viền cô lập '+stat.isolatedOutline;
}
function updateRuin() {
  const scene = value('ruin-scene');
  const light = value('ruin-light');
  const mode = value('ruin-view');
  const key = scene+'/'+light;
  for (const variant of ['current','candidate']) showImage('ruin-'+variant,'ruin/'+key+'/'+variant+'/'+mode,320,208,Number(value('ruin-zoom')));
  const info = ruins[key];
  get('ruin-status').textContent = (info.holdout ? 'Holdout H1' : 'Mẫu R1')+' · seed '+info.seed+' · silhouette kiến trúc +'+info.coverage.added+' / −'+info.coverage.removed+' px.';
  get('ruin-qa').href = '../benchmarks/results/e71/ruin/'+key+'/qa.json';
  get('ruin-stat').textContent = [
    'Control · '+describe(info.baseline), 'Candidate · '+describe(info.candidate),
    ...info.walls.map(wall => wall.id+' · cụm biên cùng vai trò vật liệu mỗi 100 cặp '+wall.detail.baseline.per100+' → '+wall.detail.candidate.per100),
    ...info.routes.map(route => route.id+' · '+route.tested+' pixel kiểm trên lối đi'),
    ...info.actors.map(actor => actor.id+' · '+actor.before+' / '+actor.after+' pixel thấy được'),
    info.collision
  ].join('\\n');
}
get('relay-stat').textContent = ['A0 · '+describe(relay.a0),'A1 · '+describe(relay.a1),
  'Biên cùng vai trò vật liệu mỗi 100 cặp · '+relay.a0.detail.per100+' → '+relay.a1.detail.per100,
  'A1 so với A0 · +'+relay.coverage.added+' / −'+relay.coverage.removed+' px'].join('\\n');
for (const id of ['relay-view','relay-zoom']) get(id).addEventListener('change',updateRelay);
for (const id of ['ruin-scene','ruin-light','ruin-view','ruin-zoom']) get(id).addEventListener('change',updateRuin);
get('review-form').addEventListener('submit', event => {
  event.preventDefault();
  const ratings = [...event.currentTarget.querySelectorAll('[data-criterion]')].map(field => ({
    ...field.dataset, value:field.value ? Number(field.value) : null
  }));
  const record = {version:1,checkpoint:'77fbaa5',review:'HUMAN_REVIEW',ratings,notes:value('review-notes')};
  const url = URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lumasprite-e71-art-review.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
});
updateRelay();
updateRuin();
</script></body></html>\n`;
await writeFile('docs/LumaSprite-Engine-E7.1-Report.html',html);
console.log('E7.1 offline review gallery ready.');
