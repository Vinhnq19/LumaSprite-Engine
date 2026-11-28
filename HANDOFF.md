# Engine Handoff · E9.H1R Art-Directed Quality Recovery

**`E9_H1R_TECHNICAL_BLOCKED`** · nhánh `codex/e9-h1r-art-directed-quality` · checkpoint E9.H1 `5fef43d97ddfc09404754c5f027ca93f7037017d`. [HTML portable](docs/reports/E9-H1R-ART-DIRECTED-QUALITY-REVIEW.html) · [Report Index](docs/reports/INDEX.md) · [Engine Status](../LumaSprite-Coordination/ENGINE-STATUS.md)

Saltmarsh (69041) là mẫu chẩn đoán. Hộp đồ nghề che 36 trong 48 pixel ống chân xa, boot che 12. Nâng thân hộp 4 px và rút quai dưới giúp lộ 15 pixel trên 4 hàng liên tiếp, giữ mask chân, socket và pivot. Cổng visibility chạy trên thứ tự lớp trước khi render final. [Layout spec](benchmarks/fixtures/e9h1r/visibility.json) · [Benchmark](benchmarks/results/e9h1r/benchmark.json)

Ba nhóm helmet/visor, suit/torso và glove/hook có revision 2 dạng DRAFT. Reference Pack có chín nguồn nội bộ đang `PENDING`. Masked Local Refinement dùng ba ý định chỉnh source trên bản sao revision 3, đổi 113/8/4 pixel, 0 ngoài mask và rollback khớp RGBA. Khi tiếp nhận một đề xuất ảnh, hồ sơ cần Edit Intent, revision gốc, PNG candidate, allowed-owner mask và kiểm invariants. Phiếu Human Review còn trống. [Reference Pack](benchmarks/fixtures/e9h1r/references.json) · [Workflow nghiên cứu](docs/reports/E9-H1R-WORKFLOW-RESEARCH.md) · [Phiếu duyệt](benchmarks/results/e9h1r/human-review.json)

Breakwater (60857) được khóa ở `28c58d6f604d8610665d788e5f8eb3f4a3f8cfb4`. Lần chạy đầu dừng với `COMPOSITION_FAILURE` / `KNEE_DIRECTION/near`. Gối lệch −2 px trên trục hông–cổ chân, dưới ngưỡng −1 px. Rig từ chối trước khi lắp Hybrid. Chưa có bằng chứng visual từ holdout. [Seal](benchmarks/fixtures/e9h1r/candidate-freeze.json) · [Lần chạy đầu](benchmarks/results/e9h1r/first-holdout-attempt.json)

Lint, typecheck, build, smoke và 85/85 tests đạt. 805 SHA lịch sử, 172 kết quả tái lập và 24 Studio PNG round-trip đúng RGBA. Chrome xác minh HTML ở 1×/4× từ bản sao ngoài repo. [QA](benchmarks/results/e9h1r/technical-qa.json) · [SHA-256](benchmarks/results/e9h1r/SHA256SUMS) · [Chrome](benchmarks/results/e9h1r/portable-verification.json)

Tái lập bằng `node scripts/benchmark-e9h1r.ts` (exit 1 do holdout đã khóa), sau đó `node scripts/verify-e9h1r.ts`. Tái xuất HTML bằng `python scripts/report-e9h1r-portable.py --evidence-commit daf62dac6380e25334208cddb190c5cfe17e0384`.

`ASSISTANT_REVIEW_RECOMMENDATION` · `ISOLATED_RESEARCH_ONLY` · `E8_5_OWNER_REVIEW_PENDING` · `GAME_READY_ART_NOT_APPROVED` · `E9_2_NOT_AUTHORIZED` · `DEEPSEEK_DEFERRED`. [Báo cáo E9.H1 đã khóa](docs/reports/E9-H1-HYBRID-CHARACTER-PILOT.html)
