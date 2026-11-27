"""Package the locked E7.4 evidence and human review sheet as offline HTML."""
import argparse
import json
import re
from pathlib import Path
from runpy import run_path

common = run_path("scripts/report-e73r-portable.py")
Evidence, details, esc, page, sha, strip, table = (
    common[name] for name in ("Evidence", "details", "esc", "page", "sha", "strip", "table")
)
ROOT = Path("benchmarks/results/e74")
OUT = Path("docs/reports/E7.4-PORTABLE-ART-REVIEW.html")
CSS = common["CSS"] + """
.triad.dual{grid-template-columns:repeat(2,minmax(0,1fr))}
.case-notes{max-width:75ch}
.art code,p code{overflow-wrap:anywhere}
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
const form=document.querySelector('#e74-review');
form.addEventListener('submit',event=>{
  event.preventDefault();
  const cases=[...form.querySelectorAll('fieldset')].map(section=>{
    const scores={};
    for(const input of section.querySelectorAll('[data-score]')){
      const [variant,key]=input.dataset.score.split('.');
      scores[variant]??={};
      scores[variant][key]=input.value?Number(input.value):null;
    }
    return {id:section.dataset.case,choice:section.querySelector('[data-choice]').value||null,
      scores,notes:section.querySelector('textarea').value};
  });
  const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,status:'HUMAN_REVIEW_DRAFT',cases},null,2)+'\\n'],
    {type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;
  link.download='e74-human-review.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
"""
CRITERIA = {
    "functionalRecognition": "Nhận diện chức năng", "silhouette": "Silhouette",
    "proportions": "Tỷ lệ", "perspective": "Phối cảnh", "materialSeparation": "Tách vật liệu",
    "clusters": "Cụm pixel", "outline": "Đường viền", "nativeReadability": "Độ đọc ở 1×",
    "dayNightContext": "Hòa vào cảnh Day/Night", "generalization": "Khả năng chuyển brief",
}
NOTES = {
    "field-rain-gauge": (
        "A0 có tín hiệu amber nổi trên nền Night, hình vẫn giống hộp điều khiển. A1 cho thấy ống, vạch và khe khung. "
        "A2 đưa ống lệch về một bên và có trụ chắc hơn; khối dưới nặng hơn. A1/A2 giảm độ tách biên Night so với A0. "
        "Vạch thang đọc được ở 1×; công dụng đo mưa cụ thể cần Owner xác nhận."
    ),
    "harbor-signal-beacon": (
        "A0 đọc như hộp tín hiệu thấp. A1 có đầu đèn, thân trụ và tay gạt nhỏ; A2 dùng chân giằng và khoảng trống dưới đầu đèn. "
        "Đầu đèn dễ định vị, nhưng tay gạt và bản lề khó nhận ra ở 1×. Hai hình có biên Night yếu hơn A0. "
        "Một holdout giữ được hình dáng đèn, kết quả chưa đủ để khái quát hoá."
    ),
}


