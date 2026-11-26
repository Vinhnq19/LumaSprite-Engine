# E6.1R Field Outpost

`E6_1R_READY_FOR_HUMAN_ART_REVIEW` · nhánh `codex/e6-1r-environment-quality` từ `537f604`.

Project Owner đã duyệt E6.1 engineering, giữ ENV-A làm đối chứng, chọn ENV-B để tinh chỉnh và yêu cầu duyệt lại mỹ thuật. B0 dẫn thẳng tới bốn bản ENV-B gốc. B1 dùng hai fixture EnvironmentSpec v2 mới. Điểm mỹ thuật và quyết định E6.2 còn mở. [Báo cáo offline](LumaSprite-Engine-E6.1R-Report.html) · [Gói E6.1 gốc](../benchmarks/results/e61/benchmark.json)

## Tỷ lệ, mặt bằng và lối vào

Ở 1×, hốc B0 cao 24 px, tương đương 43% chiều cao nhìn thấy của Surveyor và 46% của Courier. Mô-đun rộng 16 px và vùng collision thông 10 px, bằng khoảng ngang hai mốc vai và hẹp hơn thân áo của cả hai. Vệt tối B0 là hốc vẽ trên tường với thanh gỗ chồng lên một phần. Mép ngưỡng nối được với lối đi, nhưng tỷ lệ của hốc và collider làm cửa khó đọc khi đặt cạnh nhân vật.

| Thông số | B0 | B1 |
| --- | ---: | ---: |
| Cao tường | 32 px | 66 px |
| Module cửa | 16 px | 32 px |
| Cao vùng cửa | 24 px, hốc sơn | 58 px, khoảng mở |
| Rộng collision thông | 10 px | 26 px |
| Trụ cửa mỗi bên | 3 px | 3 px |
| Cao bệ kính theo chân tường | ≈10 px | 28 px |
| Chiều sâu mặt bên và độ nâng chiếu | 16 px / 8 px | 16 px / 8 px |

B1 có 8 px phía trên cửa để đỡ lintel, đặt cửa trên cùng mặt tường với bệ cửa sổ và nối phần hồi đá với móng. Mái có phần overhang danh nghĩa 5 px bên trái, 7 px bên phải tính từ hộp atlas và hồi chiếu. Điểm eave chuyển từ `by−29` sang `by−63`, bám vị trí tường mới. Front Court có 576 mẫu nối tường và mái, Roadside có 496. Cả hai giữ 320 × 208, hướng 3/4 phải, 16 px/ô và 32 px/unit. Atlas, ảnh lớp và mặt bằng ghi rõ pivot, bounds và collider. Style Profile vẫn v1 với các ramp day/night và hướng sáng trên-trái. [QA Front Court](../benchmarks/results/e61r/packages/front-court-day/qa.json) · [QA Roadside](../benchmarks/results/e61r/packages/roadside-day/qa.json)

| Thước nhân vật E4.4 đã khóa | Toàn silhouette rộng × cao | Ngang vai | Ngang áo | Pivot | Sweep cửa |
| --- | ---: | ---: | ---: | --- | ---: |
| Field Surveyor R2 + M2P | 33 × 56 px | 10 px | 16 px | (30,59) | 380 px |
| Forest Courier | 30 × 52 px | 10 px | 16 px | (32,58) | 420 px |

Hai ảnh dùng canvas 64 × 64. SHA của production manifest, final PNG, shape lock và part mask xác định nguồn đo. Cửa B1 cao hơn Surveyor 2 px và Courier 6 px. Chiều rộng thông lớn hơn áo 10 px. Chiều rộng silhouette có cả tay lệch và thiết bị. Sweep dùng biên áo quanh pivot và kiểm từng pixel từ `by−7` tới `by+12`. Ảnh đặt thân trước cửa và tại ngưỡng xác nhận thấy boot contact. Cửa B1 có alpha trong vùng mở trên atlas. Khi render thử ở ngưỡng, jamb che 160 px của Surveyor và 22 px của Courier. Còn thấy lần lượt 49/50 và 44/44 px vùng chân. Hai nhân vật vẫn giữ nguyên pixel nguồn trên mọi phần nhìn thấy. [So sánh Front Court](../benchmarks/results/e61r/plates/front-court-day/comparison.json)

## Bố cục và occlusion

