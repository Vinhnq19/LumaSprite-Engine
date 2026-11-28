# E9 · Character Architecture Decision

**Authority** `ASSISTANT_REVIEW_RECOMMENDATION`. Kết quả kỹ thuật E9.1S-R được đóng hồ sơ. Quyết định mỹ thuật và điểm số của Project Owner vẫn chờ duyệt. [Gallery E9.1S-R](E9.1S-R-FINAL-CHARACTER-REVIEW.html) · [Phiếu Owner chưa ký](../../benchmarks/results/e91sr/human-review.json)

## Closeout E9.1S-R

| Phạm vi | Khuyến nghị |
| --- | --- |
| E9.1S-R Engineering | `PASS`. Checkpoint đạt `E9_1SR_READY_FOR_FINAL_OWNER_STATIC_ART_REVIEW`. |
| Headwear Bounds | `ACCEPTED_FOR_RESEARCH`. Cartographer đạt lề y=1 và giữ grip, stance, pivot. Highland cũng đạt cùng ràng buộc sau khi khóa. |
| Kiến trúc | **Option B · `RETAIN_SELECTED_COMPONENTS_ONLY`** |
| B3/S0 | `RESEARCH_BASELINE`. Giữ đối chứng và PNG đã khóa theo đúng revision. |
| Harbor Lockkeeper | **S2**. Viền Night đọc rõ hơn ở cặp so sánh. Dùng S3 khi cần đối chiếu chức năng tay van. |
| Marsh Apothecary | **S3**. Lọ tách vai trò rõ hơn bằng chiều cao và màu. Đọc Night còn phụ thuộc nền cảnh. |
| Cliffside Lantern Keeper | **S3**, chờ xác nhận quai có rơi tự nhiên từ vai và có cảm giác chịu lực ở 1×. |
| Coastal Cartographer | **S3-R**, giữ cho nghiên cứu. S1–S3 gốc trượt padding. |
| Highland Weather Observer | **`REVISION_REQUIRED`** cho wind instrument. Mũ và grip đạt kỹ thuật. Dụng cụ vẫn dễ đọc thành thanh chữ T ở 1×. |
| B4 | `NOT_SELECTED`. |
| Game-ready | `GAME_READY_ART_NOT_APPROVED`. |
| E8.5 Owner Runtime Acceptance | `PENDING`. |
| E9.2 và DeepSeek | `E9_2_NOT_AUTHORIZED` · `DEEPSEEK_DEFERRED`. |

Checkpoint `7bd0080a9a2474ac9c2bc5085df9c97f6bd8ffec`, fix `71b927e0cf7e14eb637c5fd9b017b69760f5b7cc`. Xác minh 85/85 test, 805 SHA lịch sử, 79 tệp tái lập, 15 PNG round-trip qua Studio và 40 bố trí cảnh tĩnh. Phiếu Owner giữ nguyên byte, PNG khóa giữ nguyên. [Technical QA](../../benchmarks/results/e91sr/technical-qa.json) · [Manifest](../../benchmarks/results/e91sr/SHA256SUMS)

## Quyết định kiến trúc

Giữ part ownership, costume-aware stance, grip/socket, cụm sáng tối nhỏ quanh mặt, fit mũ trước viền, palette lock và kiểm định raw pixel. Dùng chúng làm công cụ cho nghiên cứu và đối chứng, chọn nghệ thuật theo từng nhân vật. Kết quả Highland cho thấy lỗi nhận diện đồ nghề vẫn tồn tại dù đủ lề, stance và grip. Đây là câu hỏi về silhouette và ngôn ngữ hình của dụng cụ ở 1×.

Giữ Option B làm hướng hiện hành. Đưa proposal Hybrid ra Owner để quyết định có đầu tư một bộ component phù hợp hay tiếp tục chọn thành phần từ pipeline hiện có. Nếu Hybrid không tạo ra cải thiện rõ ở 1× hoặc làm việc chỉnh art khó hơn, phương án tiếp theo là giữ Option B hoặc cân nhắc thư viện curate thủ công qua một quyết định riêng. [Proposal Hybrid và thiết kế A/B/C](E9-HYBRID-FEASIBILITY-PROPOSAL.md)

Static art vẫn `STATIC_ART_REVIEW_PENDING`. Unity runtime và directional animation ở `NOT_RUN`. Chưa có milestone triển khai tiếp theo được ủy quyền.
