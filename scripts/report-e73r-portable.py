"""Package verified E7.3R PNG and metadata files in one offline gallery."""
import argparse
import json
import re
from pathlib import Path
from runpy import run_path

common = run_path("scripts/report-e72-portable.py")
Evidence, details, esc, page, sha, table = (
    common[name] for name in ("Evidence", "details", "esc", "page", "sha", "table")
)
ROOT = Path("benchmarks/results/e73r")
REPORT = Path("docs/reports/E7.3R-PORTABLE-ART-REVIEW.html")
TITLE = "E7.3R · Semantic Style Review"
STATUS = "E7_3R_READY_FOR_FINAL_HUMAN_STYLE_REVIEW"
VARIANTS = ("A", "B", "C")
VIEWS = [
    ("scene-day", "Cảnh Day"), ("scene-night", "Cảnh Night"),
    ("character", "Nhân vật Day"), ("character-night", "Nhân vật Night"),
    ("prop", "Thiết bị"), ("environment", "Môi trường Day"), ("environment-night", "Môi trường Night"),
]
AREAS = {"character": "Nhân vật", "prop": "Thiết bị", "environment": "Môi trường", "set": "Cả bộ"}
LABELS = dict(zip(
    ("silhouette", "proportions", "identity", "materialHierarchy", "dayNightReadability",
     "functionalRecognition", "materialSeparation", "outline", "signal", "pixelClusters",
     "paletteHarmony", "depth", "lighting", "architecture", "gameplayComposition",
     "hierarchy", "coherence", "semanticContrast", "styleConsistency", "individuality"),
    ("Silhouette", "Tỷ lệ", "Giữ bản sắc", "Thứ bậc vật liệu", "Độ đọc Day/Night",
     "Nhận diện chức năng", "Tách vật liệu", "Đường viền", "Tín hiệu", "Cụm pixel",
     "Hòa hợp bảng màu", "Chiều sâu", "Ánh sáng", "Đọc kiến trúc", "Bố cục gameplay",
     "Thứ bậc thị giác", "Liên kết giữa asset", "Tương phản ngữ nghĩa", "Phong cách", "Cá tính asset"),
))
NOTES = {
    "stormwatch": (
        "C thu lại một phần độ tách biên Night so với B. A vẫn cho biên rõ hơn ở vùng yếu. "
        "C giữ đèn amber của B và làm rõ chân gỗ. Dáng mái nhỏ cho biết đây là hộp che thiết bị, "
        "công dụng thời tiết vẫn khó đoán độc lập ở 1×.",
    ),
    "tidegate": (
        "C giữ đúng áo nâu đỏ của A, vẫn dùng họ kim loại và đèn của B. "
        "Biên nhân vật Night rõ hơn B ở nhóm mẫu thấp. Ở Day, A vẫn tách nền tốt hơn. "
        "Vạch đo dễ thấy trong C. Hình khối cần thêm dấu hiệu chức năng.",
    ),
    "mistfen": (
        "MIXED_RESULT. C giữ áo và tín hiệu. P10 biên nhân vật Night giảm từ 23 của B xuống 18 "
        "và số biên dưới ngưỡng giữ ở 14. Cổng bậc, tường chắn thấp và sân đá đổi dáng kiến trúc. "
        "CAPABILITY_GAP về mặt nước, phà và cầu sàn. Tổng thể trông giống một trạm nước cổ ở 1×.",
    ),
}
CSS = """
.triad{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:.5rem 0 1.25rem}
.triad .art{display:block;justify-items:stretch;min-width:0;padding:.35rem 0}
.triad .crop{overflow:auto;width:100%;min-width:0;max-width:100%;max-height:68vh;overscroll-behavior:contain}
.triad .crop:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.triad .pixels{margin-inline:auto;width:max-content}
.triad .art img{max-width:none}
.triad[data-scale="1"] .art figcaption{font-weight:700}
.triad[data-scale="1"] .art:nth-child(3) figcaption{color:var(--gold)}
h3{margin-top:1.25rem}
form fieldset{border:1px solid var(--border);margin:1rem 0;padding:.75rem;min-width:0}
form legend{padding:0 .4rem}
form label{color:var(--muted)}
form select{width:100%}
form td select{min-width:3.6rem}
section p code{overflow-wrap:anywhere}
@media(max-width:550px){.triad{gap:4px}.triad figcaption{font-size:.88rem}}
"""
SCRIPT = """
for(const grid of document.querySelectorAll('[data-sync]')){
  const panes=[...grid.querySelectorAll('.crop')];
  for(const pane of panes) pane.addEventListener('scroll',()=>{
    for(const other of panes){
      if(other.scrollLeft!==pane.scrollLeft) other.scrollLeft=pane.scrollLeft;
      if(other.scrollTop!==pane.scrollTop) other.scrollTop=pane.scrollTop;
    }
  },{passive:true});
}
const review=document.getElementById('human-review');
review.addEventListener('submit',event=>{
  event.preventDefault();
  const sheets=[...review.querySelectorAll('[data-case]')].map(field=>{
    const decisions=Object.fromEntries([...field.querySelectorAll('[data-decision]')].map(input=>[
      input.dataset.decision,input.value||null
    ]));
    const scores={};
    for(const input of field.querySelectorAll('[data-score]')){
      const [area,variant,criterion]=input.dataset.score.split('.');
      scores[area]??={};
      scores[area][variant]??={};
      scores[area][variant][criterion]=input.value?Number(input.value):null;
    }
    return {id:field.dataset.case,decisions,scores,notes:field.querySelector('textarea').value};
  });
  const data={version:1,status:'HUMAN_REVIEW_DRAFT',options:['A','B','C','Neither'],cases:sheets};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\\n'],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;
  link.download='e73r-human-review.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
"""


