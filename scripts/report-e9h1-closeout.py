from argparse import ArgumentParser
from ast import Assign, Name, literal_eval, parse
from base64 import b64encode
from hashlib import sha256
from html import escape
from pathlib import Path
from struct import unpack
import json

ROOT = Path("benchmarks/results/e9h1-closeout")
H1R = Path("benchmarks/results/e9h1r")
OUT = Path("docs/reports/E9-H1-CLOSEOUT-ART-QUALITY-DECISION.html")
parser = ArgumentParser()
parser.add_argument("--evidence-commit", required=True)
args = parser.parse_args()
assert len(bytes.fromhex(args.evidence_commit)) == 20


def load(path):
    return json.loads(Path(path).read_bytes())


def pretty(data):
    return "<pre>" + escape(json.dumps(data, ensure_ascii=False, indent=2)) + "</pre>"


def inline(data):
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def details(label, body, opened=False):
    return f'<details{" open" if opened else ""}><summary>{escape(label)}</summary>{body}</details>'


summary = load(ROOT / "benchmark.json")
old = load(H1R / "benchmark.json")
qa = load(ROOT / "technical-qa.json")
policy = load(ROOT / "decision.json")
observed = load(ROOT / "native-observation.json")
first = load(ROOT / "first-attempt.json")
seal = load("benchmarks/fixtures/e9h1-closeout/candidate-freeze.json")
audit = load(ROOT / "workspace-audit.json")
assert policy["status"] == qa["closeoutStatus"]
assert summary["cases"][1]["role"] == "fresh"
payload, dims, sources = {}, {}, {}
expected = {str(ROOT / key): digest for key, digest in summary["files"].items()}
expected.update({str(H1R / key): digest for key, digest in old["files"].items()})
expected.update({str(Path(ref["source"])): ref["sha256"] for ref in summary["references"]})


def image(path, label):
    raw = path.read_bytes()
    digest = sha256(raw).hexdigest()
    assert expected[str(path)] == digest, path
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"
    w, h = unpack(">II", raw[16:24])
    payload.setdefault(digest, "data:image/png;base64," + b64encode(raw).decode("ascii"))
    dims[digest] = [w, h]
    sources[path.as_posix()] = digest
    label = escape(label)
    return (f'<figure><div class="pixels" tabindex="0" aria-label="{label}">'
            f'<img data-sha="{digest}" width="{w}" height="{h}" alt="{label}"></div>'
            f'<figcaption>{label}</figcaption></figure>')


def gallery(*items):
    return '<div class="gallery">' + "".join(image(path, label) for path, label in items) + '</div>'


def compare(base, left, right, kind, label):
    return gallery((base / left / (kind + ".png"), "X · " + label), (base / right / (kind + ".png"), "Y · " + label))


dev = H1R / "development"
locked_review = ""
by_name = {item["criterion"]: item for item in observed["observations"]}
for label, title, kind in [
    ("grip", "Grip r1 / r2", "grip"), ("helmet", "Helmet r1 / r2", "head"), ("suit", "Suit và silhouette nghề", "sprite"),
    ("day", "Full Hybrid trong cảnh Day", "day"), ("night", "Full Hybrid trong cảnh Night", "night"),
]:
    item = by_name[label]
    locked_review += f'<article><h3>{title}</h3>'
    locked_review += compare(dev, item["left"], item["right"], kind, title)
    unlocked = f'<p>X = {item["left"]}. Y = {item["right"]}.</p>' + "<p>" + escape(item["finding"]) + "</p>"
    locked_review += details("Mở khóa nhãn và nhận xét", unlocked) + "</article>"
baseline = compare(dev, "matched-refined", "a0", "sprite", "Cặp cùng thiết bị")
baseline += compare(dev, "matched-refined", "a0", "grip", "Cận tay nắm")
baseline += details("Mở khóa nhãn và xem bối cảnh",
    "<p>X = B matched r2. Y = A0 procedural B3/S2. Cùng móc, hộp, palette và pose.</p>" +
    compare(dev, "matched-refined", "a0", "day", "Day") + compare(dev, "matched-refined", "a0", "night", "Night"))

