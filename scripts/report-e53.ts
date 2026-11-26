import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pack } from '../src/core/palette/colors.ts';
import { makeRaster, put } from '../src/core/pixels/raster.ts';
import { decodePng, encodePng } from '../src/core/renderer/png.ts';
import type { Point } from '../src/core/geometry/shapes.ts';
import { sha256 } from '../src/quality/raster.ts';
import { crop } from '../research/open-source/art-quality/common.ts';
import type { WalkReview, WalkTiming } from './benchmark-e53.ts';
import type { ColorReview } from './e53-color.ts';
import { output, readJson } from './e53-common.ts';

const get = (file: string) => readFileSync(join(output, file));
const read = <T,>(file: string) => readJson<T>(join(output, file));
const qa = read<WalkReview>('walk-qa.json');
const leather = read<ColorReview>('leather/qa.json');
const ids = ['w2', 'ik', 'hybrid', 'courier'] as const;
const labels = { w2: 'W2 Expressive Walk', ik: 'W2-IK', hybrid: 'W2-Hybrid', courier: 'Forest Courier Walk' };
const uri = (bytes: Buffer, mime: string) => 'data:' + mime + ';base64,' + bytes.toString('base64');
const png = (file: string) => uri(get(file), 'image/png');
const actors = ids.map(id => {
  const idle = id === 'courier' ? 'idle-courier' : 'idle-surveyor';
  return { id, walk: read<WalkTiming>(id + '/timing.json'), bridgeMs: 110,
    idle: { timing: read('scenes/' + idle + '.json'), image: png('scenes/' + idle + '.png') },
    images: { strip: png(id + '/strip.png'), bridge: png(id + '/bridge.png'), marks: png(id + '/marks.png') } };
});
const scenes = (['outdoor', 'dungeon'] as const).map(id => {
  const base = decodePng(get('scenes/' + id + '.png'));
  const reviewAt = id === 'outdoor' ? [184, 96] : [97, 50];
  const stage = id === 'outdoor' ? crop(base, 64, 52, 320, 176) : base;
  return { id, stage: uri(encodePng(stage), 'image/png'),
    review: uri(encodePng(crop(base, reviewAt[0], reviewAt[1], 144, 80)), 'image/png'),
    anchor: [56, 62], tracks: id === 'outdoor' ? [[38, 92], [77, 163]] : [[38, 110], [79, 151]] };
});
const player = readFileSync('scripts/e53-player.js', 'utf8').replaceAll('\r\n', '\n');
const playbackData = JSON.stringify({ actors, scenes });
const proofFile = 'docs/e53-runtime-proof.json';
const proof = existsSync(proofFile) ? readJson<{ playerSha256: string; mediaSha256: string }>(proofFile) : null;
const reviewProof = proof?.playerSha256 === sha256(player) && proof.mediaSha256 === sha256(playbackData) ? readFileSync(proofFile) : null;
const status = 'E5_3_READY_FOR_HUMAN_QUALITY_REVIEW';
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const styles = readFileSync('research/open-source/art-quality/report.css', 'utf8') + `
header {padding: 2.5rem 0 1.25rem}
h1 {max-width: 21ch; font-size: clamp(2.2rem, 6vw, 4.8rem)}
.panels {display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,158px),1fr));gap:8px}
.panels.zoom {grid-template-columns:repeat(auto-fit,minmax(min(100%,266px),1fr))}
.panels figure {overflow:auto}
.panels output {text-align:center;font-size:.86rem;color:var(--muted)}
.stage {display:grid;justify-items:center;overflow:auto;margin:0;background:var(--picture);border:1px solid var(--border);padding:.3rem 0}
.stage canvas {display:block;image-rendering:pixelated}
.art.exact img {max-width:none}
.art.exact {overflow:auto;justify-items:start}
.art.exact figcaption {padding-left:.55rem}
.toggle {display:flex!important;align-items:center;min-height:44px}
`;
const shell = (title: string, nav: string, main: string) => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${styles}</style></head>
<body><header><div class="wrap"><p class="eyebrow">LumaSprite Engine · E5.3</p><h1>${esc(title)}</h1></div></header>
<nav aria-label="Điều hướng"><div class="wrap">${nav}</div></nav>
<main class="wrap"><p id="load-error" role="alert"></p>${main}</main>
<script type="application/json" id="playback-data">${playbackData}</script>
<script>${player}</script></body></html>`;
const table = (headers: string[], rows: (string | number)[][]) => '<div class="scroll" tabindex="0"><table><thead><tr>' +
  headers.map(h => '<th scope="col">' + h + '</th>').join('') + '</tr></thead><tbody>' +
  rows.map(row => '<tr>' + row.map((cell, i) => '<' + (i === 0 ? 'th scope="row"' : 'td') + '>' + cell + (i === 0 ? '</th>' : '</td>')).join('') +
  '</tr>').join('') + '</tbody></table></div>';
const download = (file: string, fileName = file.split('/').at(-1)!, bytes = get(file)) =>
  '<a download="' + fileName + '" href="' + uri(bytes, fileName.endsWith('.png') ? 'image/png' : 'application/json') + '">' + esc(fileName) + '</a>';
const figure = (src: string, label: string, w: number, h: number, exact = false) =>
  '<figure class="art' + (exact ? ' exact' : '') + '"><img src="' + src + '" width="' + w + '" height="' + h +
  '" alt="' + esc(label) + '" loading="lazy"><figcaption>' + esc(label) + '</figcaption></figure>';
const chip = (ink: string) => '<i style="--sample:' + ink + '" aria-hidden="true"></i>';
const palette = (colors: string[]) => '<div class="swatches">' + colors.map(ink => '<span>' + chip(ink) + ' ' + ink + '</span>').join('') + '</div>';
const playButtons = (controls: [string, string][]) => controls.map(([id, label], i) =>
  '<button type="button" class="' + (i === 0 ? 'primary' : '') + '" data-run="' + id + '" disabled>' + label + '</button>').join('');
const galleryPlayer = (ids: readonly (keyof typeof labels)[], first: string) => `<div class="viewer" data-actors="${ids.join(' ')}">
  <div class="controls">
  <label>Chế độ xem <select>${[['sprite','Sprite 1×'],['outdoor','Outdoor RPG 1×'],['dungeon','Dark Dungeon 1×'],['zoom','Nearest-neighbor 4×'],['marks','Khớp / chân trụ 4×']].map(([id, name]) =>
    '<option value="' + id + '"' + (id === first ? ' selected' : '') + '>' + name + '</option>').join('')}</select></label>
  ${playButtons([['loop','Phát vòng'],['journey','Idle → Walk → Idle'],['pause','Tạm dừng']])}
  <label class="frame">Khung hình <input type="range" min="0" max="7" step="1" value="0"></label>
  </div><div class="panels">${ids.map(id => '<figure class="art" data-clip="' + id + '"><canvas width="144" height="80" aria-label="' +
    labels[id] + '"></canvas><figcaption>' + labels[id] + '</figcaption><output>Đang nạp</output></figure>').join('')}</div></div>`;
const gameLink = '<a href="LumaSprite-Engine-E5.3-Runtime.html">Mở runtime harness</a>';
const gate = '<p class="status">' + status + '</p>';

function rubric(id: string, columns: string[], criteria: string[]) {
  const rating = (metric: string, column: string) => '<select name="' + esc(column + ' · ' + metric) + '" aria-label="' + esc(metric + ' · ' + column) +
    '"><option value="">—</option>' + [1,2,3,4,5].map(n => '<option>' + n + '</option>').join('') + '</select>';
  return '<details><summary>Phiếu chấm độc lập</summary><p>Chấm ở 1×. Mức 1 khó đọc, 3 dùng được, 5 rõ và nhất quán.</p>' +
    '<form class="score" data-rubric="' + id + '">' + table(['Tiêu chí', ...columns], criteria.map(item => [
      item, ...columns.map(column => rating(item, column)),
    ])) + '<label>Quyết định <select name="decision"><option value="">Đang chờ</option><option>Accept</option><option>Reject</option></select></label>' +
    '<label>Nhận xét<textarea name="notes" rows="3"></textarea></label><button type="submit">Tải phiếu JSON</button></form></details>';
}
const motionCriteria = ['Đọc chuyển động', 'Trọng lượng', 'Chân trụ', 'Gối và hông', 'Đánh tay', 'Đạo cụ', 'Cụm pixel',
  'Vòng lặp', 'Đọc trong game', 'Cảm nhận tổng thể'];

function plot(clip: WalkReview['clips'][number], axis: 0 | 1) {
  const w = 190, h = 106;
  const raster = makeRaster(w, h);
  function line([x1, y1]: Point, [x2, y2]: Point, ink: number) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    for (let i = 0; i <= steps; i++) put(raster, Math.round(x1 + (x2 - x1) * i / steps), Math.round(y1 + (y2 - y1) * i / steps), ink);
  }
  const x = (i: number) => 10 + i * 21;
  for (const y of [10, 68, 100]) line([10, y], [178, y], pack('#3b5149'));
  const y = (value: number) => 10 + (value - (axis === 0 ? 22 : 35)) * 4;
  const series: { color: string; points: Point[] }[] = [
    { color: '#a1e8c7', points: clip.samples.map((f, i) => [x(i), y(f.hip[axis])]) },
    { color: '#83baff', points: clip.samples.map((f, i) => [x(i), y(f.legs.near.knee[axis])]) },
    { color: '#d6a5ed', points: clip.samples.map((f, i) => [x(i), y(f.legs.far.knee[axis])]) },
  ];
  if (axis === 1) series.push({ color: '#ffbc70', points: [...clip.samples.map(f => f.rootX), clip.root.cyclePx].map((root, i) =>
    [x(i), 100 - Math.round(root * .8)]) });
  for (const { color, points } of series) {
    const ink = pack(color);
    for (const [i, point] of points.entries()) {
      const [px, py] = point;
      if (i) {
        const [priorX, priorY] = points[i - 1];
        if (color === '#ffbc70') {
          line([priorX, priorY], [px, priorY], ink);
          line([px, priorY], [px, py], ink);
        } else line(points[i - 1], point, ink);
      }
      line([px - 1, py], [px + 1, py], ink);
    }
  }
  return figure(uri(encodePng(raster), 'image/png'), labels[clip.id as keyof typeof labels] + ' · ' + (axis === 0 ? 'X' : 'Y') + ' · khung 1–8', w, h);
}
const rootRows = qa.clips.map(c => [
  labels[c.id as keyof typeof labels], c.totalMs, c.root.cyclePx, c.plantedPairs + ' cặp · 0 px',
  c.kneeMean + '° / ' + c.kneeMax + '°', c.wrapKnees.join('° / ') + '°', c.alphaMax,
]);
const leatherViews = [['','Nền neutral',64,64],['-outdoor','Outdoor RPG',144,80],['-dungeon','Dark Dungeon',144,80]] as const;
const leatherGallery = leatherViews.map(([id, label, w, h]) => `<h3>${label}</h3>
<div class="compare native">${['original','localized'].map((variant,i) =>
  figure(png('leather/' + variant + id + '.png'), ['Courier gốc','Localized'][i] + ' · 1×', w, h)).join('')}</div>
