# LumaSprite — E8.5 Closeout & E9.0 Game-Ready Pixel Art Quality Audit

**Ngày:** `2026-11-27` (ICT)  
**Trạng thái Gate E9.0:** `E9_0_READY_FOR_OWNER_ART_DIRECTION_REVIEW`  
**Trạng thái Gate E8.5:** `E8_5_OWNER_REVIEW_PENDING` (`manualKeyboard = NOT_RUN`)  
**Quyền phát hành & E9.1:** `PRODUCTION_RELEASE_NOT_AUTHORIZED` · `GAME_READY_ART_NOT_APPROVED` · `E9_1_IMPLEMENTATION = NOT_AUTHORIZED`

---

## Phase A — Xác minh Đóng E8.5 & Tách bạch Chứng từ

### 1. Checkpoint Thực Tế Đã Xác Minh
- **Engine E8.5:** Branch `codex/e8-5-end-to-end-integration` (KHÔNG nằm trên `main`), source commit `b2540a1e69238d1273033b28801ca97c6081f164`, evidence/report HEAD `2933cf4675f69f8bac9d01b1be60cd07854f3896`.
- **Studio E8.4 (READ-ONLY):** Branch `antigravity/e8-4-native-scene-adapter`, HEAD `471ac90555d3545beff5182146e291ba97b9ae20` (source `59353475334bf0ef9635b01f606a2f8de509d5d9`).
- **Owner Acceptances lịch sử giữ nguyên:** Owner E8.3 `6/6_CONFIRMED`, Owner E8.4 Live Studio `6/6_CONFIRMED`.

### 2. Bảng Đối Chiếu Chứng Từ E8.5 (Evidence Closeout)
| Hạng mục kiểm | Giá trị đã xác minh từ artifact | Tình trạng |
| --- | --- | --- |
| Owner Live ZIP gốc | `e8-mistfen-ferry-landing-day-e84-export.zip` · `163,438` B · SHA-256 `b7606778e555e2f048356c1dbb6c89be7bbc9315683e7c0e88d99c6c4d779754` | Khớp nguyên vẹn |
| Studio Revision & Approval | `studioRevision=8`, `status="APPROVED"`, `note="Live QA verified"` | Khớp nguyên vẹn |
| Unity Importer (`E8Build.cs`) | `studioZipsCount=9`, `texturesCount=105`, `maps=6` | Khớp nguyên vẹn |
| Mistfen Edit (`X=113 → X=117`) | `spawnX=117`, khác `1,189` px so với nền B2 khóa `X=113` | Khớp nguyên vẹn |
| Studio Rollback (`X=113`) | `day-rollback` `studioRevision=1`, khác `0` px so với nền B2 khóa `X=113` | Khớp nguyên vẹn |
| Dynamic Label & Linked Entity | 6/6 Day/Night dùng `label` thật (`Kiểm tra cầu phà E8.5` → `mooring-2`, `Vận hành tay quay E8.5` → `sluice`, `Kiểm tra cửa lấy nước E8.5` → `sluice`, `linkedEntityResolved=true`) | Khớp nguyên vẹn |
| Collision, Walkability & Fallback | Probes collider đạt 100%; `E8InteractionHud.PromptFor` / `FeedbackFor` giữ fallback legacy bundle | Khớp nguyên vẹn |
| Windows Player Captures | `LumaSpriteE85.exe` (`Unity 6000.3.21f1`): 6/6 Day/Night + 2 variants (`day-e84`, `day-rollback`) `0` px World RGBA diff | Khớp nguyên vẹn |
| Historical Checksums | `805` catalog SHA-256 + `e76r` + `e8` + `e83` + `e85` `SHA256SUMS` nguyên vẹn 100% | Khớp nguyên vẹn |
| Human Review Gate E8.5 | [benchmarks/results/e85/human-review.json](../../benchmarks/results/e85/human-review.json) giữ trống (`PENDING_OWNER_END_TO_END_ACCEPTANCE`), `manualKeyboard = NOT_RUN` | `E8_5_OWNER_REVIEW_PENDING` |

### 3. Giải thích Chính xác Sai Lệch Số Đếm `55` vs `56` Tệp trong Manifest E8.5
Không có bất kỳ sự sai khác dữ liệu hay chỉnh sửa evidence nào. Khác biệt `55` (trong `<details><summary>SHA-256 verification manifest (55 tệp)</summary>` bên trong `E8.5-END-TO-END-PRODUCTION-ACCEPTANCE.html`) và `56` (số dòng thực tế trong `benchmarks/results/e85/SHA256SUMS`) phát sinh hoàn toàn do **trình tự tạo chứng từ để tránh hash vòng lặp**:
1. Script `scripts/verify-e85-runtime.ts` xuất **55 tệp** runtime/verification ban đầu và ghi 55 dòng vào `benchmarks/results/e85/SHA256SUMS`.
2. Script `scripts/report-e85-runtime.py` đọc `SHA256SUMS` 55 dòng này để nhúng danh sách kiểm chứng vào [E8.5-END-TO-END-PRODUCTION-ACCEPTANCE.html](E8.5-END-TO-END-PRODUCTION-ACCEPTANCE.html) (`c1862c0f0a0d306e078e50fdc5851263a784e45bb1f509ff866192e17d6a177d`).
3. Sau khi HTML được sinh, bước kiểm tra Chrome offline ngoài repo ghi thêm tệp thứ **56** là [benchmarks/results/e85/portable-verification.json](../../benchmarks/results/e85/portable-verification.json) (chứa SHA-256 của chính file HTML vừa xuất nên không thể nhúng ngược vào bên trong file HTML) và bổ sung SHA-256 của nó thành dòng thứ 56 trong `benchmarks/results/e85/SHA256SUMS`.

