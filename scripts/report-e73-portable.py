"""Build the single E7.3 HTML from PNG and QA bytes in the locked benchmark."""
import argparse
import json
import re
from pathlib import Path

from runpy import run_path

common = run_path("scripts/report-e72-portable.py")
Evidence, details, esc, page, sha, swatches, table = (
    common[name] for name in ("Evidence", "details", "esc", "page", "sha", "swatches", "table")
)
ROOT = Path("benchmarks/results/e73")
REPORT = Path("docs/reports/E7.3-PORTABLE-ART-REVIEW.html")
STATUS = "E7_3_READY_FOR_HUMAN_STYLE_REVIEW"
CSS = """
.ab{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:.5rem 0 1rem}
.ab .art{display:block;justify-items:stretch;padding:.35rem 0;min-width:0}
.ab .crop{overflow:auto;width:100%;min-width:0;max-width:100%;max-height:70vh;overscroll-behavior:contain}
.ab .crop:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.ab .pixels{width:max-content;margin-inline:auto}
.ab .art img{max-width:none}
section h3{margin-top:1rem}
form fieldset{border:1px solid var(--border);margin:0 0 1rem;padding:.75rem;min-width:0}
form legend{padding:0 .35rem}
form label{margin:0 0 .7rem;color:var(--muted)}
form select{width:100%}
pre code,section p code{overflow-wrap:anywhere}
"""
SCRIPT = """
for(const row of document.querySelectorAll('[data-sync]')){
  for(const pane of row.querySelectorAll('.crop')){
    pane.addEventListener('scroll',()=>{
      const other=[...row.querySelectorAll('.crop')].find(candidate=>candidate!==pane);
      if(other.scrollLeft!==pane.scrollLeft) other.scrollLeft=pane.scrollLeft;
      if(other.scrollTop!==pane.scrollTop) other.scrollTop=pane.scrollTop;
    },{passive:true});
  }
}
const review=document.getElementById('human-review');
review.addEventListener('submit',event=>{
  event.preventDefault();
  const fields=[...review.querySelectorAll('fieldset')];
  const cases=fields.map(field=>({
    id:field.dataset.case,
    choices:Object.fromEntries([...field.querySelectorAll('select')].map(input=>[
      input.name,input.value||null
    ])),
    notes:field.querySelector('textarea').value
  }));
  const picks=cases.flatMap(candidate=>Object.values(candidate.choices));
  const status=picks.every(Boolean)?'HUMAN_REVIEW_RECORDED':
    picks.some(Boolean)?'PARTIAL_HUMAN_REVIEW':'PENDING_HUMAN_REVIEW';
  const data={version:1,status,choices:['A','B','Neither'],cases};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\\n'],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;
  link.download='e73-human-review.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
"""
AREAS = [
    ("character", "Nhân vật"), ("prop", "Đạo cụ"), ("environment", "Môi trường"),
    ("setConsistency", "Cả bộ"),
]
VIEWS = [
    ("character", "Nhân vật"), ("prop", "Đạo cụ"), ("environment", "Môi trường · Day"),
    ("environment-night", "Môi trường · Night"), ("scene-day", "Cả bộ · Day"), ("scene-night", "Cả bộ · Night"),
]
NOTES = {
    "stormwatch": (
        "Màu áo B ăn nhập với mái trạm và đèn amber có mặt sáng đọc rõ hơn. Viền chân đế gỗ chìm hơn trong B. "
        "Cạnh nhân vật với nền tối yếu đi ở Night. Dáng có mái che vẫn dễ bị đọc thành hộp tín hiệu chung.",
        "Weather Maintenance Technician cầm đèn kiểm tra. Compact Weather Signal Device dùng vạt mái ngang "
        "và màn hình lùi. Hai nhân vật và các "
        "đồ dùng cố định trong cảnh giúp nhìn tỉ lệ qua cửa và lối đi.",
    ),
    "tidegate": (
        "Áo xanh B thay áo nâu đỏ của A, làm mất mảng màu ấm riêng trên nhân vật. Vết áo sáng rõ ở Night hơn, "
        "nhưng biên gần nền Day yếu hơn. B làm rõ thanh đo amber, chân đế gỗ nhập vào cạnh tối hơn A.",
        "Tidegate đặt nhà bên trái và mở sân thao tác sang phải. Người hiệu chuẩn đeo túi, "
        "dáng gọn hơn Stormwatch. Upright Sluice Depth Gauge có thanh đo đứng trên chân đế riêng.",
    ),
}


