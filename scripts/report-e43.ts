import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { measureMaterialReadability } from '../src/quality/character-materials.ts';

const root = 'benchmarks/results/e43';
const read = (path: string) => readFileSync(join(root, path));
type Readability = ReturnType<typeof measureMaterialReadability>;
const metrics = JSON.parse(read('readability.json').toString('utf8')) as { authored: (Readability & { style: string })[] };
const parity = JSON.parse(read('studio/parity.json').toString('utf8')) as {
  studioRevision: string; results: { id: string; characterSpecVersion: number; masks: number; pivot: [number, number];
    saveReopen: string; restore: string; staleRevision: string }[];
};
const candidates = [['m1', 'M1 · Đối chứng'], ['m2', 'M2 · Baseline'], ['m2p', 'M2P · Production Readability']] as const;
function figure(path: string, label: string, scene = false) {
  const png = read(path);
  return '<figure><figcaption>' + label + '</figcaption><div class="frame' + (scene ? ' scene' : '') + '" tabindex="0" aria-label="' + label +
    '"><img width="' + png.readUInt32BE(16) + '" height="' + png.readUInt32BE(20) + '" alt="' + label + '" src="data:image/png;base64,' +
    png.toString('base64') + '"></div></figure>';
}
const gallery = (rows: readonly (readonly [string, string])[], scene = false, columns = 'triple') =>
  '<div class="gallery ' + columns + '">' + rows.map(([path, label]) => figure(path, label, scene)).join('') + '</div>';
const native = gallery([
  ['../e42/m1/final.png', candidates[0][1]], ['../e42/m2/final.png', candidates[1][1]], ['packages/m2p/final.png', candidates[2][1]],
]);
const scenes = [
  ['outdoor', 'Outdoor RPG', 'Giữ vị trí, layout và props E2 theo cảnh Organic đã duyệt.'],
  ['dungeon', 'Dark Dungeon', 'Nền hầm ngục tối từ fixture E2, với cùng bố cục rương và thùng.'],
  ['gameplay', 'Lối đi có nhiều props', 'Terrain E3.4 B ở kích thước gốc, thử độ rõ của đèn gần các thùng gỗ.'],
].map(([id, title, description]) => '<article><h3>' + title + '</h3><p>' + description + '</p>' +
  gallery(candidates.map(([code, label]) => [id + '-' + code + '-1x.png', label]), true) + '</article>').join('\n');

const numbers = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const metricsRows = metrics.authored.map(({ style, coatPlanes, lantern }) =>
  '<tr><th scope="row">' + style.toUpperCase() + '</th><td>' + lantern!.brightGlassPixels + '/' + lantern!.glassPixels +
  '</td><td>' + numbers.format(lantern!.glassMinusFrame) + '</td><td>' + numbers.format(lantern!.frameMinusFarTrousers) +
  '</td><td>' + numbers.format(coatPlanes.nearMinusFar) + '</td></tr>').join('');
const studioRows = parity.results.map(r =>
  '<tr><th scope="row">' + (r.id === 'm2p' ? 'M2P' : 'Forest Courier') + '</th><td>' + r.characterSpecVersion + '</td><td>' +
  r.masks + '</td><td>' + r.pivot.join(', ') + '</td><td>' + r.saveReopen + '</td><td>' + r.restore +
  '</td><td>' + r.staleRevision + '</td></tr>').join('');
const downloads = [['packages/m2p/final.png', 'M2P PNG'], ['packages/m2p/manifest.json', 'M2P manifest'],
  ['packages/courier/final.png', 'Courier PNG'], ['packages/courier/manifest.json', 'Courier manifest'],
  ['readability.json', 'Chỉ số độ rõ'], ['studio/parity.json', 'Kết quả Studio'],
].map(([path, label]) => {
  const mime = path.endsWith('.png') ? 'image/png' : 'application/json';
  return '<a class="download" download="' + path.replaceAll('/', '-') + '" href="data:' + mime + ';base64,' +
    read(path).toString('base64') + '">' + label + '</a>';
}).join('');
const criteria = ['Độ rõ silhouette', 'Độ rõ vật liệu', 'Tỷ lệ đầu và thân', 'Hướng nhìn 3/4', 'Thể tích áo',
  'Cụm pixel', 'Chất lượng outline', 'Tay nắm quai', 'Độ rõ đèn', 'Mức sẵn sàng vào game'];
