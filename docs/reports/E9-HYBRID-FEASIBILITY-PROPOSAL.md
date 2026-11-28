# E9 · Hybrid Art-Directed Character Feasibility

**`E9_HYBRID_FEASIBILITY_READY_FOR_OWNER_REVIEW`** · Đề xuất audit, contract nháp và benchmark. Option B tiếp tục là quyết định kiến trúc được khuyến nghị. Bước tiếp theo phụ thuộc lựa chọn của Owner và nguồn component hợp lệ. [Closeout và quyết định kiến trúc](E9-CHARACTER-ARCHITECTURE-DECISION.md)

## Giả thuyết

Mẫu pixel do artist thiết kế có thể giúp nhận ra nghề và mặt vật liệu ở 1×, trong khi Engine giữ vai trò lắp ráp, chọn biến thể có giới hạn và kiểm chứng. Hình thêm hoặc mới lạ do một arm có thêm capability cần được đọc riêng trước khi diễn giải lợi ích mỹ thuật. Chi phí tác giả, QA, cập nhật component và sửa trong Studio thuộc kết quả thí nghiệm.

## Audit phần tái sử dụng

| Phần đang có | Giữ trong Hybrid | Đề xuất art direction |
| --- | --- | --- |
| Part-based construction và RGBA ownership | Giữ mask, thứ tự lớp, kiểm alpha và so pixel. | Artist sở hữu vùng biên của helmet, suit, bình khí và khoảng âm. Khớp tạo ra dáng nghề thuộc mẫu. |
| Costume-aware stance và headwear fit | Dùng lề raw + stroke, pivot, đế, khoảng hở giải phẫu và kiểm tiếp xúc. | Cho phép helmet và mép áo có hình riêng, ghi vùng được phép chồng lên chân và cổ. |
| Grip-aware sockets | Giữ palm/wrist, trục dụng cụ, cửa sổ che khuất và kiểm nối forearm. | Thiết kế vài silhouette ngón cái và cán mang tải từ ảnh ở 1×. |
| Face planes và form-aware shading | Giữ hướng upper-left, vai trò màu và các plane có thể kiểm. | Artist đặt cụm visor, phản chiếu, gò má và nếp suit. Chỉ biến đổi ramp trong bảng màu đã khóa. |
| Palette locks | Dùng chung hash style/ramp, binary RGBA, giữ alpha-zero RGB chuẩn. | Vật liệu visor, vải suit, kim loại và ống khí cần màu dễ tách ở Day/Night. |
| CharacterSpec và Studio adapter | Giữ đọc CharacterSpec v1–v3 và hiện trạng thông qua PNG. Adapter HTTP hiện chỉ quảng bá `prop`. | Component draft độc lập. Pilot xuất PNG, masks và review metadata ra tệp, dùng Workbench để so A/B, căn pivot, ghi vùng lỗi và xuất review JSON. |
| Studio Art Review Workbench | Có native 1×, nearest 4×, Diff/Silhouette, pivot crosshair, ảnh upload cục bộ và review của người chấm. | Thí nghiệm sửa theo mask dùng bản sao tài liệu cục bộ. PNG round-trip là kiểm compatibility, editable component ownership cần kiểm riêng. |

Nguồn đã đọc tại checkpoint Engine `7bd0080a9a2474ac9c2bc5085df9c97f6bd8ffec` và Studio `471ac90555d3545beff5182146e291ba97b9ae20`. [Part-based và QA](../../src/experiments/character-v4.ts) · [Stance](../../src/experiments/costume-stance.ts) · [Headwear](../../src/experiments/character-headwear-fit.ts) · [Face và thiết bị](../../src/experiments/character-identity-study.ts) · [CharacterSpec](../../src/specs/character.ts) · [Adapter](../../src/adapters/studio/contract.ts) · [Studio Workbench](../../../LumaSprite-Studio/docs/ART-REVIEW-WORKBENCH.md)

