"""Assemble one offline E7.5R review from the frozen new and historical PNG sets."""
import argparse
import json
import re
from pathlib import Path
from runpy import run_path

shared = run_path("scripts/report-e74r-portable.py")
Evidence, esc, details, page, sha, table, view = (
    shared[key] for key in ("Evidence", "esc", "details", "page", "sha", "table", "view")
)
ROOT = Path("benchmarks/results/e75r")
OUT = Path("docs/reports/E7.5R-PORTABLE-ART-REVIEW.html")
ORDER = ["a0", "matched", "a1", "a2", "refined"]
LABELS = {"a0": "A0 lịch sử", "matched": "A0-Matched", "a1": "E7.5 A1",
          "a2": "E7.5 A2", "refined": "E7.5R", "neither": "Neither"}
CRITERIA = dict(zip(
    ["identity", "silhouette", "anatomy", "pose", "tool", "grip", "balance", "legs", "feet", "materials", "context", "generalization"],
    ["Nhận diện nghề", "Silhouette", "Giải phẫu", "Pose", "Nhận diện tool", "Cách nắm",
     "Thăng bằng", "Khe chân", "Tiếp đất", "Vật liệu và cụm pixel", "Độ đọc Day/Night", "Chuyển brief"],
))
NOTES = {
    "ridge-mechanic": "Cả matched và refine dùng mũ, găng, túi làm việc và cùng dụng cụ. Refine để lộ 51 pixel cờ lê so với 43, "
                      "có chín hàng khe chân so với sáu. Night P10 giữ 26 và biên yếu tăng từ ba lên năm. Hộp vẫn có thể đọc như cặp ở 1×.",
    "marsh-harvester": "Cả hai bản mới dùng gấu cape chia thùy và đầu móc mở. Refine để lộ 65 pixel móc so với 48. "
                       "Night P10 giữ 18. Móc vẫn có thể đọc như gậy cong và pose tĩnh chưa diễn đạt động tác thu hoạch.",
    "canal-porter": "Mũ vành rộng, cán dùng chung cho hai tay và kiện hàng treo lệch tạo silhouette khác nhóm hooded worker. "
                    "Hai điểm nắm đạt giao mask 12/13 px. Tay xa dễ chìm vào thanh đòn ở 1×. "
                    "Cảnh Tidegate dùng nguyên làm bối cảnh thử; tải động và rig độc lập còn ngoài phạm vi.",
}
CSS = shared["CSS"] + """
.triad.quint{grid-template-columns:repeat(5,minmax(0,1fr))}
.triad.quint figcaption{overflow-wrap:anywhere;line-height:1.3;min-height:2.7em}
@media(max-width:550px){.triad.quint{gap:3px}.triad.quint figcaption{font-size:.76rem}}
"""
SCRIPT = (shared["SCRIPT"].replace("e74r-review", "e75r-review").replace("e74r-human-review", "e75r-human-review")
          .replace("selected:section", "chosen:section"))


