import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { buildIdleAnimation } from '../src/generators/character/animation.ts';

const root = 'benchmarks/results/e51';
const read = (path: string) => readFileSync(join(root, path));
type Animation = ReturnType<typeof buildIdleAnimation>;
const timing = JSON.parse(read('package/timing.json').toString('utf8')) as Animation['timing'];
const qa = JSON.parse(read('package/qa.json').toString('utf8')) as Animation['qa'];
const studio = JSON.parse(read('studio/parity.json').toString('utf8')) as { studioRevision: string };
const labels = { neutral: 'Trung tính', inhale: 'Hít vào', return: 'Trở về', recovery: 'Thả nhẹ' };

function figure(file: string, label: string, attributes = '', scene = false) {
  const png = read(file);
  return '<figure><figcaption>' + label + '</figcaption><div class="frame' + (scene ? ' scene' : '') +
    '" tabindex="0" aria-label="' + label + '"><img width="' + png.readUInt32BE(16) + '" height="' + png.readUInt32BE(20) +
    '" alt="' + label + '" src="data:image/png;base64,' + png.toString('base64') + '"' + attributes + '></div></figure>';
}
function grid(items: string[], columns = items.length, extra = '') {
  return '<div class="grid ' + extra + '" style="--columns:' + columns + '">' + items.join('') + '</div>';
}
function frames(suffix: string, source?: 'sprite' | 'scene', layout = '') {
  const items = timing.frames.map(({ phase, durationMs }, i) =>
    figure(phase + '-' + suffix + '.png', (i + 1) + ' · ' + labels[phase] + ' · ' + durationMs + ' ms',
      source ? ' data-' + source + '="' + i + '"' : '', source === 'scene'));
  return grid(items, source === 'scene' ? 2 : items.length, source === 'scene' ? 'scenes' : layout);
}
function detail(title: string, content: string) {
  return '<details><summary>' + title + '</summary>' + content + '</details>';
}
function download(file: string, title: string) {
  const type = file.endsWith('.png') ? 'image/png' : 'application/json';
  const name = file.split('/').at(-1);
  return '<a class="download" href="data:' + type + ';base64,' + read(file).toString('base64') + '" download="' + name + '">' + title + '</a>';
}

const motionRows = qa.transitions.map(t => {
  const joints = ['crown', 'chest', 'near-shoulder', 'near-elbow', 'near-wrist', 'grip-anchor'];
  return '<tr><th scope="row">' + labels[t.from] + ' → ' + labels[t.to] + (t.wrap ? ' · nối vòng' : '') + '</th>' +
    joints.map(id => '<td>' + t.displacement[id].join(', ') + '</td>').join('') +
    '<td>' + t.maxJointStepPx + '</td><td>' + t.comparedParts + '</td><td>' + t.flicker.length + '</td></tr>';
}).join('');
const supportRows = qa.frames.map(frame => '<tr><th scope="row">' + labels[frame.phase] + '</th><td>' + frame.alphaPixels + '</td><td>' +
  frame.feet.near.projectedGroundY + ' / ' + frame.feet.near.solePixels + '</td><td>' +
  frame.feet.far.projectedGroundY + ' / ' + frame.feet.far.solePixels + '</td><td>' + frame.gripPixels + '</td><td>' +
  frame.openHandleRows + '</td><td>' + frame.armTorsoGapRows + '</td></tr>').join('');

const onions = grid(qa.transitions.map(({ from, to }) => figure('onion-' + from + '-' + to + '-4x.png', labels[from] + ' → ' + labels[to])), 4, 'detail-images');
const rubric = ['Rõ chuyển động', 'Nhất quán giữa frame', 'Nhịp thở tự nhiên', 'Ổn định trọng lượng', 'Nhất quán điểm nắm',
  'Nhấp nháy vật liệu', 'Liền cụm pixel', 'Độ mượt của vòng lặp', 'Độ rõ trong game', 'Cảm nhận chung'];
