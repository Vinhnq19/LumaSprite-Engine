import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = 'benchmarks/results/e34';
const read = (path: string) => readFileSync(join(root, path));
type Coverage = { tiles: number; painted: number; resting: number; micro: number; meso: number };
const qa = JSON.parse(read('qa.json').toString('utf8')) as {
  baselineCoverage: Record<string, Coverage>;
  candidates: { id: string; coverage: Record<string, Coverage> }[];
  straightInternalBoundaryTiles: Record<string, number>;
  organicRoad: { connectedDirtTiles: number };
};
const studio = JSON.parse(read('studio/parity.json').toString('utf8')) as {
  studioRevision: string;
  results: { scene: string; baked: string; editable: string; saveReopen: string; backupRestore: string }[];
};

function image(path: string, label: string, eager = false) {
  const bytes = read(path);
  return '<figure><figcaption>' + label + '</figcaption><div tabindex="0" class="image" aria-label="' + label +
    '"><img ' + (eager ? '' : 'loading="lazy" ') + 'width="' + bytes.readUInt32BE(16) + '" height="' + bytes.readUInt32BE(20) +
    '" alt="' + label + '" src="data:image/png;base64,' + bytes.toString('base64') + '"></div></figure>';
}
function download(path: string, name: string, label: string) {
  const mime = name.endsWith('.png') ? 'image/png' : 'application/json';
  return '<a class="download" download="' + name + '" href="data:' + mime + ';base64,' +
    read(path).toString('base64') + '">' + label + '</a>';
}

const scenes = [
  ['organic', 'Organic RPG Clearing', 'Đường uốn và ngã rẽ nối ba lối ra. Cùng đường đi và props qua cả ba ảnh.'],
  ['outdoor', 'Outdoor RPG', 'Giữ vị trí năm props E2.4 và traveler để so độ rõ trên cùng nền.'],
  ['large', 'Large Grass/Dirt', 'Các mảng rộng kiểm vùng nghỉ và nhịp lặp. Hình học benchmark giữ nguyên.'],
  ['stress', 'Transition Stress', 'Kiểm đường nối, góc lõm, góc lồi và các dải hẹp.'],
  ['storage', 'Dungeon / Storage', 'Mặt đất dưới tường CC0 với props E2.4. Giữ lối trống ở giữa.'],
];
const gallery = scenes.map(([id, title, desc]) => {
  const isNew = id === 'organic' || id === 'storage';
  const beforePath = isNew ? 'e33-' + id + '-1x.png' : '../e33/packages/' + id + '/map.png';
  const beforeZoom = isNew ? 'e33-' + id + '-4x.png' : '../e33/' + id + '-4x.png';
  const compare = (scale: 1 | 4) => '<div class="compare">' +
    image(scale === 1 ? beforePath : beforeZoom, 'E3.3 · Engine · ' + scale + '×') +
    image(scale === 1 ? 'packages/a-' + id + '/map.png' : 'a-' + id + '-4x.png', 'A · Conservative Polish · ' + scale + '×') +
    image(scale === 1 ? 'packages/b-' + id + '/map.png' : 'b-' + id + '-4x.png', 'B · Art-Directed Terrain · ' + scale + '×', id === 'organic' && scale === 1) + '</div>';
  return '<article id="' + id + '"><h3>' + title + '</h3><p>' + desc + '</p>' + compare(1) +
    '<details><summary>Xem cả ba phiên bản ở 4×</summary>' + compare(4) + '</details></article>';
}).join('\n');

function variants(group: string, choices: readonly string[]) {
  return (['a', 'b'] as const).map(id => '<article><h3>Candidate ' + id.toUpperCase() + '</h3><div class="compare">' +
    choices.map(name => {
      const stem = id + '-' + group + name.toLowerCase();
      return '<div>' + image(stem + '-1x.png', name + ' · 1×') +
        '<details><summary>Xem 4×</summary>' + image(stem + '-4x.png', name + ' · 4×') + '</details></div>';
    }).join('') + '</div></article>').join('');
}

