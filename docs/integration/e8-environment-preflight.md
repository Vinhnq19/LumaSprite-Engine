# E8 Preflight · Environment runtime readiness

Design only. Engine export là evidence. Runtime environment import, physics, navigation và tương tác chưa được chạy cho E7.6R. Kết quả Unity 6000.3.21f1 của E5.4 xác minh nội dung animation cũ. Tài liệu Unity 6.3 dùng làm tham chiếu lập checklist, phiên bản Editor, package và pipeline của game đích sẽ được khóa khi có phạm vi E8. [E5.4 runtime evidence](../../benchmarks/results/e54/unity/runtime.json) · [Unity Sprite Import Settings](https://docs.unity.com/en-us/engine/6000.3/manual/materials-and-shaders/textures/textures-reference/texture-type-sprite) · [Unity URP Pixel Perfect](https://docs.unity.com/en-us/engine/6000.3/manual/unity2d/2d-urp/2d-pixelperfect/prep-sprites)

| Hợp đồng | Trạng thái | Evidence và việc cần xác nhận ở runtime |
| --- | --- | --- |
| Atlas import | PARTIAL | Engine dựng atlas 16×16, 16 cột, atlas IDs và SHA RGBA. Game cần đọc ô đúng tọa độ origin trên trái, kiểm pixel exact, Point, mipmaps off và cấu hình nén không đổi pixel. |
| Tilemap JSON | SUPPORTED | Engine đọc lại lưới ID theo hàng, ghép foreground đúng từng pixel. Import game NOT_TESTED. |
| PPU, camera và pivot | PARTIAL | Scene JSON khóa PPU 32, khung 320×208, 3/4, nearest và contact pivots. Chuyển engine pixel sang world unit nhất quán và xác minh 1×/4× ở camera. |
| Foreground sorting | PARTIAL | Static E6 xếp theo contact y và ID. Game phải dùng sprite/layer runtime thay thế phần foreground đã bake khi actor bắt đầu di chuyển. Kiểm trước/sau cọc, nhà, strut và tie. |
| Collision geometry | PARTIAL | Polygon solid và mask nước/cầu có sẵn, giải mã được. Vật lý engine game, hình học nhiều cao độ, va chạm động NOT_TESTED. |
| Walkability và actor footprint | SUPPORTED | Engine BFS trên dữ liệu xuất với Surveyor 19×5; runtime di chuyển theo bước hoặc continuous sweep phải chạy thử và đối chiếu mép nước. |
| Scene spawn và interaction anchors | PARTIAL | Spawn, berth, pivots và điểm đứng tay quay được xuất. Tương tác cửa van, di chuyển tàu và hành vi cập bến MISSING. |
| Save/reload | PARTIAL | PNG qua Studio và Engine tái tạo byte ổn định. Game cần save/reload positions, IDs và layer state, rồi xác minh revision. |
| Asset provenance và revision | SUPPORTED | Fixture, seed, palette, source SHA, holdout freeze và manifest kiểm được. Import runtime cần ràng buộc build với cùng manifest. |
| Native Studio scene import | MISSING | Studio tích hợp scene preview từ dữ liệu nội bộ. E7.6R export hiện chưa có adapter. No runtime evidence. |

## Studio snapshot và Studio main

Snapshot `c56837e344dbb42369dc92ebd379e28255db7d84`. Đã truy vấn remote `refs/heads/main` và đối chiếu blob local của `593650101ed0cd2a54d045197911fc5b7a8bdd83` vào 2026-11-27 ICT. Các file `studio/pixel/read-png.ts`, `src/node/studio/pixel-store.ts`, `src/studio/tilemaps.ts` và `src/studio/scene-preview.ts` giống byte ở hai revision. Studio yêu cầu atlas chuẩn 8×6 gồm 47 mask và một ô dự phòng, ID dương, lưới lưu chunk 32×32 và collision enum trên tile. Engine export atlas per-scene 16 cột, ID bắt đầu từ 0, grid hàng và mask collision theo pixel. Scene Preview của Studio nhận nền và mảng sprite có contact pivot theo thứ tự có sẵn. Cần mapping có schema/validation giữa hai hợp đồng. `RAW_PNG_ONLY` là RGBA parity qua save/reopen/export. [Studio tilemaps](https://github.com/Vinhnq19/LumaSprite-Studio/blob/593650101ed0cd2a54d045197911fc5b7a8bdd83/src/studio/tilemaps.ts) · [Studio scene preview](https://github.com/Vinhnq19/LumaSprite-Studio/blob/593650101ed0cd2a54d045197911fc5b7a8bdd83/src/studio/scene-preview.ts)

## Runtime acceptance checklist

- [ ] Khóa Editor, package, render pipeline, PPU và scene revision thực tế.
- [ ] Import atlas và tilemap Day/Night. So tọa độ góc, hai bên seam, hình 1×/4× với Engine. Hash terrain và foreground khi có thể.
- [ ] Đặt actor theo spawn và pivot từ JSON. Kiểm thứ tự occlusion khi đi ngang cọc, sát nhà và cạnh gầm cầu.
- [ ] Dùng footprint 19×5 và collider thật. Từ spawn đi đến berth hoặc control stand, thử đi xuống nước, đứng trên mép và kiểm negative blocked path.
- [ ] Kết nối interaction anchor với hành vi đã được phê duyệt, thêm playtest nếu sau này cần cơ chế cửa van hoặc phà.
- [ ] Save/reload, chuyển Day/Night, kiểm format version, provenance, asset SHA và giữ tọa độ anchor. Ghi 1× captures và Play Mode results.
- [ ] Giữ phê duyệt mỹ thuật và runtime acceptance riêng. `BOAT_ASSET_CAPABILITY_GAP` và gameplay đa cao độ cần brief bổ sung.
