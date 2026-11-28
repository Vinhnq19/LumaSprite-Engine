# E9.1S · Nhận diện nhân vật và nguyên nhân kỹ thuật

**`E9_1S_TECHNICAL_BLOCKED`**. Ba mẫu đã biết qua các cổng kỹ thuật. Holdout Coastal Cartographer không đạt lề trên 1 px ở S1–S3. [Gallery HTML](E9.1S-SEMANTIC-CHARACTER-REVIEW.html) · [Phiếu Owner trống](../../benchmarks/results/e91s/human-review.json)

## Quyết định E9.1R

**ASSISTANT_REVIEW_RECOMMENDATION** · Chờ Project Owner xác nhận mỹ thuật.

| Phạm vi | Quyết định |
| --- | --- |
| E9.1R Engineering | `APPROVED` theo QA |
| Costume-Aware Stance | `APPROVED_FOR_RESEARCH` |
| B3 | `SELECTED_AS_RND_BASELINE` |
| B4 | `NOT_SELECTED` |
| Harbor Lockkeeper | `ART_REVISION_REQUIRED` |
| Marsh Apothecary | `ART_REVISION_REQUIRED` |
| Cliffside Lantern Keeper | `ART_REVISION_REQUIRED` |
| Game-Ready | `NOT APPROVED` |
| E9.2 | `NOT AUTHORIZED` |

Checkpoint E9.1R `cb2eb3f046f0f6694100327a1baa29bc67ab7278`, nguồn trong HTML `c33707192550c19a96c4cff58d50597554138810`. HANDOFF hiện hành trên đĩa đã trỏ tới E9.1R khi bắt đầu kiểm. Bản E9.1 mà ChatGPT nhận là checkpoint cũ. S0 của ba mẫu đối chiếu khớp byte từng PNG B3 đã công bố. [Báo cáo E9.1R](E9.1R-CHARACTER-ART-REVIEW.html)

## Audit hình ảnh và quy tắc sửa

- **S1 · Hình khối và trang phục.** V4 dùng chung công thức đầu, cổ và torso phụ thuộc landmarks legacy. Marsh và Cliffside có cùng đầu rộng 12 px và torso 14 px ở S0. S1 thay vai, eo, hộp sọ, hàm, độ nghiêng cổ và đường rơi trang phục từ bốn profile tỷ lệ. Harbor đổi torso 22→24 px, Marsh đổi đầu 12→11 px, Cliffside đổi torso 14→16 px với gấu cape đổ về sau. Mặt nạ tay, đạo cụ, đầu gối, bốt và pivot giữ nguyên. Bỏ mũ/đồ cầm vẫn thấy rõ tương phản giữa Harbor và Marsh. Cape Cliffside đọc rõ hơn ở dáng nghiêng, đôi lúc vẫn dính vào khối tay áo.
- **S2 · Mặt.** B3 trải mảng light/shadow lớn trên đầu. S2 gom chân mày, gò má, mũi và hàm thành cụm nhỏ, giữ alpha và part ownership chính xác của S1. Đổi màu 64 pixel Harbor, 49 Marsh, 47 Cliffside và 44 Cartographer. Ở 1×, mắt dễ tìm hơn. Nét mày vẫn có thể hơi đậm và kiểu nhìn còn đồng nhất giữa các mẫu.
- **S3 · Đạo cụ.** Harbor có vòng van, thanh chéo, hub và thân truyền lực đi qua palm. Marsh có hai lọ khác chiều cao và màu với thanh kẹp khay. Cliffside dùng quai liên tục từ vai tới tay xa, giữ đúng mặt nạ và pixel thấy được của đèn. Forearm và bàn tay giữ hình học S2. Grip Cliffside tay xa vẫn liền, overlap giảm 15→11 pixel khi dây thu hẹp. Cạnh Night yếu của Cliffside 19/276→14/278, p10 Δluma 33→38. Marsh tăng số cạnh yếu Night từ 20/368 lên 23/384, p10 giữ 38. Ở 1×, vòng van Harbor vẫn dễ đọc như đầu tay quay chung. Khay Marsh rõ lọ hơn, nghề vẫn cần bối cảnh. Quai Cliffside có thể đọc như dây đeo hơn là dây chức năng cụ thể.

Các metric là phép kiểm của thí nghiệm. Các quan sát ở native 1× cần Owner đối chiếu S0–S3. Phạm vi nghiên cứu chỉ có một hướng nhìn, một bộ style và ba mẫu đã biết. [Benchmark](../../benchmarks/results/e91s/benchmark.json) · [Rubric v2 Static Addendum](../art-quality/art-quality-rubric-v2-static-addendum.md)

## Coastal Cartographer · seed 73763

Hai lần preflight từ chối fixture vì cổ tay–palm xa dưới 2 px và vị trí mũ sau dịch vượt vùng raw đặt được. Hai cấu hình cùng khóa cũ được lưu nguyên byte. Hiệu chỉnh chỉ đổi wrist xa (44,34)→(43,34) và cao độ hông từ Y 36→37 trước lần sinh đủ bộ PNG. Seed, hướng nhìn, palm socket, palette, rubric và mã S1–S3 giữ nguyên. [Fixture và lịch sử preflight](../../benchmarks/fixtures/e91s/study.json) · [Khóa trước lần chạy đủ ảnh](../../benchmarks/fixtures/e91s/candidate-freeze.json)

Lần chạy đầy đủ cho thấy cap raw ở y=1 sau khi shift, viền ngoài ở **y=0**, dưới lề tối thiểu y=1. S0 ở y=2 và đạt cổng. S1–S3 cùng lỗi padding. Tất cả PNG và lỗi được lưu, không điều chỉnh sau khi xem ảnh. Kiểm độc lập trên cùng raster xác nhận 7 hàng khoảng âm, mặt đế y=57, pivot (32,58), liên kết forearm–tay và palm nằm trong bản đồ/compass. Các kiểm này không thay kết quả padding. Trong cảnh, bản đồ sáng thấy được ở 1× nhưng vẫn dễ nhìn thành cuộn giấy, compass gần giống kính lúp. `CAPABILITY_GAP` còn ở chức năng đo/đọc bản đồ runtime. [Chẩn đoán và RGBA](../../benchmarks/results/e91s/technical-qa.json)

## Regression và bước kế tiếp

`VERIFIED_BY_TEST`. Lint, typecheck, build, smoke và **81/81 test**. **805** checksum lịch sử, manifest E7.6R/E8/E8.3/E8.5/E9.0, **616** tệp E9.1 và **277** tệp E9.1R khớp. **189** tệp E9.1S tái lập đúng byte trong 3,151 s, gồm cả lỗi holdout. **32** cảnh Tidegate static 320×208, 32 PPU giữ pivot, collider và nền ngoài actor. **12** PNG làm vòng nhập, lưu và xuất qua Studio khớp từng RGBA. `STUDIO_V4_CONTRACT_GAP` vẫn áp dụng với spec thực nghiệm. [SHA-256](../../benchmarks/results/e91s/SHA256SUMS) · [Kiểm Chrome offline](../../benchmarks/results/e91s/portable-verification.json)

Đề xuất dừng mở rộng framework và giữ E9.2 ở `NOT AUTHORIZED`. Vòng được ủy quyền tiếp theo chỉ cần kiểm fit giữa headwear và outline trên một brief mới, sau đó Owner quyết định S0–S3 tại 1×. `STATIC_ART_REVIEW_PENDING`, `GAME_READY_ART_NOT_APPROVED`, E8.5 Owner Runtime Acceptance pending. Unity runtime và animation nhiều hướng `NOT_RUN`.