| Điểm neo tại 1× | Front Court B0 → B1 | Roadside B0 → B1 |
| --- | --- | --- |
| Nhà | (104,124) → (84,134) | (68,117) → (57,124) |
| Trung điểm cửa | (160,124) → (148,134) | (108,117) → (105,124) |
| Thùng gỗ | (93,147) → (75,154) | (57,136) → (50,142) |
| Thùng nước | (215,151) → (220,151) | (184,148) → (206,159) |
| Bàn survey | (254,129) → (244,127) | (210,128) → (224,132) |
| Surveyor | (141,164) → (119,166) | (116,147) → (100,159) |
| Courier | (278,154) → (267,154) | (187,108) → (195,117) |

Cả hai lối đi chuyển đầu đường theo cửa mới. Front Court mở tầm nhìn từ đường lên bậc, để Surveyor lệch trái. Roadside B0 có pivot Courier gần cao độ chân hồi sau `117−8=109`, chân và mép nền đọc dính nhau. B1 đặt y=117 trước chân hồi sâu nhất y=116 và sau mặt tiền y=124. Pivot nằm ngoài footprint, cách collider gần nhất 11 px theo khoảng cách lưới đã đo. Layer theo điểm chân vẫn vẽ Courier trước khi vẽ tường, giữ 33 px bị hồi che so với 149 px ở B0. 44/44 px vùng chân nhìn thấy, có bóng tiếp đất riêng. Vị trí được chọn để tách đất dưới giày khỏi cạnh hồi, rồi kiểm lại ở cả day và night. [Footprint Roadside](../benchmarks/results/e61r/plates/roadside-day/b1-footprint.png) · [A/B Roadside](../benchmarks/results/e61r/plates/roadside-night/comparison.json)

## Ánh sáng, vật liệu và texture

Night pass có 888 px authored mỗi cảnh. Cụm amber nằm trên jamb và gỗ quanh đèn, kính và nền lát. Vệt kính gần sáng hơn kính xa. Pool nhỏ nhấn cửa và bàn, giữ bóng sát chân tường và bàn chân. Nhân vật được vẽ sau pass chiếu sáng và được kiểm RGBA. PNG mask riêng ghi vùng pass, gồm cả phần về sau có thể bị layer cha che. [Night mask](../benchmarks/results/e61r/packages/roadside-night/night-light.png)

Các cặp Roof/Metal và Stone/Roof ban ngày có 0 cạnh tiếp xúc trực tiếp trong cả hai bản. Xà gỗ ngăn mái và tường, còn khung cửa sổ tách kính khỏi chân đá. Day ramp mái hướng xanh lạnh, đá hướng xám lục và kính sáng hơn để đọc trên khung. Ban đêm, Wood/Roof có median luma 50 → 85 và p10 0 → 10 ở cả hai bố cục nhờ mặt gỗ ấm và mái lạnh. Stone/Metal cũ có 29 mẫu cạnh ở Front Court và 38 ở Roadside. B1 tách hai vùng tại chân cột và bệ cửa. Các cặp ít chênh midtone vẫn có mặt trong trường `materialWarnings`. Night p10 viền Courier ở Roadside tăng 16 → 20, còn Front Court giảm 24 → 12 sau khi đổi nền phía sau nhân vật. Điểm này cần đối chiếu ở 1× khi duyệt. [Tách vật liệu và cảnh đêm](../benchmarks/results/e61r/plates/front-court-night/comparison.json)

| Mật độ viền trên 100 mẫu | Front Court B0 → B1 | Roadside B0 → B1 |
| --- | ---: | ---: |
| Mái | 47.9 → 24.6 | 47.5 → 24.6 |
| Cỏ | 16.3 → 13.0 | 20.4 → 17.2 |
| Đất | 7.1 → 6.7 | 11.7 → 10.9 |
| Đá | 23.6 → 18.9 | 20.8 → 17.7 |

B1 ngắt hàng ngói bằng cụm ngắn, giảm cạnh lặp ở độ lệch 16 px từ 89.5% → 62.8% và 88.0% → 59.6%. Các polygon nghỉ là pass riêng của E6 trong nội vùng cỏ/đất, dùng màu có sẵn trong vai trò và giữ vùng chuyển tiếp E3. Các cạnh mảnh còn lại trên đất và chân đá có tỷ lệ khớp ở độ lệch 16 px cao hơn B0. Thước này tính cả mạch ngang dài, nên bảng tách mật độ và độ lặp. [Texture Front Court](../benchmarks/results/e61r/plates/front-court-day/comparison.json) · [Texture Roadside](../benchmarks/results/e61r/plates/roadside-day/comparison.json)

