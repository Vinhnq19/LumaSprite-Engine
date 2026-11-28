# E10 · Art-Directed Production Foundation

**E9.H1 đã kết thúc ở `E9_H1_NO_MEANINGFUL_ART_QUALITY_GAIN`.** E10.0 đề xuất `OPTION_B_ARTIST_DIRECTED_COMPONENT_PIPELINE` dưới authority `ASSISTANT_REVIEW_RECOMMENDATION`. Project Owner giữ quyền duyệt kiến trúc, reference và art direction. Checkpoint Engine `996b01032d346d69e808e80d2fd62d1f3efe1dd8`, Studio `471ac90555d3545beff5182146e291ba97b9ae20`. [E9.H1 Closeout](E9-H1-CLOSEOUT-ART-QUALITY-DECISION.html)

Giữ Pixel Core, renderer, layer và ownership masks, CharacterSpec, part-based composition, socket tay và đồ nghề, costume-aware stance, pose validators, palette constraints, revision và checksum, PNG import/export và Studio Art Review Workbench. Character v4 phục vụ baseline và kiểm định lịch sử. Dừng mở rộng các rule sinh hình của Character v4.

## Khả năng tái sử dụng

| Khả năng | Phân loại | Cách dùng cho source do artist tạo |
| --- | --- | --- |
| Đọc và ghi PNG | `REUSE_AS_IS` | Dùng decoder/encoder của Pixel Core. So RGBA sau khi đọc và xuất. [PNG Core](../../src/core/renderer/png.ts) |
| Layer masks, ownership và alpha | `REUSE_AS_IS` | Dùng raster mask và thứ tự layer có sẵn. Kiểm màu, alpha, bounds và vùng bảo vệ. [Pixel Core](../../src/core/pixels/raster.ts) · [Raster QA](../../src/quality/raster.ts) |
| Component anchors và socket | `MINOR_ADAPTER_REQUIRED` | Gắn tọa độ nguyên và role ở metadata của PNG. Khi lắp, đối chiếu anchor đã khai báo với pixel được sở hữu và socket đối diện. [Grip socket](../../src/experiments/character-equipment.ts) |
| Palette remapping | `REUSE_AS_IS` | Công cụ remap có sẵn cho bản sao thử nghiệm. Proof nhập đúng bảng màu và ghi thay đổi được phép bằng revision mới. [Palette Core](../../src/core/palette/colors.ts) |
| Revision bất biến | `MINOR_ADAPTER_REQUIRED` | Dùng recipe và SHA đang có. Với PNG artist, pin thêm PNG và mask theo từng revision và giữ SHA của revision cha. [Hybrid Component Contract](E9-HYBRID-FEASIBILITY-PROPOSAL.md#contract-draft--lumaspritecharacter-componentv0-draft) |
| Metadata và provenance | `MINOR_ADAPTER_REQUIRED` | Hồ sơ DRAFT lưu creator, source, license hoặc trạng thái chưa cấp license, authority, scope, sha và review state. Mỗi nguồn cần đối chiếu quyền riêng khi đi vào art pipeline. [Hybrid Component Contract](E9-HYBRID-FEASIBILITY-PROPOSAL.md) |
| Part-based composition và pose | `REUSE_AS_IS` | Giữ renderer, các constraint stance/grip và nhãn layer. Ghép component vào layer theo anchor đã duyệt. [Layer Renderer](../../src/core/renderer/layers.ts) · [Costume stance](../../src/experiments/costume-stance.ts) · [Pose QA](../../src/quality/character.ts) |
| Export preview và PNG | `REUSE_AS_IS` | Xuất PNG native, mask và JSON sidecar cho review. JSON giữ provenance và pivot ngoài PNG phẳng. [PNG Core](../../src/core/renderer/png.ts) |
| Studio review và chỉnh ảnh | `REUSE_AS_IS` | Art Review Workbench hiện có native 1×, 4×, blink, diff, pivot và review JSON. Dùng PNG import/export cho proof. [Studio Workbench](../../../LumaSprite-Studio/docs/ART-REVIEW-WORKBENCH.md) |
| Đăng ký component artist vào API job 64 × 64 | `MISSING_CAPABILITY` | Adapter hiện công bố prop 32 × 32. E10.1 dùng luồng tệp và metadata cục bộ. [Studio Adapter v1](../integration/studio-adapter.md) |
| Art Editor mới trong Engine và API model | `NOT_NEEDED` | Dùng Studio cho chỉnh sửa và review. E10.1 chỉ cần chứng cứ nhập, ghép, sửa giới hạn và xuất. |

Luồng đề xuất dùng PNG art đã khai báo nguồn, mask ownership riêng, anchor nguyên và palette pin theo revision. Proof giữ một component tay DRAFT và shaft làm ngữ cảnh. Mask và anchor có sẵn từ source tách layer. Intake kiểm PNG/hash, bounds, palette, alpha, mask và anchor trước khi ghép. Một local edit có vùng giới hạn, revision cha và kiểm rollback. Studio đọc, lưu tài liệu rồi xuất PNG để đối chiếu toàn bộ RGBA.

## Art Reference Pack v1

Bộ duyệt gồm 9 nhóm về silhouette, head/face, proportions, outfit, material clusters, pixel shading, equipment, grip và outline hierarchy. Mỗi mục có ảnh native, nguồn có thể tái lập, SHA-256, độ phân giải, style, mục đích, đặc điểm đề xuất giữ, giới hạn sao chép và trạng thái duyệt. Các nghiên cứu mới là `ENGINEER_CURATED`, tạo từ đầu trong workspace và giới hạn cho duyệt nội bộ. Quyền phát hành hoặc dùng production chờ Owner xác nhận. Chín ảnh E9.H1R tiếp tục ở vai trò chẩn đoán. [Reference Pack Review](E10.1-ART-REFERENCE-REVIEW.html)

Đối với từng reference, Owner chọn giữ, yêu cầu sửa hoặc loại, rồi chỉ rõ đặc điểm được dùng. Trường approved features và chữ ký để trống đến khi có quyết định. Các plate chỉ khóa một bài toán thị giác mỗi ảnh. Nếu một nguồn bên ngoài được đưa vào vòng sau, metadata cần ghi đúng tác phẩm, creator, phiên bản giấy phép, quyền sửa và quyền dùng trong game trước khi chọn.

## Ba brief pilot đề xuất

Cùng chuẩn kỹ thuật 64 × 64, three-quarter-right, pivot (32, 58), ánh sáng upper-left, RGBA alpha nhị phân, ownership theo layer và grip anchor nguyên. Chấm silhouette trước khi xem màu, sau đó chấm sprite ở 1× trên nền sáng, nền tối và cảnh mục tiêu 320 × 208. Palette của từng brief được duyệt và khóa trước khi tạo candidate.

| Brief | Art direction native 1× | Kế hoạch component và khả năng animation |
| --- | --- | --- |
| **Ceramic Kiln Warden** | Thân thấp, tấm chắn nhiệt hình thang lệch vai, nâu đất và lớp men hổ phách. Mày hạ một bên, mắt nhìn đầu kẹp. Kìm tách khỏi tạp dề bằng khoảng âm. | Head wrap và face, vai/tạp dề chịu nhiệt, găng, kìm với socket bàn tay. Vành chắn và kìm có layer riêng cho chuyển động sau này. |
| **Canopy Kite Rigger** | Dáng cao, mảng vải buồm gấp chéo qua vai, xanh ngọc pha mận. Một mảng sáng dài nhấn chiều vải. Mũi cao và mắt nhìn dây. Tay gần cầm ống cuộn. | Head/face, vạt sailcoat, spool, bàn tay và thân ống. Khóa dây và cổ tay để sau này kiểm swing và hướng lực. |
| **Seed Archive Registrar** | Áo choàng tán ngang một vai, gấu bậc, xanh rêu và vải kem. Mặt tròn với lông mày dày. Khay kiểm hạt màu hổ phách giữ một góc hở dưới tay. | Face, mantle/collar, thẻ và khay ba ngăn, tay đỡ và tay giữ thẻ. Hai vị trí lực đỡ nằm trên cùng khay để có thể khóa qua frame. |

E10.1 trình các brief và nghiên cứu theo nhóm để Owner chọn. E10.2 cần quyết định chọn một brief, duyệt reference tương ứng và phê duyệt phạm vi sản xuất của component.

## Quality gate

| Cổng | Điều kiện |
| --- | --- |
| `TECHNICAL_VALID` | PNG/RGBA đúng canvas và palette đã khóa. Bounds, alpha, ownership, pivot, anchors, grip và revision hợp lệ. Edit giữ pixel ngoài allowed mask. Source, checksum, rollback và Studio round-trip truy được. |
| `STATIC_ART_APPROVED` | Owner xem native 1× trên nền sáng/tối và cảnh 320 × 208. Silhouette, tỷ lệ, anatomy, grip, cluster, material, style và context readability đạt từng mục theo Rubric v2. Nghề đọc được và mỗi hạng mục bắt buộc đạt từ 4/5 với 0 Critical Defect. |
| `GAME_READY` | Có directional consistency, animation theo bộ hành vi mục tiêu, nhập game, runtime test và Owner Acceptance. Điểm QA pixel là chứng cứ kỹ thuật độc lập. |

[Mức điểm Rubric v2](../art-quality/art-quality-rubric-v2.json) · [Static Addendum](../art-quality/art-quality-rubric-v2-static-addendum.md)

## Kết quả proof và phạm vi bàn giao

**`E10_1_READY_FOR_OWNER_ART_REFERENCE_REVIEW`**. Reference Pack có 11 plate mới cho 9 nhóm và 9 ảnh chẩn đoán đã khóa. Studio tiếp nhận cả hai revision PNG của găng và hai preview ghép cán, kết quả RGBA khớp byte qua nhập, lưu và xuất. Bản sửa tăng sáng mặt cuff làm đổi 24 pixel trong mask và 0 ngoài mask. Rollback khôi phục đúng SHA RGBA của r1. [Reference Pack](../../benchmarks/results/e101/reference-pack.json) · [Proof và SHA](../../benchmarks/results/e101/workflow-proof.json)

86/86 test, lint, typecheck, build và smoke đạt. 805 SHA lịch sử và các manifest E9.H1, E9.H1R, E9.H1 Closeout được xác minh lại. Đối chiếu Chrome xác nhận gallery và phiếu trống hoạt động offline từ bản sao ngoài repository. [Technical QA](../../benchmarks/results/e101/technical-qa.json) · [Chrome](../../benchmarks/results/e101/portable-verification.json) · [Phiếu Owner](../../benchmarks/results/e101/human-review.json)

## Checkpoint và bảo vệ báo cáo

Working tree sạch khi mở nhánh. Ba mươi tám tệp E7–E8 từng được ghi là xóa chưa stage đều đã có mặt và khớp với Git ở checkpoint E10. Lịch sử ghi lại trạng thái trước đó và phiên bản đã commit, còn ý định thao tác bên ngoài commit chưa được xác nhận. Mỗi dòng audit ghi tham chiếu và dấu vết manifest đã tìm. [Bảng audit 38 tệp](../../benchmarks/results/e101/legacy-report-audit.csv)

`E8_5_OWNER_REVIEW_PENDING` · `GAME_READY_ART_NOT_APPROVED` · `E10_2_NOT_AUTHORIZED` · `E9_2_NOT_AUTHORIZED` · `DEEPSEEK_DEFERRED`.
