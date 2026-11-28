"""Create the standalone offline E8.5 End-to-End Production Pipeline Acceptance HTML report."""
import argparse
from base64 import b64encode
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import struct
import subprocess

root = Path(__file__).resolve().parents[1]
results = root / "benchmarks/results/e85"
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


def json_file(name):
    return json.loads((results / name).read_bytes())


def script(id_, data):
    return (
        f'<script id="{id_}" type="application/json">'
        + json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
        + "</script>"
    )


runtime = json_file("runtime.json")
qa = json_file("verification.json")
importer = json_file("unity-import.json")
zips_manifest = json_file("zips-manifest.json")
phase_a = json_file("phase-a-smoke.json")
blank = json_file("human-review.json")

attachments = {}
for file in [name for name in hashes if not name.endswith(".png")] + ["SHA256SUMS"]:
    raw = (results / file).read_bytes()
    attachments[file] = {"sha256": sha256(raw).hexdigest(), "base64": b64encode(raw).decode("ascii")}

drawn = set()


def card(file, label, category, cls="world"):
    raw = (results / file).read_bytes()
    w, h = struct.unpack(">II", raw[16:24])
    drawn.add(file)
    return (
        f'<figure class="{cls}"><figcaption>{escape(label)}<small>{escape(category)} · {w}×{h}</small></figcaption>'
        f'<div class="pan"><img alt="{escape(label)}" width="{w}" height="{h}" '
        f'style="--w:{w}px;--h:{h}px" data-file="{escape(file)}" data-sha="{hashes[file]}" '
        f'src="data:image/png;base64,{b64encode(raw).decode("ascii")}"></div></figure>'
    )


names = {
    "mistfen-ferry-landing": "Mistfen Ferry Landing",
    "floodgate-maintenance-yard": "Floodgate Maintenance Yard",
    "canal-intake-service-platform": "Canal Intake Service Platform",
}
world = "WORLD ONLY · 320×208"
hud = "UNITY FRAMEBUFFER · HUD"

# Before / After / Rollback comparison
owner_var = next(v for v in runtime["studioVariants"] if v["variant"] == "day-e84")
rollback_var = next(v for v in runtime["studioVariants"] if v["variant"] == "day-rollback")
mistfen_day = next(r for r in runtime["cases"] if r["id"] == "mistfen-ferry-landing" and r["light"] == "day")

before_after_cards = [
    card("before-mistfen-day-x113.png", "1) Engine gốc khóa B2 (Surveyor X=113, Y=174)", "LOCKED ENGINE E7.6R/E8.3"),
    card(owner_var["capture"], f"2) Owner Studio ZIP gốc E8.4 (X=117 · rev s{owner_var['studioRevision']} · diff {qa['ownerStudioZip']['diffPixelsVsX113']} px)", world),
    card(rollback_var["capture"], f"3) Studio Rollback ZIP (X=113 · rev s{rollback_var['studioRevision']} · diff 0 px vs gốc)", world),
    card(owner_var["promptCapture"], f"Owner E8.4 ZIP HUD ({owner_var['prompt']})", hud, "hud"),
    card(mistfen_day["promptCapture"], f"E8.5 Dynamic Label HUD ({mistfen_day['prompt']} · link {mistfen_day['linkedEntityId']})", hud, "hud"),
    card(rollback_var["promptCapture"], f"Rollback ZIP HUD ({rollback_var['prompt']})", hud, "hud"),
]

# Dynamic interaction label & linkedEntityId summary rows
dynamic_rows = []
for r in runtime["cases"]:
    dynamic_rows.append(
        f'<tr><th scope="row">{names[r["id"]]} · {r["light"].title()}</th>'
        f'<td><code>{escape(r["interactionId"])}</code></td>'
        f'<td><code>{escape(r["interactionLabel"])}</code></td>'
        f'<td><code>{escape(r["prompt"])}</code></td>'
        f'<td><code>{escape(r["linkedEntityId"])}</code> ({ "RESOLVED" if r["linkedEntityResolved"] else "MISSING" })</td>'
        f'<td>({r["spawnX"]}, {r["spawnY"]})</td><td>s{r["studioRevision"]}</td></tr>'
    )