## Kiểm chứng kỹ thuật

- Lint, typecheck, build, **69/69 Engine tests** và CLI smoke đạt. Các kiểm thử mới từ chối khóa nguồn sai, cửa thấp và collider chắn sweep, đồng thời kiểm thứ tự và số pixel bị che giữa ngày và đêm.
- E6.1 tái tạo đủ 8 gói, 104 SHA-256. Lịch sử E2–E5 khớp 805 checksum và tái tạo 361 artifact, cùng các kiểm tra R&D/E5.3 và bằng chứng Unity E5.4 có sẵn.
- Bốn gói B1 và các plate/playback tái tạo khớp 102 SHA-256. CLI đã xuất Roadside Night rồi verify lại đủ 14 file khớp từng byte. PNG dùng alpha nhị phân, RGB trong suốt bằng 0, bảng màu hợp lệ và ảnh 4× nearest-neighbor chính xác. Cảnh và atlas được đối chiếu hai lần render.
- Studio `bb5c384` import, lưu, mở lại và export đúng RGBA cho 7 PNG, gồm bốn cảnh, hai atlas và một mask đêm trong suốt. Mã nguồn Studio và lockfile Engine không đổi. [Studio parity](../benchmarks/results/e61r/studio-parity.json)
- Chrome DevTools kiểm bốn cặp gallery tại 320 × 208 và 1280 × 832, các mode ảnh, playback hai nhân vật, phiếu 12 tiêu chí và bố cục 390 px. Surveyor đi 32 px và Courier đi 24 px theo root frame-stepped E5.4 đến pivot (148,146). Collision route kiểm cả bề rộng thân. Playback dừng trên sân trước cửa. Hai pose qua ngưỡng kiểm riêng; smoke chạy trong báo cáo offline. [Playback Surveyor](../benchmarks/results/e61r/playback/surveyor.json) · [Playback Courier](../benchmarks/results/e61r/playback/courier.json)
- Bản tinh chỉnh dùng Pixel Core và asset nguồn nội bộ. Dependency và license đầu vào giữ nguyên. [Danh mục SHA-256](../benchmarks/results/e61r/SHA256SUMS) · [Danh mục 102 payload](../benchmarks/results/e61r/benchmark.json)

```powershell
npm run benchmark:e61
npm run benchmark:e61r -- --out benchmarks/results/run/e61r-repro
npm run benchmark:e61r -- --publish
$env:LUMASPRITE_ENVIRONMENT_EDITION='e61r'
npm run test:environment-studio
Remove-Item Env:LUMASPRITE_ENVIRONMENT_EDITION
npm run report:e61r
```

`--publish` đối chiếu file đã có và từ chối ghi đè nếu byte khác. Benchmark 1×/4×, atlas, mask, nhân vật, 12 tiêu chí và xuất điểm JSON đều nằm trong [báo cáo chung](LumaSprite-Engine-E6.1R-Report.html). Người duyệt chấm từng B0/B1 sau khi xem đủ bốn cảnh, mục tiêu từ 4/5 cho tỷ lệ, lối vào, occlusion, sáng tối và độ rõ nhân vật. Kết quả kỹ thuật và điểm mỹ thuật được ghi riêng.

## Bản nháp PR

**Title** · Refine Field Outpost architecture, depth, and night lighting for E6.1R

**Body** · Add the E6.1R B1 EnvironmentSpec, shared architecture kit, and a native-scale B0/B1 review pack. Verify a 26 × 58 px entrance with both locked actors, show grounded occlusion behind the Roadside return, and add a local night-light pass. The four B1 packages, 102 payload checksums, Studio RGBA round-trip and two browser walk clips support owner review. The E6.1 control and 104 original payloads reproduce from checkpoint `537f604`. Review at 1× before scoring B1. Branch `codex/e6-1r-environment-quality`.

## Đề xuất E6.2

Sau khi Project Owner duyệt B1, chọn một cấu trúc bố cục cho luồng vào cửa và lối vòng bên nhà. Dùng lại kit trong một cảnh với tiền cảnh, trung cảnh và hậu cảnh rõ. Kiểm độ đọc camera, sự che khuất chân và vai ở từng điểm dừng. Phạm vi xuất dự kiến là PNG đã bake, footprint và metadata định vị. Quyết định mở E6.2 thuộc Project Owner.