<details><summary>Xem ${label} 4×</summary><div class="subgrid">${['original','localized'].map((variant,i) =>
  figure(png('leather/' + variant + id + '-4x.png'), ['Courier gốc','Localized'][i] + ' · 4×', w*4,h*4,true)).join('')}</div></details>`).join('');
const dataLinks = (names: string[]) => '<p class="downloads">' + names.map(name => download(name)).join('') + '</p>';
const diagnostics = leather.baseline.map(asset => `<details><summary>${esc(asset.name)} · ramp và cảnh báo</summary>${table(
  ['Vật liệu','Ramp nguồn','OKLCH L / C / h°','Thứ tự sáng'],
  asset.ramps.map(r => [r.role, palette(r.colors), r.oklch.map((v, i) => v.join(' / ') + (r.used[i] ? '' : ' (vắng)')).join('<br>'),
    r.compressed ? 'Ramp bị nén' : r.ascending ? 'Tăng dần' : 'Đảo thứ tự']),
)}${table(['Cặp','ΔL midtone','ΔE midtone','Va chạm / gần','Cảnh báo'],asset.pairs.map(p => [
  p.a + ' / ' + p.b, p.mid.deltaL, p.mid.deltaE, p.exact + ' / ' + p.near, p.warnings.join(', ') || '—',
]))}</details>`).join('');

const gallery = shell('Art-Directed Animation Quality', '<a href="#ab">So sánh</a><a href="#courier">Courier</a><a href="#color">Màu</a><a href="#qa">QA</a>' + gameLink, `
<p class="lede">Duyệt từng vòng ở 1× ngoài trời và trong hầm tối. Chấm chuyển trọng lượng, chân trụ và độ rõ của đèn trước khi mở số đo.</p>
${gate}
<section id="ab"><h2>W2, W2-IK và W2-Hybrid</h2>
<p>Cùng R2 + M2P, 64×64, 8 khung, 880 ms, 32 px mỗi vòng và hai cảnh. W2-Hybrid giữ hip, shoulder, grip và các đích chân của W2. Chỉ gối chân vung ở hai pose passing dịch trái 1 px.</p>
${galleryPlayer(['w2','ik','hybrid'],'outdoor')}
<p class="captions">${chip('#ffbc70')} Chân trụ ${chip('#83baff')} Chân vung. Chọn overlay 4× khi cần soi tiếp đất.</p>
${rubric('surveyor-walk',['W2','W2-IK','W2-Hybrid'],motionCriteria)}
<details><summary>Mở số đo gối, hông và root</summary>
<p class="captions">${chip('#a1e8c7')} Hông ${chip('#83baff')} Gối gần ${chip('#d6a5ed')} Gối xa ${chip('#ffbc70')} Root X tích lũy theo khung</p>
<h3>Tọa độ X của khớp</h3>
<div class="compare native">${qa.clips.map(clip => plot(clip, 0)).join('')}</div>
<h3>Tọa độ Y của khớp và root X</h3>
<div class="compare native">${qa.clips.map(clip => plot(clip, 1)).join('')}</div>
${table(['Clip','ms vòng','px/vòng','Chân trụ','Δ góc TB / max','Qua wrap gần / xa','Δ alpha max'],rootRows)}
<p>World contact = điểm trên canvas + root frame. Ở wrap, cộng thêm cả stride 32 hoặc 24 px. Dữ liệu trace đầy đủ có tọa độ X/Y, dịch chuyển part và kiểm paint ổn định theo từng frame.</p>
</details>
<p class="narrow">W2-Hybrid giữ nguyên wrap của W2. Dữ liệu giảm bước gối tối đa nhưng khác biệt hình ảnh nhỏ và cần Project Owner duyệt. W2 tiếp tục là lựa chọn production.</p>
<p class="downloads">${download('hybrid/package/spritesheet.png','w2-hybrid-strip.png')}${download('hybrid/timing.json','w2-hybrid-timing.json',Buffer.from(JSON.stringify({...actors[2].walk,image:'w2-hybrid-strip.png'},null,2)))}${download('hybrid/package/animation-spec.json','w2-hybrid-animation-spec.json')}${download('walk-qa.json')}</p>
</section>
<section id="courier"><h2>Forest Courier Walk</h2>
<p>Courier dùng CharacterSpec v3, proportions và outfit E4.4, bộ solver walk hiện có và cùng pipeline material/package. Spec <code>walk-free</code> dùng hai tay không, bước 12 px và 960 ms một vòng. Hai pha passing có đích riêng để giữ gối tự nhiên trong độ sâu chân gần và xa.</p>
${galleryPlayer(['courier'],'dungeon')}
<p>Túi và dây đeo vẫn nối qua toàn bộ vòng. Cảnh chuyển tiếp dùng pose đứng E4.4 làm idle của Courier. Surveyor dùng animation E5.1.</p>
${rubric('courier-walk',['Courier Walk'],motionCriteria)}
<p class="downloads">${download('courier/package/spritesheet.png','courier-walk-strip.png')}${download('courier/timing.json','courier-walk-timing.json',Buffer.from(JSON.stringify({...actors[3].walk,image:'courier-walk-strip.png'},null,2)))}${download('courier/package/animation-spec.json','courier-walk-animation-spec.json')}</p>
</section>
<section id="color"><h2>Palette diagnostics và da Courier</h2>
<p>Phép đo OKLab opt-in đánh giá ΔL, ΔE và va chạm giữa ramp. Candidate <code>Courier-Leather-Localized</code> giới hạn vào part satchel và strap đang nhìn thấy. Đã đổi ${leather.changed.satchel} pixel túi và ${leather.changed.strap} pixel dây. Cả ${leather.bootPixels} pixel có chủ sở hữu boot và alpha được đối chiếu với gốc.</p>
${leatherGallery}
${rubric('courier-leather',['Courier gốc','Courier-Leather-Localized'],
  ['Silhouette','Tỷ lệ','Tách vật liệu','Thứ tự sáng tối','Cụm pixel','Hài hòa màu','Đọc trong hầm','Đọc ở gameplay scale'])}
