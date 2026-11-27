# E7.6 closeout and E7.6R functional environment quality

## E7.6 decision record

`ASSISTANT_REVIEW_RECOMMENDATION`. Phiếu Project Owner chưa có điểm hay lựa chọn.

| Gate | Khuyến nghị |
| --- | --- |
| E7.6 Engineering | APPROVED theo QA đã báo cáo |
| Mistfen B1 | SELECTED_FOR_REFINEMENT |
| Floodgate B1 | APPROVED_WITH_LIMITATIONS |
| Semantic Environment Contract | APPROVED_FOR_RESEARCH |
| Generalization | PARTIAL_PASS |
| Production Integration | NOT AUTHORIZED |
| E7.6R Research Pilot | AUTHORIZED_BY_THIS_TASK |
| E8 | PREFLIGHT DESIGN ONLY |

`80c0fe247cfa2e8438d9c73e744cbbb4df1da00c` là checkpoint E7.5R. Con trực tiếp `ec5d8c6ec3d9130bd118dfcb8bcc1528a1158faa` tạo mã pilot và 91 payload E7.6. Commit `1f5350a67e599c4228591693c995cee49d21b7b8` thêm báo cáo portable và handoff. Kiểm ancestry và SHA-256 đủ 91 mục. Các bản A0-Matched và B1 lịch sử dùng nguyên byte. [E7.6 report](E7.6-PORTABLE-ART-REVIEW.html) · [E7.6 QA](../../benchmarks/results/e76/verification.json)

## Root-cause art audit

| Phân loại | Quan sát ở native 1× | Nguồn, quy tắc và tác động | Phần bảo vệ |
| --- | --- | --- | --- |
| SEMANTIC_LAYOUT_ERROR | Đầu cầu ở Mistfen là một hình chữ nhật chung với lối dẫn. Floodgate có sàn, vị trí thao tác nằm ngoài khả năng nhận diện. | `planLanding` tạo footprint đúng nhưng không phân vật liệu đoạn tiếp cận và apron. B2 xoay nhịp ván, thêm sill/vành và chuyển cọc bên trong của các cảnh có cửa van thành tay quay ở cạnh cầu. Anchor đứng kiểm từ scene JSON. | Footprint cầu và sàn, lối vào, bờ, vị trí spawn và berth giữ nguyên. Chỉ footprint cọc/tay quay đã di chuyển đổi. [Mistfen 1×](../../benchmarks/results/e76/mistfen-ferry-landing/b1/day.png) · [Floodgate 1×](../../benchmarks/results/e76/floodgate-maintenance-yard/b1/day.png) |
| STRUCTURE_CAPABILITY_GAP | Cọc B1 giống trụ nhỏ. Cánh Floodgate đọc thành tấm gỗ kín. | Cọc dùng chốt chữ T với đỉnh kim loại. Tấm gỗ có ngưỡng thẳng, khe nước thật trong raster và hai ray. Công trình dùng cùng primitive ở Canal Intake. | Pivot và kích thước collider cổng giữ nguyên. `BOAT_ASSET_CAPABILITY_GAP` còn mở. [Source](../../src/experiments/functional-waterfront.ts) |
| MATERIAL_READABILITY_ERROR | Vệt nước B1 lặp thành hàng ngang, đường bờ chạy đều và cọc Night chìm vào nước. | Công thức `wave` của E7.6 rải chi tiết theo chu kỳ y. B2 thưa cụm nước, ngắt quãng viền nông, đổi tối tiếp xúc theo chân đỡ và thêm dấu dòng nước tĩnh gần khe van. | Palette E7 / ramp nước khóa, shape water và collision. [B1 Night](../../benchmarks/results/e76/mistfen-ferry-landing/b1/night.png) |
| PERSPECTIVE_ERROR | Ở tiếp giáp mặt ván và chân đỡ B1, viền trước mạnh và dày đều nên độ sâu đọc phẳng. | B2 dùng mặt cắt 3/4 của `projectBox`, chân đỡ xa tối hơn, viền sáng chỉ nằm trên mặt ván và viền cọc. | Camera, sàn 2D, freeboard và độ dốc thiết kế không đổi. |
| GAMEPLAY_SPATIAL_ERROR | E7.6 không có lỗi đường đi lấy đích berth. Cảnh cửa xả thiếu điểm đứng có thể kiểm cho thao tác. | B2 xuất riêng pivot tay quay, vị trí tay nắm trên ảnh và stand. BFS từ JSON kiểm footprint Surveyor 19×5 còn lọt. Kiểm cả việc che tay quay và nước nhìn thấy dưới mép cánh. | Địa hình, colliders còn lại, thứ tự layer, anchor actor và props gốc. |
| VISUAL_HIERARCHY_ERROR | Nhà và Courier sáng ở Mistfen, cạnh tranh với đầu bến. Cổng và Courier xếp dọc cùng vùng ở Floodgate. | Dùng sill sáng, chốt gỗ, dấu dòng cục bộ và đặt tay quay lệch ngang khỏi Courier. Giữ lại đèn nhà và các pixel actor. | Nguồn ánh sáng, actor và giá trị sáng nhà được giữ. Nhà vẫn có thể hút mắt ở 1×. |

