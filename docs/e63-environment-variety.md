# E6.3 Forest Signal Ruins

`E6_3_READY_FOR_HUMAN_VARIETY_REVIEW` trên nhánh `codex/e6-3-environment-variety`. Hai cảnh tàn tích có bản ngày và đêm, cùng một ứng viên C2-Q riêng. E6.2 engineering đã được duyệt, C1 và C2 được duyệt có giới hạn. [Báo cáo chung 1×/4×](LumaSprite-Engine-E6.3-Report.html) · [Closeout E6.2](e62-artistic-closeout.md) · [Khóa baseline](../benchmarks/fixtures/e63/e62-composition-lock.json)

## Kiến trúc và tái sử dụng

Tám phần sản xuất hiện có được dùng lại gồm đường nạp EnvironmentSpec, rule và schema SceneCompositionSpec, terrain E3.4, Pixel Core, painter vật liệu, compositor/depth và collision, bộ xuất/verify PNG, và biên nhập PNG vào Studio. Các pose đứng Surveyor và Courier đến từ E4.4 đã ghim SHA-256. Pilot dùng năm họ mô-đun đá mới và **0/9** mô-đun hình nhà Field Outpost. Painter sử dụng chung Art Style Profile v1 cho mọi mặt. [R1 spec](../benchmarks/fixtures/e63/r1-signal-entrance.json) · [R2 spec](../benchmarks/fixtures/e63/r2-signal-clearing.json)

RuinSite v1 nằm trong module EnvironmentSpec. SceneCompositionSpec v1 chọn RuinSite qua `kind` và cung cấp anchor, map, vùng sáng, điểm nhìn, tương tác và đường đi. Geometry nhận chiều dài, cao, chiều sâu, hướng sứt tường, dạng vòm hoặc bậc, độ rộng lối mở, mật độ rêu, vị trí thiết bị và bật/tắt nguồn sáng. Các thông số dùng trong cả hai fixture. Mỗi mô-đun tạo raster, mask vật liệu, anchor và dấu chân. Bệ đá nằm trên mặt nền đi được. Tường, cổng, cột và bệ tín hiệu xếp theo y của pivot rồi kiểm occlusion với đúng compositor B1. Workspace giữ source và seed trong từng package. CLI `composition` nhận cả Field Outpost và RuinSite.

## Hình khối và cảnh

Flat preview dựng trước để xem dáng và khoảng âm. Gate kiểm vùng mở ở trục cổng cao 60 px. Surveyor cao 56 px và Courier cao 52 px theo alpha footprint của ảnh đã khóa. Kiểm 380 và 420 pixel quét cho hai biên thân chuẩn tại mỗi cổng. Mỗi mảnh phải liền một thành phần 4-neighbor và chạm hàng sàn. Silhouette và collision của lớp phẳng so khớp với Day và Night. Nền dùng tile seam đã duyệt của E3.4.

| Cảnh | Hình học và scale | Chiều sâu và điểm nhìn |
| --- | --- | --- |
| R1 Signal Ruins Entrance | Seed 83, vòm tròn ở (142,123), khoảng mở rộng 36 px, hai đoạn tường đối diện. | Cổng là điểm chính. Tín hiệu nằm bên phải, được tiếp cận từ nhánh sân trước. Cột gãy gần tạo lớp trước. |
| R2 Overgrown Signal Clearing | Seed 137, cổng bậc ở (222,113), khoảng mở rộng 32 px, bệ tín hiệu sang trái. | Tường gãy quấn tầm nhìn từ tiền cảnh trái. Đường vào uốn sang phải, nhường chỗ cho vùng thao tác bên trái. |

Cả hai giữ canvas 320 × 208, 16 px/ô và 32 px/unit, hướng 3/4 phải, ánh sáng chính trên-trái, và cùng logic hình khối/vật liệu. Hai silhouette khác SHA-256. Seed thay đổi cụm đá và nền mà không đổi silhouette mô-đun. R2 dùng tham số layout, seed và vùng sáng từ schema. Render dùng cùng code với R1. Kết quả chứng minh hai bố cục trong họ tàn tích. Các họ kiến trúc khác cần thêm bằng chứng riêng. [Bảng so sánh và lineage](../benchmarks/results/e63/comparison.json)

## Vật liệu và ánh sáng

Tường gãy giữ mặt trên sáng, mặt đứng trung tính và hồi tối. Cổng có mạch đá hướng về vòm. Mặt đá rộng có những cụm khối lớn, khấc gãy và vài chỗ rêu theo mật độ mô-đun. Bệ lát dùng mạch nứt và mảng rêu nhỏ. Tín hiệu có cổ gỗ và đĩa kim loại cũ với tâm amber. Tán rừng tạo khoảng tối có biên theo cụm ở hậu cảnh. Cả hai cảnh dùng cùng ramp đá, gỗ, kim loại, đất và cỏ. Moss mang mask riêng với màu từ ramp cỏ của profile. Chiếu sáng đêm đổi màu nền theo vùng, thêm ánh amber nhỏ quanh bệ và giữ nguyên RGBA actor.