const rubricRows = rubric.map(criterion => '<tr><th scope="row">' + criterion + '</th><td><input type="number" min="1" max="5" step="1" aria-label="' +
  criterion + '"></td></tr>').join('');
const downloads = [
  ['package/spritesheet.png', 'Spritesheet PNG'], ['package/timing.json', 'Timing JSON'], ['package/animation-spec.json', 'AnimationSpec v1'],
  ['package/manifest.json', 'Manifest'], ['package/qa.json', 'QA theo frame'], ['studio/parity.json', 'Kết quả Studio'],
].map(([file, label]) => download(file, label)).join('');

const gameplayPng = read('neutral-outdoor-1x.png');
const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumaSprite Engine · E5.1 Idle Animation Review</title>
<style>
:root{color-scheme:light;--paper:#f4efe3;--panel:#fffaf1;--ink:#222e27;--forest:#233d34;--muted:#485a4d;--line:#c6cdbb;--accent:#2e5842}
*{box-sizing:border-box}body{margin:0;color:var(--ink);background:var(--paper);font:1rem/1.6 system-ui,sans-serif}
.shell{width:min(calc(100% - 2rem),1320px);margin-inline:auto}.masthead{color:#fff8e8;background:var(--forest);padding:clamp(2.4rem,7vw,5rem) 0 2.3rem;border-bottom:5px solid #be985f}
.project{font-weight:720;margin-bottom:.75rem}.masthead p{color:#e1e9df}h1,h2{margin:0 0 .65rem;font:500 clamp(1.85rem,4vw,3rem)/1.08 Georgia,serif;letter-spacing:-.025em}
h1{font-size:clamp(2.5rem,7vw,5rem)}h3{margin:0 0 .4rem;font-size:1.05rem;line-height:1.25}p{max-width:77ch;margin:.45rem 0 .85rem}
a{color:var(--accent);text-underline-offset:.2em}nav{display:flex;flex-wrap:wrap;gap:.1rem 1.25rem;padding:.45rem 0;border-bottom:1px solid var(--line)}
nav a,summary,.download,button{min-height:44px;display:inline-flex;align-items:center;font-weight:660}
section{margin:clamp(2.2rem,6vw,4.2rem) 0}article{padding:.8rem;background:var(--panel);border:1px solid var(--line);border-radius:.5rem;margin:.85rem 0}
.grid{display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));gap:.85rem;align-items:start}figure{margin:0;min-width:0}figcaption{font-size:.91rem;color:var(--muted);font-weight:630;padding:.35rem 0}
.frame{overflow:auto;border:1px solid var(--line);border-radius:.24rem;padding:7px;background:repeating-conic-gradient(#e1e6d8 0 25%,#f2eee3 0 50%) 0 0/16px 16px;min-width:0}
.frame.scene{padding:0;background:#657e51}img,canvas{max-width:none;display:block;margin-inline:auto;image-rendering:pixelated}
details{border-top:1px solid var(--line);margin-top:.7rem}summary{display:list-item;padding:.6rem .2rem;cursor:pointer;color:var(--accent)}
.controls,.downloads{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;margin:.8rem 0}.controls p{margin:0}.controls{margin-top:0}
button,.download{padding:.42rem .7rem;border:1px solid var(--line);border-radius:.28rem;background:var(--panel);color:var(--accent);font-size:1rem}button:not(:disabled){cursor:pointer}
.scroll{overflow:auto;border:1px solid var(--line);margin:.8rem 0}table{width:100%;border-collapse:collapse;text-align:left;background:var(--panel);white-space:nowrap}
th,td{padding:.53rem .65rem;border-bottom:1px solid var(--line)}thead,footer{background:#e6ebdc}
input{width:3.2rem;min-height:44px;border:1px solid #74816f;border-radius:.2rem;padding:.2rem;font:inherit}
:focus-visible{outline:3px solid #76551b;outline-offset:3px}footer{padding:1.1rem 0;color:var(--muted)}
@media(max-width:730px){.detail-images,.scenes{grid-template-columns:minmax(0,1fr)}}
@media(max-width:480px){article{padding:.5rem}.grid:not(.scenes):not(.detail-images){grid-template-columns:repeat(2,minmax(0,1fr))}figcaption{font-size:.82rem}}
@media print{nav,.downloads,.controls{display:none}.frame{overflow:visible}img,canvas{max-width:100%;height:auto}}
</style></head><body>
<header class="masthead"><div class="shell"><div class="project">LumaSprite Engine · E5.1</div><h1>Surveyor idle ở 1×</h1>
<p>Bốn frame 64 × 64 từ Surveyor R2 + M2P. Vai và thân thay đổi nhẹ, hai đế giày và điểm nắm đèn giữ nguyên. Phiếu duyệt đang chờ đánh giá chuyển động.</p></div></header>
<nav class="shell" aria-label="Mục lục"><a href="#native">Frame 1×</a><a href="#loop">Phát vòng lặp</a><a href="#detail">Ảnh 4×</a><a href="#checks">Kiểm định</a><a href="#review">Phiếu chấm</a></nav>
<main class="shell">
<section id="native"><h2>Bốn frame ở kích thước gốc</h2><p>Trung tính và trở về trùng RGBA với R2 tĩnh. Hít vào mở vai. Nhịp thả nhẹ hạ thân trên một pixel.</p>
<article><h3>Màu M2P</h3>${frames('1x', 'sprite')}</article><article><h3>Silhouette</h3>${frames('silhouette-1x')}</article></section>
<section id="loop"><h2>Phát thử ở 1×</h2><p>Một vòng kéo dài ${timing.totalDurationMs} ms. Bản xem dùng chính thời lượng của từng frame trong gói xuất.</p>
<div class="controls"><button type="button" id="playback" disabled>Phát vòng lặp</button><p id="current-frame">Đang nạp dữ liệu nhúng</p></div>
<article class="grid scenes" style="--columns:2"><figure><figcaption>R2 tĩnh · đối chứng</figcaption>
<div class="frame" tabindex="0" aria-label="Bản R2 tĩnh"><canvas id="baseline" width="64" height="64" role="img" aria-label="Surveyor R2 tĩnh"></canvas></div></figure>
<figure><figcaption>Idle · 1×</figcaption><div class="frame" tabindex="0" aria-label="Idle">
<canvas id="motion" width="64" height="64" role="img" aria-label="Vòng lặp idle"></canvas></div></figure></article>
<article><h3>Outdoor RPG · 1×</h3><div class="frame scene" tabindex="0" aria-label="Cảnh Outdoor RPG 1×">
<canvas id="game" width="${gameplayPng.readUInt32BE(16)}" height="${gameplayPng.readUInt32BE(20)}" role="img" aria-label="Idle trong cảnh Outdoor RPG"></canvas></div>
${detail('Xem từng frame trong cảnh', frames('outdoor-1x', 'scene'))}</article></section>
<section id="detail"><h2>Xem cụm pixel ở 4×</h2>
${detail('Frame strip · nearest-neighbor 4×', figure('strip-4x.png', 'Bốn frame · 4×'))}
${detail('Landmark và pivot', frames('landmarks-4x', undefined, 'detail-images'))}
${detail('Tay, quai và đèn', frames('grip-4x'))}
${detail('Onion-skin qua từng bước, gồm bước nối vòng', '<p>Cam là pixel silhouette chỉ có ở frame trước, xanh là chỉ có ở frame sau, lục xám là phần chung.</p>' + onions)}</section>
<section id="checks"><h2>Kiểm khớp, đế giày và gói xuất</h2>
<p>Độ dời ghi theo cặp (Δx, Δy) pixel. Kiểm nhấp nháy so sánh màu trong từng part có hình không đổi sau khi căn theo bounds. Thay đổi tại phần hình đang biến dạng được dành cho duyệt bằng mắt.</p>
<div class="scroll" tabindex="0" aria-label="Bảng độ dời giữa các frame"><table><thead><tr><th>Bước</th><th>Đỉnh đầu</th><th>Ngực</th><th>Vai gần</th>
<th>Khuỷu gần</th><th>Cổ tay</th><th>Điểm nắm</th><th>Dời tối đa</th><th>Part đã so</th><th>Part nhấp nháy</th></tr></thead><tbody>${motionRows}</tbody></table></div>
<p>Mỗi cột đế ghi cao độ mặt đất / số pixel tiếp đất. Pivot (30,59) và điểm nắm (49,33) cố định qua bốn frame.</p>
<div class="scroll" tabindex="0" aria-label="Bảng kiểm tra đế giày và đèn"><table><thead><tr><th>Frame</th><th>Pixel alpha</th><th>Đế gần</th><th>Đế xa</th>
<th>Pixel tiếp xúc</th><th>Hàng hở quai</th><th>Hàng hở tay–thân</th></tr></thead><tbody>${supportRows}</tbody></table></div>
<p>Studio ${studio.studioRevision} đã nhập dữ liệu PNG và timing qua adapter, lưu, mở lại, khôi phục backup và xuất strip PNG/JSON đúng từng frame. Game runtime <code>GAME_RUNTIME_NOT_TESTED</code>.</p>
<div class="downloads">${downloads}</div></section>
<section id="review"><h2>Phiếu duyệt idle</h2><p>Chấm 1–5 sau khi xem vài vòng ở 1×, đối chiếu R2 tĩnh và bước nối cuối–đầu. Điểm nhập dùng trong phiên mở trang.</p>
<div class="scroll" tabindex="0" aria-label="Tiêu chí duyệt idle"><table><thead><tr><th>Tiêu chí</th><th>Điểm</th></tr></thead><tbody>${rubricRows}</tbody></table></div></section>
</main><footer><div class="shell">LumaSprite Engine · E5.1 · Gallery offline</div></footer>
<script id="timing" type="application/json">${JSON.stringify(timing).replaceAll('<', '\\u003c')}</script>
<script>
const { frames, totalDurationMs } = JSON.parse(document.getElementById('timing').textContent);
const sprites = [...document.querySelectorAll('img[data-sprite]')];
const scenes = [...document.querySelectorAll('img[data-scene]')];
const baseline = document.getElementById('baseline').getContext('2d');
const motion = document.getElementById('motion').getContext('2d');
const game = document.getElementById('game').getContext('2d');
const button = document.getElementById('playback');
const status = document.getElementById('current-frame');
let index = -1, elapsed = 0, start = 0, pending = 0, playing = false;
function draw(ctx, picture) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(picture, 0, 0);
}
function displayAt(ms) {
  const at = ms % totalDurationMs;
  let end = 0;
  const next = frames.findIndex(frame => { end += frame.durationMs; return at < end; });
  if (next === index) return;
  index = next;
  draw(motion, sprites[index]);
  draw(game, scenes[index]);
  status.dataset.phase = frames[index].phase;
  status.textContent = 'Frame ' + (index + 1) + ' / ' + frames.length + ' · ' + frames[index].durationMs + ' ms';
}
function tick(now) {
  displayAt(elapsed + Math.max(0, now - start));
  pending = requestAnimationFrame(tick);
}
button.addEventListener('click', () => {
  if (playing) {
    elapsed = (elapsed + performance.now() - start) % totalDurationMs;
    cancelAnimationFrame(pending);
    displayAt(elapsed);
  } else {
    start = performance.now();
    pending = requestAnimationFrame(tick);
  }
  playing = !playing;
  button.textContent = playing ? 'Tạm dừng' : 'Phát vòng lặp';
});
Promise.all([...sprites, ...scenes].map(img => img.decode())).then(() => {
  draw(baseline, sprites[0]);
  displayAt(0);
  button.disabled = false;
}).catch(() => { status.textContent = 'Không đọc được ảnh nhúng.'; });
</script></body></html>
`;
writeFileSync('docs/LumaSprite-Engine-E5.1-Report.html', html);
