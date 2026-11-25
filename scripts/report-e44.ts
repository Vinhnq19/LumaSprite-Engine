import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = 'benchmarks/results/e44';
const read = (path: string) => readFileSync(join(root, path));
const surveyors = [
  { id: 'b1', label: 'B1 · M2P gốc', folder: '../e43/packages/m2p' },
  { id: 'r1', label: 'R1 · Tay cầm đèn', folder: 'packages/r1' },
  { id: 'r2', label: 'R2 · Tay, hướng nhìn và chân', folder: 'packages/r2' },
] as const;
const couriers = [
  { id: 'courier', label: 'Courier · E4.3', folder: '../e43/packages/courier' },
  { id: 'courier-rev', label: 'Courier · E4.4', folder: 'packages/courier-rev' },
] as const;
const candidates = [...surveyors, ...couriers];

function figure(path: string, label: string, context = false) {
  const png = read(path);
  const frame = context ? 'frame context' : 'frame';
  return '<figure><figcaption>' + label + '</figcaption><div class="' + frame + '" tabindex="0" aria-label="' + label + '">' +
    '<img width="' + png.readUInt32BE(16) + '" height="' + png.readUInt32BE(20) + '" alt="' + label + '" src="data:image/png;base64,' +
    png.toString('base64') + '"></div></figure>';
}

function card(title: string, figures: string[], className = '') {
  return '<article><h3>' + title + '</h3><div class="gallery ' + className + '" style="--columns:' + figures.length + '">' +
    figures.join('') + '</div></article>';
}

function detail(title: string, content: string) {
  return '<details><summary>' + title + '</summary>' + content + '</details>';
}

function download(path: string, label: string, mime = 'application/json') {
  const name = path.split('/').slice(-2).join('-');
  return '<a class="download" download="' + name + '" href="data:' + mime + ';base64,' + read(path).toString('base64') + '">' + label + '</a>';
}

const scenes = [
  ['outdoor', 'Outdoor RPG'],
  ['dungeon', 'Dark Dungeon'],
  ['gameplay', 'Lối đi giữa các props'],
] as const;
const inGame = scenes.map(([id, name]) => card(name, surveyors.map(c => figure(id + '-' + c.id + '-1x.png', c.label, true)), 'full-scene')).join('\n');
const native = card('Màu vật liệu', surveyors.map(c => figure(c.folder + '/final.png', c.label))) +
  card('Silhouette', surveyors.map(c => figure(c.folder + '/silhouette.png', c.label)));

const closeups = [
  ['arm', 'Vai và cẳng tay'], ['head', 'Mặt và vành mũ'],
  ['grip', 'Bàn tay, quai và đèn'], ['stance', 'Gối và đế giày'],
] as const;
const surveyorDetails = detail('Ảnh vật liệu toàn thân ở 4×', card('Khung 64 × 64 phóng 4×', surveyors.map(c => figure(c.id + '-4x.png', c.label)))) +
  detail('Landmark và pivot ở 4×', '<p>Xanh ngọc chỉ các khớp gần, tím chỉ các khớp xa, vàng chỉ grip và pivot.</p>' +
    card('Landmark trên màu phẳng', surveyors.map(c => figure(c.id + '-landmarks-4x.png', c.label)))) +
  closeups.map(([id, label]) => detail(label + ' · 4×', card(label, surveyors.map(c => figure(c.id + '-' + id + '-4x.png', c.label))))).join('\n');

const courierGallery = card('Màu vật liệu 1×', couriers.map(c => figure(c.folder + '/final.png', c.label))) +
  card('Silhouette 1×', couriers.map(c => figure(c.folder + '/silhouette.png', c.label))) +
  card('Màu phẳng 1×', couriers.map(c => figure(c.id + '-flat-1x.png', c.label))) +
  detail('Vật liệu và landmark ở 4×', card('Màu vật liệu', couriers.map(c => figure(c.id + '-4x.png', c.label))) +
    card('Landmark', couriers.map(c => figure(c.id + '-landmarks-4x.png', c.label))));

type Proof = { id: string; characterSpecVersion: number; masks: number; pivot: [number, number]; saveReopen: string; restore: string; staleRevision: string };
const parity = JSON.parse(read('studio/parity.json').toString('utf8')) as { studioRevision: string; results: Proof[] };
const studioRows = parity.results.map(r =>
  '<tr><th scope="row">' + (r.id === 'm2p' ? 'b1' : r.id) + '</th><td>' + r.characterSpecVersion + '</td><td>' + r.masks +
  '</td><td>' + r.pivot.join(', ') + '</td><td>' + r.saveReopen + '</td><td>' + r.restore + '</td><td>' + r.staleRevision + '</td></tr>').join('');

