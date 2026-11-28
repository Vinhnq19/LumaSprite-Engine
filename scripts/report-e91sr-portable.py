"""Create the single E9.1S-R review from published PNGs and frozen E9.1S controls."""
import argparse
import base64
import hashlib
from html import escape
import json
from pathlib import Path
import struct
import subprocess

ROOT=Path("benchmarks/results")
SR=ROOT/"e91sr"
FIX=Path("benchmarks/fixtures/e91sr")
OUT=Path("docs/reports/E9.1S-R-FINAL-CHARACTER-REVIEW.html")
TITLES=["Harbor Lockkeeper","Marsh Apothecary","Cliffside Lantern Keeper","Coastal Cartographer","Highland Weather Observer"]
NAMES=["S0 · B3 control","S1 · Dáng","S2 · Mặt","S3 · Đạo cụ"]
CHOICES=[("S2","Night Δluma p10 33 ở S2 và 23 ở S3. Vòng van S3 có trục rõ ở zoom, song 1× Night dễ lẫn vào nền hơn."),
         ("S3","Hai lọ khác chiều cao và màu nên dễ đọc hơn. Night Δluma p10 giữ 38, số cạnh yếu tăng từ 22/386 đến 23/384."),
         ("S3","Quai nối vai với tay rõ hơn và đèn khớp từng pixel S2. Night Δluma p10 tăng 33→38."),
         ("S3-R","Thân gọn, dụng cụ và bản đồ hỗ trợ nhận diện. Compass còn giống kính lúp, bản đồ có thể đọc như giấy gấp."),
         ("S3-R","Mũ cao và áo ngắn tạo dáng riêng. Hai cốc của dụng cụ gió vẫn dễ đọc như thanh chữ T ở 1×.")]

CSS="""
:root{color-scheme:dark;--bg:#14222a;--panel:#21343d;--line:#455d67;--text:#f5efe8;--muted:#bfcdcf;--mint:#b0e2c9;--amber:#ffce8d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,sans-serif}main{max-width:1260px;margin:auto;padding:clamp(1rem,4vw,3rem)}
header{padding:0 0 1.4rem;border-bottom:1px solid var(--line)}h1,h2,h3{line-height:1.14;margin:.42rem 0 .65rem}h1{font-size:clamp(2.1rem,6vw,4.45rem);letter-spacing:-.05em;max-width:19ch}h2{font-size:clamp(1.45rem,3vw,2.35rem)}h3{font-size:1.07rem}
header p,.reading{max-width:83ch}p{margin:.55rem 0 .9rem}small,.muted{color:var(--muted)}code{color:var(--mint);overflow-wrap:anywhere}
a{color:#c3e8fc}a,button{outline-offset:3px}:focus-visible{outline:3px solid var(--amber);outline-offset:3px}
nav,.controls,.downloads{display:flex;align-items:center;flex-wrap:wrap;gap:.45rem .9rem}nav a,.downloads a{display:inline-flex;align-items:center;min-height:44px}
.controls{position:sticky;top:0;z-index:1;padding:.6rem;background:var(--panel);border:1px solid var(--line);border-radius:.5rem}
button{background:#2b4450;color:var(--text);border:1px solid #70888f;border-radius:.38rem;font:inherit;cursor:pointer;min-height:44px;padding:.4rem .65rem}
button[aria-pressed="true"]{background:var(--mint);color:#15242a}section.block{padding:1.45rem 0;border-bottom:1px solid var(--line);scroll-margin-top:5.3rem}
.comparison{margin:.85rem 0 1.1rem}.rail{display:flex;overflow-x:auto;gap:.5rem;padding:.25rem .12rem .65rem}figure{margin:0;min-width:112px;flex:none;border:1px solid var(--line);border-radius:.44rem;overflow:hidden;background:var(--panel)}
figcaption{padding:.45rem .65rem;font-size:.88rem;font-weight:650;min-height:37px}.well{background:#788987;padding:.48rem;display:grid;place-items:center;min-height:78px}
[data-bg="dark"] .well{background:#30434d}img{display:block;image-rendering:pixelated;max-width:none}summary{color:#c3e8fc;cursor:pointer;padding:.6rem 0;min-height:44px}
.table{overflow:auto}table{width:100%;text-align:left;border-collapse:collapse}th,td{border-bottom:1px solid var(--line);padding:.45rem .6rem;vertical-align:top}th{color:var(--mint)}
footer{padding-top:1rem;color:var(--muted)}@media(max-width:520px){.controls{position:relative}.block{scroll-margin-top:1rem}}
"""

