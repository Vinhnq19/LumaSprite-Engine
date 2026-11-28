"""Create the E9.1R offline art review using the locked native sprites and scenes."""
import argparse
import base64
import hashlib
from html import escape
import json
from pathlib import Path
import struct
import subprocess

ROOT = Path("benchmarks/results")
OUT = Path("docs/reports/E9.1R-CHARACTER-ART-REVIEW.html")
ART = Path("docs/art-quality")
FIXTURES = Path("benchmarks/fixtures/e91r")

def data(path):
    return json.loads(path.read_text(encoding="utf-8"))

def hash_(raw):
    return hashlib.sha256(raw).hexdigest()

def uri(raw, mime):
    return f"data:{mime};base64," + base64.b64encode(raw).decode("ascii")

def download(path, label):
    return f'<a class="download" download="{escape(path.name)}" href="{uri(path.read_bytes(),"application/octet-stream")}">{escape(label)}</a>'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--renderer-commit",required=True)
    args=parser.parse_args()
    revision=subprocess.check_output(["git","rev-parse",args.renderer_commit],text=True).strip()
    old = data(ROOT/"e91/benchmark.json")
    bench = data(ROOT/"e91r/benchmark.json")
    qa = data(ROOT/"e91r/technical-qa.json")
    assert bench["freeze"] == hash_((FIXTURES/"candidate-freeze.json").read_bytes())
    assert bench["status"]=="E9_1R_READY_FOR_HUMAN_STATIC_ART_REVIEW",bench["status"]
    lock=data(FIXTURES/"candidate-freeze.json")
    for path, key in lock["sources"].items():
        raw=subprocess.check_output(["git","show",revision+":"+path])
        assert hash_(raw.replace(b"\r\n",b"\n"))==key,path
    index = {"e91":old["files"],"e91r":bench["files"]}
    embedded = {}
    shown = 0

    def card(label,milestone,relative):
        nonlocal shown
        shown+=1
        raw=(ROOT/milestone/relative).read_bytes()
        key=hash_(raw)
        assert index[milestone][relative]==key,relative
        w,h=struct.unpack(">II",raw[16:24])
        original=key not in embedded
        if original:
            embedded[key]=relative
        source=f' src="{uri(raw,"image/png")}"' if original else ""
        return (f'<figure><figcaption>{escape(label)}</figcaption><div class="well">'
                f'<img{source} data-sha="{key}" data-file="{milestone}/{escape(relative)}" width="{w}" height="{h}" '
                f'alt="{escape(label)}"></div></figure>')

    def rail(title,entries):
        cards="".join(card(*entry) for entry in entries)
        return f'<section class="comparison"><h3>{escape(title)}</h3><div class="rail" tabindex="0" aria-label="{escape(title)}">{cards}</div></section>'

    harbor,_,marsh,cliff=bench["cases"]
    def evidence(row, id_, names, milestone="e91r"):
        return [(label,milestone,row["scope"]+f"/{id_}/{name}.png") for label,name in names]
    def baseline(row, historical):
        return [(label,"e91" if historical else "e91r",
                 row["scope"]+"/"+stage+("-shared" if historical and stage!="a0" else "")+"/sprite.png")
                for label,stage in zip(["A0 · v3","B1 · hình khối","B2 · tay nắm","B3 · chất liệu","B4 · viền"],
                                       ["a0","b1","b2","b3","b4"])]
    def field(row, id_, name):
        return next(v for v in row["variants"] if v["id"]==id_)[name]

    harbor_rails=(
       rail("Đối chứng cùng thiết bị · Harbor 24137",baseline(harbor,True))
       +rail("Grip · B1 → B2, cùng tay van và chốt",evidence(harbor,"b1",[("B1 · tay gần","near"),("B1 · tay xa","far")],"e91")
             +evidence(harbor,"b2",[("B2 · tay gần","near"),("B2 · tay xa","far"),("Delta B2","diff")],"e91"))
       +rail("Cụm màu và viền · cùng hình học",evidence(harbor,"b3",[("B3 · vật liệu","sprite"),("Delta B3","diff")],"e91")
             +evidence(harbor,"b4",[("B4 · viền","sprite"),("Delta B4","diff"),("Map viền B4","outline-map")],"e91"))
    )
    marsh_rails=(
       rail("Giải phẫu trước sửa · từ thân đến ảnh hoàn thiện",evidence(marsh,"original",[("Thân · bỏ outfit và chân","body-bare"),
              ("Thân + chân","with-legs"),("Mặt nạ trang phục","garment"),("Thân + tunic","body-worn")])
              +evidence(marsh,"b3",[("Silhouette B3 gốc","silhouette"),("B3 vật liệu gốc","sprite")],"e91"))
       +rail("E9.1R · vạt mới và bằng chứng thay đổi",evidence(marsh,"recovered-field",
             [("Tunic mới","garment"),("Thân + tunic mới","body-worn"),("Silhouette E9.1R","silhouette"),
              ("E9.1R · B3","sprite"),("Pixel diff","diff"),("Mặt nạ bộ phận","parts")]))
       +rail("Đối chứng cùng thiết bị · Marsh 55271",baseline(marsh,True)
             +evidence(marsh,"recovered-shared",[("E9.1R · thiết bị chung","sprite")]))
       +rail("Tidegate Day · cùng anchor",evidence(marsh,"b3",[("B3 gốc · Day","day")],"e91")
             +evidence(marsh,"recovered-field",[("E9.1R · Day","day")]))
       +rail("Tidegate Night · cùng anchor",evidence(marsh,"b3",[("B3 gốc · Night","night")],"e91")
             +evidence(marsh,"recovered-field",[("E9.1R · Night","night")]))
    )
    cliff_rails=(
       rail("Đối chứng cùng thiết bị · Cliffside 61947",baseline(cliff,False))
       +rail("Năng lực mới · áo choàng, đèn và dây",sum(
             (evidence(cliff,stage+"-field",[(name,"sprite")]) for stage,name in [
              ("b1","B1 · cấu trúc"),("b2","B2 · grip"),("b3","E9.1R · B3"),("b4","B4 · Sel-Out")]),[]))
       +rail("Ứng viên · hình khối và grip",evidence(cliff,"b3-field",[
             ("Silhouette","silhouette"),("Dáng bỏ mũ và đạo cụ","body"),("Mặt nạ cloak","garment"),
             ("Tay gần · nắm đèn","near"),("Tay xa · nắm dây","far"),("Mặt nạ vật liệu","materials"),("Delta B3","diff")]))
       +rail("Tidegate Day · B3 và B4",evidence(cliff,"b3-field",[("E9.1R · B3 Day","day")])
             +evidence(cliff,"b4-field",[("B4 Day","day")]))
       +rail("Tidegate Night · B3 và B4",evidence(cliff,"b3-field",[("E9.1R · B3 Night","night")])
             +evidence(cliff,"b4-field",[("B4 Night","night")]))
    )
    gap = field(marsh,"recovered-field","stance")
    cliff_gap = field(cliff,"b3-field","stance")
    qa_files = "".join(download(path,label) for path,label in [
        (ROOT/"e91r/human-review.json","Tải phiếu duyệt JSON trống"),
        (ROOT/"e91r/SHA256SUMS","SHA-256 bằng chứng E9.1R"),
        (ROOT/"e91/SHA256SUMS","SHA-256 đối chứng E9.1"),
        (ROOT/"e91r/technical-qa.json","Kết quả kiểm SHA và Studio"),
        (FIXTURES/"study.json","Brief và tiêu chí khóa"),
        (FIXTURES/"candidate-freeze.json","Khóa ứng viên trước holdout"),
        (ART/"art-quality-rubric-v2-static-addendum.md","Rubric v2 Static Addendum"),
    ])
    doc=f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'">
