import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodePng } from '../src/core/renderer/png.ts';

const e2 = 'benchmarks/results/e24';
const e3 = 'benchmarks/results/e3';
const data = (mime: string, bytes: Buffer) => 'data:' + mime + ';base64,' + bytes.toString('base64');
const number = (n: number) => n.toLocaleString('vi-VN');

async function picture(directory: string, name: string, label: string) {
  const bytes = await readFile(join(directory, name + '.png'));
  const { w, h } = decodePng(bytes);
  return `<figure><div class="pixel-frame"><img alt="${label}" src="${data('image/png', bytes)}" width="${w}" height="${h}"></div><figcaption>${label} <span>${w}×${h}</span></figcaption></figure>`;
}
async function download(file: string, label: string) {
  const bytes = await readFile(join(e3, file));
  return `<a download="${file}" href="${data(file.endsWith('.png') ? 'image/png' : 'application/json', bytes)}">${label}</a>`;
}
async function preview(name: string, title: string) {
  return '<article>' + await picture(e3, name + '-1x', title + ' ở 1×') +
    '<details><summary>Xem 4×</summary>' + await picture(e3, name + '-4x', title + ' ở 4× nearest-neighbor') + '</details></article>';
}

const qa = JSON.parse(await readFile(join(e3, 'qa.json'), 'utf8'));
const cover = JSON.parse(await readFile(join(e3, 'coverage.json'), 'utf8'));
const props = await Promise.all([
  ['compact', 'Compact Chest'], ['domed', 'Domed Chest'], ['travel', 'Travel Chest'],
  ['crate', 'Crate'], ['barrel-wide', 'Barrel Wide'], ['barrel-tall', 'Barrel Tall'],
].map(([id, title]) => picture(e2, id + '-1x', title)));
const e2Scenes = await Promise.all([
  ['outdoor-authored-1x', 'Outdoor RPG đã duyệt'], ['dungeon-authored-1x', 'Dark Dungeon đã duyệt'],
  ['neutral-authored-1x', 'Neutral Comparison đã duyệt'],
].map(([id, title]) => picture(e2, id, title)));
const maps = await Promise.all([
  ['outdoor', 'Outdoor cùng props E2'], ['transition', 'Biên cỏ–đất ngang và dọc'],
  ['stress', 'Cấu hình nhiều góc và lỗ'], ['repeated-centers', 'Grass Center và Dirt Center lặp'],
].map(([id, title]) => preview(id, title)));
const evidence = await Promise.all([
  ['atlas.png', 'PNG atlas gốc'], ['atlas.json', 'JSON atlas và TerrainSpec'], ['locked-atlas.json', 'JSON palette khóa'],
  ['coverage.json', 'JSON ma trận mask'], ['qa.json', 'JSON chẩn đoán'], ['wood-iron-preset.json', 'Preset Wood & Iron'],
].map(([file, label]) => download(file, label)));
const matrix = cover.masks.map((row: { mask: number; tileId: number; x: number; y: number }) =>
  `<tr><td>${row.tileId}</td><td>${row.mask} / 0x${row.mask.toString(16).padStart(2, '0')}</td><td>${row.x}, ${row.y}</td></tr>`).join('');
const rubric = ['Độ dễ đọc của terrain', 'Liên tục qua biên ô', 'Chất lượng cạnh và góc', 'Cụm pixel', 'Mức độ lặp texture',
  'Hòa sắc', 'Độ rõ của prop và nhân vật', 'Mức sẵn sàng dùng trong game'];
const authoredSeams = qa.authored.seams;

