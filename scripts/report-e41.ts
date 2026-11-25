import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { characterReview } from '../src/generators/character/export.ts';

const root = 'benchmarks/results/e41';
const read = (file: string) => readFileSync(join(root, file));
type Metadata = ReturnType<typeof characterReview>['metadata'];
const candidates = (['a', 'b'] as const).map(id => ({
  id, ...JSON.parse(read(id + '/geometry.json').toString('utf8')) as Metadata,
}));

function figure(path: string, label: string, scene = false) {
  const bytes = read(path);
  return '<figure><figcaption>' + label + '</figcaption><div class="frame' + (scene ? ' scene' : '') +
    '" tabindex="0" aria-label="' + label + '"><img width="' + bytes.readUInt32BE(16) + '" height="' + bytes.readUInt32BE(20) +
    '" alt="' + label + '" src="data:image/png;base64,' + bytes.toString('base64') + '"></div></figure>';
}

function download(path: string, name: string, label: string) {
  const mime = name.endsWith('.png') ? 'image/png' : 'application/json';
  return '<a class="download" download="' + name + '" href="data:' + mime + ';base64,' + read(path).toString('base64') + '">' + label + '</a>';
}

const portraits = candidates.map(({ id, spec, diagnostics }) => {
  const bigger = id === 'b';
  return '<article><header class="card-head"><h3>' + id.toUpperCase() + ' · ' + spec.name +
    '</h3><p>' + (bigger ? 'Thân áo dài, tay nâng đèn và chân phụ đặt cao hơn.' : 'Thân gọn, tay đưa đèn gần thân và thế chân thấp hơn.') +
    '</p></header><div class="pair">' + figure(id + '/silhouette.png', 'Silhouette ' + id.toUpperCase() + ' · 1×') +
    figure(id + '/flat.png', 'Mảng màu phẳng ' + id.toUpperCase() + ' · 1×') + '</div>' +
    '<p class="measure">' + (diagnostics.bounds.bottom - diagnostics.bounds.top + 1) + ' px chiều cao silhouette · pivot ' +
    spec.pose.pivot.join(', ') + '</p>' +
    '<details><summary>Xem silhouette và landmarks ở 4×</summary><div class="pair detail">' +
    figure(id + '-silhouette-4x.png', 'Silhouette ' + id.toUpperCase() + ' · 4×') +
    figure(id + '-landmarks-4x.png', 'Khớp và điểm neo ' + id.toUpperCase() + ' · 4×') +
    '</div></details></article>';
}).join('');

const closeups = candidates.map(({ id }) => '<article><h3>Candidate ' + id.toUpperCase() +
  '</h3><div class="pair">' + figure(id + '-grip-6x.png', 'Tay, quai và thân đèn · 6×') +
  figure(id + '-stance-6x.png', 'Chân trụ và chân phụ · 6×') + '</div></article>').join('');

const data = candidates.map(({ id, diagnostics: d, bodyPlan: p }) =>
  '<tr><th scope="row">' + id.toUpperCase() + '</th><td>' + p.parts.length + '</td><td>' +
  Object.keys(d.joints).length + '</td><td>' + d.gripPixels + '</td><td>' + d.lampGapRows + '</td><td>' +
  d.legGapRows + '</td><td>' + d.maxGap + ' px</td><td>' + d.centerX.toFixed(1).replace('.', ',') + '</td></tr>').join('');