# Studio-exported ZIPs manifest rows
zip_rows = []
for item in zips_manifest["items"]:
    origin_kind = "Owner E8.4 Live ZIP (verbatim)" if item.get("ownerOriginalZip") else (
        "Studio Rollback ZIP" if item.get("rollbackVerified") else "Studio E8.5 Test Export"
    )
    lbl = item.get("interactionLabel") or "(default fallback)"
    lnk = item.get("linkedEntityId") or "—"
    zip_rows.append(
        f'<tr><th scope="row"><code>{escape(item["zipFile"])}</code></th>'
        f'<td>{escape(origin_kind)}</td>'
        f'<td><code>{escape(item["targetSubdir"])}</code></td>'
        f'<td>{item["zipBytes"]}</td>'
        f'<td><code>{item["zipSha256"][:16]}…</code></td>'
        f'<td>s{item["studioRevision"]} · {escape(item["approvalStatus"])}</td>'
        f'<td>({item["spawn"]["x"]}, {item["spawn"]["y"]})</td>'
        f'<td>{escape(lbl)} / <code>{escape(lnk)}</code></td></tr>'
    )

by_scene = {}
performance = []
for row in runtime["cases"]:
    light, key = row["light"].title(), row["id"]
    deck = [
        card(row["outOfRangeCapture"], f"{light} · Ngoài tầm (marker ở xa)", hud, "hud"),
        card(row["promptCapture"], f"{light} · Trong tầm ({row['prompt']})", hud, "hud"),
        card(row["feedbackCapture"], f"{light} · Sau nhấn E ({row['feedback']})", hud, "hud"),
    ]
    proof = card(row["staticCapture"], f"{light} · Unity World Spawn RGBA exact (X={row['spawnX']}, Y={row['spawnY']})", world)
    proof += card(row["routeCapture"], f"{light} · Unity World tại mốc tương tác ({row['steps']} bước)", world)
    if row["stagingCapture"]:
        note = "271,110 · 140/140 ROI (Studio staging ZIP)" if row["light"] == "day" else f"Staging candidate · {row['apertureStaging']} px ROI"
        proof += card(row["stagingCapture"], f"{light} · Canal Staging · {note}", world)
    extra = ""
    if key == "canal-intake-service-platform":
        extra = (
            f'<p>Canal gốc bảo toàn hiện trạng khóa B2 (<code>aperture={row["apertureVisible"]}/{row["apertureThreshold"]}</code>, '
            f'<code>INTAKE_APERTURE_OCCLUDED</code>). Revision staging riêng dời Courier (244,110) → (271,110) '
            f'lộ <code>{row["apertureStaging"]}/140</code> px ROI.</p>'
        )
    by_scene.setdefault(key, []).append(
        f'<details open><summary>{light} · {row["steps"]} bước · ZIP <code>{escape(row["zipName"])}</code> (s{row["studioRevision"]})</summary>'
        f'{extra}<div class="three">' + "".join(deck) + "</div>"
        '<details open><summary>World-only 320×208 captures (0 px diff vs Studio ZIP)</summary><div class="three">'
        + proof + "</div></details></details>"
    )
    performance.append(
        f'<tr><th scope="row">{names[key]} · {light}</th><td>{row["loadMs"]:.1f}</td><td>{row["switchMs"]:.1f}</td>'
        f'<td>{row["warmupMs"]:.1f}</td><td>{row["firstMovementFrameMs"]:.2f}</td>'
        f'<td>{row["steadyMeanMs"]:.2f}</td><td>{row["steadyP95Ms"]:.2f}</td><td>{row["steadyMaxMs"]:.2f}</td>'
        f'<td>{row["steadyFrames"]}</td><td>{row["spikesOver25ms"]}</td><td>{row["garbageCollections"]}</td><td>{row["captureMs"]:.1f}</td></tr>'
    )

sections = "".join(f'<section id="{k}"><h2>{v}</h2>{"".join(by_scene[k])}</section>' for k, v in names.items())

animation = []
for f in runtime["animation"]:
    label = f'{f["stage"]} · frame {f["frame"]} · {f["atMs"]} ms'
    if f["stage"] != "idle-return":
        label += f' · planted {f["plantedFeet"]}'
    animation.append(card(f["file"], label, world))

