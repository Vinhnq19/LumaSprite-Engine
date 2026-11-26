# E7.1 Structure & Silhouette

**`E7_1_READY_FOR_HUMAN_STRUCTURE_REVIEW`**. Hai cặp thử nghiệm dùng chung palette và góc nhìn trong từng phép so sánh. Gallery có hình phẳng, silhouette, material mask, contour, cảnh ngày/đêm, 1×, nearest 4× và phiếu duyệt chấm riêng từng tiêu chí. [Báo cáo HTML](LumaSprite-Engine-E7.1-Report.html) · [E6.4 closeout](e64-artistic-acceptance.md) · [Root-cause audit](art-quality/e7-root-cause.md) · [Quality Contract v1](art-quality/quality-contract-v1.md)

## Hình khối

`Spec → Structural intent → Candidate geometry → Silhouette validation → Material pass → Native 1× review`

- Relay Box dùng schema nội bộ 32×32 vì brief thiết bị, cửa tín hiệu và hai chân đỡ chưa có biểu diễn trong AssetSpec prop production. A0 dùng cùng primitive `projectBox` một khối như nhánh Composed Prop. Hai ứng viên dùng chung painter thử nghiệm trên vật liệu gỗ, kim loại và amber của B1. E2.4 Tall Barrel là mẫu craftsmanship riêng, với hình dạng khác. [Relay source](../src/experiments/structure-quality/relay.ts) · [Spec](../benchmarks/fixtures/e71/relay-box.json)
- R1 Structure Q dùng spec composition production. Hình ứng viên chỉ thay phần vách trên dải chân tường, tạo thành năm đoạn với đỉnh, độ lùi và mép lộ có hướng. Mask được kiểm trước khi dùng pixel vật liệu cũ ở những mặt trùng và cùng ramp cho phần mới. Bộ sắp xếp và ownership đối chiếu với render production. Hai vách dùng chung quy tắc phụ thuộc seed và kích thước module. [Ruin source](../src/experiments/structure-quality/ruins.ts) · [Diagnostics](../src/experiments/structure-quality/diagnostics.ts)

| Mẫu | Kết quả kỹ thuật | Quan sát để duyệt ở 1× |
| --- | --- | --- |
| Relay A0 → A1 | Cùng thân nối liền, đáy y=28, anchor cảnh [180,162]. Coverage 520 → 517 px, thêm 62 và bỏ 65. | A1 cho thấy vai lùi và chân đỡ rõ hơn. Cửa amber giữa khe tối khác một rương kín. Ngữ nghĩa thiết bị ở 1× và biên gỗ–kim loại cần người duyệt xác nhận. |
| R1 → R1 Structure Q | Day/Night cùng thay +218/−483 px silhouette. Hai hành lang có 1.919 và 1.932 điểm pixel kiểm tra. Control khớp RGBA E6.3. | Nhiều khoảng trống theo chiều sâu hơn quanh vách. Kiểm tra độ sắc của các vết gãy và khả năng đọc đường vào cổng. |
| H1 control → H1 Structure Q | Day/Night cùng thay +240/−713 px silhouette. Hai hành lang có 2.142 và 836 điểm pixel kiểm tra. | Phần phía trước thấp hơn, cột tín hiệu tách khỏi mặt đá rõ hơn. Một số mép bậc còn cảm giác bị cắt vuông. Đánh giá H1 độc lập trước khi kết luận thiết kế tổng quát. |

Triển khai khóa H1 trước khi dựng ứng viên, seed 2117. Layout mới dẫn về cổng qua lối gấp, thấp ở gần bên trái và cao ở xa bên phải. Dùng quy tắc đã phát triển trên R1 ở H1 rồi lưu cả control và candidate. Collision trước/sau khớp ở cả bốn cặp. Surveyor giữ 1.072 pixel thấy được, Courier giữ 997, đối chiếu cả ownership và RGBA gốc. H1 đủ điều kiện kỹ thuật để duyệt trên một layout thử nghiệm. [H1 lock](../benchmarks/fixtures/e71/holdout-lock.json) · [Architecture comparison](../benchmarks/results/e71/ruin/compare.json) · [Relay comparison](../benchmarks/results/e71/relay/compare.json)

## Regression

| Gate | Kết quả |
| --- | --- |
| Engine | Lint, typecheck, build, CLI smoke và 73/73 tests PASS. |
| Lịch sử E2–E5 | 805 SHA-256 và 361 artifact tái tạo khớp byte, gồm E2.4 (65), E3.4 (124), E4.4 (63), E5.1 (31) và E5.2 (78). E5.3 archive 50 và R&D archive 54 khớp. |
| Lịch sử E6 | E6.1/E6.1R/E6.2/E6.3/E6.4 tái tạo 104/102/91/96/82 payload. E6.1R–E6.4 đối chiếu 109/100/105/94 mục trong SHA-256 catalog. |
| E7.1 | 79 payload tái tạo khớp SHA-256. Xác minh alpha/RGBA, hợp lệ palette, liên kết hình khối, mask, contour, vị trí, che khuất, route, footprint và manifest. |
| Studio `c56837e` | 6 PNG thử nghiệm giữ nguyên RGBA qua import, save, reopen và export. E6.4 giữ 3 UI PNG và 13 frame VFX kèm timing/pivot. |
| Gallery Chrome offline | Đủ layer/tỷ lệ của Relay và 24 tổ hợp layout/light/layer của ruins, mặc định 1×. Mobile 390 px scroll bên trong panel ở 4×. Phiếu duyệt xuất 46 trường và giữ ô trống dạng null. |

[Corpus 33 mẫu A / 2 B / 1 C](../benchmarks/results/e71/corpus.json) · [Manifest E7.1](../benchmarks/results/e71/benchmark.json) · [SHA-256](../benchmarks/results/e71/SHA256SUMS) · [Studio parity](../benchmarks/results/e71/studio-parity.json)

Từ thư mục Engine, chạy `npm run benchmark:e71 -- --out benchmarks/results/run/e71-repro` và so `benchmark.json` với bản công bố. `npm run report:e71` kiểm SHA-256 payload rồi dựng lại HTML offline. Với Studio checkout cùng cấp, chạy `npm run test:structure-quality-studio`. Dùng `node scripts/verify-e54.ts --history` để kiểm kho lịch sử E2–E5. Runtime UI/VFX của game đích vẫn là `PRODUCTION_GAME_RUNTIME_NOT_TESTED`. [E8 backlog](integration/e8-runtime-backlog.md)

## PR summary

Base `77fbaa5`, head `codex/e7-art-quality-foundation`. Ghi acceptance E6.4 và baseline lock. Thêm audit và rubric E7, pilot độc lập cho Relay Box và kiến trúc, holdout H1, báo cáo offline và regression trên toàn bộ benchmark cũ. Review 1× và 4× trong gallery, ghi quyết định riêng cho A1, R1 Q và H1 Q. Pilot được gọi bằng benchmark E7.1.

## Đề xuất E7.2 Material & Pixel Craft

Sau khi Owner duyệt hình khối E7.1 và cho phép triển khai, khóa những silhouette được chọn. Thử một pass riêng cho viền tiếp xúc kim loại/gỗ của Relay và rêu bám theo khe đá của ruin. Giữ cùng scene, ánh sáng và palette. So theo ranh giới role, kích cỡ cụm ở 4×, độ đọc ở 1× và dùng holdout mới đã khóa. E7.2 đang chờ Owner.
