import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { buildWalkAnimation } from '../src/generators/character/walk.ts';

const read = (file: string) => readFileSync(join('benchmarks/results/e52', file));
const json = (file: string) => JSON.parse(read(file).toString('utf8'));
type Walk = ReturnType<typeof buildWalkAnimation>;
const candidates = ['w1', 'w2'].map(id => ({
  id, timing: json(id + '/package/timing.json') as Walk['timing'], qa: json(id + '/package/qa.json') as Walk['qa'],
  studio: json('studio/' + id + '/parity.json') as { studioRevision: string },
}));
const scenes = json('scene-source.json') as Record<'outdoor' | 'dungeon', { pivot: [number, number] }>;
const idle = json('../e51/package/timing.json') as { totalDurationMs: number; frames: { phase: string; durationMs: number }[] };
const phase = { contact: 'Tiếp đất', down: 'Nhận tải', passing: 'Chân vung qua', up: 'Đẩy mũi' };
const sides = { near: 'Gần', far: 'Xa' };

function png(file: string) {
  const data = read(file);
  return { src: 'data:image/png;base64,' + data.toString('base64'), w: data.readUInt32BE(16), h: data.readUInt32BE(20) };
}

function img(file: string, alt: string, attrs = '') {
  const p = png(file);
  return '<img width="' + p.w + '" height="' + p.h + '" alt="' + alt + '" src="' + p.src + '"' + attrs + '>';
}

function figure(file: string, label: string, attrs = '') {
  return '<figure><figcaption>' + label + '</figcaption><div class="frame" tabindex="0" aria-label="' + label + '">' + img(file, label, attrs) + '</div></figure>';
}

function panel<T>(values: readonly T[], render: (value: T, i: number) => string, columns = 4) {
  return '<div class="grid walk-frames" style="--columns:' + columns + '">' + values.map(render).join('') + '</div>';
}

function detail(title: string, html: string) {
  return '<details><summary>' + title + '</summary>' + html + '</details>';
}

function download(file: string, label: string, name: string) {
  const mime = file.endsWith('.png') ? 'image/png' : 'application/json';
  return '<a class="download" download="' + name + '" href="data:' + mime + ';base64,' + read(file).toString('base64') + '">' + label + '</a>';
}

