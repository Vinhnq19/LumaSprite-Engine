# E6.4 Pixel UI/VFX Quality Pilot

`E6_4_READY_FOR_HUMAN_UI_VFX_REVIEW` trên nhánh `codex/e6-4-ui-vfx-pilot` từ E6.3 `6efc683`. Hai icon và hai hiệu ứng ở native 1× đã xuất thành gói riêng. Các ảnh so sánh dùng R1, C1 và holdout R2 ở ngày và đêm. [Báo cáo chung offline](LumaSprite-Engine-E6.4-Report.html) · [Biên bản nghiệm thu E6.3](e63-artistic-acceptance.md) · [Khóa nguồn](../benchmarks/fixtures/e64/e63-environment-lock.json)

## Audit kiến trúc và style

UISpec v1 định nghĩa canvas và loại icon. Hai trạng thái của dấu tương tác dùng cùng điểm đặt. Nguồn E2.4 của barrel được ghim bằng SHA-256. VFXSpec v1 định nghĩa preset hình, thứ tự pha, thời lượng và chế độ kết thúc. Signal Activation ghim manifest của bệ tín hiệu R1. Pickup Sparkle ghim cùng ảnh barrel đã duyệt. Cả bốn dùng Art Style Profile v1 đã ghim. [UISpec source](../src/specs/pixel-effects.ts) · [VFX timing](../benchmarks/results/e64/packages/signal-activation/timing.json)

Renderer dựng polygon, ellipse, span và cụm pixel bằng Pixel Core. UI lấy contour, kim loại và amber từ profile, đồng thời dùng ramp gỗ đã duyệt của E2.4. Signal lấy ramp amber từ profile với một màu lõi nhạt. Pickup dùng một ramp xanh lá bạc và teal riêng. PNG, alpha và nearest-neighbor sử dụng đường xuất hiện có. Các slot atlas được cắt và kiểm RGBA qua hàm cắt sprite strip hiện có của AnimationSpec. Bộ timing pilot dùng pha riêng của hiệu ứng, tách khỏi contract gait E5.4. Gameplay benchmark ghép raster theo lớp lên scene đã khóa.

## Icon tại 1×

| Asset | Hình và vật liệu | Bằng chứng |
| --- | --- | --- |
| Interaction Icon | 16 × 16. Hình bàn tay sáng trên nền slate, viền bạc lúc Normal và amber lúc Active, chóp chỉ xuống vật thể. | 168 px alpha ở mỗi trạng thái. Cùng silhouette, 75 px đổi màu. Chênh luma giữa glyph và nền icon ở Normal là 176. |
| Barrel Inventory Icon | 32 × 32. Thân gỗ vồng, nắp sáng và hai đai kim loại được vẽ lại cho ô đồ. | Nhận dạng giữ hai dải đai và phần đầu thu hẹp. Mặt trước 26 px tại chỗ rộng nhất, so với 22 px của barrel gốc. |

Gallery cho xem icon trên nền sáng và tối ở 1× và 4×. C1 đặt dấu tương tác ngay trên thùng và hiển thị inventory ở một ô phía dưới bên phải. Ảnh E2.4 gốc có trong gallery để duyệt độ nhận dạng và hướng sáng. [Interaction QA](../benchmarks/results/e64/packages/interaction-icon/qa.json) · [Inventory QA](../benchmarks/results/e64/packages/inventory-barrel/qa.json)

## Hiệu ứng và nhịp

| Hiệu ứng | Nhịp và hình | Peak | Kết thúc trong suốt |
| --- | --- | ---: | ---: |
| Signal Activation | 7 frame, 685 ms. Hai đoạn cung mở dần, trụ sáng và lõi vàng nhạt đánh dấu kích hoạt, sau đó còn đốm đuôi. | 182 px | 130 ms |
| Pickup Sparkle | 6 frame, 410 ms. Một dấu chớp xanh bạc và các đốm ngắn bay lệch lên trên thùng. | 44 px | 95 ms |

Mỗi active frame có cụm ít nhất 2 px theo 4-neighbor và giao alpha với frame hoạt động trước. Dải alpha cho thấy giới hạn hình, và bảng timing ghi coverage, kích thước cụm, overlap và palette. Các gói bàn giao dùng one-shot. Tại mốc kết thúc, sampler one-shot ngừng và sampler repeat trở về frame đầu sau frame clear. Gallery có cả phát một lượt và lặp có chủ đích. [Signal QA](../benchmarks/results/e64/packages/signal-activation/qa.json) · [Pickup QA](../benchmarks/results/e64/packages/pickup-sparkle/qa.json)

## Sáu biến thể gameplay

