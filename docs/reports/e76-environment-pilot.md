# E7.6 Environment Semantic Composition Pilot

Mistfen Ferry Landing và Floodgate Maintenance Yard đều có đường đi hợp lệ từ spawn đến sàn cập bến trên dữ liệu xuất. Hai phương án có cùng điều kiện so sánh. Đánh giá mỹ thuật và quyết định tích hợp chờ Project Owner. [Portable Art Review](E7.6-PORTABLE-ART-REVIEW.html) · [Spatial QA](../../benchmarks/results/e76/benchmark.json) · [Human Review](../../benchmarks/results/e76/human-review.json)

## E7.5R artistic closeout

`ASSISTANT_REVIEW_RECOMMENDATION`

| Asset | Quan sát ở native 1× | Khuyến nghị |
| --- | --- | --- |
| Ridge Mechanic | Dáng và dụng cụ tách rõ hơn. Cờ lê lộ 51 pixel so với 43 ở A0-Matched. Khe chân 9 hàng so với 6. Biên Night yếu 5 mẫu so với 3. Hộp đồ nghề vẫn có thể đọc thành túi. | Dùng làm tham chiếu nghiên cứu. |
| Marsh Harvester | Móc lộ 65 pixel so với 48. Khoảng âm tốt hơn. Móc vẫn khó nhận diện và tư thế chưa thể hiện thao tác thu hoạch ở 1×. | Duyệt có giới hạn mỹ thuật cho nghiên cứu. |
| Canal Porter | Hai tay nắm cùng một cán ở tư thế tĩnh. Mũ vành rộng tạo silhouette riêng. Tay xa chìm vào cán. Cân bằng khi mang tải động và animation chưa được xác minh. | Tham chiếu tĩnh cho nghiên cứu. |

E7.5R Engineering `APPROVED` theo QA đã báo cáo. Final Character Art `NOT APPROVED FOR PRODUCTION`. Character Animation `PENDING STATIC ART ACCEPTANCE`. E7.5RR và E8 `NOT AUTHORIZED`. Brief này cho phép E7.6 Pilot. Phiếu Owner được giữ trống. [E7.5R Gallery](E7.5R-PORTABLE-ART-REVIEW.html) · [E7.5R QA](../../benchmarks/results/e75r/verification.json)

Checkpoint E7.5R là `80c0fe247cfa2e8438d9c73e744cbbb4df1da00c`. Parent trực tiếp là commit triển khai ghi trong HTML `fcf9c3d638fea6d6b23608c1bdae671ce0a2df63`. Benchmark E7.6 kiểm lại toàn bộ 263 mục SHA-256 của E7.5R.

## Capability audit

