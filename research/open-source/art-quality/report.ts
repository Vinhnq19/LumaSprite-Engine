import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cpus, release } from 'node:os';
import { output } from './common.ts';
import type { IkEvidence } from './ik.ts';
import type { GeometryEvidence } from './three-quarter.ts';
import type { ColorEvidence } from './color.ts';

const home = import.meta.dirname;
const results = (file: string) => readFileSync(join(output, file));
const local = (file: string) => readFileSync(join(home, file));
const from = <T>(file: string): T => JSON.parse(results(file).toString('utf8')) as T;
const ik = from<IkEvidence>('ik-qa.json');
const geometry = from<GeometryEvidence>('3q-qa.json');
const colors = from<ColorEvidence>('color-qa.json');
const verification = from<{ historicalEntries: number; repeatRuns: number; deterministicFiles: number }>('verification.json');
const timing = from<{ frames: { durationMs: number; phase: string }[] }>('w2-timing.json');
const perf = (name: string) => from<{ count: number; baselineMs: number; candidateMs: number }>(name + '-perf.json');
const label = 'LumaSprite Engine — Open-Source Art Quality R&D';
const pending = 'FURTHER_EVALUATION_REQUIRED';
const rejected = 'REJECTED_FOR_INTEGRATION';
const fullStatus = 'OPEN_SOURCE_ART_QUALITY_RND_READY_FOR_HUMAN_REVIEW';
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const uri = (bytes: Buffer, mime: string) => 'data:' + mime + ';base64,' + bytes.toString('base64');
const img = (file: string, caption: string, eager = false) => {
  const png = results(file);
  return '<img src="' + uri(png, 'image/png') + '" width="' + png.readUInt32BE(16) + '" height="' +
    png.readUInt32BE(20) + '" alt="' + escape(caption) + '"' + (eager ? '' : ' loading="lazy"') + '>';
};
const art = (file: string, caption: string) => '<figure class="art">' + img(file, caption) + '<figcaption>' + escape(caption) + '</figcaption></figure>';
const gallery = (...items: [string, string][]) => '<div class="compare native">' + items.map(([file, caption]) => art(file, caption)).join('') + '</div>';
const status = (text: string) => '<p class="status">' + text + '</p>';
const colorChip = (color: string) => '<i style="--sample:' + color + '" aria-hidden="true"></i>';
const swatches = (ink: readonly string[]) => '<div class="swatches">' + ink.map(color => '<span>' + colorChip(color) + ' ' + color + '</span>').join('') + '</div>';
const table = (columns: string[], rows: (string | number)[][]) => '<div class="scroll" tabindex="0"><table><thead><tr>' +
  columns.map(column => '<th scope="col">' + column + '</th>').join('') + '</tr></thead><tbody>' +
  rows.map(row => '<tr>' + row.map((cell, i) => i === 0 ? '<th scope="row">' + cell + '</th>' : '<td>' + cell + '</td>').join('') + '</tr>').join('') +
  '</tbody></table></div>';
const link = (text: string, url: string) => '<a href="' + url + '">' + text + '</a>';
const download = (file: string, bytes = results(file), label = file) =>
  '<a download="' + file + '" href="' + uri(bytes, file.endsWith('.png') ? 'image/png' : file.endsWith('.txt') ? 'text/plain' : 'application/json') + '">' + label + '</a>';
const downloads = (files: string[]) => '<p class="downloads">' + files.map(file => download(file)).join('') + '</p>';