${table(['Vùng / đối chiếu','ΔL gốc → thử','ΔE gốc → thử'], leather.measurements.map(row => [
  String(row.part) + ' / ' + String(row.role), row.before.mid.deltaL + ' → ' + row.after.mid.deltaL, row.before.mid.deltaE + ' → ' + row.after.mid.deltaE,
]))}
<p>Da gốc</p>${palette(leather.referenceLeather)}<p>Túi / dây</p>
${palette(leather.recommendedPaletteCandidates.satchel)}${palette(leather.recommendedPaletteCandidates.strap)}
${diagnostics}
${dataLinks(['leather/qa.json','leather/localized.png'])}
</section>
<section id="qa"><h2>QA và quyết định</h2>
<p>${gameLink} chạy PNG và timing thật ở Canvas với camera cố định, Idle → Walk năm vòng → Idle cho hai nhân vật. ${reviewProof ? '<strong>BROWSER_RUNTIME_PASS</strong> · <strong>UNITY_RUNTIME_NOT_TESTED</strong>.' : 'Đang chờ thu bằng chứng trình duyệt.'}</p>
${reviewProof ? '<div class="compare">' + ['outdoor','dungeon'].map((scene, i) =>
  figure(uri(readFileSync('docs/e53-runtime-' + scene + '.png'), 'image/png'), ['Runtime Outdoor · W2 và Courier','Runtime Dungeon · Hybrid và Courier'][i], 320, 176)).join('') + '</div>' : ''}
