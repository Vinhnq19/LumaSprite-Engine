"""Build the E9.1 standalone gallery from frozen evidence. Run from Engine root."""
import argparse
import base64
import hashlib
import html
import json
import re
import struct
import subprocess
from pathlib import Path

ROOT = Path("benchmarks/results/e91")
REPORT = Path("docs/reports/E9.1-CHARACTER-ART-QUALITY-REVIEW.html")
FIXTURES = Path("benchmarks/fixtures/e91")
RUBRIC = Path("docs/art-quality/art-quality-rubric-v2.json")
ADDENDUM = RUBRIC.with_name("art-quality-rubric-v2-static-addendum.md")
VIEWS = {
    "sprite": "Sprite hoàn thiện", "body": "Dáng bỏ mũ, tóc và đạo cụ",
    "silhouette": "Silhouette đầy đủ", "parts": "Mặt nạ bộ phận",
    "near": "Cận cảnh tay gần", "far": "Cận cảnh tay xa",
    "material-mask": "Mặt nạ vật liệu", "outline-map": "Bản đồ viền",
    "day": "Gameplay · Day", "night": "Gameplay · Night", "diff": "Pixel thay đổi",
}
LABELS = ["A0 · v3", "B1 · Hình khối", "B2 · Tay nắm", "B3 · Chất liệu", "B4 · Viền"]
BLIND = [3, 1, 4, 0, 2]
TITLES = {"harbor-lockkeeper": "Harbor Lockkeeper", "marsh-apothecary": "Marsh Apothecary"}

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def digest(bytes_):
    return hashlib.sha256(bytes_).hexdigest()

def embed(bytes_):
    return base64.b64encode(bytes_).decode("ascii")

def e(value):
    return html.escape(str(value), quote=True)

def att(name, value):
    return f' {name}="{e(value)}"'

def image(folder, kind, scale, files):
    name = f"{folder}{kind}{'-4x' if scale == 4 else ''}.png"
    data = (ROOT / name).read_bytes()
    key = files[name]
    assert digest(data) == key, name
    width, height = struct.unpack(">II", data[16:24])
    hidden = "" if scale == 1 and kind == "sprite" else " hidden"
    attrs = att("data-file", name) + att("data-sha", key) + att("data-view", kind) + att("data-scale", scale)
    alt = f"{VIEWS[kind]} · {scale}×"
    return (f'<img{attrs} src="data:image/png;base64,{embed(data)}" width="{width}" height="{height}" '
            f'alt="{e(alt)}"{hidden}>')

def gallery(case, files):
    tracks = []
    for track in ("shared", "expanded"):
        cards = []
        for index, label in enumerate(LABELS):
            stage = "a0" if index == 0 else f"b{index}"
            variant = stage + ("-shared" if index and track == "shared" else "")
            folder = case["scope"] + variant + "/"
            if track == "expanded" and index == 0:
                card = '<div class="well notice">A0 có trong tab Thiết bị chung</div>'
            else:
                images = "".join(image(folder, view, scale, files) for view in VIEWS
                                 if folder + view + ".png" in files for scale in (1, 4))
                empty = '<span class="notice no-diff" hidden>Ảnh đầu kỳ</span>'
                card = f'<div class="well">{images}{empty}</div>'
            cards.append(f'<figure data-slot="{index}" data-blind="{BLIND[index]}" data-label="{e(label)}">'
                         f'<figcaption>{e(label)}</figcaption>{card}</figure>')
        # A0 appears only once per seed in the report; move its full card into the active track.
        tracks.append(f'<div class="rail" data-track="{track}"{" hidden" if track == "expanded" else ""}>'
                      + "".join(cards) + "</div>")
    name = TITLES[case["id"]]
    return (f'<section class="study" data-seed="{case["seed"]}"><header><h2>{name}</h2>'
            f'<p>{e(case["role"])} · seed <code>{case["seed"]}</code></p></header>'
            + "".join(tracks) + "</section>")

def download(path):
    bytes_ = path.read_bytes()
    return (f'<a download="{e(path.name)}" href="data:application/octet-stream;base64,{embed(bytes_)}">'
            f'{e(path.name)}</a>')