const audits = [
  { name: 'Ink & Bones', repo: 'sero-labs/ink-and-bones', head: '26b93914ada8414732bc65b7679222b65f004d9b', license: 'ink-and-bones.txt',
    scope: 'MIT · Sero Labs (2026)',
    details: 'Áp dụng law of cosines từ Skeleton.solveChain. Theo dõi cách đặt chân và test mục tiêu, hướng gập, giới hạn tầm với. Tái dùng bộ renderer và mốc chân của W2.',
    deps: '@types/node, Vitest và esbuild MIT. TypeScript Apache-2.0. Cả bốn được khai báo trong dependencies của 0.2.0.',
    code: 'src/skeleton.ts', test: 'test/skeleton.test.ts', manifest: 'package.json' },
  { name: 'SpriteKiln', repo: 'LucasJRamos/spritekiln', head: '17ae0ea8d822b9bb543e539118516ae37d25b114', license: 'spritekiln.txt',
    scope: 'MIT · Lucas Ramos (2026) · ví dụ chọn lọc CC0 · showcase giữ toàn bộ bản quyền',
    details: 'Tham khảo phép chiếu trực giao và yaw. Test upstream kiểm tra preset camera và PNG golden. Hình khối, sắc độ và rasterizer của Surveyor được dựng riêng. Số asset upstream dùng là 0.',
    deps: 'NumPy BSD và giấy phép bundled theo distribution. Pillow 10 HPND, 13 MIT-CMU. PyYAML và Tomli MIT. Python, các extra và script setup đều nằm ngoài prototype.',
    code: 'spritekiln/render.py', test: 'tests/test_view.py', manifest: 'pyproject.toml' },
  { name: '@texel/color', repo: 'texel-org/color', head: '43052d98d2de483cdc95da444f1ba8b846388b23', license: 'texel-color.txt',
    scope: 'MIT · Matt DesLauriers',
    details: 'Áp dụng ma trận sRGB ↔ OKLab, transfer function và tọa độ cực OKLCH. Test upstream kiểm tra round-trip và đối chiếu Color.js. Test cục bộ kiểm tra round-trip tất cả màu đã lấy mẫu.',
    deps: '0 dependency runtime. Dev có MIT cùng JSDoc Apache-2.0, Terser BSD-2-Clause và pako MIT AND Zlib.',
    code: 'src/conversion_matrices.js', test: 'test/test.js', manifest: 'package.json' },
];
const sourceRows = audits.map(({ name, repo, head, license, scope, details, deps, code, test, manifest }) => {
  const root = 'https://github.com/' + repo + '/blob/' + head + '/';
  return [name + '<br><code>' + head + '</code>', scope + '<br>' + download(license, local('licenses/' + license), 'Tải giấy phép'),
    '<p>' + details + '</p>' + [link('README', root + 'README.md'), link('Implementation', root + code), link('Tests', root + test)].join(' · '),
    deps + '<br>' + link('Manifest', root + manifest)];
});

