from argparse import ArgumentParser
from base64 import b64encode
from hashlib import sha256
from html import escape
from pathlib import Path
from struct import unpack
import json

ROOT = Path("benchmarks/results/e101")
OUT = Path("docs/reports/E10.1-ART-REFERENCE-REVIEW.html")
parser = ArgumentParser()
parser.add_argument("--evidence-commit", required=True)
args = parser.parse_args()
assert len(bytes.fromhex(args.evidence_commit)) == 20

def load(path):
    return json.loads((ROOT / path).read_bytes())

def payload_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")

def facts(value):
    return "<pre>" + escape(json.dumps(value, ensure_ascii=False, indent=2)) + "</pre>"

def reveal(label, content):
    return "<details><summary>" + escape(label) + "</summary>" + content + "</details>"

pack = load("reference-pack.json")
benchmark = load("workflow-proof.json")
qa = load("technical-qa.json")
decision = load("human-review.json")
assert qa["gate"] == "E10_1_READY_FOR_OWNER_ART_REFERENCE_REVIEW"
assert decision["signature"] is None and decision["selectedPilot"] is None
images, extents = {}, {}

def picture(path, expected, caption):
    raw = path.read_bytes()
    digest = sha256(raw).hexdigest()
    assert digest == expected and raw[:8] == b"\x89PNG\r\n\x1a\n", path
    w, h = unpack(">II", raw[16:24])
    images.setdefault(digest, "data:image/png;base64," + b64encode(raw).decode("ascii"))
    extents[digest] = [w,h]
    safe = escape(caption)
    return (f'<figure><div class="canvas" tabindex="0" aria-label="{safe}">'
            f'<img data-digest="{digest}" width="{w}" height="{h}" alt="{safe}"></div>'
            f'<figcaption>{safe}</figcaption></figure>')

def ref_image(key, label):
    record = rows[key]
    return picture(Path(record["pngPath"]), record["pngSha256"], label)

def proof_image(key, label):
    path = f"proof/{key}.png"
    return picture(ROOT / path, benchmark["files"][path], label)

rows = {r["id"]:r for r in pack["candidates"]}
pilot = [
    ("kiln-silhouette","Ceramic Kiln Warden","Thân thấp, tấm chắn nhiệt hình thang và kìm lệch vai.",
     "Đất nung và men hổ phách. Mày hạ một bên, chú ý trục kìm–cổ tay khi pha dáng."),
    ("kite-silhouette","Canopy Kite Rigger","Dáng cao, vạt buồm chéo và ống cuộn gọn.",
     "Xanh ngọc pha mận. Giữ khoảng âm dưới vạt và đường kéo dây qua bàn tay."),
    ("seed-silhouette","Seed Archive Registrar","Mantle ngang, gấu bậc và khay ba ngăn thấp.",
     "Xanh rêu và kem. Tay đỡ khay phải đọc ở 1× và vẫn có điểm tựa cho pose sau này."),
]
briefs = ""
for id,title,shape,note in pilot:
    briefs += f'<article class="card brief"><h3>{title}</h3>{ref_image(id,"Silhouette · "+title)}'
    briefs += f"<p><strong>{shape}</strong> {note}</p>"
    briefs += reveal("Nguồn silhouette và SHA-256",facts(rows[id])) + "</article>"

groups = {
    "head-and-face":"Đầu và khuôn mặt","body-proportions":"Tỷ lệ","outfit-and-garment":"Trang phục",
    "material-clusters":"Cụm vật liệu","pixel-shading":"Sắc độ","equipment":"Dụng cụ",
    "hand-grip":"Tay nắm","outline-hierarchy":"Phân cấp viền",
}
studies = ""
for r in pack["candidates"]:
    if r["group"] == "overall-silhouette":
        continue
    studies += f'<article class="card"><h3>{groups[r["group"]]}</h3>'
    studies += ref_image(r["id"],r["title"])
    studies += "<p>" + escape(r["intendedUse"]) + "</p>"
    studies += "<ul>" + "".join("<li>"+escape(x)+"</li>" for x in r["proposedFeatures"]) + "</ul>"
    studies += reveal("Nguồn, quyền dùng và giới hạn",facts(r)) + "</article>"
diagnostics = ""
for r in pack["diagnostics"]:
    diagnostics += '<article class="card"><h3>' + escape(r["id"]) + '</h3>'
    diagnostics += picture(Path(r["pngPath"]),r["pngSha256"],r["intendedUse"])
    diagnostics += reveal("Ghi chú nguồn chẩn đoán",facts(r)) + "</article>"

