"""Package E7.6R review evidence, locked controls and gameplay data in one HTML."""
import argparse
from base64 import b64encode
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import struct
import subprocess

root = Path(__file__).resolve().parents[1]
old = root / "benchmarks/results/e76"
new = root / "benchmarks/results/e76r"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--artifact-commit", required=True)
args = parser.parse_args()
artifact_commit = subprocess.check_output(["git", "rev-parse", "--verify", args.artifact_commit + "^{commit}"], cwd=root, text=True).strip()
assert artifact_commit == args.artifact_commit
bm = json.loads((new / "benchmark.json").read_bytes())
qa = json.loads((new / "verification.json").read_bytes())
blank = json.loads((new / "human-review.json").read_bytes())
sources = {}
for origin in (old, new):
    manifest = {}
    for row in (origin / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        digest, file = row.split("  ", 1)
        assert sha256((origin / file).read_bytes()).hexdigest() == digest, file
        manifest[file] = digest
    sources[origin] = manifest
images = {}
attachments = {}


def b64(raw):
    return b64encode(raw).decode("ascii")


def figure(origin, path, text, zoom=None, base=None):
    raw = (origin / path).read_bytes()
    identity = origin.name + "/" + path
    digest = sources[origin][path]
    images[identity] = digest
    width, height = struct.unpack(">II", raw[16:24])
    selector = f' data-scale="{zoom}"' if zoom else ""
    if base:
        selector += f' data-pair="{escape(origin.name + "/" + base)}"'
    return (f'<img src="data:image/png;base64,{b64(raw)}" alt="{escape(text)}" width="{width}" height="{height}"'
            f' data-path="{escape(identity)}" data-sha="{digest}"{selector}>')


def comparisons(case, file, title, zoom=False, fresh=False):
    cells = []
    for v in case["variants"]:
        variant = v["variant"]
        label = {"a0": "A0-Matched", "b1": "B1", "b2": "B2"}[variant]
        ref = old if v["archive"] and not fresh else new
        base = f'{case["id"]}/{variant}/{file}.png'
        views = figure(ref, base, label + " · " + title, 1 if zoom else None)
        if zoom:
            path = f'{case["id"]}/{variant}/{file}-4x.png'
            views += figure(ref, path, label + " · " + title + " 4×", 4, base)
        cells.append('<figure><figcaption>' + label + ' · ' + title + '</figcaption><div class="pan">' + views + "</div></figure>")
    return '<div class="comparison">' + "".join(cells) + "</div>"


def disclosure(title, content):
    return f"<details><summary>{title}</summary>{content}</details>"


def attach(path, label):
    raw = path.read_bytes()
    attachments[label] = {"sha256": sha256(raw).hexdigest(), "base64": b64(raw)}


notes = {
    "development": "B2 tách nhịp ván ở đầu bến và làm chốt chữ T đọc rõ hơn. Vùng nước có nhiều khoảng nghỉ hơn. Ánh đèn nhà vẫn cạnh tranh với đầu bến. Nhận diện đây là bến phà còn hạn chế khi thiếu thuyền.",
    "known-diagnostic": "Ray, dầm kéo và khe dưới cánh rõ hơn. Tay quay có vị trí đứng kiểm được từ export. Tay quay còn nhỏ và liên kết cơ khí với cửa chưa rõ ở 1×.",
    "fresh-holdout": "Capability gap tại cửa lấy nước. Actor ở cao độ chiếu hiện tại che quá nhiều khe cửa. Đường đi, tay quay và replay đều qua QA. Hình ảnh và tiêu chí gốc được giữ nguyên.",
}
sections = []
for case in bm["cases"]:
    id_ = case["id"]
    arts = notes[case["role"]]
    rows = ""
    for v in case["variants"]:
        day = v["metrics"][0]
        maint = "—" if day["maintenanceSteps"] is None else str(day["maintenanceSteps"])
        aperture = "—" if not day["apertureWater"] and not day["semanticGap"] else str(day["apertureWater"])
        gap = " · CAPABILITY_GAP" if day["semanticGap"] else ""
        label = {"a0": "A0-Matched", "b1": "B1", "b2": "B2"}[v["variant"]]
        rows += (f'<tr><th scope="row">{label}</th><td>{day["counts"]["routeLength"]}</td><td>{maint}</td><td>{aperture}{gap}</td>'
                 f'<td>{day["collisionPixelsChanged"]}</td><td>{day["seams"]:,}</td></tr>')
        for light in ("day", "night"):
            for file in ("scene", "tilemap"):
                name = f'{id_}/{v["variant"]}/{file}-{light}.json'
                origin = old if v["archive"] else new
                attach(origin / name, name)
    views = (
        comparisons(case, "day", "Day", True)
        + comparisons(case, "night", "Night", True)
        + f"<p>{escape(arts)}</p>"
        + '<div class="pan"><table><thead><tr><th>Phương án</th><th>Bước đến bến</th><th>Bước đến tay quay</th>'
          '<th>Pixel nước dưới khe (≥35)</th><th>Pixel collision đổi</th><th>Mẫu seam</th></tr></thead>'
        + "<tbody>" + rows + "</tbody></table></div>"
    )
    closeups = "".join(comparisons(case, "berth-" + light, "Cầu và chốt bến · " + light.title(), fresh=True) for light in ("day", "night"))
    closeups += "".join(comparisons(case, "shore-" + light, "Tiếp giáp bờ · " + light.title()) for light in ("day", "night"))
    if case["role"] != "development":
        closeups += "".join(comparisons(case, "mechanism-" + light, "Cửa và bệ thao tác · " + light.title(), fresh=True)
                            for light in ("day", "night"))
    masks = "".join(comparisons(case, file, label) for file, label in (
        ("flat", "Flat geometry"), ("regions", "Semantic regions"), ("walkability", "Walkability"),
        ("collision", "Collision"), ("layers", "Occlusion"), ("atlas-day", "Atlas Day"), ("tilemap-day", "Tilemap Day"),
    ))
    for file, label in (("material-modules", "Mask vật liệu mô-đun B2"), ("diff-b1", "Pixel diff B1 → B2")):
        key = f"{id_}/b2/{file}.png"
        masks += f'<figure><figcaption>{label}</figcaption><div class="pan">{figure(new, key, label)}</div></figure>'
    label = {"development": "Development", "known-diagnostic": "Known diagnostic", "fresh-holdout": "Fresh holdout"}[case["role"]]
    sections.append(f'<section id="{id_}"><p class="eyebrow">{label} · seed {case["seed"]}</p>'
                    f'<h2>{escape(case["name"])}</h2><p>{escape(case["brief"])}</p>{views}'
                    + disclosure("Cận cảnh native 1×", closeups)
                    + disclosure("Masks, gameplay overlays, atlas và tilemap", masks) + "</section>")

for file in ("SHA256SUMS", "verification.json", "benchmark.json", "human-review.json",
             "studio-parity-c56837e.json", "studio-parity-5936501.json"):
    attach(new / file, file)
for file in ("canal-intake-service-platform.json", "holdout-freeze.json", "study.json"):
    attach(root / "benchmarks/fixtures/e76r" / file, file)
options = "".join(f'<option>{escape(name)}</option>' for name in sorted(attachments))
report = r"""<!doctype html>
<html lang="vi" data-scale="1">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>LumaSprite Engine · E7.6R Art Review</title>
<style>
:root{color-scheme:dark;--paper:#161d1b;--panel:#202a26;--line:#435249;--text:#f8f2df;--muted:#bfcec4;--cool:#9fe2d2;--warm:#f3c294}
*{box-sizing:border-box} body{margin:0;background:var(--paper);color:var(--text);font:16px/1.6 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:38px 24px 80px} h1,h2{font-family:Georgia,serif;line-height:1.12;margin:.3em 0}
h1{font-size:clamp(2rem,5vw,4rem);max-width:900px} h2{font-size:clamp(1.65rem,3.7vw,2.6rem)} p{max-width:79ch;color:var(--muted)}
.eyebrow{color:var(--warm);font-weight:700;letter-spacing:.025em} section{border-top:1px solid var(--line);padding-top:20px;margin-top:34px}
nav,.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0}
nav a,button,select,input,textarea{font:inherit;background:var(--panel);border:1px solid var(--line);border-radius:6px;color:var(--text);padding:5px 11px}
nav a{text-decoration:none} a,summary{color:var(--cool)} button,summary{cursor:pointer}
[aria-pressed="true"]{background:var(--warm);color:#20160c;font-weight:700}
:focus-visible{outline:2px solid var(--cool);outline-offset:3px}
.comparison{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}
figure{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}
figcaption{padding:8px 11px;border-bottom:1px solid var(--line);font-weight:600}
img{display:block;image-rendering:pixelated;max-width:none}
[data-scale="1"] img[data-scale="4"],[data-scale="4"] img[data-scale="1"]{display:none}
.pan{overflow:auto} figure .pan{background:#121916}
table{border-collapse:collapse;min-width:550px;width:100%;text-align:left} td,th{padding:7px 9px;border-bottom:1px solid var(--line)}
details,fieldset{border:1px solid var(--line);border-radius:7px;padding:9px 12px;margin:12px 0;min-width:0}
pre{overflow:auto;font-size:.82rem} code{overflow-wrap:anywhere} textarea{display:block;width:100%;margin:8px 0} .review-scores input{width:70px}
@media(max-width:800px){main{padding:22px 12px 50px}.comparison{grid-template-columns:1fr}}
</style>
</head>
<body>
<main>
<header><p class="eyebrow">LumaSprite Engine · E7.6R</p>
<h1>Functional Environment Quality</h1>
<p>B2 qua gameplay QA ở cả ba cảnh. Canal Intake giữ lại một lỗi nhận diện thị giác ở khe cửa. Đánh giá ở ảnh native 1× rồi dùng 4× để xem chi tiết.</p>
<nav aria-label="Mục báo cáo"><a href="#mistfen-ferry-landing">Mistfen</a><a href="#floodgate-maintenance-yard">Floodgate</a>
<a href="#canal-intake-service-platform">Canal Intake</a><a href="#qa">QA và dữ liệu</a><a href="#review">Human Review</a></nav>
<div class="actions"><button type="button" data-zoom="1" aria-pressed="true">Native 1×</button><button type="button" data-zoom="4" aria-pressed="false">Nearest-neighbor 4×</button></div>
</header>
@@SECTIONS@@
<section id="qa"><h2>Kiểm chứng và giới hạn</h2>
<p><code>E7_6R_READY_FOR_FINAL_HUMAN_ENVIRONMENT_REVIEW</code></p>
<ul>
<li>18 lượt scene Day/Night qua spatial QA. B2 kiểm BFS trên scene JSON cho footprint Surveyor 19×5, kiểm anchor, collision, occlusion, khớp tile seam và replay exact RGBA.</li>
<li>73/73 Engine tests và CLI smoke. 805 historical hashes, 361 artifact tái tạo và 91 payload E7.6. 24 lượt Studio PNG round-trip trên hai revision.</li>
<li>Canal Intake giữ nguyên brief, seed, asset và renderer đã khóa. <code>INTAKE_APERTURE_OCCLUDED</code> là lỗi nhận diện thị giác. Không thay đổi bố trí actor để cải thiện kết quả.</li>
<li><code>BOAT_ASSET_CAPABILITY_GAP</code>, cơ chế cửa van động và nhập runtime vẫn là giới hạn. E8 chỉ thiết kế Preflight.</li>
</ul>
<p>Commit renderer đã khóa <code>@@SOURCE@@</code><br>Commit evidence và QA <code>@@ARTIFACT@@</code><br>Checkpoint E7.6 <code>@@BASE@@</code></p>
<details><summary>E7.6 closeout</summary><p>ASSISTANT_REVIEW_RECOMMENDATION. E7.6 Engineering APPROVED.
Mistfen B1 SELECTED_FOR_REFINEMENT. Floodgate B1 APPROVED_WITH_LIMITATIONS. Semantic Environment Contract APPROVED_FOR_RESEARCH.
Generalization PARTIAL_PASS. Production Integration NOT AUTHORIZED. E7.6R được phép theo brief. E8 PREFLIGHT DESIGN ONLY.</p></details>
<div class="actions"><label for="file">Evidence gốc</label><select id="file">@@OPTIONS@@</select><button type="button" id="download-file">Tải tệp</button></div>
<details><summary>SHA-256 của @@COUNT@@ PNG nhúng</summary><pre>@@SUMS@@</pre></details>
<details><summary>SHA-256 của metadata nhúng</summary><pre>@@META_SUMS@@</pre></details>
</section>
<section id="review"><h2>Human Review</h2><p>Chấm riêng bốn tiêu chí từ 1 đến 5 sau khi xem 1×. Có thể để trống mục chưa đánh giá.</p>
<form id="review-form"><div class="actions"><label for="reviewer">Reviewer</label><input name="reviewer" id="reviewer">
<label for="when">Ngày</label><input name="date" id="when" type="date"></div><div id="criteria"></div>
<label for="recommendation">Kết luận</label><textarea rows="3" id="recommendation" name="finalRecommendation"></textarea>
<button type="button" id="export-review">Xuất Human Review JSON</button></form></section>
</main>
@@DATA@@
<script>
const template=JSON.parse(document.querySelector('#blank-review').textContent), files=JSON.parse(document.querySelector('#attachments').textContent);
const download=(bytes,name,type)=>{const uri=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=uri;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(uri),1000);};
for(const b of document.querySelectorAll('[data-zoom]')) b.onclick=()=>{
  document.documentElement.dataset.scale=b.dataset.zoom;
  for(const peer of document.querySelectorAll('[data-zoom]')) peer.setAttribute('aria-pressed',String(peer===b));
};
for(const group of document.querySelectorAll('.comparison:has(img[data-scale="4"])')){
  const panes=[...group.querySelectorAll('.pan')];
  for(const pane of panes) pane.onscroll=()=>{for(const other of panes) if(other!==pane&&other.scrollLeft!==pane.scrollLeft) other.scrollLeft=pane.scrollLeft;};
}
document.querySelector('#download-file').onclick=()=>{
  const name=document.querySelector('#file').value;
  download(Uint8Array.from(atob(files[name].base64),c=>c.charCodeAt(0)),name.replaceAll('/','--'),name.endsWith('.json')?'application/json':'text/plain');
};
const labels={semanticRecognition:'Semantic Recognition',visualQuality:'Visual Quality',gameplayQuality:'Gameplay Quality',generalization:'Generalization'};
const names=['Mistfen Ferry Landing','Floodgate Maintenance Yard','Canal Intake Service Platform'];
const variants={a0Matched:'A0-Matched',b1:'B1',b2:'B2'};
for(const [i,c] of template.cases.entries()){
  const field=document.createElement('fieldset');
  const rows=Object.entries(labels).map(([key,label])=>'<tr><th scope="row">'+label+'</th>'+Object.entries(variants).map(([v,text])=>
    '<td><input type="number" min="1" max="5" aria-label="'+label+' '+text+'" name="'+[c.id,v,key].join(':')+'"></td>').join('')+'</tr>').join('');
  field.innerHTML='<legend>'+names[i]+'</legend><label>Phương án <select name="'+c.id+':choice"><option value="">Chưa chọn</option><option>A0-Matched</option><option>B1</option><option>B2</option><option>Neither</option></select></label>'+
  '<div class="pan review-scores"><table><thead><tr><th>Tiêu chí</th><th>A0-Matched</th><th>B1</th><th>B2</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
  '<label>Nhận xét<textarea rows="2" name="'+c.id+':comments"></textarea></label>';
  document.querySelector('#criteria').append(field);
}
document.querySelector('#export-review').onclick=()=>{
 const form=document.querySelector('#review-form');
 if(!form.reportValidity()) return;
 const data=new FormData(form), result=structuredClone(template);
 const value=name=>data.get(name).trim()||null;
 for(const key of ['reviewer','date','finalRecommendation']) result[key]=value(key);
 for(const c of result.cases){
  for(const key of ['choice','comments']) c[key]=value(c.id+':'+key);
  for(const [v,scores] of Object.entries(c.scores)) for(const key of Object.keys(scores)){
    const raw=value([c.id,v,key].join(':')); scores[key]=raw===null?null:Number(raw);
  }
 }
 download(JSON.stringify(result,null,2)+'\n','E7.6R-HUMAN-REVIEW.json','application/json');
};
</script></body></html>
"""


def script(id_, data):
    return f'<script type="application/json" id="{id_}">' + json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c") + "</script>"


values = {
    "SECTIONS": "".join(sections), "SOURCE": bm["frozenBenchmark"], "ARTIFACT": artifact_commit, "BASE": bm["baseline"],
    "OPTIONS": options, "COUNT": str(len(images)),
    "SUMS": escape("\n".join(f"{v}  {k}" for k, v in sorted(images.items()))),
    "META_SUMS": escape("\n".join(f'{v["sha256"]}  {k}' for k, v in sorted(attachments.items()))),
    "DATA": script("blank-review", blank) + script("attachments", attachments) + script("technical-qa", qa),
}
for name, value in values.items():
    report = report.replace("@@" + name + "@@", value)
path = root / "docs/reports/E7.6R-PORTABLE-ART-REVIEW.html"
path.write_bytes(report.encode("utf-8"))
print(f"{len(images)} PNG | {len(attachments)} metadata | SHA-256 {sha256(path.read_bytes()).hexdigest()}")