def qa_table(case):
    rows = []
    for item in case["variants"]:
        checks = item["checks"]
        diff = item["changes"]
        day, night = [light["edge"] for light in item["scenes"]]
        name = item["id"].upper()
        if checks:
            grip = " / ".join(str(hand["overlap"]) for hand in checks["handTests"])
            body = f'{checks["torsoWidth"]} px · {checks["legGapRows"]} hàng trống'
        else:
            grip = "Contact đạt trước khi QA dừng"
            body = "STANCE_GAP · dưới 2 hàng trống"
        changes = f'+{diff["added"]} / −{diff["removed"]} / {diff["paint"]} tô lại' if diff else "Mốc đầu"
        rows.append(f'<tr><th scope="row">{e(name)}</th><td>{e(body)}</td><td>{e(grip)}</td>'
                    f'<td>{day["weak"]}/{day["samples"]} · {night["weak"]}/{night["samples"]}</td>'
                    f'<td>{e(changes)}</td><td>{e(item["hypothesis"])}</td></tr>')
    return (f'<details><summary>{TITLES[case["id"]]} · {case["seed"]}</summary><div class="table-wrap">'
            '<table><thead><tr><th>Checkpoint</th><th>Geometry</th><th>Overlap gần / xa</th>'
            '<th>Cạnh yếu Day · Night</th><th>Delta pixel</th><th>Giả thuyết</th></tr></thead>'
            '<tbody>' + "".join(rows) + '</tbody></table></div></details>')

CSS = """
:root{color-scheme:dark;--bg:#121c23;--panel:#1c2a34;--line:#405361;--text:#f1ebe0;--muted:#bdcbd0;--amber:#ffd08d;--mint:#a9e0c4;--blue:#bcdff3}
*{box-sizing:border-box}html{scroll-padding-top:1rem}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,sans-serif}
a{color:var(--blue)}a:hover{text-decoration-thickness:2px}code{font-size:.89em;color:var(--mint);overflow-wrap:anywhere}
:focus-visible{outline:3px solid var(--amber);outline-offset:3px}[hidden]{display:none!important}
main{width:min(1440px,100%);margin:auto;padding:clamp(1rem,4vw,3rem)}h1,h2,h3{line-height:1.12;margin:0 0 .65rem}h1{font-size:clamp(2.1rem,5.9vw,5.3rem);letter-spacing:-.054em;max-width:17ch}
h2{font-size:clamp(1.35rem,2.6vw,2.3rem);letter-spacing:-.03em}h3{font-size:1.15rem}p{margin:.55rem 0 1rem}ul{margin:.55rem 0 1rem;padding-left:1.25rem}
.intro{border-bottom:1px solid var(--line);padding:0 0 1.35rem;margin:0 0 1.4rem}.brand,.label{font-size:.82rem;font-weight:700;letter-spacing:.105em;text-transform:uppercase;color:var(--mint)}
.status{display:inline-block;color:var(--amber);border:1px solid #8b663f;padding:.35rem .6rem;margin-top:.15rem}.intro p{max-width:70ch;color:var(--muted)}
nav,.controls,.downloads{display:flex;gap:.55rem 1rem;flex-wrap:wrap;align-items:center}nav a,.downloads a{display:inline-flex;align-items:center;min-height:44px}
.controls{padding:.85rem;margin:.9rem 0;background:var(--panel);border:1px solid var(--line);border-radius:.65rem;align-items:end}
.controls label{display:grid;gap:.25rem;font-size:.91rem;color:var(--muted)}select,button{color:var(--text);background:#283d4a;border:1px solid #627782;border-radius:.4rem;padding:.5rem .65rem;min-height:44px;font:inherit;cursor:pointer;max-width:100%}
button[aria-pressed="true"]{color:#131d24;background:var(--mint)}.study{margin:1rem 0 2rem}.study header{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 1rem}.study header p{color:var(--muted)}
.rail{display:flex;gap:.55rem;overflow-x:auto;align-items:stretch;padding:.25rem .15rem .75rem}
figure{margin:0;min-width:118px;flex:1 0 auto;border:1px solid var(--line);border-radius:.52rem;overflow:hidden;background:var(--panel)}
figcaption{padding:.45rem .65rem;font-weight:650;min-height:40px}.well{min-height:99px;min-width:100%;display:grid;place-items:center;background:#788887;padding:.65rem}
[data-bg="dark"] .well{background:#253842}.well img{display:block;image-rendering:pixelated;max-width:none;flex:none}.notice{color:var(--muted);background:var(--panel);padding:.5rem;max-width:20ch}
article.review-notes{border-left:3px solid #e2ac68;padding-left:1rem;margin:1.8rem 0}.review-notes li{margin:.55rem 0}section.report-section{border-top:1px solid var(--line);padding:1.4rem 0}
dl{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:.45rem 1rem}dt{font-weight:650}dd{margin:0}summary{min-height:44px;cursor:pointer;padding:.55rem 0;font-weight:650;color:var(--blue)}
.table-wrap{overflow-x:auto}table{width:100%;text-align:left;border-collapse:collapse;font-size:.91rem}td,th{border-bottom:1px solid var(--line);padding:.46rem;vertical-align:top}thead{color:var(--mint)}
#scale-explanation,#blind-help{color:var(--muted);font-size:.9rem}footer{color:var(--muted);padding:1rem 0}.reading{max-width:88ch}
@media(max-width:565px){dl{grid-template-columns:minmax(0,1fr);gap:.25rem}dd{margin:0 0 .55rem}.controls{display:grid;grid-template-columns:1fr 1fr}.controls label{min-width:0}}
"""