## Contract draft · `lumasprite.character-component.v0-draft`

Một component là một revision tài sản và manifest bất biến. Recipe lấy cặp `id@revision` cùng hash manifest. Tọa độ local 0-based, +x sang phải, +y xuống. Pivot và anchor có tọa độ integer. PNG là RGBA 8-bit với alpha 0/255. Pixel ngoài mặt nạ sở hữu phải trong suốt. PNG vật liệu là mask vai trò, có cùng kích thước.

| Trường | Quy tắc draft |
| --- | --- |
| `id`, `revision`, `kind`, `view` | ID ổn định, revision bất biến, hướng `three-quarter-right`. Kinds trong bảng bên dưới. |
| `extent`, `images`, `ownerPart` | Kích thước local của PNG + SHA-256 cho `rgba`, `ownershipMask` và `materialMask`. Mỗi pixel đục có owner hiệu lực. Hai layer chỉ sở hữu cùng tọa độ khi cặp overlap đã khai báo. Owner hiển thị thuộc layer cao hơn. |
| `anchors` | Tên socket duy nhất, x/y nguyên, loại nối và hướng trục khớp hoặc vector nguyên đã khai báo. Có thể có mặt nạ contact/occlusion được pin riêng bằng SHA. |
| `transform` | Translate nguyên trong envelope layout. Mirror chỉ khi có biến thể đã duyệt với light plane tương ứng. Hướng grip/helmet khác dùng revision hoặc biến thể pixel riêng. |
| `palette`, `materialRoles` | Profile ID + SHA-256, tập RGBA cho phép, ánh sáng upper-left. Khai báo visor/glass, cloth, leather và metal theo từng part. |
| `layer`, `overlapWith` | Sau/trước các owner có tên. Thứ tự toàn bộ recipe xác định duy nhất, graph có chu trình bị từ chối. Bàn tay đi qua cán theo hai vùng `handle-back` và `finger-front`. |
| `provenance` | Nguồn gốc, tác giả, owner/license holder, URL hoặc file nguồn, asset revision + hash, giấy phép đúng file, quyền sửa và dùng trong game đã được người phụ trách xác minh, notice đi kèm. |
| `review` | `DRAFT`, `RESEARCH_APPROVED` hoặc `REJECTED`, luôn kèm revision và reviewer khi đã chốt. Thành phần `DRAFT` dùng thiết lập, khi chấm B cần bộ được duyệt cho nghiên cứu và quyền dùng phù hợp. |

| Kind | Dữ liệu tối thiểu tại điểm ghép |
| --- | --- |
| `head-shape` | `neck`, `crown`, `visorSeat`, silhouette và vùng chạm cổ. |
| `face-cluster` | `faceOrigin`, vùng mặt được paint, role mắt/mũi/hàm hoặc visor. |
| `torso-archetype` | `neck`, hai shoulder, `hip`, `tankMount`. |
| `arm-hand` | `shoulder`, `elbow`, `wrist`, `palm`, vùng ngón và hướng cổ tay. |
| `leg-boot` | `hip`, `knee`, `ankle`, `ground`, contact mask. |
| `garment-template` | Vai/eo/gấu và vùng chồng được phép; vùng tránh khoảng âm dưới gấu. |
| `equipment-grip` | `handleGrip`, trục cán, mask cán trước/sau bàn tay. |
| `headwear` | `crown`, `visorSeat`, raw extent và contact mask đủ cho lề + stroke. |
| `material-plane` | Owner part, bound/channels được paint, ramp ID và role. |

**Phân loại nguồn**. `ARTIST_AUTHORED` cần tác giả có thật, bằng chứng bản nguồn và chấp thuận provenance. `ENGINEER_CURATED` là mẫu do kỹ sư/agent biên tập cho thử kỹ thuật. `PROCEDURALLY_GENERATED` pin code, seed và preset. Một revision duyệt cho research không tự chuyển thành duyệt Game-Ready. Validation draft từ chối SHA sai, mask tràn, màu ngoài palette, overlap lạ, grip đứt, mũ vượt lề hoặc hồ sơ quyền dùng thiếu. Xuất snapshot và lỗi theo file để tái kiểm.

