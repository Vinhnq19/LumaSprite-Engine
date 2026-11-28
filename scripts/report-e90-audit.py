"""Create the standalone offline E9.0 Game-Ready Pixel Art Quality Audit & Architecture Review HTML report."""
import argparse
from base64 import b64encode
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import struct
import subprocess

root = Path(__file__).resolve().parents[1]
results = root / "benchmarks/results/e90"
p = argparse.ArgumentParser(description=__doc__)
p.add_argument("--source", required=True)
args = p.parse_args()
source = subprocess.check_output(["git", "rev-parse", "--verify", args.source + "^{commit}"], cwd=root, text=True).strip()
assert source == args.source, f"Source commit mismatch: {source} != {args.source}"

hashes = {}
for line in (results / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
    digest, file = line.split("  ", 1)
    assert sha256((results / file).read_bytes()).hexdigest() == digest, file
    hashes[file] = digest

evidence = json.loads((results / "audit-evidence.json").read_bytes())
blank = json.loads((results / "human-review.json").read_bytes())
rubric = json.loads((root / "docs/art-quality/art-quality-rubric-v2.json").read_bytes())
assert sha256((root / "docs/art-quality/art-quality-rubric-v2.json").read_bytes()).hexdigest() == evidence["rubricV2"]["sha256"]

attachments = {}
for file in sorted(hashes):
    raw = (results / file).read_bytes()
    attachments[file] = {"sha256": hashes[file], "base64": b64encode(raw).decode("ascii")}
rubric_bytes = (root / "docs/art-quality/art-quality-rubric-v2.json").read_bytes()
attachments["art-quality-rubric-v2.json"] = {"sha256": sha256(rubric_bytes).hexdigest(), "base64": b64encode(rubric_bytes).decode("ascii")}
sums_bytes = (results / "SHA256SUMS").read_bytes()
attachments["SHA256SUMS"] = {"sha256": sha256(sums_bytes).hexdigest(), "base64": b64encode(sums_bytes).decode("ascii")}

by_id = {item["id"]: item for item in evidence["evidencePngs"]}


def card(item_id, cls="sprite"):
    item = by_id[item_id]
    raw = (root / item["file"]).read_bytes()
    assert sha256(raw).hexdigest() == item["sha256"], item["file"]
    w, h = struct.unpack(">II", raw[16:24])
    assert (w, h) == (item["w"], item["h"]), item["file"]
    return (
        f'<figure class="{cls}"><figcaption>{escape(item["label"])}'
        f'<small>{escape(item["family"].upper())} · {item["scale"]} · {w}×{h} · SHA <code>{item["sha256"][:12]}…</code></small></figcaption>'
        f'<div class="pan"><img alt="{escape(item["label"])}" width="{w}" height="{h}" '
        f'style="--w:{w}px;--h:{h}px" data-id="{escape(item_id)}" data-sha="{item["sha256"]}" '
        f'src="data:image/png;base64,{b64encode(raw).decode("ascii")}"></div></figure>'
    )


char_cards = "".join(card(i) for i in [
    "char-surveyor-lineup-1x", "char-surveyor-b1-4x", "char-courier-rev-4x",
    "char-ridge-a0-1x", "char-ridge-refined-1x", "char-ridge-refined-4x",
    "char-marsh-a0-1x", "char-marsh-refined-1x", "char-marsh-refined-4x",
    "char-porter-refined-1x", "char-porter-refined-4x", "env-gameplay-e44-1x",
])

anim_cards = "".join(card(i) for i in [
    "anim-surveyor-walk-1x", "anim-courier-walk-1x", "anim-unity-00-1x", "anim-unity-04-1x",
])

prop_cards = "".join(card(i) for i in [
    "prop-barrel-1x", "prop-barrel-4x", "prop-rain-1x", "prop-rain-4x",
    "prop-beacon-1x", "prop-beacon-4x", "prop-beacon-night-4x",
    "prop-vane-1x", "prop-vane-4x",
])

context_cards = "".join(card(i, "scene") for i in [
    "env-mistfen-unity-1x", "env-mistfen-b2-4x", "env-floodgate-unity-1x",
    "env-canal-unity-1x", "env-canal-staging-1x",
])

rubric_rows = "".join(
    f'<tr><th scope="row"><code>{escape(d["id"])}</code><br>{escape(d["name"])}</th>'
    f'<td>{escape(d["prompt"])}</td><td>Gate 1–5 (độc lập, ≥4/5 để PASS)</td></tr>'
    for d in rubric["dimensions"]
)

family_rows = "".join(
    f'<tr><th scope="row">{escape(fam.upper())}</th>'
    f'<td><code>{escape(", ".join(spec["required"]))}</code></td>'
    f'<td><code>{escape(", ".join(spec["optional"]) or "—")}</code></td>'
    f'<td><code>{escape(", ".join(spec["notApplicable"]) or "—")}</code></td></tr>'
    for fam, spec in rubric["assetFamilies"].items()
)

defect_gate_rows = "".join(
    f'<tr><th scope="row"><code>{escape(d["code"])}</code></th><td>{escape(d["description"])}</td><td>Tự động chặn <code>ARTISTIC_PASS</code></td></tr>'
    for d in rubric["criticalDefects"]
)

options = "".join(f"<option>{escape(name)}</option>" for name in sorted(attachments))
e85 = evidence["e85Closeout"]
e85_manifest_note = (
    f'{e85["manifestCountExplanation"]["htmlEmbeddedEntries"]} (HTML E8.5 nhúng lúc xuất) vs '
    f'{e85["manifestCountExplanation"]["diskSha256SumsEntries"]} (SHA256SUMS trên đĩa sau khi bổ sung '
    f'<code>portable-verification.json</code>)'
)

markup = r"""<!doctype html>
<html lang="vi" data-view="fit"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>LumaSprite · E8.5 Closeout &amp; E9.0 Art Quality Architecture Review</title><style>
:root{color-scheme:dark;--paper:#141a1e;--card:#1f282f;--rule:#3b4954;--text:#f5f1e1;--muted:#bcc8d0;--gold:#ffd479;--mint:#8de2cf;--warn:#f7a963;--bad:#ff8b8b}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--text);font:16px/1.55 system-ui,sans-serif}
main{max-width:1320px;margin:auto;padding:36px 24px 80px}h1,h2,h3{font-family:Georgia,serif;line-height:1.15;margin:.4em 0}
h1{font-size:clamp(1.85rem,4.6vw,3.3rem)}h2{font-size:clamp(1.35rem,3vw,2.1rem);color:var(--gold)}
p,li{color:var(--muted);max-width:96ch}a,summary{color:var(--mint)}summary{cursor:pointer;padding:8px 0;font-weight:700}
section{margin-top:34px;padding-top:18px;border-top:1px solid var(--rule)}nav,.controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
nav a,button,select,input,textarea{font:inherit;color:var(--text);background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:5px 10px}
nav a{text-decoration:none}button{cursor:pointer}:focus-visible{outline:2px solid var(--mint);outline-offset:3px}
.label{color:var(--gold);font-weight:700}.warn{color:var(--warn);font-weight:650}.bad{color:var(--bad);font-weight:700}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:12px 0 18px}
.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0 18px}
figure{margin:0;border:1px solid var(--rule);border-radius:8px;background:var(--card);overflow:hidden}
figcaption{padding:8px 10px;font-weight:650;font-size:.95rem}small{display:block;color:var(--muted);font-size:.78rem;font-weight:400}
.pan{overflow:auto;padding:8px;background:#11161a}.pan img{display:block;max-width:none;image-rendering:pixelated}
[data-view="fit"] img{max-width:100%;height:auto}
[data-view="x4"] .sprite img{width:calc(var(--w) * 4);height:calc(var(--h) * 4)}
[data-view="x4"] .scene img{width:calc(var(--w) * 2);height:calc(var(--h) * 2)}
button[aria-pressed="true"]{background:var(--gold);color:#141a1e;font-weight:700}
table{border-collapse:collapse;min-width:720px;width:100%;text-align:left;margin:10px 0;font-size:.92rem}
td,th{padding:8px 10px;border-bottom:1px solid var(--rule);vertical-align:top}th{color:var(--text)}td{color:var(--muted)}
details{display:block;margin-bottom:12px}pre{white-space:pre-wrap;overflow:auto;background:#101518;padding:10px;border-radius:6px}code{overflow-wrap:anywhere}
fieldset{border:1px solid var(--rule);border-radius:8px;padding:14px;min-width:0}fieldset label{display:block;margin:8px 0}
textarea{display:block;width:100%;margin:8px 0}
@media(max-width:960px){main{padding:20px 14px 54px}.grid,.two{grid-template-columns:1fr}}
</style></head><body><main>
<header><p class="label">LumaSprite Engine · E8.5 Closeout &amp; E9.0 Art Quality Audit</p>
<h1>Game-Ready Pixel Art Quality Architecture Review</h1>
<p><code>@@E90_STATUS@@</code> · <code class="warn">@@E85_GATE@@</code> · <code>manualKeyboard=@@MANUAL_KB@@</code> · <code class="bad">TECHNICAL_PASS ≠ ARTISTIC_PASS</code></p>
<p>Báo cáo tổng hợp: (1) Xác minh chứng từ đóng E8.5 sau nghiệm thu E8.3/E8.4 và (2) Đánh giá toàn diện pipeline để tìm nguyên nhân khiến LumaSprite Engine chưa đạt chất lượng pixel art dùng được trong game, làm cơ sở thiết kế Pilot E9.1 (chỉ triển khai sau khi Project Owner phê duyệt).</p>
<nav aria-label="Mục lục">
  <a href="#e85">1. E8.5 Closeout</a>
  <a href="#issues">2. Lỗi Mỹ thuật &amp; PNG 1×/4×</a>
  <a href="#context">3. Gameplay Context</a>
  <a href="#capability">4. Capability &amp; Root-Cause</a>
  <a href="#reuse">5. Tái sử dụng 12 Hệ thống</a>
  <a href="#reference">6. Reference Quality</a>
  <a href="#e91">7. Đề xuất E9.1 &amp; 7 Phương pháp</a>
  <a href="#rubric">8. Rubric v2 &amp; Rủi ro</a>
  <a href="#qa">9. QA &amp; Git SHAs</a>
  <a href="#owner">10. Owner Review</a>
</nav>
<div class="controls" style="margin-top:12px">
  <button type="button" data-view-button="fit" aria-pressed="true">Vừa khung (Fit)</button>
  <button type="button" data-view-button="native" aria-pressed="false">Pixel gốc 1:1 (Native)</button>
  <button type="button" data-view-button="x4" aria-pressed="false">Phóng nguyên lần Nearest-Neighbor (4× Sprite / 2× Scene)</button>
</div>
</header>

<section id="e85"><h2>1. E8.5 Closeout Verification &amp; Owner Gate</h2>
<ul>
  <li><strong>Engine E8.5 (KHÔNG ở <code>main</code>):</strong> Nhánh <code>@@E85_BRANCH@@</code> · Source <code>@@E85_SOURCE@@</code> · HEAD <code>@@E85_HEAD@@</code>.</li>
  <li><strong>Studio E8.4 (READ-ONLY):</strong> Nhánh <code>@@STUDIO_BRANCH@@</code> · HEAD <code>@@STUDIO_HEAD@@</code>.</li>
  <li><strong>Owner ZIP gốc:</strong> <code>e8-mistfen-ferry-landing-day-e84-export.zip</code> (<code>@@OWNER_BYTES@@</code> B, SHA-256 <code>@@OWNER_SHA@@</code>, <code>studioRevision=s8</code>, <code>APPROVED "Live QA verified"</code>).</li>
  <li><strong>Chuỗi thực:</strong> Unity <code>6000.3.21f1</code> (<code>LumaSpriteE85.exe</code>) nhập <strong>@@ZIPS_COUNT@@/9</strong> Studio ZIP · Mistfen <code>X=113 → X=117</code> khác <code>1,189</code> px · Rollback <code>X=113</code> khác <code>0</code> px · Dynamic labels (<code>Kiểm tra cầu phà E8.5</code> → <code>mooring-2</code>, <code>Vận hành tay quay E8.5</code> → <code>sluice</code>, <code>Kiểm tra cửa lấy nước E8.5</code> → <code>sluice</code>) · Legacy fallback nguyên vẹn.</li>
  <li><strong>Giải thích sai lệch 55 vs 56 tệp trong manifest:</strong> @@MANIFEST_EXPLAIN@@. Chứng từ E8.5 hoàn toàn nguyên vẹn.</li>
  <li><strong>Gate Owner E8.5:</strong> <code class="warn">E8_5_OWNER_REVIEW_PENDING</code> (<code>benchmarks/results/e85/human-review.json</code> giữ nguyên trống; <code>manualKeyboard = NOT_RUN</code>). Không tự ký duyệt hay chuyển sang Production Release.</li>
</ul>
</section>

<section id="issues"><h2>2. Các Vấn Đề Mỹ Thuật Chưa Giải Quyết &amp; Bằng Chứng PNG Gốc (1× / 4×)</h2>
<p class="bad"><strong>Nguyên tắc cốt lõi:</strong> Việc tạo PNG sạch alpha 0/255, đúng palette, không drift RGBA và qua hàng trăm SHA-256 chỉ chứng minh <code>TECHNICAL_PASS</code> — tuyệt đối không phải <code>ARTISTIC_PASS</code>. Khi xem ở 1× và 4×, chất lượng pixel art hiện tại vẫn mang rõ các giới hạn cấu trúc.</p>
<h3>Character &amp; Animation Sprites (1× &amp; 4×)</h3>
<div class="grid">@@CHAR_CARDS@@</div>
<div class="two">@@ANIM_CARDS@@</div>
<h3>Props &amp; Instruments (1× &amp; 4×)</h3>
<div class="grid">@@PROP_CARDS@@</div>
</section>

<section id="context"><h2>3. Gameplay Context Thật (320×208 Windows Player &amp; 4×)</h2>
<p>Đặt actor và prop vào cảnh 320×208 từ Unity <code>LumaSpriteE85.exe</code> và E4.4 cho thấy rõ hiệu ứng “sticker viền đen” giữa nhân vật/prop và kiến trúc nền, đèn nhà cạnh tranh thị giác với actor, cùng hạn chế một hướng nhìn.</p>
<div class="two">@@CONTEXT_CARDS@@</div>
</section>

<section id="capability"><h2>4. Capability Matrix &amp; Root-Cause Analysis (8 Trường Bắt Buộc)</h2>
<h3>Capability Matrix Theo Dòng Asset</h3>
<div class="pan"><table>
  <thead><tr><th>Asset Family</th><th>Mức độ sẵn sàng kỹ thuật</th><th>Mức độ sẵn sàng mỹ thuật game-ready</th><th>Khả năng tổng quát hóa brief mới</th></tr></thead>
  <tbody>
    <tr><th scope="row">Character (64×64)</th><td><code>PASS</code> (ShapeLock, RGBA, M2P, Unity import)</td><td class="bad">CHƯA ĐẠT (lặp khuôn, tay tròn 4×4, cụm loang UV)</td><td class="bad">Thấp (phải viết hình học/phụ kiện tay)</td></tr>
    <tr><th scope="row">Animation</th><td><code>PASS</code> (zero foot slip, 880ms wrap, transition sạch)</td><td class="warn">PARTIAL (cứng thân trên, khóa 1 hướng, chưa hỗ trợ 2-tay/áo choàng)</td><td class="bad">Thấp (chỉ hỗ trợ v2 hold &amp; v3 free 1 hướng)</td></tr>
    <tr><th scope="row">Props (24–32px)</th><td><code>PASS</code> (alpha, palette, pivot, collision)</td><td class="warn">MIXED (Barrel E2.4 khá; Rain/Beacon/Vane E7.4R còn khó đọc ở 1×)</td><td class="bad">Thấp (<code>semantic-instrument.ts</code> hardcode từng brief)</td></tr>
    <tr><th scope="row">Environment (320×208)</th><td><code>PASS</code> (tile IDs, depth sort, RLE, Canal staging 140/140)</td><td class="warn">PARTIAL (bến/van đọc chức năng được nhưng cỏ/nước lặp &amp; tương phản sticker)</td><td class="warn">Trung bình (tái sử dụng cùng mẫu nhà &amp; bờ thẳng)</td></tr>
  </tbody>
</table></div>

<h3>Bảng Phân Tích Root-Cause Toàn Bộ Lỗi Trọng Yếu</h3>
<div class="pan"><table>
  <thead><tr><th>ID &amp; Ưu tiên</th><th>Bằng chứng PNG &amp; Brief</th><th>Root Cause &amp; Source liên quan</th><th>Tác động ở Native 1×</th><th>Sửa bằng Rule hay Phương pháp mới &amp; Rủi ro</th></tr></thead>
  <tbody>
    <tr><th scope="row">C1 · P0<br>Khung lặp mẫu</th><td><code>e44/b1-4x</code>, <code>e44/courier-rev-4x</code>, <code>e75r/ridge</code>, <code>e75r/porter</code></td><td><code>geometry.ts:119-175</code> và <code>character-identity.ts:52-102</code> dùng cùng 1 đa giác áo 8 đỉnh &amp; sọ chung, chỉ đổi mũ/áo khoác.</td><td>Nhân vật khác nghề nhìn gần như một người; che đạo cụ sẽ mất bản sắc.</td><td><strong>Phương pháp mới</strong> (Part-based archetype hoặc Artist-authored templates). Rủi ro: TB–Cao nếu sửa legacy (phải tách vào v4).</td></tr>
    <tr><th scope="row">C2 · P0<br>Tay 4×4 &amp; grip</th><td><code>e75r/ridge</code>, <code>e75r/marsh</code>, <code>e75r/porter</code></td><td><code>geometry.ts:96</code> vẽ tay bằng <code>segment(4,4)</code>; <code>character-equipment.ts:36-47</code> xoay polygon và chồng lớp.</td><td>Tay như cục tròn đặt đè lên cán; móc Marsh dễ đọc nhầm gậy cong.</td><td><strong>Phương pháp mới</strong> (Grip-aware discrete hand motifs + pixel-snapped tool head). Rủi ro: Thấp nếu tách v4.</td></tr>
    <tr><th scope="row">C3 · P1<br>Giải phẫu &amp; mặt</th><td><code>e44/b1-4x</code>, <code>e44/courier-rev-4x</code></td><td><code>geometry.ts:170-175</code> (cổ oval 6×8), <code>material-planes.ts:53-60</code> vẽ mắt bằng một dải ngang cố định.</td><td>Cổ–vai gãy góc vuông, mặt hơi dẹt như mặt nạ.</td><td><strong>Rule + hand-tuned motif</strong> cho đầu/vai 3/4. Rủi ro: TB (phá SHA v1–v3 nếu không tách v4).</td></tr>
    <tr><th scope="row">C4 · P0<br>Cụm UV loang</th><td><code>e44/courier-rev-4x</code>, <code>e75r/ridge</code>, <code>e75/marsh</code></td><td><code>materials.ts:78-90</code> chia mảng theo UV bounding-box 0..1 trên từng part (<code>material-planes.ts</code>).</td><td>Áo bị đốm loang chéo thiếu nếp vải; patch RGB 3–12 px ở E7.5R chứng minh vô hiệu.</td><td><strong>Phương pháp mới</strong> (Form-aware directional cluster shading + cleanup 1px). Rủi ro: TB.</td></tr>
    <tr><th scope="row">C5 · P1<br>Viền đen cứng</th><td><code>e44/b1-4x</code>, <code>e85/mistfen-day-e84</code></td><td><code>layers.ts:4-10</code> vẽ <code>outline(filled, #262334)</code> đơn sắc toàn chu vi.</td><td>Viền nuốt cán mảnh và tách actor thành miếng dán trên nền gỗ sáng.</td><td><strong>Rule Sel-Out</strong> (Selective interior/key-light outline). Rủi ro: TB (kiểm Night P10).</td></tr>
    <tr><th scope="row">A1 · P1<br>Walk thân trên cứng</th><td><code>e54/surveyor/walk</code>, <code>e54/courier/walk</code>, <code>e85/animation-00..04</code></td><td><code>walk.ts:38-44</code> giữ cứng tay cầm đèn trừ <code>lanternSway</code> 1px; vai thiếu counter-rotation.</td><td>Chân trượt zero-slip chuẩn nhưng thân trên như bị đông cứng.</td><td><strong>Mở rộng rule</strong> walk (secondary motion vai/túi/đèn). Rủi ro: TB (giữ locked sole).</td></tr>
    <tr><th scope="row">A2 · P0<br>Khóa 1 hướng nhìn</th><td><code>e85/mistfen-day</code>, <code>E8Smoke.cs:175</code></td><td><code>character.ts:15</code> khóa <code>three-quarter-right</code>; không có hướng trái/lên/xuống.</td><td>Trong game Unity đi sang trái nhân vật bị “đi giật lùi”.</td><td><strong>Thiết kế mới</strong> multi-direction (sau khi chốt static E9.1). Rủi ro: Cao.</td></tr>
    <tr><th scope="row">A3 · P1<br>Thiếu walk 2-tay/áo</th><td><code>e75r/porter</code>, <code>e75r/marsh</code></td><td><code>walk.ts:95-98</code> chỉ hỗ trợ <code>standing-hold</code> v2 &amp; <code>standing-free</code> v3.</td><td>Nhân vật nghề nghiệp mới không bước đi được trong Unity.</td><td><strong>Mở rộng Animation Pipeline</strong> sau static E9.1. Rủi ro: TB.</td></tr>
    <tr><th scope="row">P1–P2 · P0<br>Props 32px khó đọc</th><td><code>e74r/rain</code>, <code>beacon</code>, <code>vane</code> (so với <code>e24/barrel</code>)</td><td><code>semantic-instrument.ts:40-90</code> hardcode tọa độ hộp; <code>layers.ts</code> dùng viền tối đồng nhất.</td><td>Khó đọc cơ cấu nhỏ ở 1×, Night bị chìm chân giằng, không tổng quát brief mới.</td><td><strong>Phương pháp mới</strong> (Reusable semantic shape primitives + Sel-Out). Rủi ro: Thấp–TB.</td></tr>
    <tr><th scope="row">E1–E3 · P0/P1<br>Bối cảnh &amp; Sticker</th><td><code>e85/mistfen</code>, <code>floodgate</code>, <code>canal</code></td><td><code>functional-waterfront.ts:28-120</code> lặp cụm cỏ/gạch nước ngang, tái sử dụng nhà chữ nhật, thiếu thuyền, thiếu bóng/sel-out gắn sàn.</td><td>Nhân vật nổi tách khỏi nền, đèn nhà hút mắt, tay quay không có cơ cấu truyền.</td><td><strong>Mở rộng Composition + ArtDirection</strong> (bờ organic, contact shadow, thống nhất viền). Rủi ro: TB.</td></tr>
  </tbody>
</table></div>
</section>

<section id="reuse"><h2>5. Đánh Giá 12 Thành Phần Pipeline &amp; Khả Năng Tái Sử Dụng</h2>
<div class="pan"><table>
  <thead><tr><th>Thành phần</th><th>Source Path</th><th>Khuyến nghị E9+</th><th>Lý do kỹ thuật</th></tr></thead>
  <tbody>
    <tr><th scope="row">Pixel Core</th><td><code>src/core/pixels/raster.ts</code>, <code>png.ts</code></td><td><strong>KEEP / REUSE</strong></td><td>Alpha 0/255 sạch, exact RGBA deterministic.</td></tr>
    <tr><th scope="row">ShapeSpec</th><td><code>src/core/geometry/</code></td><td><strong>REUSE + EXTEND</strong></td><td>Giữ chiếu 3/4, thêm pixel-snapped curves &amp; nếp vải.</td></tr>
    <tr><th scope="row">PoseSpec</th><td><code>src/specs/character.ts</code>, <code>geometry.ts</code></td><td><strong>EXTEND</strong></td><td>Giữ kiểm ground/knee, mở multi-facing &amp; nhiều pose.</td></tr>
    <tr><th scope="row">CharacterSpec</th><td><code>src/specs/character.ts</code>, <code>production.ts</code></td><td><strong>REDESIGN (v4 Pilot)</strong></td><td>Giữ v1–v3 nguyên vẹn; tách v4 hỗ trợ archetype thân hình.</td></tr>
    <tr><th scope="row">Semantic Materials</th><td><code>src/generators/character/materials.ts</code>, <code>material-planes.ts</code></td><td><strong>REDESIGN</strong></td><td>Thay UV patch phẳng bằng form-aware clusters &amp; sel-out.</td></tr>
    <tr><th scope="row">ArtDirectionSpec</th><td><code>src/experiments/art-direction.ts</code></td><td><strong>EXTEND</strong></td><td>Bổ sung phân cấp outline &amp; contrast nền/actor.</td></tr>
    <tr><th scope="row">Quality-Guided Gen</th><td><code>src/experiments/quality-guided-character.ts</code></td><td><strong>KEEP (Technical Gate)</strong></td><td>Chỉ dùng làm sàng kỹ thuật, cấm tự chấm đẹp.</td></tr>
    <tr><th scope="row">Local Refinement</th><td><code>src/experiments/structure-quality/</code></td><td><strong>KEEP (Late Polish)</strong></td><td>E7.4R/E7.5R đã chứng minh không cứu được lỗi cấu trúc gốc.</td></tr>
    <tr><th scope="row">Animation Pipeline</th><td><code>src/generators/character/walk.ts</code></td><td><strong>REUSE + EXTEND</strong></td><td>Giữ zero foot-slip &amp; 880ms wrap, thêm secondary swing &amp; 2-hand support.</td></tr>
    <tr><th scope="row">Environment Comp</th><td><code>src/generators/environment/render.ts</code>, <code>functional-waterfront.ts</code></td><td><strong>REUSE + EXTEND</strong></td><td>Giữ atlas/collision Unity, nâng độ tự nhiên bờ/cỏ/sel-out kiến trúc.</td></tr>
    <tr><th scope="row">Runtime Art Review</th><td><code>scripts/e8-unity/</code>, <code>verify-e85-runtime.ts</code></td><td><strong>KEEP / REUSE</strong></td><td>Đảm bảo nghiệm thu 1× trong Unity Player thật.</td></tr>
    <tr><th scope="row">Studio Workbench</th><td><code>D:\LumaSprite-Studio</code> (READ-ONLY)</td><td><strong>KEEP / REUSE</strong></td><td>Nạp <code>art-quality-rubric-v2.json</code> trực tiếp không cần sửa Studio.</td></tr>
  </tbody>
</table></div>
</section>

<section id="reference"><h2>6. Kế Hoạch Thư Viện Reference Quality</h2>
<ul>
  <li><strong>Tầng 1 — Owner-Approved LumaSprite Baselines:</strong> Giữ các thành tố đạt chuẩn của dự án (như khối gỗ/sắt <code>barrel-tall</code> E2.4, cầu ván Mistfen B2, nhịp tiếp đất walk E5.2).</li>
  <li><strong>Tầng 2 — Permitted Pixel Art Craft References (PixelLab Benchmark):</strong> Dùng <strong>PixelLab</strong> và các reference pixel art được phép dùng làm tiêu chuẩn tham khảo về *độ tinh xảo cụm pixel, cách tạo sel-out, bàn tay 64×64 và khả năng đọc ở 1×*. <strong>Nghiêm cấm sao chép nhân vật hay sprite thương mại;</strong> mọi asset tham khảo phải ghi rõ nguồn, bản quyền và mục đích đối chiếu.</li>
  <li><strong>Tầng 3 — LumaSprite Art Direction Guide:</strong> Khóa hướng sáng upper-left, quy chuẩn viền theo vật liệu và độ chênh sáng giữa nền tĩnh – công trình – nhân vật.</li>
  <li><strong>Tầng 4 — Annotated Good/Bad Pairs (1× &amp; 4×):</strong> Ghi chú trực quan trên từng vùng (ví dụ loang UV vai áo vs nếp vải tụ trụ).</li>
  <li><strong>Chống tự xác nhận sai:</strong> Tuyệt đối không dùng ảnh do chính generator sinh ra làm Gold Standard chất lượng.</li>
</ul>
</section>

<section id="e91"><h2>7. Thiết Kế Pilot Character 64×64 E9.1 &amp; Đánh Giá 7 Phương Pháp (Chờ Duyệt)</h2>
<p class="warn"><strong>GATE BẮT BUỘC:</strong> E9.1 chỉ là thiết kế kiến trúc — KHÔNG triển khai sinh ảnh cho tới khi Project Owner phê duyệt E9.0. Không dùng lại Ridge Mechanic và Marsh Harvester làm development brief.</p>
<div class="two">
  <fieldset><legend>Development Brief Mới: <code>harbor-lockkeeper</code> (64×64)</legend>
    <p>Thợ vận hành âu thuyền vai rộng đứng thẳng, tạp dề da chống thấm phủ trên áo len gân, mũ vải dầu vành ngắn lộ rõ sống mũi/cằm/hốc mắt, tay gần nắm chắc (overhand thumb-wrapped grip) tay van đồng-gỗ chéo lên, tay xa giữ chốt đai thắt lưng gắn đồng hồ áp lực.</p>
  </fieldset>
  <fieldset><legend>Fresh Unseen Holdout: <code>marsh-apothecary</code> (64×64)</legend>
    <p>Khóa trước khi chạy: dáng thanh mảnh khác hẳn archetype vai rộng, khăn trùm buông lệch vai + vạt tunic xòe chữ A, lộ mái tóc búi sau, tay gần cầm gáo đồng cán dài, tay xa ôm khay lọ thủy tinh nắp gỗ bần. Dùng một lần để kiểm chứng tổng quát hóa sang brief mới.</p>
  </fieldset>
</div>
<h3>So Sánh Công Bằng A0 / A1 / A2 (Cùng Brief · Seed · Camera · Style Profile · Size)</h3>
<ul>
  <li><strong>A0 — Existing Character Generator (Capability-Matched):</strong> Generator v3 + attachment/M2P hiện tại cấp đủ trang bị của <code>harbor-lockkeeper</code> để làm đối chứng công bằng (không gán lỗi thiếu chức năng cho A0).</li>
  <li><strong>A1 — Proposed Quality Improvement:</strong> Part-Based Archetype Construction + Grip-Aware Hand Templates + Form-Aware Cluster Shading + Selective Interior/Outer Outline (Sel-Out).</li>
  <li><strong>A2 — Alternative Hypothesis:</strong> Artist-Authored Parametric Silhouette Templates (bộ mặt nạ đầu/tay/thân 1× nắn thủ công + biến thể vật liệu/trang bị thủ tục) để kiểm chứng xem phần lõi giải phẫu có cần template họa sĩ hay thuần thủ tục là đủ.</li>
</ul>
<h3>Đánh Giá 7 Phương Pháp Theo Mục XII</h3>
<div class="pan"><table>
  <thead><tr><th>Phương pháp</th><th>Khả năng giải quyết lỗi 1×</th><th>Giới hạn &amp; Chi phí</th><th>Kết luận trong E9.1</th></tr></thead>
  <tbody>
    <tr><td>1. Rule-based geometry hiện có</td><td>Thấp về mặt thẩm mỹ (khối vuông, vai gãy).</td><td>Khó làm đường cong hữu cơ ở 1×.</td><td>Giữ cho khớp/bounds; không vẽ bề mặt cuối.</td></tr>
    <tr><td>2. Reusable semantic shape primitives</td><td>Trung bình–Tốt cho thiết bị cơ khí.</td><td>Cần motif pixel-snapped, tránh xoay polygon tự do.</td><td>Áp dụng cho công cụ &amp; prop cầm tay.</td></tr>
    <tr><td>3. Part-based character construction</td><td>Cao cho silhouette &amp; đa dạng nghề nghiệp.</td><td>Cần slot depth &amp; socket tay chuẩn xác.</td><td><strong>Nhân lõi của A1</strong>.</td></tr>
    <tr><td>4. Constraint-based pose refinement</td><td>Không tự làm hình đẹp, chỉ chặn gãy khớp.</td><td>Phụ thuộc chất lượng hình học nền.</td><td>Giữ làm Shape Gate kiểm an toàn.</td></tr>
    <tr><td>5. Artist-authored templates + variation</td><td>Rất cao cho giải phẫu &amp; bàn tay 64×64.</td><td>Tốn công tạo bộ micro-template gốc.</td><td><strong>Thử nghiệm đối chứng trực tiếp ở A2</strong>.</td></tr>
    <tr><td>6. Quality-guided selection</td><td>Thấp nếu pool đầu vào đều lỗi giải phẫu.</td><td>Chỉ lọc được chỉ số kỹ thuật/cluster.</td><td>Giữ làm sàng kỹ thuật, không chấm đẹp.</td></tr>
    <tr><td>7. Bounded local refinement</td><td>Rất thấp trên hình học yếu (<code>NO_MEANINGFUL_VISUAL_GAIN</code>).</td><td>Chỉ hiệu quả khi đã có silhouette chuẩn.</td><td>Dành cho tinh chỉnh cuối sau A1/A2.</td></tr>
  </tbody>
</table></div>
<p><strong>Tại sao chưa tích hợp DeepSeek / Neural:</strong> Sinh ảnh neural không khóa được alpha nhị phân, bảng màu <code>weathered-station-v1</code>, lưới pixel 1× không mixel và tách part/pivot deterministic cho Unity <code>6000.3.21f1</code>. Cải thiện bằng kiến trúc hình học–cụm pixel trước giải quyết thẳng nguyên nhân gốc.</p>
</section>

<section id="rubric"><h2>8. Art Quality Rubric v2 &amp; Rủi Ro Triển Khai</h2>
<p>Chấm 1–5 từng mục độc lập theo đúng dòng asset. <strong>Bất kỳ lỗi Critical nào đều chặn <code>ARTISTIC_PASS</code> dù điểm trung bình cao.</strong> Engine tuyệt đối không được tự chấm và tự tuyên bố Artistic PASS.</p>
<div class="pan"><table>
  <thead><tr><th>Tiêu chí (12 mục bắt buộc)</th><th>Câu hỏi kiểm định ở 1× &amp; trong cảnh</th><th>Quy tắc cổng</th></tr></thead>
  <tbody>@@RUBRIC_ROWS@@</tbody>
</table></div>
<h3>Ma Trận Áp Dụng Theo Dòng Asset</h3>
<div class="pan"><table>
  <thead><tr><th>Asset Family</th><th>Tiêu chí Bắt Buộc (Required)</th><th>Tùy chọn (Optional)</th><th>Không áp dụng (N/A)</th></tr></thead>
  <tbody>@@FAMILY_ROWS@@</tbody>
</table></div>
<h3>8 Lỗi Nghiêm Trọng Độc Lập (Critical Defects Gate)</h3>
<div class="pan"><table>
  <thead><tr><th>Mã lỗi</th><th>Mô tả chặn phát hành</th><th>Hiệu lực</th></tr></thead>
  <tbody>@@DEFECT_GATE_ROWS@@</tbody>
</table></div>
</section>

<section id="qa"><h2>9. Technical QA Status, Git SHAs &amp; Evidence Attachments</h2>
<ul>
  <li><strong>Engine Branch E9.0:</strong> <code>codex/e9-0-art-quality-audit</code> · Source Commit <code>@@SOURCE@@</code> (tách từ E8.5 HEAD <code>@@E85_HEAD@@</code>; E8.5 Source <code>@@E85_SOURCE@@</code>).</li>
  <li><strong>Studio (READ-ONLY):</strong> <code>@@STUDIO_BRANCH@@</code> · HEAD <code>@@STUDIO_HEAD@@</code> · <code>npm run typecheck</code> PASS · <code>107/107</code> unit PASS · <code>47/47</code> Chrome E2E PASS.</li>
  <li><strong>Engine QA:</strong> <code>verify-e90-audit.ts</code> PASS · <code>lint</code> / <code>typecheck</code> / <code>build</code> PASS · <code>npm test</code> <strong>78/78 PASS</strong> · <code>npm run smoke</code> PASS · <strong>805</strong> historical catalog SHA-256 + <code>e76r</code> + <code>e8</code> + <code>e83</code> + <code>e85</code> (56 tệp) nguyên vẹn 100%.</li>
  <li><strong>Unity (E8.5 Sandbox tái sử dụng):</strong> EditMode <code>7/7</code> PASS · PlayMode <code>2/2</code> PASS · <code>LumaSpriteE85.exe</code> <code>9/9</code> Studio ZIPs &amp; <code>6/6 + 2</code> World RGBA exact.</li>
</ul>
<div class="controls"><label for="evidence">Tệp JSON / SHA-256</label><select id="evidence">@@OPTIONS@@</select><button id="download" type="button">Tải tệp JSON</button></div>
<details><summary>SHA-256 E9.0 Audit Manifest &amp; Rubric v2</summary><pre>@@HASHES@@</pre></details>
</section>

<section id="owner"><h2>10. Phiếu Phê Duyệt Kiến Trúc E9.0 &amp; Chốt Gate E8.5 (Project Owner)</h2>
<p>Phiếu này được giữ trống hoàn toàn. Project Owner điền trực tiếp sau khi rà soát ảnh 1×/4× và đề xuất Pilot E9.1, rồi xuất <code>E9.0-HUMAN-REVIEW.json</code>.</p>
<form id="review"><fieldset><legend>Owner Art Direction Review</legend>
  <label>Người đánh giá <input name="reviewer"></label>
  <label>Ngày <input type="date" name="reviewedAt"></label>
  <label>Quyết định E8.5 Manual/End-to-End <select name="e85ManualDecision"><option value="">Chưa chọn</option><option>E8_5_OWNER_ACCEPTED</option><option>E8_5_NEEDS_REVISION</option><option>DEFER_PENDING_MANUAL_KEYBOARD</option></select></label>
  <label>Quyết định E9.0 Art Quality Audit <select name="e90ArchitectureDecision"><option value="">Chưa chọn</option><option>E9_0_APPROVED</option><option>NEEDS_REVISION</option></select></label>
  <label>Cấp phép Pilot E9.1 Character 64×64 <select name="authorizeE91CharacterPilot"><option value="">Chưa chọn</option><option>AUTHORIZED</option><option>HOLD</option></select></label>
  <label>Hướng ưu tiên cho Pilot E9.1 <select name="preferredE91Approach"><option value="">Chưa chọn</option><option>COMPARE_A0_A1_A2</option><option>A1_PART_BASED_FIRST</option><option>A2_AUTHORED_TEMPLATE_HYBRID_FIRST</option></select></label>
  <div id="checks"></div>
  <label>Nhận xét mỹ thuật &amp; yêu cầu chỉnh sửa <textarea name="notes" rows="3"></textarea></label>
  <button id="export" type="button">Xuất E9.0 Human Review JSON</button>
</fieldset></form>
</section>
</main>
@@DATA@@
<script>
for(const button of document.querySelectorAll('[data-view-button]'))button.onclick=()=>{
  document.documentElement.dataset.view=button.dataset.viewButton;
  for(const peer of document.querySelectorAll('[data-view-button]'))peer.setAttribute('aria-pressed',String(peer===button));
};
const assets=JSON.parse(document.querySelector('#assets').textContent),template=JSON.parse(document.querySelector('#blank-review').textContent);
const checks={
  e85PhysicalKeyboardAndEndToEnd:'1. Kiểm nghiệm thủ công E8.5 hoàn tất (hoặc ghi chú rõ lý do trì hoãn)',
  e90RootCauseAuditAccepted:'2. Đồng ý phân tích nguyên nhân gốc C1–C5, A1–A3, P1–P2, E1–E3',
  artQualityRubricV2Approved:'3. Phê duyệt Art Quality Rubric v2 (12 tiêu chí + Critical Defects độc lập)',
  referenceLibraryPolicyApproved:'4. Phê duyệt kế hoạch thư viện Reference (PixelLab benchmark + cấm tự dùng ảnh máy sinh)',
  e91HarborLockkeeperBriefApproved:'5. Phê duyệt Development Brief mới: harbor-lockkeeper (64×64)',
  e91MarshApothecaryHoldoutApproved:'6. Phê duyệt Holdout mới: marsh-apothecary (64×64)'
};
for(const [name,label] of Object.entries(checks)){
  const line=document.createElement('label');line.textContent=label+' ';
  const input=document.createElement('select');input.name=name;
  for(const [cap,val] of [['Chưa kiểm',''],['PASS','PASS'],['FAIL','FAIL'],['NOT_RUN','NOT_RUN']])input.add(new Option(cap,val));
  line.append(input);document.querySelector('#checks').append(line);
}
function download(blob,name){const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
document.querySelector('#download').onclick=()=>{const name=document.querySelector('#evidence').value,item=assets[name];
  download(new Blob([Uint8Array.from(atob(item.base64),c=>c.charCodeAt(0))]),name);};
document.querySelector('#export').onclick=()=>{const data=new FormData(document.querySelector('#review')),res=structuredClone(template);
  for(const k of ['reviewer','reviewedAt','e85ManualDecision','e90ArchitectureDecision','authorizeE91CharacterPilot','preferredE91Approach','notes'])res[k]=data.get(k).trim();
  for(const k of Object.keys(res.checklist))res.checklist[k]=data.get(k)||'';
  download(new Blob([JSON.stringify(res,null,2)+'\n'],{type:'application/json'}),'E9.0-HUMAN-REVIEW.json');};
</script></body></html>
"""

values = {
    "E90_STATUS": evidence["status"],
    "E85_GATE": e85["gateStatus"],
    "MANUAL_KB": e85["manualKeyboard"],
    "E85_BRANCH": e85["engineBranch"],
    "E85_SOURCE": e85["engineSourceCommit"],
    "E85_HEAD": e85["engineHeadCommit"],
    "STUDIO_BRANCH": e85["studioBranch"],
    "STUDIO_HEAD": e85["studioHeadCommit"],
    "OWNER_BYTES": str(e85["ownerZipBytes"]),
    "OWNER_SHA": e85["ownerZipSha256"],
    "ZIPS_COUNT": str(e85["studioZipsImported"]),
    "MANIFEST_EXPLAIN": e85_manifest_note,
    "CHAR_CARDS": char_cards,
    "ANIM_CARDS": anim_cards,
    "PROP_CARDS": prop_cards,
    "CONTEXT_CARDS": context_cards,
    "RUBRIC_ROWS": rubric_rows,
    "FAMILY_ROWS": family_rows,
    "DEFECT_GATE_ROWS": defect_gate_rows,
    "SOURCE": source,
    "OPTIONS": options,
    "HASHES": escape("\n".join(f'{meta["sha256"]}  {name}' for name, meta in sorted(attachments.items()))),
    "DATA": (
        '<script id="assets" type="application/json">'
        + json.dumps(attachments, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
        + '</script><script id="blank-review" type="application/json">'
        + json.dumps(blank, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
        + "</script>"
    ),
}
for key, value in values.items():
    markup = markup.replace("@@" + key + "@@", value)

target = root / "docs/reports/E9.0-ART-QUALITY-ARCHITECTURE-REVIEW.html"
target.write_bytes(markup.encode("utf-8"))
print(f"{len(evidence['evidencePngs'])} real PNGs | {len(attachments)} attachments | SHA-256 {sha256(target.read_bytes()).hexdigest()}")
