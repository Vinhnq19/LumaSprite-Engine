# E7.3 Architecture Proposal

**DESIGN ONLY · Cross-Asset Art Direction & Style Consistency.** Đề xuất tái sử dụng Art Style Profile v1 theo khả năng của từng họ asset. B1 khóa góc 3/4 phải, tile 16 px, 32 px/đơn vị, canvas actor 64 px, đèn trên trái, bóng đổ, độ dài cụm chi tiết và ramp Day/Night. [Profile hiện có](../../benchmarks/fixtures/e61r/style-profile.json) · [Schema](../../src/specs/environment.ts)

| Họ asset | Hiện trạng đã kiểm tra | Phần dùng chung có thể thử |
| --- | --- | --- |
| Character | Schema khóa canvas 64×64, góc 3/4 phải, pose và pivot. Renderer dùng M1/M2/M2P và palette theo policy. | Cùng thang Day/Night và cấp outline giữa vai, trang bị, nền. Giữ màu vai trò, shape lock, contact và giới hạn pixel của pose. [Schema](../../src/specs/character.ts) · [Material renderer](../../src/generators/character/materials.ts) |
| Props | AssetSpec khóa canvas của prop, art direction trên trái và palette. Relay pilot đã dùng ramp B1. | Ghép vai trò gỗ/kim loại/amber, mặt trên–mặt bên và viền tiếp xúc theo scene. Brief cần dấu hiệu chức năng ở silhouette trước khi thử màu. [AssetSpec](../../src/specs/asset.ts) · [Relay](../../src/experiments/structure-quality/relay.ts) |
| Terrain | Schema khóa tile 16 px, adjacency và cho phép texture sparse/standard/dense ở atlas hoặc world. | Đồng bộ tỷ lệ với scene và mức tương phản vùng nghỉ để prop/actor đọc rõ. Giữ adjacency, biên tile và palette contract. [Terrain spec](../../src/specs/terrain.ts) |
| Environment | Composition khóa source kit, style, terrain và anchor theo checkpoint. Renderer làm điểm đối chiếu Day/Night. | Dùng B1 làm scene tham chiếu. Kiểm điểm nhấn, viền mặt khuất, vùng nghỉ và bóng tiếp xúc ở camera đích. [Scene loader](../../src/generators/environment/composition.ts) |
| UI | Interaction 16 px và inventory 32 px đã pin file profile, inventory còn pin nguồn barrel. | Chia sẻ hue nhấn và cấp tương phản. Giữ tỷ lệ native UI cùng nhịp viền dễ đọc trên nền giao diện. [UI spec](../../src/specs/pixel-effects.ts) · [Renderer](../../src/generators/pixel-effects/ui.ts) |
| VFX | Pin style và nguồn, tách nhịp anticipation/peak/dissipation; size 32/48 px. | Dùng quy ước amber/vật liệu cùng bảng màu. Biên sáng nhất dành cho tín hiệu có ý nghĩa, giữ actor và đường đi đọc được khi phát hiệu ứng. [VFX spec](../../src/specs/pixel-effects.ts) · [Renderer](../../src/generators/pixel-effects/vfx.ts) |
| Animation | Frame 64 px pin CharacterSpec, shape lock, manifest, thứ tự lớp, pivot và contact. | Kế thừa palette, viền và cấp chi tiết từ pose tĩnh. Giữ dấu hiệu thể tích và material ổn định qua frame, kiểm ở tốc độ gameplay. [Animation spec](../../src/specs/animation.ts) |

## Ranh giới profile

- Dùng một profile versioned cho camera, tỉ lệ pixel, hướng sáng, ramp theo vai trò, phân cấp viền và mật độ cụm theo khoảng cách. Mỗi họ ánh xạ từ vai trò chung sang palette/surface hiện có, ghi hash profile và phép ánh xạ trong manifest thử nghiệm.
- Geometry, pivot, collision, tần suất animation, tiling và ý nghĩa UI/VFX thuộc spec chuyên biệt. Kiểm alpha, footprint và provenance theo baseline đã duyệt. Vì E7.2-R chưa có lựa chọn mỹ thuật cuối, stone S0 là scene control.
- Phân cấp chi tiết theo khoảng cách và nhiệm vụ gameplay. Silhouette và vật tương tác bật rõ ở 1×. Chỉ dùng 4× để soi viền, ramp và nhịp cụm. Giữ face hierarchy rõ cả Day/Night và kiểm lại màn UI riêng. Đánh giá chênh luma theo vai trò và các vùng đọc, với phiếu duyệt riêng của Owner.

## Bộ sản phẩm đề xuất

Brief **Trạm mốc đèo sương**. Cùng camera 3/4 phải, kim loại lạnh, gỗ ấm, amber dùng cho tín hiệu đang hoạt động, mặt đá ẩm và đèn trên trái.

| Asset | Native và yêu cầu đọc |
| --- | --- |
| Nhân vật kỹ thuật viên | 64×64. Dáng đội mũ thấp, áo ngắn, mang dụng cụ hiệu chuẩn. Đọc rõ vai, tay và chân tiếp đất ở 1×. |
| Prop đầu đọc mốc | 32×32. Một chân gá và cửa amber nghiêng tạo silhouette dễ nhận hơn thân hộp. Thấy gỗ, kim loại và hướng đọc ở cả nền sáng/tối. |
| Sân trạm đèo | 320×208, tile 16 px. Tường đá thấp ẩm, đèn trên trái và lối vào rõ. Nhân vật và đầu đọc đặt ở cùng hai anchor khi so Day/Night. |

So ba asset riêng lẻ và cùng cảnh với một bộ chưa áp dụng profile. Kiểm 1× trước rồi mở 4×, giữ variant Day/Night cùng geometry. Chốt tiêu chí vai trò màu, viền, thang sáng, mật độ và khả năng đọc khi thao tác. Giữ một brief khác làm holdout. Owner duyệt brief, baseline và rubric trước khi triển khai E7.3.
