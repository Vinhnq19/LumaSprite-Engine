"""Package E7.2 evidence as standalone HTML. All images come from verified PNG files."""
import argparse
import base64
import hashlib
import html
import json
import re
import struct
from pathlib import Path

CHECKPOINT = "c97a36f0da15ee630ccbb38b2e0471dd6f44a174"
BRANCH = "codex/e7-2b-stone-material"
A = Path("benchmarks/results/e72a")
B = Path("benchmarks/results/e72b")
REPORTS = Path("docs/reports")
CSS = Path("research/open-source/art-quality/report.css").read_text(encoding="utf-8") + """
.wrap{width:min(1180px,calc(100% - 2rem))}
.pan{overflow:auto;max-height:78vh}
.pan:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.pair{display:flex;align-items:start;gap:.65rem;width:max-content;min-width:100%;padding:.25rem}
.pair .art{display:block;min-width:116px;flex:1}
.pixels{margin-inline:auto;width:max-content}
.pair img{max-width:none;height:auto}
.pair figcaption{white-space:nowrap;font-weight:700;margin:.2rem .75rem .4rem}
.qa-links{display:flex;gap:.5rem 1rem;flex-wrap:wrap}
form label{display:grid;gap:.3rem;margin:1rem 0}
#evidence td{overflow-wrap:anywhere}
@media(max-width:540px){.wrap{width:calc(100% - 1rem)}}
"""
SCRIPT = """
for(const form of document.querySelectorAll('form[data-review]')){
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const ratings=[...form.querySelectorAll('[data-criterion]')].map(field=>({
      criterion:field.dataset.criterion,variant:field.dataset.variant,score:field.value?Number(field.value):null
    }));
    const record={asset:form.dataset.review,ratings,notes:form.elements.notes.value};
    const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=form.dataset.review+'-art-review.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
}
"""

def esc(value):
    return html.escape(str(value), quote=True)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

class Evidence:
    def __init__(self, checksums):
        self.expected = checksums
        self.pictures = {}
        self.metadata = {}

    def verified(self, path):
        raw = path.read_bytes()
        name = path.as_posix()
        assert self.expected[name] == sha(raw), name
        return raw

    def image(self, path, label):
        raw = self.verified(path)
        assert raw[:8] == b"\x89PNG\r\n\x1a\n"
        w, h = struct.unpack(">II", raw[16:24])
        name, digest = path.as_posix(), sha(raw)
        self.pictures[name] = digest
        return (f'<figure class="art"><figcaption>{esc(label)}</figcaption><div class="pixels">'
                f'<img data-sha="{digest}" width="{w}" height="{h}" alt="{esc(label)}" '
                f'src="data:image/png;base64,{base64.b64encode(raw).decode()}"></div></figure>')

    def download(self, path, label, name=None):
        raw = self.verified(path)
        digest = sha(raw)
        self.metadata[path.as_posix()] = digest
        content_type = "application/json" if path.suffix == ".json" else "text/plain;charset=utf-8"
        return (f'<a data-sha="{digest}" download="{esc(name or path.name)}" '
                f'href="data:{content_type};base64,{base64.b64encode(raw).decode()}">{esc(label)}</a>')

def pair(images):
    return '<div class="pan" tabindex="0" aria-label="So sánh pixel"><div class="pair">' + "".join(images) + "</div></div>"

def details(label, body):
    return f"<details><summary>{esc(label)}</summary>{body}</details>"

def table(columns, rows):
    head = "".join(f'<th scope="col">{esc(c)}</th>' for c in columns)
    body = "".join("<tr>" + "".join(f"<td>{esc(x)}</td>" for x in row) + "</tr>" for row in rows)
    return f'<div class="scroll"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'

def swatches(ramps):
    return "".join(f"<p><strong>{esc(role)}</strong></p>" +
        '<div class="swatches">' + "".join(f'<span><i style="--sample:{esc(c)}"></i> {esc(c)}</span>' for c in ramp) +
        "</div>" for role, ramp in ramps.items())

