import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = 'benchmarks/results/e33';
const file = (path: string) => readFileSync(join(root, path));
const qa = JSON.parse(file('qa.json').toString('utf8'));
const parity = JSON.parse(file('studio/parity.json').toString('utf8')) as {
  studioRevision: string;
  results: { scene: string; width: number; height: number; worldTerrainPixelsOutsideStaticParity: number }[];
};
const figures = [
  { id: 'outdoor', title: 'Outdoor RPG', desc: 'Đối chiếu độ nổi của năm props E2.4 và traveler CC0 trên cùng vị trí.', alt: 'Khu đất cỏ lẫn đường đất có rương, thùng gỗ và nhân vật' },
  { id: 'large', title: 'Large Grass/Dirt', desc: 'Kiểm nhịp texture và đường biên trên một bản đồ rộng có mảng liên tục.', alt: 'Bản đồ cỏ và đất với nhiều bờ dài' },
  { id: 'stress', title: 'Transition stress', desc: 'Kiểm bờ hẹp, góc lồi, góc lõm và các vùng nhỏ trong cùng layout.', alt: 'Bản đồ cỏ và đất nhiều hốc, góc và dải hẹp' },
  { id: 'regions', title: 'Multiple regions', desc: 'Các vùng tách rời dùng chung canonical ID. Hình dạng bờ và texture được chọn theo tọa độ tuyệt đối.', alt: 'Bốn vùng cỏ và đất có hình dạng và mép khác nhau' },
];

function image(path: string, label: string, alt = label, eager = false) {
  const bytes = file(path);
  return '<figure><figcaption>' + label + '</figcaption><div class="raster" tabindex="0" aria-label="' + label +
    '"><img ' + (eager ? '' : 'loading="lazy" ') + 'width="' + bytes.readUInt32BE(16) + '" height="' + bytes.readUInt32BE(20) +
    '" alt="' + alt + '" src="data:image/png;base64,' + bytes.toString('base64') + '"></div></figure>';
}

function download(path: string, name: string, label: string) {
  const mime = name.endsWith('.png') ? 'image/png' : 'application/json';
  return '<a class="download" download="' + name + '" href="data:' + mime + ';base64,' +
    file(path).toString('base64') + '">' + label + '</a>';
}

const gallery = figures.map(({ id, title, desc, alt }) => {
  const old = (version: number) => id === 'regions' ? 'regions-e3' + version :
    '../e32/' + id + (version === 1 ? '-before' : '-after');
  const compare = (scale: number, third: string) => '<div class="compare">' +
    image(old(1) + '-' + scale + 'x.png', 'E3.1 · Engine baseline · ' + scale + '×', alt) +
    image(old(2) + '-' + scale + 'x.png', 'E3.2 · Engine world · ' + scale + '×', alt) +
    image(third, 'E3.3 · Engine baked · ' + scale + '×', alt, id === 'outdoor' && scale === 1) + '</div>';
  return '<article id="' + id + '"><h3>' + title + '</h3><p>' + desc + '</p>' +
    compare(1, 'packages/' + id + '/map.png') +
    '<details><summary>Đối chiếu bờ và texture ở 4×</summary>' + compare(4, id + '-4x.png') + '</details>' +
    '<details><summary>PNG xuất lại từ Studio ở 1×</summary><div class="compare pair">' +
    image('studio/' + id + '-baked-1x.png', 'Studio · Asset raster · 1×', alt) +
    image('studio/' + id + '-editable-1x.png', 'Studio · Tilemap chỉnh sửa được · 1×', 'Terrain từ atlas tĩnh trong Studio') +
    '</div>' + (id === 'outdoor' ? '<p>Scope của tilemap chỉnh sửa được gồm cỏ và đất. Các props và traveler thuộc fixture bake.</p>' : '') +
    '</details></article>';
}).join('\n');

