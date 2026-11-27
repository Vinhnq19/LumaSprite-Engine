# E7.4 Pilot Architecture and Candidate Contract

Phạm vi thử nghiệm là prop 32×32 pixel, camera 3/4 phải, ánh sáng trên trái. Hai brief, seed, B1, bối cảnh, giới hạn palette và chế độ holdout được khóa trước khi viết candidate. [Brief lock](../../benchmarks/fixtures/e74/pilot-lock.json) · [Candidate freeze](../../benchmarks/fixtures/e74/candidate-freeze.json) · [E7.3R Final Acceptance](e73r-final-artistic-acceptance.md)

| Hệ thống | Phần tái sử dụng |
| --- | --- |
| AssetSpec và ShapeSpec | Seed schema, canvas native, kiểm bounded input. Props production hiện mô tả chest/barrel. Pilot dùng một brief versioned cho thông số hình học thiết bị và giữ AssetSpec production. |
| Geometry | `projectBox`, Face, strut chiếu theo depth, ellipse spans và raster polygon. Hai tổ chức support riêng dùng chung các primitives, kích thước nhập và pivot tại mặt đất. |
| Material | `materialPiece` gán màu kèm ownership, artwork B1 cung cấp ramp kim loại và kính xanh hoặc amber. Seed xác định mức chất lỏng. Mảng sáng dùng patch phẳng có vị trí liên quan hướng sáng. |
| Quality | `inspectStructure`, binary alpha, PNG encode/decode, SHA-256, `contextContrast` trên instance được phân vùng trong thật cảnh. Silhouette, mask và depth của shape là đầu vào của material. |
| Local patch | Một hàng meniscus nằm trong mask kính. Một byte logic mỗi pixel phân biệt edit và protected, theo ý tưởng mask của Studio Adapter v1. SHA-256 lấy RGBA row-major của mọi pixel ngoài mask, gồm pixel trong suốt. |
| Studio | Kiểm raw PNG qua import, save, reopen và export. Cấu trúc endpoint, product receipt và quyền apply thuộc Studio Adapter hiện hành. |

[Nguồn ShapeSpec](../../src/specs/prop-shape.ts) · [Studio Adapter v1](../integration/studio-adapter.md) · [Quality Contract](../art-quality/quality-contract-v1.md)

## Candidate contract v1

`A0 baseline → A1/A2 structure → per-shape material → selected material refinement → one local refinement → Owner review`

Mỗi case QA giữ SHA-256 brief, seed, style/profile, camera, shape recipes, anchor, silhouette hash, masks, bounds và kiểm tra cảnh. `parent` tham chiếu bước trước. Shape gate kiểm margin, thành phần liên thông, khoảng trống, vùng chức năng, độ sâu chiếu và chân tiếp đất. Candidate fail được giữ flat và silhouette; material cần gate kỹ thuật PASS. A0 có trạng thái tham chiếu từ generator hộp hiện có. Quyết định nhận dạng ở native 1× thuộc phiếu người duyệt. Material giữ geometry và ownership, tối đa 13 màu. Cảnh Day/Night giữ route, collision, placement và phần nhân vật khả kiến. Đèn amber của beacon là chi tiết sprite; thử nghiệm đặt vào bối cảnh bến đá, không có chiếu sáng phát xạ riêng hoặc mặt nước.

Field Rain Gauge A1 được khai báo trước cho một material refinement làm đậm tầng chất lỏng và một local refinement làm sáng đường mặt nước. Harbor Signal Beacon ở chế độ đánh giá holdout, qua cùng geometry/material gates với hai topology và không dùng tùy chọn chỉnh. Số lần gọi, CPU và kích thước được thu từ lần đo thực tế. Không thay hình để vượt material gate. [Nguồn pipeline](../../scripts/benchmark-e74.ts) · [Benchmark](../../benchmarks/results/e74/benchmark.json) · [Review JSON](../../benchmarks/results/e74/human-review.json)

## Đề xuất mở rộng

- **Character.** Gắn structure gate vào body plan, landmarks và shape lock. Tối đa hai bản stance tại cùng pivot. Kiểm silhouette 1×, grip, bước chuyển pose, vật che và palette nhận diện trước khi thử một mask áo hoặc phụ kiện.
- **Environment.** Tách mặt bằng và route khỏi module faces. Thử tối đa hai topology có mục tiêu riêng, như mái che hở và mặt quay vào lối đi. Kiểm collision, portal, layer ownership, kích thước actor và phản hồi Day/Night. Chọn một face để thử material refinement sau gate cấu trúc.
- **Review và chi phí.** Ưu tiên một candidate có giả thuyết rõ cho mỗi failure thực tế. Ghi chi phí render offline theo pass. Dùng holdout bị khóa tên, seed và constraints trước khi ứng viên chạy. Owner duyệt từng họ, giữ Neither và ảnh thất bại. Tích hợp Studio cần versioned receipt, rollback và quyền apply hiện hành.

Các mục mở rộng ở mức đề xuất. [E7.4 proposal ban đầu](e74-quality-guided-generation-proposal.md)
