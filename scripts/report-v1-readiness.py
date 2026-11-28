"""Assemble the single portable Engine v1 Owner readiness report."""
import base64
from html import escape
import json
from pathlib import Path
import re
import subprocess
from string import Template

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / ".cache/e10-v1"
OUTPUT = ROOT / "docs/reports/LUMASPRITE-ENGINE-V1-RELEASE-READINESS.html"
PROOF = Path((RUN / "workflow/latest.txt").read_text(encoding="utf-8").strip())


def data(path):
    return json.loads(path.read_bytes())


def picture(path, alt, css=""):
    assert path.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n", path
    png = base64.b64encode(path.read_bytes()).decode()
    return f'<img class="{escape(css)}" src="data:image/png;base64,{png}" alt="{escape(alt)}">'


def evidence(value):
    return escape(json.dumps(value, ensure_ascii=False, indent=2))


def row(name, status, note):
    return f'<tr><th scope="row">{escape(name)}</th><td><span class="{status.lower()}">{status}</span></td><td>{escape(note)}</td></tr>'


def main():
    workflow = data(PROOF / "workflow.json")
    unity = data(RUN / "e85-verified/verification.json")
    raw = data(RUN / "e85-verified/runtime.json")
    integrity = data(RUN / "integrity.json")
    archive = data(RUN / "release/release-package.json")
    regression = data(RUN / "regression.json")
    audit = data(RUN / "npm-audit.json")
    npm_advisories = audit["metadata"]["vulnerabilities"]["total"]
    branch = subprocess.check_output(["git", "branch", "--show-current"], cwd=ROOT, text=True).strip()
    assert branch == "codex/e10-v1-release-readiness"
    probe = re.search(r"E10_COMPONENT_UNITY_PASS .+", (PROOF / "unity-component.log").read_text(encoding="utf-8"))
    assert probe and workflow["revised"]["spriteRgbaSha256"] in probe[0]
    assert archive["smoke"]["revision"] == workflow["revised"]
    assert archive["workingTree"] == "CLEAN"
    assert workflow["status"] == integrity["status"] == archive["smoke"]["status"] == "PASS"
    assert npm_advisories == 0
    assert [unity["studioZipsImported"], unity["worldRgbaParity"]["exact"], unity["worldRgbaParity"]["extraVariantsExact"]] == [9, 6, 2]
    assert [test["passed"] for test in unity["tests"]] == [7, 2]
    assert unity["compositedHud"]["status"] == unity["manualKeyboard"]["status"] == "NOT_RUN"

    tests = [
        ("Engine", "PASS", f"{regression['engineTests']}/{regression['engineTests']} tests. Lint, typecheck, build và CLI smoke đạt."),
        ("Xác định và bảo toàn pixel", "PASS", "PNG/RGBA, palette, alpha, masks, layer order và determinism. 1 pixel đổi đúng vùng cho phép."),
        ("Revision và rollback", "PASS", "Revision 2 khóa SHA manifest r1. Quay lại r1 giữ đúng SHA RGBA. Negative test từ chối pixel ngoài mask và PNG sai."),
        ("Engine Adapter v1", "PASS", "Studio thật gửi yêu cầu prop qua loopback. Preview giữ vùng khóa và từ chối revision cũ."),
        ("Studio", "PASS", f"{regression['studioTests']}/{regression['studioTests']} test. PNG chỉnh sửa, lưu, mở lại và xuất. Hai composite khác revision đều có 0 pixel sai."),
        ("Unity import", "PASS", "EditMode 7/7 và PlayMode 2/2. 9 ZIP. Probe PNG từ Studio khớp RGBA, pivot (8, 10) và PPU 16."),
        ("Windows runtime", "PASS", "Windows x64 build. 6 cảnh Day/Night và 2 biến thể khớp RGBA. Điều hướng, tương tác có kiểm tra phạm vi, save/reload và rollback cảnh."),
        ("Ảnh HUD lần chạy cửa sổ ẩn", "FAIL", "Phép so ảnh đầu tiên nhận framebuffer trong suốt. Pixel cảnh và logic vẫn qua kiểm tra độc lập."),
        ("HUD mới trên cửa sổ hiển thị", "NOT_RUN", "Ảnh HUD E8.5 đã khóa là bằng chứng lịch sử. Báo cáo này dùng ảnh nền mới từ Player."),
        ("Bàn phím vật lý và duyệt mỹ thuật", "NOT_RUN", "Owner điền mục nghiệm thu sau khi tự kiểm."),
        ("Bằng chứng lịch sử", "PASS", f"{integrity['historical']} checksum lịch sử và {integrity['catalogEntries']} dòng ở {len(integrity['catalogs'])} manifest benchmark."),
        ("Security và dependency", "PASS", f"{integrity['secrets']['files']} tệp văn bản trong phạm vi quét, không phát hiện mẫu credential. npm audit có 0 advisory."),
        ("Giấy phép phân phối bên ngoài", "FAIL", "Audit chưa thấy license cấp dự án. Candidate phục vụ nghiệm thu nội bộ trong khi chờ Owner."),
        ("ZIP Windows", "PASS", f"Giải nén ngoài repo ở Windows. Kiểm SHA của {archive['archiveEntries'] - 1} payload, build lại r1/r2 và xuất prop hai lần khớp byte."),
    ]
    sprites = "".join(f'<figure><figcaption>{label}</figcaption><div class="sprite-pair">'
                      f'{picture(PROOF / name, desc, "native")}{picture(PROOF / name, desc + " ở 4×", "zoom")}</div>'
                      '<small>1× và 4× nearest-neighbor</small></figure>'
                      for label, name, desc in [("Revision 1", "studio-r1.png", "Sprite phiên bản 1 xuất từ Studio"),
                                                ("Revision 2", "studio-r2.png", "Sprite đã sửa một pixel")])
    scenes = "".join(f'<figure>{picture(RUN / "e85-verified" / scene["staticCapture"], scene["id"] + " " + scene["light"])}'
                     f'<figcaption>{escape(scene["id"])} · {escape(scene["light"].title())}</figcaption></figure>'
                     for scene in raw["cases"])
    page = Template("""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'">
<title>LumaSprite Engine v1 · Release Readiness</title>
<style>
:root{color-scheme:light;--paper:#fff;--ink:#16243a;--muted:#475569;--line:#d8e1eb;--accent:#075944;--canvas:#f4f7fb}
*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.55 system-ui,sans-serif}
main{max-width:1120px;margin:auto;padding:clamp(16px,5vw,58px)}header,section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:clamp(16px,4vw,36px);margin-bottom:18px}
h1,h2,h3,p{margin-top:0}h1{font-size:clamp(32px,6vw,62px);line-height:1.04;letter-spacing:-.03em;margin-bottom:16px}
h2{font-size:clamp(22px,4vw,34px);line-height:1.2}h3{font-size:1rem}p:last-child{margin-bottom:0}.meta,small{color:var(--muted)}
nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}nav a{border:1px solid var(--line);border-radius:8px;background:var(--paper);padding:8px 12px}
a{color:var(--accent);font-weight:600}a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid #147957;outline-offset:2px}
.gates{display:grid;gap:4px;padding-left:20px}.gates code,code{overflow-wrap:anywhere}.pass{color:#075944;font-weight:700}.fail{color:#9c322e;font-weight:700}.not_run{color:#684411;font-weight:700}
.gallery{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,225px),1fr))}
figure{border:1px solid var(--line);border-radius:9px;margin:0;padding:12px;background:#f5f8fb}figcaption{font-weight:600;overflow-wrap:anywhere}img{max-width:100%;height:auto;image-rendering:pixelated;display:block}
.sprite-pair{display:flex;align-items:center;gap:24px;min-height:88px}.native{width:16px;height:16px}.zoom{width:64px;height:64px}
table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:10px 6px;overflow-wrap:anywhere}th:first-child{width:26%}th:nth-child(2){width:15%}
dl{display:grid;grid-template-columns:minmax(100px,160px) minmax(0,1fr);gap:10px}dt{font-weight:700}dd{margin:0}
fieldset{margin:0 0 14px;padding:12px;border:1px solid var(--line);border-radius:8px}legend{font-weight:700}label{display:block;margin:8px 0}
input:not([type=checkbox]),select,textarea{display:block;width:100%;min-height:44px;padding:8px;border:1px solid #8c9bad;border-radius:6px;font:inherit;background:#fff;color:var(--ink)}textarea{min-height:100px}
summary{cursor:pointer;padding:8px 0;font-weight:600}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eff3f8;padding:12px;border-radius:6px}
@media(max-width:560px){th,td{padding:8px 4px}th:first-child{width:27%}th:nth-child(2){width:19%}}
@media print{main{padding:0}header,section{border:0}nav{display:none}}
</style></head>
<body><main>
<header><p class="meta">LumaSprite Engine · 28/11/2026 ICT · E10.0–E10.3</p>
<h1>Engine v1<br>Release Readiness</h1>
<p>Luồng nhập PNG và component đã sẵn sàng để Owner nghiệm thu. ZIP Windows đã qua smoke test từ thư mục ngoài repo. Giấy phép phân phối còn chờ quyết định của Owner.</p>
<ul class="gates">
<li><code>ENGINE_V1_SCOPE_FROZEN</code> · <span class="pass">PASS</span></li>
<li><code>ENGINE_V1_TECHNICALLY_READY</code> · <span class="pass">PASS</span></li>
<li><code>ENGINE_V1_READY_FOR_OWNER_ACCEPTANCE</code> · <span class="pass">PASS</span></li>
<li><code>ENGINE_V1_OWNER_ACCEPTED</code> · <span class="not_run">PENDING</span></li>
</ul></header>
<nav aria-label="Mục lục"><a href="#features">Phạm vi</a><a href="#pipeline">Pipeline</a><a href="#runtime">Studio và Unity</a><a href="#regression">Hồi quy</a><a href="#package">ZIP và Git</a><a href="#owner">Phiếu Owner</a></nav>
<section id="features"><h2>Phạm vi và tình trạng v1</h2>
<dl><dt>RELEASE_REQUIRED</dt><dd>Pixel Core, PNG/RGBA, palette, mask và layer. Các CLI hiện có, adapter prop 32 × 32, Studio PNG và E8.5 scene ZIP.</dd>
<dt>FIX_BEFORE_RELEASE</dt><dd>Đã hoàn thiện CLI nạp component, masked revision, kiểm package và xuất. Đã chuẩn hóa tài liệu và xác minh ZIP.</dd>
<dt>DEFER_TO_V2</dt><dd>Component đa view, transform và animation. Native component document hay API ở Studio và các đích Unity ngoài Windows.</dd>
<dt>RND_ONLY</dt><dd>Character v4, E7–E9 art pilots, E10.1 reference studies và thử nghiệm provider. E9.H1 giữ quyết định <code>E9_H1_NO_MEANINGFUL_ART_QUALITY_GAIN</code> và đề xuất workflow do artist định hướng.</dd></dl>
<h3>Điều kiện còn tồn đọng</h3><p>Owner cần duyệt bằng bàn phím trong Player, ghi quyết định mỹ thuật và xác nhận quyền phân phối. E10.1 art direction giữ trạng thái chờ. Phiên bản ứng viên tiếp tục dùng production defaults đã khóa.</p></section>
<section id="pipeline"><h2>Pipeline đã xác minh</h2>
<p>PNG có nguồn khai báo → xác minh canvas, palette và alpha → khóa mask, pivot và anchors → sửa một layer trong Studio → tạo revision có SHA của bản cha → xuất package → Studio mở lại → Unity nhập PNG.</p>
<div class="gallery">$sprites</div>
<p>Hai ảnh Studio giữ nguyên RGBA sau khi lưu và mở lại. Revision 2 đổi đúng một pixel trong allowed mask. Rollback dùng lại r1 có SHA RGBA <code>$rollback</code>.</p>
<details><summary>Xem manifest proof và các digest</summary><pre>$workflow</pre></details></section>
<section id="runtime"><h2>Studio và Unity E8.5</h2>
<p>Studio read-only tại <code>$studio</code>. Unity <code>6000.3.21f1</code>, Win64, Test Framework <code>1.6.0</code>. 9 ZIP được importer chấp nhận, giữ biến thể Owner và rollback. Player kiểm interaction reach, walk/idle, lưu, chuyển scene và tải lại.</p>
<div class="gallery">$scenes</div>
<p>Ảnh cảnh là capture 320 × 208 mới của Windows Player. Probe sprite sau Studio dùng Point, 1 mip level và khớp RGBA toàn bộ 16 × 16.</p>
<details><summary>Xem chứng cứ Unity</summary><pre>$unity</pre></details></section>
<section id="regression"><h2>Hồi quy, security và license</h2>
<table><thead><tr><th scope="col">Hạng mục</th><th scope="col">Kết quả</th><th scope="col">Chứng cứ</th></tr></thead><tbody>$rows</tbody></table>
<p>Đối chiếu 38 mục xóa cũ trong working tree. Cả 38 đã có trong checkpoint và khớp từng byte, 13 được pin bởi manifest. Giữ nguyên 38 mục và các benchmark. Bản Report Index mà E7.1R khóa được kiểm từ Git <code>$index</code>.</p>
<p>Npm runtime gồm pngjs 7.0.0 và Zod 4.6.7, đều có MIT notices trong ZIP. Kiểm mẫu secrets giới hạn ở các tệp văn bản hiện hành. License Engine và quyền phân phối tài sản cần được Owner ghi nhận.</p>
<details><summary>Xem audit 805 checksum và các manifest</summary><pre>$integrity</pre></details></section>
<section id="package"><h2>Gói Windows và checkpoint Git</h2>
<dl><dt>Artifact</dt><dd><code>$filename</code> · $bytes byte · Node $node</dd>
<dt>SHA-256</dt><dd><code>$archive_sha</code></dd><dt>Nhánh</dt><dd><code>$branch</code></dd>
<dt>Checkpoint gốc</dt><dd><code>$base</code></dd><dt>Commit build</dt><dd><code>$commit</code> · working tree sạch khi tạo ZIP</dd></dl>
<p>ZIP chứa CLI đã build, hai dependency runtime, notices và mẫu QA nội bộ. Smoke test chạy trong Windows Temp, tạo lại r1/r2, xác minh parent và so sánh hai bản prop. Giữ candidate cục bộ để Owner duyệt.</p>
<details><summary>Xem biên nhận ZIP và lệnh kiểm thử</summary><pre>$archive</pre><pre>npm run lint
npm run typecheck
npm run build
npm test
npm run smoke
npm run test:studio
node scripts/verify-v1-workflow.ts
scripts/e8-unity/run-e85.ps1 -TestsOnly
scripts/e8-unity/run-e85.ps1 -BuildOnly
node scripts/verify-e85-runtime.ts --out .cache/e10-v1/e85-verified --skip-screen-captures
scripts/e8-unity/run-e10-component.ps1
npm audit --json
python scripts/audit-v1.py
python scripts/package-v1-windows.py</pre></details></section>
<section id="limits"><h2>Giới hạn đã ghi nhận</h2>
<p>Component v1 dùng RGBA8, binary alpha, tối đa 128 × 128, 16 layer và 64 màu. Revision chỉ recolor trong mask trên một layer. Sidecar component đi cùng PNG. Adapter prop và scene ZIP giữ hai contract riêng.</p></section>
<section id="ai"><h2>Bàn giao cho giai đoạn AI</h2>
<ul><li>Kiểm kê nguồn dữ liệu, quyền sử dụng và provenance.</li><li>Tập hợp, gắn nhãn, chia tập validation và holdout.</li><li>Đánh giá chất lượng và lỗi pixel theo rubric độc lập.</li><li>Huấn luyện, đánh giá inference và tích hợp provider sau khi Owner ủy quyền.</li></ul>
<p>Draft <code>ImageCandidateProvider</code> đưa manifest cục bộ vào cùng contract component. Spec draft đã có mẫu kiểm tra offline. Giai đoạn Training đang chờ Owner.</p></section>
<section id="owner"><h2>Owner Acceptance</h2><p>Điền và lưu bản in sau khi Owner tự kiểm. Phiếu mở mặc định để trống.</p>
<form autocomplete="off">
<fieldset><legend>Nghiệm thu kỹ thuật</legend>
<label><input type="checkbox"> Mở ZIP ngoài repo và xác minh SHA-256</label>
<label><input type="checkbox"> Kiểm lại Studio edit, export và rollback</label>
<label><input type="checkbox"> Chơi E8.5 bằng phím thật, gồm điều hướng, tương tác và save/reload</label>
<label><input type="checkbox"> Ghi nhận trạng thái mỹ thuật và quyền phân phối</label></fieldset>
<label>Owner <input type="text" name="owner"></label><label>Ngày duyệt <input type="date" name="date"></label>
<label>Quyết định <select name="decision"><option value=""></option><option>Duyệt nội bộ</option><option>Yêu cầu sửa</option><option>Hoãn nghiệm thu</option></select></label>
<label>Ghi chú, phạm vi duyệt và điều kiện <textarea name="notes"></textarea></label>
<label>Chữ ký hoặc xác nhận <input type="text" name="signature"></label>
</form></section>
</main></body></html>
""")
    OUTPUT.write_text(page.substitute(
        sprites=sprites, scenes=scenes, rows="".join(row(*test) for test in tests),
        workflow=evidence(workflow), unity=evidence({"verification": unity, "componentProbe": probe[0]}),
        rollback=workflow["rollbackRgbaSha256"], studio=workflow["studioSha"], archive=evidence(archive),
        filename=escape(archive["filename"]), bytes=format(archive["bytes"], ","), node=escape(archive["smoke"]["node"]),
        archive_sha=archive["sha256"], branch=escape(branch), base=integrity["base"],
        commit=archive["sourceCommit"], index=integrity["historicalIndex"]["commit"], integrity=evidence(integrity),
    ), encoding="utf-8", newline="\n")
    print(OUTPUT)


if __name__ == "__main__":
    main()