JS = """
const byId = (id) => document.getElementById(id);
const query = (selector) => [...document.querySelectorAll(selector)];
const blind = byId('blind');
const slides = query('.study');
const controls = query('#controls select');
function update() {
  const [seed, track, view, scale, background] = controls.map(control => control.value);
  const hiddenNames = blind.getAttribute('aria-pressed') === 'true';
  const active = slides.find(element => element.dataset.seed === seed);
  byId('gallery').dataset.bg = background;
  for (const sheet of slides) {
    sheet.hidden = sheet !== active;
    const openRail = sheet.querySelector('[data-track="' + track + '"]');
    const otherRail = sheet.querySelector('[data-track]:not([data-track="' + track + '"])');
    if (!openRail.querySelector('[data-slot="0"] img')) {
      const original = otherRail.querySelector('[data-slot="0"]');
      openRail.querySelector('[data-slot="0"]').replaceWith(original);
      const placeholder = document.createElement('figure');
      placeholder.dataset.slot = '0';
      otherRail.prepend(placeholder);
    }
    openRail.hidden = false;
    otherRail.hidden = true;
    for (const figure of openRail.querySelectorAll('figure')) {
      const position = Number(figure.dataset.blind);
      const caption = hiddenNames ? 'Mẫu ' + String.fromCharCode(65 + position) : figure.dataset.label;
      figure.style.order = hiddenNames ? position : Number(figure.dataset.slot);
      figure.querySelector('figcaption').textContent = caption;
      const images = [...figure.querySelectorAll('img')];
      let displayed = false;
      for (const image of images) {
        image.hidden = image.dataset.view !== view || image.dataset.scale !== scale;
        displayed ||= !image.hidden;
        if (!image.hidden) image.alt = caption + ' · ' + byId('view').selectedOptions[0].text + ' · ' + scale + '×';
      }
      figure.querySelector('.no-diff').hidden = displayed;
    }
  }
  byId('blind-help').hidden = !hiddenNames;
  byId('findings').hidden = hiddenNames;
  byId('qa').hidden = hiddenNames;
}
for (const control of controls) control.addEventListener('change', update);
blind.addEventListener('click', () => {
  const next = blind.getAttribute('aria-pressed') !== 'true';
  blind.setAttribute('aria-pressed', next);
  blind.textContent = next ? 'Hiện phương pháp' : 'Ẩn phương pháp';
  update();
});
update();
"""

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact-commit", required=True, help="Full Git SHA containing the frozen renderer and evidence")
    args = parser.parse_args()
    revision = args.artifact_commit
    assert re.fullmatch(r"[a-f0-9]{40}", revision)
    git = lambda *arg: subprocess.check_output(["git", *arg])
    lock = load(FIXTURES / "study.json")
    freeze = load(FIXTURES / "candidate-freeze.json")
    bench = load(ROOT / "benchmark.json")
    assert bench["base"] == lock["e90"]
    assert bench["freeze"] == digest((FIXTURES / "candidate-freeze.json").read_bytes())
    for path, key in freeze["source"].items():
        assert digest(git("show", revision + ":" + path).replace(b"\r\n", b"\n")) == key, path
    regress = load(ROOT / "regression-integrity.json")
    perf = load(ROOT / "verification.json")
    studio = load(ROOT / "studio-parity.json")
    files = bench["files"]
    manifest = (ROOT / "SHA256SUMS").read_text(encoding="utf-8").splitlines()
    sums = dict((line.split("  ", 1)[1], line.split("  ", 1)[0]) for line in manifest)
    assert sums == files | {"benchmark.json": digest((ROOT / "benchmark.json").read_bytes())}
    options = "".join(f'<option value="{case["seed"]}">{TITLES[case["id"]]} · {case["seed"]}</option>'
                      for case in bench["cases"])
    views = "".join(f'<option value="{key}">{label}</option>' for key, label in VIEWS.items())
    galleries = "".join(gallery(case, files) for case in bench["cases"])
    image_count = sum(name.endswith(".png") for name in files)
    assert galleries.count("<img") == image_count
    tables = "".join(qa_table(case) for case in bench["cases"])
    downloads = "".join(download(path) for path in [ROOT / "benchmark.json", ROOT / "SHA256SUMS",
        ROOT / "regression-integrity.json", ROOT / "verification.json", ROOT / "studio-parity.json",
        FIXTURES / "candidate-freeze.json", FIXTURES / "study.json", RUBRIC, ADDENDUM])
    row = bench["cases"][0]["variants"]
    expected = ["a0","b1","b2","b3","b4","b1-shared","b2-shared","b3-shared","b4-shared"]
    assert [item["id"] for item in row] == expected
    catalog_counts = " · ".join(f"{key.upper()} {value}" for key, value in regress["catalogs"].items())
    review = download(ROOT / "human-review.json")
    doc = f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'">