const scoreRows = criteria.map(label => '<tr><th scope="row">' + label + '</th>' +
  ['M2', 'M2P'].map(code => '<td><input type="number" min="1" max="5" aria-label="' + code + ' · ' + label + '"></td>').join('') + '</tr>').join('');

const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · E4.3 Game Art Review</title>
<style>
:root{color-scheme:light;--paper:#f5f0e5;--panel:#fffaf1;--ink:#232d27;--forest:#233d34;--muted:#485a4d;--line:#c6cdbb;--accent:#335f47}
*{box-sizing:border-box} body{margin:0;background:var(--paper);color:var(--ink);font:1rem/1.6 system-ui,sans-serif}
.shell{width:min(calc(100% - 2rem),1390px);margin-inline:auto}
.masthead{background:var(--forest);color:#fff8e8;border-bottom:5px solid #be985f;padding:clamp(2.15rem,6vw,4.7rem) 0 2.5rem}
.project{font-weight:700;margin-bottom:.8rem}.masthead p{color:#e1e9df}
h1,h2{margin:0 0 .8rem;font:500 clamp(2rem,4vw,3.1rem)/1.05 Georgia,serif;letter-spacing:-.02em}
h1{font-size:clamp(2.75rem,7vw,5.4rem)}h3{margin:0 0 .45rem;line-height:1.2}
p{max-width:79ch;margin:.45rem 0 .8rem}nav{display:flex;flex-wrap:wrap;gap:.5rem 1.15rem;padding:.85rem 0;border-bottom:1px solid var(--line)}
a,summary{color:var(--accent);font-weight:680;text-underline-offset:.2em}
section{margin:clamp(2.55rem,7vw,4.8rem) 0}.gallery{display:grid;gap:.85rem;align-items:start}
.triple{grid-template-columns:repeat(3,minmax(0,1fr))}.pair{grid-template-columns:repeat(2,minmax(0,1fr))}
article{background:var(--panel);border:1px solid var(--line);border-radius:.45rem;padding:.95rem;margin:1rem 0}
figure{margin:0;min-width:0}figcaption{color:var(--muted);font-size:.87rem;font-weight:650;padding:.34rem 0}
.frame{overflow:auto;padding:12px;border:1px solid var(--line);border-radius:.25rem;background:repeating-conic-gradient(#e1e6d8 0 25%,#f2eee3 0 50%) 0 0/16px 16px}
.frame.scene{padding:0;background:#657e51}img{display:block;margin-inline:auto;max-width:none;image-rendering:pixelated}
details{margin-top:.65rem;border-top:1px solid var(--line)}summary{padding:.55rem 0;cursor:pointer}
.scroll{overflow:auto;border:1px solid var(--line);margin:.85rem 0}table{width:100%;border-collapse:collapse;text-align:left;background:var(--panel)}
th,td{padding:.58rem .7rem;white-space:nowrap;border-bottom:1px solid var(--line)}thead,footer{background:#e6ebdc}
input{width:3.2rem;border:1px solid #74816f;border-radius:.2rem;padding:.22rem;font:inherit}
.downloads{display:flex;gap:.5rem;flex-wrap:wrap;margin:1rem 0}.download{background:var(--panel);border:1px solid var(--line);border-radius:.25rem;padding:.38rem .65rem}
footer{padding:1.25rem 0;color:var(--muted)}:focus-visible{outline:3px solid #6d5722;outline-offset:3px}
@media(max-width:850px){article .triple{grid-template-columns:minmax(0,1fr)}}
@media(max-width:530px){details .pair{grid-template-columns:minmax(0,1fr)}}
@media print{nav,details,.downloads{display:none}.frame{overflow:visible}img{max-width:100%;height:auto}}
</style></head><body>
<header class="masthead"><div class="shell"><div class="project">LumaSprite Engine · E4.3</div>
<h1>Field Surveyor trong game</h1><p>So M2P với M1/M2 trên dáng B1 đã khóa. Forest Courier dùng CharacterSpec riêng để kiểm khả năng tái sử dụng.</p></div></header>
<nav class="shell" aria-label="Mục lục"><a href="#native">Nhân vật 1×</a><a href="#scenes">Bối cảnh</a><a href="#lamp">Đèn và áo</a><a href="#courier">Courier</a><a href="#studio">Gói xuất</a><a href="#review">Phiếu duyệt</a></nav>
<main class="shell">
<section id="native"><h2>So ở kích thước gốc</h2><p>Ba bản dùng cùng pivot, CharacterSpec và alpha B1. M2P mở rộng mảng sáng ấm trong kính, tách khung khỏi quần và chỉnh cụm sáng ở thân áo và cổ tay.</p>${native}</section>
<section id="scenes"><h2>Bốn bối cảnh 1×</h2><p>Cùng vị trí và kích thước trong từng cảnh. Cuộn trong khung ảnh khi cần để giữ 1×.</p>${scenes}
<article><h3>Neutral Character Lineup</h3><p>M1, M2 và M2P từ trái sang phải, cùng hàng chân trên nền trung tính.</p>${figure('lineup-1x.png','Neutral lineup · 1×',true)}
<details><summary>Kiểm chi tiết ở 4×</summary>${figure('lineup-4x.png','Neutral lineup · 4×',true)}</details></article></section>
<section id="lamp"><h2>Đèn và thể tích áo</h2><p>Bản tách đèn dưới đây chỉ hiển thị mask kim loại và kính. Cận cảnh giữ tay, quai và phần áo để kiểm tương tác.</p>
${gallery([['m2-lantern-isolated-1x.png','M2 · Đèn tách ở 1×'],['m2p-lantern-isolated-1x.png','M2P · Đèn tách ở 1×']],false,'pair')}
<details><summary>Tay và đèn ở 6×</summary>${gallery([['m2-grip-6x.png','M2'],['m2p-grip-6x.png','M2P']],false,'pair')}</details>
<div class="scroll" tabindex="0" aria-label="Số đo độ rõ vật liệu"><table><thead><tr><th>Mẫu</th><th>Pixel kính sáng ấm</th><th>Kính − khung</th><th>Khung − quần xa</th><th>Áo gần − áo xa</th></tr></thead><tbody>${metricsRows}</tbody></table></div>
<p>Chênh lệch là trung bình luminance 8-bit theo mask. Dáng cẳng tay gần ngang và góc nhìn gần nghiêng khởi nguồn từ geometry B1. Locked vẫn báo <code>PALETTE_LIMITED</code>.</p>
<details><summary>Locked Palette ở 1×</summary>${figure('m2p-locked-1x.png','M2P · Locked')}</details></section>
<section id="courier"><h2>Forest Courier</h2><p>CharacterSpec v3 dùng đầu lớn hơn, áo ngắn, hai tay rảnh, mũ trùm và túi đeo chéo phía trước. Cùng bộ dựng khớp, mask, quy tắc tô vải, da thuộc và viền. Trạng thái là thử nghiệm kỹ thuật.</p>
${gallery([['packages/courier/silhouette.png','Courier · Silhouette 1×'],['courier-flat-1x.png','Courier · Màu phẳng 1×'],['packages/courier/final.png','Courier · Material 1×']])}
<details><summary>Kiểm chất liệu ở 4×</summary>${figure('courier-4x.png','Forest Courier · 4×')}</details></section>
<section id="studio"><h2>Gói production và kiểm Studio</h2><p>Studio ${parity.studioRevision} giữ đúng RGBA, pivot, landmark, part mask và thông tin vật liệu đã ánh xạ. Gói Engine đi kèm CharacterSpec và provenance đầy đủ.</p>
<div class="scroll" tabindex="0" aria-label="Kết quả Studio"><table><thead><tr><th>Mẫu</th><th>CharacterSpec</th><th>Mask</th><th>Pivot</th><th>Lưu và mở lại</th><th>Backup restore</th><th>Revision cũ</th></tr></thead><tbody>${studioRows}</tbody></table></div>
${gallery([['studio/m2p-restored.png','Studio · M2P phục hồi'],['studio/courier-restored.png','Studio · Courier phục hồi']],false,'pair')}
<div class="downloads">${downloads}</div></section>
<section id="review"><h2>Phiếu duyệt mỹ thuật</h2><p>Đề xuất M2P cho đèn ở 1×. Chấm từ 1 đến 5, dựa trên cả bốn cảnh. Điểm nhập chỉ dùng trong phiên mở trang. Project Owner quyết định mức sẵn sàng vào game.</p>
<div class="scroll" tabindex="0" aria-label="Phiếu duyệt game art"><table><thead><tr><th>Tiêu chí</th><th>M2</th><th>M2P</th></tr></thead><tbody>${scoreRows}</tbody></table></div></section>
</main><footer><div class="shell">LumaSprite Engine · Kiểm thử offline · 0 AI runtime calls</div></footer></body></html>
`;
writeFileSync('docs/LumaSprite-Engine-E4.3-Report.html', html);