review = b64encode((ROOT / "human-review.json").read_bytes()).decode("ascii")
measure = qa["proof"]
style = """
:root{
  color-scheme:light;--page:#f6f1e6;--paper:#fffcf5;--text:#26313b;--muted:#5a6370;--line:#d6c9b3;
  --accent:#8b472d;--canvas:#ebe1ce;--focus:#99522d;--night:#282f3b;
}
*{box-sizing:border-box}
html{scroll-padding-top:78px}
body{margin:0;background:var(--page);color:var(--text);font:16px/1.55 system-ui,"Segoe UI",sans-serif}
main{max-width:1152px;margin:auto;padding:clamp(14px,3vw,40px)}
header{max-width:78ch;padding:20px 0}
h1,h2,h3,p{margin:0 0 .55em}
h1{font:700 clamp(2.65rem,7.5vw,5rem)/.99 Georgia,serif;letter-spacing:-.045em;text-wrap:balance}
h2{font:700 clamp(1.8rem,4.4vw,2.75rem)/1.12 Georgia,serif;letter-spacing:-.022em}
h3{font-size:1.05rem}
.lead{margin-top:14px;font-size:1.12rem}
.muted,figcaption{color:var(--muted)}
.status{display:inline-block;color:var(--accent);font:600 .83em ui-monospace,Consolas,monospace;overflow-wrap:anywhere}
nav,.tools{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
nav{margin:10px 0 18px}
a{color:var(--accent);text-underline-offset:4px}
nav a{display:inline-flex;align-items:center;min-height:44px}
.tools{position:sticky;top:0;z-index:2;padding:8px 0;background:var(--page);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
button,.download{padding:0 14px;min-height:44px;border-radius:5px;border:1px solid var(--line);font:600 1rem system-ui,sans-serif}
button{background:var(--paper);color:var(--text);cursor:pointer}
button[aria-pressed=true],.download{background:var(--text);color:var(--paper);border-color:var(--text)}
.download{display:inline-flex;align-items:center;text-decoration:none}
section{padding:26px 0;border-bottom:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:14px 0}
.two{grid-template-columns:repeat(2,minmax(0,1fr))}
.card,figure{min-width:0}
.card{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:12px}
figure{margin:0;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:var(--paper)}
.canvas{display:grid;grid-template-columns:max-content;justify-content:safe center;align-items:center;min-height:96px;overflow:auto;padding:12px;background:var(--canvas)}
body[data-background="night"] .canvas{background:var(--night)}
img{display:block;width:calc(var(--w)*1px);height:calc(var(--h)*1px);image-rendering:pixelated}
body[data-zoom="4"] img{width:calc(var(--w)*4px);height:calc(var(--h)*4px)}
figcaption{padding:7px 10px;font-size:.88rem}
.card p,.card ul{margin-top:.65em}
.card ul{padding-left:1.1em}
details{margin:8px 0}
summary{min-height:44px;padding:.58em 0;color:var(--accent);cursor:pointer;font-weight:650}
pre{padding:9px;background:var(--page);border:1px solid var(--line);border-radius:5px;white-space:pre-wrap;overflow-wrap:anywhere;overflow:auto;max-height:26rem}
:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.canvas:focus-visible{outline-offset:-4px}
@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:565px){.grid:not(.two){grid-template-columns:minmax(0,1fr)}.tools{gap:7px}.tools span{display:none}}
"""
script = """
const registry=JSON.parse(document.getElementById('pngs').textContent);
const sizes=JSON.parse(document.getElementById('extents').textContent);
for(const img of document.querySelectorAll('img[data-digest]')){
 const digest=img.dataset.digest;
 img.style.setProperty('--w',sizes[digest][0]);
 img.style.setProperty('--h',sizes[digest][1]);
 img.src=registry[digest];
}
for(const button of document.querySelectorAll('[data-scale]')){
 button.addEventListener('click',()=>{
  document.body.dataset.zoom=button.dataset.scale;
  for(const option of document.querySelectorAll('[data-scale]')) option.setAttribute('aria-pressed',String(option===button));
 });
}
const backdrop=document.querySelector('#backdrop');
backdrop.addEventListener('click',()=>{
 const night=document.body.dataset.background!=='night';
 document.body.dataset.background=night?'night':'day';
 backdrop.setAttribute('aria-pressed',String(night));
});
"""
proof_pair = proof_image("preview-r1","r1 · Source gốc") + proof_image("preview-r2","r2 · Sửa mặt cuff")
proof_masks = proof_image("ownership","Mask ownership") + proof_image("allowed-mask","Vùng cho phép")
proof_inputs = (
    proof_image("input-r1","PNG được nhập") + proof_image("anchor-preview","Grip xanh · wrist vàng") +
    proof_image("export-r2","PNG được xuất") + proof_image("diff","Pixel đổi")
)
info={"Engine checkpoint":qa["checkpoint"],"Evidence commit":args.evidence_commit,"Studio revision":qa["studio"]["revision"],
      "Source SHA-256":benchmark["source"]["sha256"],"Manifest retained E9":qa["protectedE9"]}