def load_evidence():
    expected = {}
    for line in (ROOT / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        digest, name = line.split("  ", 1)
        assert name not in expected
        expected[name] = digest
    evidence = Evidence(expected)
    manifest = json.loads(evidence.verified(ROOT / "benchmark.json"))
    files = {**manifest["files"], **manifest["reused"]}
    assert len(expected) == len(files) + 1
    assert all(expected[name] == digest for name, digest in files.items())
    for name in ("SHA256SUMS", "verification.json", "studio-parity.json", "e73-artistic-review.json"):
        file = ROOT / name
        expected[file.as_posix()] = sha(file.read_bytes())
    return evidence, manifest


def strip(evidence, paths, view=None, scale=1):
    slots = []
    for path, label in paths:
        figure = evidence.image(Path(path), label)
        pane = f'<div class="crop" tabindex="0" aria-label="{esc(label)} · cuộn ảnh">'
        slots.append(figure.replace('<div class="pixels">', pane + '<div class="pixels">')
                     .replace("</div></figure>", "</div></div></figure>"))
    attrs = f' data-sync data-view="{esc(view)}" data-scale="{scale}"' if view else ""
    return f'<div class="triad"{attrs}>' + "".join(slots) + "</div>"


def case_section(evidence, case):
    case_id = case["id"]
    qa = json.loads(evidence.verified(ROOT / case["qa"]))
    blocks = []
    for view, label in VIEWS:
        def show(scale):
            return strip(evidence, [(case["images"][version][f"{view}-{scale}"], version) for version in VARIANTS],
                         view=view, scale=scale)
        blocks.append(f'<h3>{esc(label)} · 1×</h3>' + show(1) + details("4× nearest-neighbor", show(4)))
    geo = case["geometry"]
    geometry = []
    for names in [
        [("character-silhouette", "Silhouette nhân vật"), ("prop-silhouette", "Silhouette thiết bị"),
         ("environment-silhouette", "Silhouette kiến trúc")],
        [("character-material", "Material nhân vật"), ("prop-material", "Material thiết bị"),
         ("scene-material", "Material cảnh")],
        [("scene-flat", "Layer ownership")],
    ]:
        geometry.append(strip(evidence, [(geo[key], label) for key, label in names]))

    def metrics(v):
        day, night = (qa["diagnostics"][v][time] for time in ("day", "night"))
        prop = night["prop"]
        bounds = qa["candidate"]["prop"]["materialBoundaries"][v]
        foot = next(row for row in bounds if row["roles"] == "#48425e/#bc8862")
        return [
            day["character"]["silhouette"]["p10"], night["character"]["silhouette"]["p10"],
            night["character"]["silhouette"]["weak"], night["character"]["contact"]["p10"],
            prop["silhouette"]["p10"], prop["contact"]["p10"], prop["signal"]["housing"]["median"],
            foot["p10"], foot["median"], max(night["character"]["weakOutlineRuns"], default=0),
        ]

    rows = zip([
        "Biên nhân vật/nền Day · P10", "Biên nhân vật/nền Night · P10", "Mẫu biên Night yếu (<18)",
        "Tiếp xúc nền Night · nhân vật · P10", "Biên thiết bị/nền Night · P10",
        "Tiếp xúc nền Night · thiết bị · P10", "Biên tín hiệu/vỏ Night · trung vị",
        "Viền–gỗ · P10", "Viền–gỗ · trung vị", "Cụm viền Night yếu dài nhất · px",
    ], *(metrics(v) for v in VARIANTS))
    role = "Holdout khóa trước" if case["role"] == "holdout" else "Development"
    identity = qa["candidate"]["identity"]["exactPixels"]
    amber = qa["candidate"]["prop"]["amberPixelsExact"]
    changed = qa["candidate"]["night"]["outlineChanged"]
    layer = ("C giữ nguyên hình học, camera, collision, alpha và mask A/B. "
             f"Pixel áo giữ từ A trong mask được khai báo: {identity}. "
             f"Pixel amber giữ từ B: {amber}. Pixel viền Night đổi: {changed}.")
    qa_file = evidence.download(ROOT / case["qa"], "Tải QA và geometry JSON", case_id + "-qa.json")
    return f"""<section id="{esc(case_id)}"><h2>{esc(case["label"])}</h2>
<p>{role} · seed {case["seed"]}. {esc(case["note"])}</p>
<p class="notes">{esc(NOTES[case_id])}</p>
{''.join(blocks)}
{details("Silhouette, ownership và material masks", ''.join(geometry))}
{details("Contrast, contact và geometry QA", f'<p>{esc(layer)}</p>' + table(["Chỉ số", *VARIANTS], rows) + qa_file)}
</section>"""


def review_form(cases, criteria):
    options = '<option value="">Chưa chọn</option>' + "".join(f"<option>{v}</option>" for v in (*VARIANTS, "Neither"))
    score_options = '<option value="">—</option>' + "".join(f"<option>{v}</option>" for v in range(1, 6))
    fields = []
    for case in cases:
        case_id = case["id"]
        groups = []
        for area, label in AREAS.items():
            pick = f'<label>{label}<select data-decision="{area}">{options}</select></label>'
            rows = []
            for criterion in criteria[area]:
                name = LABELS[criterion]
                scores = "".join(
                    f'<td><select data-score="{area}.{v}.{criterion}" aria-label="{esc(case_id)} · {esc(name)} · {v}">{score_options}</select></td>'
                    for v in VARIANTS
                )
                rows.append(f'<tr><th scope="row">{esc(name)}</th>{scores}</tr>')
            head = "".join(f'<th scope="col">{v}</th>' for v in VARIANTS)
            rubric = '<div class="scroll"><table><thead><tr><th scope="col">Tiêu chí</th>' + head + "</tr></thead><tbody>"
            rubric += "".join(rows) + "</tbody></table></div>"
            groups.append(pick + details("Điểm tự chấm · " + label, rubric))
        fields.append(f'<fieldset data-case="{esc(case_id)}"><legend>{esc(case["label"])}</legend>'
                      + "".join(groups) + '<label>Nhận xét<textarea rows="3"></textarea></label></fieldset>')
    return '<form id="human-review">' + "".join(fields) + '<button type="submit" class="primary">Tải phiếu JSON</button></form>'


def main():
    arg = argparse.ArgumentParser(description=__doc__)
    arg.add_argument("--source-sha", required=True)
    source = arg.parse_args().source_sha
    assert re.fullmatch(r"[0-9a-f]{40}", source)
    evidence, manifest = load_evidence()
    cases = manifest["cases"]
    verification = json.loads(evidence.verified(ROOT / "verification.json"))
    criteria = json.loads(evidence.verified(ROOT / "human-review.json"))["criteria"]
    body = "".join(case_section(evidence, case) for case in cases)
    downloads = "".join(evidence.download(ROOT / file, label) for file, label in [
        ("benchmark.json", "Benchmark"), ("SHA256SUMS", "SHA-256 manifest"),
        ("verification.json", "Technical QA"), ("studio-parity.json", "Studio RGBA"),
        ("e73-artistic-review.json", "E7.3 Closeout JSON"), ("human-review.json", "Phiếu trống"),
    ])
    body += f"""<section id="review"><h2>Phiếu duyệt mỹ thuật</h2>
<p>Xem 1× trước. Cuộn một ô để xem cùng chi tiết trong cả ba bản. Có thể chọn A, B, C hoặc Neither và chấm 1–5 theo từng tiêu chí. Phiếu để trống lựa chọn và điểm.</p>
{review_form(cases, criteria)}</section>
<section id="quality"><h2>Kiểm tra kỹ thuật</h2>
{table(["Kiểm tra", "Trạng thái", "Bằng chứng"], verification["checks"])}
<p>Checkpoint E7.3 <code>{esc(manifest["checkpoint"])}</code>. Commit triển khai và bằng chứng <code>{source}</code>.
Nhánh <code>codex/e7-3r-semantic-style-readability</code>. Working tree sạch tại checkpoint triển khai trước đóng gói.</p>
<p class="downloads">{downloads}</p></section>
<section id="summary"><h2>CHATGPT REVIEW SUMMARY</h2>
<p>A dùng palette từng generator. B dùng ArtDirectionSpec v1. C giữ màu nhận diện được khai báo, giữ tín hiệu B, nâng shadow gỗ trong cụm và chỉnh tối đa một cụm viền Night.
Cải thiện của C khác nhau theo bối cảnh. Stormwatch Night chỉ cải thiện một phần so với B; ở Mistfen, giữ áo làm P10 giảm so với B.</p>
<p>Môi trường Night bằng từng pixel ở A/B/C. Hình khối thiết bị còn giới hạn chức năng. Kiến trúc Mistfen là cổng bậc và sân đá. Kết quả chưa xác nhận chất lượng tổng quát, lựa chọn của Owner và E7.4 vẫn ở bước duyệt và thiết kế.</p></section>"""
    nav = [(c["id"], c["label"].split()[0]) for c in cases] + [("review", "Phiếu duyệt"), ("quality", "QA"), ("summary", "Tóm tắt")]
    expected = {name for name in {**manifest["files"], **manifest["reused"]} if name.endswith(".png")}
    assert set(evidence.pictures) == expected
    lead = "A độc lập, B phối hợp màu, C giữ nhận diện theo ngữ cảnh. So ba phiên bản trên cùng hình khối và ánh sáng."
    output = page(TITLE, STATUS, lead, nav, body, evidence, extra_css=CSS, extra_script=SCRIPT)
    REPORT.write_bytes(output.encode("utf-8"))
    print(f"{len(evidence.pictures)} PNG files, {output.count('<img ')} image views, {len(evidence.metadata)} attached metadata; SHA-256 {sha(REPORT.read_bytes())}")


if __name__ == "__main__":
    main()
