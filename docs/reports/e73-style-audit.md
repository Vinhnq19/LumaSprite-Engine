# E7.3 Cross-Asset Style Audit

E7.3 phạm vi pilot tại Stormwatch Supply Station và Tidegate Calibration Stop. Đánh giá mỗi sprite ở 1× trước khi chọn phiên bản của cả bộ. [Gallery portable](E7.3-PORTABLE-ART-REVIEW.html) · [E7.2 Closeout](e72-final-artistic-acceptance.md) · [Architecture Proposal](e73-cross-asset-architecture.md)

| Họ asset | Phong cách, palette và khâu áp dụng | Điều B điều phối |
| --- | --- | --- |
| Character | Geometry 64×64 và pose 3/4 phải. `characterReview` khóa silhouette, pivot và landmarks. M2P tô theo part masks với ramp cho da, áo, da thuộc, kim loại và kính. Viền tối ở mặt khuất, cạnh sáng nhận bóng của vật liệu. Palette project và locked có thể nén ramp. | Áo xanh đá, mặt xa thấp hơn một bậc, kim loại và tín hiệu amber. Giữ da, đồ da, quần, kính đèn dùng cùng họ amber. |
| Prop | E2.4 dùng role gỗ, sắt, đồng và contour. Bề mặt có vùng viền, dải vật liệu và patch theo mặt chiếu. Pilot dùng primitive hộp chiếu và mặt cảng của E7.1/E7.2 cho tải trọng của từng brief. | Gỗ ấm, kim loại xám xanh, tín hiệu amber. Dùng cùng mặt và cụm pixel giữa A/B. Thiết bị đứng có thanh đo riêng, thiết bị ngang có vạt mái. |
| Terrain | E3.4 world bake chọn tile và variation theo tọa độ và seed. Ramp bên trong terrain chịu ràng buộc seam, topology và chống lặp. | Cả hai dùng cùng đất, mùa và seed. B1 giữ vùng nghỉ ít chi tiết ở lối đi; đo tần suất biên trong từng khu thay vì ép mật độ bằng sprite. |
| Environment | B1 ghép nền tile 16 px, tỉ lệ 32 px/đơn vị, reference nhân vật 64 px và mặt chiếu 3/4 phải. Day/Night có ramp riêng, bóng đổ và ánh đèn cục bộ; actor/prop được blit nguyên pixel. | Ngày dùng họ mái xám xanh, kim loại, tín hiệu và contour chung. Giữ đá, gỗ, ramp nền và Night B1. Ngưỡng material luma chỉ báo chạm màu, còn scope/anchor vẫn cố định. |
| Animation | Idle/walk lấy nguồn shape lock và palette của Character Production. Contact, pivot và vị trí phụ kiện xuyên frame cần ổn định. | Nối material palette theo vai trò của character source trước khi tái bake clip. Pilot dùng pose tĩnh. |
| UI/VFX | E6.4 khóa nine-slice, anchor, timeline, mask và phản hồi ở native. Accent có ý nghĩa chức năng và thấy được trên gameplay. | Giữ value sáng cho hiệu ứng và thông tin thao tác. Họ amber làm tham chiếu, cần kiểm trên nền Day/Night và qua frame trước khi áp dụng. |

[B1 profile](../../benchmarks/fixtures/e61r/style-profile.json) · [AssetSpec](../../src/specs/asset.ts) · [Environment schema](../../src/specs/environment.ts) · [Character material planes](../../src/generators/character/material-planes.ts) · [E6.4](../e64-pixel-ui-vfx.md) · [Quality Contract](../art-quality/quality-contract-v1.md)

