# E7.1R Report Cleanup

Inventory trước cleanup bao gồm báo cáo tại root, docs, history benchmark, output/log tái tạo, các snapshot HANDOFF trong phạm vi đã quét và báo cáo Coordination. Các path benchmark và acceptance đã khóa được giữ tại chỗ. [Inventory TSV](INVENTORY.tsv)

## File đã archive

| Bản sao tạo khi replay | Bản gốc Git giữ nguyên | Byte |
| --- | --- | --- |
| `benchmarks/results/run/e53-checks/rnd-checkpoint/docs/art-quality/e33-audit.md` | `docs/art-quality/e33-audit.md` | 4.081 |
| `benchmarks/results/run/e53-checks/rnd-checkpoint/docs/e3-test-report.md` | `docs/e3-test-report.md` | 2.057 |

Đã di chuyển đúng hai bản sao sau khi kiểm tên ở source, test, report và manifest, đối chiếu SHA-256 với bản tracked tại `3315425` và xác minh Git ignore. Có thể phục hồi từng file từ bản gốc hoặc từ `benchmarks/results/run/e71r-report-archive/`. Mỗi file cần được phục hồi vào đúng path tại bảng trên.

| Phạm vi trong cùng tập kiểm kê | Files | Byte |
| --- | ---: | ---: |
| Active trước archive | 8.374 | 202.766.768 |
| Active sau archive | 8.372 | 202.760.630 |
| Archive cục bộ | 2 | 6.138 |
| Xóa | 0 | 0 |

Số đếm after trừ hai path đã archive khỏi tập before. Archive giữ nguyên tổng dung lượng của tập before. Tài liệu và PNG E7.1R phát sinh được lưu trong manifest riêng. Các mục có quan hệ chưa xác minh, log duy nhất và các bản sao ngoài hai path trên giữ trạng thái trong inventory. Tài liệu Coordination nằm ngoài Git Engine và được kiểm riêng.