assert drawn == {name for name in hashes if name.endswith(".png")}, (
    f"PNG mismatch: missing={ {n for n in hashes if n.endswith('.png')} - drawn }, extra={ drawn - {n for n in hashes if n.endswith('.png')} }"
)

suite = " · ".join(f'{row["mode"]} {row["passed"]}/{row["total"]}' for row in qa["tests"])
hardware = f'{runtime["cpu"]} · {runtime["gpu"]} · {runtime["systemRamMB"]} MB RAM · {runtime["graphics"]}'
cold = (
    f'Process → Awake {runtime["startupToAwakeMs"]:.1f} ms. Awake → world đầu {runtime["awakeToSceneMs"]:.1f} ms. '
    f'Process → ảnh world đầu sau warm-up {runtime["processToFirstWorldCaptureMs"]:.1f} ms.'
)
options = "".join(f"<option>{escape(name)}</option>" for name in sorted(attachments))

markup = r"""<!doctype html>
<html lang="vi" data-view="fit"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>LumaSprite · E8.5 End-to-End Production Pipeline Acceptance</title><style>
:root{color-scheme:dark;--paper:#161e1e;--card:#23302f;--rule:#465654;--text:#f6f1de;--muted:#c0ceca;--gold:#ffd77c;--mint:#9ee6d6;--warn:#f7b267}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--text);font:16px/1.55 system-ui,sans-serif}
main{max-width:1280px;margin:auto;padding:40px 24px 80px}h1,h2,h3{font-family:Georgia,serif;line-height:1.12;margin:.35em 0}
h1{font-size:clamp(1.9rem,5vw,3.6rem)}h2{font-size:clamp(1.5rem,3.6vw,2.4rem)}
p,li{color:var(--muted);max-width:92ch}a,summary{color:var(--mint)}summary{cursor:pointer;padding:8px 0;font-weight:700}
section{margin-top:35px;padding-top:17px;border-top:1px solid var(--rule)}nav,.controls{display:flex;flex-wrap:wrap;align-items:center;gap:9px}
nav a,button,select,input,textarea{font:inherit;color:var(--text);background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:5px 10px}
nav a{text-decoration:none}button{cursor:pointer}:focus-visible{outline:2px solid var(--mint);outline-offset:3px}
.label{color:var(--gold);font-weight:700}.warn{color:var(--warn);font-weight:650}
.three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:9px 0 18px}
figure{margin:0;border:1px solid var(--rule);border-radius:8px;background:var(--card);overflow:hidden}
figcaption{padding:8px 10px;font-weight:650}small{display:block;color:var(--muted);font-size:.8rem}
.pan{overflow:auto}img{display:block;max-width:none;image-rendering:pixelated}
[data-view="fit"] img{max-width:100%;height:auto}
[data-view="x4"] .world img{width:calc(var(--w) * 4);height:calc(var(--h) * 4)}
button[aria-pressed="true"]{background:var(--gold);color:#19211e}
table{border-collapse:collapse;min-width:680px;width:100%;text-align:left;margin:10px 0}td,th{padding:7px 10px;border-bottom:1px solid var(--rule)}
details{display:block;margin-bottom:12px}pre{white-space:pre;overflow:auto}code{overflow-wrap:anywhere}
fieldset{border:1px solid var(--rule);border-radius:8px;padding:13px;min-width:0}fieldset label{display:block;margin:7px 0}
textarea{display:block;width:100%;margin:8px 0}
@media(max-width:900px){main{padding:24px 13px 58px}.three{grid-template-columns:1fr}}
</style></head><body><main>
<header><p class="label">LumaSprite Engine × Studio × Unity · E8.5</p><h1>End-to-End Production Pipeline Acceptance</h1>
<p><code>@@STATUS@@</code> · <code class="warn">PRODUCTION_RELEASE_NOT_AUTHORIZED</code> · <code class="warn">GAME_READY_ART_NOT_APPROVED</code> · <code>manualKeyboard=@@MANUAL_KEYBOARD@@</code></p>
<p>Bằng chứng nối thông thực tế không qua mock: Engine → Studio Import → Edit → Save → Human Approval → ZIP Export → Unity Import → Windows Player (<code>LumaSpriteE85.exe</code>) → RGBA &amp; Runtime Verification.</p>
<nav aria-label="Mục lục">
  <a href="#chain">Provenance &amp; ZIPs</a>
  <a href="#before-after">X=113 → X=117 → Rollback</a>
  <a href="#dynamic">Dynamic Labels &amp; Links</a>
  <a href="#mistfen-ferry-landing">Mistfen</a>
  <a href="#floodgate-maintenance-yard">Floodgate</a>
  <a href="#canal-intake-service-platform">Canal Intake</a>
  <a href="#animation">Animation</a>
  <a href="#qa">QA &amp; Performance</a>
  <a href="#owner">Owner Acceptance</a>
</nav>
<div class="controls" style="margin-top:10px">
  <button type="button" data-view-button="fit" aria-pressed="true">Vừa khung</button>
  <button type="button" data-view-button="native" aria-pressed="false">Pixel gốc 1:1</button>
  <button type="button" data-view-button="x4" aria-pressed="false">World 4× Nearest-Neighbor</button>
</div>
</header>

<section id="chain"><h2>1. Checkpoints &amp; Studio ZIP Provenance</h2>
<ul>
  <li>Engine base: <code>@@BASE@@</code> (<code>codex/e8-3-runtime-interaction-hardening</code> · Owner Manual Acceptance <code>6/6_CONFIRMED</code>)</li>
  <li>Engine E8.5 branch <code>codex/e8-5-end-to-end-integration</code> source commit: <code>@@SOURCE@@</code></li>
  <li>Studio E8.4 branch <code>antigravity/e8-4-native-scene-adapter</code> (READ-ONLY): source <code>@@STUDIO_SOURCE@@</code> · HEAD <code>@@STUDIO_HEAD@@</code></li>
  <li>Unity Runtime: <code>@@UNITY@@</code> (<code>LumaSpriteE85.exe</code> · <code>E8StudioZipImporter.cs</code> nhập <strong>@@ZIPS_COUNT@@/@@ZIPS_COUNT@@</strong> Studio ZIP, sinh <code>@@TEXTURES_COUNT@@</code> texture PNG + <code>@@MAPS_COUNT@@</code> map)</li>
  <li>Owner E8.4 Live ZIP nguyên bản: <code>@@OWNER_ZIP@@</code> (<code>@@OWNER_BYTES@@</code> bytes, SHA-256 <code>@@OWNER_SHA@@</code>, <code>studioRevision=s@@OWNER_REV@@</code>, trạng thái <code>@@OWNER_APPROVAL@@</code>, ghi chú <code>@@OWNER_NOTE@@</code>).</li>
</ul>
<div class="pan"><table>
  <thead><tr><th>Studio ZIP File</th><th>Nguồn tạo</th><th>Unity Resource Subdir</th><th>Bytes</th><th>SHA-256</th><th>Revision &amp; Approval</th><th>Spawn</th><th>Label / Linked Entity</th></tr></thead>
  <tbody>@@ZIP_ROWS@@</tbody>
</table></div>
</section>

<section id="before-after"><h2>2. So sánh Before (X=113) · Owner ZIP (X=117) · Rollback (X=113)</h2>
<p>Chứng minh thay đổi thực từ Studio đi trọn vẹn tới pixel trong Windows Player Unity: gói Owner gốc từ phiên test Studio E8.4 (Surveyor dời X=113→117) tạo khác biệt chính xác <strong>@@OWNER_DIFF@@ px</strong> so với nền B2 khóa, còn gói Studio rollback về lịch sử trước khi sửa khôi phục chính xác <strong>0 px sai khác</strong>.</p>
<div class="three">@@BEFORE_AFTER@@</div>
</section>

<section id="dynamic"><h2>3. Dynamic Interaction Label &amp; Linked Entity Verification</h2>
<p>Giải quyết contract gap E8.4: <code>E8Contract.cs</code> và <code>E8InteractionHud.cs</code> đọc <code>interactions[0].label</code> và <code>linkedEntityId</code> từ Studio ZIP khi có và giữ fallback cho legacy E8 bundle.</p>
<div class="pan"><table>
  <thead><tr><th>Scene &amp; Light</th><th>Interaction ID</th><th>Studio Label</th><th>Unity HUD Prompt</th><th>Linked Entity</th><th>Spawn</th><th>Rev</th></tr></thead>
  <tbody>@@DYNAMIC_ROWS@@</tbody>
</table></div>
</section>

@@SCENES@@

<section id="animation"><h2>4. Surveyor Idle / Walk trong Windows Player</h2>
<p><code>ANIMATION_TECHNICAL_PASS</code> · <code class="warn">ARTISTIC_MOTION_REVIEW_PENDING</code>. Chuỗi camera Unity 1× (W2 8 frame · 880 ms/loop theo rootMotion khóa, wrap về frame 0 và trở lại Idle ở cùng tọa độ <code>(149, 174)</code>).</p>
<div class="three">@@ANIMATION@@</div>
</section>

<section id="qa"><h2>5. QA Regression &amp; Windows Player Performance</h2>
<ul>
  <li>Unity Tests: <strong>@@SUITE@@</strong> (bao gồm 3 EditMode &amp; 1 PlayMode E8.5 Studio ZIP import/guard/label/round-trip tests mới).</li>
  <li>Unity Windows Player (<code>LumaSpriteE85.exe</code>): <strong>@@WORLD_PARITY@@ World RGBA exact (0 px diff)</strong>, <strong>18 HUD cue checks</strong>, Save/Load (F5/F9) giữ nguyên <code>studioRevision</code> và <code>zipSha256</code>.</li>
  <li>Engine Regression: <code>npm run lint</code> PASS · <code>npm run typecheck</code> PASS · <code>npm run build</code> PASS · <code>npm test</code> <strong>77/77 PASS</strong> (gồm <code>tests/e85-studio-pipeline.test.ts</code> kiểm ZIP integrity, protected source HTTP 409, bounds reject HTTP 400, STALE invalidation, rollback) · <code>npm run smoke</code> PASS.</li>
  <li>Lịch sử bảo toàn nguyên vẹn: <strong>805</strong> catalog SHA-256 + <code>e76r</code> + <code>e8</code> + <code>e83</code> <code>SHA256SUMS</code> khớp 100%, không chỉnh sửa báo cáo HTML E8.3 lịch sử hoặc Production Defaults.</li>
  <li>Studio Regression (READ-ONLY): <code>npm run typecheck</code> PASS · <code>npm test</code> <strong>107/107 PASS</strong> · <code>npm run test:studio-ui</code> <strong>47/47 PASS</strong>.</li>
  <li>Giới hạn tự động: <code class="warn">manualKeyboard = NOT_RUN</code> — playthrough tự động trong Player gọi cùng <code>E8World.Step</code> / <code>HandleInteractionPress</code> / Save / Reload; thao tác bàn phím vật lý của Owner và đánh giá mỹ thuật game-ready vẫn chờ Owner ký duyệt.</li>
</ul>
<h3>Hiệu năng Windows Player</h3>
<p>@@HARDWARE@@ · @@VIEW@@ · cap 60 FPS.</p>
<p>@@COLD@@</p>
<div class="pan"><table>
  <thead><tr><th>Cảnh</th><th>Load ms</th><th>Switch ms</th><th>Warm-up ms</th><th>First mov ms</th><th>Steady mean ms</th><th>p95 ms</th><th>Max ms</th><th>Mẫu</th><th>Spikes &gt;25ms</th><th>GC delta</th><th>Capture ms</th></tr></thead>
  <tbody>@@PERF@@</tbody>
</table></div>
<div class="controls"><label for="evidence">Evidence attachments</label><select id="evidence">@@OPTIONS@@</select><button id="download" type="button">Tải tệp JSON/XML</button></div>
<details><summary>SHA-256 verification manifest (@@HASH_COUNT@@ tệp)</summary><pre>@@HASHES@@</pre></details>
</section>

<section id="owner"><h2>6. Phiếu Nghiệm Thu End-to-End (Project Owner)</h2>
<p>Chạy <code>LumaSpriteE85.exe</code> hoặc kiểm chứng ảnh trực tiếp trong báo cáo này ở mức 1:1 / 4×. Xuất tệp JSON đánh giá để chốt quyết định E8.5.</p>
<form id="review"><fieldset><legend>Owner End-to-End Checklist</legend>
  <label>Người đánh giá <input name="reviewer"></label>
  <label>Ngày <input type="date" name="reviewedAt"></label>
  <div id="checks"></div>
  <label>Quyết định E8.5 <select name="decision"><option value="">Chưa chọn</option><option value="OWNER_E8_5_END_TO_END_ACCEPTED">OWNER_E8_5_END_TO_END_ACCEPTED</option><option value="NEEDS_REVISION">NEEDS_REVISION</option></select></label>
  <label>Ghi chú <textarea name="notes" rows="3"></textarea></label>
  <button id="export" type="button">Xuất E8.5 Human Review JSON</button>
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
  studioToUnityZipImport:'1. Studio ZIP (gồm gói Owner E8.4 gốc) nhập nguyên vẹn vào Unity',
  surveyorX117AndRollback:'2. Surveyor X=117 trong Player & gói Rollback khôi phục X=113',
  dynamicInteractionLabelAndLinkedEntity:'3. Dynamic interaction label + linkedEntityId hiển thị đúng trong HUD Player',
  threeSceneDayNightAndCanalStaging:'4. Cả 3 scene Day/Night + Canal staging (19/35 gốc vs 140/140 staging)',
  physicalKeyboardPlaythrough:'5. Thử phím vật lý trực tiếp trên Windows Player LumaSpriteE85.exe',
  gameReadyArtisticApproval:'6. Đánh giá mỹ thuật Game-Ready (để trống hoặc FAIL nếu chưa duyệt)'
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
  res.reviewer=data.get('reviewer').trim();res.reviewedAt=data.get('reviewedAt').trim();
  res.decision=data.get('decision').trim();res.notes=data.get('notes').trim();
  for(const key of Object.keys(res.checklist))res.checklist[key]=data.get(key)||'';
  if(res.decision)res.approvalStatus=res.decision;
  download(new Blob([JSON.stringify(res,null,2)+'\n'],{type:'application/json'}),'E8.5-HUMAN-REVIEW.json');};
</script></body></html>
"""