const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LumaSprite Engine · E4.1 Field Surveyor</title>
<style>
  :root { color-scheme:light; --paper:#f6f2e8; --panel:#fffdf7; --ink:#252d2a; --muted:#47534c; --line:#cbd1c4; --forest:#203a35; --accent:#2c604e; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:1rem/1.55 system-ui,sans-serif; }
  .shell { width:min(calc(100% - 2rem),1250px); margin-inline:auto; }
  .masthead { background:var(--forest); color:#fcf8ed; border-bottom:5px solid #c09960; padding:clamp(2rem,6vw,4.7rem) 0 2.4rem; }
  .masthead p { color:#e1e9df; margin:.75rem 0 0; }
  .project { font-weight:700; margin-bottom:.8rem; }
  h1,h2 { margin:0 0 .8rem; font-family:Georgia,serif; font-weight:500; letter-spacing:-.025em; line-height:1.07; }
  h1 { font-size:clamp(3rem,8vw,5.8rem); }
  h2 { font-size:clamp(2rem,4vw,3.05rem); }
  h3 { margin:0 0 .35rem; line-height:1.25; }
  p { margin:.35rem 0 .9rem; max-width:76ch; }
  nav { display:flex; gap:.5rem 1.2rem; flex-wrap:wrap; padding:.9rem 0; border-bottom:1px solid var(--line); }
  a { color:var(--accent); font-weight:680; text-underline-offset:.22em; }
  section { margin:clamp(2.4rem,6vw,4.65rem) 0; }
  .pair { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.85rem; align-items:start; }
  article { min-width:0; background:var(--panel); border:1px solid var(--line); border-radius:.55rem; padding:1.1rem; }
  .card-head p,.measure,figcaption { color:var(--muted); }
  .measure { font-variant-numeric:tabular-nums; font-size:.9rem; margin:.7rem 0 .2rem; }
  figure { margin:0; min-width:0; }
  figcaption { font-weight:650; font-size:.88rem; padding:.32rem 0; }
  .frame { overflow:auto; padding:12px; border:1px solid var(--line); border-radius:.3rem; background:repeating-conic-gradient(#e4e6da 0 25%, #f2efe5 0 50%) 0 0 / 16px 16px; }
  .frame.scene { padding:0; background:#6d8754; }
  .detail .frame { background:#ced7c9; }
  img { display:block; margin-inline:auto; image-rendering:pixelated; max-width:none; }
  details { border-top:1px solid var(--line); margin-top:.65rem; }
  summary { cursor:pointer; padding:.6rem 0; font-weight:680; color:var(--accent); }
  .scroll { overflow:auto; border:1px solid var(--line); }
  table { width:100%; border-collapse:collapse; background:var(--panel); text-align:left; }
  th,td { white-space:nowrap; padding:.58rem .72rem; border-bottom:1px solid var(--line); }
  thead,footer { background:#e3eadc; }
  footer { padding:1.25rem 0; color:var(--muted); }
  .downloads { display:flex; gap:.5rem; margin:1.2rem 0; flex-wrap:wrap; }
  .download { display:inline-block; border:1px solid var(--line); background:var(--panel); padding:.42rem .7rem; border-radius:.3rem; }
  :focus-visible { outline:3px solid #665822; outline-offset:3px; }
  @media(max-width:880px) { .pair.gallery { grid-template-columns:minmax(0,1fr); } }
  @media(max-width:560px) { article { padding:.85rem; } .detail { grid-template-columns:minmax(0,1fr); } }
  @media print { nav,details,.downloads { display:none; } .frame { overflow:visible; } img { max-width:100%; height:auto; } }
</style>
</head>
<body>
<header class="masthead"><div class="shell"><div class="project">LumaSprite Engine · E4.1</div><h1>Field Surveyor</h1>
<p>Duyệt silhouette 64×64. Hai dáng đứng góc 3/4 dùng chung geometry, mỗi dáng có tỷ lệ, thế chân và vị trí tay cầm đèn riêng. Kỹ thuật đạt và đang chờ Project Owner chọn dáng.</p>
</div></header>
<nav class="shell" aria-label="Mục lục"><a href="#shapes">Silhouette</a><a href="#contact">Tay và chân trụ</a><a href="#scene">Cảnh game</a><a href="#quality">Kết quả kiểm định</a><a href="#review">Quyết định</a></nav>
<main class="shell">
<section id="shapes"><h2>So sánh dáng ở 1×</h2><p>Nền caro biểu thị vùng alpha trong suốt. Tại 4×, đường xanh là trục thân và khớp phía gần, tím là khớp phía xa, vàng là điểm cầm đèn và mốc đặt chân.</p>
<div class="pair gallery">${portraits}</div></section>
<section id="contact"><h2>Tay cầm đèn và chân trụ</h2><p>Hai phần cận cảnh dùng phóng nguyên lần. Quan sát phần quai nằm sau bàn tay, khoảng hở cạnh đèn và rãnh giữa hai chân.</p><div class="pair gallery">${closeups}</div></section>
<section id="scene"><h2>Organic RPG Clearing · 1×</h2><p>Hai dáng đứng cùng pivot trên terrain E3.4 Candidate B đã được duyệt cho baked raster. Giữ đồng nhất rương, crate và thùng gỗ E2 tại đúng vị trí. Cuộn trong khung ảnh để giữ kích thước pixel.</p>
<div class="pair gallery">${figure('a-scene-1x.png', 'A · Compact Explorer trên terrain E3.4', true)}${figure('b-scene-1x.png', 'B · Taller Surveyor trên terrain E3.4', true)}</div></section>
<section id="quality"><h2>Kiểm trên raster</h2><p>Mỗi silhouette là một vùng liền. Kiểm định đo điểm nối trên mask bộ phận, vị trí quai trong bàn tay, khoảng hở ở chân và hình chiếu thân nằm trong bàn chân trụ.</p>
<div class="scroll" tabindex="0" aria-label="Kết quả kiểm định geometry"><table><thead><tr><th>Dáng</th><th>Bộ phận</th><th>Khớp đã kiểm</th><th>Pixel tay chạm quai</th><th>Hàng hở cạnh đèn</th><th>Hàng hở chân</th><th>Khe lớn nhất</th><th>Trọng tâm thân x</th></tr></thead><tbody>${data}</tbody></table></div>
<p>Studio kiểm được hồ sơ nhân vật v1, mask, landmark, pivot và RGBA sau khi lưu và mở lại. Các hồ sơ kiểm thử giữ trạng thái chờ phê duyệt.</p>
<div class="downloads">
${download('a/geometry.json', 'a-geometry.json', 'Body plan A')}
${download('b/geometry.json', 'b-geometry.json', 'Body plan B')}
${download('a-spec.json', 'a-spec.json', 'CharacterSpec A')}
${download('b-spec.json', 'b-spec.json', 'CharacterSpec B')}
${download('qa.json', 'geometry-qa.json', 'Geometry QA')}
</div></section>
<section id="review"><h2>Quyết định của Project Owner</h2><p>Chọn A, B hoặc yêu cầu chỉnh dáng. Khi duyệt, xem tỷ lệ đầu–thân, khoảng hở tay và chân, trọng tâm, điểm cầm đèn và tỷ lệ so với rương ở 1×. Phần tô vật liệu bắt đầu ở lượt tiếp theo sau khi dáng được duyệt.</p></section>
</main>
<footer><div class="shell">LumaSprite Engine · Kiểm thử offline · 0 AI runtime calls</div></footer>
</body>
</html>
`;
writeFileSync('docs/LumaSprite-Engine-E4.1-Report.html', html);
