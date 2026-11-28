# Engine Handoff · v1 Release Readiness

## Internal RC closeout · 28/11/2026 ICT

`ENGINE_V1_RC_ACCEPTED_INTERNAL_WITH_EXCEPTIONS` · `ENGINE_V1_CORE_FROZEN`. Quyết định theo chỉ đạo trực tiếp của Owner cho sử dụng nội bộ, QA, chuẩn bị nghiên cứu AI và tích hợp Studio/Unity. Physical keyboard và visible-window HUD giữ `NOT_RUN`. Public Distribution và Game-Ready Art giữ `NOT_APPROVED`. RC gốc khớp SHA-256 cùng 1.119 payload. [Biên bản ghi nhận, Release Notes và PR draft](docs/v1-internal-release.md)

`ASF_RESEARCH_CLOSED` · `AI0_READY_FOR_OWNER_RESEARCH_DECISION` · `AI_TRAINING_NOT_STARTED`. Forge pin `25203d0` giữ hai skill offline đã kiểm drift và MIT notices. Pixel Looks `REJECT_FOR_ENGINE_INTEGRATION`, Hibit `KEEP_AS_AGENT_SKILL_ONLY`. AI Lab riêng có shortlist model, ledger trống và protocol bốn arm trên native 64×64. [Bàn giao v1 → AI](../LumaSprite-Coordination/LUMASPRITE-V1-TO-AI-TRANSITION.md) · [AI Lab](../LumaSprite-AI-Lab/README.md)

## Lịch sử · Owner preparation và Agent Sprite Forge · 28/11/2026 ICT

`ENGINE_V1_OWNER_ACCEPTANCE_PENDING` · `ASF_RESEARCH_READY_FOR_HUMAN_QUALITY_REVIEW` · `AI_TRAINING_NOT_STARTED`. RC khớp SHA-256 đã khóa và qua smoke test lại ngoài repo. Commit sửa CI `923662e` nối tiếp checkpoint báo cáo, PR #6 đã merge phía GitHub và CI main đạt. Bàn phím, HUD hiển thị và phạm vi phân phối chờ Owner. [Checklist Owner](../LumaSprite-Coordination/ENGINE-V1-OWNER-CHECK.md)

Forge `25203d03900b46b444bdd72a75768c33d1895ad6` cài hai skill offline ở Codex. Drift đạt, 65 kiểm thử Forge và 7/7 sprite nghiên cứu qua Engine v1. Pixel Looks `REJECT` cho tích hợp hiện tại. Hibit `KEEP_AS_AGENT_SKILL_ONLY`. [Báo cáo nghiên cứu](../LumaSprite-Coordination/ASF-LUMASPRITE-COMPATIBILITY-REPORT.html) · [Manifest cài đặt](../LumaSprite-Tools/agent-sprite-forge-install.json)

## Checkpoint RC đã khóa

**`ENGINE_V1_READY_FOR_OWNER_ACCEPTANCE`** · 2026-11-28 ICT · nhánh cục bộ `codex/e10-v1-release-readiness`. [Báo cáo HTML tự chứa](docs/reports/LUMASPRITE-ENGINE-V1-RELEASE-READINESS.html)

`ENGINE_V1_SCOPE_FROZEN` và `ENGINE_V1_TECHNICALLY_READY` đã đạt. Checkpoint gốc `c60d03736d0597fc44673223a08873756229dce8`. Commit build `c919d4aee3c55df6f1e61519f6fa83826ad8f453`. [Phạm vi](docs/v1-scope.md) · [CLI và API](docs/engine-cli-api.md)

Đã xác minh nhập PNG, mask và nguồn, ghép layer, sửa trong mask, tạo revision, rollback và xuất. Studio tại `471ac90555d3545beff5182146e291ba97b9ae20` được dùng ở chế độ chỉ đọc. Unity E8.5 nhập sprite từ Studio với RGBA, pivot và PPU chính xác. Unity Windows Player đạt 6/6 cảnh và 2 biến thể RGBA, tương tác và save/reload. Kiểm bàn phím vật lý và capture HUD mới trên cửa sổ hiển thị vẫn chờ.

