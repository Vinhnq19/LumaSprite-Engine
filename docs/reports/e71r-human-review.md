# E7.1R Human Review Pack

**Bonded Fracture · `HUMAN_ART_REVIEW_PENDING`**. Dùng lại gallery E7.1R với ba bố cục, ngày và đêm, geometry phẳng, silhouette, material mask, contour và collision. Bộ bổ sung có 16 biến thể cảnh ở 1× và nearest 4×, cùng 16 occlusion overlay từ thứ tự vẽ thực tế. [Gallery E7.1R](E7.1R-Ruin-Structure.html) · [Danh mục PNG và SHA-256](../../benchmarks/results/e72a/ruin-review/index.json)

Trong occlusion overlay, mint là pixel nhân vật đang thấy, amber là pixel kiến trúc nằm trên một lớp khác và cảnh nền được giảm sáng để dễ đọc. Overlay xác nhận lớp đang thấy tại camera của benchmark. Collision overlay trong cùng danh mục cho biết footprint và lối đi.

| Layout | Vùng cải thiện ở 1× | Vùng cần duyệt kỹ |
| --- | --- | --- |
| R1 | Đoạn trên hai vách có một đường gãy lớn liên tục và bớt nhịp bậc của Q. | West wall tại x85–100, y90–99 còn depth 7 px từ 12. East wall tại x220–235, y84–97 còn 8 px từ 14. Hai đầu thấp có thể trông mỏng trong cùng cảnh. [Occlusion ngày](../../benchmarks/results/e72a/ruin-review/r1/day/bonded/occlusion.png) |
| H1 đã quan sát | Upper wall có khuyết lớn, để nền và tín hiệu tách nhau rõ hơn. | Đầu upper wall tại x147–166, y71–83 còn depth 9 px từ 16. Fallen wall tại x26–44, y129–138 còn 6 px từ 10. Cần kiểm phần chân còn đủ khối ở chế độ đêm. [Occlusion đêm](../../benchmarks/results/e72a/ruin-review/h1/night/bonded/occlusion.png) |
| H2 holdout | Lookout return bên trái có đường gãy và mặt đá lộ rõ hơn control. | Đầu return tại x77–94, y62–76 còn depth 7 px từ 12. Parapet thấp bên phải tại x244–259, y119–123 còn 10 px từ 17, nhưng đường gãy ở 1× chỉ thay đổi nhẹ. Đây là kết quả cục bộ trên một layout. [Occlusion ngày](../../benchmarks/results/e72a/ruin-review/h2/day/bonded/occlusion.png) |

Tọa độ dùng canvas cảnh 320×208. Depth là độ lùi chiếu của mặt sau tại đỉnh bị gãy. Collision, footprint và các pixel nhân vật hiển thị khớp production trong các cặp đã kiểm. Giữ đánh giá mỹ thuật riêng cho từng layout và điều kiện sáng. [Geometry và kỹ thuật](e71r-structure-and-qa.md)

## Phiếu Studio Workbench

Mở đúng PNG 1× ở slot A/B theo danh mục rồi nạp Review JSON trong Workbench. JSON khóa SHA-256 của cặp ảnh và để điểm ở trạng thái chờ.

| Cặp so với Production | Ngày | Đêm |
| --- | --- | --- |
| R1 Q | [JSON](../../benchmarks/results/e71r/review/r1-q.workbench.json) | [JSON](../../benchmarks/results/e72a/review/r1-night-q.workbench.json) |
| R1 Bonded | [JSON](../../benchmarks/results/e72a/review/r1-day-bonded.workbench.json) | [JSON](../../benchmarks/results/e72a/review/r1-night-bonded.workbench.json) |
| H1 Q | [JSON](../../benchmarks/results/e71r/review/h1-q.workbench.json) | [JSON](../../benchmarks/results/e72a/review/h1-night-q.workbench.json) |
| H1 Bonded | [JSON](../../benchmarks/results/e72a/review/h1-day-bonded.workbench.json) | [JSON](../../benchmarks/results/e72a/review/h1-night-bonded.workbench.json) |
| H2 Bonded | [JSON](../../benchmarks/results/e71r/review/h2-bonded.workbench.json) | [JSON](../../benchmarks/results/e72a/review/h2-night-bonded.workbench.json) |

[Danh mục cặp Workbench](../../benchmarks/results/e72a/review/index.json) · [Report Index](INDEX.md)