def evidence_for_run():
    expected = {}
    for line in (ROOT / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        digest, name = line.split("  ", 1)
        expected[(ROOT / name).as_posix()] = digest
    for name in ("SHA256SUMS", "studio-parity.json", "verification.json"):
        path = ROOT / name
        expected[path.as_posix()] = sha(path.read_bytes())
    result = Evidence(expected)
    benchmark = json.loads(result.verified(ROOT / "benchmark.json"))
    for name, digest in benchmark["files"].items():
        assert expected[(ROOT / name).as_posix()] == digest, name
    assert len(expected) == len(benchmark["files"]) + 4
    return result, benchmark


def comparison(evidence, paths):
    figures = []
    for path, label in paths:
        figure = evidence.image(path, label)
        viewport = '<div class="crop" tabindex="0" aria-label="' + esc(label) + ' · cuộn ảnh">'
        figures.append(figure.replace('<div class="pixels">', viewport + '<div class="pixels">')
                       .replace("</div></figure>", "</div></div></figure>"))
    assert len(figures) in (1, 2)
    sync = " data-sync" if len(figures) == 2 else ""
    return f'<div class="ab"{sync}>' + "".join(figures) + "</div>"


def review_form(cases):
    options = '<option value="">Chưa chọn</option><option>A</option><option>B</option><option>Neither</option>'
    fields = []
    for case in cases:
        inputs = "".join(f'<label>{label}<select name="{key}">{options}</select></label>' for key, label in AREAS)
        fields.append(f'<fieldset data-case="{esc(case["id"])}"><legend>{esc(case["label"])}</legend>'
                      f'<div class="cards">{inputs}</div><label>Nhận xét<textarea rows="3"></textarea></label></fieldset>')
    return ('<form id="human-review">' + "".join(fields) +
            '<button class="primary" type="submit">Tải kết quả duyệt JSON</button></form>')


def case_section(evidence, case):
    case_id = case["id"]
    root = ROOT / case_id
    qa = json.loads(evidence.verified(root / "qa.json"))
    role = "Development" if case["role"] == "development" else "Holdout khóa trước"

    def ab(name, label):
        return comparison(evidence, [(root / v.lower() / (name + ".png"), v + " · " + label) for v in ("A", "B")])

    def geometry(filenames):
        return comparison(evidence, [(root / "geometry" / (filename + ".png"), label) for filename, label in filenames])

    scenes = "".join('<h3>' + label + " · 1×</h3>" + ab(name, label) +
                     details("4× nearest-neighbor", ab(name + "-4x", label + " · 4×"))
                     for name, label in [VIEWS[4], VIEWS[5], *VIEWS[:4]])
    diagnostic = ""
    for family, label in VIEWS[:3]:
        flat = "Layer ownership" if family == "environment" else "Flat geometry"
        diagnostic += '<h3>' + label + "</h3>"
        diagnostic += geometry([(family + "-flat", flat), (family + "-silhouette", "Silhouette")])
        diagnostic += geometry([(family + "-material", "Material mask")])
        if family != "environment":
            diagnostic += details("Nền sáng và tối · 1×", ab(family + "-light", "Nền sáng") + ab(family + "-dark", "Nền tối"))
    diagnostic += geometry([("scene-flat", "Ownership cảnh"), ("scene-material", "Mask cảnh")])
    diagnostic += geometry([("scene-collision", "Lối đi và va chạm trên cảnh A")])

    def metrics(variant):
        q = qa[variant]
        edge = q["landscape"]["occlusion"]
        boundaries = {b["roles"]: b for b in q["prop"]["materialBoundaries"]}
        return [
            edge["day"]["p10LumaGap"], edge["night"]["p10LumaGap"], edge["day"]["visible"],
            q["actor"]["scale"]["silhouette"]["height"],
            q["actor"]["detail"]["per100"], q["prop"]["detail"]["per100"],
            boundaries["#48425e/#bc8862"]["median"], boundaries["#98a0be/#bc8862"]["median"],
            boundaries["#98a0be/#f9bb51"]["median"],
        ]

    rows = zip([
        "Biên nhân vật/nền Day · P10 luma", "Biên nhân vật/nền Night · P10 luma",
        "Pixel nhân vật thấy được", "Cao silhouette nhân vật · px",
        "Biên chi tiết ở nhân vật / 100 cặp", "Biên chi tiết ở thiết bị / 100 cặp",
        "Viền–gỗ thiết bị · median luma", "Kim loại–gỗ thiết bị · median luma", "Kim loại–amber thiết bị · median luma",
    ], metrics("A"), metrics("B"))
    authored_coat = qa["A"]["actor"]["material"]["ramps"]["coat"]
    coat = {"A": [authored_coat[i] for i in (0, 3, 1, 2)], "B": qa["B"]["actor"]["material"]["ramps"]["coat"]}
    palette = "".join(
        '<h3>' + v + '</h3>' + swatches({
            "Áo nhân vật (shadow, accent, base, light)": coat[v],
            "Prop kim loại": qa[v]["palette"]["deviceSurfaces"]["metal"],
            "Mái môi trường Day": next(r["ramp"] for r in qa[v]["palette"]["environment"] if r["material"] == "roof"),
            "Tín hiệu amber": qa[v]["palette"]["deviceSurfaces"]["amber"],
            "Viền nhân vật / prop": [qa[v]["palette"]["characterContour"], qa[v]["palette"]["deviceContour"]],
        }) for v in ("A", "B")
    )
    qa_link = evidence.download(root / "qa.json", "Tải QA · " + case_id, case_id + "-qa.json")
    note, description = NOTES[case_id]
    return f"""<section id="{esc(case_id)}"><h2>{esc(case["label"])}</h2>
<p>{role} · seed {case["seed"]}. {esc(description)}</p>
<div class="notes"><p>{esc(note)}</p></div>
{scenes}
{details("Flat geometry, silhouette, masks và nền sáng/tối", diagnostic)}
{details("Quan hệ màu và value", palette)}
{details("Chẩn đoán pixel và geometry QA", table(["Chỉ số", "A", "B"], rows) + qa_link)}
</section>"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-sha", required=True)
    args = parser.parse_args()
    assert re.fullmatch(r"[a-f0-9]{64}|[a-f0-9]{40}", args.source_sha)
    evidence, benchmark = evidence_for_run()
    cases = benchmark["cases"]
    sections = "".join(case_section(evidence, case) for case in cases)
    provenance = "".join(evidence.download(ROOT / name, label) for name, label in [
        ("SHA256SUMS", "Tải SHA-256 manifest"), ("benchmark.json", "Tải benchmark"),
        ("verification.json", "Tải technical QA"), ("studio-parity.json", "Tải Studio parity"),
        ("human-review.json", "Tải phiếu trống"),
    ])
    checks = json.loads(evidence.verified(ROOT / "verification.json"))
    pins = table(["Kiểm tra", "Kết quả"], checks["summary"])
    sections += f"""<section id="review"><h2>Phiếu duyệt mỹ thuật</h2>
<p>So A/B ở 1×. Kiểm dáng, chức năng, độ tách nền và tỉ lệ trước khi so cụm, viền và chất liệu ở 4×.
Chọn A, B hoặc Neither cho từng họ và cho độ nhất quán của cả bộ. Hai brief đều đang chờ lựa chọn.</p>
{review_form(cases)}</section>
<section id="qa"><h2>Kết quả kỹ thuật</h2>{pins}
<p>Checkpoint nguồn <code>{esc(benchmark["checkpoint"])}</code>. Commit triển khai và bằng chứng <code>{args.source_sha}</code>.
Nhánh local <code>codex/e7-3-cross-asset-art-direction</code>. Working tree sạch tại checkpoint triển khai khi bắt đầu đóng gói.</p>
<p class="downloads">{provenance}</p></section>
<section id="summary"><h2>CHATGPT REVIEW SUMMARY</h2>
<p>Stormwatch và Tidegate có cùng geometry, seed và anchor giữa A/B trong từng brief. A dùng các role màu sẵn có
của từng family. B điều phối áo, mái, kim loại, amber và viền trên cùng hệ B1. B tăng độ tách tín hiệu ở hai thiết bị,
đổi cá tính áo Tidegate và giảm tương phản biên của nhân vật Stormwatch Night. Xem thiết bị ở 1× để đánh giá
chức năng có đọc được độc lập hay không.</p>
<p>Night giữ bảng màu môi trường B1 và giữ nguyên sprite nhân vật/prop từ Day. Flat của môi trường là ownership map.
Studio đọc và xuất PNG qua kiểm tra RGBA. Chủ dự án quyết định chất lượng từng asset và cả bộ. E7.4 chỉ có đề xuất.</p></section>"""
    nav = [("stormwatch", "Stormwatch"), ("tidegate", "Tidegate"), ("review", "Phiếu duyệt"),
           ("qa", "QA"), ("summary", "Tóm tắt")]
    expected_pngs = {str(ROOT / name).replace("\\", "/") for name in benchmark["files"] if name.endswith(".png")}
    assert set(evidence.pictures) == expected_pngs
    html = page("E7.3 · Cross-Asset Art Review", STATUS,
                "Stormwatch và Tidegate · A độc lập và B theo ArtDirectionSpec. Cùng hình khối, seed và vị trí.",
                nav, sections, evidence, extra_css=CSS, extra_script=SCRIPT)
    REPORT.write_bytes(html.encode("utf-8"))
    print(f"{len(evidence.pictures)} PNG · {len(evidence.metadata)} metadata · SHA-256 {sha(REPORT.read_bytes())}")


if __name__ == "__main__":
    main()