View được truyền tới character và environment từ spec của mỗi pipeline. Prop dùng cùng quy ước cạnh trên trái theo primitives chiếu hộp, với chiều sâu 5–7 px và mặt nhìn thấy ở cạnh phải. Nguồn E2.4, M2P và B1 giữ các viền khác nhau. Một viền chung cho lớp ngoài và shadow tint cục bộ giúp giữ thứ bậc trong B. Dáng 64 px, đạo cụ 32 px và độ cao thực đo từ alpha bảo toàn độ với của công trình. Cửa, vai và bề rộng thân quyết định khoảng đi qua. Geometry lock chưa có field mô tả chủ thể nên các preset hỗ trợ một tập pose, phụ kiện và mô-đun công trình hữu hạn.

## ArtDirectionSpec v1

- **Hard constraints.** Đọc B1 theo SHA-256, view 3/4 phải, đèn trên trái, alpha nhị phân, ramp có bốn bậc giá trị tăng, không dời pivot/anchor/seed/shape giữa A/B. Fit qua cửa, route sweep, mask, collision và occlusion chạy lại trên từng phiên bản.
- **Artistic guidance.** Mái xám xanh, kim loại lạnh, gỗ/da ấm, amber ở điểm tương tác và mặt sáng. Dành vùng đá và nền ít chi tiết cạnh nhân vật. B đánh lại quan hệ hue/value, kích thước cụm vẫn do từng renderer đặt. Viền ngoài tối và bóng cạnh được đánh giá cùng nền tại 1×.
- **Family-specific rules.** Character giữ mặt, tay, trang phục và nhận dạng pose. Prop giữ chức năng ở mặt trước và chiều sâu mặt trên. Environment cần nhận diện lối vào và vùng đi được trước chi tiết. Animation giữ contact, camera và bảng màu qua thời gian. UI/VFX giữ nhận dạng biểu tượng, vùng slice và nhịp riêng. A dùng M2P authored, role E2.4 cho thiết bị với công thức readout đã có, và B1 cho scene. B giữ cùng công thức vẽ và đổi role ramps đã liệt kê. Primitives mới cho brief dùng như nhau trong A/B.

[Contract](../../src/experiments/art-direction.ts) · [Profile pilot](../../benchmarks/fixtures/e73/art-direction-v1.json) · [Development và holdout lock](../../benchmarks/fixtures/e73/brief-lock.json)

## Capability gaps

- `CAPABILITY_GAP` — Outpost chưa có luồng flat architecture riêng. Báo cáo lấy layer ownership trực tiếp từ render, cùng silhouette shell và material mask. Một pass bỏ chi tiết trên cùng face IDs có thể cho bản flat architecture thực sự.
- `CAPABILITY_GAP` — Character/prop dùng cùng sprite Day/Night. B1 đổi cảnh và bóng đổ. Cần thiết kế các ramp night theo family và đánh giá lại contrast ở các vùng đi qua.
- `CAPABILITY_GAP` — Chức năng thời tiết/mực nước dựa trên biểu tượng và silhouette. Generator hiện dùng cấu kiện hộp, mái và mặt đọc trong lane kích thước đã thử nghiệm. Đề bài đòi cơ cấu đặc thù nên mở rộng primitive và semantic mask sau khi có nhận xét 1×.
- `CAPABILITY_GAP` — UI/VFX, animation và import native ArtDirectionSpec của Studio nằm ngoài pilot. Studio xác minh PNG/RGBA qua save–reopen–export. Context actor, barrel và bàn làm việc giữ nguyên giữa A/B.

## Đề xuất E7.4 Quality-Guided Generation

Chờ Owner chọn A, B hoặc Neither cho từng họ và cả bộ trên hai brief E7.3. Sau đó xác định một lỗi đọc ở 1× để nghiên cứu. Khóa thêm vài brief mới cùng tiêu chí về silhouette, vùng nghỉ, giá trị biên và chức năng. Theo dõi mỗi biến thể để thấy thay đổi nào giữ hình khối, anchor và material masks, cùng trường hợp detector bỏ sót. Dùng diagnostics chọn ảnh cần xem thủ công và giữ ảnh thất bại. Sau khi Owner xác nhận lợi ích trên holdout, đề xuất một cổng promotion riêng cho từng family và bài test regression production. Trạng thái `PROPOSAL_ONLY`.