| Cảnh | Anchor | Phản sáng ở peak ban đêm | Kết quả |
| --- | --- | ---: | --- |
| R1 Signal Ruins Entrance | (205,77), đọc từ module tín hiệu | 147 px | Cung amber và lõi kích hoạt tập trung quanh đĩa. |
| C1 Survey Station Courtyard | (87,146), lấy từ footprint của barrel | 0 px | Dấu tương tác chuyển sang Active trong buildup và peak. Ô inventory ghi nhận thùng ở peak. |
| R2 Overgrown Signal Clearing | (127,94), cùng cách suy ra từ module | 259 px | Cùng dải Signal Activation và timing ở địa hình, anchor và nền khác. |

Lớp phản sáng được lưu riêng và giới hạn bởi vật liệu gỗ, kim loại, đá, amber và nền lát. Màu được áp ở các pha gần peak ban đêm. Mask actor tách khỏi lớp phản sáng. Cả sáu biến thể giữ đúng 2.069 pixel RGBA nhân vật ở mọi frame. Signal trở về đúng raster gốc sau dissipation. C1 minh họa phản hồi UI trên thùng đã đặt sẵn trong cảnh. Giá trị pixel ở bảng đo compositing, người duyệt kiểm thêm cảm giác nhịp, nhận dạng và cân bằng sáng ở 1×. [R1 Night QA](../benchmarks/results/e64/gameplay/r1-signal-entrance-night/qa.json) · [C1 Day QA](../benchmarks/results/e64/gameplay/c1-courtyard-day/qa.json) · [R2 Night QA](../benchmarks/results/e64/gameplay/r2-signal-clearing-night/qa.json)

## Kiểm chứng kỹ thuật và Studio

- Lint, typecheck, build, CLI smoke và **73/73 Engine tests** đạt. Kiểm spec sai kích thước hoặc pha, hash nguồn sai, pixel alpha/RGB, palette, atlas, frame consistency, timing và cả hành vi one-shot/repeat.
- Khớp **805 checksum** lịch sử và **361 artifact** tái tạo. E6.1 xác minh 104 payload, E6.1R 102, E6.2 91 và E6.3 96 sau triển khai.
- **4 gói và 6 biến thể cảnh** tái tạo khớp **82 SHA-256 payload**. CLI build xuất và verify 14 file Signal Activation. Scene gốc được đối chiếu với hash manifest. [Benchmark](../benchmarks/results/e64/benchmark.json) · [SHA-256](../benchmarks/results/e64/SHA256SUMS)
- Studio `bb5c384` giữ đúng RGBA cho 3 PNG UI và 13 frame VFX. VFX thử qua codec Studio Engine Result v1 offline, lưu/mở lại, pivot, thời lượng và tag one-shot. [Studio parity](../benchmarks/results/e64/studio-parity.json) · [E8 Integration Backlog](integration/e8-backlog.md)
- Chrome kiểm 1×/4× và bố cục 390 px, alpha, one-shot, repeat, 6 scene composites và xuất phiếu 10 tiêu chí UI, 8 tiêu chí VFX. Đây là bằng chứng playback trong trình duyệt. Quy trình tích hợp runtime game thuộc E8.

```powershell
npm run build
npm run pixel-effects -- --spec benchmarks/fixtures/e64/signal-activation.json --out benchmarks/results/run/e64/cli-signal
npm run pixel-effects -- --verify benchmarks/results/run/e64/cli-signal
npm run benchmark:e64 -- --out benchmarks/results/run/e64/reproduction
npm run test:pixel-effects-studio
npm run report:e64
```

## PR summary

**Title** · Add native Pixel UI and VFX pilots with Forest Signal Ruins scene tests

**Body** · Close and lock the E6.3 owner decision. Add a two-state interaction seal, a redrawn E2.4 barrel icon and two distinct timed effects based on the shared style profile. Verify transparent PNG and atlas data, separate masked signal reflections, and exact actor RGBA on six scene cases including R2. Hand off Studio compatibility evidence and an offline art review gallery. Independent UI and VFX approval is pending.

## Chuẩn bị E7

Đề xuất một bộ rubric chung theo từng họ asset, ảnh A/B native 1×, checkpoint phong cách và ảnh/manifest của trường hợp holdout. Dùng diagnostic để tìm nguyên nhân về độ đọc, palette, cụm và lighting rồi ghi mục ra quyết định cho người duyệt. Ghi các giới hạn tường, đá, rêu, ánh sáng, thứ bậc điểm nhìn và C2-Q trong [E7 Art Quality Backlog](art-quality/e7-backlog.md). E7 chờ Project Owner duyệt.