body = f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>LumaSprite E10.1 · Art Reference Review</title><style>{style}</style></head>
<body data-zoom="1" data-background="day"><main>
<header><p class="muted">LumaSprite Engine · E10.1</p><h1>Art Reference Review</h1>
<p class="status">{qa['gate']}</p>
<p class="lead">So ba silhouette ở 1×, chọn một brief và ghi những đặc điểm được phép dùng trong Reference Pack. Toàn bộ nghiên cứu mới đang chờ Owner duyệt.</p>
<nav aria-label="Mục lục"><a href="#briefs">Ba brief</a><a href="#pack">Reference Pack</a><a href="#proof">Proof</a><a href="#review">Phiếu duyệt</a></nav></header>
<div class="tools" aria-label="Chế độ xem"><span>Tỷ lệ và nền</span><button type="button" data-scale="1" aria-pressed="true">Native 1×</button>
<button type="button" data-scale="4" aria-pressed="false">Nearest 4×</button><button type="button" id="backdrop" aria-pressed="false">Nền tối</button></div>
<noscript><p>Bật JavaScript cục bộ để xem PNG nhúng.</p></noscript>
<section id="briefs"><h2>Ba brief pilot</h2>
<p>Cùng canvas 64 × 64, góc three-quarter-right, pivot (32, 58) và ánh sáng upper-left. Các ảnh bên dưới là phác khối dáng.</p>
<div class="grid">{briefs}</div></section>
<section id="pack"><h2>Reference Pack v1</h2>
<p>11 plate gốc cho 9 nhóm, gồm ba silhouette ở trên. Mỗi plate có mục đích, SHA-256 và nguồn polygon chỉnh được. Các nghiên cứu do Codex tạo cho duyệt nội bộ E10.1. Quyền cho production chờ Owner xác nhận.</p>
<div class="grid">{studies}</div>
{reveal("Chín ảnh E9.H1R · chỉ dùng chẩn đoán",'<div class="grid">'+diagnostics+'</div>')}
</section>
<section id="proof"><h2>Proof trên một component tay DRAFT</h2>
<p>Đọc PNG cùng ownership mask. Khớp grip vào cán. Sửa sắc độ cuff trên bản sao, liên kết về r1 rồi xuất r2. {measure['changed']} pixel đổi trong vùng cho phép, {measure['outside']} pixel ngoài vùng. Bốn PNG qua Studio import, lưu và export giữ đúng RGBA.</p>
<div class="grid two">{proof_pair}</div>
{reveal("Mask, anchors, bản xuất và SHA-256", '<div class="grid two">'+proof_masks+proof_inputs+'</div>'+facts(measure))}
<p class="muted">Proof đạt TECHNICAL_VALID. STATIC_ART_APPROVED và GAME_READY thuộc các cổng riêng do Owner duyệt.</p>
{reveal("QA và Git source",facts(qa)+facts(info))}
</section>
<section id="review"><h2>Phiếu Owner</h2>
<p>Ghi brief được chọn, reference được dùng, đặc điểm được duyệt và quyền sử dụng. Kiến trúc Option B vẫn là đề xuất. E10.2 cần quyết định riêng sau vòng duyệt này.</p>
<p><a class="download" download="E10.1-OWNER-REVIEW.json" href="data:application/json;base64,{review}">Tải phiếu JSON trống</a></p></section>
</main>
<script id="pngs" type="application/json">{payload_json(images)}</script>
<script id="extents" type="application/json">{payload_json(extents)}</script>
<script>{script}</script></body></html>
"""
OUT.write_text(body, encoding="utf-8", newline="\n")
print(json.dumps({"html":OUT.as_posix(),"sha256":sha256(OUT.read_bytes()).hexdigest(),
                  "bytes":len(OUT.read_bytes()),"payloads":len(images),"placements":body.count("<img ")}))
