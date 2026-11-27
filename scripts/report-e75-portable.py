"""Publish the locked E7.5 character review with original PNG bytes."""
import argparse
import json
import re
from pathlib import Path
from runpy import run_path

shared = run_path("scripts/report-e74r-portable.py")
Evidence, esc, details, page, sha, table, view = (
    shared[key] for key in ("Evidence", "esc", "details", "page", "sha", "table", "view")
)
ROOT = Path("benchmarks/results/e75")
OUT = Path("docs/reports/E7.5-PORTABLE-ART-REVIEW.html")
NOTES = {
    "ridge-mechanic": "A1 giữ hộp thấp và mở khe chân. A2 nâng cờ lê khỏi thân, nhưng thấy ít cán hơn. "
                      "Hộp vẫn có thể đọc như cặp và mũ trùm của A0/A1/A2 mang nét người đi đường.",
    "marsh-harvester": "A1/A2 thêm áo mưa, giữ bản sắc màu nâu và cho thấy dụng cụ dạng móc. "
                       "Móc đôi khi đọc như gậy cong ở 1×. Gấu áo A2 tạo mảng rộng; một holdout chưa đủ để xác nhận tổng quát hóa.",
}
LABELS = {
    "silhouette": "Silhouette", "anatomy": "Giải phẫu và tỷ lệ", "pose": "Dáng và hướng động tác",
    "grip": "Tay nắm công cụ", "legs": "Khoảng hở chân", "footContact": "Chân tiếp đất",
    "material": "Vật liệu", "clusters": "Cụm pixel", "context": "Độ đọc Day/Night",
    "identity": "Nhận diện nhân vật", "generalization": "Khả năng chuyển brief",
}
SCRIPT = shared["SCRIPT"].replace("e74r-review", "e75-review").replace("e74r-human-review", "e75-human-review")