def review(asset, criteria, variants):
    options = '<option value="">—</option>' + "".join(f"<option>{n}</option>" for n in range(1, 6))
    labels = "".join(f'<th scope="col">{esc(v)}</th>' for v in variants)
    rows = ""
    for criterion in criteria:
        selects = "".join(f'<td><select data-criterion="{esc(criterion)}" data-variant="{esc(v)}" '
                          f'aria-label="{esc(criterion)} · {esc(v)}">{options}</select></td>' for v in variants)
        rows += f'<tr><th scope="row">{esc(criterion)}</th>{selects}</tr>'
    return (f'<form data-review="{esc(asset)}"><div class="scroll"><table>'
            f'<thead><tr><th scope="col">Tiêu chí</th>{labels}</tr></thead><tbody>{rows}</tbody></table></div>'
            '<label>Nhận xét và lỗi nghiêm trọng<textarea rows="3" name="notes"></textarea></label>'
            '<button type="submit">Tải phiếu duyệt JSON</button></form>')

def page(title, status, lead, nav, body, evidence, extra_css='', extra_script=''):
    links = "".join(f'<a href="#{esc(ref)}">{esc(label)}</a>' for ref, label in [*nav, ("evidence", "Bằng chứng")])
    checksums = table(["Tệp nguồn", "SHA-256"], [*evidence.pictures.items(), *evidence.metadata.items()])
    return f"""<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'">
<title>{esc(title)}</title><style>{CSS}{extra_css}</style></head><body>
<header><div class="wrap"><h1>{esc(title)}</h1><p class="status">{esc(status)}</p><p class="lede">{esc(lead)}</p></div></header>
<nav aria-label="Các mục"><div class="wrap">{links}</div></nav><main class="wrap">{body}
<section id="evidence"><h2>Tệp gốc và SHA-256</h2><p>{len(evidence.pictures)} PNG nhúng trực tiếp bằng Base64.</p>
{details("SHA-256 của PNG và metadata", checksums)}</section></main><script>{SCRIPT}{extra_script}</script></body></html>
"""