Ở Day, mật độ cạnh vùng chính và phụ R1 là 18,4/27,8 trên 100 mẫu, vùng hậu cảnh là 8,3. R2 tương ứng 16,4/20,8 và 8,5. Tường tiền cảnh R2 giàu chi tiết hơn vùng cổng. Kiểm sự cân bằng ở 1× để xác nhận tường dẫn mắt vào clearing. Cả hai có đủ điểm nhấn để chấm riêng. [R1 Night mask](../benchmarks/results/e63/packages/r1-signal-entrance-night/night-light.png) · [R2 Night mask](../benchmarks/results/e63/packages/r2-signal-clearing-night/night-light.png)

## Chiều sâu, collision và tương tác

R1 quét 1.919 pixel thân trên đường qua cổng và 1.932 trên nhánh sân tới tín hiệu. R2 quét 2.142 và 836. Compositor đánh giá lần lượt 101, 92, 102 và 44 điểm neo trên bốn tuyến. Không có điểm nào che toàn bộ actor. Số pixel actor thấp nhất trên hai đường qua cổng là 622 (R1) và 727 (R2). Toàn bộ actor nhìn thấy trên cả hai nhánh tới bệ tín hiệu. Probe bên hông và sau cổng kiểm chủ đích vật cản, tách riêng phép đo tuyến đi. Tường và cột có collider, còn bệ đá giữ đường đi qua được. [R1 collision](../benchmarks/results/e63/packages/r1-signal-entrance-day/collision-overlay.png) · [R2 collision](../benchmarks/results/e63/packages/r2-signal-clearing-day/collision-overlay.png)

## Kiểm chứng và xuất gói

- Lint, typecheck, build, CLI smoke và **71/71 Engine tests** đạt. Regression xác minh **805 checksum** và tái tạo **361 artifact** lịch sử, cùng archive R&D và E5.3.
- E6.1 tái tạo đúng 104 payload. E6.1R tái tạo 102 và E6.2 tái tạo 91. Khớp cả 109 checksum E6.1R và 100 checksum E6.2 trong danh mục bảo vệ.
- Bốn gói Ruins và C2-Q khớp **96 SHA-256 payload** sau tái tạo. CLI compile xuất và verify 18 file R2 Night. Gate kiểm alpha nhị phân, RGB vùng trong suốt, palette membership, mask/atlas, render lặp, cấu trúc phẳng, collision và ảnh 4× nearest-neighbor.
- Studio `bb5c384` giữ đúng RGBA cho **7 PNG**, gồm bốn cảnh Ruins, C2-Q, atlas và silhouette qua import, lưu, mở lại, export. [Studio parity](../benchmarks/results/e63/studio-parity.json)
- Kiểm gallery trên Chrome ở 320 × 208, 1280 × 832 và viewport 390 px, gồm layer, probe và xuất phiếu 14 tiêu chí. Unity evidence thuộc mốc E6.2 Editor import. E6.3 kiểm xuất bake trong CLI và Studio. [SHA-256](../benchmarks/results/e63/SHA256SUMS)

```powershell
npm run build
npm run composition -- --spec benchmarks/fixtures/e63/r2-signal-clearing.json --out benchmarks/results/run/e63/r2-cli --lighting night
npm run composition -- --verify benchmarks/results/run/e63/r2-cli
npm run benchmark:e63 -- --out benchmarks/results/run/e63/reproduction
$env:LUMASPRITE_ENVIRONMENT_EDITION='e63'
npm run test:environment-studio
Remove-Item Env:LUMASPRITE_ENVIRONMENT_EDITION
npm run report:e63
```

## PR summary

**Title** · Add the Forest Signal Ruins environment variety pilot

**Body** · Record the E6.2 owner decision, retain its baselines and publish a separate C2 night readability candidate. Introduce five parameterized ruin module families and two layouts through the existing composition renderer. Include flat geometry, day/night renders, material and occlusion masks, routes, atlas provenance, Studio import proof and the offline score sheet. Independent art review is pending.

## Đề xuất E6.4

Sau quyết định duyệt E6.3, chọn một tương tác cần truyền đạt rõ trong khung 1×, chẳng hạn tín hiệu từ bệ tàn tích hoặc chỉ báo đứng ở cửa. Thống nhất brief UI/VFX riêng dựa trên mắt nhìn, collision và palette của cảnh được duyệt. Xác định phạm vi thử trong runtime mục tiêu trước khi chọn asset. E6.4 chờ phê duyệt.