| Năng lực | Tại checkpoint E7.5R | Pilot E7.6 và giới hạn |
| --- | --- | --- |
| Spec và phiên bản | SUPPORTED. UniversalAssetSpec và ArtDirectionSpec có version, schema và nguồn được khóa. | SUPPORTED. Envelope thử nghiệm v1 khóa brief, seed, camera, palette và source SHA. UniversalAssetSpec production giữ nguyên. [Asset spec](../../src/specs/asset.ts) · [Art direction](../../src/experiments/art-direction.ts) |
| Nước | MISSING. Địa hình E3 dùng ramp cỏ và đất, rồi E6 ánh xạ lại theo ánh sáng. | SUPPORTED. Vùng nước tĩnh như primitive, mask tách hẳn khỏi màu. Dòng chảy động và mô phỏng nước MISSING. [E6 render](../../src/generators/environment/render.ts) · [Semantic render](../../src/experiments/semantic-environment.ts) |
| Bờ và chuyển tiếp | PARTIAL. E3 có autotile cỏ/đất, chưa có quy tắc mép nước. | SUPPORTED. Đường bờ nội suy theo từng hàng và quy tắc đất, nước nông, lau. [Terrain source](../../src/generators/terrain/) |
| Cầu, bến, cọc và cửa xả | MISSING. E6 dựng outpost/ruin, E7 có vật liệu gỗ và đá nhưng thiếu cấu trúc bắc qua nước. | SUPPORTED. Footprint cầu/sàn, mép ván, chân đỡ, cọc collider, anchor cập bến và mô-đun cửa xả đá/gỗ. Mô-đun cửa xả tĩnh. [Layout](../../src/experiments/semantic-environment.ts) |
| Độ cao và vật cản | PARTIAL. E6 có footprint và xếp lớp theo pivot. | PARTIAL. Freeboard là độ sâu biểu diễn trong hình chiếu. Collision tĩnh và contact-sorted foreground hoạt động trên một mặt phẳng. Vật lý đa tầng, bước lên/xuống và vật cản chuyển động NOT_TESTED. [Geometry QA](../../src/experiments/semantic-environment-export.ts) |
| Walkable và liên thông | PARTIAL. E6 kiểm lối cửa, điểm probe và sweep quanh actor. | SUPPORTED. Kiểm BFS bốn hướng từ surveyor đến sàn trên mask giải mã từ scene JSON với footprint 19×5 lấy từ asset Surveyor đã khóa. [E6 composition](../../src/generators/environment/composition.ts) · [Spatial validator](../../src/experiments/semantic-environment-export.ts) |
| Occlusion, anchors và tỷ lệ | SUPPORTED. E6 xếp theo điểm tiếp đất, giữ occlusion, chân và sprite anchors. | SUPPORTED cho cảnh tĩnh. Kiểm pixel của actor, prop, công trình ở vùng chồng lớp. Giá trị pixels-per-unit và camera vẫn lấy từ E6 style. [Renderer](../../src/generators/environment/render.ts) |
| Atlas và tilemap | PARTIAL. E3 có tileset 16px cùng metadata. E6 có atlas các mảnh kiến trúc. | SUPPORTED. Atlas scene 16×16, tile IDs, RGBA hashes, tilemap, lớp phủ foreground và RLE gameplay. Ghép lại đúng từng pixel cho Day và Night. Chuẩn nhập vào game engine NOT_TESTED. [Export](../../src/experiments/semantic-environment-export.ts) |
| Style, vật liệu và quality | SUPPORTED. E7 định tuyến theo style profile chung, vật liệu dùng mask và kiểm dưới Day/Night. | SUPPORTED trong pilot. Palette đất/gỗ/đá cùng họ, nước có bốn màu khóa mỗi điều kiện. Thử sửa đúng một vùng. [E7 audit](e74-pilot-architecture.md) |
| Studio adapter | PARTIAL. Pixel documents nhận PNG thuần. | SUPPORTED cho PNG. Native import các lớp scene, texture atlas, tile IDs và metadata gameplay vào Studio NOT_TESTED. [Studio parity](../../benchmarks/results/e76/studio-parity.json) |
| Thuyền, cập bến động | MISSING | `CAPABILITY_GAP`. Có anchor và cọc, chưa có asset thuyền có cấu trúc, nước động hoặc hành vi cập bến. |

## Scene contract v1

- **Intent.** Fixture mô tả chức năng ferry hoặc floodgate, điều kiện bố cục, yêu cầu khoảng trống tại bờ, spawn, vị trí cập bến và các prop. Source hashes khóa brief, profile, style và scene gốc. Floodgate dùng fixture riêng đã đóng băng trước lần chạy đầu. [Lock](../../benchmarks/fixtures/e76/pilot-lock.json) · [Freeze](../../benchmarks/fixtures/e76/floodgate-freeze.json)
- **Geometry.** Tọa độ pixel nguyên với gốc trên trái, hình chiếu 3/4, 320×208. Shoreline lưu một ngưỡng x mỗi hàng, sàn/cầu/lối vào và collider lưu polygon. Cọc và nhân vật đặt theo pivot; hàng y là độ sâu. E3 tái tạo đất bằng seed; E6 tiếp tục dựng cảnh và sở hữu thứ tự actor, prop, công trình. [Fixture Mistfen](../../benchmarks/fixtures/e76/mistfen-landing.json) · [Fixture Floodgate](../../benchmarks/fixtures/e76/floodgate-yard.json)
- **Material.** Ramps E7 dùng chung cho nhân vật, địa hình, công trình và gỗ. Nước có ramp riêng theo Day/Night. Màu của diagnostic overlay là chú giải.
- **Gameplay.** Collision gồm nước ngoài sàn và các collider đặc của E6. Walkable là phần bù trong khung 320×208. Mỗi mask có 208 hàng RLE và các đoạn nửa mở `[startX,endX)`. JSON mang spawn, bank entry, berth, mooring, gate anchor, clearance, depth order và collision polygon. Y của pivot là mép cuối của footprint nửa mở. [B1 Scene JSON](../../benchmarks/results/e76/mistfen-ferry-landing/b1/scene-day.json)
- **Render và replay.** Atlas 16×16 dùng ID nguyên và SHA-256 RGBA từng ô. Đọc lưới row-major, ghép atlas ở origin [0,0] và đặt foreground PNG binary alpha phía trên. Gameplay dùng JSON tương ứng với scene, độc lập với màu/alpha nền. [Tilemap JSON](../../benchmarks/results/e76/mistfen-ferry-landing/b1/tilemap-day.json)

