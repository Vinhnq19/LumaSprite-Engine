# E7.5R Fair Character Benchmark

[Gallery portable](E7.5R-PORTABLE-ART-REVIEW.html) · [E7.5 artistic closeout](e75-artistic-closeout.md) · [Khóa brief](../../benchmarks/fixtures/e75r/pilot-lock.json) · [Human Review](../../benchmarks/results/e75r/human-review.json)

## Đọc đúng đối chứng

| So sánh | Điều có thể suy ra |
| --- | --- |
| A0 → E7.5 A1/A2 và A0-Matched | V3 lịch sử thiếu attachments và áo mưa dài. A0-Matched dùng cap hay cloak, tool profile, palette roles và gate kỹ thuật của E7.5R. Mức khác biệt này có cả tác động năng lực. |
| A0-Matched → E7.5R | Mỗi brief chạy một dáng mang dụng cụ cố định, cùng seed, proportions, camera, backdrop, thiết kế trang phục, tool primitives, bảng màu và gate với bản tinh chỉnh. Không chọn lại control theo ảnh, không chỉnh RGB. Đổi pose và trục dụng cụ, cùng một quy tắc giới hạn bounding box. |
| E7.5 selected → E7.5R | So thay đổi hình học, pose và nhận diện trong toàn sprite, không tách được ảnh hưởng riêng. Có before/after, diff và khóa SHA của các pixel giữ nguyên. |

Matched xuất hợp lệ cho Ridge và Marsh. Đây là đối chứng với hai pose đã khai báo, không phải thử nghiệm tự động xếp hạng hoặc nhiều brief độc lập. Chưa có dữ liệu người duyệt để kết luận Quality-Guided đẹp hơn tổng thể.

## Kết quả ở 1×

- **Ridge.** Mũ làm việc, găng và túi gắn thân xuất hiện từ matched. Bản refine quay cờ lê lên và giữ hộp thấp, tăng pixel cờ lê thấy được từ 43 lên 51 (E7.5 A2 là 38). Khe chân tăng từ sáu lên chín hàng so với matched, chân trụ giữ mask. Ngoài cảnh 1× tay nâng đọc rõ, nhưng hộp còn giống cặp và bề mặt găng chỉ đọc như mảng ấm. Night P10 giữ 26, số mẫu biên yếu tăng 3→5.
- **Marsh.** Quy tắc gấu cape tách hai thùy, bảng màu áo nâu giữ nguyên nhận diện. Móc refine lớn và hướng lên, tăng từ 48 lên 65 pixel khả kiến so matched. Cả hai có P10 Night 18 và 29 mẫu biên yếu. Ở cạnh đầu móc, người xem vẫn có thể đọc là gậy cong và động tác đứng tĩnh chưa truyền đạt hành động thu hoạch.
- **Canal Porter.** Brief và seed khóa trước, dùng mũ vành rộng với tỷ lệ riêng, điểm bám của hai tay trên cùng pole và crate lệch trái. Hai palm che đúng cán, với 12/13 pixel giao nhau. Nhận diện mang hàng rõ hơn silhouette hooded worker. Tay xa lẫn vào cán ở 1×, dáng giữ tải khá ngang. Kết quả cho thấy quy tắc attachment chuyển sang silhouette khác trên rig v3. Thăng bằng lực, hoạt ảnh hai tay và khả năng tổng quát hóa sang rig độc lập vẫn chưa được xác minh. Bối cảnh thử là đường Tidegate đã khóa.

`TECHNICAL_GRIP_VALID` kiểm landmark, trật tự che và diện tích. `ARTISTIC_GRIP_READABLE_PENDING_HUMAN_REVIEW` là quyết định riêng, gồm hình thức tay ôm cán. Hai holdout palm dùng cùng lớp pole, khác với hai tool rời. Từng bàn chân, đầu gối, cổ tay, elbow và centerX có số liệu trong QA. Body balance là phép đo hình chiếu của rig và sole, chưa phải mô phỏng tải. Không dùng P10 để xếp hạng.

Mask RGBA và alpha khớp trước/sau material. Diff structural ghi pixel thêm, bỏ, đổi RGB và hash RGBA của phần còn lại. Đây là một lần thay hình cho mỗi brief. Sau khi khóa hình, mọi pixel đều protected và không chọn local color patch. `NO_MEANINGFUL_VISUAL_GAIN` đối với patch RGB vì giới hạn còn ở tay/cán và silhouette.

## Animation compatibility và đề xuất

`DESIGN_ONLY_AWAITING_OWNER`. E5 walk-hold kế thừa một điểm lantern v2, walk-free dùng v3. Để áp dụng dáng mới cần giữ joint/part owner, thiết bị, timing và pivot theo từng frame. Canal cần một rigid shaft khớp hai grip, kiểm độ dài reach, root slip, foot contact, phản hồi tải, occlusion hai tay và loop qua mọi key pose. Tạm thời chỉ bàn giao static. Kết quả hiện tại chưa đủ để mở E7.5RR. Sau duyệt, giữ candidate/baseline phù hợp và cân nhắc thiết kế E7.6 Environment với một holdout về scale và occlusion. [E5 Walk](../../src/generators/character/walk.ts) · [Manifest E7.5R](../../benchmarks/results/e75r/SHA256SUMS)
