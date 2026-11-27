# E7.4 Quality-Guided Generation

**DESIGN_ONLY.** Quyết định A/B/C của Owner tại E7.3R sẽ xác định họ asset và lỗi cần thử đầu tiên. [E7.3R audit](e73r-semantic-style-audit.md) · [Quality Contract](../art-quality/quality-contract-v1.md)

`AssetSpec → Structure Candidates → Material Candidates → Context QA → Human Review → Local Refinement`

| Giai đoạn | Thiết kế |
| --- | --- |
| AssetSpec | Khóa brief, seed, view, mốc tương tác, role chức năng và ngân sách pixel. Ghi nguồn gốc base vào manifest. |
| Structure Candidates | Dùng primitives hiện có, một baseline và tối đa hai ứng viên có giá trị khác nhau ở 1×. Gắn silhouette, face IDs, footprint, hướng chiếu, draw order, anchor và fitness cửa/lối đi. |
| Material Candidates | Trên từng hình khối hợp lệ, thử baseline và một phân bố ramp có giả thuyết rõ. Ưu tiên preserve semantic roles và giữ số màu theo family. |
| Context QA | Loại lỗi alpha, seam, hash, palette, collision/occlusion, anchor, contact hoặc silhouette. Dùng mask ownership, P10/cụm viền và biên vật liệu trong cảnh Day/Night để chỉ đúng vùng cần xem. |
| Human Review | Xem 1× trước 4×, cho phép chọn Neither. Giữ số liệu, ảnh thất bại, quyết định từng asset và quyết định cả bộ trong các trường riêng. |
| Local Refinement | Cho phép một lần chỉnh trong mask đã chọn và giới hạn pixel. Khi chức năng, phối cảnh hoặc negative space kém, tạo vòng cấu trúc có geometry lock mới. Khi silhouette đạt, chỉ chỉnh material/outline và kiểm lại hash của vùng bảo vệ. |

Tách bộ phát triển, bộ chẩn đoán đã xem và ít nhất một brief mới khóa trước mỗi vòng. Báo kết quả của tất cả candidate và trường hợp kém. Chuyển lỗi lặp ở holdout sang nghiên cứu mới với một holdout khác. Khống chế công việc bằng trần số render, pixel được chỉnh và một lần review, rồi đo thời gian render thực tế trước khi cân nhắc thêm nhánh.

Pipeline đầu tiên chạy hoàn toàn local qua presets, morphology mask và replay manifest. Chi phí inference dự kiến bằng 0, chi phí còn lại là render, lưu bằng chứng và thời gian duyệt. Sau E7 có thể đề xuất Studio Workbench nhập PNG cùng bundle QA theo version, cho phép so cạnh nhau, chọn vùng và lưu quyết định. Cần kiểm tra contract và parity trước khi đưa vào Studio. E7.4 production chờ phê duyệt riêng.
