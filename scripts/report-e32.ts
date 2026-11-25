import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodePng } from '../src/core/renderer/png.ts';

const directory = 'benchmarks/results/e32';
const uri = (mime: string, bytes: Buffer) => 'data:' + mime + ';base64,' + bytes.toString('base64');
const count = (n: number) => n.toLocaleString('vi-VN');
async function image(name: string, caption: string) {
  const png = await readFile(join(directory, name + '.png'));
  const raster = decodePng(png);
  return `<figure><div class="raster"><img src="${uri('image/png', png)}" alt="${caption}" width="${raster.w}" height="${raster.h}"></div><figcaption>${caption} <span>${raster.w}×${raster.h}</span></figcaption></figure>`;
}
async function views(name: string, caption: string) {
  return '<article>' + await image(name + '-1x', caption + ' · 1×') +
    '<details><summary>Xem 4×</summary>' + await image(name + '-4x', caption + ' · 4× nearest-neighbor') + '</details></article>';
}
async function comparison(name: string, title: string, intro: string) {
  return `<h3>${title}</h3><p>${intro}</p><div class="views">${await views(name + '-before', 'E3.1')}${await views(name + '-after', 'E3.2 Standard')}</div>`;
}
async function download(name: string, label: string) {
  const bytes = await readFile(join(directory, name));
  return `<a download="${name}" href="${uri(name.endsWith('.png') ? 'image/png' : 'application/json', bytes)}">${label}</a>`;
}

const qa = JSON.parse(await readFile(join(directory, 'qa.json'), 'utf8'));
const qaModes = [
  ['Authored', qa.authored], ['Project', qa.project], ['Locked', qa.locked],
] as const;
const paletteRows = qaModes.map(([label, mode]) => `<tr><td>${label}</td><td>${mode.status}</td><td>${mode.midtoneGap}</td><td>${mode.warnings.map((warning: { code: string }) => warning.code).join(', ') || '—'}</td></tr>`).join('');
const repetitionRows = ['grass', 'dirt'].map(key => {
  const before = qa.repetition.before[key], after = qa.repetition.after[key];
  return `<tr><td>${key === 'grass' ? 'Grass Center' : 'Dirt Center'}</td><td>${before.tiles}</td><td>${before.distinctTextures} → ${after.distinctTextures}</td><td>${before.exactRepeatsAt16px}/${before.neighborPairs} → ${after.exactRepeatsAt16px}/${after.neighborPairs}</td></tr>`;
}).join('');
const assets = await Promise.all([
  ['atlas.png', 'Tải PNG atlas'], ['atlas.json', 'JSON mapping 47 mask'], ['terrain-spec.json', 'TerrainSpec v2'],
  ['map-input.json', 'Map và origin'], ['project-palette.json', 'Project Palette'], ['qa.json', 'QA JSON'], ['scenes.json', 'Scene metadata'],
].map(([name, label]) => download(name, label)));

