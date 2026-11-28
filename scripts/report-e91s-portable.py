"""Build the portable E9.1S static review from locked native evidence."""
import argparse
import base64
import hashlib
from html import escape
import json
from pathlib import Path
import struct
import subprocess

ROOT = Path("benchmarks/results/e91s")
FIXTURES = Path("benchmarks/fixtures/e91s")
ART = Path("docs/art-quality")
OUT = Path("docs/reports/E9.1S-SEMANTIC-CHARACTER-REVIEW.html")
TITLES = ["Harbor Lockkeeper", "Marsh Apothecary", "Cliffside Lantern Keeper", "Coastal Cartographer"]
STAGES = ["S0 · B3 khóa", "S1 · Hình khối", "S2 · Khuôn mặt", "S3 · Đạo cụ"]
BLIND = [2,0,3,1]

CSS = """
:root{color-scheme:dark;--bg:#142129;--panel:#21343c;--line:#465e68;--text:#f5efe6;--muted:#c4d0d3;--mint:#b9e5cb;--amber:#fbd090}
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,sans-serif}
main{max-width:1260px;margin:auto;padding:clamp(1rem,4vw,3rem)}header{padding-bottom:1.35rem;border-bottom:1px solid var(--line)}
h1,h2,h3{line-height:1.15;margin:.4rem 0 .7rem}h1{font-size:clamp(2.2rem,6vw,4.5rem);letter-spacing:-.05em;max-width:20ch}
h2{font-size:clamp(1.45rem,3vw,2.35rem)}h3{font-size:1.06rem}p{margin:.55rem 0 1rem}.reading,header p{max-width:83ch}
small,.muted{color:var(--muted)}code{color:var(--mint);overflow-wrap:anywhere}.failed{color:var(--amber)}a{color:#c3e6fb}a,button{outline-offset:3px}
:focus-visible{outline:3px solid var(--amber);outline-offset:3px}nav,.controls,.downloads{display:flex;align-items:center;gap:.45rem .9rem;flex-wrap:wrap}
nav a,.downloads a{display:inline-flex;align-items:center;min-height:44px}.controls{position:sticky;top:0;z-index:1;padding:.65rem;background:var(--panel);border:1px solid var(--line);border-radius:.52rem}
button{background:#2e4651;color:var(--text);border:1px solid #708a93;font:inherit;min-height:44px;cursor:pointer;border-radius:.4rem;padding:.43rem .65rem}
button[aria-pressed="true"]{background:var(--mint);color:#142129}.block{padding:1.45rem 0;border-bottom:1px solid var(--line);scroll-margin-top:5.4rem}
.rail{display:flex;overflow-x:auto;gap:.55rem;padding:.3rem .15rem .7rem}.comparison{margin:.9rem 0 1.2rem}figure{margin:0;min-width:114px;flex:none;overflow:hidden;border:1px solid var(--line);border-radius:.5rem;background:var(--panel)}
figcaption{font-size:.89rem;font-weight:660;padding:.43rem .65rem;min-height:36px}.well{display:grid;place-items:center;background:#82928f;padding:.55rem;min-height:75px}
[data-bg="dark"] .well{background:#33444d}img{display:block;image-rendering:pixelated;max-width:none}summary{min-height:44px;padding:.5rem 0;color:#c3e6fb;cursor:pointer;font-weight:650}
#stats{overflow:auto}table{border-collapse:collapse;width:100%;text-align:left}th,td{padding:.55rem .65rem;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--mint)}
footer{padding-top:.9rem;color:var(--muted)}@media(max-width:535px){.controls{position:relative}.block{scroll-margin-top:1rem}}
"""

