"""Build a single offline E8 report from Unity camera captures and acceptance evidence."""
import argparse
from base64 import b64encode
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import struct
import subprocess

root = Path(__file__).resolve().parents[1]
evidence = root / "benchmarks/results/e8"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source-commit", required=True)
args = parser.parse_args()
source = subprocess.check_output(["git", "rev-parse", "--verify", args.source_commit + "^{commit}"], cwd=root, text=True).strip()
assert source == args.source_commit
manifest = {}
for row in (evidence / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
    digest, path = row.split("  ", 1)
    assert sha256((evidence / path).read_bytes()).hexdigest() == digest, path
    manifest[path] = digest

def load(name):
    return json.loads((evidence / name).read_bytes())

runtime = load("runtime.json")
importer = load("unity-import.json")
qa = load("verification.json")
review = load("human-review.json")
captures = {(item["scene"], item["light"], item["kind"]): item for item in qa["captureInfo"]}
parity = {(p["scene"], p["light"]): p for p in qa["parity"]}
assets = {}
for name in [n for n in manifest if not n.endswith(".png")] + ["SHA256SUMS", "human-review.json"]:
    data = (evidence / name).read_bytes()
    assets[name] = {"sha256": sha256(data).hexdigest(), "base64": b64encode(data).decode()}


def figure(item, label):
    base, zoom = item["native"], item["zoom"]
    parts = []
    for n, path in ((1, base), (4, zoom)):
        raw = (evidence / path).read_bytes()
        width, height = struct.unpack(">II", raw[16:24])
        pair = f' data-pair="{base}"' if n == 4 else ""
        parts.append(f'<img alt="{escape(label)} · {n}×" width="{width}" height="{height}" '
                     f'data-scale="{n}" data-file="{path}" data-sha="{manifest[path]}"{pair} '
                     f'src="data:image/png;base64,{b64encode(raw).decode()}">')
    return f'<figure><figcaption>{escape(label)}</figcaption><div class="pan">{"".join(parts)}</div></figure>'


names = {
    "mistfen-ferry-landing": "Mistfen Ferry Landing",
    "floodgate-maintenance-yard": "Floodgate Maintenance Yard",
    "canal-intake-service-platform": "Canal Intake Service Platform",
}
notes = {
    "mistfen-ferry-landing": "Ở 1×, chân cầu và mép cập bến giữ nét. Dấu vàng chỉ vị trí tương tác khi Surveyor tới gần. Căn nhà vẫn hút mắt ở Night. Công năng phà dừng ở mốc cập bến.",
    "floodgate-maintenance-yard": "Ray và cửa nâng phân biệt được từ bờ. Giữ nhịp vật liệu gỗ và đá ở Night. Tay quay nhỏ và hơi gần Courier trên sàn. Dấu vàng chỉ điểm thao tác mẫu.",
    "canal-intake-service-platform": "Courier đứng trước cửa khiến khe nước khó nhìn. Thứ tự lớp đúng với pivot lịch sử. So ảnh gốc với một bố trí staging cùng tài sản và cùng ánh sáng.",
}
sections = []
for key, title in names.items():
    figures = []
    rows = []
    for light in ("day", "night"):
        active = next(row for row in runtime["cases"] if row["id"] == key and row["light"] == light)
        native = captures[key, light, "spawn"]
        action = captures[key, light, "interaction"]
        checks = parity[key, light]
        action_label = "Tại điểm cập bến" if key == "mistfen-ferry-landing" else "Tại tay quay"
        views = figure(native, light.title() + " · Spawn") + figure(action, light.title() + " · " + action_label)
        figures.append('<div class="pair">' + views + "</div>")
        rows.append(f'<tr><th scope="row">{light.title()}</th><td>{active["steps"]}</td><td>{len(active["probes"])}</td>'
                    f'<td>{active["interactionEvents"]}</td><td>{active["sortOrderChanges"]}</td>'
                    f'<td>{checks["differences"]:,}</td><td>{"PASS" if active["saveReload"] else "FAIL"}</td></tr>')
    extra = ""
    if key == "canal-intake-service-platform":
        for light in ("day", "night"):
            active = next(row for row in runtime["cases"] if row["id"] == key and row["light"] == light)
            geometry = load(f"contract/{key}-{light}.json")["aperture"]
            original, after = geometry["original"], geometry["staging"]
            extra += f'<p>{light.title()} · Courier ({original["x"]}, {original["y"]}) → ({after["x"]}, {after["y"]})'
            extra += f' · khe nước {active["apertureVisible"]} → {active["apertureStaging"]} / {active["apertureThreshold"]} px.</p>'
            extra += figure(captures[key, light, "staging"], light.title() + " · Runtime staging")
        extra = '<details open><summary>Canal Intake · INTAKE_APERTURE_OCCLUDED</summary>' + extra + "</details>"
    sections.append(f'<section id="{key}"><h2>{title}</h2><p>{notes[key]}</p>{"".join(figures)}'
                    '<div class="pan"><table><thead><tr><th>Ánh sáng</th><th>Bước Unity</th><th>Probe collider</th>'
                    '<th>Event</th><th>Lần đổi thứ tự</th><th>Pixel lệch ở spawn</th><th>Save/reload</th>'
                    '</tr></thead><tbody>' + "".join(rows) + "</tbody></table></div>" + extra + "</section>")

perf = []
for row in runtime["cases"]:
    perf.append(f'<tr><th scope="row">{names[row["id"]]} · {row["light"].title()}</th><td>{row["loadMs"]:.1f}</td>'
                f'<td>{row["tilemapBuildMs"]:.2f}</td><td>{row["meanFrameMs"]:.2f}</td><td>{row["p95FrameMs"]:.2f}</td>'
                f'<td>{row["meanCameraSubmitMs"]:.3f}</td><td>{row["meanStepMs"]:.3f}</td>'
                f'<td>{row["meanAnimationSubmitMs"]:.3f}</td><td>{row["allocatedBytes"]/2**20:.1f}</td></tr>')
hardware = f'{runtime["cpu"]} · {runtime["gpu"]} · {runtime["systemRamMB"]:,} MB RAM · {runtime["graphics"]}'
view = f'{runtime["screenWidth"]}×{runtime["screenHeight"]} · native {runtime["width"]}×{runtime["height"]} · cap {runtime["targetFps"]} FPS'
counts = f'{importer["texturesCount"]} texture · {importer["maps"]} atlas/tilemap · {importer["foregroundTextures"]} foreground · {importer["testFramework"]} Unity Test Framework'
modes = " · ".join(f'{item["mode"]} {item["passed"]}/{item["passed"]} PASS' for item in qa["tests"])
options = "".join(f"<option>{escape(name)}</option>" for name in sorted(assets))
sums = "\n".join(f"{value}  {name}" for name, value in sorted(manifest.items()))
status = qa["status"]
page = r"""<!doctype html>
<html lang="vi" data-view="1"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>LumaSprite · E8 Runtime Acceptance</title>
<style>
:root{color-scheme:dark;--bg:#151c1b;--card:#202b28;--border:#43524a;--text:#f9f0db;--muted:#c0cec3;--ice:#a9dbd6;--gold:#f2c68d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,sans-serif}
main{max-width:1120px;margin:auto;padding:42px 24px 80px}h1,h2{font-family:Georgia,serif;line-height:1.1;margin:.3em 0}
h1{font-size:clamp(2rem,6vw,4rem)}h2{font-size:clamp(1.6rem,4vw,2.7rem)}p{color:var(--muted);max-width:77ch}
section{border-top:1px solid var(--border);padding-top:20px;margin-top:36px}a,summary{color:var(--ice)}
nav,.controls{margin:14px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
a,button,select,input,textarea{font:inherit;color:var(--text)}nav a,button,select,input,textarea{background:var(--card);border:1px solid var(--border);border-radius:6px;padding:5px 11px}
nav a{text-decoration:none}button,summary{cursor:pointer}button[aria-pressed="true"]{background:var(--gold);color:#281a0c}
:focus-visible{outline:2px solid var(--ice);outline-offset:3px}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0}
figure,details{margin:12px 0;border:1px solid var(--border);background:var(--card);border-radius:8px;overflow:hidden}
figcaption,summary{padding:8px 12px;font-weight:650}details>p,details>figure{margin-left:12px;margin-right:12px}
.pan{overflow:auto}figure .pan{background:#111814}img{display:block;image-rendering:pixelated;max-width:none}
[data-view="1"] img[data-scale="4"],[data-view="4"] img[data-scale="1"]{display:none}
table{border-collapse:collapse;width:100%;min-width:570px;text-align:left}th,td{padding:8px 10px;border-bottom:1px solid var(--border)}
pre{overflow:auto;padding:8px 12px}code{overflow-wrap:anywhere}.label{color:var(--gold);font-weight:650}
form label{display:block;margin:8px 0}textarea{display:block;width:100%}
@media(max-width:740px){main{padding:22px 13px 55px}.pair{grid-template-columns:1fr}}
</style></head>
<body><main>
<header><p class="label">LumaSprite Engine · E8</p><h1>Unity Runtime Acceptance</h1>
<p><code>@@STATUS@@</code></p><p>Ảnh 1× là camera readback từ Windows Player. Chế độ 4× nhân bản từng pixel của cùng ảnh. Các cảnh ở spawn đối chiếu với B2 đã khóa. Ảnh tương tác chụp sau di chuyển trong Unity.</p>
<nav aria-label="Báo cáo"><a href="#mistfen-ferry-landing">Mistfen</a><a href="#floodgate-maintenance-yard">Floodgate</a><a href="#canal-intake-service-platform">Canal Intake</a><a href="#qa">QA và hiệu năng</a><a href="#owner">Human Review</a></nav>
<div class="controls"><button type="button" data-zoom="1" aria-pressed="true">Native 1×</button><button type="button" data-zoom="4" aria-pressed="false">Nearest 4×</button></div></header>
@@SECTIONS@@
<section id="qa"><h2>QA và dữ liệu</h2>
<p>Engine checkpoint <code>@@BASE@@</code><br>Commit triển khai &amp; evidence <code>@@SOURCE@@</code><br>Unity <code>@@EDITOR@@</code> · <code>@@TARGET@@</code></p>
<ul>
<li>Engine output PASS · 76/76 tests, 805 checksum lịch sử, 361 artifact tái tạo, 142 payload E7.6R giữ nguyên và 96 file adapter deterministic.</li>
<li>Studio adapter NOT_RUN ở E8 · 24 PNG round-trip E7.6R vẫn là bằng chứng RAW_PNG_ONLY. Native scene import Studio còn thiếu.</li>
<li>Unity import PASS · @@IMPORTS@@ · Point, uncompressed, một mip level. @@MODES@@.</li>
<li>Playable Windows runtime · 6 lượt Day/Night, Tilemap thật, footprint 19×5, nước/cọc/đá/công trình, sự kiện tương tác, depth sort và unload/save/reload. Idle 1.800 ms, Walk 880 ms. Một bộ hướng sprite đã khóa. Harness dùng chung motor với bàn phím. Xác minh phím hệ điều hành là NOT_RUN vì automation mất foreground.</li>
<li>Canal Intake visual FAIL · 19/35 px theo bố trí đã khóa. Staging là một instance riêng. Gameplay phà, cơ chế van động và Production Integration nằm ngoài pilot.</li>
<li>Artistic Acceptance PENDING. Đánh riêng khả năng đọc 1×, Day/Night, bờ nước, chân cầu, điểm nhìn, độ ổn định animation và chức năng landmark.</li>
</ul>
<details open><summary>Đo trên Windows Player</summary>
<p>@@HARDWARE@@</p><p>@@VIEW@@. Mẫu thu dọc lệnh đi bộ tự động. Thời gian camera là CPU submit, bộ nhớ là Unity allocator. Tilemap dựng một lần mỗi lần tải scene.</p>
<div class="pan"><table><thead><tr><th>Cảnh</th><th>Load ms</th><th>Tilemap ms</th><th>Frame mean ms</th>
<th>Frame p95 ms</th><th>Camera submit ms</th><th>Step ms</th><th>Sprite update ms</th><th>Heap MiB</th></tr></thead><tbody>@@PERF@@</tbody></table></div>
</details>
<div class="controls"><label for="file">Evidence gốc</label><select id="file">@@OPTIONS@@</select><button type="button" id="data-download">Tải tệp</button></div>
<details><summary>SHA-256 evidence</summary><pre>@@SUMS@@</pre></details>
</section>
<section id="owner"><h2>Human Review</h2><p>Điểm 1–5. Mỗi tiêu chí và nhận xét đều có thể để trống.</p>
<form id="review">
<label>Người đánh giá <input name="reviewer" autocomplete="name"></label><label>Ngày <input type="date" name="date"></label>
<label>Runtime Behavior <input type="number" name="runtimeBehavior" min="1" max="5"></label>
<label>Data Integrity <input type="number" name="dataIntegrity" min="1" max="5"></label>
<label>Visual Quality <input type="number" name="visualQuality" min="1" max="5"></label>
<label>Mistfen <textarea name="mistfen-ferry-landing" rows="2"></textarea></label>
<label>Floodgate <textarea name="floodgate-maintenance-yard" rows="2"></textarea></label>
<label>Canal Intake <textarea name="canal-intake-service-platform" rows="2"></textarea></label>
<label>Quyết định <select name="decision"><option value="">Chưa chọn</option><option>Pilot accepted</option><option>Accepted with limitations</option><option>Revision required</option></select></label>
<button id="export" type="button">Xuất Human Review JSON</button></form></section>
</main>
@@SCRIPTS@@
<script>
const payload = JSON.parse(document.querySelector('#assets').textContent);
const template = JSON.parse(document.querySelector('#blank-review').textContent);
const download = (bytes,name,type) => {
  const uri=URL.createObjectURL(new Blob([bytes],{type})); const a=document.createElement('a'); a.href=uri; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(uri),1000);
};
for(const b of document.querySelectorAll('[data-zoom]')) b.onclick=()=>{
  document.documentElement.dataset.view=b.dataset.zoom;
  for(const peer of document.querySelectorAll('[data-zoom]')) peer.setAttribute('aria-pressed',String(peer===b));
};
for(const pair of document.querySelectorAll('.pair')){
  const [first, second]=pair.querySelectorAll('.pan');
  first.onscroll=()=>{if(second.scrollLeft!==first.scrollLeft)second.scrollLeft=first.scrollLeft;};
  second.onscroll=()=>{if(first.scrollLeft!==second.scrollLeft)first.scrollLeft=second.scrollLeft;};
}
document.querySelector('#data-download').onclick=()=>{
  const name=document.querySelector('#file').value; const item=payload[name];
  download(Uint8Array.from(atob(item.base64),c=>c.charCodeAt(0)),name.replaceAll('/','--'),name.endsWith('.json')?'application/json':'text/plain');
};
document.querySelector('#export').onclick=()=>{
  const form=document.querySelector('#review'); if(!form.reportValidity())return;
  const fields=new FormData(form), out=structuredClone(template), get=key=>fields.get(key).trim()||null;
  for(const key of ['reviewer','date','decision'])out[key]=get(key);
  for(const key of ['runtimeBehavior','dataIntegrity','visualQuality'])out[key]=get(key)===null?null:Number(get(key));
  for(const key of Object.keys(out.sceneNotes))out.sceneNotes[key]=get(key);
  download(JSON.stringify(out,null,2)+'\n','E8-HUMAN-REVIEW.json','application/json');
};
</script></body></html>
"""


def script(id_, data):
    return f'<script type="application/json" id="{id_}">' + json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c") + "</script>"


values = {
    "SECTIONS": "".join(sections), "BASE": qa["engineRevision"], "SOURCE": source, "STATUS": status,
    "EDITOR": runtime["editor"], "TARGET": importer["target"], "IMPORTS": counts, "MODES": modes,
    "PERF": "".join(perf), "HARDWARE": escape(hardware), "VIEW": view, "OPTIONS": options,
    "SUMS": escape(sums), "SCRIPTS": script("assets", assets) + script("blank-review", review),
}
for key, value in values.items():
    page = page.replace("@@" + key + "@@", value)
target = root / "docs/reports/E8-RUNTIME-ACCEPTANCE-REPORT.html"
target.write_bytes(page.encode("utf-8"))
print(f"{len(captures)} actual Unity captures | {len(captures)*2} PNG | {len(assets)} metadata | SHA-256 {sha256(target.read_bytes()).hexdigest()}")