def load_report_evidence():
    expected = {}
    for row in (ROOT / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        digest, name = row.split("  ", 1)
        path = (ROOT / name).as_posix()
        assert path not in expected
        expected[path] = digest
    evidence = Evidence(expected)
    bench = json.loads(evidence.verified(ROOT / "benchmark.json"))
    assert len(expected) == len(bench["files"]) + 1
    assert all(expected[(ROOT / name).as_posix()] == digest for name, digest in bench["files"].items())
    for name in ("SHA256SUMS", "verification.json", "studio-parity.json", "performance.json"):
        file = ROOT / name
        expected[file.as_posix()] = sha(file.read_bytes())
    return evidence, bench


def previews(evidence, pairs, view):
    def show(scale, key):
        items = [(str(ROOT / images[key]), label) for label, images in pairs if images]
        if not items:
            return "<p>Gate không đạt.</p>"
        result = strip(evidence, items, view=view, scale=scale)
        return result.replace('class="triad"', 'class="triad dual"') if len(items) == 2 else result
    return show(1, "native") + details("4× nearest-neighbor", show(4, "zoom"))


def render_refinement(evidence, qa):
    result = qa.get("refinement")
    if not result:
        return ""
    original = next(item["material"] for item in qa["candidates"] if item["id"] == result["candidate"])
    focused, local = result["materialRefinement"], result["local"]
    material = previews(evidence, [("A1 · ban đầu", original), ("A1 · trước edit", focused), ("A1 · sau edit", local)], "refine")
    geometry = strip(evidence, [(str(ROOT / local["edit"]), "Edit mask · 1×")])
    diff = previews(evidence, [("Đổi màu", local["diff"])], "diff")
    daynight = "".join('<h3>' + title + '</h3>' + previews(evidence, [
        ("Trước edit", focused["inScene"][slot]), ("Sau edit", local["inScene"][slot]),
    ], "refinement-" + slot) for slot, title in (("day", "Cảnh Day"), ("night", "Cảnh Night")))
    return f"""<h3>Một lượt tinh chỉnh cục bộ</h3>
<p>Material refinement thay {focused["changed"]} pixel trên mặt kính. Local refinement nâng đường mặt nước {local["changed"]} pixel.
Quan sát ở 1× để quyết định vạch sáng có đáng giữ. Điểm P10 và trung vị của biên kính/vỏ Night giữ nguyên.</p>
{material}
{details("Edit mask và pixel diff", geometry + diff)}
{details("Bối cảnh trước và sau patch", daynight)}
<p>SHA-256 vùng protected khớp trước/sau <code>{local["protectedBefore"]}</code>.</p>"""


def case_section(evidence, case):
    qa = json.loads(evidence.verified(ROOT / case["qa"]))
    candidates = qa["candidates"]
    variants = [item["id"].upper() for item in candidates]
    render = ""
    for key, title in (("material", "Material"), ("day", "Gameplay Day"), ("night", "Gameplay Night"),
                       ("flat", "Flat geometry"), ("silhouette", "Silhouette")):
        pairs = [(name, item.get(key) if key not in ("day", "night") else (item.get("inScene") or {}).get(key))
                 for name, item in zip(variants, candidates)]
        content = previews(evidence, pairs, key)
        render += details(title, content) if key in ("flat", "silhouette") else f'<h3>{title} · 1×</h3>' + content
    ownership = strip(evidence, [(str(ROOT / item["ownership"]), v) for v, item in zip(variants, candidates)])

    def stats(item):
        shape = item["shapeQA"]
        night = (item.get("inScene") or {}).get("qa", {}).get("night", {}).get("contrasts", {})
        return [shape["status"], shape.get("negative", "—"), shape.get("functional", "—"), shape.get("contact", "—"),
                night.get("silhouette", {}).get("p10", "—"), night.get("silhouette", {}).get("weak", "—"),
                night.get("signal", {}).get("housing", {}).get("median", "—"),
                len(item.get("materialQA", shape["stat"])["used"])]

    rows = zip(["Gate kỹ thuật", "Pixel khoảng trống", "Pixel vùng chức năng", "Pixel tiếp đất",
                "Biên/nền Night · P10", "Biên Night dưới 18", "Vùng chức năng/vỏ Night · trung vị", "Số màu"],
               *(stats(item) for item in candidates))
    role = "Development" if case["role"] == "development" else "Fresh holdout đã khóa"
    label = evidence.download(ROOT / case["qa"], "Tải geometry và context QA", case["id"] + "-qa.json")
    return f"""<section id="{esc(case["id"])}"><h2>{esc(case["title"])}</h2>
<p>{role} · seed {case["seed"]} · 32×32. {esc(case["description"])}</p>
<p class="notes">{esc(NOTES[case["id"]])}</p>
{render}
{details("Material ownership", ownership)}
{details("Shape gate và khả năng đọc trong cảnh", table(["Chỉ số", *variants], rows) + label)}
{render_refinement(evidence, qa)}
</section>"""


def form(cases):
    fields = []
    for case in cases:
        variants = [*("A0", "A1", "A2"), *(["Refined"] if case["refinement"] else [])]
        choices = '<option value="">Chưa chọn</option>' + ''.join(f'<option>{v}</option>' for v in [*variants, "Neither"])
        rows = []
        for key, label in CRITERIA.items():
            selects = ''.join(f'<td><select data-score="{v}.{key}" aria-label="{esc(label)} · {v}"><option value="">—</option>'
                              + ''.join(f'<option>{i}</option>' for i in range(1, 6)) + '</select></td>' for v in variants)
            rows.append(f'<tr><th scope="row">{esc(label)}</th>{selects}</tr>')
        header = ''.join(f'<th scope="col">{v}</th>' for v in variants)
        scores = '<div class="scroll"><table><thead><tr><th scope="col">Tiêu chí</th>' + header + '</tr></thead><tbody>'
        scores += ''.join(rows) + '</tbody></table></div>'
        fields.append(f'<fieldset data-case="{esc(case["id"])}"><legend>{esc(case["title"])}</legend>'
                      f'<label>Lựa chọn<select data-choice>{choices}</select></label>'
                      + details("Chấm theo tiêu chí", scores) + '<label>Nhận xét<textarea rows="3"></textarea></label></fieldset>')
    return '<form id="e74-review">' + ''.join(fields) + '<button class="primary" type="submit">Tải phiếu JSON</button></form>'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-sha", required=True)
    source = parser.parse_args().source_sha
    assert re.fullmatch(r"[0-9a-f]{40}", source)
    evidence, bench = load_report_evidence()
    verification = json.loads(evidence.verified(ROOT / "verification.json"))
    performance = json.loads(evidence.verified(ROOT / "performance.json"))
    cases = bench["cases"]
    body = ''.join(case_section(evidence, case) for case in cases)
    perf_rows = []
    for run in performance["runs"]:
        primary = run["primary"]
        repeats = run["deterministicRepeat"]
        counts = primary["calls"]
        perf_rows.append([run["case"], counts["baseline"], counts["flatShape"], counts["material"],
                          counts["materialRefinement"], counts["localRefinement"], counts["scene"], counts["ownership"],
                          str(round(sum(primary["cpuMicroseconds"].values()) / 1000)) + " ms",
                          str(round(sum(repeats["cpuMicroseconds"].values()) / 1000)) + " ms"])
    downloads = ''.join(evidence.download(ROOT / path, label) for path, label in [
        ("SHA256SUMS", "SHA-256"), ("benchmark.json", "Benchmark"), ("verification.json", "Technical QA"),
        ("studio-parity.json", "Studio RGBA"), ("performance.json", "Chi phí render"), ("human-review.json", "Phiếu trống"),
    ])
    body += f"""<section id="human"><h2>Phiếu duyệt mỹ thuật</h2>
<p>Đọc chức năng ở 1× trước khi chọn. Có thể giữ A0 hoặc chọn Neither. Mọi lựa chọn và điểm bắt đầu trống.</p>
{form(cases)}</section>
<section id="qa"><h2>Kỹ thuật và chi phí</h2>
{table(["Kiểm tra", "Trạng thái", "Kết quả"], verification["checks"])}
{table(["Brief", "A0", "Flat", "Material", "Refine material", "Edit local", "Cảnh", "Pass ownership", "CPU lượt đầu", "CPU tái kiểm"], perf_rows)}
<p>Snapshot đo trên {esc(performance["platform"])} · {esc(performance["node"])}. Lượt xác minh lặp cùng số pass.
CPU theo tiến trình cho các lượt render. Evidence {performance["bytes"]:,} byte. DeepSeek 0, API AI 0.</p>
<p>Checkpoint E7.3R <code>{esc(bench["checkpoint"])}</code>. Commit triển khai <code>{source}</code> trên
<code>codex/e7-4-quality-guided-pilot</code>. Working tree sạch ở checkpoint triển khai trước đóng gói.</p>
<p class="downloads">{downloads}</p></section>
<section id="summary"><h2>CHATGPT REVIEW SUMMARY</h2>
<p>Hai brief kiểm ba hình A0/A1/A2 bằng shape gate trước material. Rain Gauge có ống kính và vạch; Beacon holdout có trụ hoặc chân giằng cùng đầu đèn.
Các cấu trúc mới gợi chức năng rõ hơn, biên Night vẫn yếu hơn A0. Rain A1 có một patch ba pixel với vùng bảo vệ khớp SHA-256.
Owner chọn bản đọc tốt ở 1×, gồm cả khả năng giữ A0 hoặc Neither.</p>
<p>QA tái lập các PNG, địa hình và anchors ổn định, Studio giữ RGBA. Pilot chạy offline với hai topology ngoài A0 và một patch duy nhất.
E7.4 hiện là thử nghiệm prop. Character/Environment ở mức đề xuất.</p></section>"""
    assert set(evidence.pictures) == {(ROOT / name).as_posix() for name in bench["files"] if name.endswith(".png")}
    status = "E7_4_PILOT_READY_FOR_HUMAN_ART_REVIEW" if bench["technical"] == "PASS" else "E7_4_PILOT_TECHNICAL_BLOCKED"
    output = page("E7.4 · Quality-Guided Prop Review", status,
                  "So sánh cấu trúc ở 1×, rồi kiểm vật liệu, Day/Night và vùng được chỉnh.", [
                      (cases[0]["id"], "Rain Gauge"), (cases[1]["id"], "Harbor Beacon"),
                      ("human", "Phiếu duyệt"), ("qa", "QA"), ("summary", "Tóm tắt"),
                  ], body, evidence, extra_css=CSS, extra_script=SCRIPT)
    OUT.write_bytes(output.encode("utf-8"))
    print(f"{len(evidence.pictures)} PNG files, {output.count('<img ')} image views, {len(evidence.metadata)} metadata; SHA-256 {sha(OUT.read_bytes())}")


if __name__ == "__main__":
    main()
