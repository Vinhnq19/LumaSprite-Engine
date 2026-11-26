# E6.2 Scene Composition

`E6_2_READY_FOR_HUMAN_SCENE_REVIEW` trên nhánh `codex/e6-2-scene-composition` từ `24b8ca6`. Project Owner đã duyệt kỹ thuật và duyệt mỹ thuật E6.1R có giới hạn, chọn B1 làm baseline. C1 và C2 đang chờ chấm cảnh độc lập ở 1×. [Báo cáo chung offline](LumaSprite-Engine-E6.2-Report.html) · [Quyết định E6.1R](e61r-artistic-acceptance.md) · [Khóa B1](../benchmarks/fixtures/e62/b1-production-lock.json)

## Kiến trúc composition

EnvironmentSpec v2 ráp một mặt tiền, mái, hồi, trụ, kính, cửa và ba phần tử gắn cảnh. Compositor E6.1R dựng terrain theo map E3.4, remap palette qua Art Style Profile v1, tạo bóng tiếp xúc, kiểm aperture/collider và xếp sprite theo pivot chân. Manifest xuất ảnh bake và mặt nạ. Studio chỉ cần PNG ở biên tích hợp hiện hành.

SceneCompositionSpec v1 ghim EnvironmentSpec, style và terrain qua SHA-256. Fixture cấp map, seed, điểm đặt công trình, prop, spawn, polygon đường lát, vùng đi được, tuyến di chuyển, vùng tương tác, phân cấp điểm nhìn, nhóm ánh sáng và sáu điểm thử. Collider lấy từ footprint thật của kit và prop. Các polygon đi được được trừ collider trên lưới pixel, sau đó quét bề rộng thân dọc từng tuyến. Compositor dùng lại pivot-y, bóng, vật liệu, kit và layer ownership của E6.1R. Composition bổ sung lớp lát, bóng sáng nền đêm và chi tiết phần nền sau ngưỡng. Terrain seed điều khiển chi tiết E3.4. Kit dùng seed gốc.

Cùng tỷ lệ 320 × 208, 32 px/unit, 16 px/ô, tường 66 px và khoảng mở 26 × 58 px. Tám module kích thước cố định khớp SHA-256 RGBA giữa hai bố cục. Mái chung thuật toán với chiều ngang 128 px tại C1 và 112 px tại C2. Cả hai atlas và metadata khớp đúng bản B1 tương ứng ở mỗi điều kiện sáng. Có 576 mẫu nối tường/mái đạt ở C1 và 496 ở C2. [C1 spec](../benchmarks/fixtures/e62/c1-courtyard.json) · [C2 spec](../benchmarks/fixtures/e62/c2-supply-stop.json)

## Hai cảnh và công năng

| Cảnh | Đường đi | Khu thao tác | Chiều sâu và vùng nghỉ |
| --- | --- | --- | --- |
| C1 Survey Station Courtyard | Lối xiên nối mép dưới với cửa ở (156,124). Nhánh ngắn nối Surveyor với bàn. | Bàn, crate và barrel tụ ở sân trái. Courier đứng ở vùng riêng bên phải. | Cỏ yên phía sau giữ silhouette mái. Sân giữa thoáng và đường xiên dẫn mắt tới cửa. |
| C2 Roadside Supply Stop | Đường xuyên từ trái sang phải. Nhánh rẽ dẫn cửa (96,118). Một lối vòng qua mặt hồi phải lên phía sau. | Bàn tiếp nhận và vật tư ở turnout bên phải. Courier đứng sát khu giao nhận, Surveyor ở đường giao nhau. | Công trình chiếm nửa trái. Khoảng trống trên đường phân tách luồng đi với cụm hàng và thêm lựa chọn vòng theo chiều sâu. |