const report = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LumaSprite Engine · E3.2 Terrain</title>
<style>
:root{color-scheme:light;--paper:#f8f7ef;--ink:#242b24;--quiet:#4c594e;--stroke:#ccd6c9;--dark:#19382c;--green:#26503c;--orange:#773b20}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 Inter,"Segoe UI",system-ui,sans-serif}
header{background:var(--dark);color:#f8faf4}
header div,main,footer{width:min(1340px,100% - 40px);margin:auto}
header div{padding:36px 0 24px}
h1,h2,h3{line-height:1.15;letter-spacing:-.02em}
h1{font-size:clamp(2rem,4vw,3.25rem);margin:0 0 12px}
h2{font-size:clamp(1.5rem,3vw,2rem);margin:0 0 12px}
h3{margin:24px 0 8px}
p{margin:0 0 14px;max-width:85ch}
header p{color:#e0ece3}
nav,.downloads{display:flex;flex-wrap:wrap;gap:8px 18px}
a{color:var(--green);text-underline-offset:.23em}
nav a{color:#f5fbf4;padding:8px 0}
a:focus-visible,summary:focus-visible{outline:3px solid #ad652d;outline-offset:4px}
section{padding:26px 0;border-bottom:1px solid var(--stroke)}
.cards,.views,.small-views{display:grid;gap:12px}
.cards{grid-template-columns:repeat(auto-fit,minmax(min(215px,100%),1fr));margin:0}
.cards div,article{background:#fff;border:1px solid var(--stroke);border-radius:9px;padding:13px;min-width:0}
dt,figcaption span{color:var(--quiet)}
dd{margin:5px 0 0;font-weight:720}
.warn{color:var(--orange)}
.views{grid-template-columns:repeat(auto-fit,minmax(min(560px,100%),1fr))}
.small-views{grid-template-columns:repeat(auto-fit,minmax(min(315px,100%),1fr))}
figure{margin:0;min-width:0}
figcaption{margin-top:8px;font-weight:640}
figcaption span{font-weight:400;white-space:nowrap}
.raster{overflow:auto;background:#e8ecdf;border-radius:5px;padding:9px}
img{display:block;max-width:none;image-rendering:pixelated}
summary{padding:12px 0 5px;color:var(--green);font-weight:650;cursor:pointer}
.table{overflow:auto;margin:12px 0 16px}
table{width:100%;border-collapse:collapse}
th,td{padding:9px 11px;border-bottom:1px solid var(--stroke);text-align:left;vertical-align:top}
th{background:#e8ecdf}
code{overflow-wrap:anywhere}
footer{padding:20px 0 32px;color:var(--quiet)}
@media print{header{background:#fff;color:var(--ink)}header p{color:var(--ink)}nav,.downloads{display:none}article{break-inside:avoid}}
</style>
</head>
<body>
<header><div>
<h1>LumaSprite Engine · Terrain E3.2</h1>
<p>Biên cỏ–đất có bậc ngắn và cụm chất liệu thay đổi theo tọa độ. Atlas 47 mask giữ đúng Tile ID và biên nối của checkpoint E3.1.</p>
<nav aria-label="Mục lục"><a href="#scenes">Cảnh trước/sau</a><a href="#palette">Palette và mật độ</a><a href="#qa">Kiểm thử</a><a href="#review">Phiếu duyệt</a></nav>
</div></header>
<main>
<section aria-label="Trạng thái">
<dl class="cards"><div><dt>E3.1</dt><dd>Engineering approved · mỹ thuật cần refinement</dd></div>
<div><dt>E3.2</dt><dd>47 mask · 256 raw mask</dd></div>
<div><dt>Kiểm điểm giao mỗi palette</dt><dd>${count(qa.authored.junctions.neighborhoods)} bố cục 2×2</dd></div>
<div><dt>Mỹ thuật E3.2</dt><dd class="warn">PENDING_HUMAN_REVIEW</dd></div></dl>
</section>
<section id="scenes">
<h2>So sánh ở 1×</h2>
<p>Giữ zoom trình duyệt ở 100%. Ảnh 4× nằm dưới mỗi bản để kiểm pixel. Seed 42, origin (−17, 24) theo ô. Ba cặp dùng cùng layout. Bộ prop E2 và nhân vật CC0 được đặt vào cùng tọa độ.</p>
${await comparison('outdoor', 'A · Outdoor RPG', 'Đánh giá độ rõ của năm prop E2 và nhân vật tham chiếu trên cùng đường đất.')}
${await comparison('large', 'B · Vùng Grass và Dirt lớn', 'Quan sát vệt lặp của texture và các bậc chuyển tiếp giữa hai vùng.')}
${await comparison('stress', 'C · Autotile stress', 'Kiểm đường ngang/dọc, góc trong/ngoài, lỗ, dải hẹp và các ô nối chéo.')}
<h3>Atlas 47 mask</h3>
<div class="small-views"><article>${await image('atlas', 'Atlas PNG gốc')}<details><summary>Xem atlas 4×</summary>${await image('atlas-4x', 'Atlas nearest-neighbor')}</details></article></div>
</section>
<section id="palette">
<h2>D · Palette trên cùng layout</h2>
<div class="small-views">${await views('palette-authored', 'Authored')}${await views('palette-project', 'Project')}${await views('palette-locked', 'Studio locked')}</div>
<div class="table"><table><thead><tr><th scope="col">Chế độ</th><th scope="col">Chẩn đoán</th><th scope="col">Chênh sáng tông giữa</th><th scope="col">Cảnh báo</th></tr></thead><tbody>${paletteRows}</tbody></table></div>
<p>Project Palette giữ nguyên màu authored của prop E2 và thêm các ramp cỏ, đất dịu hơn. Bản locked bốn màu vẫn hợp lệ nhưng cỏ và đất trùng tông giữa.</p>
${await image('project-swatches', 'Swatches Grass, Dirt, Wood &amp; Iron')}
<h3>Ba mật độ trên cùng cảnh Outdoor</h3>
<div class="small-views">${await views('outdoor-sparse', 'Sparse')}${await views('outdoor-after', 'Standard')}${await views('outdoor-dense', 'Dense')}</div>
<p>Standard là mặc định để duyệt. Sparse giảm dấu trên đường đất. Dense cho thấy nguy cơ nền cạnh tranh với prop.</p>
</section>
<section id="qa">
<h2>QA và mức lặp texture</h2>
<p>Đếm khối 16×16 RGBA của cùng loại tile ở cảnh B. Cặp lặp là hai ô kề ngang hoặc dọc có pixel giống hệt.</p>
<div class="table"><table><thead><tr><th scope="col">Vật liệu</th><th scope="col">Ô đo</th><th scope="col">Texture khác nhau</th><th scope="col">Cặp lặp ở 16 px</th></tr></thead><tbody>${repetitionRows}</tbody></table></div>
<p>Mỗi palette khớp ${count(qa.authored.seams.horizontal + qa.authored.seams.vertical)} cặp cạnh và đủ ${count(qa.authored.junctions.neighborhoods)} bố cục điểm giao. Border v2 trùng RGBA v1 cùng palette. Các test kiểm seed, render cửa sổ độc lập, PNG round-trip, palette, alpha, Atlas JSON và regression E0–E3.1.</p>
<p>Studio bb5c384 đăng ký và dựng atlas tĩnh E3.2, rồi khôi phục backup với kết quả từng pixel trùng. Cụm texture theo tọa độ được xuất ở chế độ map của Engine. Studio chọn một Tile ID cố định trên mỗi mask.</p>
<p>0 lượt gọi DeepSeek và 0 lượt inference runtime. Baseline E3.1 ở <code>ad7cdbc</code> giữ nguyên ảnh, mapping, QA và báo cáo.</p>
<div class="downloads">${assets.join('')}</div>
</section>
<section id="review">
<h2>Phiếu duyệt terrain</h2>
<p>Chấm sau khi xem ảnh 1×. Project Owner chọn mật độ và quyết định mức sẵn sàng dùng trong game.</p>
<div class="table"><table><thead><tr><th scope="col">Tiêu chí</th><th scope="col">Điểm 1–5</th><th scope="col">Ghi chú</th></tr></thead><tbody>${[
  'Độ dễ đọc', 'Texture cỏ', 'Texture đất', 'Dáng biên', 'Cảm nhận seam', 'Mức lặp',
  'Hòa sắc', 'Độ rõ prop', 'Sẵn sàng dùng trong game',
].map(label => '<tr><td>' + label + '</td><td></td><td></td></tr>').join('')}</tbody></table></div>
<p>Mật độ chọn · __________ &nbsp; Quyết định Project Owner · __________</p>
</section>
</main>
<footer>LumaSprite Engine · E3.2 review</footer>
</body>
</html>
`;
await writeFile('docs/LumaSprite-Engine-E3.2-Report.html', report);
console.log('E3.2 report written to docs/LumaSprite-Engine-E3.2-Report.html');
