"""Package the locked E7.4R semantic, context and review evidence."""
import argparse
import json
import re
from pathlib import Path
from runpy import run_path

common = run_path("scripts/report-e73r-portable.py")
Evidence, esc, details, page, sha, strip, table = (
    common[name] for name in ("Evidence", "esc", "details", "page", "sha", "strip", "table")
)
ROOT = Path("benchmarks/results/e74r")
OUTPUT = Path("docs/reports/E7.4R-PORTABLE-ART-REVIEW.html")
CSS = common["CSS"] + """
.triad.single{grid-template-columns:minmax(0,1fr)}
.triad.dual{grid-template-columns:repeat(2,minmax(0,1fr))}
p code{overflow-wrap:anywhere}
"""
SCRIPT = """
for(const row of document.querySelectorAll('[data-sync]')){
  const panes=[...row.querySelectorAll('.crop')];
  for(const pane of panes) pane.addEventListener('scroll',()=>{
    for(const other of panes){
      if(other.scrollLeft!==pane.scrollLeft) other.scrollLeft=pane.scrollLeft;
      if(other.scrollTop!==pane.scrollTop) other.scrollTop=pane.scrollTop;
    }
  },{passive:true});
}
const form=document.getElementById('e74r-review');
form.addEventListener('submit',event=>{
  event.preventDefault();
  const cases=[...form.querySelectorAll('fieldset')].map(section=>{
    const scores={};
    for(const input of section.querySelectorAll('[data-score]')){
      const [variant,key]=input.dataset.score.split('|');
      scores[variant]??={};
      scores[variant][key]=input.value?Number(input.value):null;
    }
    return {id:section.dataset.case,selected:section.querySelector('[data-choice]').value||null,scores,
      notes:section.querySelector('textarea').value};
  });
  const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,status:'HUMAN_REVIEW_DRAFT',cases},null,2)+'\\n'],
    {type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;
  link.download='e74r-human-review.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
"""
NOTES = {
    "field-rain-gauge": (
        "Miệng elip nhìn rõ hơn mái hộp E7.4. Ba cụm vạch và ống tối giúp nhận ra vùng đo. "
        "Ở Night, P10 biên tổng tăng từ 15 lên 33, dưới chân vẫn 15. Bản 1× cần duyệt mức độ phân biệt với dụng cụ đo chung."
    ),
    "harbor-signal-beacon": (
        "Cần gạt nhô khỏi thân và có thể theo dõi từ đầu kim loại tới khớp. "
        "Ở 1× tay gạt vẫn có thể đọc như móc gắn. P10 Night giữ 14; A0 đạt 24."
    ),
    "cliffside-wind-vane": (
        "Mũi chỉ hướng và đuôi phân biệt rõ. Tại 1× gối xoay nhỏ nên có thể nhầm với bảng chỉ đường. "
        "CAPABILITY_GAP cho cơ cấu quay và môi trường mép vực chuyên dụng. Bản đặt thử vào đường Tidegate đã khóa."
    ),
}
LABELS = {
    "function": "Nhận diện chức năng", "silhouette": "Silhouette", "material": "Phân biệt vật liệu",
    "clusters": "Cụm pixel", "dayNight": "Khả năng đọc Day/Night", "localGain": "Giá trị patch",
}
VIEWS = [
    ("material", "Material"), ("day", "Gameplay Day"), ("night", "Gameplay Night"),
    ("flat", "Flat geometry"), ("silhouette", "Silhouette"), ("landmarks", "Semantic landmarks"),
]


