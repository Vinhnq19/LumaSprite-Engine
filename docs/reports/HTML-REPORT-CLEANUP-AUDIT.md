# E9 · HTML Report Cleanup Audit

**`NO_SAFE_DELETIONS`**. Dry-run đã phân loại từng tệp. Giữ đúng byte các HTML lịch sử và dùng E9.1S-R làm gallery duy nhất cho closeout. [Inventory CSV](E9-HTML-REPORT-INVENTORY.csv) · [Current Report Index](INDEX.md) · [Historical Report Index](ARCHIVE.md)

## Phạm vi và dry-run

Quét `docs/reports/` và các thư mục con, `docs/art-quality/`, `benchmarks/results/`, Engine HANDOFF và Coordination. Bổ sung HTML legacy tại `docs/`, `research/` và ba HTML preview local để đối chiếu. Tra file tham chiếu từ Engine và Studio source ở chế độ đọc. Bảng ghi path, size, SHA-256, milestone, Git, tham chiếu, manifest, historical, bản trùng và khả năng tái tạo. `referenced_from` ghi đích resolve được theo path, còn `script_basename_guard` giữ thận trọng với tên file dùng trong code. [Script dry-run](../../scripts/inventory-html-reports.py)

`python scripts/inventory-html-reports.py .cache/report-inventory-fresh.csv` chạy với Python 3.12 trở lên. Chọn đường dẫn output mới cho mỗi lần kiểm kê. SHA-256 của CSV bàn giao `6db80aa4d0e3232407fc277c84bf3d4dcbb918d70bc1f06d30fb9eaf005270ee`.

| Phân loại | Toàn bộ tệp | HTML |
| --- | ---: | ---: |
| KEEP | 5.682 | 0 |
| ARCHIVE_CANDIDATE | 0 | 0 |
| REMOVE_CANDIDATE | 0 | 0 |
| PROTECTED | 7.227 | 79 |
| NEEDS_REVIEW | 3 | 3 |

### Hành động

- **Đã giữ.** Toàn bộ 82 HTML trong CSV. Trong đó 79 HTML gồm báo cáo lịch sử/đã khóa, HTML Workbench acceptance và 36 HTML trong snapshot replay E5.3/E5.4. 47 path HTML có ít nhất một tệp trùng byte trong tập kiểm kê. Bảng chỉ ra bản canonical tracked nếu có. Các cây replay tái tạo từ Git phục vụ chuỗi kiểm lịch sử, bao gồm tài liệu đi cùng snapshot và manifest tương ứng. [Cây replay E5.4](../../scripts/verify-e54.ts) · [Quy trình E5.3](../../scripts/verify-e53.ts)
- **Đã archive trong đợt này.** 0 tệp. Giữ đường dẫn của các archive hiện có. Historical Report Index điều hướng tới report và quyết định cũ. [Historical Report Index](ARCHIVE.md)
- **Đã xóa.** 0 tệp, 0 byte. `NO_SAFE_DELETIONS`.
- **Chưa thể xóa.** Ba preview dưới đây thiếu bản tracked trùng byte. Chúng vẫn ở vị trí cũ.

| File `NEEDS_REVIEW` | Byte | Kết quả kiểm |
| --- | ---: | --- |
| `.cache/e75-preview.html` | 1.629.899 | Chưa có bản canonical trùng SHA. |
| `.cache/e75r-preview.html` | 2.897.287 | Chưa có bản canonical trùng SHA. |
| `.cache/portable-art-review/E7.1R-PORTABLE-ART-REVIEW.html` | 3.235.520 | Chưa có bản canonical trùng SHA. |

| Tập đã đóng băng tại dry-run | Trước | Sau | Byte trước | Byte sau |
| --- | ---: | ---: | ---: | ---: |
| HTML | 82 | 82 | 96.884.342 | 96.884.342 |
| Toàn bộ tập kiểm kê | 12.912 | 12.912 | 275.134.153 | 275.134.153 |

Đã đọc lại 12.912 path và rehash ngay sau quyết định giữ. Bảng đo tác động của cleanup lên tập gốc. CSV máy đọc và các tài liệu quyết định mới là deliverable riêng. Điều hướng thay đổi qua Index và HANDOFF, giữ nguyên path các báo cáo cũ.

## Audit HTML portable E9.1S-R

| Phép kiểm | Kết quả |
| --- | --- |
| Kích thước | 937.714 bytes |
| Inline PNG duy nhất | 101 |
| Vị trí ảnh tái sử dụng theo SHA | 19 |
| Inline PNG sai SHA | 0 |
| Gallery sau khi mở | 120/120 khớp manifest E9.1S hoặc E9.1S-R |
| Chrome 158 offline, file ngoài repo | Native 1×, CSS nearest 4× và phiếu Owner trống đạt, 0 dependency, 0 lỗi console |
| SHA-256 | `700d48e08cffba3abef2e9690697d74bc94355171ed5c108ffaedf5d9e85d15f` |

[HTML đã kiểm](E9.1S-R-FINAL-CHARACTER-REVIEW.html) · [PNG manifest E9.1S-R](../../benchmarks/results/e91sr/SHA256SUMS) · [Chrome verification trước closeout](../../benchmarks/results/e91sr/portable-verification.json)

Report HTML phát sinh sau này chỉ nhúng PNG native theo SHA một lần, phóng nearest-neighbor bằng CSS và dùng lại payload cho ảnh trùng. Chỉ nhúng 4× riêng nếu đó là evidence khác. Machine logs và inventory đặt ngoài HTML đánh giá. Dùng ảnh local và mở ngoài repo khi kiểm.

## QA nội bộ

85/85 test Engine, lint, typecheck, build và smoke đạt. Đối chiếu 805 checksum lịch sử, E9.0, E9.1 (616), E9.1R (277), E9.1S (189) và E9.1S-R (79). Checkpoint HTML/PNG và phiếu Owner vẫn khớp. Link nội bộ của Index, Archive, ba báo cáo closeout và handoff đã validate. [Technical QA E9.1S-R](../../benchmarks/results/e91sr/technical-qa.json)
