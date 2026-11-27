# E8 Runtime Integration Vertical Slice

## E7.6R closeout

`ASSISTANT_REVIEW_RECOMMENDATION`. Mistfen B2 `APPROVED_FOR_ART_REFERENCE`, Floodgate B2 `APPROVED_WITH_LIMITATIONS`, Canal Intake B2 `PARTIAL_PASS`. E7.6R Engineering `APPROVED` theo QA đã báo cáo. Production Integration `NOT AUTHORIZED`. Brief cho phép E8 Runtime Preflight Pilot. DeepSeek `DEFERRED`. Owner review còn trống.

Checkpoint E7.6R là `bdc5114bcc92e7a4603f2fd65d4726dd0ee8f7dd`. Commit `dbe27586c0afe94145ab6242d7137fa4c9a9f257` khóa renderer và holdout. Commit `6cfc654e8e9f6c3d585d541038ede428136d929a` tạo 142 payload E7.6R. Lượt E8 kiểm toàn bộ 142 SHA-256, giữ nguyên A0/B1/B2 và replay E7.6R. Canal Intake vẫn có 19/35 pixel nước lộ dưới cửa. Mistfen thiếu thuyền và hành vi cập bến. Floodgate có tay quay tĩnh, chưa có trạng thái động của cửa. [E7.6R report](../reports/E7.6R-PORTABLE-ART-REVIEW.html) · [Historical SHA-256](../../benchmarks/results/e76r/SHA256SUMS)

## Preflight

| Hạng mục | Kết quả |
| --- | --- |
| Unity Editor | Unity Hub cài Unity 6000.3.21f1, revision `c02631ffc030`. Windows Standalone Mono support có trên đĩa. |
| CLI | CLI 1.0.0, không thấy Editor có Pipeline đang kết nối. Kiểm cập nhật bị chặn DNS. Dùng Editor batchmode đã chứng minh ở E5.4. |
| Sandbox | Project riêng trong `.cache/e8-runtime-acceptance`. Bootstrap qua script và Editor APIs. E5.4 và E6.2 chỉ cung cấp quy trình và nguồn animation đã duyệt. |
| Packages | Built-in Render Pipeline. Test Framework 1.6.0, Physics2D và Tilemap modules. Camera orthographic dùng RenderTexture native 320×208, Point và integer display scaling. Dùng input tích hợp vì sandbox không có Input System package. |
| Studio | Working tree read-only tại `c56837e344dbb42369dc92ebd379e28255db7d84`. Remote main xác minh `593650101ed0cd2a54d045197911fc5b7a8bdd83` ngày 2026-11-27 ICT. RAW_PNG_ONLY đã qua 24 lượt ở E7.6R. Native scene adapter Studio còn thiếu và không nằm trong QA Unity. |

