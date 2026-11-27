"""Build the offline E7.6 review from verified Engine evidence."""
import argparse
from base64 import b64encode
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[1]
RESULT = ROOT / "benchmarks/results/e76"
OUTPUT = ROOT / "docs/reports/E7.6-PORTABLE-ART-REVIEW.html"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source-commit", required=True)
args = parser.parse_args()
commit = subprocess.check_output(["git", "rev-parse", "--verify", args.source_commit + "^{commit}"], cwd=ROOT, text=True).strip()
if commit != args.source_commit:
    parser.error("Provide a full source commit SHA")
hashes = {}
for row in (RESULT / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
    digest, path = row.split("  ", 1)
    assert sha256((RESULT / path).read_bytes()).hexdigest() == digest, path
    hashes[path] = digest
benchmark = json.loads((RESULT / "benchmark.json").read_bytes())
qa = json.loads((RESULT / "verification.json").read_bytes())
review = json.loads((RESULT / "human-review.json").read_bytes())
images = {}


def image(path, label, scale=None, base=None):
    raw = (RESULT / path).read_bytes()
    width, height = struct.unpack(">II", raw[16:24])
    token = f' data-scale="{scale}"' if scale else ""
    source = f' data-pair="{escape(base)}"' if base else ""
    images[path] = hashes[path]
    payload = b64encode(raw).decode()
    return (f'<img alt="{escape(label)}" width="{width}" height="{height}"{token}{source} '
            f'data-path="{escape(path)}" data-sha="{hashes[path]}" src="data:image/png;base64,{payload}">')


def comparison(case, label, name, enlarged=False):
    groups = []
    for key, variant in (("a0", "A0-Matched"), ("b1", "B1")):
        path = f"{case}/{key}/{name}.png"
        alt = f"{variant} · {label}"
        contents = image(path, alt, 1 if enlarged else None)
        if enlarged:
            contents += image(f"{case}/{key}/{name}-4x.png", alt + " · 4×", 4, path)
        groups.append(f'<figure><figcaption>{alt}</figcaption><div class="viewport">{contents}</div></figure>')
    return '<div class="pair">' + "".join(groups) + "</div>"


def details(title, body):
    return f'<details><summary>{title}</summary>{body}</details>'


def json_script(id_, value):
    return f'<script type="application/json" id="{id_}">' + json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c") + "</script>"


art = {
    "development": (
        "B1 đặt đầu bến sát berth và thu gọn footprint. A0 cho phần tiếp đất rộng hơn ở 1×. "
        "Cả hai cùng dài 186 bước. Outpost và Courier cạnh tranh với mép cập bến. "
        "Đường viền cọc gỗ kém rõ hơn ở Night."
    ),
    "holdout": (
        "Mô-đun hai trụ, dầm và thanh đứng phân biệt cửa xả khỏi địa hình đổ nát. "
        "B1 rút ngắn phần sàn trên đất. A0 để nhiều chỗ quanh nhân vật hơn. "
        "Đoạn nối từ cửa xả xuống lối kiểm tra và chiều dòng chảy cần được đánh giá ở 1×."
    ),
}
case_sections = []
for case in benchmark["cases"]:
    id_ = case["id"]
    name = escape(case["name"])
    variants = case["variants"]
    rows = []
    for idx, v in enumerate(variants):
        day, night = v["illumination"]
        label = ("A0-Matched", "B1")[idx]
        rows.append(
            f'<tr><th scope="row">{label}</th><td>{day["routeLength"]}</td><td>{day["overlap"]}</td>'
            f'<td>{day["waterfrontActorPixels"]}</td><td>{day["atlasTiles"]} / {night["atlasTiles"]}</td>'
            f'<td>{day["seamSamples"]:,}</td></tr>'
        )
    inspected = "".join(comparison(id_, text, file) for text, file in [
        ("Flat geometry · Day", "flat"), ("Semantic regions", "regions"),
        ("Tiếp giáp bờ/nước · Day", "shore-day"), ("Tiếp giáp bờ/nước · Night", "shore-night"),
        ("Walkability và đường tìm từ scene JSON", "walkability"), ("Collision mask", "collision"),
        ("Occlusion và lớp nhìn thấy", "layers"),
    ])
    tiles = "".join(comparison(id_, label, file) for label, file in [
        ("Atlas 16×16 · Day", "atlas-day"), ("Tilemap replay · Day", "tilemap-day"),
        ("Foreground binary alpha · Day", "foreground-day"), ("Atlas 16×16 · Night", "atlas-night"),
        ("Tilemap replay · Night", "tilemap-night"), ("Foreground binary alpha · Night", "foreground-night"),
    ])
    role = "Development" if case["role"] == "development" else "Fresh holdout"
    case_sections.append(
        f'<section id="{id_}"><header><p class="label">{role} · seed {case["seed"]}</p><h2>{name}</h2>'
        f'<p>{escape(case["brief"])}</p></header>'
        + comparison(id_, "Day", "day", True) + comparison(id_, "Night", "night", True)
        + f'<p>{escape(art[case["role"]])}</p>'
        + '<div class="viewport"><table><thead><tr><th>Phương án</th><th>Bước đến bến</th>'
        '<th>Sàn trên đất (px)</th><th>Pixel actor trên vùng ven bờ</th><th>Tile Day / Night</th>'
        '<th>Mẫu kiểm seam mỗi ánh sáng</th></tr></thead><tbody>' + "".join(rows) + "</tbody></table></div>"
        + details("Flat geometry, mép bờ và gameplay overlays",
                  "<p>Điểm xanh biểu thị walkable. Nét vàng là đường BFS trên footprint 19×5. "
                  "Điểm cam là collision. Semantic overlay dùng xanh lam cho nước, vàng đất cho bờ, "
                  "vàng sáng cho lối vào, cam cho boong và tím nâu cho chân đỡ. Lớp actor, prop và kiến trúc lấy từ E6.</p>" + inspected)
        + details("Atlas, tilemap và foreground", tiles)
        + "</section>"
    )

mistfen = benchmark["cases"][0]
trial = mistfen["refinement"]
trial_tiles = []
for row in trial["evidence"]:
    light = row["light"]
    directory = "mistfen-ferry-landing/b1/"
    before = image(f"{directory}{light}.png", f"MF-01 trước thử · {light}")
    edited = image(f"{directory}rim-trial-{light}.png", f"MF-01 thử mép gỗ · {light}")
    target = image(f"{directory}rim-mask-{light}.png", f"MF-01 target mask · {light}")
    delta = image(f"{directory}rim-diff-{light}.png", f"MF-01 pixel diff · {light}")
    trial_tiles.append(f'<div class="pair"><figure><figcaption>B1 trước thử · {light}</figcaption>'
                       f'<div class="viewport">{before}</div></figure>'
                       f'<figure><figcaption>Sau thử · {light}</figcaption><div class="viewport">{edited}</div></figure></div>'
                       f'<div class="pair"><figure><figcaption>Vùng cho phép</figcaption><div class="viewport">{target}'
                       f'</div></figure><figure><figcaption>{row["changed"]} pixel đổi</figcaption>'
                       f'<div class="viewport">{delta}</div></figure></div>')

assert set(images) == {name for name in hashes if name.endswith(".png")}
attachments = {}
non_image = [name for name in hashes if name.endswith(".json")] + [
    "SHA256SUMS", "human-review.json", "verification.json", "studio-parity.json"
]
for name in non_image:
    raw = (RESULT / name).read_bytes()
    attachments[name] = {"sha256": sha256(raw).hexdigest(), "base64": b64encode(raw).decode()}
for name in ("pilot-lock.json", "floodgate-freeze.json", "mistfen-landing.json", "floodgate-yard.json"):
    raw = (ROOT / "benchmarks/fixtures/e76" / name).read_bytes()
    attachments[name] = {"sha256": sha256(raw).hexdigest(), "base64": b64encode(raw).decode()}
attachment_options = "".join(f'<option value="{escape(name)}">{escape(name)}</option>' for name in sorted(attachments))
sums = "\n".join(f"{value}  {path}" for path, value in sorted(images.items()))
attachment_sums = "\n".join(f'{value["sha256"]}  {path}' for path, value in sorted(attachments.items()))
doc = r"""<!doctype html>
<html lang="vi" data-zoom="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>LumaSprite Engine · E7.6 Art Review</title>
<style>
:root{color-scheme:dark;--bg:#161b1a;--surface:#1e2624;--line:#394740;--text:#f4f0dd;--muted:#bbc5b7;--accent:#f0bc80;--river:#99d0ca}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 "Segoe UI",system-ui,sans-serif}
main{max-width:1140px;margin:auto;padding:48px 24px 96px}
h1,h2,h3,p,figure{margin:0}
h1{max-width:890px;font:700 clamp(2rem,5.8vw,4.2rem)/1.05 Georgia,serif;letter-spacing:-.036em;margin:.25em 0}
h2{font:700 clamp(1.75rem,4vw,2.6rem)/1.18 Georgia,serif;letter-spacing:-.02em;margin:.2em 0}
h3{font-size:1.03rem}
p{max-width:80ch;margin:.8em 0;color:var(--muted)}
a{color:var(--river);text-underline-offset:.2em}
button,select,textarea,input{font:inherit}
nav,.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:1em 0}
nav a,button,select,input,textarea{border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--text);padding:5px 10px}
nav a{text-decoration:none}
button{cursor:pointer}
button[aria-pressed="true"]{border-color:var(--accent);color:#171413;background:var(--accent);font-weight:700}
:focus-visible{outline:2px solid var(--river);outline-offset:3px}
section{border-top:1px solid var(--line);margin:36px 0;padding:23px 0 0}
.label{color:var(--accent);font-size:.82rem;letter-spacing:.05em;font-weight:700}
.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:14px 0}
figure{min-width:0;background:var(--surface);border:1px solid var(--line);border-radius:9px;overflow:hidden}
figcaption{font-weight:650;padding:9px 14px;border-bottom:1px solid var(--line)}
figure>p{padding:0 14px}
.viewport{overflow:auto}
figure .viewport{background:#151c19}
img{display:block;image-rendering:pixelated;max-width:none}
[data-zoom="1"] img[data-scale="4"],[data-zoom="4"] img[data-scale="1"]{display:none}
[data-zoom="4"] img[data-scale="4"]{width:1280px;height:832px}
details{margin:14px 0;border:1px solid var(--line);border-radius:8px;padding:5px 13px}
summary{cursor:pointer;padding:8px 0;color:var(--river);font-weight:650}
table{border-collapse:collapse;width:100%;min-width:550px;text-align:left;font-variant-numeric:tabular-nums}
th,td{border-bottom:1px solid var(--line);padding:8px 10px}
td{color:var(--muted)}
code,pre{font-family:ui-monospace,monospace}
code{overflow-wrap:anywhere}
pre{overflow:auto;padding:12px;border-radius:7px;background:var(--surface);font-size:.84rem}
ul{padding-left:1.3em}
fieldset{border:1px solid var(--line);border-radius:8px;margin:12px 0;padding:14px;min-width:0}
textarea{display:block;width:100%;margin:.5em 0}
@media(max-width:715px){main{padding:26px 14px 60px}.pair{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style>
</head>
<body>
<main>
<header>
<p class="label">LumaSprite Engine · E7.6</p>
<h1>Environment Semantic Composition</h1>
<p><b>Hai cảnh đã qua kiểm tra đường đi, collision và tái tạo tilemap.</b> Project Owner chọn phương án mỹ thuật sau khi xem ở kích thước gốc.</p>
<nav aria-label="Báo cáo">
<a href="#mistfen-ferry-landing">Mistfen Ferry Landing</a><a href="#floodgate-maintenance-yard">Floodgate holdout</a>
<a href="#qa">QA và dữ liệu</a><a href="#review">Phiếu đánh giá</a>
</nav>
<div class="controls" aria-label="Kích thước cảnh">
<button type="button" data-zoom-button="1" aria-pressed="true">Native 1×</button>
<button type="button" data-zoom-button="4" aria-pressed="false">Nearest-neighbor 4×</button>
</div>
<p>Ảnh chính ở 1× hiển thị đúng 320×208 px khi trình duyệt ở 100%. Chế độ 4× dùng PNG được Engine xuất ở 1280×832. Cuộn một ảnh để đối chiếu cùng vùng trong ảnh bên cạnh.</p>
</header>
__CASES__
<section id="refinement"><h2>MF-01 · Mép ván cập bến</h2>
<p>Dải gỗ rộng 3 px ở mép trong của berth thử tách mặt ván khỏi nước. Mọi pixel ngoài mask, lớp foreground, hình học và gameplay giữ nguyên. Cả hai ánh sáng cho thay đổi nhẹ ở 1×. Giữ bản gốc theo <code>NO_MEANINGFUL_VISUAL_GAIN</code>. Human Review còn trống.</p>
__TRIAL__
</section>
<section id="qa">
<h2>Kiểm chứng kỹ thuật</h2>
<p><code>E7_6_READY_FOR_HUMAN_ENVIRONMENT_REVIEW</code></p>
<p>Commit triển khai <code>__COMMIT__</code><br>Checkpoint E7.5R <code>__CHECKPOINT__</code></p>
<ul>
<li>73/73 Engine tests, lint, typecheck, build, CLI smoke. 805 historical checksums, 361 artifact dựng lại, 263 SHA-256 E7.5R và regression E3/E6/E7.</li>
<li>8 biến thể ánh sáng qua QA. Dựng lại 91 payload byte-for-byte. Scene JSON và atlas kiểm các vùng nước, polygon vật cản, mask cầu liên tục, spawn, anchors, scale và pixel foreground.</li>
<li>5 loại lỗi chủ động được bắt trên B1 của mỗi cảnh. Route bị chặn, cầu không chạm bờ, tile mất, collision nước sai và lớp che actor sai.</li>
<li>Studio giữ nguyên RGBA qua 16 lần mở, lưu và xuất PNG. Lượt gọi AI là 0.</li>
</ul>
<h3>Giới hạn</h3>
<p>Waterfront dùng mặt nước tĩnh, freeboard biểu diễn trên ảnh và collision 2D. Thuyền, tương tác cập bến, dòng chảy, chuyển động cửa xả và vật lý đa tầng là <code>CAPABILITY_GAP</code>. Nhập scene/atlas vào runtime game và điều khiển actor ở runtime cần được xác minh ở giai đoạn được phê duyệt. B1 đạt chức năng trong hai brief này. Phần tiếp đất nhỏ hơn và nhận diện bến ở 1× cần Owner đánh giá.</p>
__CLOSEOUT__
<h3>Tải evidence gốc</h3>
<div class="controls"><label for="evidence-file">Tệp</label><select id="evidence-file">__OPTIONS__</select>
<button type="button" id="download-evidence">Tải tệp</button></div>
<details><summary>SHA-256 của __COUNT__ ảnh PNG nhúng</summary><pre>__SUMS__</pre></details>
<details><summary>SHA-256 của metadata nhúng</summary><pre>__ATTACHMENT_SUMS__</pre></details>
</section>
<section id="review"><h2>Human Review</h2>
<p>Chấm sau khi xem Day/Night ở 1×. Bỏ trống tiêu chí chưa đánh giá. Xuất JSON để gửi quyết định của reviewer.</p>
<form id="review-form">
<div class="controls"><label for="reviewer">Người đánh giá</label><input id="reviewer" name="reviewer" autocomplete="name">
<label for="review-date">Ngày</label><input type="date" id="review-date" name="date"></div>
<div id="review-fields"></div>
<label for="final-recommendation">Kết luận</label><textarea id="final-recommendation" name="finalRecommendation" rows="3"></textarea>
<button id="export-review" type="button">Xuất Human Review JSON</button>
</form>
</section>
</main>
__JSON__
<script>
const review = JSON.parse(document.getElementById('blank-review').textContent);
const files = JSON.parse(document.getElementById('attachments').textContent);
const download = (bytes, file, mime) => {
  const url = URL.createObjectURL(new Blob([bytes], {type:mime}));
  const a = document.createElement('a');
  a.href = url; a.download = file; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.getElementById('download-evidence').onclick = () => {
  const path = document.getElementById('evidence-file').value;
  const bytes = Uint8Array.from(atob(files[path].base64), c => c.charCodeAt(0));
  download(bytes, path.replaceAll('/', '--'), path.endsWith('.json') ? 'application/json' : 'text/plain');
};
for (const button of document.querySelectorAll('[data-zoom-button]')) button.onclick = () => {
  document.documentElement.dataset.zoom = button.dataset.zoomButton;
  for (const peer of document.querySelectorAll('[data-zoom-button]')) peer.setAttribute('aria-pressed', String(peer === button));
};
for (const pair of document.querySelectorAll('.pair:has(img[data-scale="4"])')) {
  const [a,b] = pair.querySelectorAll('.viewport');
  a.onscroll = () => { if (b.scrollLeft !== a.scrollLeft) b.scrollLeft = a.scrollLeft; };
  b.onscroll = () => { if (a.scrollLeft !== b.scrollLeft) a.scrollLeft = b.scrollLeft; };
}
const form = document.getElementById('review-form');
const names = {'mistfen-ferry-landing':'Mistfen Ferry Landing','floodgate-maintenance-yard':'Floodgate Maintenance Yard'};
const criteria = {function:'Công năng',composition:'Bố cục',perspective:'Góc nhìn',transition:'Tiếp giáp',materials:'Vật liệu',
  clusters:'Cụm pixel',outlines:'Đường viền',lighting:'Ánh sáng',dayNight:'Độ rõ Day/Night',focalOrder:'Thứ tự điểm nhìn',
  scale:'Tỷ lệ',navigation:'Lối đi'};
for (const c of review.cases) {
  const field = document.createElement('fieldset');
  const choices = '<select name="' + c.id + ':choice"><option value="">Chưa chọn</option><option>A0-Matched</option><option>B1</option><option>Neither</option></select>';
  const rows = Object.entries(criteria).map(([key,label]) =>
    '<tr><th scope="row">' + label + '</th>' + ['a0Matched','b1'].map((variant,i) => '<td><input type="number" min="1" max="5" aria-label="' + label +
    ' ' + (i ? 'B1' : 'A0-Matched') + '" name="' + [c.id,variant,key].join(':') + '"></td>').join('') + '</tr>').join('');
  field.innerHTML = '<legend>' + names[c.id] + '</legend><label>Chọn phương án ' + choices + '</label>' +
    '<details><summary>Điểm theo tiêu chí (1–5)</summary><div class="viewport"><table><thead><tr><th>Tiêu chí</th>' +
    '<th>A0-Matched</th><th>B1</th></tr></thead><tbody>' + rows + '</tbody></table></div></details><label>Nhận xét<textarea rows="2" name="' + c.id + ':comments"></textarea></label>';
  document.getElementById('review-fields').append(field);
}
document.getElementById('export-review').onclick = () => {
  if (!form.reportValidity()) return;
  const output = structuredClone(review);
  const fields = new FormData(form);
  for (const key of ['reviewer','date','finalRecommendation']) output[key] = fields.get(key).trim() || null;
  for (const c of output.cases) {
    for (const key of ['choice','comments']) c[key] = fields.get(c.id + ':' + key).trim() || null;
    for (const [variant, scores] of Object.entries(c.scores)) for (const key of Object.keys(scores)) {
      const raw = fields.get([c.id,variant,key].join(':'));
      scores[key] = raw ? Number(raw) : null;
    }
  }
  download(JSON.stringify(output,null,2) + '\n', 'E7.6-HUMAN-REVIEW.json', 'application/json');
};
</script>
</body>
</html>
"""
closeout = details("E7.5R · Khuyến nghị closeout",
    "<p><code>ASSISTANT_REVIEW_RECOMMENDATION</code>. Engineering APPROVED. Ridge là tham chiếu nghiên cứu, "
    "cờ lê 51/43 px, khe chân 9/6 hàng, biên yếu Night 5/3, hộp dụng cụ còn mơ hồ. Marsh phù hợp nghiên cứu có giới hạn, "
    "móc 65/48 px, khoảng âm tốt hơn, công cụ và thao tác thu hoạch chưa rõ ở 1×. Canal xác minh hai tay nắm tĩnh và mũ vành rộng, "
    "tay xa lẫn vào cán, cân bằng tải động và animation chưa xác minh. Final Character Art NOT APPROVED FOR PRODUCTION. "
    "Character Animation PENDING STATIC ART ACCEPTANCE. E7.5RR và E8 chưa được phép. E7.6 được phép theo brief.</p>")
replacements = {
    "CASES": "".join(case_sections), "TRIAL": "".join(trial_tiles), "COMMIT": commit,
    "CHECKPOINT": benchmark["checkpoint"], "CLOSEOUT": closeout, "OPTIONS": attachment_options,
    "COUNT": str(len(images)), "SUMS": escape(sums), "ATTACHMENT_SUMS": escape(attachment_sums),
    "JSON": json_script("blank-review", review) + json_script("attachments", attachments) + json_script("technical-qa", qa),
}
for key, value in replacements.items():
    doc = doc.replace("__" + key + "__", value)
OUTPUT.write_bytes(doc.encode("utf-8"))
print(f"{OUTPUT.name} · {len(images)} PNG · {len(attachments)} evidence files · SHA-256 {sha256(OUTPUT.read_bytes()).hexdigest()}")