values = {
    "STATUS": qa["status"],
    "MANUAL_KEYBOARD": qa["manualKeyboard"]["status"],
    "BASE": qa["engineBase"],
    "SOURCE": source,
    "STUDIO_SOURCE": qa["studioSourceCommit"],
    "STUDIO_HEAD": qa["studioHead"],
    "UNITY": runtime["editor"],
    "ZIPS_COUNT": str(importer["studioZipsCount"]),
    "TEXTURES_COUNT": str(importer["texturesCount"]),
    "MAPS_COUNT": str(importer["maps"]),
    "OWNER_ZIP": escape(phase_a["zipPath"].split("/")[-1]),
    "OWNER_BYTES": str(phase_a["zipBytes"]),
    "OWNER_SHA": phase_a["zipSha256"],
    "OWNER_REV": str(phase_a["studioRevision"]),
    "OWNER_APPROVAL": escape(phase_a["approval"]["status"]),
    "OWNER_NOTE": escape(phase_a["approval"]["note"]),
    "OWNER_DIFF": str(qa["ownerStudioZip"]["diffPixelsVsX113"]),
    "ZIP_ROWS": "".join(zip_rows),
    "BEFORE_AFTER": "".join(before_after_cards),
    "DYNAMIC_ROWS": "".join(dynamic_rows),
    "SCENES": sections,
    "ANIMATION": "".join(animation),
    "SUITE": suite,
    "WORLD_PARITY": f"{qa['worldRgbaParity']['exact']}/{qa['worldRgbaParity']['total']} + {qa['worldRgbaParity']['extraVariantsExact']} variants",
    "HARDWARE": escape(hardware),
    "VIEW": f'{runtime["screenWidth"]}×{runtime["screenHeight"]}, world 320×208',
    "COLD": cold,
    "PERF": "".join(performance),
    "OPTIONS": options,
    "HASH_COUNT": str(len(hashes)),
    "HASHES": escape("\n".join(f"{value}  {key}" for key, value in sorted(hashes.items()))),
    "DATA": script("assets", attachments) + script("blank-review", blank),
}
for key, value in values.items():
    markup = markup.replace("@@" + key + "@@", value)

target = root / "docs/reports/E8.5-END-TO-END-PRODUCTION-ACCEPTANCE.html"
target.write_bytes(markup.encode("utf-8"))
print(f"{len(drawn)} actual Unity/Engine PNGs | {len(attachments)} attachments | SHA-256 {sha256(target.read_bytes()).hexdigest()}")