<title>E9.1R · Character Art Review</title><style>
:root {{color-scheme:dark;--bg:#142027;--panel:#20313a;--line:#425861;--text:#f3eee4;--muted:#c5d1cf;--green:#ade4c9;--amber:#f6ce92}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--text);font:16px/1.54 system-ui,sans-serif}}
main{{max-width:1240px;margin:auto;padding:clamp(1rem,4vw,3rem)}}header{{padding:0 0 1.6rem;border-bottom:1px solid var(--line)}}
h1,h2,h3{{line-height:1.16;margin:.45rem 0 .6rem}}h1{{font-size:clamp(2.25rem,6vw,4.4rem);letter-spacing:-.048em}}h2{{font-size:clamp(1.5rem,3vw,2.2rem)}}h3{{font-size:1.08rem}}
header p,.reading{{max-width:83ch}}small,.muted{{color:var(--muted)}}code{{color:var(--green);overflow-wrap:anywhere}}
a{{color:#c3e5f7}}a,button{{outline-offset:3px}}:focus-visible{{outline:3px solid var(--amber);outline-offset:3px}}
nav,.controls,.downloads{{display:flex;align-items:center;flex-wrap:wrap;gap:.45rem 1rem}}nav a,.download{{min-height:44px;display:inline-flex;align-items:center}}
.controls{{position:sticky;top:0;z-index:1;padding:.65rem;background:var(--panel);border:1px solid var(--line);border-radius:.5rem}}
button{{border:1px solid #6f8792;background:#2e4651;color:var(--text);min-height:44px;cursor:pointer;padding:.4rem .65rem;font:inherit;border-radius:.4rem}}
button[aria-pressed="true"]{{background:var(--green);color:#142027}}section.block{{padding-top:1.45rem;padding-bottom:1.25rem;border-bottom:1px solid var(--line);scroll-margin-top:5.5rem}}
.comparison{{margin:.8rem 0 1.1rem}}.rail{{display:flex;overflow-x:auto;gap:.48rem;padding:.25rem .12rem .7rem}}
figure{{margin:0;min-width:112px;flex:0 0 auto;background:var(--panel);border:1px solid var(--line);border-radius:.42rem;overflow:hidden}}
figcaption{{font-size:.9rem;padding:.4rem .6rem;max-width:24ch;min-height:36px}}.well{{min-height:82px;display:grid;place-items:center;padding:.45rem;background:#788a89}}
[data-background="dark"] .well{{background:#2a3b45}}img{{display:block;image-rendering:pixelated;max-width:none}}
.metrics{{overflow:auto}}table{{width:100%;text-align:left;border-collapse:collapse}}td,th{{border-bottom:1px solid var(--line);padding:.45rem .6rem;vertical-align:top}}
th{{color:var(--green)}}ul{{padding-left:1.3rem}}li{{margin:.35rem 0}}footer{{padding-top:1rem;color:var(--muted)}}
</style></head>
<body><main>
<header><small>LumaSprite Engine · E9.1R</small><h1>Character Art Review</h1>
<p><code>{bench["status"]}</code></p>
<p>Marsh vượt QA sau khi sửa đường gấu A-line. Cliffside, lần thử giữ kín với áo choàng ngắn, cũng đạt QA. Ứng viên đề xuất là E9.1R dựa trên B3. Mỹ thuật vẫn ở <code>STATIC_ART_REVIEW_PENDING</code>.</p>
<nav aria-label="Mục lục"><a href="#harbor">Harbor</a><a href="#marsh">Marsh diagnostic</a><a href="#cliff">Cliffside holdout</a><a href="#review">QA và phiếu duyệt</a></nav></header>
<p class="muted">Ảnh PNG gốc từ manifest. So sánh ở native 1× trước. Dùng 4× nearest-neighbor để xem cụm pixel. Có thể cuộn ngang trong từng nhóm.</p>
<div class="controls" aria-label="Hiển thị ảnh"><button id="zoom" aria-pressed="false">Phóng 4× nearest</button>
<button id="background" aria-pressed="false">Dùng nền tối</button><span id="scale" aria-live="polite">Native 1×</span></div>
<section class="block" id="harbor"><h2>Harbor Lockkeeper</h2>
<p class="reading">Development · 24137, 24138. A0 dùng v3/M2P với cờ lê và hộp như nhóm B1–B4 dùng thiết bị chung. E9.1R dùng lại B3 ở Harbor, khớp pixel trên hai seed.</p>
{harbor_rails}
<p class="reading"><strong>VISUAL_OBSERVATION.</strong> B1 làm vai và thân đọc rộng hơn, với torso 18→22 px. B2 thay riêng mặt nạ tay và tạo nắm tay chắc hơn; overlap tay van/chốt tăng 11→14 và 9→13, trong khi còn 28 và 111 pixel dụng cụ thấy được. B3 đặt mảng sáng theo tay áo và tạp dề, nhưng mặt vẫn ít chi tiết ở 1×. B4 đổi 56 pixel viền ở Harbor 24137 mở rộng; Day có 19→23 cạnh yếu và Night giữ 31/364 cạnh yếu.</p>
</section>
<section class="block" id="marsh"><h2>Marsh Apothecary</h2>
<p class="reading">Diagnostic · 55271. Mặt nạ cẳng chân và boot còn {marsh["original"]["anatomicalGapRows"]} hàng đạt điều kiện giải phẫu ở bản gốc. Tunic che ngang hàng 47–50, viền che tiếp hàng 51, để lại 1 hàng thoáng. Cả pose, điểm nối khớp, hỗ trợ hai chân và thứ tự lớp giữ nguyên qua bản sửa.</p>
{marsh_rails}
<p class="reading"><strong>VERIFIED_BY_TEST.</strong> Số hàng thoáng 1→{gap["visibleGapRows"]}, ngưỡng giữ ở 2. Gấu mặt nạ tunic từ hàng 50 lên 46. Recovery bỏ {field(marsh,"recovered-field","delta")["removed"]} pixel footprint và đổi màu {field(marsh,"recovered-field","delta")["painted"]} pixel. <strong>VISUAL_OBSERVATION.</strong> Hai boot tách rõ hơn; tunic ngắn lại và có thể đọc gần áo khoác dài ở native.</p>
</section>
<section class="block" id="cliff"><h2>Cliffside Lantern Keeper</h2>
<p class="reading">Fresh holdout · 61947. Brief yêu cầu áo choàng ngắn, đèn cầm tay gần và tay xa giữ dây. Đối chứng dùng bộ thiết bị v3 tương đương; đèn, dây và áo choàng là năng lực mở rộng. B2/B3/B4 trong mỗi track chỉ thay thành phần đang thử. SHA-256 ứng viên được ghi trước lần render đầu tiên.</p>
{cliff_rails}
<p class="reading"><strong>VERIFIED_BY_TEST.</strong> B3 đạt {cliff_gap["visibleGapRows"]} hàng thoáng và hai đế tiếp đất đúng cao độ. Overlap B1→B2 là 13→15 và 15→21 pixel. B3 đổi 431 pixel màu trên cùng mặt nạ. B4 Day có 13→18 cạnh yếu. Night giữ 19/276 cạnh yếu nhưng Δluma p10 giảm 33→25.</p>
<p class="reading"><strong>VISUAL_OBSERVATION.</strong> Đèn có khối kim loại và mặt kính sáng đọc được ở cả hai cảnh. Dây dễ đọc thành túi cứng. Áo choàng ngắn có vạt sau nhưng khi thu 1× có thể đọc như áo chồng lớp. B4 ở đây được ghi <code>NO_MEANINGFUL_ART_QUALITY_GAIN</code> cho viền theo quan sát; lựa chọn mỹ thuật thuộc Owner.</p>
</section>
<section class="block" id="review"><h2>QA và phiếu duyệt</h2>
<div class="metrics"><table><thead><tr><th>Kiểm chứng</th><th>Kết quả</th></tr></thead><tbody>
<tr><td>Engine</td><td>Lint, typecheck, build, smoke và 81/81 test. Có positive/negative cho gấu áo, che khe, chân nhập khối và đế không chạm.</td></tr>
<tr><td>Evidence</td><td>{qa["historical"]} checksum lịch sử, {qa["catalogs"]["e91"]} tệp E9.1, {qa["deterministicFiles"]} tệp E9.1R tái lập, {qa["verifiedScenes"]} cảnh Tidegate static 320×208 / 32 PPU và {len(qa["studio"]["pngs"])} PNG Studio khớp từng RGBA. Không có thay đổi collider, anchor hay nền ngoài vùng actor.</td></tr>
<tr><td>HTML</td><td>{len(embedded)} PNG khác nhau về byte cho {shown} vị trí ảnh. Chế độ 4× dùng đúng PNG native, với nearest-neighbor khi hiển thị.</td></tr>
<tr><td>Khóa raster</td><td>64×64 · pivot (32, 58) · three-quarter-right · weathered-station-v1 · upper-left. E9.1R source <code>{revision}</code>.</td></tr>
<tr><td>Provenance</td><td>E9.1 HEAD <code>{bench["base"]}</code> · source E9.1 <code>{bench["legacySource"]}</code> · freeze <code>{bench["freeze"]}</code> · Studio <code>{qa["studio"]["revision"]}</code></td></tr>
</tbody></table></div>
<h3>Critical Defects và quyết định Owner</h3>
<p class="reading">Chấm 8 tiêu chí tĩnh riêng ở 1×. Chọn A0, B1–B4, E9.1R, Neither hoặc yêu cầu sửa. Ghi cụ thể nếu grip thành cục, anatomy gãy, nét mặt và vật liệu bệt, mẫu giống nhau, viền không hợp cảnh hoặc vùng gameplay bị che. Những điểm này giữ nguyên ngưỡng của Static Addendum. <code>STATIC_ART_ACCEPTED</code> thuộc Owner sau khi đủ điều kiện nhận <code>STATIC_ART_ACCEPTED_FOR_ANIMATION_RESEARCH</code>.</p>
<p class="reading"><code>GAME_READY_ART_NOT_APPROVED</code>. Hướng nhìn, animation và Unity runtime ở <code>NOT_RUN</code>. <code>DIRECTIONAL_FACING_LOCK</code> và các yêu cầu runtime vẫn là production blockers. E9.2 chưa được ủy quyền.</p>
<div class="downloads">{qa_files}</div></section>
<footer>LumaSprite Engine · E9.1R · HTML portable</footer></main>
<script>
const images = [...document.images];
const pixels = new Map(images.filter(i => i.hasAttribute('src')).map(i => [i.dataset.sha, i.src]));
for (const image of images) {{
  if (!image.hasAttribute('src')) image.src = pixels.get(image.dataset.sha);
  image.dataset.width = image.getAttribute('width');
  image.dataset.height = image.getAttribute('height');
}}
const zoom = document.querySelector('#zoom');
zoom.addEventListener('click', () => {{
  const expanded = zoom.getAttribute('aria-pressed') !== 'true';
  zoom.setAttribute('aria-pressed', expanded);
  zoom.textContent = expanded ? 'Về native 1×' : 'Phóng 4× nearest';
  document.querySelector('#scale').textContent = expanded ? 'Nearest-neighbor 4×' : 'Native 1×';
  for (const image of images) {{
    image.width = Number(image.dataset.width) * (expanded ? 4 : 1);
    image.height = Number(image.dataset.height) * (expanded ? 4 : 1);
  }}
}});
const background = document.querySelector('#background');
background.addEventListener('click', () => {{
  const dark = background.getAttribute('aria-pressed') !== 'true';
  background.setAttribute('aria-pressed', dark);
  background.textContent = dark ? 'Dùng nền sáng' : 'Dùng nền tối';
  document.querySelector('main').dataset.background = dark ? 'dark' : 'light';
}});
</script></body></html>"""
    OUT.write_text(doc,encoding="utf-8",newline="\n")
    print(json.dumps({"report":OUT.as_posix(),"embedded":len(embedded),"placements":shown,
                      "bytes":OUT.stat().st_size,"sha256":hash_(OUT.read_bytes())}))

if __name__=="__main__":
    main()
