import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { characterMaterialReview } from '../src/generators/character/material-export.ts';

const root = 'benchmarks/results/e42';
const read = (file: string) => readFileSync(join(root, file));
type Review = ReturnType<typeof characterMaterialReview>['metadata'];
const qa = JSON.parse(read('qa.json').toString('utf8')) as Review[];
const labels = JSON.parse(read('material-mask-legend.json').toString('utf8')) as Record<string, string>;

function figure(path: string, caption: string, mode = '') {
  const png = read(path);
  return '<figure><figcaption>' + caption + '</figcaption><div class="frame ' + mode +
    '" tabindex="0" aria-label="' + caption + '"><img width="' + png.readUInt32BE(16) + '" height="' + png.readUInt32BE(20) +
    '" alt="' + caption + '" src="data:image/png;base64,' + png.toString('base64') + '"></div></figure>';
}

function compare(rows: readonly (readonly [path: string, label: string])[], mode = '', className = 'pair') {
  return '<div class="' + className + '">' + rows.map(([path, label]) => figure(path, label, mode)).join('') + '</div>';
}
const native = compare([
  ['../e41r/b1/flat.png', 'B1 · Màu phẳng'],
  ['m1/final.png', 'M1 · Controlled Materials'],
  ['m2/final.png', 'M2 · Art-Directed Materials'],
  ['../e41r/b2/flat.png', 'B2 · Tham chiếu bước'],
], '', 'quad');
const scenes = compare([
  ['../e41r/b1-scene-1x.png', 'B1 · Màu phẳng'],
  ['m1-scene-1x.png', 'M1 · Controlled'],
  ['m2-scene-1x.png', 'M2 · Art-Directed'],
  ['../e41r/b2-scene-1x.png', 'B2 · Tham chiếu bước'],
], 'scene', 'pair gallery');
const detail = [
  ['face', 'Mặt, tóc và mũ · 6×'], ['shoulder', 'Vai, tay áo và túi · 6×'],
  ['grip', 'Tay và đèn · 6×'], ['boots', 'Giày và đế · 6×'],
].map(([id, label]) => '<details><summary>' + label + '</summary>' +
  compare([['m1-' + id + '-6x.png', 'M1'], ['m2-' + id + '-6x.png', 'M2']]) + '</details>').join('');
const paletteRows = qa.map(r => '<tr><th scope="row">' + r.style.toUpperCase() + '</th><td>' + r.palette.mode + '</td><td>' +
  r.palette.status + '</td><td>' + r.usedColors.length + '</td><td>' + r.palette.warnings.length + '</td></tr>').join('');
const legend = '<ul class="legend">' + Object.entries(labels).map(([name, hex]) =>
  '<li><span style="--ink:' + hex + '"></span>' + name + '</li>').join('') + '</ul>';