component_sources = ""
for revision in summary["componentRevisions"]:
    group = revision["id"]
    base = H1R / "kit" / group
    component_sources += f"<h3>{escape(group)}</h3>"
    component_sources += gallery((base/"draft/native.png", "DRAFT r1 · "+group),
                                 (base/"refined/native.png", "Refined r2 · "+group))
    component_sources += gallery((base/"single-group-trial.png", "Chỉ thay nhóm này"),
                                 (dev/"full-draft/sprite.png", "Đối chứng toàn r1"))
components = details("Đối chiếu riêng ba nhóm source", component_sources)

refs = ""
for r in summary["references"]:
    refs += f'<article class="component"><h3>{escape(r["id"])}</h3><p class="muted">{escape(r["classification"])} · PENDING</p>'
    refs += image(Path(r["source"]),r["role"]) + "<p>" + escape(r["preserve"]) + "</p>"
    refs += details("Nguồn, provenance và SHA-256", pretty(r)) + "</article>"

matrix_rows, matrix_imgs = "", ""
for row in summary["matrix"]:
    near, far = row["joints"]
    failed = ", ".join(row["errors"]) or "PASS"
    matrix_rows += (f'<tr><th scope="row">{row["id"]}</th><td>{near["forward"]:+.2f}</td><td>{far["forward"]:+.2f}</td>'
                    f'<td>{near["foot"]["solePixels"]} / {far["foot"]["solePixels"]}</td>'
                    f'<td>{row["centerX"]:.1f}</td><td>{failed}</td></tr>')
    matrix_imgs += gallery((ROOT / "pose" / (row["id"] + ".png"), row["id"]),
                           (ROOT / "pose" / (row["id"] + "-joints.png"), "Hông, gối và cổ chân"))
broken = gallery((ROOT/"pose/breakwater-original.png", "Pose E9.H1R · bị từ chối"),
                 (ROOT/"diagnostic/authored-rig.png", "Pose từ source intent · QA đạt"))
broken += gallery((ROOT/"diagnostic/full-r2/sprite.png", "Breakwater diagnostic · Full Hybrid r2"),
                 (ROOT/"diagnostic/full-r2/ownership.png", "Ownership mask · cùng pivot"))
fresh = ""
if summary["cases"][1]["status"] == "TECHNICAL_PASS":
    fresh = gallery((dev/"full-refined/sprite.png", "Tidal · Full r2 đã khóa"),
                    (ROOT/"fresh/full-r2/sprite.png", "Tidegate Grate Maintainer · Full r2"))
    for mode in ["day","night"]:
        fresh += gallery((dev/"full-refined"/(mode+".png"), "Tidal · "+mode.title()),
                         (ROOT/"fresh/full-r2"/(mode+".png"), "Tidegate Grate Maintainer · "+mode.title()))
    fresh += details("So sánh cùng thiết bị trên holdout", compare(ROOT/"fresh", "a0", "matched-r2", "sprite", "Holdout · X/Y") +
                     details("Mở khóa nhãn", "<p>X = A0. Y = B matched r2.</p>"))
revs = summary["componentRevisions"]
report_source = Path("scripts/report-e9h1-portable.py").read_text(encoding="utf-8")
runtime = {}
for node in parse(report_source).body:
    if isinstance(node, Assign) and isinstance(node.targets[0], Name) and node.targets[0].id in ("style", "script"):
        runtime[node.targets[0].id] = literal_eval(node.value)
style = runtime["style"] + """
body[data-background="light"] .pixels{background:#d8e2e9}
article + article{margin-top:16px}.kit-grid article{margin:0}
"""
script = runtime["script"] + """
const backdrop=document.querySelector('#backdrop');
backdrop.addEventListener('click',()=>{
 const next=document.body.dataset.background==='dark'?'light':'dark';
 document.body.dataset.background=next;
 backdrop.setAttribute('aria-pressed',String(next==='light'));
});
"""
review = b64encode((ROOT/"human-review.json").read_bytes()).decode("ascii")
source_info = {"E9.H1R checkpoint":summary["checkpoint"],"freeze commit":first["sourceCommit"],"evidence commit":args.evidence_commit,
               "seal SHA-256":summary["seal"],"Studio":qa["studio"]["revision"],"baseline PNG hashes":qa["baselineSha256"],
               "component revisions and SHA-256":revs, "benchmark SHA-256":first["benchmarkSha256"]}