---

## Phase B — Audit Mỹ Thuật Toàn Pipeline (`TECHNICAL_PASS ≠ ARTISTIC_PASS`)

Đánh giá các ảnh PNG gốc ở kích thước native `1×` và `4×` cho thấy Engine hiện đã rất mạnh ở tính xác định (`determinism`), bảo vệ provenance SHA-256, hợp đồng collision/RLE/HUD với Unity, nhưng **chưa đạt chất lượng pixel art sẵn sàng cho game thương mại**. Toàn bộ 10 vấn đề kỹ thuật-mỹ thuật trọng yếu dưới đây là rào cản trực tiếp:

### 1. Đánh giá 12 Thành Phần Pipeline & Khả Năng Tái Sử Dụng

| Thành phần | Source chính | Điểm mạnh hiện tại | Giới hạn mỹ thuật cốt lõi | Quyết định kiến trúc |
| --- | --- | --- | --- | --- |
| **Pixel Core** | `src/core/pixels/raster.ts`, `src/core/renderer/png.ts` | Alpha nhị phân sạch 0/255, RGB trong suốt = 0, deterministic RGBA. | `renderOutlinedLayers` (`src/core/renderer/layers.ts:4-10`) quét viền đơn sắc một màu toàn chu vi. | **KEEP / REUSE** core; mở rộng layer renderer hỗ trợ selective outline (sel-out). |
| **ShapeSpec** | `src/core/geometry/faces.ts`, `projection.ts`, `shapes.ts` | Chiếu hộp 3/4, fill polygon/ellipse gọn nhẹ, không phụ thuộc AI ngoài. | Thiếu curve organic, pixel-snapping thông minh cho biên chéo nhỏ và bo nếp vải. | **REUSE + EXTEND** thêm helper đường cong/giải phẫu sạch. |
| **PoseSpec** | `src/specs/character.ts`, `src/generators/character/geometry.ts` | Khóa khớp elbow/wrist/palm/knee/ankle, kiểm ground line và knee direction. | Hai tay chỉ là đoạn thẳng nối khớp + đầu tròn `oval 4×4`; pose bị khóa cứng 1 hướng `three-quarter-right`. | **EXTEND** hỗ trợ nhiều hướng (tối thiểu Left/Right/Front/Back hoặc 4-dir) & pose template đa hình thái. |
| **CharacterSpec** | `src/specs/character.ts`, `src/generators/character/production.ts` | Schema chặt, hỗ trợ revision v1/v2/v3, tương thích Studio. | Khóa vào khung `humanoid-surveyor`/`humanoid-traveler` cố định tỷ lệ hộp giống hệt nhau. | **REDESIGN (v4 Pilot)** tách thân hình theo archetype & mô-đun trang phục. |
| **Semantic Materials** | `src/generators/character/materials.ts`, `material-planes.ts` | Bảng màu tách role rõ, không sai palette, kiểm P10 Day/Night. | Ánh sáng tô theo vùng UV 0..1 trục đứng/ngang nên tạo các mảng loang hình học, thiếu cluster pixel có chủ đích. | **REDESIGN** nâng từ UV patch sang form-aware cluster shading & anti-aliasing biên trong. |
| **ArtDirectionSpec** | `src/experiments/art-direction.ts` | Khoá style `weathered-station-v1`, ramp giá trị tăng dần, ánh sáng upper-left. | Chưa quy định độ đậm nhạt viền (outline value hierarchy) giữa nền, kiến trúc, prop và nhân vật. | **EXTEND** thêm luật sel-out & quy tắc phân cấp tương phản nền/nhân vật. |
| **Quality-Guided Generation** | `src/experiments/quality-guided-character.ts`, `character-identity.ts` | Tách biệt technical QA gate, kiểm hand-tool grip pixels & owner map. | Chỉ xếp hạng/chọn trong các biến thể cùng generator hình học yếu nên không tự tạo được hình đẹp hơn. | **KEEP** vai trò gate kỹ thuật; **KHÔNG** dùng để tự phong Artistic PASS. |
| **Local Refinement** | `src/experiments/structure-quality/`, E7.4–E7.5R local patch probes | Bảo toàn SHA-256 ngoài vùng sửa và kiểm tra mask nghiêm ngặt. | Các patch 3–12 px RGB trên geometry cũ đều cho `NO_MEANINGFUL_VISUAL_GAIN` (đã xác minh ở E7.4R/E7.5R). | **KEEP** cho tinh chỉnh cuối, không dùng để chữa lỗi cấu trúc gốc. |
| **Animation Pipeline** | `src/generators/character/walk.ts`, `walk-pose.ts`, `animation.ts` | Root motion khớp từng px tiếp đất, zero foot slip, transition `walk-transition` sạch. | Tay cầm đèn/thân trên cứng đơ, thiếu trọng lượng nhún thân/vai, chưa hỗ trợ 2-hand shaft hay tà áo bay, khóa 1 hướng. | **EXTEND** thêm secondary motion (vai/áo/phụ kiện), hướng mặt và state cho held tool. |
| **Environment Composition** | `src/generators/environment/render.ts`, `src/experiments/functional-waterfront.ts` | Atlas 16×16, depth order đúng, collision/RLE chuẩn Unity. | Bờ nước thẳng góc, cụm cỏ rải máy móc, vệt nước gạch ngang đều, nhà/bến thiếu hòa nhập viền với actor. | **EXTEND** bổ sung organic shore blending, ground rest breakups và thống nhất style viền. |
| **Runtime Art Review** | `scripts/e8-unity/Runtime/`, `verify-e85-runtime.ts` | Chụp framebuffer thật từ Unity Windows Player ở 1×, giữ exact RGBA parity. | Scripted walkthrough không thay được kiểm tra cảm nhận điều khiển phím thật. | **KEEP / REUSE** làm chuẩn nghiệm thu runtime. |
| **Studio Art Review Workbench** | `D:\LumaSprite-Studio` (`src/studio/art-review/`, `docs/ART-REVIEW-WORKBENCH.md`) | So sánh A/B 1×/4×/8× nearest-neighbor, Pixel Diff, Animation sync theo ms, nạp Rubric JSON, ghim lỗi. | Hiện tách khỏi Engine rubric v2 nếu chưa đồng bộ file schema rubric mới. | **KEEP / REUSE** (READ-ONLY) và kết nối qua `art-quality-rubric-v2.json`. |