const downloads = [
  ['b1-shape-lock.json', 'Khóa silhouette'], ['qa.json', 'QA JSON'], ['material-mask-legend.json', 'Chú giải mask'],
  ['m1/material.json', 'M1 thông số'], ['m2/material.json', 'M2 thông số'], ['m1/final.png', 'M1 PNG'], ['m2/final.png', 'M2 PNG'],
].map(([path, label]) => {
  const mime = path.endsWith('.png') ? 'image/png' : 'application/json';
  return '<a class="download" download="' + path.replace('/', '-') + '" href="data:' + mime + ';base64,' + read(path).toString('base64') +
    '">' + label + '</a>';
}).join('');
const rubric = [
  'Độ rõ silhouette', 'Phân biệt vật liệu', 'Tỷ lệ nhân vật', 'Hướng nhìn 3/4', 'Ánh sáng nhất quán',
  'Cụm pixel', 'Chất lượng outline', 'Độ rõ quần áo', 'Độ rõ của đèn', 'Mức sẵn sàng đưa vào game',
].map(name => '<tr><th scope="row">' + name + '</th>' +
  ['M1', 'M2'].map(id => '<td><input type="number" min="1" max="5" aria-label="' + id + ' · ' + name + '"></td>').join('') + '</tr>').join('');

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · E4.2 Material Review</title>
<style>
  :root { color-scheme:light; --paper:#f5f0e5; --panel:#fffaf0; --text:#222c27; --forest:#243d35; --muted:#4c5b4f; --line:#c8cbbb; --accent:#345e46; }
  * { box-sizing:border-box; }
  body { margin:0; color:var(--text); background:var(--paper); font:1rem/1.55 system-ui,sans-serif; }
  .shell { width:min(calc(100% - 2rem),1210px); margin-inline:auto; }
  .masthead { padding:clamp(2.3rem,6vw,4.8rem) 0 2.35rem; background:var(--forest); color:#fff7e8; border-bottom:5px solid #bf9a5e; }
  .masthead p { color:#dfebdf; }
  .project { margin-bottom:.85rem; font-weight:700; }
  h1,h2 { margin:0 0 .8rem; font:500 clamp(2rem,4.2vw,3.25rem)/1.06 Georgia,serif; letter-spacing:-.022em; }
  h1 { font-size:clamp(2.8rem,7vw,5.6rem); }
  p { max-width:77ch; margin:.45rem 0 .8rem; }
  nav { display:flex; flex-wrap:wrap; gap:.5rem 1.1rem; padding:.85rem 0; border-bottom:1px solid var(--line); }
  a,summary { color:var(--accent); font-weight:680; text-underline-offset:.2em; }
  section { margin:clamp(2.6rem,6.8vw,4.7rem) 0; }
  .pair,.quad { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:start; gap:.9rem; }
  .quad { grid-template-columns:repeat(4,minmax(0,1fr)); }
  figure { margin:0; min-width:0; }
  figcaption { font-weight:650; color:var(--muted); font-size:.87rem; padding:.3rem 0 .36rem; }
  .frame { overflow:auto; padding:12px; border:1px solid var(--line); border-radius:.28rem; background:repeating-conic-gradient(#e2e7da 0 25%,#f3eee3 0 50%) 0 0/16px 16px; }
  .frame.scene { padding:0; background:#68864c; }
  .frame.bright { background:#ded6c2; } .frame.dark { background:#2c3549; }
  img { display:block; margin-inline:auto; max-width:none; image-rendering:pixelated; }
  details { margin-top:.75rem; border-top:1px solid var(--line); }
  summary { cursor:pointer; padding:.6rem 0; }
  .legend { display:flex; flex-wrap:wrap; gap:.35rem 1.1rem; padding:0; list-style:none; font-size:.88rem; }
  .legend li { display:flex; align-items:center; gap:.38rem; }
  .legend span { width:14px; height:14px; background:var(--ink); border:1px solid #596356; }
  .scroll { overflow:auto; border:1px solid var(--line); margin:.9rem 0; }
  table { width:100%; border-collapse:collapse; text-align:left; background:var(--panel); }
  th,td { padding:.58rem .7rem; white-space:nowrap; border-bottom:1px solid var(--line); }
  thead,footer { background:#e7ebdd; }
  input { width:3.25rem; border:1px solid #72806f; border-radius:.25rem; padding:.2rem; font:inherit; }
  .downloads { display:flex; flex-wrap:wrap; gap:.52rem; margin:1rem 0; }
  .download { padding:.4rem .65rem; border:1px solid var(--line); border-radius:.28rem; background:var(--panel); }
  footer { padding:1.2rem 0; color:var(--muted); }
  :focus-visible { outline:3px solid #6b5821; outline-offset:3px; }
  @media(max-width:850px) { .gallery { grid-template-columns:minmax(0,1fr); } .quad { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  @media(max-width:530px) { details .pair { grid-template-columns:minmax(0,1fr); } }
  @media print { nav,details,.downloads { display:none; } .frame { overflow:visible; } img { max-width:100%; height:auto; } }
</style></head><body>
<header class="masthead"><div class="shell"><div class="project">LumaSprite Engine · E4.2</div><h1>Duyệt vật liệu Field Surveyor</h1>
<p>M1 và M2 dùng silhouette B1 đã khóa. Xem ảnh native 1× và cảnh RPG trước khi soi cụm pixel.</p>
</div></header>
<nav class="shell" aria-label="Mục lục"><a href="#native">Nhân vật 1×</a><a href="#scene">Cảnh RPG</a><a href="#detail">Chi tiết</a><a href="#palette">Palette</a><a href="#review">Phiếu duyệt</a></nav>
<main class="shell">
<section id="native"><h2>So sánh 1×</h2><p>M1 dùng ít điểm sáng và viền tối đồng nhất. M2 tạo các mảng sáng theo mặt phẳng, xử lý viền theo chất liệu và giữ ánh đèn bên trong kính.</p>${native}
<details><summary>So silhouette B1, M1 và M2 ở 1×</summary>${compare([['../e41r/b1/silhouette.png', 'B1'], ['m1/silhouette.png', 'M1'], ['m2/silhouette.png', 'M2']], '', 'quad')}</details>
<details><summary>So trên nền sáng và nền tối ở 1×</summary>
${compare([['m1-bright-1x.png', 'M1 · Nền sáng'], ['m2-bright-1x.png', 'M2 · Nền sáng']], 'bright')}
${compare([['m1-dark-1x.png', 'M1 · Nền tối'], ['m2-dark-1x.png', 'M2 · Nền tối']], 'dark')}</details>
</section>
<section id="scene"><h2>Organic RPG Clearing · 1×</h2><p>Cùng terrain E3.4 B, props E2, khung hình và vị trí neo trên mặt đất. B2 vẫn dùng màu phẳng làm tham chiếu tư thế bước.</p>${scenes}</section>
<section id="detail"><h2>Cụm pixel và vùng vật liệu</h2><p>Nguồn sáng chính ở trên trái. M2 dùng mảng sáng liên tục ở vai và cẳng tay, điểm sáng da thuộc ở mép giày, cùng vùng sáng ngắn trong kính.</p>
<details><summary>M1 và M2 ở 4×</summary>${compare([['m1-4x.png', 'M1'], ['m2-4x.png', 'M2']])}</details>
<details><summary>Mask vật liệu ở 4×</summary>${compare([['m1-regions-4x.png', 'Mask M1'], ['m2-regions-4x.png', 'Mask M2']])}${legend}</details>${detail}
</section>
<section id="palette"><h2>Palette</h2><p>Project chứa đủ màu Authored và màu E2/E3 đã duyệt nên hai bản Authored và Project cho cùng ảnh. Locked dùng đúng bốn màu được cung cấp và báo mất phân biệt ở các ramp.</p>
${compare([['m1-swatches.png', 'Màu dùng trong M1'], ['m2-swatches.png', 'Màu dùng trong M2']])}
<details><summary>Project và Locked ở 1×</summary>${compare([['m1-project-1x.png', 'M1 · Project'], ['m2-project-1x.png', 'M2 · Project'],
  ['m1-locked-1x.png', 'M1 · Locked'], ['m2-locked-1x.png', 'M2 · Locked']], '', 'quad')}</details>
<div class="scroll" tabindex="0" aria-label="Kiểm định palette"><table><thead><tr><th>Mẫu</th><th>Palette</th><th>Chẩn đoán</th><th>Màu dùng</th><th>Cảnh báo</th></tr></thead><tbody>${paletteRows}</tbody></table></div>
<p>Cả hai khớp alpha 1.086 pixel của B1 và 20 mask bộ phận. Tọa độ landmark, tiếp xúc quai, khe chân và ground pivot cùng được xác minh.</p>
<div class="downloads">${downloads}</div></section>
<section id="review"><h2>Phiếu duyệt vật liệu</h2><p>Đề xuất xem M2 trong cảnh ở 1× trước. Chấm từ 1 đến 5. Điểm nhập chỉ tồn tại trong phiên mở trang. Quyết định mỹ thuật và game-ready thuộc Project Owner.</p>
<div class="scroll" tabindex="0" aria-label="Phiếu chấm"><table><thead><tr><th>Tiêu chí</th><th>M1</th><th>M2</th></tr></thead><tbody>${rubric}</tbody></table></div></section>
</main><footer><div class="shell">LumaSprite Engine · Kiểm thử offline · 0 AI runtime calls</div></footer>
</body></html>
`;
writeFileSync('docs/LumaSprite-Engine-E4.2-Report.html', html);