## Comparison and gates

B2 mở rộng tổ hợp E7.6 qua cùng schema, E3 terrain, E6 contact sorting, E7 palette và bộ xuất atlas/tilemap cũ. Mỗi cặp có cùng camera, seed, style, nguồn nhân vật và prop, và điều kiện ánh sáng. B2 dùng quy tắc gỗ, mép nước, chân đỡ và cửa van chạy từ geometry đã giải. A0 và B1 đã khóa ở Mistfen và Floodgate. Floodgate là diagnostic đã xem. Chỉ Canal Intake Service Platform là fresh holdout. Bố cục của Canal đặt đường tiếp cận ở khúc bờ phía trên, dùng khẩu độ cửa hẹp hơn và chơi cùng một bộ quy tắc B2. [Holdout lock](../../benchmarks/fixtures/e76r/holdout-freeze.json)

- **Mistfen.** Ván ngang và chốt bến tạo điểm kết thúc dễ đọc hơn. Nước có nhiều vùng nghỉ. Đèn nhà vẫn là điểm sáng mạnh và chốt phía xa vẫn sau Courier. Boong mới phù hợp hơn với một bến cập, công năng phà còn phụ thuộc thuyền hoặc ngữ cảnh.
- **Floodgate.** Ray, mép ngưỡng và khe nước giúp phân biệt cánh nâng với tường. B2 thêm tay quay nhìn thấy từ cầu và đích kiểm được trên sàn. Ở 1×, tay quay nhỏ và liên kết cơ khí từ bệ điều khiển đến cánh chưa rõ. Mảng đá kế bên đổi mức che trong đúng bounds của cổng vì silhouette mới.
- **Canal Intake.** Holdout kiểm mô-đun trên khúc kênh có điểm tiếp cận cao hơn, không đổi phong cách hay seed theo ảnh. Đường tới sàn 165 bước, tới tay quay 126 bước. Courier đứng trước khe khiến chỉ 19 pixel nước nhìn thấy so với ngưỡng 35 ở cả hai ánh sáng. Giữ INTAKE_APERTURE_OCCLUDED là CAPABILITY_GAP. Replay và occlusion tĩnh vẫn đúng theo depth order, khả năng tổng quát hóa công năng chỉ đạt một phần.
- **Tiêu chí quyết định.** Reviewer đánh riêng Semantic Recognition, Visual Quality, Gameplay Quality và Generalization. QA kỹ thuật là gate riêng. Chọn A0-Matched, B1, B2 hoặc Neither sau khi xem 1× Day/Night. [Phiếu trống](../../benchmarks/results/e76r/human-review.json)

## Spatial results

| B2 | Bước đến bến | Bước đến tay quay | Pixel nước nhìn qua khe | Pixel collision đổi | Pixel ảnh đổi so với B1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mistfen | 186 | — | — | 0 | 4,388 |
| Floodgate | 149 | 109 | 60 | 48 | 6,476 |
| Canal Intake | 165 | 126 | 19 / 35 | 48 | 5,949 |

Chi tiết Day/Night trùng cho các số trên. Trong hai cảnh có van, 48 pixel collision đổi do dời đúng một collider tay quay. Mask deck, bờ, nước, hỗ trợ và access giữ nguyên. Floodgate có 145 pixel đổi chủ giữa mô-đun và kiến trúc do cánh nâng mới. Tất cả pixel actor giữ nguyên và không có thay đổi ngoài vùng cho phép. Phép thử freeze ban đầu dừng với lỗi thị giác Canal. Log evidence sau đó giữ lỗi, dùng cùng điều kiện và lưu các kết quả spatial độc lập. [Frozen check](../../benchmarks/fixtures/e76r/holdout-freeze.json) · [QA](../../benchmarks/results/e76r/verification.json)

## Reproduction

`node scripts/benchmark-e76r.ts` tái tạo evidence trong thư mục run, dùng freeze đã khóa. Các mask hiện hữu được kiểm theo geometry, không suy từ màu. E6 resolve foreground; atlas 16×16 + foreground binary alpha được giải mã để replay cảnh đúng RGBA. Các thay đổi ngoài water/bank/deck/support mask và vùng chiếm chỗ trước/sau của landmark bị chặn. [Benchmark](../../benchmarks/results/e76r/benchmark.json) · [SHA-256](../../benchmarks/results/e76r/SHA256SUMS) · [QA](../../benchmarks/results/e76r/verification.json)

[Portable Art Review](E7.6R-PORTABLE-ART-REVIEW.html) · [E8 Preflight](../integration/e8-environment-preflight.md)
