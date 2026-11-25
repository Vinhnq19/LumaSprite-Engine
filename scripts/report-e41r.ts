import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { characterReview } from '../src/generators/character/export.ts';

type Geometry = ReturnType<typeof characterReview>['metadata'];
const roster = [
  ['a', 'e41', 'Dáng đối chứng gọn, đèn cầm thấp.'],
  ['b', 'e41', 'Dáng gốc dùng để tinh chỉnh, chân xa cao hơn.'],
  ['b1', 'e41r', 'Dáng đứng với hai đế giày chạm đất ở hai hàng chiếu theo độ sâu.'],
  ['b2', 'e41r', 'Dáng bước tới với hông dịch trước, chân dẫn đang nhấc.'],
] as const;
const source = (edition: string, path: string) => readFileSync(join('benchmarks/results', edition, path));
const candidates = roster.map(([id, edition, note]) => ({
  id, edition, note, ...JSON.parse(source(edition, id + '/geometry.json').toString('utf8')) as Geometry,
}));

function figure(edition: string, path: string, caption: string, scene = false) {
  const png = source(edition, path);
  return '<figure><figcaption>' + caption + '</figcaption><div class="frame' + (scene ? ' scene' : '') +
    '" tabindex="0" aria-label="' + caption + '"><img width="' + png.readUInt32BE(16) +
    '" height="' + png.readUInt32BE(20) + '" alt="' + caption + '" src="data:image/png;base64,' +
    png.toString('base64') + '"></div></figure>';
}

const native = candidates.map(({ id, edition, spec, note, diagnostics }) => {
  const name = id.toUpperCase();
  const pair = (paths: string[], captions: string[]) => '<div class="pair context">' +
    paths.map((path, i) => figure(edition, path, name + ' · ' + captions[i])).join('') + '</div>';
  return '<article><h3>' + name + ' · ' + spec.name + '</h3><p>' + note + '</p><p class="measure">CharacterSpec v' +
    spec.version + ' · ' + (diagnostics.bounds.bottom - diagnostics.bounds.top + 1) +
    ' px · pivot (' + spec.pose.pivot.join(', ') + ')</p>' +
    pair([id + '/silhouette.png', id + '/flat.png'], ['Silhouette 1×', 'Màu phẳng 1×']) +
    '<details><summary>Silhouette và khớp 4×</summary>' +
    pair([id + '-silhouette-4x.png', id + '-landmarks-4x.png'], ['Silhouette 4×', 'Landmark 4×']) + '</details>' +
    '<details><summary>Cận cảnh tay và chân 6×</summary>' +
    pair([id + '-grip-6x.png', id + '-stance-6x.png'], ['Bàn tay và quai đèn 6×', 'Chân và đế giày 6×']) + '</details></article>';
}).join('\n');

const scenes = candidates.map(({ id, edition, spec }) =>
  figure(edition, id + '-scene-1x.png', id.toUpperCase() + ' · ' + spec.name + ' · 1×', true)).join('\n');