const number = new Intl.NumberFormat('vi-VN');
const coverage = [['E3.3', qa.baselineCoverage], ...qa.candidates.map(c => [c.id.toUpperCase(), c.coverage] as const)] as const;
const clusterRows = coverage.flatMap(([name, byMaterial]) => Object.entries(byMaterial).map(([material, m]) =>
  '<tr><th scope="row">' + name + ' · ' + (material === 'grass' ? 'Cỏ' : 'Đất') + '</th><td>' + m.resting + '/' +
  m.tiles + '</td><td>' + number.format(m.painted) + '</td><td>' + m.micro + '</td><td>' + m.meso + '</td></tr>')).join('');
const parityRows = studio.results.map(r => '<tr><th scope="row">' + r.scene + '</th><td><code>' + r.baked +
  '</code></td><td><code>' + r.editable + '</code></td><td>' + r.saveReopen + '</td><td>' + r.backupRestore + '</td></tr>').join('');

const rubrics = [
  ['Texture cỏ', '3,5', '4', 'B gom lùm cỏ thành vùng, với khoảng nghỉ dài hơn.'],
  ['Texture đất', '3,5', '4', 'Mảng nén B rõ hơn. Ở 4× vẫn thấy vài dáng lặp.'],
  ['Độ tự nhiên của bờ', '4', '4', 'Cùng edge profile. Đường uốn và ngã rẽ đến từ layout.'],
  ['Nhịp lặp nhìn thấy', '3,5', '4', 'A phân bố đều hơn; B giảm cảm giác rải dấu ở 1×.'],
  ['Hài hòa bảng màu', '4', '4', 'Authored và Project giữ phân cách chất liệu.'],
  ['Độ rõ của props', '4', '4', 'Khoảng trống quanh props giúp silhouette dễ đọc.'],
  ['Độ rõ của bản đồ', '4', '4', 'Organic có ngã rẽ và ba lối ra đọc được ở 1×.'],
  ['Mức sẵn sàng đưa vào game', '4', '4', 'Điểm sơ bộ trong phạm vi baked raster đã kiểm thử.'],
];
const scoreRows = rubrics.map(([name, a, b, note]) =>
  '<tr><th scope="row">' + name + '</th><td>' + a + '</td><td>' + b + '</td><td class="note">' + note +
  '</td><td><input aria-label="Điểm A · ' + name + '" type="number" min="1" max="5"></td><td><input aria-label="Điểm B · ' +
  name + '" type="number" min="1" max="5"></td></tr>').join('');