JS = """
const images = [...document.images];
const embedded = new Map(images.filter(i => i.hasAttribute('src')).map(i => [i.dataset.sha,i.src]));
for (const i of images) {
  if (!i.hasAttribute('src')) i.src = embedded.get(i.dataset.sha);
  i.dataset.w = i.getAttribute('width');
  i.dataset.h = i.getAttribute('height');
}
function active(button) {
  const next = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', next);
  return next;
}
const zoom = document.getElementById('zoom');
zoom.addEventListener('click', () => {
  const four = active(zoom);
  zoom.textContent = four ? 'Về native 1×' : 'Phóng 4× nearest';
  for (const i of images) {
    i.width = Number(i.dataset.w) * (four ? 4 : 1);
    i.height = Number(i.dataset.h) * (four ? 4 : 1);
  }
  document.getElementById('mode').textContent = four ? 'Nearest 4×' : 'Native 1×';
});
const bg = document.getElementById('bg');
bg.addEventListener('click', () => {
  const dark = active(bg);
  document.querySelector('main').dataset.bg = dark ? 'dark' : 'light';
  bg.textContent = dark ? 'Dùng nền sáng' : 'Dùng nền tối';
});
const blind = document.getElementById('blind');
blind.addEventListener('click', () => {
  const hide = active(blind);
  blind.textContent = hide ? 'Hiện phương pháp' : 'Ẩn phương pháp';
  for (const group of document.querySelectorAll('.primary .rail')) {
    const cards = [...group.querySelectorAll('figure')];
    const label = card => Number(hide ? card.dataset.order : card.dataset.stage);
    cards.sort((a,b) => label(a)-label(b));
    for (const card of cards) {
      const caption = card.firstElementChild;
      const title = hide ? 'Mẫu ' + 'ABCD'[label(card)] : card.dataset.label;
      caption.textContent = title;
      card.querySelector('img').alt = title;
      group.append(card);
    }
  }
  for (const element of document.querySelectorAll('.analysis')) element.hidden = hide;
  document.getElementById('blind-help').hidden = !hide;
});
"""

def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def uri(data,mime):
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--renderer-commit",required=True)
    revision=subprocess.check_output(["git","rev-parse",parser.parse_args().renderer_commit],text=True).strip()
    bench=read_json(ROOT/"benchmark.json")
    qa=read_json(ROOT/"technical-qa.json")
    freeze=read_json(FIXTURES/"candidate-freeze.json")
    assert digest((FIXTURES/"candidate-freeze.json").read_bytes())==bench["freeze"]
    for path,sha in freeze["source"].items():
        blob=subprocess.check_output(["git","show",revision+":"+path])
        assert digest(blob.replace(b"\r\n",b"\n"))==sha,path
    manifest=dict((line[66:],line[:64]) for line in (ROOT/"SHA256SUMS").read_text(encoding="utf8").splitlines())
    assert manifest==bench["files"]|{"benchmark.json":digest((ROOT/"benchmark.json").read_bytes())}
    embedded={}
    placements=0
    def card(case,stage,key,label,primary=False):
        nonlocal placements
        name=case["scope"]+f"/s{stage}/{key}.png"
        raw=(ROOT/name).read_bytes()
        sha=digest(raw)
        assert sha==manifest[name],name
        w,h=struct.unpack(">II",raw[16:24])
        src=f' src="{uri(raw,"image/png")}"' if sha not in embedded else ""
        embedded.setdefault(sha,name);placements+=1
        extra=f' data-stage="{stage}" data-order="{BLIND[stage]}" data-label="{escape(label)}"' if primary else ""
        return (f'<figure{extra}><figcaption>{escape(label)}</figcaption><div class="well"><img{src} '
            f'data-sha="{sha}" data-file="{escape(name)}" width="{w}" height="{h}" alt="{escape(label)}"></div></figure>')
    def rail(case,title,rows,primary=False):
        fig="".join(card(case,stage,name,label,primary) for stage,name,label in rows)
        return (f'<section class="comparison{" primary" if primary else ""}"><h3>{escape(title)}</h3>'
            f'<div class="rail" tabindex="0" aria-label="{escape(title)}">{fig}</div></section>')

    note=[
      "Vai và thân mở rộng, đầu và hàm tròn vững hơn. Vòng van có hub và thanh chéo. Ở 1× đầu van vẫn có thể đọc như đầu tay quay chung. Hai grip giữ nguyên vị trí.",
      "Mặt hẹp hơn và khăn lệch vai. Hai lọ tách rõ về chiều cao và màu, nhưng riêng silhouette vẫn khó nhận biết nghề. Số cạnh yếu Night tăng 20/368 → 23/384, p10 giữ 38.",
      "Cape rơi về sau. Quai nối từ vai tới tay xa và tạo vòng rỗng thay khối cứng. Đèn giữ nguyên pixel. Quai mảnh giảm overlap 15→11 ở tay xa, vẫn liền cổ tay. Night cải thiện p10 Δluma 33→38.",
      "Tỷ lệ vai hẹp và cổ cao. Bản đồ còn đọc như giấy gấp và compass dễ đọc thành kính lúp. S1–S3 viền chạm y=0. Grip và tiếp đất qua kiểm tra riêng, còn cổng padding thất bại.",
    ]
    cases=[]
    stats=[]
    for i,case in enumerate(bench["cases"]):
        suffix="Holdout · S0 dùng kit proxy B3" if i==3 else "Đối chứng B3 khóa · mẫu đã biết"
        main_rail=rail(case,"Sprite màu",[(j,"sprite",name) for j,name in enumerate(STAGES)],True)
        evidence=rail(case,"Silhouette và dáng bỏ mũ, tóc, đạo cụ",[
            (0,"silhouette","S0 · silhouette"),(3,"silhouette","S3 · silhouette"),
            (0,"body","S0 · không mũ/đồ"),(1,"body","S1 · không mũ/đồ")])
        evidence+=rail(case,"Trang phục và part ownership",[
            (0,"outfit","S0 · áo"),(1,"outfit","S1 · áo"),(1,"parts","S1 · part masks"),(1,"diff","Delta S0 → S1")])
        evidence+=rail(case,"Cận mặt và cổ",[(1,"face","S1 · mặt"),(2,"face","S2 · mặt"),(2,"diff","Delta S1 → S2")])
        evidence+=rail(case,"Cận tay và đạo cụ",[(2,"near","S2 · tay gần"),(3,"near","S3 · tay gần"),
                (2,"far","S2 · tay xa"),(3,"far","S3 · tay xa"),(3,"diff","Delta S2 → S3")])
        evidence+=rail(case,"Tidegate Day · 320×208",[(0,"day","S0 · Day"),(3,"day","S3 · Day")])
        evidence+=rail(case,"Tidegate Night · 320×208",[(0,"night","S0 · Night"),(3,"night","S3 · Night")])
        cases.append(f'<section id="case-{i}" class="block"><h2>{TITLES[i]}</h2><p class="muted">{suffix} · seed {case["seed"]}</p>'
            f'{main_rail}<p class="analysis reading">{note[i]}</p><details class="analysis"><summary>Mặt nạ, cảnh và cận ảnh</summary>{evidence}</details></section>')
        s0,s1,s2,s3=case["steps"]
        status="S0 đạt · S1–S3 lỗi padding" if i==3 else "S0–S3 đạt"
        stats.append(f'<tr><th scope="row">{TITLES[i]}</th><td>{s0["shape"]["torso"]["width"]}→{s1["shape"]["torso"]["width"]} px</td>'
            f'<td>{s0["shape"]["head"]["width"]}→{s1["shape"]["head"]["width"]} px</td><td>{s2["delta"]["colors"]} đổi màu · 0 alpha</td>'
            f'<td>{s3["delta"]["added"]} thêm / {s3["delta"]["removed"]} bỏ / {s3["delta"]["colors"]} đổi màu</td><td>{status}</td></tr>')
    downloads=[]
    for path,label in [(ROOT/"human-review.json","Tải phiếu duyệt JSON trống"),(ROOT/"SHA256SUMS","Manifest SHA-256 PNG"),
        (ROOT/"technical-qa.json","QA và chẩn đoán"),(ROOT/"benchmark.json","Benchmark từng bước"),
        (FIXTURES/"study.json","Brief, seed và rubric"),(FIXTURES/"candidate-freeze.json","Khóa trước lần sinh đủ bộ ảnh"),
        (ART/"art-quality-rubric-v2-static-addendum.md","Rubric v2 Static Addendum")]:
        downloads.append(f'<a download="{escape(path.name)}" href="{uri(path.read_bytes(),"application/octet-stream")}">{escape(label)}</a>')
    doc=f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'">
