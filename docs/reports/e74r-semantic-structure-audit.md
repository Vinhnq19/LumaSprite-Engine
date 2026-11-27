# E7.4R Semantic Structure and Context Audit

Đối chiếu mask, native gameplay, shape stats và pixel trước/sau theo Quality Contract v1. [Quality Contract](../art-quality/quality-contract-v1.md) · [Quyết định E7.4](e74-artistic-decision.md) · [Gallery E7.4R](E7.4R-PORTABLE-ART-REVIEW.html)

## Nguyên nhân trong E7.4

- **Rain A1/A2.** Shape Gate kiểm liên thông, khung, khe âm, pivot và diện tích vùng kính. Cả hai có 14 px trong vùng khe kiểm, 70 px vùng đo. Cổng này còn thiếu hình chiếu của miệng hứng riêng. Mái hộp chồng thanh ngang và thân kính thành một khối ở 1×. Vạch chia đổi cách đọc vùng đo, người xem vẫn có thể hiểu đây là hộp điều khiển.
- **Beacon A1/A2.** A1 có công tắc nằm ngay sát trụ. A2 dùng một khối bản lề giữa hai chân giằng. Tại 1×, phần cơ khí nằm trong khối vật liệu kim loại, tiếp giáp thân và mép đèn. Shape Gate ưu tiên diện tích đầu đèn, kê chân và negative space. Semantic Gate mới đếm vùng điều khiển khả kiến độc lập với lens.
- **Biên Night.** Các sprite của hai case hiện đủ pixel tại anchor. A0 dùng contour authored `#201a24` với luma 28. A1/A2 dùng `#242534` với luma 38, gần nền Night hơn ở các mẫu tối. Số mẫu biên đổi theo silhouette nên cần xem cả phân bố. Rain A1 có 16/136 mẫu yếu so với 0/92 ở A0. Beacon A2 có 40/132 so với 0/104. Tại chân, Night P10 của Rain A1 là 15 so với 25 của A0. Beacon A2 là 14 so với 24. [QA Rain cũ](../../benchmarks/results/e74/field-rain-gauge/qa.json) · [QA Beacon cũ](../../benchmarks/results/e74/harbor-signal-beacon/qa.json)
- **Patch ba pixel E7.4.** Mask, alpha và protected hash đạt. Vạch meniscus nằm trong buồng kính, xa biên ngoài; cả P10 và trung vị biên kính–vỏ của cảnh Night giữ nguyên. Dấu sáng nhỏ thấy khi phóng, chức năng và khả năng đọc cảnh 1× hầu như giữ nguyên. `NO_MEANINGFUL_VISUAL_GAIN`.

## Các thay đổi E7.4R

| Defect | Thử nghiệm | Kết quả ở 1× và việc còn lại |
| --- | --- | --- |
| `RAIN-MOUTH` | Miệng elip có lòng tối, cổ thu lại và buồng kính. Khung đỡ tách hai chân và ưu tiên ba cụm vạch dài 3/2/2 px. | Miệng hứng phân biệt rõ hơn mái hộp. Ở Night P10 biên tổng tăng 15→33, A0 là 25. Trên chân P10 vẫn 15. Thanh đỡ và ống cùng nhóm xanh xám, cần duyệt đọc chức năng khi nhìn nhanh. |
| `BEACON-LEVER` | Tay gạt nghiêng nhô khỏi thân. Đầu đèn giữ amber, tay gạt dùng kim loại với đường sáng riêng. Chân giằng và khe dưới đầu giữ tách nhau. | 35 px tay gạt khả kiến trong một cụm. Tay gạt tách hình tốt hơn khối bản lề cũ, tại 1× vẫn dễ đọc như móc gắn. Cách điều khiển thuộc nhận xét mỹ thuật. |
| `NIGHT-OUTER-RIM` | Mặt trên Beacon có một đoạn viền 6 px lấy bậc kim loại có sẵn. Vùng target ở x18–23, y4. Ngân sách 12 px, SHA-256 protected khớp, scene ngoài mask khớp từng pixel. | Mẫu biên yếu 39→33, P10 giữ 14 (A0 24). Chênh lệch trên mép mái thấy nhẹ riêng sprite, chưa đổi cách đọc trong cảnh 1×. Khuyến nghị đánh dấu `NO_MEANINGFUL_VISUAL_GAIN` và giữ E7.4R trước patch làm lựa chọn. |
| `VANE-FUNCTION` | Holdout có cánh đuôi, trục, gối xoay, mũi tên và đế. Dùng cùng view và ba ramp B1. | Mũi chỉ hướng dễ nhận ở 1×. Cơ cấu xoay khó đọc nên dễ nhầm biển chỉ đường. Night P10 15. Kết quả holdout hỗn hợp. |

P10 là phân vị thấp, xem cùng mẫu yếu, trung vị, contact và từng landmark. Diagnostics lấy cặp pixel liền kề của instance thật. Contour bao kín nên số biên chạm nền trực tiếp từ mặt vật liệu tối bằng 0. Pass đo riêng đọc vật liệu dưới luma 90 và mặt kề bên trong sprite trên cảnh Day/Night. Rain có 54 mẫu vật liệu–vật liệu với trung vị 66, so 38 mẫu và trung vị 48 ở A1. Các plane và ảnh giúp giải thích metric, kết luận mỹ thuật ở phiếu của Owner. [Diagnostics vật liệu tối](../../benchmarks/results/e74r/dark-material.json) · [Semantic masks và QA](../../benchmarks/results/e74r/benchmark.json)

Rain và Vane giữ bản trước chỉnh Night do thiếu cụm viền đủ điều kiện. Beacon giữ hai bản đúng cùng geometry và mask. Không tăng số màu để che lỗi; các vai trò vật liệu dùng màu B1 đã có. [Brief lock](../../benchmarks/fixtures/e74r/pilot-lock.json) · [Candidate freeze](../../benchmarks/fixtures/e74r/candidate-freeze.json)

## Đề xuất tiếp theo

- Duyệt Rain ở 1× trong cảnh và thử phân biệt với dụng cụ đo chung. Khi miệng hứng đã rõ, ưu tiên chân đỡ hoặc ranh giới mặt kính theo nhận xét thực tế.
- Đánh giá Beacon với một đối chứng giữ nắp và giảm cơ khí phụ. Duy trì amber riêng cho lens. Tiếp tục chất lượng Night theo khu vực chân thay vì dùng điểm P10 đơn.
- `CAPABILITY_GAP` ở Wind Vane gồm cơ cấu quay và cảnh mép vực chuyên dụng. Cảnh Tidegate là bối cảnh đối chứng đi bộ; một holdout tĩnh chưa chứng minh tổng quát hóa. Chỉ xem xét thêm primitive xoay/thân gối nếu Owner cần mặt nhìn tĩnh rõ chức năng hơn.

Các đề xuất giữ phạm vi nghiên cứu. [Human Review JSON](../../benchmarks/results/e74r/human-review.json)
