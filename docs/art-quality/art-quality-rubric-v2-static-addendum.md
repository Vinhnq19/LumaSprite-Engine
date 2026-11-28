# Rubric v2 · phần bổ sung cho nhân vật tĩnh E9.1

**ASSISTANT_REVIEW_RECOMMENDATION** · Chờ Project Owner xác nhận các quyết định đánh giá.

| Quyết định | Trạng thái |
| --- | --- |
| E9.0 Root-Cause Audit | `APPROVED` |
| Rubric v2 | `APPROVED_WITH_AMENDMENTS` |
| E9.1 Character Pilot | `AUTHORIZED_BY_THIS_TASK` |
| E9.2 Animation | `NOT AUTHORIZED` |
| Game-Ready Art | `NOT APPROVED` |
| E8.5 Owner Runtime Acceptance | `PENDING` |
| DeepSeek | `DEFERRED` |

## STATIC_ART_REVIEW

Chấm trực tiếp ở native 1× trên nền sáng, nền tối và trong cảnh 320×208. Dùng 4× nearest-neighbor để xác định cụm pixel hoặc điểm tiếp xúc cần sửa. Mỗi tiêu chí tĩnh là một cổng độc lập, từ 1 đến 5 theo [Rubric v2](art-quality-rubric-v2.json).

| Tiêu chí tĩnh | Câu hỏi cho người duyệt |
| --- | --- |
| Silhouette | Bỏ mũ, màu và đạo cụ, vẫn phân biệt được thân rộng và thân thanh? |
| Proportions | Tỷ lệ đầu, vai, hông và chân có hợp với vai trò, stance và scale cảnh? |
| Anatomy | Vai, khuỷu, cổ tay, hông, gối và bàn chân có nối nhau hợp lý? |
| Grip | Ở 1× có thấy cán đi vào vùng nắm, bị ngón tay che và tiếp tục ra phía ngoài? |
| Pixel Clusters | Các cụm nhỏ có chủ đích và cụm lớn có hướng, cả khi bỏ viền? |
| Materials | Nếp vải, mặt da, điểm sáng kim loại và pha màu có đọc đúng dưới ánh sáng upper-left? |
| Context Readability | Khối chính, mặt và đạo cụ còn đọc được ở Day và Night? |
| Style Consistency | Kích thước cụm pixel, bảng màu và treatment viền phù hợp với thế giới? |

Ghi thêm nhận xét nhận dạng nghề, màu và trọng lượng tư thế ở tiêu chí liên quan. Chọn A0, B1, B2, B3, B4, Neither hoặc yêu cầu sửa. Chỉ đưa A2 vào lựa chọn nếu có mẫu do artist tạo với quyền sử dụng hợp lệ. Khi đủ tám điểm từ 4/5 và không còn Critical Defect trong phạm vi tĩnh, Project Owner có thể cấp `STATIC_ART_ACCEPTED_FOR_ANIMATION_RESEARCH`. Điểm kỹ thuật và trung bình điểm mỹ thuật không thay thế từng cổng.

## GAME_READY_ART_REVIEW

Áp dụng đầy đủ Rubric v2 cho asset production, bao gồm hướng nhìn và animation cần cho gameplay, kiểm scale, va chạm, depth, tương tác và nhập runtime ở các tình huống mục tiêu. Project Owner giữ quyền phát hành quyết định `GAME_READY_ART_APPROVED`. Kết quả tĩnh chỉ là bằng chứng đầu vào. E9.2 cần quyết định ủy quyền riêng.

| Critical Defect gốc | Phạm vi và trạng thái |
| --- | --- |
| ANATOMY_BROKEN | Kiểm giải phẫu và tiếp đất tĩnh. Kiểm khớp và tiếp đất qua chuyển động là `OPEN_PRODUCTION_BLOCKER`. |
| SILHOUETTE_UNREADABLE_1X | Kiểm tại 1× trên sprite, silhouette và cả hai bối cảnh đã khóa. |
| GRIP_DISCONNECTED_OR_BLOB | Kiểm tay/cán tĩnh tại 1×. Kiểm giữ grip theo frame là `OPEN_PRODUCTION_BLOCKER`. |
| TEMPLATE_CLONE_IDENTITY | Kiểm hình thái bỏ mũ, đạo cụ và màu trên development và holdout. |
| DIRECTIONAL_FACING_LOCK | `OPEN_PRODUCTION_BLOCKER`. Pilot chỉ có three-quarter-right. |
| MATERIAL_CLUSTER_NOISE | Kiểm cụm pixel, nếp vải, chất liệu và độ nhất quán viền. |
| OUTLINE_MISMATCH_IN_SCENE | Kiểm Day/Night, viền sáng, viền bóng và viền tiếp xúc tại 1×. |
| GAMEPLAY_OCCLUSION_OR_BOUNDS | Kiểm khung cảnh đặt tĩnh, alpha, hòa trộn, pivot và camera. Hành vi va chạm/che khuất trong runtime là `OPEN_PRODUCTION_BLOCKER`. |