87/87 test Engine, 107/107 test Studio, 805 SHA lịch sử và 3.386 dòng manifest benchmark. Giữ nguyên 38 báo cáo cũ, gồm 13 tệp được pin. npm audit có 0 advisory. ZIP nội bộ `.cache/e10-v1/release/LumaSprite-Engine-v1-Windows-RC.zip` đã smoke test ngoài repo. SHA-256 `b0cac7eb889d8f0fd92128a7b9f9275612b52f13d1a7540ad873becf825dc299`.

`ENGINE_V1_OWNER_ACCEPTED` chờ Owner. Duyệt mỹ thuật E10.1, quyền phân phối và chuyển sang AI Training là các quyết định đang chờ. [Giới hạn](docs/known-limitations.md) · [Draft AI contract](docs/ai-integration-contract.md)

## Checkpoint trước đó · E10.0 Closeout và E10.1 Art Reference Foundation

**`E10_1_READY_FOR_OWNER_ART_REFERENCE_REVIEW`** · nhánh `codex/e10-art-directed-foundation`. [Đề xuất kiến trúc](docs/reports/E10-ART-DIRECTED-PRODUCTION-FOUNDATION.md) · [HTML duyệt reference](docs/reports/E10.1-ART-REFERENCE-REVIEW.html) · [Report Index](docs/reports/INDEX.md)

E9.H1 đã kết thúc ở `E9_H1_NO_MEANINGFUL_ART_QUALITY_GAIN`. Đề xuất `OPTION_B_ARTIST_DIRECTED_COMPONENT_PIPELINE` dưới authority `ASSISTANT_REVIEW_RECOMMENDATION`. Renderer, masks, socket, revision và composition phục vụ source art do artist thiết kế và duyệt. Character v4 giữ vai trò đối chứng. [E9.H1 Closeout](docs/reports/E9-H1-CLOSEOUT-ART-QUALITY-DECISION.html)

E10.1 đang chờ Owner chọn **Ceramic Kiln Warden**, **Canopy Kite Rigger** hoặc **Seed Archive Registrar** và duyệt art direction. Bộ duyệt có 11 nghiên cứu gốc cho 9 nhóm. Chín ảnh E9.H1R chỉ dùng chẩn đoán. Art approval và quyền production của nghiên cứu gốc còn chờ xác nhận. [Reference manifest](benchmarks/results/e101/reference-pack.json) · [Phiếu Owner trống](benchmarks/results/e101/human-review.json)

Proof trên một component tay DRAFT đạt `TECHNICAL_VALID`. Nhập PNG + mask, khớp grip/wrist, sửa 24 pixel trong allowed mask, lưu r2 có SHA của r1, rollback và xuất. Có 0 pixel đổi ngoài mask và 4 Studio round-trip giữ đúng RGBA. [Proof](benchmarks/results/e101/workflow-proof.json) · [QA](benchmarks/results/e101/technical-qa.json)

Lint, typecheck, build, smoke và 86/86 Engine tests đạt, gồm một test intake mới. Xác minh 805 SHA lịch sử, các manifest E9.H1/H1R/Closeout và 24 artifact E10.1 tái lập. Cả 38 báo cáo E7–E8 khớp checkpoint, 13 tệp được pin trực tiếp bằng manifest/SHA. [Audit 38 tệp](benchmarks/results/e101/legacy-report-audit.csv) · [Chrome offline](benchmarks/results/e101/portable-verification.json)

`E8_5_OWNER_REVIEW_PENDING` · `GAME_READY_ART_NOT_APPROVED` · `E10_2_NOT_AUTHORIZED` · `E9_2_NOT_AUTHORIZED` · `DEEPSEEK_DEFERRED`.

Tái lập bằng `node scripts/verify-e101.ts`. Tái xuất HTML bằng `python scripts/report-e101-portable.py --evidence-commit 6197737372f6da4c580ec7b08b7272b455069623`.