JS="""
const images=[...document.images];
const sources=new Map(images.filter(i=>i.hasAttribute('src')).map(i=>[i.dataset.sha,i.src]));
for(const image of images){
  if(!image.hasAttribute('src'))image.src=sources.get(image.dataset.sha);
  image.dataset.w=image.getAttribute('width');
  image.dataset.h=image.getAttribute('height');
}
const zoom=document.getElementById('zoom');
zoom.addEventListener('click',()=>{
  const four=zoom.getAttribute('aria-pressed')!=='true';
  zoom.setAttribute('aria-pressed',four);
  zoom.textContent=four?'Về native 1×':'Phóng 4× nearest';
  for(const image of images){
    image.width=Number(image.dataset.w)*(four?4:1);
    image.height=Number(image.dataset.h)*(four?4:1);
  }
  document.getElementById('scale').textContent=four?'Nearest 4×':'Native 1×';
});
const bg=document.getElementById('background');
bg.addEventListener('click',()=>{
  const dark=bg.getAttribute('aria-pressed')!=='true';
  bg.setAttribute('aria-pressed',dark);
  bg.textContent=dark?'Dùng nền sáng':'Dùng nền tối';
  document.querySelector('main').dataset.bg=dark?'dark':'light';
});
"""

def load(p):
    return json.loads(p.read_text(encoding="utf8"))

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def uri(raw,mime):
    return f"data:{mime};base64,"+base64.b64encode(raw).decode("ascii")

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fix-commit",required=True)
    revision=subprocess.check_output(["git","rev-parse",parser.parse_args().fix_commit],text=True).strip()
    bench,qa=load(SR/"benchmark.json"),load(SR/"technical-qa.json")
    decision=load(SR/"art-recommendation.json")
    freeze=load(FIX/"candidate-freeze.json")
    assert digest((FIX/"candidate-freeze.json").read_bytes())==bench["freeze"]
    for p,h in freeze["sources"].items():
        assert digest(Path(p).read_bytes().replace(b"\r\n",b"\n"))==h,p
    path="src/experiments/character-headwear-fit.ts"
    source=subprocess.check_output(["git","show",revision+":"+path])
    assert digest(source.replace(b"\r\n",b"\n"))==freeze["sources"][path]
    lookup={"e91sr":bench["files"],"e91s":load(ROOT/"e91s/benchmark.json")["files"]}
    assets={}
    placements=0
    def image(milestone,name,label):
        nonlocal placements
        raw=(ROOT/milestone/name).read_bytes()
        key=digest(raw)
        assert key==lookup[milestone][name],name
        w,h=struct.unpack(">II",raw[16:24])
        src=f' src="{uri(raw,"image/png")}"' if key not in assets else ""
        assets.setdefault(key,name)
        placements+=1
        return (f'<figure><figcaption>{escape(label)}</figcaption><div class="well">'
                f'<img{src} data-sha="{key}" data-file="{milestone}/{escape(name)}" width="{w}" height="{h}" alt="{escape(label)}"></div></figure>')
    def rail(label,items):
        return (f'<section class="comparison"><h3>{escape(label)}</h3><div class="rail" tabindex="0" aria-label="{escape(label)}">'
                +"".join(image(*item) for item in items)+"</div></section>")
    def images(variant,pairs):
        return [(variant["milestone"],variant["folder"]+"/"+key+".png",label) for key,label in pairs]
    def download(path,label):
        return f'<a download="{escape(path.name)}" href="{uri(path.read_bytes(),"application/octet-stream")}">{escape(label)}</a>'

    cards=[]
    stats=[]
    art=[]
    for i,case in enumerate(bench["cases"]):
        s0,s1,s2,s3=case["variants"]
        label="Holdout mới" if i==4 else "Diagnostic" if i==3 else "Mẫu đã biết · PNG khớp E9.1S"
        final_label="S3-R" if i>=3 else "S3"
        strips=rail("Ảnh 64×64 · S0–S3",sum((images(v,[("sprite",name+(" · mũ đã fit" if i>=3 and j>0 else ""))])
                   for j,(v,name) in enumerate(zip(case["variants"],NAMES))),[]))
        if i<3:
            a,b=s2,s3
            before,after="S2","S3"
        else:
            a,b=s0,s3
            before,after="S0","S3-R"
        strips+=rail("Cặp đề xuất cho Owner",images(a,[("sprite",before)])+images(b,[("sprite",after)]))
        evidence=rail("Full silhouette và dáng bỏ mũ, tóc, đồ nghề",
            images(a,[("silhouette",before+" · full"),("body",before+" · bỏ mũ/đồ")])
            +images(b,[("silhouette",after+" · full"),("body",after+" · bỏ mũ/đồ")]))
        evidence+=rail("Mặt và điểm tiếp xúc dụng cụ",
            images(a,[("face",before+" · mặt"),("near",before+" · tay gần"),("far",before+" · tay xa")])
            +images(b,[("face",after+" · mặt"),("near",after+" · tay gần"),("far",after+" · tay xa")]))
        for light in ["day","night"]:
            evidence+=rail("Tidegate "+light.title()+" · 320×208",images(a,[(light,before+" · "+light.title())])
                          +images(b,[(light,after+" · "+light.title())]))
        if i==3:
            evidence+=rail("S0–S3 gốc · PNG E9.1S đã khóa",[("e91s",case["scope"]+f"/s{j}/sprite.png",name) for j,name in enumerate(NAMES)])
            evidence+=rail("S3 gốc → S3-R · chỉ dịch mặt nạ mũ",[
                ("e91s",case["scope"]+"/s3/sprite.png","E9.1S S3 · y=0"),
                *images(s3,[("sprite","E9.1S-R S3 · y=1"),("diff","Delta phạm vi mũ"),("parts","Part ownership")])])
            keys=[("skull","đầu trần"),("headwear","mũ raw"),("skull-and-headwear","đầu và mũ"),("outline","sau viền")]
            for branch,label_ in [("before","Trước sửa"),("after","Sau sửa")]:
                evidence+=rail(label_+" · từng bước lắp ráp",[
                    ("e91sr",case["scope"]+"/"+branch+"/"+key+".png",name) for key,name in keys])
        elif i==4:
            evidence+=rail("Headwear holdout · skull → raw cap → hợp → viền",[
                ("e91sr",case["scope"]+"/after/"+key+".png",caption)
                for key,caption in [("skull","Đầu trần"),("headwear","Mũ raw"),("skull-and-headwear","Đầu và mũ"),("outline","Sau viền")]])
        recommended,note=CHOICES[i]
        assert decision["candidateOptions"][i]["recommended"]==recommended
        cards.append(f'<section id="case-{i}" class="block"><h2>{TITLES[i]}</h2>'
                     f'<p class="muted">{label} · seed {case["seed"]}</p>{strips}'
                     f'<p class="reading">Khuyến nghị {recommended}. {note}</p>'
                     f'<details><summary>Silhouette, mặt, grip và cảnh</summary>{evidence}</details></section>')
        used=s3["qa"]
        stats.append(f'<tr><th>{TITLES[i]}</th><td>{s0["qa"]["bounds"]["top"]} / {used["bounds"]["top"]}</td>'
                     f'<td>{s3["stance"]["visibleGapRows"]}</td>'
                     f'<td>{"/".join(str(next(h["overlap"] for h in used["handTests"] if h["hand"]==side+"-hand")) for side in ["near","far"])}</td>'
                     f'<td>{used["bounds"]["bottom"]} · (32,58)</td><td>{final_label} · {"PASS" if not case["errors"] else "FAIL"}</td></tr>')
        art.append(f'<tr><th>{TITLES[i]}</th><td>{before} / {after}</td><td>{recommended}</td><td>{note}</td></tr>')
    docs="".join(download(path,label) for path,label in [
        (SR/"human-review.json","Phiếu Owner JSON trống"),(SR/"art-recommendation.json","Khuyến nghị Option B"),
        (SR/"technical-qa.json","Technical QA"),(SR/"SHA256SUMS","Manifest E9.1S-R"),
        (ROOT/"e91s/SHA256SUMS","Manifest ảnh gốc E9.1S"),(SR/"benchmark.json","Bounds và từng cảnh"),
        (FIX/"study.json","Brief, seed và rubric khóa"),(FIX/"first-render-freeze.json","Khóa trước lần Highland đầu"),
        (FIX/"type-only-replay-proof.json","Chứng cứ replay sau chú thích kiểu"),
        (Path("docs/art-quality/art-quality-rubric-v2-static-addendum.md"),"Rubric v2 Static Addendum")])
    doc=f"""<!doctype html><html lang="vi"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'">
<title>E9.1S-R · Final Character Review</title><style>{CSS}</style></head><body><main>
<header><small>LumaSprite Engine · E9.1S-R</small><h1>Final Character Review</h1>
<p><code>{bench["status"]}</code></p>
<p>Cartographer và Highland đạt lề 1 px. Ba mẫu Harbor, Marsh và Cliffside giữ nguyên PNG đã khóa. Khuyến nghị Option B, giữ các thành phần có giá trị và chọn phương án theo từng nhân vật. Mỹ thuật chờ Owner.</p>
<nav aria-label="Mục lục"><a href="#bounds">Lỗi và bản sửa</a><a href="#case-0">Ba mẫu đã biết</a><a href="#case-3">Cartographer</a><a href="#case-4">Highland</a><a href="#decision">Kết quả duyệt</a></nav></header>
<p class="muted">Duyệt ở native 1×. Dùng 4× nearest-neighbor để soi cụm pixel. Cuộn ngang trong từng hàng nếu cần.</p>
<div class="controls" aria-label="Hiển thị">
<button id="zoom" aria-pressed="false">Phóng 4× nearest</button>
<button id="background" aria-pressed="false">Dùng nền tối</button><span id="scale" aria-live="polite">Native 1×</span>
</div>
<section id="bounds" class="block reading"><h2>Lỗi lề trên và bản sửa</h2>
<p>E9.1S S0 đạt tại y=2. Trong S1, pose đầu đưa mũ Cartographer lên y=1. Đầu trần bắt đầu y=5. Khi ghép, mũ quyết định top của union. Viền cardinal thêm một pixel ở y=0 và final kế thừa pixel đó. S2 và S3 giữ cùng hình học đầu, nên cùng trượt cổng y≥1.</p>
<p>Bản sửa giữ trước 2 px cho raw headwear, gồm một pixel lề và một pixel viền. Bước fit chọn dịch chuyển nguyên nhỏ nhất cho mask mũ, kiểm mũ vẫn chồng lên đầu rồi dựng lại bằng renderer cũ. Cartographer raw y=1→2, outline và final y=0→1. Đầu trần, cổ, chân, tay, đạo cụ, pivot (32,58) và 7 hàng khoảng hở giữ nguyên. Kiểm cả RGBA, labels và vật liệu ngoài vùng mũ cộng viền. Nếu vượt kích thước hoặc mất tiếp xúc hợp lệ, kết quả là <code>HEADWEAR_CANNOT_FIT_WITHOUT_DESIGN_CHANGE</code>.</p>
<p>Highland 86327 có crown cao và thân áo ngắn, giữ nguyên brief, pose, palette và rubric từ khóa trước lần render. Quy tắc cũng điều chỉnh mũ Highland 1 px, đưa raw về y=2 và final y=1. S3-R kết hợp dụng cụ gió thử nghiệm quanh socket tay gần với quai vai sẵn có. S0 dùng kit proxy B3 nên so sánh này có cả khác biệt trang bị. Khóa lần đầu được giữ. Sau khi thêm chú thích kiểu TypeScript cho benchmark, replay đối chiếu đủ {qa["firstHoldoutPngsUnchanged"]} SHA PNG khớp lần đầu.</p></section>
{"".join(cards)}
<section id="decision" class="block"><h2>Khuyến nghị kiến trúc · Option B</h2>
<p class="reading"><code>ASSISTANT_REVIEW_RECOMMENDATION</code>. Giữ costume-aware stance, silhouette theo phần, grip/socket, các mặt nhỏ quanh mắt và hàm, cùng phép fit mũ trước viền. S0 tiếp tục là B3 nghiên cứu. Art ở 1× cho thấy ưu thế khác nhau theo nghề và nền, nhất là chi tiết dụng cụ. Chọn từng phương án qua Owner. B4 vẫn <code>NOT_SELECTED</code>. Cartographer S1–S3 gốc bị loại vì padding. Owner chưa ký phiếu nào.</p>
<div class="table"><table><thead><tr><th>Nhân vật</th><th>Cặp duyệt</th><th>Khuyến nghị</th><th>Quan sát native 1× và gameplay</th></tr></thead><tbody>{"".join(art)}</tbody></table></div>
<h3>Technical QA</h3>
<div class="table"><table><thead><tr><th>Mẫu</th><th>Top S0 / S3(-R)</th><th>Hàng thoáng</th><th>Overlap gần / xa</th><th>Ground và pivot</th><th>Cổng</th></tr></thead><tbody>{"".join(stats)}</tbody></table></div>
<p class="reading">Lint, typecheck, build, smoke và 85/85 test. Fixture gồm cap thấp/cao, brim rộng, viền, không mũ, đầu hẹp/rộng và lỗi vị trí hoặc kích thước. {qa["historical"]} SHA lịch sử, E9.0/E9.1/E9.1R/E9.1S giữ nguyên. {qa["regenerated"]} tệp tái lập byte trong 3,5 s. {qa["staticScenes"]} cảnh static 320×208 / 32 PPU giữ anchor và collision, {len(qa["studio"]["pngs"])} PNG Studio round-trip khớp RGBA.</p>
<p class="reading">Renderer E9.1S-R <code>{revision}</code><br>Checkpoint E9.1S <code>{bench["base"]}</code><br>Source E9.1S <code>{bench["sourceE91S"]}</code><br>Freeze đầu <code>{qa["firstFreeze"]}</code><br>Replay freeze <code>{bench["freeze"]}</code>.</p>
<h3>Phiếu duyệt Owner</h3>
<p class="reading">Chấm từng tiêu chí ở native 1× và ghi Critical Defect theo Static Addendum. Có thể chọn một trong cặp, Neither hoặc yêu cầu sửa. <code>STATIC_ART_REVIEW_PENDING</code>, <code>GAME_READY_ART_NOT_APPROVED</code>. Hướng nhìn và Unity runtime vẫn là cổng production. Studio nhập PNG trong khi spec v4 còn khoảng trống tích hợp. E8.5 Owner Runtime pending. E9.2 <code>NOT AUTHORIZED</code>. Chưa có milestone triển khai tiếp theo được ủy quyền.</p>
<div class="downloads">{docs}</div></section>
<footer>{len(assets)} PNG native khác nhau · {placements} vị trí ảnh · lặp SHA dùng lại cùng dữ liệu.</footer>
</main><script>{JS}</script></body></html>"""
    OUT.write_text(doc,encoding="utf8",newline="\n")
    print(json.dumps({"report":OUT.as_posix(),"sha256":digest(OUT.read_bytes()),"bytes":OUT.stat().st_size,
                      "uniquePngs":len(assets),"placements":placements}))

if __name__=="__main__":
    main()
