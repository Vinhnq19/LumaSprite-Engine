"""Create the offline E8.3 reviewer handoff with actual Unity Player captures."""
import argparse
from base64 import b64encode
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import struct
import subprocess

root = Path(__file__).resolve().parents[1]
results = root / "benchmarks/results/e83"
p = argparse.ArgumentParser(description=__doc__)
p.add_argument("--source", required=True)
args = p.parse_args()
source = subprocess.check_output(["git", "rev-parse", "--verify", args.source + "^{commit}"], cwd=root, text=True).strip()
assert source == args.source
hashes = {}
for line in (results / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
    digest, file = line.split("  ", 1)
    assert sha256((results / file).read_bytes()).hexdigest() == digest, file
    hashes[file] = digest

def json_file(name):
    return json.loads((results / name).read_bytes())

def script(id_, data):
    return f'<script id="{id_}" type="application/json">' + json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c") + "</script>"

runtime = json_file("runtime.json")
qa = json_file("verification.json")
blank = json_file("human-review.json")
attachments = {}
for file in [name for name in hashes if not name.endswith(".png")] + ["SHA256SUMS"]:
    raw = (results / file).read_bytes()
    attachments[file] = {"sha256": sha256(raw).hexdigest(), "base64": b64encode(raw).decode("ascii")}
fixtures = root / "benchmarks/fixtures/e84/mistfen-scene-sidecar-proposal.json"
raw = fixtures.read_bytes()
attachments[fixtures.name] = {"sha256": sha256(raw).hexdigest(), "base64": b64encode(raw).decode("ascii")}
drawn = set()

def card(file, label, category):
    raw = (results / file).read_bytes()
    w, h = struct.unpack(">II", raw[16:24])
    drawn.add(file)
    return (f'<figure><figcaption>{escape(label)}<small>{category} · {w}×{h}</small></figcaption><div class="pan">'
            f'<img alt="{escape(label)}" width="{w}" height="{h}" data-file="{escape(file)}" data-sha="{hashes[file]}" '
            f'src="data:image/png;base64,{b64encode(raw).decode("ascii")}"></div></figure>')

names = {
    "mistfen-ferry-landing": "Mistfen Ferry Landing",
    "floodgate-maintenance-yard": "Floodgate Maintenance Yard",
    "canal-intake-service-platform": "Canal Intake Service Platform",
}
world = "WORLD ONLY"
hud = "UNITY FRAMEBUFFER · HUD"
by_scene = {}
performance = []
for row in runtime["cases"]:
    light, key = row["light"].title(), row["id"]
    deck = [
        card(row["outOfRangeCapture"], "Ngoài phạm vi", hud),
        card(row["promptCapture"], row["prompt"], hud),
        card(row["feedbackCapture"], row["feedback"], hud),
    ]
    proof = card(row["staticCapture"], f"{light} · Spawn RGBA exact", world)
    proof += card(row["routeCapture"], f"{light} · Ảnh nền tại vị trí tương tác", world)
    if row["stagingCapture"]:
        proof += card(row["stagingCapture"], f"{light} · Canal staging · {row['apertureStaging']} pixel", world)
    by_scene.setdefault(key, []).append(f'<details open><summary>{light} · {row["steps"]} bước tới mốc</summary>'
                                      '<div class="three">' + "".join(deck) + '</div>'
                                      '<details><summary>World-only captures</summary><div class="three">'
                                      + proof + '</div></details></details>')
    performance.append(
        f'<tr><th scope="row">{names[key]} · {light}</th><td>{row["loadMs"]:.1f}</td><td>{row["switchMs"]:.1f}</td>'
        f'<td>{row["warmupMs"]:.1f}</td><td>{row["firstMovementFrameMs"]:.2f}</td>'
        f'<td>{row["steadyMeanMs"]:.2f}</td><td>{row["steadyP95Ms"]:.2f}</td><td>{row["steadyMaxMs"]:.2f}</td>'
        f'<td>{row["steadyFrames"]}</td><td>{row["spikesOver25ms"]}</td><td>{row["garbageCollections"]}</td><td>{row["captureMs"]:.1f}</td></tr>'
    )
sections = "".join(f'<section id="{k}"><h2>{v}</h2>{"".join(by_scene[k])}</section>' for k, v in names.items())
before = '<div class="three">' + card("before/mistfen-ferry-landing-day-spawn.png",
    "E8 · Spawn, dấu chưa hiện", "E8 PLAYER · BASELINE") + card("before/mistfen-ferry-landing-day-interaction.png",
    "E8 · Dấu cũ trong range", "E8 PLAYER · BASELINE") + "</div>"
animation = []
for f in runtime["animation"]:
    label = f'{f["stage"]} · frame {f["frame"]} · {f["atMs"]} ms'
    if f["stage"] != "idle-return":
        label += f' · planted {f["plantedFeet"]}'
    animation.append(card(f["file"], label, world))
assert drawn == {name for name in hashes if name.endswith(".png")}
suite = " · ".join(f'{row["mode"]} {row["passed"]}/{row["passed"]}' for row in qa["tests"])
hardware = f'{runtime["cpu"]} · {runtime["gpu"]} · {runtime["systemRamMB"]} MB RAM · {runtime["graphics"]}'
cold = (f'Process → Awake {runtime["startupToAwakeMs"]:.1f} ms. Awake → world đầu {runtime["awakeToSceneMs"]:.1f} ms. '
        f'Process → ảnh world đầu sau warm-up {runtime["processToFirstWorldCaptureMs"]:.1f} ms.')
options = "".join(f"<option>{escape(name)}</option>" for name in sorted(attachments))
markup = r"""<!doctype html>
<html lang="vi" data-view="fit"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>LumaSprite · E8.3 Runtime Hardening</title><style>
:root{color-scheme:dark;--paper:#161e1e;--card:#23302f;--rule:#465654;--text:#f6f1de;--muted:#c0ceca;--gold:#ffd77c;--mint:#9ee6d6}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--text);font:16px/1.55 system-ui,sans-serif}
main{max-width:1280px;margin:auto;padding:40px 24px 80px}h1,h2{font-family:Georgia,serif;line-height:1.07;margin:.35em 0}
h1{font-size:clamp(2rem,5.8vw,4.2rem)}h2{font-size:clamp(1.65rem,4vw,2.65rem)}
p{color:var(--muted);max-width:88ch}a,summary{color:var(--mint)}summary{cursor:pointer;padding:8px 0;font-weight:700}
section{margin-top:35px;padding-top:17px;border-top:1px solid var(--rule)}nav,.controls{display:flex;flex-wrap:wrap;align-items:center;gap:9px}
nav a,button,select,input,textarea{font:inherit;color:var(--text);background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:5px 10px}
nav a{text-decoration:none}button{cursor:pointer}:focus-visible{outline:2px solid var(--mint);outline-offset:3px}
.label{color:var(--gold);font-weight:700}.three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:9px 0 18px}
figure{margin:0;border:1px solid var(--rule);border-radius:8px;background:var(--card);overflow:hidden}
figcaption{padding:8px 10px;font-weight:650}small{display:block;color:var(--muted);font-size:.8rem}
.pan{overflow:auto}img{display:block;max-width:none;image-rendering:pixelated}[data-view="fit"] img{max-width:100%;height:auto}button[aria-pressed="true"]{background:var(--gold);color:#19211e}
table{border-collapse:collapse;min-width:680px;width:100%;text-align:left}td,th{padding:7px 10px;border-bottom:1px solid var(--rule)}
details{display:block;margin-bottom:12px}pre{white-space:pre;overflow:auto}code{overflow-wrap:anywhere}
fieldset{border:1px solid var(--rule);border-radius:8px;padding:13px;min-width:0}fieldset label{display:block;margin:7px 0}
textarea{display:block;width:100%;margin:8px 0}
@media(max-width:900px){main{padding:24px 13px 58px}.three{grid-template-columns:1fr}}
</style></head><body><main>
<header><p class="label">LumaSprite Engine · E8.3</p><h1>Runtime Hardening</h1>
<p><code>@@STATUS@@</code></p><p>Owner đã xác nhận 5/6 mục của E8. Tương tác qua harness, còn chờ Owner tìm dấu và nhấn E trên bản mới.</p>
<nav aria-label="Báo cáo"><a href="#before">Trước / sau</a><a href="#mistfen-ferry-landing">Mistfen</a><a href="#floodgate-maintenance-yard">Floodgate</a>
<a href="#canal-intake-service-platform">Canal Intake</a><a href="#animation">Animation</a><a href="#qa">QA</a><a href="#owner">Owner Retest</a></nav><div class="controls" style="margin-top:10px"><button type="button" data-view-button="fit" aria-pressed="true">Vừa khung</button><button type="button" data-view-button="native" aria-pressed="false">Pixel gốc 1:1</button></div></header>
<section id="before"><h2>Owner Manual Acceptance · 5/6</h2>
<p>PASS cho di chuyển và va chạm, chuyển scene và ánh sáng, Walk → Idle, save/load và foreground.
Mục tới điểm tương tác rồi nhấn E còn <code>NOT_VERIFIED</code>. Dấu E8 chỉ bật khi đứng đúng range. E8.3 hiện dấu vị trí đứng từ xa và đưa lời nhắc vào dải riêng.</p>
<p><code>INTERACTION_DISCOVERABILITY = REVISION_REQUIRED</code><br><code>OWNER_INTERACTION_RETEST = PENDING</code></p>
@@BEFORE@@
<p>Các ảnh E8.3 bên dưới là framebuffer Windows Player có HUD. Chọn Pixel gốc 1:1 để xem framebuffer nguyên kích thước và cuộn từng ảnh. Ảnh world-only giữ 320×208.</p></section>
@@SCENES@@
<section id="animation"><h2>Surveyor Idle / Walk</h2>
<p>Chuỗi từ camera Unity ở 1×. W2 dùng tám frame, 880 ms mỗi loop. Chuỗi kiểm bước theo rootMotion đã khóa, wrap về frame 0 rồi về Idle tại cùng tọa độ và pivot. Kiểm texture imported có pixel sole ở điểm chạm. Đi tự do vẫn dùng motor 42 px/s, asset chỉ có một hướng.</p>
<p><code>ANIMATION_TECHNICAL_PASS</code> · <code>ARTISTIC_MOTION_REVIEW_PENDING</code></p><div class="three">@@ANIMATION@@</div></section>
<section id="qa"><h2>QA và hiệu năng</h2>
<p>E8 checkpoint <code>@@BASE@@</code><br>Commit triển khai và evidence <code>@@SOURCE@@</code><br>Unity <code>@@UNITY@@</code></p>
<ul><li>Engine 76/76, lint/typecheck/build/CLI smoke, 805 hash lịch sử, 361 artifact tái tạo, 142 payload E7.6R, 42 payload E8 và 96 file importer giống byte.</li>
<li>@@SUITE@@ · Windows Player 6/6 Day/Night, 6/6 native spawn exact, 18 ảnh HUD kiểm marker và đúng trạng thái phím E. Cùng đường xử lý E của runtime.</li>
<li>OS-level physical E <code>NOT_RUN</code> trong QA E8.3. Mục này cần Owner xác nhận.</li>
<li>Canal B2 gốc còn <code>INTAKE_APERTURE_OCCLUDED</code> với 19/35. Staging tách riêng dời Courier (244,110) → (271,110) và lộ 140/140 ROI. Xác minh điểm đứng, collision, depth và route 126 bước đến event tay quay ở Day/Night.</li>
<li>Studio main <code>593650101ed0cd2a54d045197911fc5b7a8bdd83</code>. E8.4 đề xuất giữ atlas per-scene, tile IDs, lớp, mask, anchors và approval trong sidecar có provenance. Fixture Engine và 3 case lỗi qua QA. Native Studio import/save/export <code>NOT_RUN</code>.</li></ul>
<h3>Windows Player · Đo hiệu năng</h3><p>@@HARDWARE@@ · @@VIEW@@ · cap 60 FPS.</p><p>@@COLD@@</p>
<p>E8 báo mean 31,60 ms và p95 16,69 ms ở Mistfen Day. Lượt cũ thiếu thời gian từng frame và ngữ cảnh GC/capture nên chưa đủ bằng chứng quy nguyên nhân. E8.3 ghi 45 frame warm-up, loại 10 frame đầu khỏi steady-state và đếm spike &gt;25 ms. GC là tổng chênh số đếm thế hệ, capture loại khỏi route sample. P95 gần 16,67 ms khi cap 60 không cho biết performance headroom.</p>
<div class="pan"><table><thead><tr><th>Cảnh</th><th>Load ms</th><th>Switch ms</th><th>Warm-up ms</th><th>First movement ms</th>
<th>Steady mean ms</th><th>p95 ms</th><th>Max ms</th><th>Mẫu</th><th>Spikes</th><th>GC delta</th><th>Capture ms</th></tr></thead><tbody>@@PERF@@</tbody></table></div>
<div class="controls"><label for="evidence">Evidence</label><select id="evidence">@@OPTIONS@@</select><button id="download" type="button">Tải tệp</button></div>
<details><summary>SHA-256 evidence</summary><pre>@@HASHES@@</pre></details>
</section>
<section id="owner"><h2>Owner Interaction Retest</h2><p>Chạy E8.3 Player. Dùng 1 cho Mistfen, 2 cho Floodgate, 3 cho Canal Intake. N chuyển Night. Để trống mục chưa kiểm.</p>
<form id="review"><fieldset><legend>Phiếu kiểm thủ công</legend><label>Người đánh giá <input name="reviewer"></label><label>Ngày <input type="date" name="date"></label>
<div id="checks"></div><label>Quyết định <select name="ownerDecision"><option value="">Chưa chọn</option><option>Confirmed</option><option>Needs revision</option></select></label>
<label>Nhận xét<textarea name="notes" rows="3"></textarea></label><button id="export" type="button">Xuất Human Review JSON</button></fieldset></form>
</section></main>
@@DATA@@
<script>
for(const button of document.querySelectorAll('[data-view-button]'))button.onclick=()=>{
 document.documentElement.dataset.view=button.dataset.viewButton;
 for(const peer of document.querySelectorAll('[data-view-button]'))peer.setAttribute('aria-pressed',String(peer===button));
};
const assets=JSON.parse(document.querySelector('#assets').textContent), template=JSON.parse(document.querySelector('#blank-review').textContent);
const checks={mistfenMarker:'Mistfen · Thấy dấu vàng khi ở xa',mistfenPrompt:'Mistfen · Vào tầm, thấy E · Kiểm tra bến phà',
mistfenFeedback:'Mistfen · Nhấn E một lần, thấy xác nhận rồi tự tắt',remotePress:'Ngoài tầm · Nhấn E không phát tương tác hoặc hiện lời nhắc E',
floodgatePrompt:'Floodgate · Tìm tay quay, thấy đúng prompt Day/Night',floodgateFeedback:'Floodgate · Nhấn E, thấy xác nhận event demo',
canalReadability:'Canal Intake · Dấu và prompt đọc được, không che actor hoặc khe nước',
sceneReload:'F5 → đổi cảnh → F9 · Prompt theo vị trí, feedback cũ được xóa',artisticMotion:'Walk → Idle · Độ ổn định ở 1×'};
for(const [name,label] of Object.entries(checks)){
 const line=document.createElement('label');line.textContent=label+' ';
 const input=document.createElement('select');input.name=name;
 for(const [caption,value] of [['Chưa kiểm',''],['PASS','PASS'],['FAIL','FAIL']])input.add(new Option(caption,value));
 line.append(input);document.querySelector('#checks').append(line);
}
function download(blob,name){const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
document.querySelector('#download').onclick=()=>{const name=document.querySelector('#evidence').value,item=assets[name];
 download(new Blob([Uint8Array.from(atob(item.base64),c=>c.charCodeAt(0))]),name);};
document.querySelector('#export').onclick=()=>{const data=new FormData(document.querySelector('#review')), result=structuredClone(template);
 for(const name of Object.keys(result))if(name!=='version')result[name]=data.get(name).trim()||null;
 download(new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'}),'E8.3-HUMAN-REVIEW.json');};
</script></body></html>
"""
values = {
    "STATUS": qa["status"], "BEFORE": before, "SCENES": sections, "ANIMATION": "".join(animation),
    "BASE": qa["base"], "SOURCE": source, "UNITY": runtime["editor"], "SUITE": suite,
    "HARDWARE": escape(hardware), "VIEW": f'{runtime["screenWidth"]}×{runtime["screenHeight"]}, world 320×208',
    "COLD": cold, "PERF": "".join(performance), "OPTIONS": options,
    "HASHES": escape("\n".join(f"{value}  {key}" for key, value in sorted(hashes.items()))),
    "DATA": script("assets", attachments) + script("blank-review", blank),
}
for key, value in values.items():
    markup = markup.replace("@@" + key + "@@", value)
target = root / "docs/reports/E8.3-RUNTIME-HARDENING-REPORT.html"
target.write_bytes(markup.encode("utf-8"))
print(f"{len(drawn)} actual Unity Player PNGs | {len(attachments)} evidence attachments | SHA-256 {sha256(target.read_bytes()).hexdigest()}")