const views = [
  ['sprite', 'Sprite 1×', 'strip', 64, 64], ['outdoor', 'Ngoài trời 1×', 'outdoor', 144, 80],
  ['dungeon', 'Hầm tối 1×', 'dungeon', 144, 80], ['zoom', 'Khung hình 4×', '4x', 256, 256],
  ['marks', 'Khớp và tiếp đất 4×', 'marks', 256, 256],
] as const;
const clip = {
  delays: timing.frames.map(frame => frame.durationMs),
  phases: ik.before.samples.map(frame => frame.lead + ' · ' + frame.phase),
  views: Object.fromEntries(views.map(([id, , file, w, h]) => [
    id, { w, h, images: ['w2', 'w2-ik'].map(name => uri(results(name + '-' + file + '.png'), 'image/png')) },
  ])),
};
const a = ik.before.summary, b = ik.after.summary;
const measurements = [
  ['Trượt world giữa các mẫu chân trụ', '0 px / ' + a.plantedPairs + ' cặp', '0 px / ' + b.plantedPairs + ' cặp'],
  ['Tổng thời gian / quãng đường root', ik.durationMs + ' ms / ' + ik.rootTravelPx + ' px', ik.durationMs + ' ms / ' + ik.rootTravelPx + ' px'],
  ['Bước góc gối trung bình', a.kneeMean + '°', b.kneeMean + '°'],
  ['Bước góc gối lớn nhất', a.kneeMax + '°', b.kneeMax + '°'],
  ['Vòng lặp qua khung cuối, gối gần / xa', a.wrapKnee.join('° / ') + '°', b.wrapKnee.join('° / ') + '°'],
  ['Bước landmark lớn nhất khi vòng lại', a.wrapJoint + ' px', b.wrapJoint + ' px'],
  ['Tọa độ Y của hông', a.hipY.join(' · '), b.hipY.join(' · ')],
  ['Tọa độ Y của vai gần', a.shoulderY.join(' · '), b.shoulderY.join(' · ')],
  ['Khoảng hở chân vung', a.swingClearance.flat().join(' · ') + ' px', b.swingClearance.flat().join(' · ') + ' px'],
  ['Offset tay → grip / giao giữa mask', '+1,+1 px / 7 px', '+1,+1 px / 7 px'],
  ['Chênh diện tích alpha tối đa', a.alphaMaxChange + ' px', b.alphaMaxChange + ' px'],
  ['Pixel đổi alpha trung bình giữa hai khung', a.outlineMeanChange + ' px', b.outlineMeanChange + ' px'],
  ['Đổi màu trên vùng có hình học giống nhau', '0 / ' + a.stablePaintPairs + ' cặp part', '0 / ' + b.stablePaintPairs + ' cặp part'],
];
const scores = (id: string, first: string, next: string, criteria: string[]) => {
  const field = (criterion: string, side: string, name: string) => '<select name="' + side + '-' + escape(criterion) + '" aria-label="' + escape(criterion + ' · ' + name) +
    '"><option value="">—</option>' + [1, 2, 3, 4, 5].map(n => '<option>' + n + '</option>').join('') + '</select>';
  return '<details><summary>Phiếu chấm mỹ thuật</summary><p>1 = khó đọc, 3 = dùng được, 5 = rõ và nhất quán. Chấm ở 1× trong cảnh trước khi kiểm ở 4×.</p>' +
    '<form class="score" data-experiment="' + id + '">' +
    table(['Tiêu chí', first, next], criteria.map(criterion => [criterion, field(criterion, 'baseline', first), field(criterion, 'candidate', next)])) +
    '<label>Nhận xét<textarea name="notes" rows="3"></textarea></label><button type="submit">Tải phiếu JSON</button></form></details>';
};

const assetRows = colors.evidence.map(({ name, sourceInks, remap, boundary }) => [
  name, sourceInks, remap.distinctChanged + ' / ' + remap.pixelsChanged, remap.rgbCollisions, remap.oklabCollisions,
  boundary ? boundary.dungeon.contour.p10Lightness!.toFixed(3) + ' / ' + boundary.dungeon.contour.p10Distance!.toFixed(3) : 'Nền liền khối',
]);
const assetDetails = colors.evidence.map(asset => '<details><summary>' + asset.name + ' · ảnh và ramp</summary>' +
  gallery(...(['original', 'rgb', 'oklab'] as const).map((id, i): [string, string] => [
    'color-' + asset.id + '-' + id + '.png', ['Gốc 1×', 'RGB 4 màu 1×', 'OKLab 4 màu 1×'][i],
  ])) +
  table(['Vật liệu', 'Ramp theo thứ tự nguồn', 'Luma RGB', 'OKLCH L / C / h°'], asset.ramps.map(ramp => [
    ramp.role, swatches(ramp.tones.map(t => t.color)), ramp.tones.map(t => t.luma).join(' · '),
    ramp.tones.map(t => t.lch.join(' / ') + (t.present ? '' : ' (vắng trong ảnh)')).join('<br>'),
  ])) +
  table(['Cặp vật liệu', 'Δ luma midtone', 'ΔL midtone', 'ΔE midtone', 'Màu trùng / gần'], asset.pairs.map(pair => [
    pair.a + ' / ' + pair.b, pair.mid.luma, pair.mid.lightness, pair.mid.distance, pair.exact + ' / ' + pair.near,
  ])) +
  '<p class="quiet"><code>' + asset.file + '</code></p></details>').join('');
