# E7.5 Character Pipeline Audit and Candidate Contract

E7.5 thử nghiệm hình tĩnh 64×64. Ridge Mechanic và Marsh Harvester giữ seed, view 3/4 phải, Style Profile B1, thông số tỷ lệ và đường chân theo từng brief. A0 dùng v3 standing-free với cùng outfit, kích thước, seed và màu. V3 hỗ trợ áo, mũ trùm và túi, A0 thiếu hai tay cầm theo brief và áo mưa dài. `CAPABILITY_GAP` này được ghi trong gallery. [Brief lock](../../benchmarks/fixtures/e75/pilot-lock.json) · [Candidate freeze](../../benchmarks/fixtures/e75/candidate-freeze.json) · [Quality Contract](../art-quality/quality-contract-v1.md)

| Thành phần | Phạm vi và tái sử dụng |
| --- | --- |
| CharacterSpec và PoseSpec | V2 khai báo hip, turn, elbow, wrist, palm, knee, ankle, pivot và support; lantern gắn tay gần. V3 có standing-free và hood/crossbody. Pose A1/A2 ghi landmark có chủ đích. Joint, hướng gối, tỷ lệ và sole vẫn qua bộ kiểm tra E4. |
| ShapeSpec và primitives | Tỷ lệ và pose tạo ra segment, ellipse và polygon. Công thức cap, hood, jacket, hình giày và thứ tự lớp vẫn viết theo họ nhân vật. E7.5 dùng polygon phẳng và phép chiếu hộp trong Pixel Core để dựng toolbox, miệng cờ lê, móc và áo mưa. Không cần renderer mới. |
| Đạo cụ và grip | Trục cán và handle bắt đầu từ palm; đạo cụ đứng ngay sau lớp bàn tay tương ứng. Shape Gate kiểm điểm chung, phần tay che cán, diện tích thấy được, khe tay cầm và khoảng cách với thân/chân. Vai và cổ tay vẫn xác minh qua rig E4. |
| Shape lock và material | ShapeLock v1 băm spec, landmarks, phần cơ thể, silhouette và boot soles. Pilot thêm hash silhouette đủ đạo cụ, owner map và mỗi tool mask. M2P vẽ da, vải, quần, giày, túi theo part; palette B1 vẽ kim loại và latch. Vùng áo nâu của Marsh dùng ramp authored. Alpha và owner map kiểm lại sau paint. |
| Gameplay và local | A0/A1/A2 dùng cùng spawn và B1 Day/Night. So byte nền ngoài hợp hai silhouette và kiểm đường đi, collision, actor phụ, chân và shadow. Đo biên bằng các pixel thật. Không chọn patch RGB vì các hạn chế còn lại nằm ở ngón tay, tỷ lệ thiết bị và tương tác silhouette. |
| Studio | Adapter v1 vẫn có phạm vi hiện tại. So PNG qua read, save, reopen, export, bao gồm pose parts và cảnh Night. |

[CharacterSpec](../../src/specs/character.ts) · [Rig geometry](../../src/generators/character/geometry.ts) · [Shape lock](../../src/generators/character/shape-lock.ts) · [Character QA](../../src/quality/character.ts) · [ArtDirectionSpec](../../src/experiments/art-direction.ts) · [E7.4 Candidate Contract](e74-pilot-architecture.md) · [Studio Adapter](../integration/studio-adapter.md)

## Evidence and trade-offs

- Ridge A1 có hai grip overlap 9/8 px và 9 hàng khe chân. A2 có overlap 9/13 px, 7 hàng khe và silhouette nâng cờ lê khỏi thân. Diện tích cờ lê thấy được giảm 45→38 px ở A2. Hộp treo gần thân dưới và có thể đọc như cặp.
- Ridge Night P10 biên A0/A1/A2 26/26/27. A2 có ba mẫu yếu và A0/A1 mỗi bản có một. Nâng tay làm rõ dáng kiểm tra công cụ, bàn tay lại che nhiều phần cán. Bản đứng cân bằng rõ hơn đối chứng ở những góc so này; Owner cần đánh giá dáng và giải phẫu trong cảnh 1×.
- Marsh A1/A2 giữ nền áo nâu ấm và có áo mưa dài hơn A0. Móc có 51/46 px khả kiến, Night P10 15/18/18. Móc có thể đọc thành gậy cong ở 1×. Gấu áo A2 tạo mảng rộng bên trái và làm silhouette nặng hơn A1. Một holdout chưa chứng minh khái quát hóa.
- `NO_MEANINGFUL_VISUAL_GAIN`: không áp patch RGB. Geometry và SHA-256 protected toàn canvas được ghi trong từng QA. Negative controls cố ý thay wrist, grip anchor, part ownership và pixel ngoài mask; các bước bảo vệ tương ứng đều từ chối.

## Animation Gate

`DESIGN_ONLY_AWAITING_STATIC_OWNER_APPROVAL`. E5 walk-hold ràng buộc lantern của v2 và walk-free ràng buộc v3. Sau khi Owner chọn static, thử một transition kiểm contact, root slip, pivot và screen-offset. Mỗi frame mang grip/anchor theo palm và kiểm overlap, khoảng âm, túi và gấu áo. Đo loop, áo mưa khi đổi chân, và cluster flicker tại 1×. Nếu tool motion không đạt số đo, giữ static. [E5 Walk](../../src/generators/character/walk.ts) · [E5 Idle](../../src/generators/character/animation.ts)

## E7.6 Environment Pilot proposal

Bắt đầu sau đánh giá E7.5. Dùng actor được duyệt làm scale reference. Thử hai cấu trúc môi trường có hướng đi khác nhau để kiểm portal, terrain, collision và vùng che. Tái dùng E6/E7 scene composition và B1 Day/Night. Khóa một holdout mới trước khi xem ảnh. Đánh giá silhouette nền, thứ bậc cảnh, quy mô, đường đi và readability của actor. [E7.5 portable gallery](E7.5-PORTABLE-ART-REVIEW.html)