<title>E9.1S · Semantic Character Review</title><style>{CSS}</style></head>
<body><main>
<header><small>LumaSprite Engine · E9.1S</small><h1>Semantic Character Review</h1>
<p><code class="failed">{bench["status"]}</code></p>
<p>Ba mẫu đã biết qua kỹ thuật. Coastal Cartographer chạm lề trên ở S1–S3. Gallery giữ nguyên kết quả đã khóa, gồm cả thất bại holdout. Mỹ thuật ở <code>STATIC_ART_REVIEW_PENDING</code>.</p>
<nav aria-label="Mục lục"><a href="#case-0">Harbor</a><a href="#case-1">Marsh</a><a href="#case-2">Cliffside</a><a href="#case-3">Cartographer</a><a href="#review">QA và phiếu duyệt</a></nav></header>
<p class="muted">Xem native 1× trước. Dùng 4× nearest để kiểm cụm pixel. Có thể cuộn ngang trong mỗi nhóm ảnh.</p>
<div class="controls" aria-label="Hiển thị">
<button id="zoom" aria-pressed="false">Phóng 4× nearest</button>
<button id="bg" aria-pressed="false">Dùng nền tối</button>
<button id="blind" aria-pressed="false">Ẩn phương pháp</button><span id="mode" aria-live="polite">Native 1×</span>
</div><p id="blind-help" hidden>Ghi mã Mẫu trước khi hiện lại tên S0–S3 để điền phiếu.</p>
<article class="analysis reading">
<h2>Đối chứng và giả thuyết</h2>
<p><strong>S0</strong> là B3 E9.1R đã khóa, khớp PNG ở ba mẫu đã biết. <strong>S1</strong> kiểm tỷ lệ vai, eo, đầu, cổ và hình áo với tay, đạo cụ, chân giữ nguyên.
<strong>S2</strong> kiểm mảng chân mày, gò má, mũi và hàm, giữ geometry S1. <strong>S3</strong> sửa trục van, rack lọ, quai vai, compass và bản đồ tại socket hiện hành. Màu trong các ảnh delta dùng xanh lá cho thêm pixel, hồng cho bỏ, vàng cho tô lại.</p>
<p><strong>ASSISTANT_REVIEW_RECOMMENDATION.</strong> E9.1R Engineering <code>APPROVED</code> theo QA, Costume-Aware Stance <code>APPROVED_FOR_RESEARCH</code>, B3 <code>SELECTED_AS_RND_BASELINE</code> và B4 <code>NOT_SELECTED</code>. Harbor, Marsh và Cliffside đều <code>ART_REVISION_REQUIRED</code>. Game-Ready <code>NOT APPROVED</code>, E9.2 <code>NOT AUTHORIZED</code>. Phiếu E9.1R vẫn trống.</p>
</article>
{"".join(cases)}
<section id="review" class="block">
<h2>QA và phiếu Owner</h2>
<div id="stats" class="analysis"><table><thead><tr><th>Mẫu</th><th>Torso S0→S1</th><th>Đầu S0→S1</th><th>S2</th><th>S3</th><th>Cổng kỹ thuật</th></tr></thead>
<tbody>{"".join(stats)}</tbody></table></div>
<div class="analysis reading">
<p>Holdout 73763 qua hai lần từ chối fixture trước khi sinh đủ bộ ảnh, do đoạn wrist–palm ngắn hơn 2 px rồi do mũ vượt vùng raw. Cả hai khóa cũ được giữ. Wrist xa được dời 1 px và hông hạ 1 px trước lần chạy đủ ảnh, giữ seed, tâm palm, tiêu chí và code. Sau khi ảnh xuất ra, phần mũ raw bắt đầu ở y=1 và viền cardinal chạm y=0. S0 có lề y=2. Chẩn đoán độc lập xác minh 7 hàng khoảng âm, điểm tiếp đất y=57 và grip liền, còn padding y≥1 thất bại.</p>
<p>Lint, typecheck, build, smoke và 81/81 test đạt. {qa["historical"]} SHA lịch sử, E9.0/E9.1/E9.1R giữ nguyên, {qa["rebuilt"]} tệp E9.1S tái lập đúng byte và {len(qa["studio"]["samples"])} PNG giữ nguyên RGBA qua Studio. {qa["staticScenes"]} cảnh Tidegate giữ anchor và collider, 320×208 ở 32 PPU. Unity runtime <code>NOT_RUN</code>.</p>
<p>{len(embedded)} PNG native khác nhau cho {placements} vị trí ảnh. Báo cáo dùng một dữ liệu PNG cho mỗi SHA và 4× nearest khi hiển thị.</p>
<p>Source E9.1S <code>{revision}</code><br>E9.1R HEAD <code>{bench["base"]}</code><br>E9.1R renderer <code>{bench["baselineSource"]}</code><br>Freeze <code>{bench["freeze"]}</code>.</p>
</div>
<p class="reading">Ở 1×, chấm riêng silhouette, functional identity, anatomy, khuôn mặt, grip, cụm pixel, vật liệu, style và gameplay readability. Chọn S0–S3, Neither hoặc yêu cầu sửa. Ghi vị trí pixel cho từng Critical Defect. Quyết định mỹ thuật thuộc Owner.</p>
<p class="reading">Đề xuất dừng mở rộng kiến trúc. E9.2 chưa được ủy quyền. Nếu có vòng tiếp theo, kiểm lề headwear và outline trên brief mới trước khi xem xét triển khai animation.</p>
<div class="downloads">{"".join(downloads)}</div></section>
<footer>LumaSprite Engine · ảnh gốc 64×64, three-quarter-right, weathered-station-v1</footer>
</main><script>{JS}</script></body></html>"""
    OUT.write_text(doc,encoding="utf8",newline="\n")
    print(json.dumps({"path":OUT.as_posix(),"embedded":len(embedded),"placements":placements,
                      "bytes":OUT.stat().st_size,"sha256":digest(OUT.read_bytes())}))

if __name__=="__main__":
    main()