page = f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>E9.H1 · Closeout Art Quality Decision</title>
<style>{style}</style></head>
<body data-zoom="1" data-background="dark"><main>
<header>
<p class="muted">LumaSprite Engine · E9.H1 Closeout</p>
<h1>Hybrid Art Quality Decision</h1>
<p class="status">{policy["status"]}</p>
<p class="lead">Đề xuất Option B. Giữ pipeline làm công cụ lắp ráp component do artist thiết kế và duyệt. Pose mới qua QA. Các khác biệt ở tay nắm và viền kính chưa đủ để xác lập lợi ích cho toàn nhân vật ở 1×.</p>
<nav aria-label="Mục lục"><a href="#blind">So sánh ẩn nhãn</a><a href="#pose">Kiểm toán pose</a><a href="#holdout">Holdout</a><a href="#references">Reference Pack</a><a href="#decision">Go / No-Go</a><a href="#qa">QA</a><a href="#review">Phiếu duyệt</a></nav>
<div class="controls"><span>Tỷ lệ</span><button type="button" data-scale="1" aria-pressed="true">Native 1×</button><button type="button" data-scale="4" aria-pressed="false">Nearest 4×</button><button type="button" id="backdrop" aria-pressed="false">Nền sáng</button></div>
<noscript><p class="warning">Bật JavaScript cục bộ để đọc ảnh nhúng.</p></noscript>
</header>
<section id="blind">
<h2>So sánh ẩn nhãn ở 1×</h2>
<p>Chấm X/Y trước khi mở khóa. Các ảnh là PNG lịch sử đã khóa. Dùng 4× để khoanh vùng nhận xét. Chấm A0 với B matched trong cùng capability, và chấm Full Hybrid r1/r2 độc lập.</p>
{baseline}
{locked_review}
{components}
<p class="muted">Quan sát do trợ lý thực hiện với nhãn ẩn và đã quen với các sprite. Đánh giá độc lập của Owner đang chờ.</p>
</section>
<section id="pose">
<h2>Breakwater · Giữ cổng KNEE_DIRECTION</h2>
<p>Near hip (29, 37), knee (27, 44), ankle (29, 53) cho lệch −2 px so với đường hông–cổ chân. Trong three-quarter-right, mũi boot hai bên hướng +x. PoseSpec cung cấp gối và cổ chân nguyên pixel, còn rig chiếu hông gần từ pelvis, bề rộng hông và độ lệch chiều sâu.</p>
<p>Validator đo độ lệch quanh đường hông–cổ chân tại cao độ gối. Gối có thể nằm bên trái hông trong một stance hợp lệ. Ma trận có một ví dụ như vậy đã đạt. Giá trị −1 px được chấp nhận. Breakwater cũ vẫn bị từ chối ở −2 px. Một ảnh có thể gợi dáng xoay ngoài, còn rig hiện tại chỉ biểu diễn boot hướng +x. Bằng chứng chưa đủ để coi đây là false positive và nới ngưỡng.</p>
<p>Quy tắc tại nguồn tính cả hai gối theo độ sâu dọc chân và độ gập hướng +x rồi làm tròn. Breakwater có gối gần (31, 44), độ lệch +2 px. Hông, cổ chân, tiếp đất và pivot giữ đúng dữ liệu gốc. Breakwater thuộc tập chẩn đoán.</p>
{broken}
<div class="scroll"><table><thead><tr><th scope="col">Pose</th><th scope="col">Gối gần · px</th><th scope="col">Gối xa · px</th><th scope="col">Sole gần / xa</th><th scope="col">Tâm x</th><th scope="col">Kết quả</th></tr></thead><tbody>{matrix_rows}</tbody></table></div>
{details("Ảnh ma trận và anchors tại 1×", matrix_imgs)}
</section>
<section id="holdout">
<h2>Holdout mới · Tidegate Grate Maintainer</h2>
<p>Seed 73193. Dáng rộng hơn, hook rút ngắn trong Full track và hộp bảo trì có cùng capability. Brief, style, source pose và ngưỡng QA đã khóa trước lần dựng đầu. Ở cả năm nhánh, kỹ thuật đạt và ống chân xa còn 26 pixel sau khi nâng hộp theo rule đã khóa.</p>
<p class="warning">Tại 1×, nhận xét của trợ lý cho thấy Tidal và Tidegate vẫn đọc như một nhóm nghề rất gần nhau ở Day và Night. Ghi <code>ARTISTIC_IDENTITY_FAILURE</code> cho mục phân biệt nghề trong benchmark. Quyết định mỹ thuật thuộc Owner.</p>
{fresh}
{details("Seal và lần dựng đầu", pretty(seal["holdout"]) + pretty(first))}
</section>
<section id="references">
<h2>Reference Pack · ART_REFERENCE_QUALITY_GAP</h2>
<p>Chín nguồn nội bộ có ảnh, role, provenance và yêu cầu bảo toàn. Cả chín đang PENDING. Các mục ứng viên cần Owner duyệt trước khi dùng làm chuẩn nghệ thuật.</p>
<div class="kit-grid">{refs}</div>
</section>
<section id="decision">
<h2>Go / No-Go · Option B</h2>
<p><strong>Go</strong> cho renderer, mask, anchor, revision và procedural composition trong workflow do artist chỉ đạo. Creator/Owner duyệt component nguồn và mẫu silhouette nghề trước khi dùng làm chuẩn.</p>
<p><strong>No-Go</strong> cho mở rộng Character Generator và các vòng tinh chỉnh từ reference nội bộ chưa duyệt. Glove r2 gọn hơn ở phần ngón. Viền visor r2 rõ hơn. Suit và khả năng nhận diện trong hai cảnh chưa cho thấy lợi ích tổng thể. Vòng closeout giữ đúng r1/r2 và không tạo thêm revision mỹ thuật.</p>
<p class="muted">ASSISTANT_REVIEW_RECOMMENDATION · Owner Approval PENDING</p>
</section>
<section id="qa">
<h2>Technical QA</h2>
<p>Lint, typecheck, build, smoke và 85/85 Engine tests đạt. 805 SHA lịch sử, các manifest E9.H1/E9.H1R, {qa["deterministicEntries"]} kết quả closeout tái lập và {len(qa["studio"]["images"])} Studio PNG round-trip đúng RGBA. Ma trận có 4 pose hợp lệ và 5 lần từ chối đúng dự kiến.</p>
<p>Ba mươi tám mục xóa báo cáo E7–E8 thuộc working tree trước khi mở nhánh. Đối chiếu index và lịch sử chứng minh chúng nằm ngoài bốn commit E9.H1R. Các mục này nằm ngoài phạm vi closeout.</p>
{details("QA, dữ liệu pose và grip", pretty(qa) + pretty(summary["cases"]))}
{details("Source revisions và SHA-256", pretty(source_info))}
{details("Biên nhận audit working tree", pretty(audit))}
</section>
<section id="review">
<h2>Phiếu Human Review</h2>
<p>Chấm Rubric v2 Static Addendum ở 1×, đánh dấu Critical Defect và chọn A, B, Neither hoặc Revision Required. Phiếu có lựa chọn chín reference và quyết định kiến trúc.</p>
<p><a class="download" download="E9-H1-CLOSEOUT-HUMAN-REVIEW.json" href="data:application/json;base64,{review}">Tải JSON trống</a></p>
<p class="muted">E8_5_OWNER_REVIEW_PENDING · GAME_READY_ART_NOT_APPROVED · E9_H2_NOT_AUTHORIZED · E9_2_NOT_AUTHORIZED · DEEPSEEK_DEFERRED</p>
</section>
</main><script type="application/json" id="pngs">{inline(payload)}</script>
<script type="application/json" id="dimensions">{inline(dims)}</script>
<script type="application/json" id="image-files">{inline(sources)}</script>
<script>{script}</script>
</body></html>
"""
OUT.write_text(page, encoding="utf-8", newline="\n")
print(json.dumps({"html":OUT.as_posix(),"sha256":sha256(OUT.read_bytes()).hexdigest(),"bytes":len(OUT.read_bytes()),
                  "payloads":len(payload),"sources":len(sources),"placements":page.count("<img ")}))
