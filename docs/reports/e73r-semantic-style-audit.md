# E7.3R Semantic Style Audit

B1 quy định camera 3/4 phải, ánh sáng trên trái và bảng màu Day/Night. E7.3 v1 truyền màu áo gần/xa, kim loại, kính, mái và viền vào các renderer hiện có. M2P có mask vật liệu theo bộ phận, prop có mask chiếu mặt, và composition giữ sprite RGBA theo pivot. Việc remap coat/far-coat cho mọi scene đã thay dấu hiệu nhận diện của Tidegate. C mở rộng điều phối ở lớp thử nghiệm, dùng cùng M2P, vật liệu prop và composition. [E7.3 Audit](e73-style-audit.md) · [E7.3 Closeout](e73-artistic-acceptance.md)

| Vai trò | Quy tắc trong C | Ranh giới |
| --- | --- | --- |
| Nhận diện | Brief liệt kê coat/far-coat cần giữ. C bỏ override cho hai role đó và dùng nguyên ramp authored của M2P. | Mask áo kiểm từng pixel với A. Kim loại, kính và viền vẫn nhận điều phối. |
| Chức năng | Giữ nguyên amber theo mask của B. | Đo biên tín hiệu với vỏ cùng vật thể trên cảnh thật. Chuỗi hạt sáng không chứng minh thiết bị đọc đúng công dụng. |
| Vật liệu | Nâng shadow gỗ một bậc trong cụm sát viền ở sáu hàng cuối của prop. Dùng ramp gỗ đã có. | Giữ mask và alpha. Độ tách silhouette thiết bị với nền có thể vẫn thấp. |
| Phong cách chung | Kế thừa bảng màu Day của B và cách phân bố vật liệu. | Cảnh Day và Night khóa camera, scale, seed, collision, pivot, thứ tự ghép. |
| Phụ thuộc ánh sáng | Night được đổi một cụm viền nhân vật nếu các mẫu biên yếu được cải thiện, dùng ink có sẵn trong B1 Night. Tối đa 20% pixel outline khả kiến và giữ tiếp xúc mặt đất. | Dùng mép trên cảnh thật ở 1×, bỏ hạt dưới ba pixel và không tăng bề rộng viền. Background Night B1 được giữ nguyên. |

[Nguồn contract](../../src/experiments/semantic-style.ts) · [Khóa brief](../../benchmarks/fixtures/e73r/pilot-lock.json) · [Quy tắc đã khóa trước holdout](../../benchmarks/fixtures/e73r/candidate-freeze.json)

## Diagnostics trong cảnh

Bộ render lấy đúng pixel sở hữu của từng instance; các màu đánh dấu chỉ tồn tại trong pass nội bộ. P10, trung vị, số mẫu và số biên yếu dựa trên cặp pixel kề bốn hướng. Tách biên ngoài, cụm viền, mép tiếp xúc nền và biên tín hiệu/vỏ. Rà nhịp hoạ tiết và điểm tập trung bằng ảnh pha Day/Night có cùng geometry. Các giá trị này mô tả từng mảng trên cảnh, kết quả mỹ thuật do người duyệt quyết định. [Nguồn diagnostics](../../src/experiments/context-contrast.ts) · [SHA-256 của bằng chứng](../../benchmarks/results/e73r/SHA256SUMS)

| Cảnh | C cải thiện | C vẫn kém hoặc còn giới hạn |
| --- | --- | --- |
| Stormwatch | P10 biên nhân vật Night từ 13 (B) lên 15 (C); biên yếu từ 39 xuống 33. Viền–gỗ trung vị từ 8 lên 46. | A đạt P10 19 với 24 biên yếu. Thiết bị vẫn giống hộp tín hiệu, P10 thiết bị/nền Night giữ ở 15 so với A 25. |
| Tidegate | Giữ đúng 241 pixel áo A. P10 nhân vật Night từ 23 lên 25. Viền–gỗ trung vị từ 8 lên 46. | C giữ P10 Day 52 của B, dưới 58 của A. Chân gỗ rõ hơn tại viền trong, cả thiết bị vẫn kém tách nền Night hơn A. |
| Mistfen | Giữ 230 pixel nhận diện, toàn bộ 10 pixel amber và cải thiện trung vị viền–gỗ từ 8 lên 46. | `MIXED_RESULT`. P10 biên nhân vật Night từ 23 (B) xuống 18 (C) khi giữ áo ấm, cùng 14 biên yếu. Chân gỗ sáng hơn nhưng silhouette vẫn giống thiết bị đo chung. |

`STRUCTURE_LIMITATION` áp dụng cho cách đọc nhận dạng của đạo cụ. Tín hiệu ở 1× dễ thấy, cơ cấu và mặt đo cần một vòng hình khối riêng. `CAPABILITY_GAP` tại Mistfen: Engine dựng cổng bậc, tường chắn thấp, cột buộc và nền bến từ mô-đun đá. Cảnh đọc như một trạm nước cổ; chưa hỗ trợ nước đầm lầy, tàu phà và cầu sàn chuyên dụng. Đối chiếu được một silhouette kiến trúc khác, kết quả chưa đủ để duyệt tổng quát hóa. [Gallery portable](E7.3R-PORTABLE-ART-REVIEW.html)
