from argparse import ArgumentParser
from ast import Assign, Name, literal_eval, parse
from base64 import b64encode
from hashlib import sha256
from html import escape
from pathlib import Path
from struct import unpack
import json

ROOT = Path("benchmarks/results/e9h1r")
REPORT = Path("docs/reports/E9-H1R-ART-DIRECTED-QUALITY-REVIEW.html")
parser = ArgumentParser()
parser.add_argument("--evidence-commit", required=True)
args = parser.parse_args()
assert len(bytes.fromhex(args.evidence_commit)) == 20


def load(name):
    return json.loads((ROOT / name).read_bytes())


def script_data(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def facts(value):
    return "<pre>" + escape(json.dumps(value, ensure_ascii=False, indent=2)) + "</pre>"


def details(label, body, opened=False):
    return f'<details{" open" if opened else ""}><summary>{escape(label)}</summary>{body}</details>'


def data_link(file, mime, label):
    encoded = b64encode(file.read_bytes()).decode("ascii")
    return f'<a class="download" download="{file.name}" href="data:{mime};base64,{encoded}">{escape(label)}</a>'


benchmark = load("benchmark.json")
qa = load("technical-qa.json")
first = load("first-holdout-attempt.json")
freeze = json.loads(Path("benchmarks/fixtures/e9h1r/candidate-freeze.json").read_bytes())
dev, diagnostic, fresh = benchmark["cases"]
assert fresh["problems"] == [{"code": "COMPOSITION_FAILURE", "detail": "Error: Character geometry failed: KNEE_DIRECTION/near"}]
assert qa["status"] == "PASS" and qa["pilotStatus"] == benchmark["status"]
payload, dimensions, referenced = {}, {}, {}


def img(path, label, source=None):
    if source is None:
        file = path + ".png"
        raw = (ROOT / file).read_bytes()
        expected = benchmark["files"][file]
    else:
        file = source["source"]
        raw = Path(file).read_bytes()
        expected = source["sha256"]
    digest = sha256(raw).hexdigest()
    assert expected == digest and raw[:8] == b"\x89PNG\r\n\x1a\n"
    w, h = unpack(">II", raw[16:24])
    payload.setdefault(digest, "data:image/png;base64," + b64encode(raw).decode("ascii"))
    dimensions[digest] = [w, h]
    referenced[file] = digest
    title = escape(label)
    return (f'<figure><div class="pixels" tabindex="0" aria-label="{title}">'
            f'<img data-sha="{digest}" width="{w}" height="{h}" alt="{title}"></div>'
            f"<figcaption>{title}</figcaption></figure>")


def grid(items, columns=2):
    return f'<div class="gallery c{columns}">' + "".join(img(path, label) for path, label in items) + "</div>"


def pair(scope, arms, extras=True):
    labels = [("sprite", "Sprite"), ("grip", "Cận tay nắm"), ("silhouette", "Silhouette"),
              ("body", "Dáng bỏ dụng cụ cầm và bình khí"), ("head", "Cận đầu"),
              ("material", "Material mask"), ("ownership", "Ownership mask"), ("anchors", "Pivot và anchors"),
              ("day", "Tidegate Day · 320 × 208"), ("night", "Tidegate Night · 320 × 208")]
    def row(pair):
        kind, label = pair
        return grid([(f"{scope}/{arm}/{kind}", f"{name} · {label}") for arm, name in arms])
    primary = "".join(row(item) for item in labels[:2])
    if not extras:
        return primary
    return primary + details("Silhouette, dáng, masks và Day/Night", "".join(row(item) for item in labels[2:]))


def comparison(case, order):
    scope = case["role"]
    blind = pair(scope, order)
    pairing = f"<p>X = {order[0][0]} · Y = {order[1][0]}. A0 là B3/S2. B là cùng thiết bị với glove được curate.</p>"
    other = pair(scope, [("matched-draft", "B matched · DRAFT r1"), ("matched-refined", "B matched · r2")])
    diff = grid([(scope + "/paired-change", "Pixel thay đổi giữa hai revision"),
                 (scope + "/paired-allowed", "Vùng tay và biên được phép đổi")])
    return blind + details("Mở khóa nhãn và đối chiếu với B matched DRAFT", pairing + other + diff)


references = ""
for ref in benchmark["referenceEvidence"]:
    references += '<article class="component"><h3>' + escape(ref["id"]) + '</h3>'
    references += img("", ref["role"], ref)
    references += f'<p>{escape(ref["preserve"])}</p>'
    references += details("Nguồn, vai trò và giới hạn", facts(ref))
    references += "</article>"

revisions = ""
for ref in benchmark["revisions"]:
    key = "kit/" + ref["id"]
    revisions += "<h3>" + escape(ref["id"]) + "</h3><p>" + escape(ref["intent"]) + "</p>"
    revisions += grid([(key+"/draft/native", "DRAFT · r1"), (key+"/refined/native", "Refined · r2")])
    extra = "".join(grid([(f"{key}/draft/{kind}", f"r1 · {label}"), (f"{key}/refined/{kind}", f"r2 · {label}")])
                    for kind, label in [("silhouette", "Silhouette"), ("material", "Vật liệu"), ("owners", "Ownership"), ("anchors", "Anchors")])
    extra += grid([(key+"/single-group-trial", "Chỉ thay nhóm này"), ("development/full-draft/sprite", "Đối chứng r1")])
    extra += grid([(key+"/single-group-day", "Một nhóm · Day"), (key+"/single-group-night", "Một nhóm · Night")])
    revisions += details("Masks, anchors và ảnh thử một nhóm", extra + facts(ref))

salt = grid([("diagnostic/before-a0/sprite", "Saltmarsh E9.H1 · 0 pixel ống chân xa"),
             ("diagnostic/after-a0/sprite", "Saltmarsh E9.H1R · 15 pixel ống chân xa")])
salt += grid([("diagnostic/before-a0/equipment", "Mặt nạ hộp cũ"), ("diagnostic/after-a0/equipment", "Mặt nạ hộp nâng 4 px")])
salt += grid([("diagnostic/raw-shin", "48 pixel hình học gốc"), ("diagnostic/after-a0/shin-visible", "15 pixel ownership hiển thị")])
salt += details("Lỗi ở cả ba nhánh E9.H1", grid([("diagnostic/before-matched/sprite", "B matched cũ"),
                                                ("diagnostic/before-full/sprite", "B full cũ")]) + facts(diagnostic["layout"]))

edits = ""
for item in dev["local"]:
    intent = item["intent"]
    prefix = "edits/" + intent["id"]
    pair_images = grid([(prefix+"/before", "Trước · r2"), (prefix+"/after", "Sau · bản sao r3")])
    masks = grid([(prefix+"/allowed-owner", "Vùng được phép"), (prefix+"/diff", "Pixel thay đổi")])
    edits += details(f"{intent['id']} · {item['changed']} pixel đổi, 0 ngoài mask", pair_images + masks + facts(item))

metrics = ""
for case in [dev, diagnostic]:
    for arm in case["results"]:
        near = next(hand for hand in arm["qa"]["handTests"] if hand["hand"] == "near-hand")
        d, n = arm["scenery"]
        cells = [case["role"]+" / "+arm["id"], arm["visibility"]["visible"], arm["visibility"]["longest"],
                 arm["qa"]["legGapRows"], f"{near['overlap']} / {near['join']} / {near['shown']}",
                 f"{d['weakEdges']}/{d['edgeCount']}", f"{n['weakEdges']}/{n['edgeCount']}"]
        metrics += "<tr><th scope='row'>" + escape(cells[0]) + "</th>" + "".join(f"<td>{v}</td>" for v in cells[1:]) + "</tr>"

old_report = Path("scripts/report-e9h1-portable.py").read_text(encoding="utf-8")
assets = {}
for node in parse(old_report).body:
    if isinstance(node, Assign) and isinstance(node.targets[0], Name) and node.targets[0].id in ("style", "script"):
        assets[node.targets[0].id] = literal_eval(node.value)
style = assets["style"] + """
.gallery.c3{grid-template-columns:repeat(3,minmax(0,1fr))}
body[data-background="light"] .pixels{background:#d8e2e9}
.warning{max-width:85ch}
@media(max-width:680px){.gallery.c3{grid-template-columns:repeat(2,minmax(0,1fr))}}
"""
script = assets["script"] + """
const background = document.querySelector('#background');
background.addEventListener('click', () => {
  const light = document.body.dataset.background !== 'light';
  document.body.dataset.background = light ? 'light' : 'dark';
  background.setAttribute('aria-pressed',String(light));
});
"""
reviews = data_link(ROOT/"human-review.json", "application/json", "Tải phiếu Human Review trống")
workflow = data_link(Path("docs/reports/E9-H1R-WORKFLOW-RESEARCH.md"), "text/markdown", "Tải bảng nghiên cứu workflow")
dev_pair = comparison(dev, [("matched-refined", "X"), ("a0", "Y")])
salt_pair = comparison(diagnostic, [("a0", "X"), ("matched-refined", "Y")])
full = ""
for r in [dev, diagnostic]:
    full += details(r["name"] + " · Full Hybrid r1 và r2", pair(r["role"], [("full-draft", "DRAFT r1"), ("full-refined", "Refined r2")]), r is dev)
ref_pack = json.loads(Path("benchmarks/fixtures/e9h1r/references.json").read_bytes())
headings = {"Checkpoint E9.H1": benchmark["checkpoint"], "Freeze commit": first["sealCommit"], "Evidence commit": args.evidence_commit,
            "Studio": qa["studio"]["revision"], "Seal SHA-256": benchmark["freeze"], "Revision source SHA-256": benchmark["revisionSource"],
            "Historical report SHA-256": qa["previousE9H1"]["protectedReportSha256"]}
page = f"""<!doctype html>
<html lang="vi"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>E9.H1R · Art-Directed Quality Review</title>
<style>{style}</style></head>
<body data-zoom="1" data-background="dark"><main>
<header>
<p class="muted">LumaSprite Engine · E9.H1R</p>
<h1>Art-Directed Quality Review</h1>
<p class="status">{benchmark['status']}</p>
<p class="lead">Đã khôi phục ống chân xa của Saltmarsh và có ba bản tinh chỉnh để xem ở 1×. Fresh holdout Breakwater dừng tại kiểm tra hướng gối gần trước khi có sprite Hybrid.</p>
<nav aria-label="Mục lục"><a href="#compare">So sánh A/B</a><a href="#composition">Saltmarsh</a><a href="#components">Component</a><a href="#references">Reference Pack</a><a href="#holdout">Holdout</a><a href="#qa">QA</a><a href="#review">Phiếu duyệt</a></nav>
<div class="controls" aria-label="Cách xem ảnh"><span>Tỷ lệ</span><button type="button" data-scale="1" aria-pressed="true">Native 1×</button><button type="button" data-scale="4" aria-pressed="false">Nearest 4×</button><button type="button" id="background" aria-pressed="false">Nền sáng</button></div>
<noscript><p class="warning">Bật JavaScript cục bộ để xem PNG nhúng.</p></noscript>
</header>
<section id="compare">
<h2>Tidal Salvage Diver · Cặp cùng capability</h2>
<p>48311 · 64 × 64 · pivot (32, 58) · three-quarter-right · upper-left · weathered-station-v1.</p>
<p>Chấm X/Y ở 1× trước khi mở khóa. Tất cả giữ pose, hai dụng cụ, socket, palette và camera. 44 pixel giữa hai bản B matched nằm trong vùng glove và viền. Nhận xét mỹ thuật chỉ áp dụng cho tay nắm trong cặp này.</p>
{dev_pair}
</section>
<section id="composition">
<h2>Saltmarsh · Khôi phục vùng ống chân xa</h2>
<p>Trong 48 pixel của mask chân, hộp đồ nghề chuẩn che 36 và boot che 12. Thân hộp nằm thấp và được vẽ sau ống chân nên cả A0, B matched và B full đều mất dấu ống chân. Fixture layout cho thử vị trí thân hộp và độ dài quai trong khi giữ vai trò đồ nghề.</p>
<p>Trước khi ghép final, Semantic Visibility Constraint đọc các mask phía trước ống chân. Yêu cầu tối thiểu 9 pixel, 25% mask gốc và 3 hàng liên tiếp. Với Saltmarsh, phương án đầu được chấp nhận nâng thân hộp 4 px, rút quai dưới và giữ socket. 15 pixel xuất hiện trên 4 hàng liên tiếp. Lớp chân, stance, pivot và grip giữ nguyên hình học.</p>
{salt}
<details><summary>Xem cặp A/B Saltmarsh đã sửa</summary>{salt_pair}</details>
<p class="muted">69041 là mẫu chẩn đoán vì vị trí hộp được sửa sau khi lỗi đã được quan sát.</p>
</section>
<section id="components">
<h2>Ba nhóm component · DRAFT r1 → r2</h2>
<p>Helmet r2 có gờ visor riêng và vòng cổ ngắn sáng hơn ở mép trái. Suit r2 gom mảng vai và eo để bớt chi tiết vụn. Glove r2 tách cụm ngón cái và giảm cảm giác cục màu. Mỗi lượt thử chỉ thay đúng một nhóm trước khi lắp chung.</p>
{revisions}
<h3>Full Hybrid · Đọc chức năng và nhận diện nghề</h3>
<p>Track này có mũ lặn, bình khí, suit và móc riêng. Tách track khỏi A0 vì A0 thiếu các trang bị đó. Vành mũ và thân suit vẫn dùng nhiều mass chung với r1. Tay xa còn lộ da.</p>
{full}
</section>
<section id="references">
<h2>Art Direction Reference Pack v1</h2>
<p>Chín reference nội bộ có role, ảnh gốc và SHA-256. Toàn bộ đang <strong>PENDING</strong>. Dùng chúng để kiểm silhouette, vật liệu và giới hạn sửa từng vùng. Mẫu mang nhận diện cũ chỉ dùng làm đối chiếu.</p>
<div class="kit-grid">{references}</div>
{details("Style Profile, scale, camera và provenance", facts(ref_pack))}
<p>{workflow}</p>
</section>
<section id="masked">
<h2>Masked Local Refinement</h2>
<p>Chọn layer và Edit Intent. Cắt vùng sửa bằng ownership, đổi source trên bản sao r3, render lại, so pixel và phục hồi r2. Cả ba lượt giữ socket, palette, pivot và masks. PNG trước/sau qua Studio round-trip. Fixture đã có shape của vùng sửa để dùng lại khi đánh giá một candidate raster.</p>
{edits}
</section>
<section id="holdout">
<h2>Fresh holdout · Breakwater Screen Inspector</h2>
<p>{fresh['seed']} · nghề kiểm tra lưới nước, dáng nặng và móc rút ngắn. Brief, seed, pose, ngưỡng, kit và compositor được khóa trước lần chạy đầu.</p>
<p class="warning"><strong>COMPOSITION_FAILURE</strong> · <code>KNEE_DIRECTION/near</code>. Hông gần (29, 37) và cổ chân (29, 53) cùng trục x = 29, gối (27, 44) cho độ lệch −2 px. Ngưỡng thấp nhất là −1 px. Rig dừng trước lắp ráp Hybrid nên cặp sprite và cảnh holdout chưa có.</p>
{details("Brief và bằng chứng lần chạy đầu", facts(freeze["holdout"]) + facts(first))}
</section>
<section id="qa">
<h2>QA và giới hạn</h2>
<p>Lint, typecheck, build, smoke và 85/85 tests đạt. Bộ kiểm xác minh 805 SHA lịch sử, {qa['deterministicEntries']} file kết quả E9.H1R và {len(qa['studio']['images'])} Studio PNG import/save/export với RGBA khớp byte. Kết quả tái lập bao gồm holdout thất bại.</p>
<p>Grip gồm overlap tay–cán, nối cẳng tay và số pixel cán lộ. Cạnh yếu có chênh luma dưới 18. Cảnh Day/Night giữ collision và RGBA nền ngoài actor.</p>
<div class="scroll"><table><thead><tr><th scope="col">Mẫu / nhánh</th><th scope="col">Ống chân lộ</th><th scope="col">Hàng liền</th><th scope="col">Hàng khe chân</th><th scope="col">Grip overlap / nối / lộ</th><th scope="col">Day</th><th scope="col">Night</th></tr></thead><tbody>{metrics}</tbody></table></div>
<p>Quan sát native 1× cho thấy visor có rìa rõ hơn và tay có cụm ngón riêng. Mức cải thiện nghề, anatomy và cảm nhận Day/Night cần người duyệt. Chưa có bằng chứng tổng quát hóa từ holdout. Pilot chỉ có một hướng và không có runtime.</p>
{details("Technical QA, rollbacks và các SHA-256", facts(qa))}
{details("Geometry, grip, stance, ánh sáng và visibility", facts(benchmark["cases"]))}
{details("Git SHA đầy đủ và seal", facts(headings))}
</section>
<section id="review">
<h2>Human Review · Rubric v2 Static Addendum</h2>
<p>Chọn A, B, Neither hoặc Revision Required. Chấm ở 1× rồi dùng 4× khoanh lỗi. Giữ điểm silhouette, proportions, anatomy, grip, clusters, materials, Day/Night, style và chức năng nghề riêng. Phát hiện Critical Defect sẽ chặn đề xuất nghiệm thu. Ô holdout giữ trống vì rig từ chối trước render.</p>
<p>{reviews}</p>
<p class="muted">ASSISTANT_REVIEW_RECOMMENDATION · E8_5_OWNER_REVIEW_PENDING · GAME_READY_ART_NOT_APPROVED · E9_2_NOT_AUTHORIZED · DEEPSEEK_DEFERRED</p>
</section>
</main>
<script type="application/json" id="pngs">{script_data(payload)}</script>
<script type="application/json" id="dimensions">{script_data(dimensions)}</script>
<script type="application/json" id="image-files">{script_data(referenced)}</script>
<script>{script}</script>
</body></html>
"""
REPORT.write_text(page, encoding="utf-8", newline="\n")
print(json.dumps({"html": str(REPORT), "bytes": len(REPORT.read_bytes()), "sha256": sha256(REPORT.read_bytes()).hexdigest(),
                  "payloads": len(payload), "sourceImages": len(referenced), "placements": page.count("<img ")}))