[Unity 6.3 Editor batch arguments](https://docs.unity.com/en-us/engine/6000.3/manual/unity-editor/command-line-arguments/editor) · [Unity 6.3 Tilemap API](https://docs.unity.com/en-us/engine/6000.3/script-reference/unityengine/tilemaps/tilemap) · [Unity 6.3 OverlapBox API](https://docs.unity.com/en-us/engine/6000.3/script-reference/unityengine/physics2d/overlapbox) · [Studio contract preflight](e8-environment-preflight.md)

## E8 Runtime Readiness Matrix

Current interaction hardening, Owner checklist and E8.4 design are tracked in [E8.3 Runtime Readiness](e83-runtime-hardening.md#readiness-matrix-sau-e83). The matrix below records the original E8 pilot.

| Thỏa thuận | Gate | Evidence |
| --- | --- | --- |
| Scene, revision, JSON schema | Engine Output QA | Sidecar v1 kiểm kích thước, version, nguồn, PPU, revision, atlas bounds, landmarks. Giữ JSON/PNG gốc; sinh riêng DTO cho Unity JsonUtility. |
| Atlas và Tile IDs | Unity Import QA | Đọc atlas gốc và tile IDs, slice theo rectangle 16×16, tạo Grid và Tilemap thật. PNG Point, uncompressed, mipCount 1. |
| Foreground | Unity Import QA | Nhập PNG foreground đã bake để kiểm hợp đồng; thời gian chơi dùng các sprite thật tách từ lớp E6 gốc. Underlay chỉ vá nền bị che. Adapter xác nhận ghép lại đúng RGBA khi đặt ở vị trí lịch sử. |
| Coordinate, camera, pivot | Playable Runtime QA | Engine top-left `(x,y)` thành Unity `(x/32,(208-y)/32)`. Tile y lật theo hàng. Pivot normalize theo kích thước sprite. RenderTexture native 320×208, Point và khung integer khi trình bày trên cửa sổ. |
| Walkability và collision | Playable Runtime QA | RLE được kiểm và gộp thành BoxCollider2D đúng pixel. Motor mỗi bước cardinal kiểm cả mask và Physics2D overlap với footprint 19×5. Thử nước, cọc, công trình và đá. Harness đưa lệnh bước qua chung motor với bàn phím; đo tọa độ thu được trong Windows Player. |
| Depth sort | Playable Runtime QA | SpriteRenderer sắp theo contact y, tie theo thứ tự lớp E6. Khi đổi y, actor đổi sortingOrder theo contact position. |
| Interaction anchors | Playable Runtime QA | Berth Mistfen, control stand Floodgate và Canal. Từ chối ở spawn, đứng đúng điểm thì hiện dấu vàng và phát event. Hành vi phà và cơ chế van động nằm ngoài pilot. |
| Animation | Playable Runtime QA | Surveyor Idle E5.1 và W2 E5.2 trong bundle E5.4 khóa. Nhập png sheet và schema timing, pivot [30,59], 1800 ms idle, 880 ms walk. Di chuyển tự do dùng một bộ hướng duy nhất hiện có. |
| Save/reload | Playable Runtime QA | Ghi vị trí và revision, unload Unity scene thật, tạo lại world rồi tải tọa độ, kiểm reach và reset số event. |
| Canal visibility | Known Failure | Đo cửa trên camera readback ngay bố trí lịch sử. Thử Courier ở runtime staging instance hợp lệ, tách original B2. |
| Studio native import | Studio Adapter QA | MISSING. PNG parity trước đây vẫn áp dụng cho PNG và không chứng minh import atlas collider/layers. |
| Artist approval | Artistic Acceptance | PENDING. Owner đánh runtime behavior, data integrity và visual quality riêng. Production vẫn gated. |

## Kết quả thực tế

Windows build, EditMode 2/2, PlayMode 1/1 và sáu lượt GPU Windows Player đều PASS. Sáu ảnh ở spawn khớp chính xác 320×208 RGBA với B2. Đã chụp 14 ảnh camera native, gồm ảnh ở spawn, tương tác và staging. Tương tác chạy sau 186 bước ở Mistfen, 109 ở Floodgate và 126 ở Canal. Đã kiểm Physics2D tại điểm chạm và dùng mẫu tâm pixel trong footprint để loại trường hợp biên rộng của phép overlap. Bàn phím gọi chung motor được kiểm trên Player. Cửa sổ Windows tương tác mở được. Xác minh chuỗi phím hệ điều hành là NOT_RUN vì automation mất foreground trước khi có thể xác nhận kết quả. [Runtime proof](../../benchmarks/results/e8/runtime.json) · [Unity test evidence](../../benchmarks/results/e8/verification.json)

Chạy Windows Standalone Mono, Direct3D11, Ryzen 7 4800H, GeForce GTX 1650, cửa sổ 704×472, camera 320×208, giới hạn 60 FPS. Frame p95 khoảng 16,67 ms. Lần tải đầu khoảng 547 ms, tải sau 28–33 ms. Thiết bị này và chế độ kiểm là phạm vi của kết quả hiệu năng. [Performance](../../benchmarks/results/e8/runtime.json)

Canal reproduction: Courier ở (244,110) che khe đúng theo contact-sort trong bố trí gốc. Staging chỉ di chuyển Courier đến vị trí runtime hợp lệ từ scene JSON, cho 140/140 pixel nước trong ROI ở Day/Night. Dấu tương tác xuất hiện khi Surveyor đến điểm đứng. Kết quả lịch sử 19/35 vẫn giữ nguyên; staging là một giả thuyết bố trí để Owner đánh giá.

## Canal Intake Visibility Quality Gate

Khi brief yêu cầu thấy mặt nước dưới cửa, giữ ROI lấy theo khung cửa, layer quan trọng, palette ký hiệu và một ngưỡng độc lập với gameplay. Kiểm ở spawn và khi các actor đứng vào các vùng điều khiển hợp lệ, dưới Day và Night. So chênh số pixel nước nhìn qua ROI trước/sau occlusion, ghi actor ID và contact order, giữ ảnh gốc cạnh staging. Nếu cửa che đúng thứ tự mà vẫn mất dấu hiệu chức năng, đánh dấu lỗi bố trí/nhận diện. Owner đánh giá khả năng đọc bằng ảnh 1×. Ngưỡng công bố E7.6R là 35 pixel.

## Chạy lại

`pwsh -File scripts/e8-unity/run.ps1` tạo sandbox, nhập, build, chạy EditMode/PlayMode, rồi chạy Windows Player scripted acceptance. `node scripts/verify-e8-runtime.ts` đối chiếu scene capture với RGBA Engine và tạo catalog evidence tại thư mục run. Chạy game tương tác từ `.cache/e8-runtime-acceptance/Player/LumaSpriteE8.exe`. Di chuyển bằng WASD hoặc phím mũi tên, E tương tác, 1–3 đổi cảnh, N Day/Night, F5/F9 lưu/tải. [Runner](../../scripts/e8-unity/run.ps1) · [QA](../../benchmarks/results/e8/verification.json) · [Portable report](../reports/E8-RUNTIME-ACCEPTANCE-REPORT.html)