def load():
    expected = {}
    for row in (ROOT / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        h, name = row.split("  ", 1)
        assert name not in expected
        expected[name] = h
    evidence = Evidence(expected)
    manifest = json.loads(evidence.verified(ROOT / "benchmark.json"))
    combined = {**manifest["files"], **manifest["reused"]}
    assert len(expected) == len(combined) + 1
    assert all(expected[name] == digest for name, digest in combined.items())
    for name in ("SHA256SUMS", "verification.json", "performance.json", "studio-parity.json", "dark-material.json"):
        path = ROOT / name
        expected[path.as_posix()] = sha(path.read_bytes())
    return evidence, manifest


def view(evidence, entries, key=None, scaling=True):
    def render(scale, field):
        paths = [(item if isinstance(item, str) else item[field], label) for label, item in entries if item]
        if not paths:
            return "<p>Shape Gate chưa đạt.</p>"
        markup = strip(evidence, paths, view=key, scale=scale)
        if len(paths) < 3:
            markup = markup.replace('class="triad"', 'class="triad ' + ("single" if len(paths) == 1 else "dual") + '"')
        return markup
    return render(1, "native") + (details("4× nearest-neighbor", render(4, "zoom")) if scaling else "")


def cases_body(evidence, case, dark):
    qa = json.loads(evidence.verified(ROOT / case["qa"]))
    old = qa["previous"] or []
    variants = [(("A0 baseline" if item["id"] == "a0" else "E7.4 " + item["id"].upper()), item["files"]) for item in old]
    variants.append(("E7.4R", qa["geometry"]))
    art = ""
    for key, label in VIEWS:
        compare = view(evidence, [(name, files.get(key)) for name, files in variants], key)
        art += f"<h3>{label} · 1×</h3>" + compare if key in ("material", "day", "night") else details(label, compare)
    art += details("Material ownership", view(evidence, [(name, files.get("ownership")) for name, files in variants], scaling=False))
    shape = qa["shapeQA"]
    marks = table(["Mốc", "Pixel", "Cụm kết nối"], [
        (key, mark["pixels"], ", ".join(str(x) for x in mark["clusters"])) for key, mark in shape["landmarks"].items()
    ])
    context = qa.get("context")
    patch = qa.get("patch")
    if context:
        def contrast(stats):
            day, night = (stats[light]["contrasts"] for light in ("day", "night"))
            return [day["silhouette"]["p10"], night["silhouette"]["p10"], night["silhouette"]["weak"],
                    night["contact"]["p10"], night["silhouette"]["median"]]
        rows = [(("A0 baseline" if i["id"] == "a0" else "E7.4"), *contrast(i["context"])) for i in old]
        rows.append(("E7.4R", *contrast(context)))
        if patch["files"]:
            paired = {"day": context["day"], "night": patch["after"]}
            rows.append(("E7.4R · patch Night", *contrast(paired)))
        darkness = table(["Bản", "Day · số mẫu", "Day · trung vị", "Night · số mẫu", "Night · trung vị"], [
            (v["id"].upper(), *[m for light in ("day", "night") for m in
              (v[light]["materialToMaterial"]["samples"], v[light]["materialToMaterial"]["median"] if v[light]["materialToMaterial"]["median"] is not None else "—")])
            for v in dark["variants"]
        ])
        measures = table(["Bản", "P10 Day", "P10 Night", "Biên Night yếu", "P10 chân Night", "Trung vị Night"], rows)
        art += details("QA, semantic landmarks và vật liệu tối",
                       measures + marks + "<p>Mẫu vùng tối với vật liệu liền kề trong cảnh thật.</p>" + darkness)
    if patch:
        proof = patch["protectedAfter"]
        if patch["files"]:
            files = patch["files"]
            art += f"""<h3>Local refinement · {esc(patch["defectId"])}</h3>
<p>Mép mái ở x18–23, y4. {patch["changed"]}/{patch["budget"]} pixel đổi. Các mẫu biên yếu giảm 39 xuống 33, P10 giữ 14.
Khác biệt nhỏ khi nhìn trong gameplay 1×. Khuyến nghị <code>NO_MEANINGFUL_VISUAL_GAIN</code>, phiếu Owner giữ hai lựa chọn.</p>
{view(evidence, [("Trước", qa["geometry"]["material"]), ("Sau", files["native"])], "patch-native")}
{view(evidence, [("Night trước", qa["geometry"]["night"]), ("Night sau", files["night"])], "patch-night")}
{details("Vị trí và pixel diff", view(evidence, [("Target mask", files["mask"])], scaling=False) +
         view(evidence, [("Pixel diff", files["diff"])], "diff"))}
<p>Protected {patch["protectedPixels"]} pixel, SHA-256 trước/sau <code>{proof}</code>. Alpha, landmarks và cảnh ngoài mask khớp.</p>"""
        else:
            art += """<p><code>NO_MEANINGFUL_VISUAL_GAIN</code>. Không có cụm viền liền đủ điều kiện cho patch Night. Bản native phía trên được giữ.</p>"""
    link = evidence.download(ROOT / case["qa"], "Tải QA, landmarks và protected hash", case["id"] + "-qa.json")
    role = "Holdout khóa trước" if case["role"] == "holdout" else "Development"
    return f"""<section id="{esc(case["id"])}"><h2>{esc(case["name"])}</h2>
<p>{role} · 32×32 · seed {case["seed"]}. {esc(case["brief"])}</p><p class="notes">{esc(NOTES[case["id"]])}</p>
{art}<p>{link}</p></section>"""


def review(sheet, names):
    panels = []
    for case in sheet["cases"]:
        options = '<option value="">Chưa chọn</option>' + "".join(f"<option>{esc(v)}</option>" for v in case["options"])
        columns = list(case["scores"])
        header = "".join(f'<th scope="col">{esc(v)}</th>' for v in columns)
        rows = []
        for key in sheet["criteria"]:
            caption = LABELS[key]
            selects = "".join(f'<td><select data-score="{esc(v)}|{key}" aria-label="{esc(v)} · {esc(caption)}">'
                              '<option value="">—</option>' + "".join(f"<option>{i}</option>" for i in range(1, 6)) +
                              "</select></td>" for v in columns)
            rows.append(f'<tr><th scope="row">{esc(caption)}</th>{selects}</tr>')
        scores = '<div class="scroll"><table><thead><tr><th scope="col">Tiêu chí</th>' + header + "</tr></thead><tbody>"
        scores += "".join(rows) + "</tbody></table></div>"
        panels.append(f'<fieldset data-case="{esc(case["id"])}"><legend>{esc(names[case["id"]])}</legend>'
                      f'<label>Lựa chọn<select data-choice>{options}</select></label>' +
                      details("Chấm tiêu chí", scores) + '<label>Nhận xét<textarea rows="3"></textarea></label></fieldset>')
    return '<form id="e74r-review">' + "".join(panels) + '<button class="primary" type="submit">Tải phiếu JSON</button></form>'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-sha", required=True)
    source = parser.parse_args().source_sha
    assert re.fullmatch(r"[a-f0-9]{40}", source)
    evidence, manifest = load()
    files = {**manifest["files"], **manifest["reused"]}
    dark = {c["id"]: c for c in json.loads(evidence.verified(ROOT / "dark-material.json"))["cases"]}
    checks = json.loads(evidence.verified(ROOT / "verification.json"))["checks"]
    cost = json.loads(evidence.verified(ROOT / "performance.json"))
    sheet = json.loads(evidence.verified(ROOT / "human-review.json"))
    cases = manifest["cases"]
    body = "".join(cases_body(evidence, case, dark[case["id"]]) for case in cases)
    costs = table(["Case", "Structure", "Material", "Patch dùng/thử", "Render cảnh", "Ownership", "CPU lượt chính"], [
        (item["id"], n["structure"], n["material"], f'{n["effectivePatches"]}/{n["attemptedPatches"]}',
         n["scene"], n["ownership"], f'{sum(item["primary"]["cpuMicroseconds"].values()) / 1000:.0f} ms')
        for item in cost["runs"] for n in [item["primary"]["count"]]
    ])
    downloads = "".join(evidence.download(ROOT / file, label) for file, label in [
        ("benchmark.json", "Benchmark"), ("SHA256SUMS", "SHA-256 manifest"), ("verification.json", "Technical QA"),
        ("dark-material.json", "Vật liệu tối"), ("performance.json", "Chi phí"), ("studio-parity.json", "Studio parity"),
        ("human-review.json", "Phiếu JSON trống"),
    ])
    body += f"""<section id="review"><h2>Phiếu duyệt</h2>
<p>So chức năng ở 1×, sau đó xem cụm pixel và vật liệu ở 4×. Điểm và lựa chọn bắt đầu trống.</p>
{review(sheet, {c["id"]: c["name"] for c in cases})}</section>
<section id="qa"><h2>Kỹ thuật và chi phí</h2>
{table(["Kiểm tra", "Trạng thái", "Bằng chứng"], checks)}{costs}
<p>{cost["bytes"]:,} byte evidence mới qua benchmark. Lượt xác minh lặp cùng các bước. API AI 0.</p>
<p>Checkpoint E7.4 <code>{esc(manifest["checkpoint"])}</code>. Triển khai <code>{source}</code>
trên <code>codex/e7-4r-semantic-context-quality</code>. Working tree sạch ở checkpoint đóng gói.</p>
<p class="downloads">{downloads}</p></section>
<section id="summary"><h2>CHATGPT REVIEW SUMMARY</h2>
<p>Rain có miệng hứng, ống và ba cụm vạch. Beacon có đầu đèn và tay gạt riêng. Xem Night 1× trước khi cân nhắc patch Beacon:
sáu pixel giảm mẫu biên yếu, chức năng trong cảnh thay đổi rất ít. Wind Vane có mũi, đuôi và đế. Gối xoay khó đọc tại 1×,
vì vậy dễ nhầm với bảng chỉ đường. Chọn baseline, E7.4 hoặc E7.4R theo từng case. Duyệt patch riêng và giữ Neither khi cần.</p></section>"""
    assert set(evidence.pictures) == {name for name in files if name.endswith(".png")}
    state = "E7_4R_READY_FOR_FINAL_HUMAN_ART_REVIEW" if manifest["technical"] == "PASS" else "E7_4R_TECHNICAL_BLOCKED"
    output = page("E7.4R · Semantic Structure Review", state,
                  "Trước và sau về cấu trúc, vật liệu, cảnh Day/Night và chỉnh cục bộ trong một báo cáo.",
                  [(case["id"], short) for case, short in zip(cases, ["Rain Gauge", "Harbor Beacon", "Wind Vane"])] +
                  [("review", "Phiếu duyệt"), ("qa", "QA"), ("summary", "Tóm tắt")],
                  body, evidence, extra_css=CSS, extra_script=SCRIPT)
    OUTPUT.write_bytes(output.encode("utf-8"))
    print(f"{len(evidence.pictures)} PNG files, {output.count('<img ')} image views, {len(evidence.metadata)} metadata; SHA-256 {sha(OUTPUT.read_bytes())}")


if __name__ == "__main__":
    main()