const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LumaSprite Engine · E3.4 Terrain Art Review</title>
<style>
  :root { color-scheme:light; --paper:#f4f0e5; --ink:#212c22; --muted:#48584d; --line:#c7ccba; --forest:#20392f; --surface:#fcfaf2; --accent:#346145; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:1rem/1.6 system-ui,sans-serif; }
  .shell { width:min(calc(100% - 2rem),1460px); margin-inline:auto; }
  header { padding:clamp(2rem,6vw,4.8rem) 0 2.4rem; background:var(--forest); color:#f8f5ea; border-bottom:5px solid #ba9a61; }
  header p { max-width:69ch; margin:.75rem 0 0; color:#e2e9dc; }
  .project { margin-bottom:.85rem; font-weight:700; }
  h1,h2 { margin:0 0 1rem; font-family:Georgia,serif; line-height:1.05; font-weight:500; letter-spacing:-.02em; }
  h1 { font-size:clamp(2.7rem,7vw,5.4rem); }
  h2 { font-size:clamp(1.9rem,4.3vw,3.2rem); }
  h3 { margin:0 0 .35rem; line-height:1.25; }
  nav { display:flex; gap:.65rem 1.15rem; flex-wrap:wrap; padding:.9rem 0; border-bottom:1px solid var(--line); }
  a { color:var(--accent); font-weight:680; text-underline-offset:.2em; }
  main section { margin:clamp(2.6rem,6vw,4.8rem) 0; }
  p { margin:.45rem 0 .85rem; max-width:80ch; }
  article { padding:1.1rem; margin:1rem 0; background:var(--surface); border:1px solid var(--line); border-radius:.55rem; }
  .compare { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); align-items:start; gap:.9rem; }
  .pair { grid-template-columns:repeat(2,minmax(0,1fr)); }
  figure { margin:0; min-width:0; }
  figcaption { padding:.32rem 0; font-size:.9rem; font-weight:650; color:var(--muted); }
  .image { overflow:auto; max-height:500px; background:#e4e2d5; border:1px solid var(--line); border-radius:.25rem; }
  img { display:block; max-width:none; image-rendering:pixelated; }
  details { margin-top:.7rem; border-top:1px solid var(--line); }
  summary { cursor:pointer; color:var(--accent); font-weight:680; padding:.55rem 0; }
  .scroll { overflow:auto; border:1px solid var(--line); margin:1rem 0; }
  table { border-collapse:collapse; text-align:left; background:var(--surface); width:100%; }
  th,td { white-space:nowrap; padding:.6rem .7rem; border-bottom:1px solid var(--line); }
  th[scope=row] { text-align:left; }
  thead,footer { background:#e6ebdc; }
  .note { white-space:normal; min-width:13rem; }
  input { width:3.4rem; font:inherit; background:var(--surface); border:1px solid #71816c; border-radius:.25rem; padding:.2rem .3rem; }
  .downloads { display:flex; gap:.5rem; margin:1rem 0; flex-wrap:wrap; }
  .download { padding:.45rem .7rem; background:var(--surface); border-radius:.25rem; border:1px solid var(--line); }
  footer { padding:1.25rem 0; color:var(--muted); }
  code { overflow-wrap:anywhere; }
  :focus-visible { outline:3px solid #665822; outline-offset:3px; }
  @media(max-width:760px) { .compare,.pair { grid-template-columns:minmax(0,1fr); } article { padding:.8rem; } }
  @media print { nav,.downloads,details { display:none; } img { max-width:100%; height:auto; } .image { overflow:visible; max-height:none; } }
</style>
</head>
<body>
<header><div class="shell">
  <div class="project">LumaSprite Engine · E3.4</div>
  <h1>Duyệt mỹ thuật terrain</h1>
  <p>A và B xử lý cụm cỏ và đất với hai mức tập trung chi tiết. Bản đồ Organic dùng cùng hình học autotile để thử đường uốn, ngã rẽ và vùng nghỉ. Quyết định cuối thuộc Project Owner.</p>
</div></header>
<nav class="shell" aria-label="Mục lục"><a href="#gallery">Cảnh chơi</a><a href="#clusters">Cụm vật liệu</a><a href="#density">Mật độ</a><a href="#palette">Bảng màu</a><a href="#studio">Studio</a><a href="#review">Phiếu duyệt</a></nav>
<main class="shell">
<section id="gallery"><h2>Đối chiếu trong cảnh chơi</h2>
<p>Xem 1× trước. Có thể cuộn riêng trong khung ảnh để giữ nguyên kích thước pixel. Ba phiên bản dùng chung seed, origin, layout, palette Authored, mật độ Standard và props.</p>
${gallery}</section>
<section id="clusters"><h2>Cụm vật liệu</h2>
<p>A dùng mảng nhỏ và phân bố khá đều. B gom lùm cỏ và mảng đất nén vào vùng hoạt động, xen những vùng gần như trống. Macro thay đổi xác suất đặt cụm theo tọa độ; Micro thêm dấu nhỏ khi còn đủ chỗ. Hai bản giữ chung bờ E3.3.</p>
<p>Organic có ${qa.organicRoad.connectedDirtTiles} ô đất liên thông và ba lối ra. Đoạn biên thẳng nội bộ dài nhất là ${qa.straightInternalBoundaryTiles.organic} ô, so với ${qa.straightInternalBoundaryTiles.stress} ở Stress. Ngã rẽ, độ rộng thay đổi và hình dáng bãi cỏ giải thích khác biệt bố cục.</p>
<div class="scroll" tabindex="0" aria-label="Số đo cụm vật liệu"><table><thead><tr><th>Large · vùng thuần</th><th>Ô nghỉ / tổng</th><th>Pixel chi tiết</th><th>Cụm 1–4 px</th><th>Cụm 5–24 px</th></tr></thead><tbody>${clusterRows}</tbody></table></div>
<p>Cụm được đếm theo kết nối 4 hướng trên tile thuần cỏ hoặc thuần đất. Nhiều ô nghỉ giống nhau là chủ đích. Đánh giá nhịp nhìn bằng ảnh ở kích thước chơi.</p>
</section>
<section id="density"><h2>Mật độ trên Organic</h2><p>Giữ cùng layout và Authored Palette cho cả A và B.</p>${variants('', ['Sparse', 'Standard', 'Dense'])}</section>
<section id="palette"><h2>Bảng màu trên Transition Stress</h2><p>Authored và Project đạt FULL_RAMP. Locked bốn màu giữ nguyên và báo PALETTE_LIMITED vì cỏ và đất trùng tông giữa.</p>${variants('palette-', ['Authored', 'Project', 'Locked'])}</section>
<section id="studio"><h2>Studio và gói bake</h2><p>Studio ${studio.studioRevision}. Khớp RGBA cho ảnh bake và khớp atlas tĩnh cho tilemap chỉnh sửa được. World-space variation trên tilemap chỉnh sửa được thuộc E8.</p>
<div class="scroll" tabindex="0" aria-label="Kết quả tương thích Studio"><table><thead><tr><th>Fixture</th><th>Baked PNG</th><th>Editable tilemap</th><th>Lưu và mở lại</th><th>Phục hồi</th></tr></thead><tbody>${parityRows}</tbody></table></div>
<div class="compare pair">${image('studio/b-organic-baked-1x.png', 'Studio · Baked Organic · 1×')}${image('studio/b-organic-editable-1x.png', 'Studio · Editable atlas tĩnh · 1×')}</div>
<p>47 canonical masks, 256 raw masks, 8.192 cặp seam và 65.536 cấu hình 2×2 cho từng ứng viên và palette. Gói bake lưu seed, origin, layout cùng hash để Engine tái tạo.</p>
<div class="downloads">
${download('packages/a-organic/map.png', 'organic-a.png', 'Organic A PNG')}
${download('packages/b-organic/map.png', 'organic-b.png', 'Organic B PNG')}
${download('packages/b-organic/atlas.png', 'atlas-b.png', 'Atlas B PNG')}
${download('packages/b-organic/atlas.json', 'atlas-b.json', 'Atlas B JSON')}
${download('qa.json', 'qa-e34.json', 'Engine QA JSON')}
${download('studio/parity.json', 'parity-e34.json', 'Studio parity JSON')}
</div></section>
<section id="review"><h2>Phiếu duyệt của Project Owner</h2>
<p>Điểm A/B bên dưới là đánh giá sơ bộ của ChatGPT cho Standard và Authored/Project. Nên mở B trước ở 1× để kiểm vùng nghỉ và độ rõ của props, rồi chấm cả hai. Mục tiêu là từ 4/5 ở các tiêu chí cốt lõi. Điểm nhập chỉ tồn tại trong phiên mở trang.</p>
<div class="scroll" tabindex="0" aria-label="Phiếu chấm nghệ thuật"><table><thead><tr><th>Tiêu chí</th><th>Sơ bộ A</th><th>Sơ bộ B</th><th>Quan sát</th><th>Owner A</th><th>Owner B</th></tr></thead><tbody>${scoreRows}</tbody></table></div>
<p>E3.3 đã được duyệt kỹ thuật và bake raster. Project Owner yêu cầu E3.4 để duyệt lại mỹ thuật. E3 tiếp tục chờ quyết định cuối.</p>
</section>
</main>
<footer><div class="shell">LumaSprite Engine · QA offline · 0 AI runtime calls</div></footer>
</body>
</html>
`;
writeFileSync('docs/LumaSprite-Engine-E3.4-Report.html', html);