C1 kiểm 1.292 mẫu thân trên tuyến cửa và 1.311 trên tuyến tới bàn. C2 kiểm 6.216 trên đường xuyên cảnh, 3.325 khi vòng sau nhà và 798 trên nhánh cửa. Hình học collision, vùng đi được và lượng che khuất của actor đồng nhất giữa ngày và đêm. Vật tư tách footprint với nhau và với móng. PNG overlay đánh dấu điểm nhìn chính, điểm phụ, vùng nghỉ, vùng nhân vật, tiền cảnh, hậu cảnh và tương tác. [Bảng so sánh](../benchmarks/results/e62/comparison.json)

## Chiều sâu và thử đi qua ngưỡng

Sáu vị trí mỗi cảnh gồm trước cửa, ngưỡng cửa, hông, sau nhà, giữa vật tư và sau prop tiền cảnh. Cả 24 tổ hợp vị trí và ánh sáng đã kiểm. Probe trước cửa hiện đủ 1.072 px Surveyor. Tường che đúng 22 px Courier đứng trong ngưỡng, che 86 px ở hông C1 và 231 px ở hông C2. Probe Surveyor sau nhà được shell che hoàn toàn. Crate tiền cảnh che 109 px ở C1 và 160 px tại C2, nơi barrel che thêm 58 px. Kết quả có ảnh cảnh, điểm neo và collision để người duyệt đánh giá ở 1×. [C1 probes](../benchmarks/results/e62/spatial/c1-courtyard-day.json) · [C2 probes](../benchmarks/results/e62/spatial/c2-supply-stop-night.json)

Tám playback dùng frame W2 và Courier Walk từ E5.4, kiểm SHA-256 của clip, timing JSON, từng ô RGBA, pivot và root/contact. Chuỗi liền mạch có 17 frame cho mỗi actor, từ approach qua landing, threshold tới exit ở dải nền 6 px phía sau cửa. Cả 1.235 mẫu quét thân Surveyor và 1.029 mẫu Courier đều thông. Jamb dần che thiết bị và phần silhouette khi actor đi vào chiều sâu. Ở mỗi frame vẫn thấy một phần actor và pixel gần chân. Probe này kiểm tới dải ngay sau ngưỡng. Vùng chơi nội thất chưa thuộc phạm vi.

Có 16 cặp chân trụ liên tiếp mỗi clip. Root X và thời lượng theo Discrete Root A, trượt theo trục clip là 0 px. Layout chiếu pivot vào sâu tối đa 2 px giữa hai frame kế tiếp, nên các pixel chân trụ dịch tối đa 2 px trong màn hình khi chuyển chiều sâu. Đây là giới hạn của clip khóa chạy ngang khi dùng làm thử nghiệm qua cửa. Có thể bật dấu pivot và hai contact trong HTML để duyệt chuyển động. [C1 Surveyor trace](../benchmarks/results/e62/playback/c1-courtyard-day-surveyor.json) · [C2 Courier trace](../benchmarks/results/e62/playback/c2-supply-stop-night-courier.json)

## Ánh sáng và vật liệu

Vách gỗ nghiêng và hai hàng lát ngắn phía trong tạo lớp chiều sâu cho hốc. Ánh amber áp vào bậc trong, jamb và nền quanh cửa. Điểm sáng bàn phân khu thao tác C1. C2 giữ vệt sáng bàn tiết chế và làm rõ nền của lối vòng. Mặt nạ ban đêm ghi 5.496 px ở C1 và 2.491 px ở C2 gồm ánh cục bộ và ambient fill. Mọi pixel actor thấy được đều khớp RGBA nguồn. Mask sáng được dựng trước actor và tách PNG.

Trong Courtyard Night, Courier edge p10 luma tăng từ 12 ở B1 lên 18, toàn bộ 997 px actor nhìn thấy. Đặt Courier lùi khỏi cụm vật tư và dùng mặt nền đúng vai trò màu giúp đọc lõi silhouette. C2 Night có p10 15 so với 20 ở B1 Roadside. Courier đã chuyển sang cạnh cụm hàng với nền lát tối hơn, nên vẫn cần duyệt vai và áo ở 1×. Không thêm viền lên actor. Zone texture đo cạnh luma ≥ 6 trên 100 mẫu cùng vật liệu. C1 ngày có 26,6 ở bàn và 15,3 ở vùng nghỉ nền trên. C2 ngày có 29,0 ở chỗ nhận hàng và 6,9 ở tiền cảnh để giữ đường đọc dễ. [QA C1 đêm](../benchmarks/results/e62/packages/c1-courtyard-night/qa.json) · [QA C2 đêm](../benchmarks/results/e62/packages/c2-supply-stop-night/qa.json)

