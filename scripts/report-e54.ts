import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson } from './e53-common.ts';
import type { WalkTiming } from './benchmark-e53.ts';

const directory = 'benchmarks/results/e54';
const png = (path: string) => 'data:image/png;base64,' + readFileSync(path).toString('base64');
const shot = (file: string) => png(join(directory, 'unity', file));
const ids = ['surveyor', 'courier'] as const;
const actorName = { surveyor: 'Field Surveyor', courier: 'Forest Courier' } as const;
const actors = ids.map(id => {
  const base = join(directory, 'packages', id);
  const { clips } = readJson<{ clips: { walk: { bridgeMs: number } } }>(join(base, 'manifest.json'));
  return { id, bridgeMs: clips.walk.bridgeMs, idle: readJson<WalkTiming>(join(base, 'idle/timing.json')),
    walk: readJson<WalkTiming>(join(base, 'walk/timing.json')),
    images: { idle: png(join(base, 'idle/spritesheet.png')), walk: png(join(base, 'walk/spritesheet.png')), bridge: png(join(base, 'bridge.png')) } };
});
const runtime = readJson<{
  unity: string; graphics: string; ppu: number; width: number; height: number;
  captures: { file: string; scene: string; mode: string; anchorX: number[]; anchorY: number[] }[];
  cases: { actor: keyof typeof actorName; scene: string; mode: string; speed: number; interiorSamples: number; maxSlipPx: number; maxRootTickPx: number; finalRootPx: number }[];
  live: { scene: string; mode: string; observedFps: number; p95FrameMs: number; uniqueWalkFrames: number[] }[];
}>(join(directory, 'unity/runtime.json'));
const sceneNames = { outdoor: 'Outdoor RPG', dungeon: 'Dark Dungeon', neutral: 'Nền neutral' } as const;
const scenes = Object.keys(sceneNames).map(id => {
  const { anchorX, anchorY } = runtime.captures.find(c => c.scene === id)!;
  return { id, uri: png('.cache/e54-unity/Assets/E54Input/' + id + '.png'), anchors: anchorX.map((x, i) => [x, anchorY[i]]) };
});
const scope = '../' + directory + '/';
const style = readFileSync('research/open-source/art-quality/report.css', 'utf8') + `
header {padding:2.5rem 0 1.5rem}
h1 {max-width:23ch;font-size:clamp(2rem,7vw,4.5rem)}
.players {display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,322px),1fr));gap:8px}
.players figure,.shot {overflow:auto}
.players figure canvas,.capture {image-rendering:pixelated;display:block;max-width:none}
.players output {padding:.45rem .3rem;color:var(--muted);text-align:center}
.zoom .players canvas,.zoomshot img {width:1280px;height:704px}
.zoom .players,.zoomshot {grid-template-columns:1fr}
.zoom .players .art,.shot {justify-items:start}
.controls .check {display:flex;align-items:center;min-height:44px}
.cs {margin:1rem 0}
`;
const player = readFileSync('scripts/e54-preview.js', 'utf8');
const table = (columns: string[], rows: (number|string)[][]) => '<div class="scroll" tabindex="0"><table><thead><tr>' +
  columns.map(c => '<th scope="col">' + c + '</th>').join('') + '</tr></thead><tbody>' +
  rows.map(row => '<tr>' + row.map((cell, i) => i ? '<td>' + cell + '</td>' : '<th scope="row">' + cell + '</th>').join('') + '</tr>').join('') + '</tbody></table></div>';
const link = (text: string, rel: string) => '<a href="' + rel + '">' + text + '</a>';
const unityLink = (text: string, file: string) => link(text, scope + 'unity/' + file);
const scoreFor = (a: string) => ['Readability','Walk rhythm','Weight transfer','Foot planting','Foot sliding','Arm swing',
  'Equipment consistency','Pixel shimmer','Loop smoothness','Game readiness'].map(criterion =>
    [criterion, ...['A','B'].map(mode => '<select name="' + a + '/' + mode + '/' + criterion + '" aria-label="' + a + ' ' + mode + ' ' + criterion +
      '"><option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select>')]);
