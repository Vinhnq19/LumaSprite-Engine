# LumaSprite Reporting Standard v1

- Mỗi milestone có một báo cáo chính và một evidence manifest. HANDOFF hiện hành chỉ đến báo cáo mới. Report Index hiện có tiếp tục dẫn tới các mốc lịch sử đã khóa.
- Báo cáo chính dùng HTML tự chứa với PNG gốc nhúng Base64, hoặc ZIP đầy đủ có HTML và asset. So baseline và candidate cạnh nhau ở native 1×, mở 4× theo nearest-neighbor. Ghi camera, palette và scene context, kèm flat, silhouette và material mask khi các lớp này cần để duyệt.
- Kiểm SHA-256 trước khi đóng gói và so lại dữ liệu nhúng với nguồn. Mở bản sao ngoài repository ở chế độ offline. Liệt kê tệp được gửi để reviewer mở độc lập.
- Ghi branch, full commit SHA, trạng thái working tree, lệnh thực chạy, PASS/FAIL/NOT RUN, source thay đổi, hồi quy, manifest và hạn chế. Giữ log dài trong output chạy thử. Nếu HTML chứa SHA của source, commit source trước rồi đóng gói HTML trong commit sau để tránh phụ thuộc vòng.
- Trong phần duyệt hình, mô tả cải thiện ở 1×, chỗ còn yếu và vùng candidate kém baseline. Tách development khỏi holdout, nêu rủi ro production và trạng thái human review. Điểm của Owner giữ trống cho tới khi Owner duyệt.
- Tóm tắt gửi ChatGPT gồm thay đổi, bằng chứng PNG, kết quả 1×, hạn chế, QA, quyết định chờ Owner, bước tiếp theo và file cần gửi. Dùng cùng HANDOFF hiện hành và các status Coordination.