<p>Kiểm tra frame, root, contact, PNG/RGBA, các gói cũ và tái tạo R&D được mô tả trong hồ sơ kỹ thuật. Duyệt độc lập là cổng lựa chọn W2-Hybrid và da Courier. Surveyor-3Q kết thúc ở trạng thái REJECTED_FOR_INTEGRATION. OKLab/OKLCH giữ trạng thái DIAGNOSTICS_CANDIDATE.</p>
<p class="downloads">${reviewProof ? download('e53-runtime-proof.json','e53-runtime-proof.json',reviewProof) : ''}<a href="e53-quality-review.md">Báo cáo kỹ thuật, quyết định R&D và PR summary</a><a href="../HANDOFF.md">HANDOFF</a></p>
</section>`);
const runtime = shell('Runtime playback · Camera cố định', '<a href="LumaSprite-Engine-E5.3-Report.html">So sánh mỹ thuật</a><a href="#runtime">Chạy cảnh</a>', `
<p class="lede">Hai nhân vật trên cảnh E3 với props E2. Root X tích lũy qua năm vòng theo đúng khung metadata. Chọn điểm chân trụ để quan sát neo chân trong world space.</p>
<section id="runtime" class="viewer">
<h2>Idle → Walk → Idle</h2>
<div class="controls">
<label>Cảnh <select id="environment"><option value="outdoor">Outdoor RPG</option><option value="dungeon">Dark Dungeon</option></select></label>
<label>Clip Surveyor <select id="surveyor-clip"><option value="w2">W2 Expressive Walk</option><option value="hybrid">W2-Hybrid</option><option value="ik">W2-IK</option></select></label>
<label class="toggle"><input type="checkbox" id="show-contact"> Hiện điểm chân trụ</label>
${playButtons([['journey','Chạy cảnh'],['pause','Tạm dừng'],['reset','Về đầu']])}
</div>
<div class="stage"><canvas width="320" height="176" aria-label="Cảnh runtime của Surveyor và Courier ở 1×"></canvas></div>
<div class="cards"><div class="card"><strong>Surveyor</strong><br><output>Đang nạp</output></div><div class="card"><strong>Forest Courier</strong><br><output>Đang nạp</output></div></div>
<p class="captions">${chip('#ffbc70')} Chân trụ ${chip('#83baff')} Chân vung ${chip('#a1e8c7')} Root X</p>
</section>
<p>${reviewProof ? '<strong>BROWSER_RUNTIME_PASS</strong> · <strong>UNITY_RUNTIME_NOT_TESTED</strong> ' + download('e53-runtime-proof.json','e53-runtime-proof.json',reviewProof) : 'Đang chờ thu bằng chứng trình duyệt.'}</p>`);
writeFileSync('docs/LumaSprite-Engine-E5.3-Report.html', gallery);
writeFileSync('docs/LumaSprite-Engine-E5.3-Runtime.html', runtime);
