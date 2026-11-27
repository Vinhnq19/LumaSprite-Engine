# E8.4 Studio Native Scene Adapter proposal

E8.3 chỉ chuẩn bị hợp đồng, fixture và test đối chiếu Engine. Studio main được xác nhận qua `git ls-remote` là `593650101ed0cd2a54d045197911fc5b7a8bdd83` ngày 2026-11-27 ICT, working checkout read-only `c56837e344dbb42369dc92ebd379e28255db7d84`. Không đánh dấu scene import đạt từ kết quả RGBA của PNG. [E8 Readiness](e8-runtime-acceptance.md)

## V1 intake và persistence

- Nhận Scene JSON, atlas, tilemap JSON, foreground và SHA-256 với relative paths nội bộ package. Bắt buộc xác thực version, source revision, kích thước, tile bounds/IDs, nguồn và hash trước khi tạo tài liệu.
- Studio Native Terrain hiện dùng atlas chuẩn 8×6, ID dương và chunk 32×32. E8 dùng atlas per-scene 16 cột, ID zero-based và grid hàng. Giữ ID Engine trong sidecar có version, tối thiểu cho phép preview đọc native w×h. Chỉ đưa vào Native Terrain nếu có mapping lossless đã kiểm.
- Giữ collision polygon, RLE walkable và collision mask, spawn, landmarks, stand, PPU và layer ordering nguyên trạng ở lớp dữ liệu. Baked foreground giữ dạng composite; chỉ cho phép edit từng layer nếu package có sprite layers có provenance, không tách sprite bằng cách suy ngược từ PNG.
- Save là transaction cho package mới gồm bản gốc và normalized metadata. Reopen kiểm revision/hash và replay từ các byte đã lưu. Export scene giữ oracle terrain RGBA, foreground RGBA, collision/anchors và source. Approval độc lập, mặc định UNREVIEWED, cần Owner action rõ ràng để thay đổi.
- Cổng lỗi cần từ chối ID sai, path traversal, hash sai, layer/anchor thiếu và scene không thể tái tạo. Giữ draft lúc export thất bại. Không cho phép ghi đè E7.6R source bytes.

## Acceptance tests đề xuất

1. Import fixture Day Mistfen B2 và đối chiếu 260 IDs, 320×208, PPU 32, berth và collision/walkability.
2. So ảnh composite ở native; kiểm tọa độ layer khi reopen và khi xuất một copy.
3. Đóng/reopen rồi xuất. Bảo toàn provenance, metadata, geometry và trạng thái UNREVIEWED. Xác nhận một package khác revision không lấy nhầm approval.
4. Tamper SHA, ghi path ra ngoài package, thêm tile ID lạ và đổi trạng thái duyệt mà không có Owner action. Ứng dụng phải từ chối trước khi lưu.
5. Chạy trên Studio main trong task riêng nếu Owner mở E8.4. Stage này không sửa Studio source.

Lệnh fixture `node scripts/verify-e84-sidecar.ts` xác minh SHA, atlas/grid, collision/walkability, anchors, RGBA replay, JSON round-trip và ba negative cases bên Engine. [Fixture đề xuất](../../benchmarks/fixtures/e84/mistfen-scene-sidecar-proposal.json) · [Acceptance fixture test](../../scripts/verify-e84-sidecar.ts)