type Diagnostic = {
  id: string; partMasks: number;
  geometry: { bounds: { area: number }; legGapRows: number; gripPixels: number; pose: { headroom: number; shoulderDrop: number; armTorsoGapRows: number; openHandleRows: number } };
};
const qa = JSON.parse(read('qa.json').toString('utf8')) as Diagnostic[];
const qaRows = qa.map(({ id, partMasks, geometry: g }) =>
  '<tr><th scope="row">' + id + '</th><td>' + g.bounds.area + '</td><td>' + partMasks + '</td><td>' + g.pose.headroom + '</td><td>' +
  g.pose.shoulderDrop + '</td><td>' + g.legGapRows + '</td><td>' + (g.gripPixels || '—') + '</td><td>' + (g.pose.openHandleRows || '—') +
  '</td><td>' + (g.pose.armTorsoGapRows || '—') + '</td></tr>').join('');

const rubric = ['Silhouette', 'Tỷ lệ cơ thể', 'Hướng 3/4', 'Phân bố trọng lượng', 'Giải phẫu tay và chân',
  'Điểm nắm và tương tác đạo cụ', 'Độ rõ vật liệu', 'Cụm pixel', 'Đường viền', 'Sẵn sàng dùng trong game'];
const reviewRows = rubric.map((label, index) => '<tr><th scope="row">' + label + '</th>' + candidates.map(c =>
  '<td>' + (index === 5 && (c.id === 'courier' || c.id === 'courier-rev') ? '—' :
    '<input type="number" min="1" max="5" step="1" aria-label="' + c.label + ' · ' + label + '">') + '</td>').join('') + '</tr>').join('');

const downloads = candidates.map(c => download(c.folder + '/manifest.json', c.label + ' · manifest')).join('') +
  download('qa.json', 'Geometry và vật liệu') + download('revision-comparison.json', 'So sánh mask và landmark') + download('studio/parity.json', 'Kết quả Studio');