def report_prop(evidence):
    sections = []
    criteria = ["Nhận diện vật liệu", "Nhận diện chức năng", "Bảo toàn hình khối", "Hướng sáng",
                "Cụm pixel", "Đường viền", "Độ đọc ở 1×", "Phong cách game"]
    for asset, label in [("relay", "Field Signal Relay Box · Development"), ("receiver", "Ridge Survey Receiver · Holdout")]:
        root = A / asset
        qa = json.loads(evidence.verified(root / "qa.json"))
        variants = ("M0", "M1")
        def show(mode):
            return pair(evidence.image(root / v.lower() / (mode + ".png"), v) for v in variants)
        def metric(item):
            return next(edge[item] for edge in qa["m0"]["materialBoundaries"] if edge["roles"] == "#98a0be/#bc8862"), next(
                edge[item] for edge in qa["m1"]["materialBoundaries"] if edge["roles"] == "#98a0be/#bc8862")
        rows = [
            ("Amber (px)", qa["m0"]["clusters"]["amber"]["pixels"], qa["m1"]["clusters"]["amber"]["pixels"]),
            ("Gỗ–kim loại · median luma", *metric("median")),
            ("Gỗ–kim loại · P10", *metric("p10")),
            ("Gỗ–kim loại · cặp mẫu", *metric("samples")),
            ("Gỗ · cụm một pixel", qa["m0"]["clusters"]["wood"]["isolated"], qa["m1"]["clusters"]["wood"]["isolated"]),
        ]
        native = show("native")
        views = "".join(details(title, show(mode)) for mode, title in [
            ("native-4x", "4× nearest-neighbor"), ("bright", "Nền sáng"), ("dark", "Nền tối"),
            ("context", "Gameplay C1 · 1×"), ("material", "Material masks")])
        shapes = pair([evidence.image(root / "flat.png", "Flat geometry chung"),
                       evidence.image(root / "silhouette.png", "Silhouette chung"),
                       evidence.image(root / "rgba-diff.png", "RGBA diff")])
        ramp_colors = swatches({role:qa["ramps"][role] for role in ["wood", "metal", "amber"]})
        links = (evidence.download(root / "qa.json", "QA JSON gốc", asset + "-qa.json") +
                 evidence.download(A / "review" / (asset + ".workbench.json"), "Workbench Review JSON"))
        sections.append(f"""<section id="{asset}"><h2>{esc(label)}</h2>
<p>Seed {qa['seed']} · {qa['m0']['coverage']} pixel silhouette · {qa['diff']['alphaPixels']} pixel alpha thay đổi.</p>
<h3>Native 1×</h3>{native}{views}
{details("Flat geometry, silhouette và RGBA diff", shapes)}
{details("Material boundary diagnostics", table(["Chỉ số", *variants], rows))}
{details("Palette ramps B1", ramp_colors)}
<p>Ở 1×, mảng gỗ và cửa amber liền mạch hơn. Dáng hộp vẫn hạn chế nhận biết chức năng khi đứng riêng.</p>
<p class="qa-links">{links}</p>{details("Phiếu duyệt của Owner", review(asset, criteria, variants))}</section>""")
    bench = evidence.download(A / "benchmark.json", "Benchmark manifest đã khóa")
    parity = evidence.download(A / "studio-parity.json", "Studio parity đã khóa")
    sections.append(f"""<section id="summary"><h2>Tóm tắt để gửi ChatGPT</h2>
<p>Hai cặp M0/M1 dùng PNG đã khóa. Amber tăng từ 5 lên 14 px. Median luma ở biên gỗ–kim loại tăng từ 6 lên 29 trên cả hai mẫu.
Relay có P10 giảm từ 6 xuống 3 khi số cặp mẫu thay đổi. Alpha và silhouette khớp.</p>
<p>Technical QA được duyệt. M1 được chọn để duyệt hình. Artistic Acceptance đang chờ.
Mở 1× trước rồi so theo nền sáng, nền tối và C1. Owner chọn phiên bản hoặc yêu cầu chỉnh tiếp.</p>
<p>Checkpoint nguồn <code>{CHECKPOINT}</code> · Nhánh đóng gói <code>{BRANCH}</code>.</p>
<p class="qa-links">{bench}{parity}</p><p>Gửi <code>E7.2-A-PORTABLE-ART-REVIEW.html</code>.</p></section>""")
    return page("E7.2-A · Relay Material", "HUMAN_ART_REVIEW_PENDING",
        "So sánh M0/M1 trên cùng hình khối. Xem ảnh 1× trước, rồi mở 4× để soi màu, đường viền và cụm pixel.",
        [("relay","Relay"),("receiver","Receiver"),("summary","Tóm tắt")], "".join(sections), evidence)

CROP_CSS = """
.crop-zoom .pixels{position:relative;overflow:hidden;width:var(--crop-w);height:var(--crop-h)}
.crop-zoom .pixels img{position:absolute;width:1280px;height:832px;left:var(--left);top:var(--top)}
.crop-zoom label{display:block;margin:.5rem 0}
"""
CROP_SCRIPT = """
for(const panel of document.querySelectorAll('.crop-zoom')){
  const select=panel.querySelector('select'), regions=JSON.parse(panel.dataset.regions);
  select.addEventListener('change',()=>{
    const [x,y,w,h]=regions[Number(select.value)].rect;
    panel.style.setProperty('--crop-w',w*4+'px');
    panel.style.setProperty('--crop-h',h*4+'px');
    panel.style.setProperty('--left',-x*4+'px');
    panel.style.setProperty('--top',-y*4+'px');
    panel.querySelector('output').textContent='x='+x+', y='+y+' · '+w+'×'+h+' px gốc';
    panel.querySelector('.pan').scrollLeft=0;
  });
}
"""