const shots = Object.entries(sceneNames).map(([id, name]) => {
  const figure = (mode: string) => '<figure class="art shot"><img class="capture" width="320" height="176" alt="' + name +
    ' · Unity ' + mode + '" src="' + shot(id + '-' + mode + '.png') + '"><figcaption>' + name + ' · Unity ' + mode + '</figcaption></figure>';
  const pair = figure('A') + figure('B');
  return '<h3 class="cs">' + name + '</h3><div class="players">' + pair + '</div><details><summary>Ảnh Unity 4×</summary><div class="players zoomshot">' + pair + '</div></details>';
}).join('');

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · E5.4 Unity Production Acceptance</title><style>${style}</style></head>
<body><header><div class="wrap"><p class="eyebrow">LumaSprite Engine · E5.4</p><h1>Final Animation Quality</h1>
<p class="lede">So sánh nhịp đi bộ ở 1× và duyệt dựa trên chuyển động nhìn thấy. W2 là baseline production của Surveyor. Walk của Courier đã được chọn với giới hạn.</p>
<p class="status">E5_READY_FOR_FINAL_OWNER_ACCEPTANCE</p></div></header>
<nav aria-label="Báo cáo"><div class="wrap"><a href="#playback">Playback A/B</a><a href="#review">Phiếu chấm</a><a href="#unity">Bằng chứng Unity</a><a href="#packages">Gói xuất</a></div></nav>
<main class="wrap"><p id="status" role="alert"></p>
<section id="playback"><h2>So sánh chuyển động trong cảnh</h2>
<p>Bản xem trước trình duyệt đọc PNG và timing của gói Engine. Mỗi lượt phát idle, vào bước, đi ba vòng, chạm đất để dừng và về idle. Chọn một thời điểm giữa hai khung để thấy độ trượt của B.</p>
<div class="controls">
<label>Cảnh <select id="scene">${Object.entries(sceneNames).map(([id, label]) => '<option value="' + id + '">' + label + '</option>').join('')}</select></label>
<label>Tốc độ <select id="speed"><option value=".75">0,75×</option><option value="1" selected>1×</option><option value="1.25">1,25×</option></select></label>
<label class="check"><input id="contacts" type="checkbox"> Vị trí chân trụ</label>
<label class="check"><input id="zoom" type="checkbox"> Xem 4×</label>
<button id="play" class="primary" type="button" disabled>Phát</button><button id="pause" type="button" disabled>Tạm dừng</button>
<label class="frame">Thời gian clip <input id="seek" type="range" min="0" max="0" value="0" disabled></label>
</div>
<div class="players">
<figure class="art"><figcaption>A · Discrete Root</figcaption><canvas width="320" height="176" aria-label="Discrete Root"></canvas><output>Đang nạp</output></figure>
<figure class="art"><figcaption>B · Pixel-Snapped Movement</figcaption><canvas width="320" height="176" aria-label="Pixel-Snapped Movement"></canvas><output>Đang nạp</output></figure>
</div></section>
<section id="review"><h2>Phiếu nghiệm thu của Project Owner</h2>
<p>Chấm trên cảnh ngoài trời, hầm tối và nền neutral ở 1× trước khi mở 4×. 1 = cần sửa, 3 = dùng được, 5 = rõ và ổn định. Ghi cảnh và tốc độ khi có trượt, rung hoặc khó đọc.</p>
<form id="rating" class="score">${ids.map(id => '<h3>' + actorName[id] + '</h3>' + table(['Tiêu chí','A','B'],scoreFor(actorName[id]))).join('')}
<label>Quyết định <select name="decision"><option value="">Đang chờ</option><option>Accept</option><option>Accept with limitations</option><option>Reject</option></select></label>
<label>Nhận xét<textarea name="notes" rows="3"></textarea></label><button type="submit">Tải phiếu JSON</button></form></section>
<section id="unity"><h2>Windows Standalone Player</h2>
<p class="status">UNITY_RUNTIME_PASS</p><p>Unity ${runtime.unity}, ${runtime.graphics}, Built-in, camera cố định ${runtime.width}×${runtime.height}, ${runtime.ppu} pixels per unit. Sáu ảnh camera khớp từng pixel với ảnh đối chứng. Cả hai phương án dùng cùng scene, sprite, timing và pivot.</p>
${shots}
<h3 class="cs">Mẫu giữa khung và root motion</h3>
<p>Player lấy mẫu toàn hành trình ở 60 Hz logic cho ba tốc độ. Ở mỗi mẫu, độ trượt là chênh lệch X của chân đang planted so với mốc trong timing JSON. B nội suy theo thời lượng của chính khung rồi snap lên pixel nguyên. A giữ root ở đúng mốc đã xuất cho khung đó.</p>
${table(['Nhân vật','Chế độ','Tốc độ','Mẫu giữa khung','Trượt tối đa','Bước root tối đa/tick','Root sau 3 vòng'],
  runtime.cases.filter(c => c.scene === 'outdoor').map(c => [actorName[c.actor],c.mode,c.speed,c.interiorSamples,c.maxSlipPx+' px',c.maxRootTickPx+' px',c.finalRootPx+' px']))}
${table(['Cảnh','Chế độ','FPS đo được','p95 tick ms','Khung Surveyor / Courier'],
  runtime.live.map(row => [sceneNames[row.scene as keyof typeof sceneNames],row.mode,row.observedFps.toFixed(2),row.p95FrameMs.toFixed(2),row.uniqueWalkFrames.join(' / ')]))}
<p class="downloads">${unityLink('Runtime JSON','runtime.json')}${unityLink('Import settings','unity-import.json')}${unityLink('QA và SHA-256 ảnh','evidence.json')}${
 ids.flatMap(id => ['A','B'].map(m => unityLink(actorName[id] + ' ' + m + ' CSV',id + '-' + m + '-trace.csv'))).join('')}</p>
<p>Đề xuất dùng A với các strip hiện tại để giữ tiếp đất. B cho bước root từng pixel nhưng làm chân trụ lệch tối đa 4 px với Surveyor và 3 px với Courier giữa các khung. Camera thử nghiệm cố định, ở tỷ lệ pixel nguyên.</p></section>
<section id="packages"><h2>Gói xuất production</h2>
<p>${ids.map(id => link(actorName[id] + ' · manifest',scope+'packages/'+id+'/manifest.json')).join(' · ')}</p>
<p>${link('Baseline lock',scope+'baseline-lock.json')} · ${link('Runtime report và quyết định E5.3','e54-final-acceptance.md')} · ${link('HANDOFF','../HANDOFF.md')}</p>
<p>Studio giữ frame PNG/RGBA, delay, pivot và tag qua đường adapter. Root và contact dùng timing sidecar của Engine. Import PNG strip trực tiếp của Studio khởi tạo 100 ms mỗi frame.</p></section>
</main><script id="preview-data" type="application/json">${JSON.stringify({ actors, scenes })}</script><script>${player}</script></body></html>`;
writeFileSync('docs/LumaSprite-Engine-E5.4-Report.html',html);