const report = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LumaSprite Engine · Báo cáo E2–E3.1</title>
<style>
:root{color-scheme:light;--paper:#f8f7f0;--ink:#202923;--muted:#49554b;--line:#cfd7ca;--forest:#19372c;--green:#27513d;--warning:#71391f;--white:#fff}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 Inter,"Segoe UI",system-ui,sans-serif}
header{background:var(--forest);color:#f5f7ef}
header>div,main,footer{width:min(1120px,100% - 40px);margin:auto}
header>div{padding:38px 0 30px}
h1,h2,h3{line-height:1.15;letter-spacing:-.025em}
h1{font-size:clamp(2rem,5vw,3.25rem);margin:0 0 12px}
h2{font-size:clamp(1.5rem,3vw,2.125rem);margin:0 0 14px}
h3{font-size:1.125rem;margin:12px 0 6px}
p{margin:0 0 14px}
header p{color:#e0eddf;max-width:66ch}
nav,.actions{display:flex;flex-wrap:wrap;gap:10px 18px}
a{color:var(--green);text-underline-offset:.2em}
nav a{color:#effaf0;padding:8px 0}
a:focus-visible,summary:focus-visible{outline:3px solid #a7611e;outline-offset:4px;border-radius:3px}
main section{padding:28px 0;border-bottom:1px solid var(--line)}
.cards,.figures,.props{display:grid;gap:14px}
.cards{grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));margin:0}
.cards div,article,figure{border:1px solid var(--line);border-radius:9px;background:var(--white);min-width:0}
.cards div{padding:14px}
dt{color:var(--muted)}
dd{margin:5px 0 0;font-weight:750}
.good{color:var(--green)}
.warn{color:var(--warning)}
.props{grid-template-columns:repeat(auto-fit,minmax(min(142px,100%),1fr));margin-bottom:16px}
.figures{grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))}
article{padding:12px}
article>figure,details figure{border:0}
figure{margin:0;padding:12px}
.pixel-frame{overflow:auto;padding:12px;background:#edf0e7;border-radius:5px}
img{display:block;max-width:none;image-rendering:pixelated}
figcaption{margin-top:10px;font-weight:630}
figcaption span{font-weight:400;color:var(--muted);white-space:nowrap}
details{margin-top:10px}
summary{padding:8px 0;cursor:pointer;color:var(--green);font-weight:650}
.table{overflow:auto;margin:10px 0 16px}
table{width:100%;border-collapse:collapse}
th,td{border-bottom:1px solid var(--line);padding:9px 12px;text-align:left;vertical-align:top}
th{background:#edf0e7}
code{overflow-wrap:anywhere;color:var(--forest)}
footer{padding:20px 0 32px;color:var(--muted)}
ul{padding-left:22px}
@media print{header{background:white;color:var(--ink)}header p{color:var(--ink)}nav,.actions{display:none}header>div{padding:12px 0}figure{break-inside:avoid}}
</style>
</head>
<body>
<header><div>
<h1>LumaSprite Engine · Báo cáo E2–E3.1</h1>
<p>Bộ prop E2 đã được duyệt với palette authored. Grass &amp; Dirt Tileset đã qua kiểm thử kỹ thuật và đang chờ duyệt hình ảnh.</p>
<nav aria-label="Mục lục"><a href="#e2">Duyệt E2</a><a href="#atlas">Atlas và bản đồ</a><a href="#palette">Palette</a><a href="#qa">Kiểm thử</a><a href="#review">Phiếu duyệt</a></nav>
</div></header>
<main>
<section aria-label="Trạng thái">
<dl class="cards"><div><dt>Phạm vi duyệt E2</dt><dd class="good">6 prop authored · 32×32</dd></div>
<div><dt>Atlas E3.1</dt><dd>${qa.masks} mask + Dirt Center · 16×16</dd></div>
<div><dt>Kiểm seam mỗi palette</dt><dd class="good">${number(authoredSeams.horizontal + authoredSeams.vertical)} cặp ô khớp</dd></div>
<div><dt>Mỹ thuật terrain</dt><dd class="warn">PENDING_HUMAN_REVIEW</dd></div></dl>
</section>
<section id="e2">
<h2>Quyết định E2</h2>
<p>Ngày ghi nhận 25/11/2026. Project Owner dùng đánh giá trực quan của ChatGPT về Outdoor RPG, Dark Dungeon và Neutral Comparison để phê duyệt baseline E2 với palette authored trong phạm vi 32×32. Phiếu duyệt giữ nguyên dữ liệu gốc, chưa có điểm số từng tiêu chí.</p>
<div class="props">${props.join('')}</div>
<details><summary>Xem ba cảnh E2 làm căn cứ duyệt</summary><div class="figures">${e2Scenes.join('')}</div></details>
<p>Hạn chế đã chấp nhận gồm độ phân biệt nan Barrel Tall khi khóa màu, thanh gia cố Travel hơi nổi trên nền sáng và việc kiểm contact shadow với các tỷ lệ nhân vật khác.</p>
</section>
<section id="atlas">
<h2>Grass &amp; Dirt Tileset</h2>
<p>Atlas 128×96 theo thứ tự mask chuẩn của Studio. Xem ảnh 1× ở mức zoom trình duyệt 100%, rồi mở ảnh 4× để kiểm cụm pixel và góc.</p>
<div class="figures"><article>${await picture(e3, 'atlas', 'Atlas authored ở 1×')}
<details><summary>Xem atlas 4×</summary>${await picture(e3, 'atlas-4x', 'Atlas authored ở 4× nearest-neighbor')}</details></article>
<article>${await picture(e3, 'mask-matrix-1x', 'Ma trận 47 bố cục lân cận ở 1×')}</article></div>
<h3>Bản đồ kiểm tra ở 1×</h3>
<div class="figures">${maps.join('')}</div>
<p>Outdoor dùng nguyên ảnh năm prop E2 và nhân vật tham chiếu CC0 đã có. Họa tiết nhỏ lặp theo ô trên vùng rộng. Bản xuất giữ vị trí góc, seam và nghĩa mask khi đổi seed.</p>
<details><summary>Xem bảng 47 mask và vị trí atlas</summary><div class="table"><table><thead><tr><th scope="col">Tile ID</th><th scope="col">Mask</th><th scope="col">x, y</th></tr></thead><tbody>${matrix}</tbody></table></div></details>
</section>
<section id="palette">
<h2>Palette authored, custom và locked</h2>
<p>Palette custom và locked dùng đúng danh sách màu được cung cấp. Bốn màu mặc định của Studio làm tông giữa cỏ và đất trùng nhau ở bản thử. RGBA vẫn hợp lệ và chẩn đoán báo <strong class="warn">${qa.locked.palette.status}</strong>.</p>
<div class="figures">${await picture(e3, 'transition-1x', 'Cùng bản đồ với authored palette')}${await picture(e3, 'transition-locked-1x', 'Cùng bản đồ với Studio locked palette')}${await picture(e3, 'terrain-swatches', 'Swatches terrain')}${await picture(e3, 'wood-iron-swatches', 'Preset đề xuất Wood &amp; Iron')}</div>
<p>Đề xuất cho Studio là xem swatch và cảnh báo trước khi submit, sau đó truyền palette người dùng đã chọn qua trường hiện có.</p>
</section>
<section id="qa">
<h2>Kiểm thử và bàn giao</h2>
<div class="table"><table><thead><tr><th scope="col">Hạng mục</th><th scope="col">Bằng chứng</th></tr></thead><tbody>
<tr><td>Build và regression</td><td>Lint, typecheck, build, CLI smoke và 27 test Engine đạt. Benchmark E0–E2 và E3 tái tạo từng byte.</td></tr>
<tr><td>Seam và mask</td><td>Kiểm đủ 256 raw mask. Mỗi palette khớp ${number(authoredSeams.matchedBorderPixels)} pixel biên qua các bố cục ngang và dọc.</td></tr>
<tr><td>Studio thật</td><td>Đăng ký atlas, autotile, render đối chiếu pixel và khôi phục backup trên Studio <code>bb5c384</code>. HTTP v1 vẫn phục vụ prop.</td></tr>
<tr><td>Chi phí</td><td>0 lượt gọi DeepSeek và 0 lượt inference AI runtime.</td></tr>
<tr><td>SHA-256 atlas PNG authored</td><td><code>${qa.authored.pngSha256}</code></td></tr>
</tbody></table></div>
<p>Mở atlas PNG dưới dạng một asset 128×96. Để có map đã đăng ký, chạy <code>npm run test:terrain-studio</code> với biến <code>LUMASPRITE_CAPTURE_TERRAIN_BACKUP=1</code>, giải nén <code>benchmarks/results/run/e3-studio.zip</code> và chọn thư mục trong <strong>Mở sao lưu</strong> của Studio.</p>
<div class="actions" aria-label="Tải tệp nhúng">${evidence.join('')}</div>
</section>
<section id="review">
<h2>Phiếu duyệt terrain</h2>
<p>Chấm sau khi xem bản đồ ở 1×. Kết quả kỹ thuật độc lập với quyết định mỹ thuật của Project Owner.</p>
<div class="table"><table><thead><tr><th scope="col">Tiêu chí</th><th scope="col">Điểm 1–5</th><th scope="col">Ghi chú</th></tr></thead><tbody>${rubric.map(text => '<tr><td>' + text + '</td><td></td><td></td></tr>').join('')}</tbody></table></div>
<p>E3.2 có thể cải thiện độ lặp trên mảng rộng và thử palette dự án sau khi có ghi chú duyệt E3.1. E4 dành cho Character Geometry &amp; Pose. DeepSeek chuyển đến E9 và chờ Project Owner cho phép.</p>
</section>
</main>
<footer>LumaSprite Engine · E2.5 Palette Policy · E3.0 Contract Audit · E3.1 Tileset MVP</footer>
</body>
</html>
`;

await writeFile('docs/LumaSprite-Engine-Report.html', report);
console.log('Unified report written to docs/LumaSprite-Engine-Report.html');