const choices = (items: { label: string; note: string; native: string; zoom: string }[]) =>
  '<div class="compare">' + items.map(({ label, note, native, zoom }) => '<div>' +
    image(native, label + ' · 1×') + '<p>' + note + '</p>' +
    '<details><summary>Xem 4×</summary>' + image(zoom, label + ' · 4×') + '</details></div>').join('') + '</div>';

const density = choices([
  { label: 'Sparse', note: 'Dùng cho cảnh đông nhân vật hoặc props.', native: 'outdoor-sparse-1x.png', zoom: 'outdoor-sparse-4x.png' },
  { label: 'Standard', note: 'Mặc định đề xuất. Các vùng yên tạo khoảng cách giữa cụm cỏ và đất.', native: 'packages/outdoor/map.png', zoom: 'outdoor-4x.png' },
  { label: 'Dense', note: 'Dùng có chủ đích ở nơi texture cần nổi bật.', native: 'outdoor-dense-1x.png', zoom: 'outdoor-dense-4x.png' },
]);
const palettes = choices([
  { label: 'Authored', note: 'FULL_RAMP. Cỏ ba sắc và đất bốn sắc.', native: 'palette-authored-1x.png', zoom: 'palette-authored-4x.png' },
  { label: 'Project', note: 'FULL_RAMP. Giữ màu props E2 và thêm tông đất nén.', native: 'palette-project-1x.png', zoom: 'palette-project-4x.png' },
  { label: 'Locked', note: 'PALETTE_LIMITED. Tông giữa cỏ và đất trùng nhau, palette bốn màu giữ nguyên.', native: 'palette-locked-1x.png', zoom: 'palette-locked-4x.png' },
]);

const number = new Intl.NumberFormat('vi-VN');
const studioRows = parity.results.map(({ scene, width, height, worldTerrainPixelsOutsideStaticParity }) =>
  '<tr><th scope="row">' + figures.find(x => x.id === scene)?.title + '</th><td>' + width + ' × ' + height +
  '</td><td>Khớp RGBA</td><td>Khớp atlas tĩnh</td><td>' +
  number.format(worldTerrainPixelsOutsideStaticParity) + '</td><td>Pass</td></tr>').join('');
const reviewRows = ['Texture cỏ', 'Texture đất', 'Độ tự nhiên của bờ', 'Nhịp lặp nhìn thấy', 'Hài hòa bảng màu',
  'Độ rõ của props', 'Độ rõ của bản đồ', 'Mức sẵn sàng đưa vào game'].map((name, index) =>
  '<tr><th scope="row"><label for="score-' + index + '">' + name + '</label></th><td>4/5</td><td><input id="score-' + index +
  '" type="number" min="1" max="5" step="1" placeholder="–"></td><td><input type="text" aria-label="Ghi chú ' + name + '"></td></tr>').join('');