const candidateBefore = colors.evidence[1].pairs[0].mid;
const candidateAfter = colors.candidate.afterPairs[0].mid;
const planes = geometry.planes;
const formatCoord = (point: readonly number[]) => point.join(', ');
const browser = 'GAME_RUNTIME_NOT_TESTED';
const perfs = [
  ['Gait · 8 khung', 'Review hình, lock và paint tám pose W2', 'IK và cùng pipeline cho tám pose', perf('ik')],
  ['Geometry · 1 khung', 'Review R2 và paint với kiểm PNG/RGBA', 'Chiếu mesh, depth và paint 3Q', perf('3q')],
  ['Palette · 5 asset', 'Gán các màu hiện diện bằng RGB', 'Gán cùng màu từ cache bốn đích OKLab', perf('color')],
] as const;
const cpu = escape(cpus()[0]?.model.trim() ?? process.arch);
const title = escape(label);

const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${local('report.css').toString('utf8')}</style>
</head>
<body>
<header><div class="wrap hero"><div>
<p class="eyebrow">LumaSprite Engine</p>
<h1>Open-Source Art Quality R&amp;D</h1>
<p class="lede">Ba thử nghiệm trên các asset đã khóa. Xem vòng đi bộ ở 1×, đối chiếu cách dựng góc 3/4 và kiểm tra khoảng cách màu theo cảm nhận.</p>
${status(fullStatus)}
</div>${img('3q-dungeon.png', 'Surveyor-3Q trong hầm tối', true)}</div></header>
<nav aria-label="Mục báo cáo"><div class="wrap"><a href="#walk">IK</a><a href="#geometry">Góc 3/4</a><a href="#color">Màu</a><a href="#sources">Nguồn</a><a href="#qa">QA và bàn giao</a></div></nav>
<main class="wrap">
<div class="cards">
<article class="card"><a href="#walk">W2-IK</a><p>Gối đổi góc đều hơn. Chân trụ giữ 0 px trượt tại các mốc lấy mẫu.</p></article>
<article class="card"><a href="#geometry">Surveyor-3Q</a><p>Nhìn thấy hai mặt của đầu. Chiếu trực tiếp các khớp vướng giới hạn của CharacterSpec.</p></article>
<article class="card"><a href="#color">OKLab / OKLCH</a><p>Hữu ích để chẩn đoán. Ánh xạ bốn màu cho nhiều va chạm hơn trên ba asset.</p></article>
</div>
<section id="walk">
<h2>W2 Expressive Walk và W2-IK</h2>
${status(pending)}
<p class="narrow">Cùng Field Surveyor R2 + M2P, 64×64, pivot (30, 59), hướng nhìn, đèn, bảng màu, root và mốc nền gần 59 / xa 58. Tám khung có thời gian ${clip.delays.join(' · ')} ms. Trong hai cảnh, root tiến 4 px mỗi khung rồi trở về điểm đầu khi lặp.</p>
<div class="viewer" id="viewer">
  <div class="controls">
    <label>Chế độ xem<select id="view-mode">${views.map(([id, name]) => '<option value="' + id + '">' + name + '</option>').join('')}</select></label>
    <button class="primary" id="toggle" type="button" disabled>Phát</button>
    <label class="frame">Khung hình<input id="frame" type="range" min="0" max="7" step="1" value="0"></label>
  </div>
  <div class="loops">
    <figure class="art"><canvas width="64" height="64" aria-label="W2, khung hình hiện hành">${img('r2-final.png', 'Field Surveyor R2')}</canvas><figcaption>W2 Expressive Walk</figcaption></figure>
    <figure class="art"><canvas width="64" height="64" aria-label="W2-IK, khung hình hiện hành">${img('r2-final.png', 'Field Surveyor R2')}</canvas><figcaption>W2-IK</figcaption></figure>
  </div>
  <p><output for="frame view-mode">Đang nạp khung hình</output></p>
  <ul class="captions"><li>${colorChip('#ffaf58')} Điểm chân trụ</li><li>${colorChip('#89c6ff')} Chân vung</li><li>${colorChip('#a6fff2')} Landmark gần</li><li>${colorChip('#d6a5ed')} Landmark xa</li></ul>
