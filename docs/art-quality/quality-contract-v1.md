# Universal Art Quality Contract v1

Mỗi asset xuất hai kết quả độc lập. Engineering xác nhận pixel và dữ liệu theo các phép kiểm áp dụng được. Người duyệt chấm hình theo rubric của họ asset và ghi quyết định riêng. Mục không áp dụng cần ghi phạm vi. Mục thiếu bằng chứng giữ trạng thái chờ. [Contract v1](../../benchmarks/fixtures/e71/quality-contract-v1.json) · [Review sheet](../LumaSprite-Engine-E7.1-Report.html#review)

| Diagnostic dùng chung | Bằng chứng tối thiểu |
| --- | --- |
| Alpha và point sampling | Alpha 0/255, RGB của pixel trong suốt bằng 0, ghi kích thước native và kiểm 4× là nearest-neighbor nguyên. |
| Palette và provenance | So màu đã dùng với palette hợp lệ. Gắn phiên bản, spec, Style Profile, seed nếu generator dùng seed và SHA-256 các artifact. |
| Contour và cluster | Lưu silhouette, viền 4-láng giềng, footprint, kích thước connected component và pixel viền cô lập khi mask thích hợp. |
| Detail density | Đếm số cặp kề cùng material role có độ chênh luma từ 6 mức trở lên trên 100 cặp. Đối chiếu phân bố và vị trí ở 4×. |
| Silhouette | So mask, bounds, anchor và negative space trước/sau material. Người duyệt xác nhận nhận dạng ở 1×. |
| Material contrast | Ghi số mẫu, P10 và median luma chênh ở từng ranh giới role trong cùng ánh sáng. |
| Determinism | Tái tạo trên input đã khóa rồi so SHA-256 toàn bộ payload. |

| Rubric theo asset | Quan sát ở 1× và trong cảnh |
| --- | --- |
| Prop | Nhận dạng, silhouette, phối cảnh, thể tích, phân biệt vật liệu, chất lượng cụm pixel và sức hấp dẫn. |
| Character | Tỷ lệ, giải phẫu, pose, vị trí gắn đồ và hướng nhìn. |
| Terrain | Nối tile, độ đa dạng, nhịp texture, chuyển tiếp và nhận diện bề mặt. |
| Environment | Mạch lạc kiến trúc, silhouette, phối cảnh/chiều sâu, vết gãy tự nhiên, khoảng trống, tiềm năng vật liệu, nhận diện đường/focal hierarchy và khả năng chuyển layout. |
| Animation | Hành động rõ, contact khi đổi frame, timing và nhất quán hình khối giữa các frame. |
| UI | Nhận dạng, ngữ nghĩa, khả năng đọc và phân biệt trạng thái. |
| VFX | Anticipation, buildup, peak, dissipation, ý đồ chuyển động và hòa nhập bối cảnh. |

Chấm 1–5 cho từng tiêu chí. Mức 1 nghĩa là không đọc được, 3 là đọc được nhưng còn nhiễu và 5 là rõ trong bối cảnh đích. Mục tiêu thử nghiệm là từng tiêu chí cốt lõi từ 4/5 theo người duyệt. Ghi lỗi nghiêm trọng riêng để người duyệt có thể yêu cầu sửa dù các mục còn lại có điểm cao. Giữ điểm rời và quyết định của người duyệt. Điểm cho H1 phản ánh một layout cụ thể.

## Benchmark corpus và holdout

- **A — Historical Locked Baseline.** Giữ nguyên artifact E2–E6.4 và trạng thái acceptance. Mỗi mục chỉ đến canvas, phiên bản, spec, palette/Style Profile, seed nếu có cùng các SHA-256 kiểm chứng.
- **B — Development Benchmark.** Relay Box và R1 là nơi chỉnh hình. So control/candidate cùng camera, light, palette, quy tắc vật liệu và scene context.
- **C — Unseen Holdout.** Khóa brief, spec, seed và digest trước khi dựng ứng viên. Chạy đúng quy tắc đã xây trên B một lần, giữ cả control và candidate. Ghi giảm chất lượng nếu thấy ở 1×. Mọi tinh chỉnh từ kết quả C cần một holdout mới. Một fixture chỉ cung cấp một lần quan sát. [Corpus](../../benchmarks/results/e71/corpus.json) · [H1 lock](../../benchmarks/fixtures/e71/holdout-lock.json)