## Nguồn component và giấy phép

| Kiểm kê | Kết luận cho Tidal Salvage Diver |
| --- | --- |
| E9.1/E9.1R/E9.1S(-R) PNG và masks | Các raster sinh từ code/thử nghiệm, dùng làm đối chứng. Engine có 9 PNG fixture E2.4 ngoài các raster benchmark. Hai PNG tracked trong Studio là ảnh brand và ảnh editor. Phạm vi đã kiểm chưa có helmet/suit/wrist do artist tạo kèm source độc lập và duyệt provenance. |
| PNG fixture E2.4 | Notice trỏ tới Kenney tiles và Eldiran traveler theo CC0 1.0. Đây là tài sản bối cảnh hoặc traveler phẳng, thiếu các part lắp ráp của diver và không vào pilot B. |
| R&D nguồn mở | Kho ghi MIT cho phần code đã tham khảo. SpriteKiln tách code, một số ví dụ CC0 và showcase all-rights-reserved. Phạm vi giấy phép phải khớp từng file; không dùng showcase hay artwork thương mại. |
| Studio Workbench / acceptance HTML | Viewer, metadata và bằng chứng QA cho quy trình. Phân loại này không cung cấp lớp hình độc lập có provenance của diver. |

**`NO_LICENSE_QUALIFIED_DIVER_COMPONENT_SET`**. Chưa có prototype asset. Kế hoạch ưu tiên tạo bộ tự sở hữu gồm helmet/visor, thân suit với mount bình khí và một tay nắm cán đã ghép thử. Nhận source có lớp, masks native, tác giả, version và quyền dùng. Với nguồn ngoài, rà đúng revision và notice của từng asset CC0 1.0 hoặc MIT và lưu bằng chứng. Mẫu agent nếu được ủy quyền chỉ mang nhãn `ENGINEER_CURATED`. [Fixture provenance E2.4](../../benchmarks/fixtures/e24/README.md) · [Sổ kiểm nguồn và license R&D](../../research/open-source/art-quality/README.md)

## Thử nghiệm tối thiểu · Tidal Salvage Diver

Brief nháp cho Owner xác nhận. Nhân vật cứu hộ vùng triều đứng hơi khuỵu gối, có helmet lớn tách form với vai, bình khí gắn lưng, suit có gấu/quai, tay gần nắm cán móc thu hồi. Silhouette nghề cần đọc được khi bỏ màu. Đối chứng cùng 64×64, pivot (32,58), three-quarter-right, style weathered-station-v1, cùng bảng màu và một cảnh Tidegate Day/Night 320×208 tại 32 PPU. Dự kiến seed development `48311` và fresh variation `69041`; khóa seed, layout, pin style/cảnh, pose, mask, ứng viên và tiêu chí trước lần đánh giá. Fresh variation dùng task đứng và tay cầm tương đương. Mỗi output có revision + hash. Preset tham chiếu E9.1 có style SHA-256 `1bac2be168f29f4d5fe96e3258fd5fab08baf721ce2f62cd91486c8f28ca295c` và Tidegate SHA-256 `436779f67da3b23505f69b69d96575e25a504798ed6d29efa638873fae73a22b`. Đóng băng chúng và ba component được tác giả bàn giao trước khi chạy B.

