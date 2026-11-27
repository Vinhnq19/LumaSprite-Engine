# E7.2-A Relay Material Pilot

**`E7_2A_READY_FOR_HUMAN_MATERIAL_REVIEW`**. M0 tái tạo Relay A1. M1 chỉ đổi màu và vai trò vật liệu trong hình khối đã khóa. [Gallery 1×/4×](E7.2-A-Relay-Material.html) · [A1 shape lock](../../benchmarks/fixtures/e72a/a1-lock.json) · [E7.1R Human Review Pack](e71r-human-review.md)

## M0, M1 và holdout

M1 dùng cùng `materialPiece`, ramp B1, renderer outline và các mặt chiếu của A1. Mặt trước dùng mảng gỗ liền. Hai viền kim loại bám mặt trước và mặt khuất. Highlight kim loại nằm trên mặt nhận sáng, còn tín hiệu amber thành một dải liền trong hốc cũ. Biên silhouette, flat geometry, pivot [12,29] và anchor C1 [180,162] trùng từng pixel.

| Kết quả | Relay A1 | Ridge Survey Receiver |
| --- | ---: | ---: |
| Silhouette / pixel alpha đổi | 517 / 0 | 492 / 0 |
| Pixel RGBA đổi / pixel đổi vai trò | 149 / 94 | 156 / 98 |
| Cụm cùng màu lớn nhất của gỗ | 35 → 42 | 30 → 54 |
| Cụm gỗ một pixel | 2 → 0 | 3 → 0 |
| Vùng amber | 5 → 14 px | 5 → 14 px |
| Luma gỗ–kim loại median / P10 | 6 → 29 / 6 → 3 | 6 → 29 / 3 → 3 |

Receiver là prop mới thấp chiều sâu hơn và cao hơn Relay, seed `3091`. Brief, tham số hình khối và điều kiện so sánh đã khóa trước khi viết rule M1. Cùng rule chạy trên hai mẫu. Ở 1×, gỗ và viền kim loại dễ tách hơn, cửa amber cũng rõ hơn trên C1. Các biên ít tương phản vẫn tồn tại ở phía khuất. **`STRUCTURE_LIMITATION`**: cửa amber gợi ý thiết bị, nhưng hai mẫu vẫn có dáng hộp và chưa thể hiện rõ chúng đo hoặc phát tín hiệu gì khi đứng riêng. Chất lượng nghệ thuật đang chờ người duyệt. [Holdout lock](../../benchmarks/fixtures/e72a/holdout-lock.json) · [Relay QA](../../benchmarks/results/e72a/relay/qa.json) · [Receiver QA](../../benchmarks/results/e72a/receiver/qa.json)

## Kiểm chứng

- Lint, typecheck, build, CLI smoke và 73/73 Engine tests. Xác minh 805 SHA-256 lịch sử và tái tạo khớp 361 artifact, E7.1 79 payload và E7.1R 54 payload. Các catalog E6.4, E7.1 và E7.1R khớp.
- E7.2-A tái tạo khớp 32 payload gồm 30 PNG và 2 QA record. Review Pack E7.1R tái tạo khớp 24 PNG mới và danh mục. Đã kiểm binary alpha, flat/silhouette, material role và ramp từng pixel, cụm pixel, diff, scene placement và PNG export.
- Studio `c56837e` giữ RGBA qua import, lưu, mở lại và export cho 7 PNG. Workbench đọc 12 cặp review và giữ toàn bộ điểm `null`. Gallery Chrome offline đọc đủ 26 lượt PNG qua các bộ chọn, giữ canvas 1× trên desktop và cuộn 4× trong panel ở mobile 390 px. Phiếu có 8 tiêu chí và giữ điểm riêng theo mẫu. [Parity](../../benchmarks/results/e72a/studio-parity.json) · [Workbench index](../../benchmarks/results/e72a/review/index.json)

[Benchmark manifest](../../benchmarks/results/e72a/benchmark.json) · [SHA-256](../../benchmarks/results/e72a/SHA256SUMS) · [Report Index](INDEX.md). Chạy `npm run benchmark:e72a`, `npm run review:e71r`, `npm run report:e72a` và `npm run test:e72a-studio` trong Engine checkout cạnh Studio. Gallery mở offline với PNG trong checkout. Report Index nằm trong catalog E7.1R đã khóa. HANDOFF hiện hành dẫn đến bộ E7.2-A.

## Chuẩn bị E7.2-B

Sau khi Owner chọn Production hoặc Bonded Fracture và cấp phép, dùng mặt phẳng cùng mask hình khối đã duyệt để đánh giá năm việc. Weathering tập trung ở mặt hứng mưa. Khe nứt bám mạch xây và mặt gãy. Rêu bám khe, chân ẩm và đá lộ. Biên vật liệu dùng ramp riêng theo đá và rêu. Highlight nằm trên mặt nhận sáng và kiểm cả ngày lẫn đêm. Dùng R1/H1 để phát triển rồi khóa một holdout mới. E7.2-B chờ Owner.

## PR summary

Base `ee8a4c9`, head `codex/e7-2a-material-quality`. Hoàn thiện gói duyệt R1/H1/H2 và bổ sung M0/M1 cùng Receiver holdout. Giữ baseline production, shader/palette chung và dữ liệu đã nghiệm thu. [Handoff](../../HANDOFF.md)
