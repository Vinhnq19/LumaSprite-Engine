# E9.1R · Kiểm kê và dọn báo cáo

Dry-run bao phủ report/art-quality, tất cả benchmark results, output tạm Engine, HANDOFF, Coordination và nhóm report/log `.studio-logs` tại Studio. TSV toàn bộ path, dung lượng, SHA-256, milestone, Git, tham chiếu, protected và trùng byte nằm tại `.cache/e91r-audit/inventory-before.tsv`. Mã kiểm kê chỉ đọc nguồn, ghi TSV riêng. [Script dry-run](../../../../scripts/inventory-e91r.py) · [SHA của inventory và số liệu](inventory-summary.json)

| Phạm vi cố định tại dry-run | Trước dọn | Sau dọn | Dung lượng trước | Dung lượng sau |
| --- | ---: | ---: | ---: | ---: |
| Tệp trong inventory | 35.110 | 35.053 | 1.107.480.541 B | 1.105.192.985 B |
| Báo cáo, log và tài liệu trong inventory | 8.588 | 8.587 | 170.866.631 B | 168.824.110 B |

Các số sau dọn trừ đúng những tệp đã loại bỏ khỏi cùng tập kiểm kê. Báo cáo E9.1R mới và việc biên tập index/handoff được tính riêng. HTML mới 495.452 B, so với 5.447.046 B của E9.1, giảm khoảng 91% cho lần bàn giao mới. E9.1 vẫn ở đường dẫn gốc và khớp hash.

- **KEEP.** 23.912 mục được phân loại giữ ở dry-run. Báo cáo khóa, PNG/JSON, QA manifests, baseline, Owner reviews và đường dẫn được tham chiếu đều giữ tại chỗ. Index lịch sử liệt kê từng báo cáo chuẩn. [Historical Report Index](../../../../docs/reports/ARCHIVE.md)
- **ARCHIVE.** 4 mục đã ở archive cũ giữ nguyên vị trí. HANDOFF Engine trước E9.1R có trong Git tại `a37870e:HANDOFF.md`. Coordination CHATGPT-HANDOFF phiên bản trước E9.1R được lưu trong thư mục archive ngày 2026-11-28.
- **SAFE_TO_REMOVE.** Xóa đúng 57 mục trùng byte, tổng 2.287.556 B. Có 1 TSV tạm E7.1R và 56 ảnh preview tạm. Mỗi dòng dưới đây có path gốc, path bản tracked giữ lại và SHA-256. Để phục hồi một bản sao, copy bản giữ lại đến đúng path cũ và kiểm lại SHA-256. [Danh sách đã loại bỏ](removed-duplicates.tsv)
- **NEEDS_REVIEW.** Giữ 11.127 mục chưa đủ chứng cứ dọn và 10 bản sao được giữ thêm vì nằm trong cây preview/replay đang sử dụng. Điều kiện giữ gồm file độc nhất, chưa thấy bản tracked tương đương, tham chiếu và output của script. [Danh sách nhóm giữ thêm](inventory-summary.json)

Sau dọn, kiểm lại từng hash bản giữ lại, 805 checksum lịch sử, manifest E7.6R/E8/E8.3/E8.5/E9.0/E9.1, SHA hai HTML E9 và các liên kết trong hai index. [QA](../technical-qa.json)