function table(labels: string[], rows: string[], name: string) {
  return '<div class="scroll" tabindex="0" aria-label="' + name + '"><table><thead><tr>' +
    labels.map(label => '<th scope="col">' + label + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
}

function row(label: string, data: (string | number)[]) {
  return '<tr><th scope="row">' + label + '</th>' + data.map(value => '<td>' + value + '</td>').join('') + '</tr>';
}
const frameLabel = (frame: Walk['qa']['frames'][number], i: number) => (i + 1) + ' · ' + phase[frame.phase] + ' · Trụ ' + sides[frame.lead].toLowerCase();
const serial = (i: number) => String(i + 1).padStart(2, '0');
const frames = (type: string, c: typeof candidates[number], interactive = false) => panel(c.qa.frames, (f, i) =>
  figure(c.id + '/' + type + '-' + serial(i) + '.png', frameLabel(f, i) + (interactive ? ' · ' + c.timing.frames[i].durationMs + ' ms' : ''),
    interactive ? ' data-frame="' + c.id + '"' : ''));

const first = candidates.map(c => '<article><h3>' + c.timing.name + '</h3>' + frames('frame', c, true) + '</article>').join('');
const sceneNames = { outdoor: 'Outdoor RPG', dungeon: 'Dark Dungeon' };
const sceneImages = (Object.keys(sceneNames) as (keyof typeof sceneNames)[]).map(id => {
  const { w, h } = png(id + '.png');
  const previews = candidates.map(c => '<figure><figcaption>' + c.timing.name + '</figcaption><div class="frame scene" tabindex="0">' +
    '<canvas width="' + w + '" height="' + h + '" data-scene="' + id + '" data-candidate="' + c.id + '" role="img" aria-label="' + sceneNames[id] +
    ' · ' + c.id.toUpperCase() + '"></canvas></div></figure>').join('');
  return '<article><h3>' + sceneNames[id] + ' · 1×</h3><div class="grid scene-grid" style="--columns:2">' + previews + '</div></article>';
}).join('');
const loopFrames = candidates.map(c => '<figure><figcaption>' + c.timing.name + '</figcaption><div class="frame">' +
  '<canvas data-candidate="' + c.id + '" width="64" height="64" role="img" aria-label="' + c.timing.name + ' ở 1×"></canvas></div>' +
  '<p class="frame-status" id="' + c.id + '-state"></p></figure>').join('');
const details = candidates.map(c => '<article><h3>' + c.timing.name + '</h3>' +
  detail('Strip màu 4× nearest-neighbor', figure(c.id + '/strip-4x.png', c.id.toUpperCase() + ' · Strip 4×')) +
  detail('Silhouette strip 1×', figure(c.id + '/silhouette-strip.png', c.id.toUpperCase() + ' · Silhouette')) +
  detail('Landmark 4×', frames('landmarks', c)) +
  detail('Onion-skin giữa hai frame kế tiếp, gồm nối vòng', '<p>Cam là alpha của frame trước, xanh ngọc là alpha mới, xám lục là phần chung.</p>' + frames('onion', c)) +
  detail('Tay nắm và đèn 4×', frames('grip', c)) + '</article>').join('');

const qa = candidates.map(c => {
  const { rootMotion, transitions } = c.qa;
  const contact = c.qa.frames.map((f, i) => {
    const foot = (side: 'near' | 'far') => {
      const p = f.feet[side];
      return (p.state === 'planted' ? 'Tựa' : 'Vung') + ' · canvas (' + p.canvas.join(',') + ') · world (' + p.world.join(',') + ')';
    };
    const delta = (side: 'near' | 'far') => transitions[i].contacts.find(contact => contact.side === side)?.plantedDelta?.join(',') ?? '—';
    return row(frameLabel(f, i), [c.timing.frames[i].durationMs, f.rootX + ' → +' + f.advancePx, foot('near'), foot('far'),
      delta('near'), delta('far'), f.bodyBob, f.gripPixels, f.lanternSway, transitions[i].comparedParts, transitions[i].flicker.length]);
  });
  return '<article><h3>' + c.timing.name + '</h3><p>' + c.timing.frames.length + ' frame · ' + c.timing.totalDurationMs +
    ' ms · root đi ' + rootMotion.cyclePx + ' px/vòng. Độ dời world của chân đang tựa được tính đến frame kế tiếp, gồm cả nối vòng.</p>' +
    figure(c.id + '/foot-trajectory.png', 'Quỹ đạo bàn chân trong world space') +
    table(['Pha', 'ms', 'Root X, Δ', 'Chân gần', 'Chân xa', 'Δ tựa gần', 'Δ tựa xa', 'Bob', 'Pixel nắm', 'Lệch đèn', 'Part đã so', 'Nhấp nháy'], contact,
      'Contact timeline của ' + c.id.toUpperCase()) +
    '<p>Studio ' + c.studio.studioRevision + ' xác minh thứ tự, thời lượng, tag, pivot và RGBA sau khôi phục.</p><div class="downloads">' +
    download(c.id + '/package/spritesheet.png', 'Spritesheet PNG', c.id + '-spritesheet.png') +
    download(c.id + '/package/timing.json', 'Timing + root JSON', c.id + '-timing.json') +
    download(c.id + '/package/animation-spec.json', 'AnimationSpec v2', c.id + '-spec.json') +
    download(c.id + '/package/qa.json', 'Contact và QA JSON', c.id + '-qa.json') +
    download(c.id + '/package/manifest.json', 'Manifest', c.id + '-manifest.json') +
    download('studio/' + c.id + '/parity.json', 'Kết quả Studio', c.id + '-studio.json') + '</div></article>';
}).join('');

const review = ['Độ rõ chuyển động', 'Nhịp đi', 'Phân bố trọng lượng', 'Chân tiếp đất', 'Trượt chân', 'Gối và hông',
  'Chuyển động thân trên', 'Vung tay', 'Nhất quán đèn', 'Liền cụm màu và pixel', 'Độ mượt vòng lặp', 'Sẵn sàng dùng trong game'];
const scores = table(['Tiêu chí', 'W1', 'W2'], review.map(label => row(label, candidates.map(c =>
  '<input type="number" min="1" max="5" step="1" aria-label="' + c.id.toUpperCase() + ' · ' + label + '">'))), 'Phiếu chấm walk cycle');
const prior = readFileSync('docs/LumaSprite-Engine-E5.1-Report.html', 'utf8');
const styles = /<style>([\s\S]*?)<\/style>/.exec(prior)?.[1];
if (!styles) throw new Error('Missing shared review styles.');
const sourceImages = (Object.keys(sceneNames) as (keyof typeof sceneNames)[]).map(id => img(id + '.png', '', ' id="source-' + id + '"')).join('') +
  candidates.map(c => img(c.id + '/bridge.png', '', ' id="bridge-' + c.id + '"')).join('') +
  idle.frames.map(frame => img('../e51/' + frame.phase + '-1x.png', '', ' data-idle')).join('');
const data = JSON.stringify({
  scenes, idle, candidates: candidates.map(c => ({ id: c.id, timing: c.timing, bridgeMs: c.qa.entryExit.durationMs })),
}).replaceAll('<', '\\u003c');

const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · E5.2 Walk Cycle Review</title>
<style>${styles}
.frame-status{color:var(--muted);font-size:.9rem}.grid.scene-grid{gap:.65rem}.grid.scene-grid figure{min-width:0}
@media(max-width:850px){.grid.scene-grid{grid-template-columns:minmax(0,1fr)}}
@media(max-width:540px){.grid.walk-frames{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style></head><body>
<header class="masthead"><div class="shell"><div class="project">LumaSprite Engine · E5.2</div>
<h1>Surveyor bước đi ở 1×</h1><p>W1 có sáu frame và nhịp gọn. W2 có tám frame, thêm pha đẩy mũi và dao động đèn nhẹ. Cả hai dùng R2 + M2P và cùng bộ dựng hình.</p></div></header>
<nav class="shell" aria-label="Mục lục"><a href="#frames">Frame 1×</a><a href="#play">Phát thử</a><a href="#details">Chi tiết</a><a href="#contact">Chân và root</a><a href="#review">Phiếu chấm</a></nav>
<main class="shell">
<section id="frames"><h2>Frame ở kích thước gốc</h2>${first}</section>
<section id="play"><h2>So vòng lặp và chuyển tiếp</h2><p>Khung sprite giữ pivot tại chỗ. Hai cảnh cộng root theo từng frame để kiểm chân tựa. Vị trí trong khung cảnh quay về đầu khi bắt đầu vòng trình diễn mới.</p>
<div class="controls"><button id="loop" type="button" disabled>Phát vòng lặp</button><button id="transition" type="button" disabled>Idle → Walk → Idle</button><button id="pause" type="button" disabled>Tạm dừng</button>
<span id="play-status" aria-live="polite">Đang nạp dữ liệu nhúng</span></div>
<article class="grid" style="--columns:2">${loopFrames}</article>${sceneImages}</section>
<section id="details"><h2>Silhouette, landmark và đèn</h2>${details}</section>
<section id="contact"><h2>Chân tựa và chuyển động root</h2><p>Ở biểu đồ, xanh ngọc là chân gần, tím là chân xa và vàng là mẫu chân tựa. Cột Δ là chênh lệch tọa độ world của điểm tựa ở hai frame liên tiếp. Gạch ngang là ít nhất một trong hai mẫu không tựa. Hai đường nền có cao độ 59 và 58.</p>
<p>Kiểm độ ổn định màu trên các part có hình dạng không đổi sau khi căn bounds. Chấm biến dạng và đường viền ở 1×. <code>GAME_RUNTIME_NOT_TESTED</code></p>${qa}</section>
<section id="review"><h2>Phiếu duyệt W1 và W2</h2><p>Chấm 1–5 tại 1×, quan sát cả khung cố định và cảnh cộng root. Mục tiêu là từ 4/5 ở các tiêu chí cốt lõi. Điểm dùng trong phiên mở trang.</p>${scores}</section>
</main><footer><div class="shell">LumaSprite Engine · E5.2 · Gallery offline</div></footer>
<div hidden>${sourceImages}</div>
<script type="application/json" id="walk-data">${data}</script>
<script>
const data = JSON.parse(document.getElementById('walk-data').textContent);
const idle = [...document.querySelectorAll('img[data-idle]')];
const sceneImages = Object.fromEntries(Object.keys(data.scenes).map(id => [id, document.getElementById('source-' + id)]));
const players = data.candidates.map(({id, timing, bridgeMs}) => ({
  id, timing, bridgeMs, images: [...document.querySelectorAll('img[data-frame="' + id + '"]')], bridge: document.getElementById('bridge-' + id),
  status: document.getElementById(id + '-state'),
  contexts: [...document.querySelectorAll('canvas[data-candidate="' + id + '"]')].map(canvas => canvas.getContext('2d')),
}));
const loop = document.getElementById('loop'), bridge = document.getElementById('transition'), pause = document.getElementById('pause');
const status = document.getElementById('play-status');
let mode = 'loop', start = 0, pending = 0, pausedAt = 0;
function frameAt(frames, ms) {
  let end = 0;
  return frames.findIndex(frame => { end += frame.durationMs; return ms < end; });
}
function sampleWalk(p, ms) {
  const i = frameAt(p.timing.frames, ms);
  const m = p.timing.rootMotion.frames[i];
  return { image: p.images[i], rootX: m.rootX, label: m.lead + ' · ' + m.phase + ' · ' + p.timing.frames[i].durationMs + ' ms', stage: 'walk', frame: i };
}
function sample(p, ms) {
  if (mode === 'loop') return sampleWalk(p, ms % p.timing.totalDurationMs);
  const idleMs = data.idle.totalDurationMs;
  if (ms < idleMs) return { image: idle[frameAt(data.idle.frames, ms)], rootX: 0, label: 'Idle', stage: 'idle' };
  ms -= idleMs;
  if (ms < p.bridgeMs) return { image: p.bridge, rootX: 0, label: 'Bắt đầu bước', stage: 'entry' };
  ms -= p.bridgeMs;
  if (ms < p.timing.totalDurationMs) return sampleWalk(p, ms);
  ms -= p.timing.totalDurationMs;
  const rootX = p.timing.rootMotion.cyclePx;
  const hold = p.timing.frames[0].durationMs;
  if (ms < hold) return { ...sampleWalk(p, 0), rootX, label: 'Tiếp đất để dừng', stage: 'contact' };
  ms -= hold;
  if (ms < p.bridgeMs) return { image: p.bridge, rootX, label: 'Thu chân về idle', stage: 'exit' };
  ms -= p.bridgeMs;
  const index = ms < idleMs ? frameAt(data.idle.frames, ms) : 0;
  return {image: idle[index], rootX, label: 'Idle', stage: ms < idleMs ? 'idle-end' : 'done'};
}
function draw(p, {image, rootX, label, stage, frame}) {
  for (const ctx of p.contexts) {
    const scene = ctx.canvas.dataset.scene;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (scene) {
      ctx.drawImage(sceneImages[scene], 0, 0);
      const [x, y] = data.scenes[scene].pivot;
      ctx.drawImage(image, x - p.timing.pivot[0] + rootX, y - p.timing.pivot[1]);
    } else ctx.drawImage(image, 0, 0);
  }
  p.status.textContent = label;
  p.status.dataset.stage = stage;
  p.status.dataset.frame = frame ?? '';
  p.status.dataset.rootX = rootX;
}
function drawAt(ms) {
  const samples = players.map(p => sample(p, ms));
  players.forEach((p, i) => draw(p, samples[i]));
  return samples.every(s => s.stage === 'done');
}
function tick(now) {
  if (drawAt(Math.max(0, now - start))) {
    pending = 0;
    pause.disabled = true;
    status.textContent = 'Hoàn tất chuyển tiếp';
  } else pending = requestAnimationFrame(tick);
}
function play(next) {
  cancelAnimationFrame(pending);
  const resume = mode === next && pausedAt > 0;
  mode = next;
  start = performance.now() - (resume ? pausedAt : 0);
  pausedAt = 0;
  status.textContent = next === 'loop' ? 'Đang phát vòng lặp' : 'Đang phát chuyển tiếp';
  pause.disabled = false;
  pending = requestAnimationFrame(tick);
}
loop.addEventListener('click', () => play('loop'));
bridge.addEventListener('click', () => play('transition'));
pause.addEventListener('click', () => {
  cancelAnimationFrame(pending);
  pending = 0;
  pausedAt = Math.max(0, performance.now() - start);
  drawAt(pausedAt);
  pause.disabled = true;
  status.textContent = 'Đã tạm dừng';
});
Promise.all([...idle, ...Object.values(sceneImages), ...players.flatMap(p=>[p.bridge,...p.images])].map(img=>img.decode())).then(() => {
  drawAt(0);
  loop.disabled = bridge.disabled = false;
  status.textContent = 'Sẵn sàng';
}).catch(() => { status.textContent = 'Không đọc được ảnh nhúng.'; });
</script></body></html>
`;
writeFileSync('docs/LumaSprite-Engine-E5.2-Report.html', html);