def load():
    expected = {}
    for row in (ROOT / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        digest, name = row.split("  ", 1)
        assert name not in expected
        expected[name] = digest
    evidence = Evidence(expected)
    manifest = json.loads(evidence.verified(ROOT / "benchmark.json"))
    assert len(expected) == len(manifest["files"]) + 1
    assert all(expected[path] == digest for path, digest in manifest["files"].items())
    for name in ("SHA256SUMS", "verification.json", "performance.json", "studio-parity.json"):
        path = ROOT / name
        expected[path.as_posix()] = sha(path.read_bytes())
    return evidence, manifest


def section(evidence, case):
    qa = json.loads(evidence.verified(ROOT / case["qa"]))
    candidates = qa["candidates"]

    def compare(source, key, label):
        return view(evidence, [(item["id"].upper(), item.get(source, {}).get(key)) for item in candidates], label)

    images = ""
    for key, label in [("final", "Material"), ("day", "Gameplay Day"), ("night", "Gameplay Night")]:
        images += f"<h3>{label} · 1×</h3>" + compare("art", key, label)
    for key, label in [("flat", "Flat geometry"), ("silhouette", "Silhouette"), ("parts", "Part ownership"),
                       ("pose", "Pose và landmarks")]:
        paths = [(item["id"].upper(), (item.get("geometry") or item.get("images") or {}).get(key)) for item in candidates]
        images += details(label, view(evidence, paths, key))
    images += details("Material mask và từng công cụ",
                      compare("art", "mask", "material-mask") + "".join(
                          "<h3>" + esc(item["id"].upper() + " · " + tool) + "</h3>" +
                          view(evidence, [(tool, path)], f'{item["id"]}-{tool}')
                          for item in candidates for tool, path in item.get("art", {}).get("toolMasks", {}).items()
                      ))
    images += details("Cận cảnh điểm nắm và chân tiếp đất", "".join(
        f"<h3>{label}</h3>" + compare("art", key, key) for key, label in [
            ("near", "Tay gần"), ("far", "Tay xa"), ("feet", "Hai bàn chân"),
        ]))

    def metrics(item):
        if item["status"] != "PASS":
            return [item["id"].upper(), item.get("reason"), "—", "—", "—", "—", "—", "—"]
        shape = item["shapeQA"]["body"]
        context = item["context"]
        night = context["night"]
        grips = ", ".join(f'{p["kind"]}: {p["overlap"]}/{p["exposed"]} px' for p in item["shapeQA"]["toolGrips"])
        feet = f'{night["feet"]["near"]["visibleSolePixels"]}/{night["feet"]["far"]["visibleSolePixels"]}'
        return [item["id"].upper(), item["status"], shape["legGapRows"], grips or "—", feet,
                context["day"]["edges"]["silhouette"]["p10"], night["edges"]["silhouette"]["p10"],
                night["edges"]["silhouette"]["weak"]]

    numbers = table(["Bản", "Shape gate", "Hàng khe chân", "Grip / tool hiện", "Sole gần/xa",
                     "P10 Day", "P10 Night", "Biên Night yếu"], [metrics(i) for i in candidates])
    links = evidence.download(ROOT / case["qa"], "Tải QA, khóa shape, pose, contact và protected hash", case["id"] + "-qa.json")
    negative = ", ".join(qa["negative"])
    extras = f"<p>Kiểm thử âm tính phát hiện đúng: {esc(negative)}.</p>" if negative else ""
    role = "Holdout đã khóa" if case["role"] == "holdout" else "Development"
    return f"""<section id="{esc(case["id"])}"><h2>{esc(case["name"])}</h2>
<p>{role} · 64×64 · seed {case["seed"]}. {esc(case["brief"])}</p>
<p class="notes">{esc(NOTES[case["id"]])}</p>
<p>A0 dùng rig v3 có sẵn. <code>CAPABILITY_GAP</code> đối với đạo cụ mới và lớp áo mưa dài trong control.
A1/A2 thêm hình học công cụ theo palm và dùng cùng palette của cơ thể.</p>
{images}
{details("Kỹ thuật, điểm nắm và Day/Night", numbers + extras + links)}
<p><code>NO_MEANINGFUL_VISUAL_GAIN</code>. Không chọn patch màu. Tỷ lệ công cụ, gấu áo và sự che giữa bàn tay/cán cần đánh giá hình khối.
SHA-256 protected toàn sprite khớp với chính baseline material của mỗi candidate.</p>
</section>"""


def form(sheet, names):
    panels = []
    choices = '<option value="">Chưa chọn</option>' + "".join(f"<option>{esc(v)}</option>" for v in sheet["options"])
    for case in sheet["cases"]:
        rows = []
        variants = list(case["scores"])
        cols = "".join(f'<th scope="col">{esc(v)}</th>' for v in variants)
        for key in sheet["criteria"]:
            label = LABELS[key]
            choices_score = '<option value="">—</option>' + "".join(f"<option>{i}</option>" for i in range(1, 6))
            cells = "".join(f'<td><select data-score="{v}|{key}" aria-label="{esc(label)} · {v}">{choices_score}</select></td>' for v in variants)
            rows.append(f'<tr><th scope="row">{esc(label)}</th>{cells}</tr>')
        rubric = '<div class="scroll"><table><thead><tr><th scope="col">Tiêu chí</th>' + cols + "</tr></thead><tbody>"
        rubric += "".join(rows) + "</tbody></table></div>"
        panels.append(f'<fieldset data-case="{esc(case["id"])}"><legend>{esc(names[case["id"]])}</legend>'
                      f'<label>Lựa chọn<select data-choice>{choices}</select></label>' +
                      details("Chấm theo tiêu chí", rubric) + '<label>Nhận xét<textarea rows="3"></textarea></label></fieldset>')
    return '<form id="e75-review">' + "".join(panels) + '<button type="submit" class="primary">Tải phiếu JSON</button></form>'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-sha", required=True)
    source = parser.parse_args().source_sha
    assert re.fullmatch("[a-f0-9]{40}", source)
    evidence, manifest = load()
    cases = manifest["cases"]
    checks = json.loads(evidence.verified(ROOT / "verification.json"))["checks"]
    cost = json.loads(evidence.verified(ROOT / "performance.json"))
    sheet = json.loads(evidence.verified(ROOT / "human-review.json"))
    body = "".join(section(evidence, case) for case in cases)
    timing = table(["Brief", "Render cảnh", "Pass ownership", "CPU lượt chính"], [
        (t["id"], t["counters"]["compositionRenders"], t["counters"]["ownershipPasses"],
         f'{sum(t["primaryCpuMicroseconds"].values()) / 1000:.0f} ms')
        for t in cost["timings"]
    ])
    files = "".join(evidence.download(ROOT / name, label) for name, label in [
        ("benchmark.json", "Benchmark"), ("SHA256SUMS", "SHA-256"), ("verification.json", "Technical QA"),
        ("performance.json", "Chi phí"), ("studio-parity.json", "Studio parity"), ("human-review.json", "Phiếu JSON trống"),
    ])
    body += f"""<section id="review"><h2>Phiếu duyệt</h2>
<p>So A0/A1/A2 ở 1× trước. Dùng 4× để kiểm grip, gấu áo, chân và cụm màu. Chọn một bản hoặc Neither.</p>
{form(sheet, {case["id"]: case["name"] for case in cases})}</section>
<section id="qa"><h2>Kỹ thuật và chi phí</h2>{table(["Kiểm tra", "Trạng thái", "Bằng chứng"], checks)}{timing}
<p>Bằng chứng {cost["bytes"]:,} byte. API AI 0. Checkpoint E7.4R <code>{manifest["checkpoint"]}</code>.
Commit triển khai <code>{source}</code> tại nhánh <code>codex/e7-5-character-quality-pilot</code>.</p>
<p class="downloads">{files}</p></section>
<section id="summary"><h2>CHATGPT REVIEW SUMMARY</h2>
<p>Ridge A1 giữ khoảng hở chân rộng, A2 nâng cờ lê và che thêm cán. Marsh giữ áo nâu, thêm áo mưa và móc.
Móc có thể đọc như gậy cong ở 1×. Kiểm dáng, tay, chân và nhận diện nghề trước khi chọn A0/A1/A2 hoặc Neither.</p>
<p>Owner duyệt static trước Animation Gate. E7.6 Environment ở mức đề xuất.</p></section>"""
    expected = {path for path in manifest["files"] if path.endswith(".png")}
    assert set(evidence.pictures) == expected
    status = "E7_5_READY_FOR_HUMAN_CHARACTER_REVIEW" if manifest["technical"] == "PASS" else "E7_5_TECHNICAL_BLOCKED"
    output = page("E7.5 · Character Quality Review", status, "Cùng brief, scale và cảnh. Xem dáng, bàn tay, dụng cụ và chân tại 1×.",
                  [(c["id"], c["name"]) for c in cases] + [("review", "Phiếu"), ("qa", "QA"), ("summary", "Tóm tắt")],
                  body, evidence, extra_css=shared["CSS"], extra_script=SCRIPT)
    OUT.write_bytes(output.encode("utf-8"))
    print(f"{len(evidence.pictures)} PNG, {output.count('<img ')} image views, {len(evidence.metadata)} metadata; SHA-256 {sha(OUT.read_bytes())}")


if __name__ == "__main__":
    main()