const html = `
<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · E4.4 Character Art Review</title>
<style>
:root{color-scheme:light;--paper:#f4efe3;--panel:#fffaf1;--ink:#222e27;--forest:#233d34;--muted:#485a4d;--line:#c6cdbb;--accent:#2e5842}
*{box-sizing:border-box}body{margin:0;color:var(--ink);background:var(--paper);font:1rem/1.6 system-ui,sans-serif}
.shell{width:min(calc(100% - 2rem),1450px);margin-inline:auto}.masthead{color:#fff8e8;background:var(--forest);padding:clamp(2.4rem,7vw,5.3rem) 0 2.65rem;border-bottom:5px solid #be985f}
.project{font-weight:720;margin-bottom:.75rem}.masthead p{color:#e1e9df}h1,h2{margin:0 0 .7rem;font:500 clamp(1.85rem,4vw,3.1rem)/1.08 Georgia,serif;letter-spacing:-.025em}
h1{font-size:clamp(2.5rem,7vw,5.15rem);max-width:23ch}h3{margin:0 0 .4rem;font-size:1.02rem;line-height:1.25}p{max-width:77ch;margin:.45rem 0 .85rem}
a{color:var(--accent);text-underline-offset:.2em}nav{display:flex;flex-wrap:wrap;gap:.12rem 1.25rem;padding:.45rem 0;border-bottom:1px solid var(--line)}
nav a,summary,.download{min-height:44px;display:inline-flex;align-items:center;font-weight:660}
section{margin:clamp(2.4rem,6vw,4.7rem) 0}article{padding:.82rem;background:var(--panel);border:1px solid var(--line);border-radius:.5rem;margin:.85rem 0}
.gallery{display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));gap:.85rem;align-items:start}figure{margin:0;min-width:0}figcaption{font-size:.91rem;color:var(--muted);font-weight:630;padding:.35rem 0}
.frame{overflow:auto;border:1px solid var(--line);border-radius:.24rem;padding:9px;background:repeating-conic-gradient(#e1e6d8 0 25%,#f2eee3 0 50%) 0 0/16px 16px;min-width:0}
.frame.context{padding:0;background:#657e51}img{max-width:none;display:block;margin-inline:auto;image-rendering:pixelated}
details{border-top:1px solid var(--line);margin-top:.65rem}summary{display:list-item;padding:.6rem .2rem;cursor:pointer;color:var(--accent)}
.scroll{overflow:auto;border:1px solid var(--line);margin:.8rem 0}table{width:100%;border-collapse:collapse;text-align:left;background:var(--panel);white-space:nowrap}
th,td{padding:.54rem .67rem;border-bottom:1px solid var(--line)}thead,footer{background:#e6ebdc}
input{width:3.2rem;min-height:44px;border:1px solid #74816f;border-radius:.2rem;padding:.2rem;font:inherit}
.downloads{display:flex;gap:.55rem;flex-wrap:wrap}.download{padding:.45rem .7rem;border:1px solid var(--line);border-radius:.28rem;background:var(--panel)}
:focus-visible{outline:3px solid #76551b;outline-offset:3px}footer{padding:1.1rem 0;color:var(--muted)}
@media(max-width:900px){.full-scene{grid-template-columns:minmax(0,1fr)}}
@media(max-width:560px){details .gallery{grid-template-columns:minmax(0,1fr)}article{padding:.52rem}.gallery{gap:.35rem}figcaption{font-size:.82rem}.frame{padding:2px}}
@media print{nav,.downloads{display:none}.frame{overflow:visible}img{max-width:100%;height:auto}}
</style></head><body>
<header class="masthead"><div class="shell"><div class="project">LumaSprite Engine · E4.4</div>
<h1>Dáng nhân vật ở 1×</h1><p>Field Surveyor dùng vật liệu M2P trên ba geometry. Forest Courier so bản gốc với một revision có mũ mở hơn, hai tay rõ hơn và nắp túi có mặt riêng. Quyết định mỹ thuật đang chờ Project Owner.</p></div></header>
<nav class="shell" aria-label="Mục lục"><a href="#native">Surveyor</a><a href="#scenes">Cảnh game</a><a href="#details">Cận cảnh</a><a href="#courier">Courier</a><a href="#verification">Kiểm định</a><a href="#review">Phiếu chấm</a></nav>
<main class="shell">
<section id="native"><h2>Surveyor ở kích thước gốc</h2><p>R1 hạ khuỷu hai pixel. R2 bắt đầu từ R1, rút vành mũ, mở mặt, tăng độ lệch vai và đưa gối gần trục hông–cổ chân hơn. Cả ba giữ điểm nắm (49,33) và pivot (30,59).</p>${native}</section>
<section id="scenes"><h2>Cùng bố cục ở 1×</h2><p>Camera, nền, props và pivot trong từng cảnh dùng chung. Có thể cuộn trong khung ảnh để xem đủ cảnh trên màn hình hẹp.</p>${inGame}
${card('Neutral lineup · B1, R1, R2 từ trái sang phải', [figure('lineup-1x.png', 'Surveyor · 1×', true)])}
${card('Courier và Surveyor trong cùng cảnh', [
  figure('outdoor-pair-original-1x.png', 'Courier gốc và B1 M2P', true),
  figure('outdoor-pair-revisions-1x.png', 'Courier revision và Surveyor R2', true),
], 'full-scene')}</section>
<section id="details"><h2>Khớp và silhouette ở 4×</h2><p>R1 làm cẳng tay bớt ngang. R2 cho thấy thêm mặt dưới vành mũ. Xem lại góc 3/4 ở 1× trước khi duyệt.</p>${surveyorDetails}</section>
<section id="courier"><h2>Forest Courier ở 1×</h2><p>Revision mở mũ trùm, đưa bàn tay xa ra khỏi thân và đặt túi thấp hơn. Nếp nắp dùng màu tối trong ramp da hiện có. Hai đế tiếp đất và pivot vẫn cùng vị trí.</p>${courierGallery}</section>
<section id="verification"><h2>Gói xuất và kiểm định</h2>
<div class="scroll" tabindex="0" aria-label="Thông số hình học"><table><thead><tr><th>Mẫu</th><th>Pixel alpha</th><th>Part mask</th><th>Headroom</th><th>Lệch vai</th><th>Hàng hở chân</th><th>Pixel tiếp xúc</th><th>Hàng hở quai</th><th>Hàng hở tay-thân</th></tr></thead><tbody>${qaRows}</tbody></table></div>
<p>Studio ${parity.studioRevision} đã mở lại và phục hồi cả năm gói. Kiểm tra gồm RGBA, pivot, part mask, landmark, provenance và từ chối lưu bằng revision cũ.</p>
<div class="scroll" tabindex="0" aria-label="Kết quả Studio"><table><thead><tr><th>Mẫu</th><th>Spec</th><th>Mask</th><th>Pivot</th><th>Lưu và mở lại</th><th>Backup restore</th><th>Revision cũ</th></tr></thead><tbody>${studioRows}</tbody></table></div>
<div class="downloads">${downloads}</div></section>
<section id="review"><h2>Phiếu chấm mỹ thuật</h2><p>Chấm 1–5 sau khi xem bốn cảnh. Mục tiêu từ 4/5 cho silhouette, hướng 3/4, giải phẫu, tương tác đạo cụ, vật liệu và khả năng dùng trong game. Courier để trống tiêu chí cầm đạo cụ. Điểm trên trang dùng trong phiên mở báo cáo.</p>
<div class="scroll" tabindex="0" aria-label="Phiếu chấm cho năm mẫu"><table><thead><tr><th>Tiêu chí</th>${candidates.map(c => '<th scope="col">' + c.label + '</th>').join('')}</tr></thead><tbody>${reviewRows}</tbody></table></div></section>
</main><footer><div class="shell">LumaSprite Engine · E4.4 · Dữ liệu nhúng sẵn trong HTML</div></footer></body></html>
`;
writeFileSync('docs/LumaSprite-Engine-E4.4-Report.html', html);