## So sánh và giới hạn mỹ thuật

| Kiểm tra 1× | Mistfen | Floodgate holdout |
| --- | --- | --- |
| Công năng, điểm nhìn và bố cục | Cầu nối bờ với sàn, cọc gỗ ở mép và Courier tạo điểm đích. Ánh sáng trên outpost và nhân vật cạnh tranh với bến. | Dáng cửa xả với hai trụ, dầm ngang và thanh đứng phân biệt được từ chỗ đổ nát bên trái. Dòng nước quanh cửa giống mặt nước còn lại và chiều vận hành khó đọc. |
| A0-Matched và B1 | B1 đẩy đầu sàn về vị trí berth với cổ cầu gọn hơn. A0 ăn sâu hơn vào bờ nên vùng tiếp đất đọc rộng ở 1×. B1 giảm phần sàn nằm trên đất từ 953 xuống 567 px. Cả hai dài 186 bước từ spawn đến berth. | B1 tự giải đầu nối ngắn hơn. A0 ăn sâu vào bờ và có nhiều chỗ trống quanh nhân vật. B1 giảm phần sàn trên đất từ 765 xuống 513 px. Cả hai dài 149 bước. |
| Vật liệu và góc nhìn | Đầu ván, mép sàn và chân đỡ cho cảm giác độ cao. Vệt nước đều theo hàng và mép bờ hẹp. Ban đêm đọc được chuyển tiếp, độ nổi của cọc giảm. | Hai mặt tháp và dầm gỗ duy trì cùng hướng chiếu. Cọc, cửa và courier có cạnh kề nhau. Ở Night các khoảng tối giữa thanh đứng giảm độ rõ. |
| Outline, cụm pixel và ánh sáng | Chỗ bến dùng đường viền mảnh và các mảng gỗ dài. Nước có dải nét thưa. Night vẫn có mép gỗ và nước riêng, nhưng bậu cập bến hẹp. | Đá có nhóm sáng/tối rõ. Một số đường ngắn cạnh trụ tạo thêm cạnh cạnh tranh ở kích thước gốc. |

B1 lập bố cục từ bờ, berth, độ rộng và độ phủ đất. A0-Matched đặt footprint thủ công có chủ ý và chạy cùng primitive, renderer, seed, kích thước, style và tỷ lệ. Hai bố cục đều qua QA; kết quả chưa đủ để chọn bản mỹ thuật tốt hơn. Holdout chứng minh tái sử dụng hệ nước/lối đi tĩnh trên một trạm cửa xả. Phiếu chính thức chờ reviewer.

MF-01 thử làm rõ mép cập bến bằng một dải vật liệu 3 px trên bề mặt ván B1 Mistfen. Báo cáo lưu trước/sau, target mask, pixel diff và kiểm vùng bảo vệ. Gameplay và geometry giữ nguyên. Chênh lệch ở 1× nhỏ, nên giữ bản gốc với trạng thái `NO_MEANINGFUL_VISUAL_GAIN`. Holdout dùng quy tắc đã khóa và không chạy refinement. [Trial QA](../../benchmarks/results/e76/benchmark.json)

## E8 readiness gaps

- Xác nhận Project Owner chọn bố cục và giới hạn mỹ thuật cho hai cảnh.
- Xác minh importer của game đích đọc atlas, tile IDs, origin, PPU và quy đổi gốc top-left. Kiểm pivot, foreground sort, spawn và collision trên scene chạy thật.
- Kiểm di chuyển theo footprint, mép sàn, chướng ngại động và tương tác tại berth. Đo khi actor đi ngang cọc ở camera game.
- Xác định hợp đồng cho asset thuyền, anchor ghép thuyền, hoạt ảnh nước và trạng thái cửa xả nếu có yêu cầu. Tách gameplay độ cao khỏi độ cao biểu diễn.
- E8 và tích hợp production chờ phê duyệt phạm vi. Character Animation còn ở gate riêng.

## Reproduction

Chạy `node scripts/benchmark-e76.ts` để xây lại evidence ở thư mục run. `node --test scripts/e76-studio.ts` kiểm Studio qua asset PNG và viết kết quả trong Engine. Bản ghi chính thức luôn dùng SHA niêm phong. [Input lock](../../benchmarks/fixtures/e76/pilot-lock.json) · [Evidence SHA-256](../../benchmarks/results/e76/SHA256SUMS) · [Full QA](../../benchmarks/results/e76/verification.json)