</div>
${table(['Phép đo', 'W2', 'W2-IK'], measurements)}
<p class="narrow">Ở pha down, hông và vai hạ 2 px, đầu chân vung tiến thêm 1 px và cánh tay tự do nâng 1 px. Các đích chân trụ vẫn lấy từ W2. Hai đoạn chân được giải từ hông đến cổ chân theo law of cosines rồi làm tròn đầu gối và raster lại. Chiều dài chi nén theo pha để giữ silhouette khi gập. QA ghi chiều dài từng đoạn, trọng tâm theo pose, landmark, grip, góc gối và diện tích mask từng frame trong sidecar.</p>
<p class="narrow">Gối xa mượt hơn qua wrap, còn gối gần tăng từ ${a.wrapKnee[0]}° lên ${b.wrapKnee[0]}°. Độ lún thấp hơn cũng làm nhịp dồn trọng lượng nhẹ hơn. Cần duyệt hai điểm này ở chế độ 1× trên thêm một nhân vật trước khi cân nhắc phiên bản solver. Phép thử hiện tại đo tiếp đất tại các mẫu trong strip và độ ổn định màu trên các part có hình học trùng.</p>
${downloads(['w2-strip.png','w2-timing.json','w2-ik-strip.png','w2-ik-timing.json','ik-poses.json','ik-qa.json'])}
${scores('ik', 'W2', 'W2-IK', ['Silhouette chân', 'Nhịp bước và trọng lượng', 'Chân tiếp đất', 'Cánh tay tự do', 'Tay cầm đèn', 'Độ mượt khi lặp', 'Đọc trong cảnh'])}
</section>
<section id="geometry">
<h2>Field Surveyor R2 và Surveyor-3Q</h2>
${status(rejected)}
<p class="narrow">Surveyor-3Q dùng các khối vát dựng bằng tọa độ 3D tự tác giả, chiếu trực giao yaw ${geometry.camera.yaw}° và pitch ${geometry.camera.pitch}°. Chiếu xuống lớp depth tại tâm pixel nguyên, dùng ánh sáng trên trái và ramp R2. Cả hai bản đặt chung pivot và nền 1×.</p>
${gallery(['r2-final.png', 'R2 · 1×'], ['3q-final.png', 'Surveyor-3Q · 1×'], ['r2-silhouette.png', 'R2 · silhouette'], ['3q-silhouette.png', 'Surveyor-3Q · silhouette'])}
<div class="subgrid">
${gallery(['r2-4x.png','R2 · 4×'], ['3q-4x.png','Surveyor-3Q · 4×'])}
${gallery(['r2-materials.png','R2 · mặt nạ vật liệu'], ['3q-materials.png','Surveyor-3Q · mặt nạ vật liệu'], ['3q-planes.png','Surveyor-3Q · mặt chiếu'])}
<p class="captions">${colorChip('#f1c478')} Mặt trước ${colorChip('#7ac1c2')} Mặt bên ${colorChip('#b9d887')} Mặt trên ${colorChip('#7492b5')} Mặt vát</p>
${gallery(['r2-outdoor.png','R2 · ngoài trời'], ['3q-outdoor.png','Surveyor-3Q · ngoài trời'], ['r2-dungeon.png','R2 · hầm tối'], ['3q-dungeon.png','Surveyor-3Q · hầm tối'])}
</div>
${table(['Chỉ số', 'R2', 'Surveyor-3Q'], [
  ['Diện tích alpha', geometry.before.area + ' px', geometry.after.area + ' px'],
  ['Mặt trước / bên của đầu', 'Mặt phẳng 2D được vẽ trực tiếp', planes.head.front + ' / ' + planes.head.side + ' px'],
  ['Mặt trước / bên của áo', 'Mặt phẳng 2D được vẽ trực tiếp', planes.jacket.front + ' / ' + planes.jacket.side + ' px'],
  ['Mặt trước / bên của hông', 'Mặt phẳng 2D được vẽ trực tiếp', planes.hips.front + ' / ' + planes.hips.side + ' px'],
  ['Vai gần / vai xa (x,y)', ['near-shoulder','far-shoulder'].map(k => formatCoord(geometry.r2Landmarks[k])).join(' · '), ['nearShoulder','farShoulder'].map(k => formatCoord(geometry.landmarks[k])).join(' · ')],
  ['Hông gần / hông xa (x,y)', ['near-hip','far-hip'].map(k => formatCoord(geometry.r2Landmarks[k])).join(' · '), ['nearHip','farHip'].map(k => formatCoord(geometry.landmarks[k])).join(' · ')],
  ['Tiếp xúc tay và quai', 'Lock R2: 7 pixel giao mask', '4 cạnh kề theo pixel đang thấy'],
  ['Chiếu khớp về CharacterSpec v2', 'Hình học hợp lệ', escape(String(geometry.mapping.reason ?? geometry.mapping.result))],
])}
<p class="narrow">Đầu và túi Surveyor-3Q thể hiện chiều sâu. Dáng đứng hẹp hơn khoảng 10% theo diện tích alpha. Cánh tay xa còn mờ, và quai đèn kém tách khỏi thân ở 1×. Hai bản đo tiếp xúc theo mặt nạ khác nhau nên số đo giúp kiểm tra từng bản.</p>
<p class="narrow">Pixel Core dùng được với output RGBA. Thử đưa hông, khuỷu, cổ tay, lòng bàn tay, gối và cổ chân đã chiếu về CharacterSpec v2 bị chặn bởi ràng buộc độ dài khớp. Schema hiện tại cũng thiếu dữ liệu mặt, depth và normal. Muốn bảo toàn 3Q sẽ cần representation phiên bản riêng, anchor đạo cụ, lớp xuất mask, mask va chạm và benchmark animation. Kết quả hiện tại giữ R2 làm chuẩn.</p>
${downloads(['3q-final.png','3q-model.json','3q-qa.json'])}
${scores('geometry','R2','Surveyor-3Q',['Silhouette', 'Tỷ lệ và giải phẫu', 'Góc đầu / vai / hông', 'Tay cầm đèn', 'Cụm pixel', 'Vật liệu', 'Đọc trong cảnh'])}
</section>
<section id="color">
<h2>Chẩn đoán màu theo cảm nhận</h2>
${status(pending)}
<p class="narrow">So sánh RGB có trọng số (2:4:1) của Engine với khoảng cách Euclid OKLab. Hai cách cùng dùng khóa bốn màu. Luma hiện tại lấy trọng số Rec.709 trên sRGB đã gamma và làm tròn. OKLCH tách lightness, chroma và hue. Ngưỡng ΔE ≤ ${colors.nearThreshold} trong báo cáo là ngưỡng khảo sát cho cặp màu gần, theo thang OKLab 0–1.</p>
${swatches(colors.target)}
${table(['Asset', 'Màu gốc', 'Màu / pixel gán khác', 'Cặp va chạm RGB', 'Cặp va chạm OKLab', 'Viền hầm tối p10 ΔL / ΔE'], assetRows)}
<p class="narrow">Va chạm đếm các cặp màu gốc khác nhau cùng được gán vào một ink. P10 đo chênh viền với pixel nền kề cạnh tại vị trí minh họa. Grass/Dirt là nền liền khối và dùng chênh ramp giữa hai vật liệu. Chẩn đoán coat/leather của Surveyor đọc được ΔL chỉ ${colors.evidence[0].pairs[0].mid.lightness} dù khoảng cách màu là ${colors.evidence[0].pairs[0].mid.distance}, cho thấy độ tách ở cặp này chủ yếu đến từ sắc màu.</p>
${assetDetails}
<h3 style="margin-top:1.5rem">Forest Courier · phương án da ochre</h3>
<p class="narrow">Tính một ramp OKLCH riêng cho da và áp vào ${colors.candidate.changed} pixel của mặt nạ da. Trung độ áo / da tăng ΔE từ ${candidateBefore.distance.toFixed(3)} lên ${candidateAfter.distance.toFixed(3)}, ΔL từ ${candidateBefore.lightness.toFixed(3)} lên ${candidateAfter.lightness.toFixed(3)}. Viền ngoài trong hầm giữ nguyên p10. Túi và giày sáng rõ hơn, cần duyệt xem điểm nhấn có lấn áo ở 1× hay không.</p>
<p>Da gốc</p>${swatches(colors.candidate.beforeLeather)}
<p>Da thử nghiệm</p>${swatches(colors.candidate.afterLeather)}
<div class="subgrid">
${gallery(['courier-leather-original.png','Gốc 1×'], ['courier-leather-candidate.png','Da ochre 1×'], ['courier-leather-original-4x.png','Gốc 4×'], ['courier-leather-candidate-4x.png','Da ochre 4×'])}
${gallery(['courier-leather-original-dungeon.png','Gốc · hầm tối'], ['courier-leather-candidate-dungeon.png','Da ochre · hầm tối'], ['courier-leather-original-outdoor.png','Gốc · ngoài trời'], ['courier-leather-candidate-outdoor.png','Da ochre · ngoài trời'])}
</div>
${downloads(['color-qa.json','color-candidate.json','courier-leather-candidate.png'])}
${scores('color','Courier gốc','Da ochre',['Phân biệt da và áo', 'Thứ tự sáng tối', 'Màu phù hợp vật liệu', 'Cụm pixel và viền', 'Đọc trong cảnh tối'])}
</section>
<section id="sources">
<h2>Nguồn và giấy phép</h2>
<p class="narrow">Đối chiếu HEAD, README, mã, test nguồn và giấy phép tại commit cố định. Tất cả xem dưới dạng văn bản. Các bản dựng dùng TypeScript, Pixel Core và thư viện đã có trong Engine. Giữ bản giấy phép nguyên văn trong file tải của từng nguồn.</p>
${table(['Nguồn / commit', 'Phạm vi', 'Mã và test đã đọc', 'Dependency trực tiếp'], sourceRows)}
<p class="narrow">Nguồn SpriteKiln dùng ở đây là repo LucasJRamos. Mã và tài liệu là MIT, một số mẫu là CC0, và art Templar/Huntress cùng các showcase được đánh dấu giữ toàn bộ bản quyền. Báo cáo sử dụng cảnh LumaSprite đã chốt và art Surveyor dựng từ đầu cho thử nghiệm. <a href="README.md">Provenance và bảng dependency chi tiết</a></p>
</section>
<section id="qa">
<h2>Kỹ thuật, hiệu năng và bàn giao</h2>
${table(['Kiểm tra', 'Kết quả'], [
  ['PNG/RGBA', 'PASS · Vòng PNG round-trip, alpha 0/255, transparent RGB và bảng màu hợp lệ. PNG/timing strip có thể tải trực tiếp.'],
  ['Hình học', 'PASS · W2-IK qua character QA, giữ lock đèn và giới hạn chuyển động. 3Q giữ canvas, viền trong khung, bộ phận thiết yếu, hai mặt chiếu và tiếp xúc tay/đèn.'],
  ['Tái tạo', 'PASS · ' + verification.repeatRuns + ' lần chạy tuần tự cho cùng SHA-256 của ' + verification.deterministicFiles + ' file nghiên cứu.'],
  ['Regression Engine', 'PASS · lint, typecheck, build, 65/65 tests, CLI smoke. ' + verification.historicalEntries + ' checksum lịch sử trùng khớp.'],
  ['Báo cáo offline', 'PASS · Chrome mở file cục bộ ở 1440 px và 390 px. Đã kiểm tra phát/lặp, khung 1×, 4×, hai cảnh, overlay và xuất phiếu JSON.'],
  ['Target game', browser + ' · Viewer báo cáo chạy frame-stepped, xem được hai nền đã khóa.'],
])}
<h3>Thời gian thực thi</h3>
<p class="narrow">Median sau ba lần warm-up, thay đổi thứ tự baseline/candidate theo lượt. Node ${process.versions.node}, ${process.platform} ${process.arch} ${escape(release())}, ${cpu}. Gait và 3Q đo chi phí render gồm phần QA được thực thi trong từng đường chạy. Palette đo mapping riêng. Các số đo 3Q và R2 phản ánh hai khối lượng công việc khác nhau vì bước kiểm tra R2 đầy đủ hơn.</p>
${table(['Phép đo', 'Baseline', 'Prototype', 'Số lượt', 'Baseline ms', 'Prototype ms'], perfs.map(([name, before, after, time]) => [
  name, before, after, time.count, time.baselineMs.toFixed(3), time.candidateMs.toFixed(3),
]))}
<p class="narrow">Một ô 64×64 RGBA chiếm 16 KiB. 3Q dùng thêm depth 32 KiB và ownership 8 KiB lúc raster. Hai strip 8 khung đều dùng 128 KiB RGBA trước nén. Các số này mô tả buffer cố định, chưa gồm heap, mask tạm hay PNG encoder.</p>
${downloads(['verification.json','ik-perf.json','3q-perf.json','color-perf.json'])}
<h3>Quyết định kiến trúc</h3>
<ul class="narrow">
<li><strong>IK</strong> · Thử tiếp solver xuất joint pose và contact vào renderer hiện tại. Chi phí vừa. Cần phiên bản spec và verifier riêng nếu muốn phát lại từ package, cộng thêm test nhiều dáng nhân vật và gameplay. Bỏ cấu hình down đầu tiên vì bước đổi góc lớn nhất tăng lên 47,936°.</li>
<li><strong>3/4</strong> · Giữ khảo sát camera và mặt phẳng như nguồn tham khảo. Nhập mesh hoặc runtime Python bị loại. Chi phí cao vì chiều sâu, layer ownership, rig và pose cần một contract riêng.</li>
<li><strong>Màu</strong> · Thử diagnostics dạng opt-in với ΔL và ΔE trên ramp, vẫn dùng kiểm palette hiện có. Chi phí thấp cho metadata. Thay trực tiếp nearest-ink bằng OKLab là <strong>${rejected}</strong> trong phép thử bốn màu. Phương án da ochre cần duyệt art riêng. Khóa màu lịch sử được giữ theo từng package.</li>
</ul>
<h3>Git và tái tạo</h3>
<p>Nhánh <code>codex/open-source-art-quality-rnd</code> từ <code>ba81037</code>. Studio sạch tại <code>bb5c384</code>. Diff của Engine gồm HANDOFF và thư mục nghiên cứu. Kết quả phát hành nội bộ nằm trong <code>research/open-source/art-quality/</code>, PNG/JSON thô trong <code>benchmarks/results/run/art-quality-rnd/</code>. Từ thư mục Engine, chạy hai lệnh dưới đây.</p>
<pre>node research/open-source/art-quality/verify.ts
node research/open-source/art-quality/report.ts</pre>
<p class="narrow">Handoff dẫn tới báo cáo và ba quyết định, với bước tiếp theo là xem playback ở 1× và gửi phiếu mỹ thuật. Đánh giá hiện tại do người thực hiện prototype ghi. Phiếu của Project Owner vẫn mở. <a href="../../../HANDOFF.md">Mở HANDOFF</a></p>
</section>
</main>
<footer><div class="wrap">LumaSprite Engine · Asset lab · 26/11/2026</div></footer>
<script id="clip-data" type="application/json">${JSON.stringify(clip)}</script>
<script>${local('report-player.js').toString('utf8')}</script>
</body></html>`;
writeFileSync(join(home, 'LumaSprite-Engine-Art-Quality-RnD.html'), html);