const metrics = candidates.map(({ id, spec, diagnostics: d }) => {
  const pose = d.pose;
  const foot = (side: 'near' | 'far') => pose
    ? (pose.feet[side].clearance ? 'Hở ' + pose.feet[side].clearance + ' px' : 'Chạm') + ' · y ' + pose.feet[side].projectedGroundY
    : side === spec.pose.support ? 'Chân trụ' : 'Chân phụ nâng';
  return '<tr><th scope="row">' + id.toUpperCase() + '</th><td>' + d.bounds.top +
    ' px</td><td>' + foot('near') + '</td><td>' + foot('far') + '</td><td>' + d.gripPixels +
    '</td><td>' + (pose?.openHandleRows ?? '—') + '</td><td>' + d.maxGap + ' px</td><td>' + spec.pose.pivot.join(', ') + '</td></tr>';
}).join('');
const downloads = ['b1-spec.json', 'b2-spec.json', 'b1/geometry.json', 'b2/geometry.json', 'qa.json'].map(path => {
  const name = path.replace('/', '-');
  return '<a class="download" download="' + name + '" href="data:application/json;base64,' +
    source('e41r', path).toString('base64') + '">' + name + '</a>';
}).join('');
const criteria = [
  'Tỷ lệ đầu và thân', 'Độ rõ silhouette', 'Hướng nhìn 3/4', 'Phân bố trọng lượng', 'Gối và khuỷu tay',
  'Bàn tay và quai đèn', 'Khoảng hở giữa các khối', 'Tỷ lệ trong cảnh game', 'Sức thuyết phục của dáng',
];
const scoreRows = criteria.map(criterion => '<tr><th scope="row">' + criterion + '</th>' +
  ['B1', 'B2'].map(id => '<td><input type="number" min="1" max="5" aria-label="' + id + ' · ' + criterion + '"></td>').join('') + '</tr>').join('');

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>LumaSprite Engine · E4.1R Silhouette Review</title>
<style>
  :root { color-scheme:light; --paper:#f5f0e5; --panel:#fffaf0; --ink:#222d28; --forest:#243c35; --muted:#4a594c; --line:#c8cbbd; --accent:#335f46; }
  * { box-sizing:border-box; }
  body { margin:0; color:var(--ink); background:var(--paper); font:1rem/1.55 system-ui,sans-serif; }
  .shell { width:min(calc(100% - 2rem),1220px); margin-inline:auto; }
  .masthead { background:var(--forest); color:#fff8e9; border-bottom:5px solid #ba9761; padding:clamp(2.2rem,6vw,4.6rem) 0 2.4rem; }
  .masthead p { color:#e5ecdf; }
  .project { font-weight:700; margin-bottom:.85rem; }
  h1,h2 { font:500 clamp(2rem,5vw,3.2rem)/1.05 Georgia,serif; letter-spacing:-.024em; margin:0 0 .85rem; }
  h1 { font-size:clamp(2.9rem,8vw,5.5rem); } h3 { margin:0 0 .4rem; line-height:1.2; }
  p { margin:.45rem 0 .8rem; max-width:78ch; }
  nav { display:flex; flex-wrap:wrap; gap:.45rem 1.15rem; padding:.8rem 0; border-bottom:1px solid var(--line); }
  a { color:var(--accent); font-weight:680; text-underline-offset:.2em; }
  section { margin:clamp(2.4rem,7vw,4.6rem) 0; }
  .pair { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.85rem; align-items:start; }
  article { background:var(--panel); border:1px solid var(--line); border-radius:.45rem; padding:1.05rem; }
  .measure,figcaption { color:var(--muted); font-size:.87rem; }
  figure { margin:0; min-width:0; }
  figcaption { font-weight:650; padding:.38rem 0; }
  .frame { overflow:auto; padding:12px; border:1px solid var(--line); border-radius:.25rem; background:repeating-conic-gradient(#e0e6d9 0 25%, #f1eee4 0 50%) 0 0 / 16px 16px; }
  .frame.scene { padding:0; background:#68864c; }
  img { display:block; margin-inline:auto; max-width:none; image-rendering:pixelated; }
  details { margin-top:.65rem; border-top:1px solid var(--line); }
  summary { cursor:pointer; padding:.55rem 0; color:var(--accent); font-weight:680; }
  .scroll { overflow:auto; border:1px solid var(--line); margin:1rem 0; }
  table { width:100%; border-collapse:collapse; background:var(--panel); text-align:left; }
  th,td { padding:.57rem .7rem; white-space:nowrap; border-bottom:1px solid var(--line); }
  thead,footer { background:#e7ebdd; }
  .downloads { display:flex; flex-wrap:wrap; gap:.55rem; margin:.85rem 0; }
  .download { border:1px solid var(--line); padding:.38rem .65rem; border-radius:.25rem; background:var(--panel); }
  input { width:3.2rem; border:1px solid #71816c; border-radius:.2rem; padding:.25rem; font:inherit; }
  footer { padding:1.25rem 0; color:var(--muted); }
  :focus-visible { outline:3px solid #6b5821; outline-offset:3px; }
  @media(max-width:900px) { .gallery { grid-template-columns:minmax(0,1fr); } }
  @media(max-width:520px) { details .context { grid-template-columns:minmax(0,1fr); } article { padding:.85rem; } }
  @media print { nav,details,.downloads { display:none; } .frame { overflow:visible; } img { max-width:100%; height:auto; } }
</style></head><body>
<header class="masthead"><div class="shell"><div class="project">LumaSprite Engine · E4.1R</div>
<h1>Duyệt dáng Field Surveyor</h1><p>B1 và B2 dùng chung hình khối 64×64. B1 dành cho dáng đứng, B2 dành cho dáng bước. A và B là hai bản đối chứng E4.1.</p>
</div></header>
<nav class="shell" aria-label="Mục lục"><a href="#silhouettes">Silhouette</a><a href="#scene">Cảnh 1×</a><a href="#measure">Kiểm định</a><a href="#review">Phiếu duyệt</a></nav>
<main class="shell">
<section id="silhouettes"><h2>So sánh ở 1×</h2><p>Xem dáng và mảng màu phẳng trước khi mở 4×. Đường xanh đánh dấu khớp phía gần, tím đánh dấu phía xa và đường đất chiếu tương ứng, vàng đánh dấu điểm cầm đèn và pivot.</p>
<div class="pair gallery">${native}</div></section>
<section id="scene"><h2>Organic RPG Clearing · 1×</h2><p>Cùng palette, terrain E3.4, props E2 và vị trí đặt pivot. Cuộn trong khung nếu màn hình hẹp.</p>
<div class="pair gallery">${scenes}</div></section>
<section id="measure"><h2>Đo trên raster</h2><p>Cả B1 và B2 đạt <code>STRUCTURAL_VALID</code> và <code>POSE_CONSTRAINTS_VALID</code>. Trạng thái duyệt hình dáng là <code>VISUAL_REVIEW_PENDING</code>.</p>
<div class="scroll" tabindex="0" aria-label="Chỉ số hình học"><table><thead><tr><th>Mẫu</th><th>Khoảng trống trên đầu</th><th>Đế gần</th><th>Đế xa</th><th>Pixel tay chạm quai</th><th>Hàng thông qua quai</th><th>Khe chân lớn nhất</th><th>Ground pivot</th></tr></thead><tbody>${metrics}</tbody></table></div>
<p>B1 đặt cả hai đế trên mặt đất chiếu và giữ trọng tâm thân trong vệt đế gần. B2 có khoảng hở chủ ý ở chân dẫn. Kiểm định đo tiếp xúc và khoảng alpha trong raster; người duyệt đánh giá độ tự nhiên.</p><div class="downloads">${downloads}</div></section>
<section id="review"><h2>Phiếu duyệt silhouette</h2><p>Đề xuất duyệt B1 trước cho dáng đứng. Chấm ở 1× với mục tiêu từ 4/5 cho tiêu chí trọng yếu. Điểm nhập chỉ dùng trong phiên mở trang.</p>
<div class="scroll" tabindex="0" aria-label="Phiếu duyệt"><table><thead><tr><th>Tiêu chí</th><th>B1</th><th>B2</th></tr></thead><tbody>${scoreRows}</tbody></table></div>
<p>Quyết định silhouette thuộc Project Owner. E4.2 bắt đầu sau lựa chọn đó.</p></section></main>
<footer><div class="shell">LumaSprite Engine · Kiểm thử offline · 0 AI runtime calls</div></footer>
</body></html>
`;
writeFileSync('docs/LumaSprite-Engine-E4.1R-Report.html', html);