def closeups(images, crops):
    regions = [*crops, {"id":"Toàn cảnh","rect":[0,0,320,208]}]
    x, y, w, h = crops[0]["rect"]
    options = "".join(f'<option value="{i}">{esc(r["id"])}</option>' for i,r in enumerate(regions))
    css = f"--crop-w:{w*4}px;--crop-h:{h*4}px;--left:{-x*4}px;--top:{-y*4}px"
    return (f'<details class="crop-zoom" style="{css}" data-regions="{esc(json.dumps(regions))}">'
            f'<summary>Cận cảnh 4× nearest-neighbor</summary><label>Vùng vách <select>{options}</select></label>'
            f'<output>x={x}, y={y} · {w}×{h} px gốc</output>{pair(images)}</details>')

def report_stone(evidence, index, revision):
    notes = {
        "r1": ("R1 · Development",
               "Ở 1×, east wall và west wall có mảng đá lớn hơn. Khe nối giờ ngắt quãng giữa các hàng; rêu tập trung ở chân vách.",
               "S1 giản lược các dải sáng ở mặt bên east wall. S0 còn tách rõ hơn một số hàng đá ở mặt khuất, nhất là Night."),
        "h1": ("H1 · Development",
               "Upper wall có ít sọc ngang hơn. Vết nứt nối với bậc gãy hiện hữu; mảng đá quanh tín hiệu đọc liền hơn.",
               "STRUCTURE_LIMITATION. Dáng bậc vuông còn nguyên. Mảng giữa upper wall ở Night hơi phẳng."),
        "h3": ("H3 · Holdout",
               "Trên Fern Cut Signal Gate, S1 bớt lặp ở upper wall và gom rêu ở chân fallen wall. Rule chạy cùng tham số với R1/H1.",
               "H3 Night là trường hợp S1 kém hơn cục bộ. Mặt bên phải upper wall mất các dải phân tầng của S0 và đọc như một mặt tối phẳng. Chờ đánh giá độc lập trước khi kết luận khả năng áp dụng."),
    }
    criteria = ["Độ đọc của đá", "Tách vật liệu", "Ánh sáng theo khối", "Logic phong hóa", "Rêu bám bề mặt",
                "Đường viền", "Cụm pixel", "Khả năng đọc gameplay", "Hài hòa với cảnh", "Khả năng chuyển layout"]
    sections = []
    variants = ("S0", "S1")
    for case in index["cases"]:
        layout, light = case["id"],case["light"]
        root = B / layout / light
        qa = json.loads(evidence.verified(B / case["qa"]))
        ident = layout+"-"+light
        def imgs(mode):
            return [evidence.image(root / v.lower() / (mode+".png"), v) for v in variants]
        label, benefit, caution = notes[layout]
        rows = []
        for wall in qa["walls"]:
            before,after = wall["clusters"]["before"],wall["clusters"]["after"]
            rows.append((wall["id"],
                f'{wall["baseline"]["detail"]["per100"]} → {wall["candidate"]["detail"]["per100"]}',
                f'{before["stone"]["largest"]} → {after["stone"]["largest"]}',
                f'{before["stone"]["isolated"]} → {after["stone"]["isolated"]}',
                f'{before.get("moss",{}).get("pixels",0)} → {after.get("moss",{}).get("pixels",0)}',
                qa["changedByWall"][wall["id"]]))
        shape = pair(evidence.image(root/(path+".png"),desc) for path,desc in [
            ("flat","Flat geometry"),("silhouette","Silhouette kiến trúc"),("collision","Collision plane")])
        diagnostic = pair(evidence.image(root/(path+".png"),desc) for path,desc in [
            ("planes","Mặt trước, bên và trên"),("rgba-diff","RGBA diff · mint là đổi màu")])
        native = pair(imgs("native"))
        zoom = closeups(imgs("native-4x"),case["crops"])
        masks = pair(imgs("material"))
        metrics = table(["Vách", "Biên luma / 100", "Cụm đá lớn nhất", "Cụm đá 1 px", "Rêu (px)", "Pixel cảnh đổi"],rows)
        routes=" · ".join(f'{r["id"]}: {r["tested"]} mẫu' for r in qa["structure"]["routes"])
        clip = evidence.download(B / case["qa"], "QA JSON của cảnh", ident+"-qa.json")
        sections.append(f"""<section id="{ident}"><h2>{esc(label)} · {"Day" if light=="day" else "Night"}</h2>
<p>{esc(qa['name'])} · seed {case['seed']} · 320×208 · camera 3/4 phải.</p>{native}
<p>{esc(benefit)}</p><p><strong>Cần duyệt.</strong> {esc(caution)}</p>
{zoom}{details("Material mask S0/S1", masks)}
{details("Flat geometry, silhouette và collision", shape)}
{details("Stone planes và RGBA diff", diagnostic)}
{details("Cluster diagnostics và palette", metrics+swatches(qa["palette"]))}
<p>{esc(routes)}. Alpha, thứ tự lớp, anchor và footprint khớp.</p>
<p class="qa-links">{clip}</p>{details("Phiếu duyệt của Owner", review(ident, criteria, variants))}</section>""")
    verification=json.loads(evidence.verified(B/"verification.json"))
    history=table(["Lệnh hoặc gate", "Trạng thái", "Kết quả"],verification["checks"])
    assets="".join(evidence.download(p,label) for p,label in [
        (B/"benchmark.json","Evidence manifest"),
        (B/"studio-parity.json","Studio parity"),
        (B/"verification.json","Technical QA"),
        (Path(index["production"]["file"]),"Production geometry lock"),
        (Path(index["holdout"]["file"]),"H3 holdout lock"),
        (Path(next(c["source"]["file"] for c in index["cases"] if c["id"]=="h3")),"H3 source spec"),
    ])
    sections.append(f"""<section id="audit"><h2>Material Architecture Audit</h2>
<p>S0 và atlas đến từ renderComposition với Ruin Production Geometry. S1 đọc ba mặt từ atlas flat cùng camera, dựng lại quyền sở hữu từng pixel từ layer order và xác minh số pixel thấy được với production. Chỉ pixel thuộc wall đang thấy được tô lại.</p>
<p>Mạch xây xen kẽ, khe gãy xuất phát từ độ đổi cao ở crest. Dải sáng ở cạnh lộ bám mặt trên, mặt bên giữ bóng và phần chân dùng shade đá tối. Rêu chỉ bám mạch thấp hoặc chân giữ ẩm. Pixel viền S0 ngoài các mặt phẳng flat được giữ nguyên.</p>
<p>Palette B1 ban ngày/ban đêm được dùng theo đúng ramp. Mặt trước giữ nhiều mảng liền, ít tương phản lặp. Nguy cơ khi đưa vào production là mất chi tiết mặt khuất và rêu khó đọc ở bóng tối; vẫn cần chọn trên từng cảnh.</p>
<p>Owner duyệt engineering E7.1R. Bonded Fracture ở mức nghiên cứu. R1 cải thiện cục bộ, H1 là hướng nghiên cứu vách gãy, H2 chưa đủ thuyết phục về generalization. Production Geometry là control của cả sáu cặp S0/S1.</p></section>
<section id="technical"><h2>Technical QA</h2>
<p>Nhánh <code>{BRANCH}</code> · Full SHA của commit triển khai <code>{esc(revision)}</code> · Base <code>{CHECKPOINT}</code>.
Working tree sạch khi chốt commit triển khai. Commit đóng gói tiếp theo thêm HTML portable và cập nhật HANDOFF.</p>
<p>Source thay đổi <code>src/experiments/stone-material.ts</code>, <code>scripts/benchmark-e72b.ts</code>,
<code>scripts/e72b-studio.ts</code>, <code>scripts/report-e72-portable.py</code> và các lệnh npm liên quan.</p>
{history}<p class="qa-links">{assets}</p></section>
<section id="summary"><h2>Tóm tắt để gửi ChatGPT</h2>
<p>S0 lấy từ Ruin Production Geometry. S1 phong hóa hai vách theo mặt đá, mạch xây và vùng ẩm. 66 PNG từ Engine có SHA-256 trong file.
R1/H1 sạch sọc hơn ở 1×. H3 Night mất tách lớp ở mặt bên upper wall. Alpha, collision và các route không đổi.</p>
<p>Technical gate đạt. Human Art Approval chờ Owner. Owner chọn S0, S1 hoặc yêu cầu sửa cho từng layout. So H3 độc lập trước khi cân nhắc dùng rule.</p>
<p>Đề xuất chốt E7.2 sau khi duyệt riêng Relay M1 và đá S1, ghi vùng cần giữ của S0 ở mặt khuất.
E7.3 chờ brief và phê duyệt riêng, với bài thử 1× và holdout mới. E8 runtime vẫn trong backlog.</p>
<p>Gửi <code>E7.2-B-PORTABLE-ART-REVIEW.html</code> để duyệt đá, kèm <code>E7.2-A-PORTABLE-ART-REVIEW.html</code> nếu duyệt Relay cùng lúc.</p>
<p>PR draft local, base <code>{CHECKPOINT}</code>. Nội dung gồm đóng gói Relay, thử vật liệu tách riêng trên production wall và báo cáo kỹ thuật.
Kiểm 1× Day/Night và xem H3 trước khi quyết định.</p></section>""")
    return page("E7.2-B · Stone Material", "E7_2B_READY_FOR_HUMAN_STONE_MATERIAL_REVIEW",
        "S0 và S1 cạnh nhau ở native 1×. R1/H1 dùng để phát triển, H3 Fern Cut Signal Gate là holdout đã khóa.",
        [("r1-day","R1"),("h1-day","H1"),("h3-day","H3"),("audit","Audit"),("technical","QA"),("summary","Tóm tắt")],
        "".join(sections), evidence, CROP_CSS, CROP_SCRIPT)

