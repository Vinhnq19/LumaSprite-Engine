# E9.1R · Tóm tắt kỹ thuật

**`E9_1R_READY_FOR_HUMAN_STATIC_ART_REVIEW`** · Ứng viên đề xuất là E9.1R dựa trên B3, với đường gấu theo giải phẫu và viền B3. Phiếu Owner ở `STATIC_ART_REVIEW_PENDING`. [HTML portable](E9.1R-CHARACTER-ART-REVIEW.html) · [Phiếu duyệt trống](../../benchmarks/results/e91r/human-review.json)

## Nguyên nhân và phép kiểm

Marsh 55271 có các knee `(30,45)/(41,44)`, ankle `(30,53)/(40,52)` và projected ground `58/57`, cùng hình học chân với Harbor. Mặt nạ cẳng chân và boot cho 7 hàng có khoảng giữa hợp lệ. Tunic dài phủ pixel giữa ở y=47–50. Viền cardinal phủ y=51 và các cạnh boot viền vào y=53, để lại y=52. Ảnh ghép bare body, có chân, có tunic, silhouette và vật liệu lần lượt cô lập nơi phát sinh. Đây là geometry của vạt áo và viền cuối. Bản gốc cho thấy hai boot và vị trí support hợp lệ.

Mẫu A-line mới suy chiều dài và độ xòe từ hông, đầu gối và cổ chân. Vạt kết thúc ở y=46. Mặt nạ ngoài tunic, thứ tự chồng lớp và pivot giữ nguyên, còn khoảng hở nhìn thấy tăng **1 → 5 hàng**. `costume-stance-v2` đo riêng khoảng hở anatomy, phần silhouette thấy được và chân nối qua knee/ankle đến đế tiếp đất. Ngưỡng 2 hàng không đổi. Fixture kiểm sáu loại gấu, trong đó short jacket, long coat và tunic thẳng chỉ có bằng chứng mặt nạ tổng hợp; cloak ngắn, apron và A-line có ảnh nhân vật. [Fixture](../../benchmarks/fixtures/e91r/study.json) · [Benchmark chi tiết](../../benchmarks/results/e91r/benchmark.json)

## So sánh ở 1×

| Checkpoint | Kết quả |
| --- | --- |
| A0 | v3/M2P thật, cùng thiết bị proxy trong nhóm đối chứng. Thiếu các module cloak, đèn cầm và khay theo brief v4. |
| B1 | Harbor dùng cùng thiết bị, torso 18→22 px. Holdout phân biệt vai/cổ qua hình khối cloak. |
| B2 | Overlap tay–cán của holdout tăng 13→15 và 15→21 trong nhóm đèn/dây. Mặt nạ ngoài tay giữ nguyên. Tiếp xúc đạt QA; dây vẫn có thể đọc như túi cứng. |
| B3 | Holdout đổi 431 pixel màu trên cùng silhouette và ownership. Ánh đèn và panel kính còn đọc được ở Day lẫn Night. Mảng mặt vẫn đơn giản ở 1×. |
| B4 | Cạnh yếu Day tăng 13→18 ở Cliffside. Night có cùng 19/276 cạnh yếu, nhưng Δluma p10 giảm 33→25. `NO_MEANINGFUL_ART_QUALITY_GAIN` cho treatment viền theo quan sát. |
| E9.1R | Hai Harbor khớp pixel B3. Marsh rút vạt A-line và tách hai boot. Cliffside 61947 đạt 5 hàng thoáng với cloak ngắn, grip liền và support đúng. |

Marsh là diagnostic. Cliffside là holdout mới, render lần đầu sau freeze `b8cf208b01b6e82f889604c4482faa354886d12404fd2bc16d3032d607e8e3b7`. Kết quả holdout giữ nguyên. Áo choàng ngắn có thể đọc như hai lớp áo và tunic Marsh có thể đọc gần áo khoác dài ở 1×. [Khóa ứng viên](../../benchmarks/fixtures/e91r/candidate-freeze.json)

## Regression và phạm vi

`VERIFIED_BY_TEST`. Lint, typecheck, build, smoke và **81/81** test. **805** checksum lịch sử, manifest E7.6R/E8/E8.3/E8.5/E9.0, **616** tệp E9.1 và SHA HTML E9.0/E9.1 khớp. **277** tệp E9.1R tái lập đúng byte bằng Node 26.13.1 trong 4,804 s thời gian thực, gồm render lại, encode và ghi đĩa. **36** cảnh Tidegate static giữ anchor, camera 320×208 / 32 PPU, collider và nền ngoài vùng actor. **12** PNG nhập/lưu/xuất Studio khớp RGBA. Phiên bản v4 tiếp tục dùng PNG cho Studio. [Technical QA](../../benchmarks/results/e91r/technical-qa.json) · [SHA-256](../../benchmarks/results/e91r/SHA256SUMS) · [Chrome offline](../../benchmarks/results/e91r/portable-verification.json)

`NOT_RUN`. Unity runtime và animation nhiều hướng. `GAME_READY_ART_NOT_APPROVED`. Owner quyết định trên Rubric v2 Static Addendum. E8.5 Owner Runtime vẫn chờ duyệt, E9.2 chưa được ủy quyền và DeepSeek được hoãn. [Rubric v2 Static Addendum](../art-quality/art-quality-rubric-v2-static-addendum.md)