## QA, Studio và Unity

- Lint, typecheck, build, **70/70 Engine tests** và CLI smoke đạt. Test mới từ chối sai nguồn hoặc sai quy tắc depth, thử tuyến va collider và kiểm các probe có chủ đích.
- Tái tạo **805 historical hashes**, **361 artifact** E2.4/E3.4/E4.4/E5.1/E5.2, 50 file E5.3 và 54 file R&D. Tái tạo E6.1 đủ **104 SHA-256** và E6.1R đủ **102 SHA-256**. Tổng danh mục bảo vệ E6.1R gồm 109 file, kể cả report và provenance.
- **4 gói E6.2, 91 SHA-256 payload** khớp khi tái tạo độc lập. Export kiểm alpha nhị phân, RGB của vùng trong suốt, palette hợp lệ, masks, render lặp và 4× nearest-neighbor. CLI build xuất và verify C2 Night khớp 16 file.
- **Studio `bb5c384` giữ RGBA cho 7 PNG**, qua nhập, lưu, mở lại và xuất. Các file gồm bốn cảnh, một atlas, một mask sáng và một mask walkable. [Studio parity](../benchmarks/results/e62/studio-parity.json)
- **Unity 6000.3.21f1 Editor import đạt 7 PNG** cho target StandaloneWindows64. Batch test chạy qua Unity CLI trong project cache riêng, dùng hàm import E5.4 với Point, Uncompressed, mip count 1 và đối chiếu SHA-256 RGBA sau import. Bằng chứng di chuyển E6.2 đến từ Chrome, phạm vi Unity là Editor import. [Unity evidence](../benchmarks/results/e62/unity-import.json)
- Chrome chạy gallery offline ở 320 × 208 và 1280 × 832, probe, playback, score export và bố cục 390 px. Score sheet để trống lúc mở. Bản bàn giao thêm SHA-256 của fixtures, báo cáo và kết quả tích hợp. [SHA-256](../benchmarks/results/e62/SHA256SUMS)

```powershell
npm run build
npm run composition -- --spec benchmarks/fixtures/e62/c1-courtyard.json --out benchmarks/results/run/e62/c1-cli --lighting night
npm run composition -- --verify benchmarks/results/run/e62/c1-cli
npm run benchmark:e62 -- --out benchmarks/results/run/e62/reproduction
$env:LUMASPRITE_ENVIRONMENT_EDITION='e62'
npm run test:environment-studio
Remove-Item Env:LUMASPRITE_ENVIRONMENT_EDITION
& ./scripts/e62-unity/run.ps1
npm run report:e62
```

## PR summary

**Title** · Compose two Field Outpost layouts with the approved B1 kit

**Body** · Add SceneCompositionSpec v1, the Survey Station Courtyard and Roadside Supply Stop, and shared composition checks. Replicate B1 geometry and atlas bytes for the two footprints, validate body-width traversal and layer order, and export four day/night packages. The offline review includes six spatial probes per scene, eight timed walk sequences into the threshold apron, material and lighting diagnostics, and an independent 12-criterion score sheet. Verified historical hashes, Studio RGBA round-trip and Unity Editor import. Human visual review is pending.

## Đề xuất E6.3

Sau quyết định của Project Owner, chọn một brief nhỏ về biến thể công năng hoặc địa hình. Đặt tiêu chí trước về độ khác biệt silhouette, phân lớp chiều sâu, tuyến đi và độ rõ 1×. So với C1/C2 bằng cùng scale và QA, đo mức tái sử dụng kit, thêm module mới khi có nhu cầu cụ thể từ layout. E6.3 chờ phê duyệt.