| Arm | Thiết kế |
| --- | --- |
| A · B3/S2 procedural | Dùng pipeline hiện có với lựa chọn giàu khả năng nhất, cùng vai trò, pose, tay cầm và palette trong phạm vi hỗ trợ. Chấm riêng phần capability thực sự chung, kiểm số part và silhouette envelope để tránh bỏ dụng cụ hữu ích nhằm làm yếu đối chứng. |
| B · Hybrid curate | Ở cặp chính, thay chất lượng tạo hình của các component tương đương. Giữ cùng camera, ánh sáng, anchor, pose, grip và khả năng tác vụ. Ghi giờ author/assembly và mọi thay đổi để biết ưu thế đến từ cụm pixel, ownership hay capability. |
| C · Hybrid + variation | Chỉ mở nếu B qua các cổng đã định. Thử một đổi ramp và một tổ hợp garment/visor đã duyệt ở hai lượt riêng. Giữ một biến đổi mỗi lượt và chạy hai seed định trước. Đối chiếu art và grip sau biến đổi. |

Nếu A thiếu helmet/tank/suit tương đương, ghi `CAPABILITY_GAP` trước khi chấm. Duyệt A/B ở phạm vi thực sự chung. B mở rộng có thể trình bày để đánh giá brief diver, kết quả đó chỉ mô tả năng lực mở rộng. Khi cặp A/B chung không đại diện đủ nghề cứu hộ, chưa có kết luận Hybrid thắng trên brief. Không lấy hình manual hoàn thiện đối chiếu trực tiếp với bản A bị giới hạn.

### Phép đo và điều kiện kết luận

- **Kỹ thuật trước duyệt**. Kiểm binary alpha, palette, ownership, lề raw/final, pivot và support, mask grip khép qua socket, xác nhận artifact deterministic và PNG giữ RGBA khi import/export. Cảnh Day/Night giữ camera, collision và nền ngoài actor. Kết quả regression chỉ xác nhận những điều này.
- **Mỹ thuật 1×**. Hiện A/B với mã ẩn và hoán đổi trái/phải. Kiểm silhouette bỏ màu, dáng bỏ helmet/đạo cụ trong phần anatomy, grip thật và hiển thị trong cảnh Day/Night. Chấm riêng từ 1–5 cho silhouette distinctiveness, occupational identity, anatomy, grip, pixel clusters, materials và readability Day/Night. Chỉ dùng 4× nearest để chỉ vị trí lỗi. Giữ toàn bộ Critical Defect của Static Addendum. Người chấm chọn A, B, Either, Neither hoặc yêu cầu sửa theo phiếu research và ghi lý do.
- **Editability**. Cho cùng người thực hiện hai chỉnh sửa có đầu vào cố định trên bản sao tài liệu. Đổi kính visor trong đúng slot palette rồi đổi cán sang biến thể đúng socket. Preset đo mask visor cho recolor. Đổi cán dùng hợp của footprint cũ/mới và vùng viền 1 px nằm trong slot được duyệt, khóa vùng tay trước thử. Ghi số thao tác, thời gian, pixel ngoài vùng owner cho phép đổi (**phải bằng 0**), số component phải sửa lại, provenance/revision sau export và SHA RGBA round-trip. Khi A/B cùng kỹ thuật, kết luận về tiện sửa chỉ áp dụng cho các thao tác đã đo.
- **Quyết định Owner**. B phải đạt ≥4 ở từng mục tĩnh bắt buộc, không có Critical Defect, nổi hơn A tối thiểu 1 điểm ở identity hoặc silhouette trên cùng capability, và không giảm anatomy, grip, materials hay Day/Night readability. Editability cần giữ vùng chỉnh sửa và quy trình tệp kiểm được. Nếu B thay đổi chất lượng thiếu ổn định, ghi `INCONCLUSIVE` hoặc `NO_MEANINGFUL_VISUAL_GAIN` theo người duyệt. Sau đó giữ Option B, ủy quyền một pilot Hybrid nhỏ, hoặc ưu tiên thư viện curate thủ công. [Rubric v2 Static Addendum](../art-quality/art-quality-rubric-v2-static-addendum.md)

A/B/C đều `NOT_RUN`. Phạm vi hiện tại là xét duyệt proposal và nguồn component. E9.2 chưa được ủy quyền, Game-Ready chưa duyệt, Unity runtime và directional animation chưa chạy.