---

### 2. Phân Tích Lỗi Mỹ Thuật Hiện Tại Bằng Bằng Chứng PNG Thật

#### A. Character
1. **C1 (Ưu tiên P0) — Nhân vật lặp khuôn mẫu hình học, bản sắc nghề phụ thuộc gần như hoàn toàn vào đạo cụ**
   - **Bằng chứng PNG thật:** [benchmarks/results/e44/b1-4x.png](../../benchmarks/results/e44/b1-4x.png), [benchmarks/results/e44/courier-rev-4x.png](../../benchmarks/results/e44/courier-rev-4x.png), [benchmarks/results/e75r/ridge-mechanic/refined/material-4x.png](../../benchmarks/results/e75r/ridge-mechanic/refined/material-4x.png), [benchmarks/results/e75r/canal-porter/refined/material-4x.png](../../benchmarks/results/e75r/canal-porter/refined/material-4x.png) (và [e44/lineup-1x.png](../../benchmarks/results/e44/lineup-1x.png)).
   - **Asset/Brief:** Surveyor R2, Courier Rev, Ridge Mechanic, Marsh Harvester, Canal Porter (`64×64`, `three-quarter-right`).
   - **Root cause:** `planCharacter` trong [src/generators/character/geometry.ts](../../src/generators/character/geometry.ts#L119-L175) sinh cùng một đa giác áo khoác 8 đỉnh, cùng đầu vát đa giác, chỉ hoán đổi `headwear` và đắp thêm `cape`/`satchel` trong [src/experiments/character-identity.ts](../../src/experiments/character-identity.ts#L52-L102).
   - **Ảnh hưởng ở native 1×:** Ở 1×, Ridge Mechanic, Canal Porter và Surveyor nhìn gần như một người thay mũ và cầm đồ khác; khi che đạo cụ thì mất nhận diện nghề nghiệp.
   - **Hướng sửa:** **Cần phương pháp mới** (Part-based character archetype construction hoặc Artist-authored parametric templates), không thể sửa bằng chỉnh thông số chiều rộng/cao hiện tại.
   - **Rủi ro regression:** Trung bình–Cao nếu đụng tới legacy `v1/v2/v3` (cần giữ `v1–v3` bất biến cho E4–E8.5, cô lập vào `v4` Pilot).

2. **C2 (Ưu tiên P0) — Bàn tay là khối tròn 4×4, lực nắm dụng cụ thiếu thuyết phục**
   - **Bằng chứng PNG thật:** [benchmarks/results/e75r/ridge-mechanic/refined/material-4x.png](../../benchmarks/results/e75r/ridge-mechanic/refined/material-4x.png), [benchmarks/results/e75r/marsh-harvester/refined/material-4x.png](../../benchmarks/results/e75r/marsh-harvester/refined/material-4x.png), [benchmarks/results/e75r/canal-porter/refined/material-4x.png](../../benchmarks/results/e75r/canal-porter/refined/material-4x.png).
   - **Asset/Brief:** Ridge (cờ lê + hộp đồ nghề), Marsh (móc thu hoạch), Canal Porter (đòn gánh 2 tay).
   - **Root cause:** Bàn tay vẽ bằng `segment('face', wrist, palm, 4 - dims, 4 - dims)` ([geometry.ts](../../src/generators/character/geometry.ts#L96)) rồi chồng lớp tay lên trên đa giác trục dụng cụ ([character-equipment.ts](../../src/experiments/character-equipment.ts#L36-L47), [quality-guided-character.ts](../../src/experiments/quality-guided-character.ts#L76-L80)). Không có ngón cái khép, khớp đốt ngón hay độ xoay cổ tay theo trục cầm.
   - **Ảnh hưởng ở native 1×:** Tay trông như cục màu hồng đặt đè lên thanh ngang (đặc biệt ở tay xa của Canal Porter và tay nâng cờ lê của Ridge); đầu móc Marsh dễ bị đọc thành gậy cong và tay nắm gần như dính bệt.
   - **Hướng sửa:** **Cần phương pháp mới** (Grip-aware discrete pixel hand motifs theo góc trục dụng cụ + pixel-snapped tool head thay vì xoay polygon tự do).
   - **Rủi ro regression:** Thấp nếu áp dụng riêng cho `v4` Pilot; trung bình nếu áp dụng cho rig E5 walk hiện có.

3. **C3 (Ưu tiên P1) — Giải phẫu stylized và khuôn mặt còn thô phẳng**
   - **Bằng chứng PNG thật:** [benchmarks/results/e44/b1-4x.png](../../benchmarks/results/e44/b1-4x.png), [benchmarks/results/e44/courier-rev-4x.png](../../benchmarks/results/e44/courier-rev-4x.png).
   - **Asset/Brief:** Toàn bộ các pilot nhân vật E4–E7.5R.
   - **Root cause:** Cổ là hình ellipse cố định `oval('face', neck, 6, 8)` ([geometry.ts](../../src/generators/character/geometry.ts#L170)), mặt là đa giác đơn không có cằm/mũi rõ, còn `materialPlanes` cho `skin` chỉ kẻ một vệt tối ngang `band('accent', .72, .49, .86, .57)` làm mắt ([material-planes.ts](../../src/generators/character/material-planes.ts#L53-L60)).
   - **Ảnh hưởng ở native 1×:** Đường vai–cổ bị gấp khúc vuông, mặt nhìn hơi giống mặt nạ dẹt với một gạch ngang; ở mũ trùm Courier mảng tối trán chiếm nửa mặt.
   - **Hướng sửa:** **Kết hợp rule + hand-tuned motif** (tỷ lệ sọ/hàm 3/4 chuẩn pixel art, tách shadow hốc mắt/sống mũi thay vì 1 dải ngang cố định).
   - **Rủi ro regression:** Trung bình (ảnh hưởng SHA-256 nếu thay vào v1–v3, cần cô lập trong `v4`).

4. **C4 (Ưu tiên P0) — Cụm pixel chất liệu loang khối, thiếu cấu trúc nếp vải và chất cảm vật liệu**
   - **Bằng chứng PNG thật:** [benchmarks/results/e44/courier-rev-4x.png](../../benchmarks/results/e44/courier-rev-4x.png), [benchmarks/results/e75r/ridge-mechanic/refined/material-4x.png](../../benchmarks/results/e75r/ridge-mechanic/refined/material-4x.png), [benchmarks/results/e75/marsh-harvester/a0/material-4x.png](../../benchmarks/results/e75/marsh-harvester/a0/material-4x.png).
   - **Asset/Brief:** Áo khoác Ridge, áo mưa Marsh, thân/tay Courier và mũ Canal Porter.
   - **Root cause:** `renderCharacterMaterials` ([materials.ts](../../src/generators/character/materials.ts#L78-L90)) tính tọa độ `(u, v)` theo bounding-box trục X/Y của từng part rồi tô polygon chuẩn hóa từ [material-planes.ts](../../src/generators/character/material-planes.ts#L28-L118). Khi tay nghiêng hoặc nếp áo cong, mảng `light`/`shadow` bị cắt thành các đốm chéo bất thường (ví dụ đốm tối giữa bả vai áo xanh Ridge và đốm sáng rời rạc trên tay áo Courier).
   - **Ảnh hưởng ở native 1×:** Nhân vật bị cảm giác “vằn vện / nhiễu mảng” ở ngực và tay áo thay vì nếp gấp vải mượt; thí nghiệm E7.4R/E7.5R đã chứng minh vá RGB cục bộ cho `NO_MEANINGFUL_VISUAL_GAIN`.
   - **Hướng sửa:** **Cần phương pháp mới** (Form-aware shading theo normal/trục xương + cleanup cụm 1–2 px cô lập).
   - **Rủi ro regression:** Trung bình; tách hoàn toàn khỏi pipeline M2P cũ để không làm vỡ SHA E4/E5/E7.6R.

5. **C5 (Ưu tiên P1) — Viền đen đơn sắc `#262334` toàn thân gây nặng khối và tách rời chi tiết nhỏ**
   - **Bằng chứng PNG thật:** [benchmarks/results/e44/b1-4x.png](../../benchmarks/results/e44/b1-4x.png), [benchmarks/results/e85/mistfen-ferry-landing-day-e84-spawn.png](../../benchmarks/results/e85/mistfen-ferry-landing-day-e84-spawn.png).
   - **Root cause:** `renderOutlinedLayers` ([layers.ts](../../src/core/renderer/layers.ts#L4-L10)) vẽ một lớp `outline(filled, ink)` đơn sắc bên ngoài toàn bộ silhouette, không phân biệt vùng nhận sáng (nón/vai trên trái) và vùng bóng (đế giày dưới phải) hay sel-out giữa các lớp trong.
   - **Ảnh hưởng ở native 1×:** Ở 1× trên nền gỗ sáng của cầu tàu, viền đen dày đều làm nhân vật hơi “cắt dán”; ở tay cầm công cụ nhỏ viền đen nuốt mất độ mảnh của cán.
   - **Hướng sửa:** **Cải tiến rule + Selective Outline (Sel-Out)** theo hướng key light upper-left.
   - **Rủi ro regression:** Trung bình (kiểm lại Night P10 contrast để không chìm viền vào nền tối).

#### B. Animation
6. **A1 (Ưu tiên P1) — Thân trên và tay cầm đèn cứng như gắn keo trong chu kỳ bước**
   - **Bằng chứng PNG thật:** [benchmarks/results/e54/packages/surveyor/walk/spritesheet.png](../../benchmarks/results/e54/packages/surveyor/walk/spritesheet.png), [benchmarks/results/e54/packages/courier/walk/spritesheet.png](../../benchmarks/results/e54/packages/courier/walk/spritesheet.png), [benchmarks/results/e85/animation-00.png](../../benchmarks/results/e85/animation-00.png), [animation-04.png](../../benchmarks/results/e85/animation-04.png).
   - **Root cause:** Trong [walk.ts](../../src/generators/character/walk.ts#L38-L44) và [geometry.ts](../../src/generators/character/geometry.ts#L127-L135), hai chân mô phỏng bước đi và tiếp đất chuẩn (`zero slip`), nhưng vai/đầu gần như dịch tịnh tiến cứng theo `bob` và tay cầm đèn giữ nguyên góc cẳng tay–khuỷu tay trừ `lanternSway` 1 px.
   - **Ảnh hưởng ở native 1×:** Chuyển động chân rất chính xác về mặt toán học nhưng tổng thể thiếu sức nặng thân trên (shoulder counter-rotation, độ nảy mũ/túi/đèn).
   - **Hướng sửa:** **Mở rộng rule** trên hệ walk sẵn có (thêm counter-swing vai/tay xa, trễ pha 1 frame cho đèn/túi/mũ).
   - **Rủi ro regression:** Trung bình (phải giữ nguyên `planted` sole anchor và 880 ms cycle contract của E5).

7. **A2 (Ưu tiên P0) — Khóa 1 hướng nhìn (`three-quarter-right`) khiến nhân vật đi lùi/trượt ngang trong game**
   - **Bằng chứng PNG thật:** [benchmarks/results/e85/mistfen-ferry-landing-day-e84-spawn.png](../../benchmarks/results/e85/mistfen-ferry-landing-day-e84-spawn.png) (và ghi nhận trực tiếp trong `E8Smoke.cs:175` *"Existing E5 one-way sheet. Cardinal movement does not select a new directional sprite."*).
   - **Root cause:** `character.ts` khóa `view: z.literal('three-quarter-right')`; chưa có generator hay spritesheet cho hướng trái (không chỉ lật gương vì đèn và túi đeo chéo sẽ sai hướng tay/sáng key light upper-left) và hướng lên/xuống.
   - **Ảnh hưởng ở native 1×:** Trong game Unity thật (`LumaSpriteE85.exe`), khi đi sang trái hoặc lên cầu bến, nhân vật vẫn quay mặt sang phải như đang đi giật lùi — **Critical defect về Product Readiness**.
   - **Hướng sửa:** **Cần thiết kế kiến trúc mới** sau khi chốt static `three-quarter-right` (tối thiểu render được 2 hướng có đảo tay cầm đúng key light, hướng tới 4 hướng).
   - **Rủi ro regression:** Cao nếu sửa gấp trước khi hình thái tĩnh (E9.1) đạt chuẩn.

8. **A3 (Ưu tiên P1) — Chưa có pipeline animation cho đạo cụ 2 tay và áo choàng dài**
   - **Bằng chứng PNG thật:** [benchmarks/results/e75r/canal-porter/refined/day-4x.png](../../benchmarks/results/e75r/canal-porter/refined/day-4x.png), [benchmarks/results/e75r/marsh-harvester/refined/material-4x.png](../../benchmarks/results/e75r/marsh-harvester/refined/material-4x.png).
   - **Root cause:** `buildWalkAnimation` ([walk.ts](../../src/generators/character/walk.ts#L95-L98)) chỉ chấp nhận `standing-hold` (đèn v2) hoặc `standing-free` (Courier v3 không cầm đồ); chưa có logic giữ rigid span cho `both`-hand tool hoặc biến dạng tà áo mưa khi chân sải bước.
   - **Ảnh hưởng ở native 1×:** Tất cả các nhân vật nghề nghiệp mới (Ridge, Marsh, Porter) mới chỉ đứng tượng tĩnh, chưa đi được trong Unity.
   - **Hướng sửa:** **Mở rộng Animation Pipeline** sau khi E9.1 chứng minh được static character 64×64.

#### C. Props
9. **P1 (Ưu tiên P0) — Thiết bị đo/cơ khí mới (Rain Gauge, Beacon, Wind Vane) còn khó nhận dạng ở 1× và viết cứng theo từng brief**
   - **Bằng chứng PNG thật:** [benchmarks/results/e74r/field-rain-gauge/day.png](../../benchmarks/results/e74r/field-rain-gauge/day.png) & [material-4x.png](../../benchmarks/results/e74r/field-rain-gauge/material-4x.png); [harbor-signal-beacon/day.png](../../benchmarks/results/e74r/harbor-signal-beacon/day.png) & [material-4x.png](../../benchmarks/results/e74r/harbor-signal-beacon/material-4x.png); [cliffside-wind-vane/day.png](../../benchmarks/results/e74r/cliffside-wind-vane/day.png) & [material-4x.png](../../benchmarks/results/e74r/cliffside-wind-vane/material-4x.png) (đối chiếu với prop khóa tốt như [e24/barrel-tall-1x.png](../../benchmarks/results/e24/barrel-tall-1x.png)).
   - **Root cause:** [src/experiments/semantic-instrument.ts](../../src/experiments/semantic-instrument.ts#L40-L90) hardcode tọa độ từng `collector`/`beacon`/`vane` bằng `projectBox` và hình khối vuông/tam giác phẳng; trên kích thước 32×32 phần cơ khí nhỏ (cần gạt, trục xoay, vạch chia) bị gộp vào khối kim loại xám, còn viền ngoài `#242534` đồng nhất ăn vào chân giằng và dễ chìm nền Night ([harbor-signal-beacon/night-4x.png](../../benchmarks/results/e74r/harbor-signal-beacon/night-4x.png)).
   - **Ảnh hưởng ở native 1×:** Người xem khó phân biệt Rain Gauge với hộp đo điện thông thường, hay Wind Vane với biển chỉ đường; gặp brief prop hoàn toàn mới thì không tái sử dụng được bộ lắp ghép.
   - **Hướng sửa:** **Tái cấu trúc thành Reusable Semantic Shape Primitives + Sel-Out phân cấp** (chỉ định outline/silhouette nổi theo vật liệu chính và giảm nhiễu cơ khí phụ ở 1×).

#### D. Environment
10. **E1–E3 (Ưu tiên P0/P1) — Cạnh tranh tương phản Actor/Nền (“sticker effect”), lặp họa tiết địa hình và thiếu mạch lạc công năng phà/tay quay**
    - **Bằng chứng PNG thật:** [benchmarks/results/e85/mistfen-ferry-landing-day-e84-spawn.png](../../benchmarks/results/e85/mistfen-ferry-landing-day-e84-spawn.png), [benchmarks/results/e85/floodgate-maintenance-yard-day-spawn.png](../../benchmarks/results/e85/floodgate-maintenance-yard-day-spawn.png), [benchmarks/results/e85/canal-intake-service-platform-day-spawn.png](../../benchmarks/results/e85/canal-intake-service-platform-day-spawn.png), [canal-intake-service-platform-day-staging.png](../../benchmarks/results/e85/canal-intake-service-platform-day-staging.png).
    - **Root cause:**
      - `E1` (Bề mặt): Cỏ rải cụm tam giác lặp đều, mặt đất bệt mảng rộng, đường bờ cắt răng cưa đều đặn và vệt sóng là đoạn thẳng ngang 1 px ([functional-waterfront.ts](../../src/experiments/functional-waterfront.ts#L108-L120)).
      - `E2` (Công năng): Cả 3 cảnh dùng lại cùng ngôi nhà trạm chữ nhật; Mistfen Ferry Landing thiếu thuyền/xuồng cập bến (`BOAT_ASSET_CAPABILITY_GAP`); Floodgate đặt tay quay tách rời trên trụ không thấy trục nối tới cánh cổng ([functional-waterfront.ts](../../src/experiments/functional-waterfront.ts#L28-L73)); Canal Intake bản B2 gốc bị Courier đứng che chỉ còn 19/35 px nước.
      - `E3` (Tương phản): Nhân vật & prop có viền đen `#262334` bao quanh, đặt đè trực tiếp trên sàn gỗ/nền đất phẳng không viền cùng tông độ sáng đèn nhà tranh chấp thị giác với nhân vật.
    - **Ảnh hưởng ở native 1×:** Tổng thể chạy được trong Unity và logic gameplay tốt, nhưng nhìn vẫn giống cảnh lắp ghép prototype hơn là một màn chơi hoàn thiện mỹ thuật.
    - **Hướng sửa:** **Mở rộng quy tắc Composition + ArtDirection** (giảm chói đèn nhà, bổ sung bóng đổ tiếp đất + mép bến chuyển tiếp tự nhiên, đồng bộ sel-out nhẹ cho kiến trúc/prop gắn sàn, thiết kế thuyền/cơ cấu truyền lực trong roadmap E9+).

---

## Phase C — Kế Hoạch Thư Viện Reference Quality

1. **Bốn tầng nguồn Reference:**
   - **Tầng 1 — Owner-Approved LumaSprite Baselines:** Các asset đã được Owner xác nhận tích cực (ví dụ khối trụ cong/gỗ đai sắt của `barrel-tall` E2.4, sự tách rõ của cầu ván gỗ Mistfen B2, nhịp tiếp đất walk E5.2) dùng làm mốc tỷ lệ và tương thích kỹ thuật.
   - **Tầng 2 — Permitted Pixel Art Craft References (Benchmark tham khảo ngoài):** Dùng các chuẩn pixel art công khai/được phép sử dụng (ví dụ **PixelLab** làm chuẩn tham khảo về *tính gọn của cụm pixel, kỹ thuật selective outline, cách đọc bàn tay/nếp áo ở 64×64 và độ rõ của silhouette 1×*). **Nghiêm cấm:** sao chép nhân vật, sao chép sprite thương mại hoặc trích trực tiếp pixel từ bộ dữ liệu không có giấy phép phù hợp. Mọi tệp tham khảo ngoài phải kèm file attribution ghi rõ nguồn, URL/license và phạm vi học hỏi.
   - **Tầng 3 — LumaSprite Art Direction Guide:** Chuẩn hóa cho `weathered-station-v1` (góc 3/4 phải, key light upper-left, bảng màu 4 bậc/vật liệu, quy định value separation giữa background rest / prop / actor / focal interaction).
   - **Tầng 4 — Annotated Good vs Bad Pairs (1× và 4×):** Mỗi cặp ghi chú thẳng nguyên nhân (ví dụ: *Bad:* mảng UV chéo làm loang vai áo Ridge; *Good:* nếp gấp tụ về khuỷu/cổ áo tạo khối trụ rõ).
2. **Quy tắc chống ngộ nhận:** **Tuyệt đối không dùng ảnh do chính generator Engine xuất ra để tự phong làm Gold Standard / Reference chất lượng.** Generator output chỉ được phép làm *Control baseline* hoặc *Candidate* chờ Owner chấm điểm theo `art-quality-rubric-v2.json`.

---

## Phase D — Thiết Kế Thử Nghiệm Character 64×64 E9.1 & Đánh Giá 7 Phương Pháp

*(Chỉ thiết kế kiến trúc & khóa quy trình — **KHÔNG** triển khai code sinh ảnh E9.1 cho tới khi Project Owner duyệt E9.0).*

### 1. Pilot Brief Mới & Fresh Holdout (64×64, `weathered-station-v1`, `three-quarter-right`)
Không dùng lại Ridge Mechanic và Marsh Harvester làm development brief:

- **Development Brief — `harbor-lockkeeper` (Thợ vận hành âu thuyền cảng):**
  - *Mô tả:* Thợ khóa âu thuyền đứng thẳng vai rộng, mặc tạp dề da chống thấm phủ qua áo len dệt gân, đội mũ lưỡi trai vải dầu vành ngắn lộ rõ sống mũi/cằm/bóng mắt, tay gần (overhand thumb-wrapped grip) nắm chắc tay van đồng-gỗ nặng hướng chéo lên, tay xa giữ chốt khóa thắt lưng có đồng hồ áp lực nhỏ gắn đai da.
  - *Điểm khác biệt hình thái:* Khác hoàn toàn dáng khom/áo khoác hộp của Surveyor, khác nón/cờ lê nâng của Ridge, và khác mũ trùm áo mưa của Marsh.
- **Fresh Holdout Brief — `marsh-apothecary` (Người thu chế mẫu đầm lầy — khóa trước khi sinh, chưa dùng để tune rule):**
  - *Mô tả:* Nhân vật dáng thanh mảnh hơn, khăn trùm buông vai lệch (asymmetric shawl/scarf drape) + vạt áo tunic xòe nhẹ chữ A, đầu lộ mái tóc búi sau, tay gần cầm gáo đồng cán dài, tay xa ôm khay lọ thủy tinh nhỏ có nắp gỗ bần.
  - *Mục tiêu Holdout:* Kiểm chứng xem kiến trúc mới có tổng quát hóa sang một tỷ lệ vai–eo–váy và tư thế cầm hai đạo cụ hoàn toàn mới mà không cần viết lại rule thủ công từng pixel hay không.

### 2. Ma Trận So Sánh Công Bằng (`A0` vs `A1` vs `A2`)
Tất cả chạy trên **cùng brief, cùng seed, cùng camera `64×64` `three-quarter-right`, cùng Style Profile `weathered-station-v1`, cùng quy tắc alpha/palette** và **không chọn seed theo ảnh đẹp**:

| Phương án | Cơ chế kỹ thuật | Vai trò trong thí nghiệm E9.1 |
| --- | --- | --- |
| **A0 — Capability-Matched Baseline** | Existing Character Generator v3 + quy tắc attachment/M2P hiện tại được cấp đúng role/trang bị tương ứng của `harbor-lockkeeper` để tránh lỗi so sánh thiếu chức năng (`CAPABILITY_GAP`). | Baseline bắt buộc để đo xem kiến trúc mới thực sự cải thiện chất lượng mỹ thuật hay chỉ thêm đạo cụ. |
| **A1 — Proposed Architecture** | **Part-Based Archetype Construction + Grip-Aware Hand Motifs + Form-Aware Cluster Shading + Selective Outline (Sel-Out)**: chia thân hình thành các mô-đun có thể chọn archetype (broad torso / A-line tunic / apron), đặt socket tay theo hướng nắm (overhand / underhand / pinch) với motif ngón tay 1× thật, tô sáng theo hướng trụ/pháp tuyến bộ phận kèm dọn orphan/doubles 1 px, và đổi viền sáng vùng upper-left. | Candidate chính kỳ vọng đạt bước nhảy rõ về giải phẫu, bàn tay, vật liệu và khả năng tổng quát hóa sang Holdout. |
| **A2 — Alternative Hypothesis** | **Artist-Authored Parametric Silhouette Templates + Procedural Material/Outfit Composition**: dùng mặt nạ bộ phận 1× (đầu/mặt/tay/thân/bước chân) đã được họa sĩ pixel nắn sẵn đường cong & sel-out, sau đó kết hợp biến thể thủ tục (màu, trang bị, vết bẩn, ánh sáng Day/Night). | Thử nghiệm giả thuyết: liệu phần lõi giải phẫu/bàn tay 64×64 có nên dùng micro-template do họa sĩ tinh chỉnh thay vì sinh đa giác toán học hoàn toàn? |

### 3. Đánh Giá 7 Phương Pháp (Section XII)

| # | Phương pháp | Đánh giá khả thi & giới hạn | Vai trò khuyến nghị trong E9.1+ |
| --- | --- | --- | --- |
| 1 | **Rule-based geometry hiện có** (`polygon` + `oval`) | Tốt để khóa khớp/hitbox và đảm bảo zero drift, nhưng tạo khối vuông/gãy bậc trên vai, mặt và chi 64×64. | Giữ làm xương khớp & kiểm tra ranh giới, **không** dùng làm bộ vẽ bề mặt cuối. |
| 2 | **Reusable semantic shape primitives** | Tốt cho prop cơ khí lặp lại (van, ống kính, khung giằng) nếu làm pixel-snapped motif thay vì xoay polygon tự do. | **Áp dụng** cho thiết bị cầm tay & prop E9+. |
| 3 | **Part-based character construction** | Cho phép tách archetype thân, đầu, tay, áo ngoài, túi đeo theo slot ngữ nghĩa với depth sorting chuẩn xác. | **Cốt lõi của A1** (thay thế khối áo/thân đơn nhất của `geometry.ts`). |
| 4 | **Constraint-based pose refinement** | Ngăn lỗi gãy khớp, chồng chân, đứt grip khi đổi pose/animation, nhưng bản thân ràng buộc hình học không làm dáng đẹp hơn nếu thiếu trọng tâm và đường cong tự nhiên. | **Giữ** làm gate an toàn (Shape Gate) sau bước dựng dáng. |
| 5 | **Artist-authored templates + procedural variation** | Cho chất lượng cụm pixel và bàn tay/khuôn mặt vượt trội ngay ở 1×, giữ tính nhất quán style cực cao; nhược điểm là tốn công authoring ban đầu cho bộ template nền. | **Thử nghiệm trực tiếp ở A2** để so bằng chứng 1×/4× với A1 trên cả dev brief lẫn unseen holdout. |
| 6 | **Quality-guided selection** | Hiệu quả khi lọc bỏ lỗi alpha/contrast/orphan tự động; vô ích nếu toàn bộ ứng viên trong pool đều xấu ở tầng giải phẫu. | **Giữ** làm bộ lọc kỹ thuật đầu ra, không dùng để tự chấm mỹ thuật. |
| 7 | **Bounded local refinement** | Hữu ích để sửa 1–2 cụm sáng hoặc pixel rìa lạc sau khi hình đã đẹp; vô ích (`NO_MEANINGFUL_VISUAL_GAIN`) khi silhouette và vật liệu gốc còn yếu. | **Giữ ở vai trò hoàn thiện cuối**, chưa ưu tiên dùng ở E9.1 cho tới khi A1/A2 đạt dáng chuẩn. |

**Lý do không tự mặc định dùng Neural / DeepSeek cho E9.1:** Mô hình sinh ảnh tổng quát hoặc LLM hiện không đảm bảo alpha nhị phân 0/255, khóa bảng màu `weathered-station-v1`, nhất quán lưới pixel 1× không bị blur/mixel, và tách rời từng part mask + rig pivot để đưa thẳng vào `Unity 6000.3.21f1` + chu kỳ walk 8 frame. Giải quyết bài toán từ gốc bằng kiến trúc Part-based / Hybrid Micro-Templates + Form-Aware Clusters vừa giữ nguyên toàn bộ chuỗi Studio–Unity đã thông suốt ở E8.5, vừa cải thiện trực tiếp độ tinh xảo ở 1×.

---

## Rủi Ro & Điều Kiện Chốt
- **Không tự mở E9.1:** Toàn bộ thiết kế `harbor-lockkeeper` và `marsh-apothecary` chỉ ở trạng thái **Đề xuất chờ Project Owner duyệt**.
- **Không tự đánh dấu Artistic PASS:** Mọi phiếu `human-review.json` giữ trống; quyết định cuối thuộc về Project Owner sau khi xem trực tiếp ảnh 1× và 4× trong báo cáo [E9.0-ART-QUALITY-ARCHITECTURE-REVIEW.html](E9.0-ART-QUALITY-ARCHITECTURE-REVIEW.html) hoặc Studio Art Review Workbench.