<title>E9.1 Character Art Quality Review · LumaSprite Engine</title><style>{CSS}</style></head>
<body><main>
<header class="intro"><div class="brand">LumaSprite Engine / E9.1</div><h1>Character Art Quality Review</h1>
<p>Nhân vật tĩnh 64×64. So sánh v3 và bốn checkpoint v4 ở native 1×, với hai seed Harbor Lockkeeper và một holdout Marsh Apothecary.</p>
<p class="status"><code>{e(bench["status"])}</code></p>
<p>Marsh v4 không đạt <code>STANCE_GAP</code> trên cả bốn checkpoint. Phiếu đánh giá mỹ thuật vẫn trống.</p>
<nav aria-label="Mục lục"><a href="#gallery">So sánh ảnh</a><a href="#findings">Quan sát</a><a href="#qa">QA và nguồn</a><a href="#human">Phiếu duyệt</a></nav></header>
<section id="gallery" aria-label="Gallery so sánh">
<h2>So sánh ảnh gốc</h2>
<div id="controls" class="controls">
<label>Brief và seed<select id="seed">{options}</select></label>
<label>Phạm vi so sánh<select id="track"><option value="shared">Thiết bị chung</option><option value="expanded">Thiết bị mở rộng</option></select></label>
<label>Bằng chứng<select id="view">{views}</select></label>
<label>Kích thước<select id="scale"><option value="1">Native 1×</option><option value="4">Nearest 4×</option></select></label>
<label>Nền kiểm tra<select id="background"><option value="light">Xám sáng</option><option value="dark">Xanh đậm</option></select></label>
<button id="blind" type="button" aria-pressed="false">Ẩn phương pháp</button></div>
<p id="scale-explanation">Cuộn ngang trong hàng ảnh nếu màn hình hẹp. Với 4×, mỗi pixel native trở thành khối 4×4. Ảnh Day/Night có nền cảnh riêng.</p>
<p id="blind-help" hidden>Ghi lại mã Mẫu trước khi hiện lại tên checkpoint để điền phiếu.</p>
{galleries}</section>
<article id="findings" class="review-notes reading">
<h2>Điều đã thay đổi</h2>
<p><code>VERIFIED_BY_TEST</code> chỉ áp dụng cho phép kiểm kỹ thuật. Các nhận xét ở 1× là <code>VISUAL_OBSERVATION</code>.</p>
<ul>
<li><strong>A0 · đối chứng.</strong> CharacterSpec v3 được parse qua schema production và render với M2P thật. Đối chứng dùng tư thế v3 có sẵn và cùng cờ lê hoặc móc, hộp đồ nghề, palm socket, camera và profile như nhóm thiết bị chung của v4. V3 có áo khoác và mũ trùm. <code>CAPABILITY_GAP</code> gồm vạt tạp dề/tunic, khăn lệch, kiểu mũ/búi theo brief, grip motif, tay van và cặp gáo/khay. Tab mở rộng giữ A0 làm mốc tham chiếu cho năng lực, còn kết luận đối chứng dựa trên tab thiết bị chung.</li>
<li><strong>B1 · hình khối (C1/C3).</strong> Harbor 24137 chuyển từ torso {row[0]["checks"]["torsoWidth"]} px sang {row[5]["checks"]["torsoWidth"]} px với cùng đạo cụ; bớt một hàng khoảng âm ({row[0]["checks"]["legGapRows"]} → {row[5]["checks"]["legGapRows"]}, ngưỡng ≥2). Nhìn mặt nạ bỏ đạo cụ thấy Harbor có khối thân và vai rộng hơn Marsh. Mặt v4 tách mũi và hàm, nhưng cảm giác khuôn mặt phẳng vẫn còn ở 1×.</li>
<li><strong>B2 · tay nắm (C2).</strong> Overhand và pinch ở Harbor chỉ sửa lớp tay. Overlap tay–cán của cấu hình mở rộng tăng 11→14 ở tay gần và 9→13 ở tay xa; phần thấy được của dụng cụ giảm 31→28 và 115→111 pixel. Cán vẫn đọc được quanh nắm tay. Chốt xa vẫn dễ bị đọc thành móc nhỏ. Underhand và supporting của Marsh qua kiểm tra tiếp xúc tĩnh trước kiểm tra khoảng hở chân. Ở 1× thấy rõ khay và hai lọ, nhưng ngón cái là dấu hiệu rất nhỏ.</li>
<li><strong>B3 · chất liệu (C4).</strong> Trên Harbor mở rộng seed 24137, {row[3]["changes"]["paint"]} pixel đổi màu, 0 pixel alpha thay đổi. Nếp tay chuyển theo cẳng tay, da tạp dề có mảng sáng gọn, cụm kim loại tập trung ở đầu van. Mảng mặt sáng lớn ở Marsh và tương phản gỗ/đồng ở tay van vẫn cần người duyệt xem ở 1×.</li>
<li><strong>B4 · Selective Outline (C5).</strong> Harbor mở rộng đổi {row[4]["changes"]["paint"]} pixel viền sáng, giữ hình học và viền tiếp xúc/bóng. Day có 19→23 cạnh dưới Δluma 18, Night giữ 31/364 và p10 23. Viền bớt gắt ở vùng mũ/vai khi phóng 4×; ở 1× hiện ghi <code>NO_MEANINGFUL_VISUAL_GAIN</code> cho treatment B4 này theo quan sát. B3 cũng có trong phiếu để Owner chọn trực tiếp.</li>
<li><strong>Marsh · holdout.</strong> <code>KNOWN_LIMITATION · GEOMETRY_LIMITATION</code>. Vạt A-line và khối chân đóng khoảng âm, dưới tối thiểu hai hàng. Tỷ lệ thân và trang phục phân biệt được khi bỏ mũ và đạo cụ. Tất cả ảnh giữ đúng lần chạy ứng viên khóa; không dùng kết quả để chỉnh rule. Phân loại grip/vật liệu vẫn cần duyệt mỹ thuật; hai brief chưa đủ suy rộng đến các archetype khác.</li>
</ul>
<p>Map viền v4 dùng vàng cho cạnh sáng, xanh tím cho cạnh bóng, xanh lục cho tiếp xúc và cam hồng cho ranh giới vật liệu. Map pixel đổi dùng xanh cho thêm, hồng cho bỏ và vàng cho đổi màu.</p>
</article>
<section id="qa" class="report-section">
<h2>Thông số và kiểm chứng</h2>
<dl>
<dt>E9.1 source và evidence</dt><dd><code>{revision}</code></dd>
<dt>E9.0 HEAD</dt><dd><code>{lock["e90"]}</code></dd>
<dt>E9.0 source</dt><dd><code>{lock["e90Source"]}</code></dd>
<dt>E8.5 HEAD</dt><dd><code>{lock["e85"]}</code></dd>
<dt>Studio tại lần chạy</dt><dd><code>{e(studio["branch"])}</code> · <code>{studio["revision"]}</code> · 9 RGBA exact · <code>STUDIO_V4_CONTRACT_GAP</code>. Schema v3 vẫn xử lý A0 và từ chối spec pilot v4. Studio nhập PNG thường.</dd>
<dt>Preset</dt><dd>64×64 · three-quarter-right · pivot (32, 58) · weathered-station-v1 · upper-left · ramp M2P và palette vật liệu E7.3 khóa. Ngưỡng tại study.json.</dd>
<dt>Holdout freeze</dt><dd><code>{bench["freeze"]}</code> · Hash nguồn, cấu hình và bản chạy development được ghi trước seed 55271. Mỗi checkpoint có cùng revision nguồn trên, seed và hash riêng trong benchmark.json.</dd>
<dt>Engine</dt><dd>Lint, typecheck, build, smoke PASS · {perf["engine"]["tests"]["passed"]}/{perf["engine"]["tests"]["total"]} test.</dd>
<dt>Lịch sử</dt><dd>{regress["historical"]} SHA-256 · {catalog_counts} · 30 PNG E9.0, Rubric v2 và HTML E9.0 đối chiếu SHA-256.</dd>
<dt>Tái lập</dt><dd>{regress["rebuiltFiles"]} tệp giống SHA-256 qua hai lần chạy · {image_count} PNG gốc nhúng · thời gian chạy lại {perf["replayWallSeconds"]} s trên Windows với Node {perf["node"]}. Thời gian gồm render kiểm lại, encode PNG, ghi đĩa và QA.</dd>
<dt>Cảnh</dt><dd>54 kiểm tra placement Tidegate 320×208, 32 PPU; cùng anchor và collision plane; từng pixel actor khớp và ngoài vùng actor giữ nguyên. Đây là phép kiểm static. Gameplay chuyển động, runtime Unity và animation ở trạng thái <code>NOT_RUN</code>.</dd>
<dt>Phương án A2</dt><dd><code>A2_ARTIST_AUTHORED_REFERENCE_NOT_AVAILABLE</code></dd>
</dl>
{tables}
<details><summary>Tệp QA, rubric và SHA-256 của toàn bộ PNG</summary><div class="downloads">{downloads}</div></details>
</section>
<section id="human" class="report-section reading">
<h2>Phiếu duyệt nhân vật tĩnh</h2>
<p><code>HUMAN_REVIEW_PENDING</code>. Ở 1×, chấm riêng silhouette, proportions, anatomy, grip, pixel clusters, materials, context readability và style consistency từ 1–5. Có thể chọn A0, B1, B2, B3, B4, Neither hoặc yêu cầu sửa. Ghi mã Critical Defect và điều kiện thấy lỗi.</p>
<div class="downloads">{review}</div>
<p>Rubric v2 addendum giữ lại các lỗi Critical, với <code>DIRECTIONAL_FACING_LOCK</code> và những yêu cầu chuyển động/runtime là <code>OPEN_PRODUCTION_BLOCKER</code>. Project Owner có thể quyết định <code>STATIC_ART_ACCEPTED_FOR_ANIMATION_RESEARCH</code> sau khi các cổng tĩnh đạt.</p>
<h3>E9.2 readiness</h3>
<p>Giữ E9.2 ở <code>NOT_AUTHORIZED</code>. Trước khi xem xét ủy quyền, cần xử lý geometry limitation trong một thí nghiệm có holdout mới và nhận quyết định mỹ thuật của Owner. Game-Ready và E8.5 Owner Runtime Acceptance còn mở.</p>
</section>
<footer>LumaSprite Engine · E9.1 · Báo cáo HTML tự chứa</footer>
</main><script>{JS}</script></body></html>"""
    REPORT.write_text(doc, encoding="utf-8", newline="\n")
    print(f"{image_count} PNG, {REPORT.stat().st_size} bytes, SHA-256 {digest(REPORT.read_bytes())}")

if __name__ == "__main__":
    main()