def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stone", action="store_true")
    parser.add_argument("--revision")
    args=parser.parse_args()
    checksums = dict((path, digest) for digest, path in (line.split("  ", 1) for line in
        (A / "SHA256SUMS").read_text(encoding="utf-8").splitlines()))
    if args.stone:
        if not args.revision or not re.fullmatch(r"[0-9a-f]{40}",args.revision):
            parser.error("--stone requires the full implementation --revision")
        benchmark=B/"benchmark.json"
        index=json.loads(benchmark.read_bytes())
        checksums.update({(B / file).as_posix():digest for file,digest in index["sha256"].items()})
        for lock in (index["production"],index["holdout"],next(c["source"] for c in index["cases"] if c["id"]=="h3")):
            checksums[lock["file"]]=lock["sha256"]
        for path in (benchmark,B/"studio-parity.json",B/"verification.json"):
            checksums[path.as_posix()]=sha(path.read_bytes())
        evidence=Evidence(checksums)
        result=report_stone(evidence,index,args.revision)
    else:
        evidence=Evidence(checksums)
        result=report_prop(evidence)
    digest_list = re.findall(r'data-sha="([0-9a-f]{64})"[^>]+(?:src|href)="data:[^"]*?;base64,([^"]+)"',result)
    assert len(digest_list) == len(evidence.pictures) + len(evidence.metadata)
    assert all(sha(base64.b64decode(payload,validate=True))==digest for digest,payload in digest_list)
    path = REPORTS / ("E7.2-B-PORTABLE-ART-REVIEW.html" if args.stone else "E7.2-A-PORTABLE-ART-REVIEW.html")
    path.write_bytes(result.encode("utf-8"))
    print(path, len(evidence.pictures), "PNG,", len(evidence.metadata), "metadata")

if __name__ == "__main__":
    run()