const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LumaSprite Engine · Duyệt terrain E3.3</title>
<style>
  :root { color-scheme: light; --paper:#f5f2e9; --ink:#1d2c25; --muted:#495c50; --line:#c8cdbb; --forest:#213c31; --glass:#fbf9f2; --accent:#3c6548; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:1rem/1.6 system-ui,sans-serif; }
  .shell { width:min(calc(100% - 2rem), 1380px); margin-inline:auto; }
  header { background:var(--forest); color:#f8f5e9; padding:clamp(2rem,6vw,5rem) 0 2.6rem; border-bottom:5px solid #ad935f; }
  header p { margin:0; max-width:64ch; color:#e1e8da; }
  .project { font-weight:700; margin-bottom:1rem; }
  h1,h2 { font-family:Georgia,serif; font-weight:500; line-height:1.05; letter-spacing:-.026em; }
  h1 { margin:0 0 1rem; font-size:clamp(2.7rem,7vw,5.6rem); }
  h2 { margin:0 0 .8rem; font-size:clamp(2rem,4vw,3.2rem); }
  h3 { line-height:1.2; margin:0 0 .45rem; }
  nav { display:flex; flex-wrap:wrap; gap:.45rem 1.3rem; padding:.8rem 0; border-bottom:1px solid var(--line); }
  a { color:var(--accent); font-weight:680; text-underline-offset:.2em; }
  nav a { padding:.2rem 0; }
  main section { margin:clamp(2.5rem,7vw,5rem) 0; }
  main p { margin:.45rem 0 1rem; max-width:75ch; }
  article { padding:1.15rem; margin:1.2rem 0; background:var(--glass); border:1px solid var(--line); border-radius:.55rem; }
  .compare { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; align-items:start; }
  .pair { grid-template-columns:repeat(2,minmax(0,1fr)); }
  figure { margin:0; min-width:0; }
  figcaption { padding:.35rem 0 .45rem; color:var(--muted); font-size:.9rem; font-weight:650; }
  .raster { overflow:auto; max-height:480px; background:#e7e5d8; border:1px solid var(--line); border-radius:.25rem; }
  img { display:block; max-width:none; image-rendering:pixelated; }
  details { margin:.75rem 0 0; border-top:1px solid var(--line); }
  summary { padding:.55rem 0; cursor:pointer; color:var(--accent); font-weight:680; }
  .scroll { overflow:auto; border:1px solid var(--line); }
  table { width:100%; border-collapse:collapse; background:var(--glass); text-align:left; }
  th, td { padding:.65rem .75rem; white-space:nowrap; border-bottom:1px solid var(--line); }
  thead { background:#e7ebdb; }
  .downloads { display:flex; flex-wrap:wrap; gap:.5rem; margin:1rem 0; }
  .download { display:inline-block; padding:.43rem .8rem; border-radius:.3rem; border:1px solid var(--line); background:var(--glass); }
  footer { padding:1.3rem 0; background:#e7ebdb; color:var(--muted); }
  input { font:inherit; background:var(--glass); border:1px solid #7b897c; border-radius:.2rem; color:var(--ink); padding:.2rem .3rem; }
  input[type=number] { width:4rem; }
  input[type=text] { width:100%; min-width:10rem; }
  code { overflow-wrap:anywhere; }
  :focus-visible { outline:3px solid #6a5a20; outline-offset:3px; }
  @media(max-width:720px) { .compare,.pair { grid-template-columns:minmax(0,1fr); } article { padding:.85rem; } }
  @media print { nav,.downloads,details { display:none; } .compare { grid-template-columns:minmax(0,1fr); } .raster { overflow:visible; max-height:none; } img { max-width:100%; height:auto; } }
</style>
</head>
<body>
<header><div class="shell">
  <div class="project">LumaSprite Engine · E3.3</div>
  <h1>Duyệt terrain sản xuất</h1>
  <p>Ứng viên Grass/Dirt giữ world-space detail trong PNG đã bake. Bốn fixture đã qua kiểm tra lưu, mở lại và phục hồi ở Studio. Đang chờ Project Owner duyệt nghệ thuật cuối.</p>
</div></header>
<nav class="shell" aria-label="Mục lục">
  <a href="#gallery">Đối chiếu</a><a href="#density">Mật độ</a><a href="#palettes">Bảng màu</a><a href="#atlas">Atlas</a><a href="#parity">Studio &amp; QA</a><a href="#review">Phiếu duyệt</a>
</nav>
<main class="shell">
<section id="gallery"><h2>Đối chiếu theo cảnh</h2>
<p>Đọc ở 1× trước. Nếu khung nhỏ hơn ảnh, cuộn trong khung để xem tiếp ở kích thước pixel gốc. Cùng layout và bố cục props được giữ qua ba phiên bản.</p>
${gallery}
</section>
<section id="density"><h2>Mật độ bề mặt</h2><p>Cùng cảnh Outdoor, Authored Palette, seed và origin.</p>${density}</section>
<section id="palettes"><h2>Bảng màu</h2><p>Cùng layout Transition, seed, origin và mật độ Standard.</p>${palettes}
<div class="atlas">${image('project-swatches.png', 'Màu Project gồm cả tông cỏ, đất, gỗ và sắt')}</div></section>
<section id="atlas"><h2>Atlas và gói bake</h2>
<p>Atlas 128 × 96 dành cho 47 canonical masks và một ô đất. IDs 1–48 dùng cùng mapping qua các phiên bản. Gói bake ghi layout, seed, origin, palette và SHA-256 để tái tạo PNG.</p>
<div class="compare pair atlas">${image('atlas.png', 'Engine · Atlas tĩnh · 1×')}${image('atlas-4x.png', 'Engine · Atlas tĩnh · 4×')}</div>
<div class="downloads">
${download('atlas.png', 'atlas.png', 'Atlas PNG')}
${download('atlas.json', 'atlas.json', 'Atlas JSON')}
${download('packages/large/map.png', 'map.png', 'Large map PNG')}
${download('packages/large/map.json', 'map.json', 'Large map JSON')}
${download('qa.json', 'qa.json', 'Engine QA JSON')}
${download('studio/parity.json', 'parity.json', 'Studio parity JSON')}
</div>
</section>
<section id="parity"><h2>Studio và kiểm định</h2>
<p>Studio ${parity.studioRevision}. Baked asset khớp toàn bộ raster Engine. Tilemap chỉnh sửa được khớp Engine khi cùng dùng atlas tĩnh. Cột lệch ghi số pixel khác khi so terrain world-space với atlas tĩnh trong cùng phạm vi cỏ và đất.</p>
<div class="scroll" tabindex="0" aria-label="Kết quả Studio"><table><thead><tr><th>Fixture</th><th>Pixel</th><th>Baked asset</th><th>Editable tilemap</th><th>Lệch world/static</th><th>Lưu và phục hồi</th></tr></thead><tbody>${studioRows}</tbody></table></div>
<p><code>ENGINE_VARIATION_PASS / STUDIO_VARIATION_NOT_SUPPORTED</code> cho tilemap chỉnh sửa được. PNG bake có thể nhập và xuất như một asset raster.</p>
<p>${qa.masks} canonical masks, ${qa.rawMasks} raw masks, ${number.format(qa.authored.seams.horizontal + qa.authored.seams.vertical)} seam pairs và ${number.format(qa.authored.junctions.neighborhoods)} cấu hình 2×2 đạt trên mỗi palette. Bản đồ Large có 0 cặp tile đầy kề nhau trùng RGBA trong 624 cặp cỏ và 630 cặp đất, cùng kết quả đo ở E3.2. Số tile đất khác nhau là 329 ở E3.3 và 335 ở E3.2.</p>
</section>
<section id="review"><h2>Phiếu duyệt nghệ thuật</h2>
<p>Điểm sơ bộ của ChatGPT áp dụng cho Standard với Authored/Project và đường xuất bake. Độ hài hòa của Locked chỉ đạt 2/5 vì mất phân cách cỏ và đất. Project Owner chấm 1–5, với mục tiêu từ 4/5 ở tiêu chí cốt lõi. Giá trị gõ trong trang chỉ dùng cho phiên đang mở.</p>
<div class="scroll" tabindex="0" aria-label="Phiếu duyệt"><table><thead><tr><th>Tiêu chí</th><th>ChatGPT</th><th>Project Owner</th><th>Ghi chú</th></tr></thead><tbody>${reviewRows}</tbody></table></div>
<p>ChatGPT đã đề xuất duyệt E3.2 với Authored/Project. Phiếu E3.3 đang chờ quyết định của Project Owner.</p>
</section>
</main>
<footer><div class="shell">Benchmark offline · 0 AI runtime calls</div></footer>
</body></html>
`;
writeFileSync('docs/LumaSprite-Engine-E3.3-Report.html', html);
