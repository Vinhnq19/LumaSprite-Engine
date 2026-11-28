from argparse import ArgumentParser
from base64 import b64encode
from hashlib import sha256
from html import escape
from pathlib import Path
from struct import unpack
import json

ROOT = Path("benchmarks/results/e9h1")
REPORT = Path("docs/reports/E9-H1-HYBRID-CHARACTER-PILOT.html")
parser = ArgumentParser()
parser.add_argument("--evidence-commit", required=True)
args = parser.parse_args()
assert len(bytes.fromhex(args.evidence_commit)) == 20


def load(name):
    return json.loads((ROOT / name).read_bytes())


def json_block(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def facts(value):
    return "<pre>" + escape(json.dumps(value, ensure_ascii=False, indent=2)) + "</pre>"


def disclosure(label, html, opened=False):
    return f'<details{" open" if opened else ""}><summary>{escape(label)}</summary>{html}</details>'


def bullets(values):
    return "<ul>" + "".join(f"<li>{escape(value)}</li>" for value in values) + "</ul>"


benchmark = load("benchmark.json")
qa = load("technical-qa.json")
frozen = load("frozen-replay-proof.json")
hygiene = load("report-hygiene.json")
timing = load("execution-time.json")
assert benchmark["status"] == "E9_H1_TECHNICAL_BLOCKED"
assert qa["status"] == "PASS"
payload, rendered, dimensions = {}, {}, {}


def image(path, label):
    path += ".png"
    raw = (ROOT / path).read_bytes()
    digest = sha256(raw).hexdigest()
    assert benchmark["files"][path] == digest
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"
    w, h = unpack(">II", raw[16:24])
    dimensions[digest] = [w, h]
    payload.setdefault(digest, "data:image/png;base64," + b64encode(raw).decode("ascii"))
    rendered[path] = digest
    label = escape(label)
    return (f'<figure><div class="pixels" tabindex="0" aria-label="{label}">'
            f'<img data-sha="{digest}" width="{w}" height="{h}" alt="{label}"></div>'
            f"<figcaption>{label}</figcaption></figure>")


def gallery(paths, columns=2):
    return f'<div class="gallery c{columns}">' + "".join(image(path, label) for path, label in paths) + "</div>"


def paired(case, arms):
    tiles = [
        ("sprite", "Sprite"),
        ("grip", "Cận cảnh tay nắm"),
        ("silhouette", "Silhouette"),
        ("body", "Dáng bỏ dụng cụ cầm tay và bình khí"),
        ("helmet", "Cận cảnh đầu"),
        ("materials", "Material mask"),
        ("owners", "Ownership mask"),
        ("anchors", "Anchor overlay"),
        ("day", "Tidegate Day · 320 × 208"),
        ("night", "Tidegate Night · 320 × 208"),
    ]
    row = lambda item: gallery([(f'{case["folder"]}/{arm}/{item[0]}', f"{name} · {item[1]}") for arm, name in arms])
    return row(tiles[0]) + row(tiles[1]) + disclosure("Silhouette, vật liệu, mask và cảnh Day/Night", "".join(map(row, tiles[2:])))


parts = benchmark["cases"][0]["provenance"]
kit_titles = ["Mũ lặn và visor", "Thân suit và bình khí", "Tay nắm và móc thu hồi"]
kit = ""
for part, title in zip(parts, kit_titles, strict=True):
    prefix = "kit/" + part["id"]
    kit += f'<article class="component"><h3>{title}</h3>'
    kit += image(prefix + "/native", f"{title} · revision {part['revision']}")
    kit += disclosure("Silhouette, masks và anchors", gallery([
        (prefix + "/" + file, label) for file, label in [
            ("silhouette", "Silhouette"), ("material", "Material mask"),
            ("ownership", "Ownership mask"), ("anchors", "Anchor overlay"),
        ]
    ]))
    kit += "<p class='muted'>ENGINEER_CURATED · Codex · DRAFT</p>" + disclosure("Provenance và SHA-256", facts(part)) + "</article>"
assembly = gallery([
    ("kit/assembly/native", "Lắp ráp thử ở 64 × 64"),
    ("kit/assembly/anchors", "Lắp ráp và anchors"),
    ("kit/assembly/shaft-before-hand", "Cán trước khi bàn tay che"),
    ("kit/assembly/shaft-after-hand", "Cán sau khi bàn tay che"),
    ("kit/assembly/day", "Lắp ráp Day · 320 × 208"),
    ("kit/assembly/night", "Lắp ráp Night · 320 × 208"),
])

development, holdout = benchmark["cases"]
tracks = {}
for case, order in [(development, [("matched", "X"), ("a", "Y")]), (holdout, [("a", "X"), ("matched", "Y")])]:
    result = paired(case, order)
    result += disclosure("Mở khóa nhãn và xem nhánh đầy đủ",
                          f'<p>X = {order[0][0]}, Y = {order[1][0]}. A là B3/S2. Matched là B dùng cùng thiết bị và pose, thay glove trước.</p>'
                          + gallery([(case["folder"] + "/matched-diff", "Chênh lệch A/B"),
                                     (case["folder"] + "/matched-region", "Vùng thay đổi cho phép")])
                          + paired(case, [("a", "A · Baseline"), ("full", "B · Hybrid đầy đủ")])
                          + bullets(case["capabilityGaps"]))
    tracks[case["folder"]] = result

edits, edit_rows = "", ""
for edit in development["edits"]:
    name = edit["name"]
    if name == "a-visor":
        edit_rows += "<tr><th scope='row'>A · visor</th><td colspan='5'>CAPABILITY_GAP · A dùng oilskin</td></tr>"
        continue
    title, ms_key = {"b-visor": ("B · màu visor", "bVisor"), "b-handle": ("B · cán móc", "bHandle"),
                     "a-handle": ("A · cán móc procedural", "aHandle")}[name]
    edit_rows += (f"<tr><th scope='row'>{title}</th><td>{edit['operations']}</td><td>{edit['components']}</td>"
                  f"<td>{timing['scriptExecutionMs'][ms_key]:.2f} ms</td><td>{edit['changed']}</td><td>{edit['outside']}</td></tr>")
    images = gallery([(f"edits/{name}/{file}", label) for file, label in [
        ("before", "Trước"), ("after", "Sau"), ("diff", "Chênh lệch"), ("allowed-owner", "Owner được phép"),
    ]])
    data = {k: edit[k] for k in ["revision", "before", "after", "rollback"]}
    edits += disclosure(title + " · ảnh và revision", images + facts(data) + facts(load(f"edits/{name}/revision.json")))

stats = ""
for case in benchmark["cases"]:
    for run in case["results"]:
        hand = run["qa"]["handTests"][0]
        day, night = run["scenes"]
        assert run["qa"]["place"] == [32, 58]
        stats += (f"<tr><th scope='row'>{escape(case['folder'])} / {escape(run['arm'])}</th>"
                  f"<td>{run['qa']['legGapRows']}</td><td>{hand['overlap']} / {hand['join']} / {hand['shown']}</td>"
                  f"<td>{day['weakEdges']}/{day['edges']}</td><td>{night['weakEdges']}/{night['edges']}</td></tr>")
qa_evidence = disclosure("Dữ liệu geometry, pivot, ownership, cảnh và rollback", facts(benchmark["cases"]))
qa_evidence += disclosure("Studio import, save và export từng PNG", facts(qa))
qa_evidence += disclosure("Bằng chứng freeze và phát lại lỗi", facts(frozen) + facts((ROOT / "first-holdout-attempt.txt").read_text(encoding="utf-8")))
qa_evidence += disclosure("Manifest ảnh và các tệp benchmark", facts(benchmark["files"]))
qa_evidence += disclosure("Biên nhận vệ sinh báo cáo", facts(hygiene))

review_bytes = (ROOT / "human-review.json").read_bytes()
download = "data:application/json;base64," + b64encode(review_bytes).decode("ascii")
manifest_info = {
    "checkpoint Engine": benchmark["checkpoint"], "freeze commit": benchmark["frozenSource"], "evidence commit": args.evidence_commit,
    "Studio": benchmark["studio"], "candidate-freeze.json SHA-256": benchmark["freeze"],
    "SHA-256 renderer harness sau freeze": benchmark["evidenceSource"], "source file SHA-256": parts[0]["sourceSha256"],
}

style = """
:root{color-scheme:light;--page:#f8fafc;--text:#182735;--muted:#485b6a;--navy:#1e3a5f;--line:#ccd7e1;--paper:#fff;--stage:#293543;--amber:#7b4714;--soft:#f7edde;--focus:#95601c}
*{box-sizing:border-box}html{scroll-padding-top:1em}body{margin:0;background:var(--page);color:var(--text);font:16px/1.55 system-ui,"Segoe UI",sans-serif}
main{max-width:1152px;margin:auto;padding:28px clamp(14px,3vw,40px) 40px}h1,h2,h3,p{margin:0 0 .65em}h1{font-size:clamp(2em,5vw,3.25em);max-width:27ch;text-wrap:balance;line-height:1.03;letter-spacing:-.036em}h2{font-size:1.7rem;letter-spacing:-.02em}h3{font-size:1.12rem}a{color:var(--navy);text-underline-offset:3px}.muted{color:var(--muted)}.lead{max-width:75ch;font-size:1.08em}
header{padding:24px 0 14px;margin-bottom:24px;border-bottom:1px solid var(--line)}.status{display:inline-block;background:var(--soft);color:var(--amber);padding:.32em .68em;border-radius:4px;font:600 .83em ui-monospace,Consolas,monospace;overflow-wrap:anywhere}
nav{display:flex;gap:6px 14px;flex-wrap:wrap;margin:.8em 0}nav a,.download{display:inline-flex;align-items:center;min-height:44px}.controls{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.controls span{font-weight:600}.controls button{background:var(--paper);color:var(--navy);border:1px solid var(--line);padding:0 17px;border-radius:6px;min-height:44px;font:inherit;cursor:pointer}.controls button[aria-pressed=true]{background:var(--navy);color:white;border-color:var(--navy)}
section{padding:18px 0 24px;border-top:1px solid var(--line)}details{background:var(--paper);margin:12px 0;border:1px solid var(--line);border-radius:7px;padding:0 12px}summary{color:var(--navy);font-weight:650;cursor:pointer;min-height:44px;padding:.61em 0}details[open]{padding-bottom:12px}
.gallery:has(img[width='64']),.gallery:has(img[width='36']){max-width:620px}.gallery,.kit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0}.kit-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.component{border:1px solid var(--line);background:var(--paper);border-radius:7px;padding:12px;min-width:0}.component .muted{margin-top:.5em}
figure{margin:0;min-width:0;background:var(--paper);border:1px solid var(--line);border-radius:7px;overflow:hidden}
.pixels{background:var(--stage);display:grid;grid-template-columns:max-content;justify-content:safe center;align-items:center;min-height:87px;overflow:auto;padding:10px}
img{display:block;width:calc(var(--art-w)*1px);height:calc(var(--art-h)*1px);image-rendering:pixelated;max-width:none}
body[data-zoom="4"] img{width:calc(var(--art-w)*4px);height:calc(var(--art-h)*4px)}
figcaption{padding:7px 10px;font-size:.85rem;color:var(--muted);overflow-wrap:anywhere}
.warning{background:var(--soft);color:var(--amber);padding:12px 14px;border-radius:5px}
.scroll{overflow:auto}table{border-collapse:collapse;width:100%;background:var(--paper);font-size:.9em}td,th{text-align:left;padding:8px;border:1px solid var(--line)}thead th{background:#e9eef5}pre{max-height:32rem;overflow:auto;background:#eef2f6;white-space:pre-wrap;overflow-wrap:anywhere;border-radius:4px;padding:10px}code{overflow-wrap:anywhere}li{padding:.18em 0}
:focus-visible{outline:3px solid var(--focus);outline-offset:2px}figure .pixels:focus-visible{outline-offset:-4px}.download{background:var(--navy);color:white;padding:7px 14px;border-radius:6px;text-decoration:none}
@media(max-width:760px){.kit-grid{grid-template-columns:minmax(0,1fr)}.kit-grid .component{padding:10px}}
"""

script = """
const registry = JSON.parse(document.getElementById('pngs').textContent);
const dims = JSON.parse(document.getElementById('dimensions').textContent);
for (const img of document.querySelectorAll('img[data-sha]')) {
  const sha = img.dataset.sha;
  const [w,h] = dims[sha];
  img.style.setProperty('--art-w',w);
  img.style.setProperty('--art-h',h);
  img.src = registry[sha];
}
for (const button of document.querySelectorAll('[data-scale]')) {
  button.addEventListener('click', () => {
    document.body.dataset.zoom = button.dataset.scale;
    for (const item of document.querySelectorAll('[data-scale]'))
      item.setAttribute('aria-pressed', String(item === button));
  });
}
"""

page = f"""<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>E9.H1 · Hybrid Art-Directed Character Pilot</title>
<style>{style}</style>
</head>
<body data-zoom="1"><main>
<header>
<p class="muted">LumaSprite Engine · E9.H1</p>
<h1>Hybrid Art-Directed Character Pilot</h1>
<p class="status">{benchmark['status']}</p>
<p class="lead">Bộ kit tạo được silhouette diver với kính tối, vành đồng và bình khí. Cặp cùng thiết bị chỉ thay tay nắm. Holdout bị chặn vì ống chân xa mất toàn bộ ownership hiển thị trong cả ba nhánh.</p>
<nav aria-label="Mục lục"><a href="#comparison">So sánh A/B</a><a href="#kit">Bộ component</a><a href="#holdout">Holdout</a><a href="#edits">Chỉnh sửa</a><a href="#qa">QA</a><a href="#review">Phiếu duyệt</a></nav>
<div class="controls" aria-label="Kích thước hình"><span>Tỷ lệ xem</span><button type="button" data-scale="1" aria-pressed="true">Native 1×</button><button type="button" data-scale="4" aria-pressed="false">Nearest 4×</button></div>
<noscript><p class="warning">Bật JavaScript cục bộ để đọc các PNG đã nhúng và đổi tỷ lệ xem.</p></noscript>
</header>
<section id="comparison">
<h2>Tidal Salvage Diver · 48311</h2>
<p>Sprite 64 × 64 · pivot (32, 58) · three-quarter-right · upper-left · weathered-station-v1.</p>
<p class="muted">Chấm X/Y ở 1× trước khi mở khóa nhãn. Dùng 4× để chỉ vị trí lỗi. Cặp này giữ nguyên pose, camera, ánh sáng và hình học của móc. Có {development['matched']['changed']} pixel đổi trong vùng tay và viền, 0 bên ngoài.</p>
{tracks['development']}
</section>
<section id="kit">
<h2>Ba nhóm component tại gate DRAFT</h2>
<p><code>{benchmark['componentGate']}</code>. Mọi nhóm dùng source chỉnh được và được tạo từ đầu trong workspace theo quyền nghiên cứu. Hồ sơ quyền pháp lý và giấy phép bên ngoài được để trống.</p>
<div class="kit-grid">{kit}</div>
{disclosure('Lắp ráp thử, che khuất và Tidegate Day/Night', assembly, True)}
<p>Vành mũ chạm thân suit và giữ được cụm highlight. Vành và tay trước che một phần dây đai, còn tay xa để lộ da. Kính tối và thân slate tách được ở 1×. Glove lớn hơn và phân khối rõ ở 4×. Ưu thế về dáng và nghề trong cặp cùng capability vẫn chưa được xác lập.</p>
</section>
<section id="holdout">
<h2>Saltmarsh Rescue Technician · 69041</h2>
<p>Brief khóa một thế đứng gọn hơn, cuff sát thân, móc cứu hộ ngắn và túi nổi. Bộ kit giữ nguyên; cả hai nhánh dùng móc cỡ đầy đủ và hộp bảo trì thay túi nổi.</p>
<p class="warning">Gate visibility giữ trạng thái lỗi. Ống chân xa có 0 / 0 / 0 pixel ownership ở A, B matched và B full. Trong 48 pixel hình học của ống chân, hộp dụng cụ che 36 và boot che 12. 15 ảnh từ bộ render đã khóa khớp SHA-256 với ảnh xuất chẩn đoán.</p>
{tracks['holdout']}
</section>
<section id="edits">
<h2>Editability · bản sao revision 2</h2>
<p>Ba thao tác giữ socket, pivot và rollback RGBA. Studio đã import, lưu và export cả ảnh trước lẫn sau. A dùng một biến thể cán procedural. B chỉnh trực tiếp trên hai source component riêng.</p>
<div class="scroll"><table><thead><tr><th>Thử nghiệm</th><th>Thao tác</th><th>Component chỉnh</th><th>Thời gian script</th><th>Pixel đổi</th><th>Ngoài owner</th></tr></thead><tbody>{edit_rows}</tbody></table></div>
{edits}
<p>221 giây từ khi ghi bộ source đến gallery đầu tiên và 360 giây đến seal. Đây là elapsed time quan sát được. Chi phí component mua ngoài là 0 USD, 0 lượt gọi API tạo ảnh. Thời gian lao động thủ công chưa đo.</p>
</section>
<section id="qa">
<h2>QA và giới hạn kỹ thuật</h2>
<p>Lint, typecheck, build, smoke và 85/85 Engine tests đạt. Xác minh 805 SHA lịch sử, catalog E9.0–E9.1S-R, {qa['deterministicEntries']} tệp deterministic và {len(qa['studio']['pngs'])} Studio PNG round-trip giữ đúng RGBA.</p>
<p>Grip báo pixel chồng tay–cán, chạm cẳng tay và cán còn thấy. Cạnh yếu là cạnh actor có chênh luma dưới 18. Cảnh giữ collision, camera và RGBA nền ngoài actor.</p>
<div class="scroll"><table><thead><tr><th>Mẫu / nhánh</th><th>Hàng khe chân</th><th>Grip overlap / nối / thấy</th><th>Day</th><th>Night</th></tr></thead><tbody>{stats}</tbody></table></div>
{bullets(benchmark['capabilityGaps'])}
<p>Khảo sát tĩnh, một góc và hai seed. Unity và animation chưa chạy. C chưa mở. Chưa xác nhận lợi ích tổng quát hóa hay chi phí authoring so với nghệ sĩ.</p>
<p>Gỡ {hygiene['activeFilesRemoved']} preview cũ từ thư mục hoạt động sau khi kiểm SHA-256 của bản sao trong kho lưu trữ, giảm {hygiene['activeBytesRemoved']:,} byte. Bản portable E7.1R vẫn có bằng chứng riêng.</p>
{qa_evidence}
<details><summary>Commit và SHA-256 nguồn</summary>{facts(manifest_info)}</details>
</section>
<section id="review">
<h2>Phiếu Human Review</h2>
<p>Chấm 1–5 cho identity, silhouette, anatomy, grip, pixel clusters, vật liệu và Day/Night. Ghi critical defect nếu có. Gate nghiên cứu yêu cầu các mục tĩnh từ 4 điểm, 0 critical defect, cải thiện ít nhất 1 điểm ở identity hoặc silhouette trong cặp cùng capability, đồng thời giữ điểm anatomy, grip, vật liệu và readability.</p>
<p><a class="download" href="{download}" download="E9-H1-HUMAN-REVIEW.json">Tải JSON trống</a></p>
<p class="muted">ASSISTANT_REVIEW_RECOMMENDATION · Option B RETAIN_SELECTED_COMPONENTS_ONLY · B3/S0 RESEARCH_BASELINE · APPROVED_FOR_PILOT_RECOMMENDATION · ISOLATED_RESEARCH_ONLY</p>
<p class="muted">E8_5_OWNER_REVIEW_PENDING · GAME_READY_ART_NOT_APPROVED · E9_2_NOT_AUTHORIZED · DEEPSEEK_DEFERRED</p>
</section>
</main>
<script type="application/json" id="pngs">{json_block(payload)}</script>
<script type="application/json" id="dimensions">{json_block(dimensions)}</script>
<script type="application/json" id="image-files">{json_block(rendered)}</script>
<script>{script}</script>
</body></html>
"""
assert set(rendered) == {path for path in benchmark["files"] if path.endswith(".png")}
REPORT.write_text(page, encoding="utf-8", newline="\n")
print(json.dumps({"path": str(REPORT), "uniquePngs": len(payload), "pngArtifacts": len(rendered),
                  "imagePlacements": page.count("<img "), "bytes": len(REPORT.read_bytes()),
                  "sha256": sha256(REPORT.read_bytes()).hexdigest()}))