def load():
    expected = {}
    for row in (ROOT / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        digest, name = row.split("  ", 1)
        assert name not in expected
        expected[name] = digest
    evidence = Evidence(expected)
    bench = json.loads(evidence.verified(ROOT / "benchmark.json"))
    pin = {**bench["files"], **bench["reused"]}
    assert len(expected) == len(pin) + 1
    assert all(expected[name] == digest for name, digest in pin.items())
    for name in ("SHA256SUMS", "verification.json", "performance.json", "studio-parity.json"):
        file = ROOT / name
        expected[file.as_posix()] = sha(file.read_bytes())
    return evidence, bench, pin


def gallery(evidence, entries, key):
    content = view(evidence, entries, key)
    if len(entries) == 5:
        return content.replace('class="triad"', 'class="triad quint"')
    return content


def section(evidence, case):
    qa = json.loads(evidence.verified(ROOT / case["qa"]))
    rows = sorted(qa["candidates"], key=lambda item: ORDER.index(item["id"]))
    art = ""
    for key, name in [("material", "Material"), ("day", "Gameplay Day"), ("night", "Gameplay Night"),
                      ("flat", "Flat geometry"), ("silhouette", "Silhouette"), ("parts", "Part masks"),
                      ("pose", "Pose và landmarks"), ("near", "Tay gần"), ("far", "Tay xa"),
                      ("feet", "Chân và đế"), ("mask", "Material ownership")]:
        images = [(LABELS[row["id"]], row["views"][key]) for row in rows if key in row["views"]]
        compare = gallery(evidence, images, key)
        art += f'<h3>{name} · 1×</h3>' + compare if key in ("material", "day", "night") else details(name, compare)
    stats = []
    for row in rows:
        data = row["qa"]
        if row["status"] == "TECHNICAL_BLOCKED":
            stats.append((LABELS[row["id"]], data.get("failure"), "—", "—", "—"))
            continue
        historic = row["status"] == "HISTORICAL"
        shape = data["shape"]["body"] if historic else data["pose"]
        grip = data["shape"]["toolGrips"] if historic else data["grip"]["anchors"]
        scene = data["context"]["night"]["edges"]["silhouette"]
        pretty = ", ".join(f'{g["kind"]} ({g["hand"]}) {g["overlap"]}/{g["exposed"]}' for g in grip)
        stats.append((LABELS[row["id"]], shape["legGapRows"], pretty or "—", scene["p10"], scene["weak"]))
    measure = table(["Bản", "Hàng khe chân", "Grip overlap / pixel tool thấy", "Night P10", "Biên Night yếu"], stats)
    diffs = ""
    for key, diff in qa["diffs"].items():
        title = "So với E7.5 đã chọn" if key == "from-selected" else "So với A0-Matched"
        diffs += f'<h3>{title}</h3><p>{diff["added"]} pixel thêm, {diff["removed"]} bỏ, {diff["sharedRgb"]} đổi RGB.'
        diffs += f' SHA-256 của {diff["unchanged"]} pixel giữ nguyên khớp trước/sau.</p>'
        diffs += gallery(evidence, [("Diff", diff["pixels"]), ("Vùng khác biệt", diff["mask"])], key)
    if diffs:
        art += details("Before/after · diff và mask", "<p>Xanh lá thêm, hồng bỏ, vàng đổi màu. Before và after nằm trong hàng Material.</p>" + diffs)
    path = evidence.download(ROOT / case["qa"], "Tải QA, landmarks và hashes", case["id"] + "-qa.json")
    tag = "Holdout khóa trước" if case["role"] == "holdout" else "Development"
    return f"""<section id="{esc(case["id"])}"><h2>{esc(case["name"])}</h2>
<p>{tag} · 64×64 · seed {case["seed"]} · <code>{esc(qa["comparison"])}</code></p>
<p class="notes">{esc(NOTES[case["id"]])}</p>{art}
{details("Technical grip, chân và bối cảnh Night", measure + path)}
<p>Grip kỹ thuật kiểm giao hình và thứ tự lớp. Người duyệt quyết định tư thế nắm có thuyết phục ở 1×.
<code>NO_MEANINGFUL_VISUAL_GAIN</code> cho patch RGB sau shape lock. Không áp patch màu.</p></section>"""


def form(sheet, names):
    panels = []
    for case in sheet["cases"]:
        options = '<option value="">Chưa chọn</option>' + "".join(
            f'<option value="{v}">{esc(LABELS[v])}</option>' for v in case["options"])
        variants = list(case["scores"])
        cols = "".join(f'<th scope="col">{esc(LABELS[v])}</th>' for v in variants)
        rows = []
        for key in sheet["criteria"]:
            label = CRITERIA[key]
            points = '<option value="">—</option>' + "".join(f"<option>{i}</option>" for i in range(1, 6))
            cells = "".join(f'<td><select data-score="{v}|{key}" aria-label="{esc(label)} · {esc(LABELS[v])}">{points}</select></td>' for v in variants)
            rows.append(f'<tr><th scope="row">{esc(label)}</th>{cells}</tr>')
        rubric = '<div class="scroll"><table><thead><tr><th scope="col">Tiêu chí</th>' + cols + "</tr></thead><tbody>"
        rubric += "".join(rows) + "</tbody></table></div>"
        panels.append(f'<fieldset data-case="{esc(case["id"])}"><legend>{esc(names[case["id"]])}</legend>'
                      f'<label>Lựa chọn<select data-choice>{options}</select></label>' +
                      details("Chấm theo tiêu chí", rubric) + '<label>Nhận xét<textarea rows="3"></textarea></label></fieldset>')
    return '<form id="e75r-review">' + "".join(panels) + '<button class="primary" type="submit">Tải phiếu JSON</button></form>'


def main():
    arg = argparse.ArgumentParser(description=__doc__)
    arg.add_argument("--source-sha", required=True)
    source = arg.parse_args().source_sha
    assert re.fullmatch(r"[a-f0-9]{40}", source)
    evidence, bench, pins = load()
    qa = json.loads(evidence.verified(ROOT / "verification.json"))
    cost = json.loads(evidence.verified(ROOT / "performance.json"))
    sheet = json.loads(evidence.verified(ROOT / "human-review.json"))
    cases = bench["cases"]
    body = "".join(section(evidence, c) for c in cases)
    timing = table(["Brief", "Body build", "Render cảnh", "CPU lượt chính"], [
        (c["id"], c["bodyBuilds"], c["gameplayRenders"], f'{sum(c["primaryCpuMicroseconds"].values()) / 1000:.0f} ms') for c in cost["runs"]
    ])
    links = "".join(evidence.download(ROOT / file, label) for file, label in [
        ("benchmark.json", "Benchmark"), ("SHA256SUMS", "SHA-256"), ("verification.json", "Technical QA"),
        ("performance.json", "Chi phí"), ("studio-parity.json", "Studio parity"), ("human-review.json", "Phiếu JSON trống"),
    ])
    body += f"""<section id="review"><h2>Phiếu duyệt</h2>
<p>So A0-Matched với E7.5R để đọc hiệu ứng pose. So A0 lịch sử để thấy thay đổi khả năng của pipeline.
Chọn một bản hoặc Neither. Điểm bắt đầu trống.</p>{form(sheet, {c["id"]: c["name"] for c in cases})}</section>
<section id="qa"><h2>Technical QA và chi phí</h2>{table(["Kiểm tra", "Trạng thái", "Bằng chứng"], qa["checks"])}{timing}
<p>{cost["bytes"]:,} byte bằng chứng mới, 0 lượt gọi AI. Checkpoint <code>{bench["checkpoint"]}</code>.
Commit triển khai <code>{source}</code> trên <code>codex/e7-5r-character-identity-grip</code>.</p>
<p class="downloads">{links}</p></section>
<section id="summary"><h2>CHATGPT REVIEW SUMMARY</h2>
<p>Ridge và Marsh có đối chứng cùng năng lực, khác pose và trục dụng cụ. Bản refine lộ dụng cụ và khe chân nhiều hơn.
Một số dấu hiệu nghề rõ thêm ở 1×, grip và nghề vẫn chờ đánh giá. Holdout Canal Porter xác minh hai grip trên cùng một thanh đòn
ở hình tĩnh, tay xa còn nhập vào cán. Kết quả chưa đủ kết luận chất lượng chung hoặc tổng quát hóa khác rig.
Animation vẫn chờ duyệt static, E7.6 ở bước đề xuất.</p></section>"""
    assert set(evidence.pictures) == {path for path in pins if path.endswith(".png")}
    status = "E7_5R_READY_FOR_FINAL_HUMAN_CHARACTER_REVIEW" if bench["technical"] == "PASS" else "E7_5R_TECHNICAL_BLOCKED"
    output = page("E7.5R · Character Identity and Grip", status,
                  "So silhouette, bàn tay và khả năng đọc nghề tại 1×. Dùng A0-Matched để đối chiếu dáng.",
                  [(c["id"], c["name"]) for c in cases] + [("review", "Phiếu"), ("qa", "QA"), ("summary", "Tóm tắt")],
                  body, evidence, extra_css=CSS, extra_script=SCRIPT)
    OUT.write_bytes(output.encode("utf-8"))
    print(f"{len(evidence.pictures)} PNG, {output.count('<img ')} image views, {len(evidence.metadata)} metadata; SHA-256 {sha(OUT.read_bytes())}")


if __name__ == "__main__":
    main()
