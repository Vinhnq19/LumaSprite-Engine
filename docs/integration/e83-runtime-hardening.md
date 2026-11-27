# E8.3 Runtime Hardening và Owner Retest

## Owner Manual Acceptance của E8

`OWNER_MANUAL_ACCEPTANCE_E8 = 5/6_CONFIRMED` · `INTERACTION_DISCOVERABILITY = REVISION_REQUIRED` · `OWNER_INTERACTION_RETEST = PENDING`

| Hạng mục Owner đã kiểm trên Windows Player E8 | Trạng thái |
| --- | --- |
| WASD/mũi tên, nước/cọc/đá | PASS |
| Phím 1–3 đổi cảnh và N đổi ánh sáng | PASS |
| Tìm điểm tương tác Mistfen/Floodgate rồi nhấn E | NOT_VERIFIED |
| Walk → Idle, tỷ lệ và độ ổn định sprite | PASS |
| F5/F9 qua chuyển cảnh | PASS |
| Foreground và occlusion khi di chuyển | PASS |

Owner báo khó nhận biết điểm đứng và phạm vi có thể nhấn E. Logic tự động E8 đã phát đúng event. Mục 3 còn pending cho build E8.3. [Owner record](../../benchmarks/results/e83/owner-acceptance.json) · [E8 QA gốc](../../benchmarks/results/e8/verification.json)

## Interaction root-cause audit

- **Anchor và phạm vi.** Engine cung cấp riêng `at` của vật thể và `stand` để người dùng đứng. E8 đặt điểm sáng theo `at`, chỉ bật khi Manhattan distance tới `stand` ≤5. Ở Mistfen, đầu sàn và tâm phạm vi tương tác lệch nhau. B2 giữ nguyên anchor và range. E8.3 căn dấu vào `stand` với offset 9 px dưới vị trí tiếp đất, có kiểm biên.
- **Motor và sự kiện.** E8 dùng `Input.GetKeyDown(KeyCode.E)` qua cùng `World.Interact` mà harness kiểm. E8.3 đưa cả hai qua `HandleInteractionPress`, giữ nguyên event kind và range, chặn lần kích hoạt thứ hai trong cùng frame.
- **HUD, camera và occlusion.** Dấu cũ là sprite có sortingOrder 12000, thường không bị foreground đè. Dấu không hiện trước khi đã đúng range. Dòng xác nhận cũ phụ thuộc khoảng letterbox. E8.3 chuyển sang screen-space IMGUI trên viewport lưới nguyên. Dấu rỗng lệch khỏi chân Surveyor và tay quay. Prompt nằm ở dải trên viewport, có nền tối và phím E riêng. Có xác nhận ngắn bằng tiếng Việt. Camera 320×208, 32 PPU, point sampling và các sortingOrder thế giới giữ nguyên. [Unity ScreenCapture](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/ScreenCapture.CaptureScreenshotAsTexture.html) · [Vòng đời WaitForEndOfFrame](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/WaitForEndOfFrame.html)
- **Đổi cảnh và nhiều mục tiêu.** Load, Day/Night và F9 xóa feedback cũ, rồi tính prompt từ vị trí mới. Nếu có nhiều mục tiêu hợp lệ, chọn mục tiêu gần nhất, tie lấy thứ tự dữ liệu ban đầu. Giữ mục tiêu đang chọn khi cả hai vẫn trong range và chỉ lệch nhau tối đa 1 px. Scene B2 hiện có một landmark, phép thử hai mục tiêu chạy trong Unity EditMode.

## Readiness Matrix sau E8.3

| Hạng mục | Kết quả |
| --- | --- |
| Engine, atlas và scene | PASS. Adapter tạo lại 96 payload khớp bundle E8. Engine baseline và E7.6R B2 giữ nguyên. |
| Unity world-only camera | WORLD_RENDER_PARITY · 6/6 RGBA exact ở spawn. |
| Interaction UX | COMPOSITED_RUNTIME_UI_CAPTURE · 3 trạng thái trên 3 cảnh Day/Night. Kết quả tự động kiểm dấu, phím E, văn bản, frame duplicate, rời range, đổi cảnh và reload. |
| Windows physical E | NOT_RUN. Harness chạy cùng action thật của Player. Owner kiểm phím E trên bản E8.3. |
| Animation | ANIMATION_TECHNICAL_PASS cho timing, frame order, wrap, pivot, điểm chạm đã khai báo và Walk → Idle. Frame-sequence chạy Unity Player theo rootMotion 32 px/880 ms để kiểm contact. Trong chế độ chơi tự do, motor giữ 42 px/s và dùng một hướng artwork. Lock artwork, artistic motion review còn pending. |
| Canal Intake | B2 gốc 19/35 pixel nước. Runtime staging dời Courier (244,110) → (271,110), 140/140 pixel ở cả hai ánh sáng. Cùng Physics2D, walkable, lượt đi 126 bước và event tại tay quay. E8.3 ghi staging là layout candidate. |
| Studio | E8.4 design và fixture validation. Native Studio implementation/runtime QA NOT_RUN. |
| Owner và Production | Interaction retest pending. Production Integration chờ quyết định riêng. |

## Đo hiệu năng

E8 lưu mean 31,60 ms và p95 16,69 ms cho Mistfen Day. P95 cho thấy phần lớn mẫu ở quanh giới hạn 60 FPS. Log E8 thiếu per-frame timestamps, số lần GC và thời gian capture riêng nên không thể quy chính xác các đuôi dài cho một nguyên nhân. E8.3 ghi thời gian từ process start đến Awake, Awake đến world đầu tiên, 45 frame warm-up, thời gian scene switch, capture, interval đầu tiên, steady-state sau 10 bước, số spike >25 ms và tổng chênh bộ đếm GC thế hệ trong mỗi đoạn route. Frame interval đo theo Unity realtime clock. Camera submit, PNG capture và độ trễ Player là các số đo riêng. [Raw runtime performance](../../benchmarks/results/e83/runtime.json)

## Owner Interaction Retest

Mở `.cache/e8-runtime-acceptance/E83Player/LumaSpriteE83.exe`. Phiếu cần xác nhận từng mục. Hiện tất cả các ô retest còn trống.

- [ ] Mistfen, phím 1. Ở spawn thấy dấu vàng. Nhấn E từ xa, kiểm chưa có xác nhận tương tác.
- [ ] Đi tới dấu ở bến. Khi thấy **E · Kiểm tra bến phà**, nhấn E một lần. Kiểm thông báo **Đã kiểm tra điểm cập bến** rồi chờ tự tắt. Đi ra xa và kiểm lời nhắc E biến mất.
- [ ] Floodgate, phím 2. Tìm tay quay. Trong range, thấy **E · Vận hành tay quay**. Nhấn E một lần và kiểm thông báo event demo. Dùng N để thử lại Night.
- [ ] Canal Intake, phím 3. Kiểm dấu tìm điểm đứng và prompt **E · Kiểm tra cửa lấy nước** đọc được mà HUD không che actor hoặc khe cửa. Thử E trước và sau khi vào range.
- [ ] Lưu tại điểm đứng với F5, đổi cảnh rồi F9. Prompt phải phản ánh vị trí đã tải. Feedback của lần nhấn E trước không xuất hiện lại.

Gửi kết quả từng mục cho Owner record và xác nhận mục tương tác trước khi chuyển trạng thái 6/6. [Phiếu Human Review](../../benchmarks/results/e83/human-review.json) · [Portable Report](../reports/E8.3-RUNTIME-HARDENING-REPORT.html)
