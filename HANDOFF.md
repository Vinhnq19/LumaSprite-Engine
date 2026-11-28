# Engine Handoff · E9.H1 Hybrid Art-Directed Character Pilot

**`E9_H1_TECHNICAL_BLOCKED`** · `COMPONENT_KIT_READY_FOR_HUMAN_REVIEW` · nhánh `codex/e9-h1-hybrid-character-pilot`. [Báo cáo portable](docs/reports/E9-H1-HYBRID-CHARACTER-PILOT.html) · [Report Index](docs/reports/INDEX.md) · [Engine Status](../LumaSprite-Coordination/ENGINE-STATUS.md)

Tidal Salvage Diver (48311) đã chạy A/B ở 64 × 64 và trong Tidegate Day/Night. Cặp cùng thiết bị giữ nguyên móc và pose, đổi 65 pixel trong vùng tay và viền. B đầy đủ thêm mũ lặn, suit và bình khí. Đây là bằng chứng về capability. Phiếu Human Review còn trống. [Phiếu duyệt](benchmarks/results/e9h1/human-review.json)

Saltmarsh Rescue Technician (69041) dừng ở kiểm tra visibility. Trong cả ba nhánh, hộp dụng cụ che 36 pixel ống chân xa và boot che 12. Pose, kit và rule được giữ nguyên. Phát lại nguồn đã khóa tái hiện lỗi và xác minh 15 PNG khớp byte với bản xuất chẩn đoán. [Freeze](benchmarks/fixtures/e9h1/candidate-freeze.json) · [Lỗi lúc chạy đầu](benchmarks/results/e9h1/first-holdout-attempt.txt) · [Bằng chứng](benchmarks/results/e9h1/frozen-replay-proof.json)

Lint, typecheck, build, smoke và 85/85 Engine tests đạt. 805 SHA lịch sử, 101 artifact tái lập, 24 Studio round-trip đúng RGBA. Ba sửa đổi trên bản sao đều giữ socket và rollback, 0 pixel đổi ngoài vùng owner. Chrome offline xác minh 88 payload PNG duy nhất, 117 vị trí ảnh và chế độ 1×/4×. [QA](benchmarks/results/e9h1/technical-qa.json) · [SHA-256](benchmarks/results/e9h1/SHA256SUMS) · [Chrome](benchmarks/results/e9h1/portable-verification.json)

Đã chuyển hai preview E7.5/E7.5R vào kho lưu trữ có bản sao xác minh SHA-256, giảm 4.527.186 byte trong thư mục hoạt động. Giữ E7.1R portable vì có 112 PNG nhúng cần cho review riêng. [Biên nhận](benchmarks/results/e9h1/report-hygiene.json)

`ASSISTANT_REVIEW_RECOMMENDATION` · Option B `RETAIN_SELECTED_COMPONENTS_ONLY` · B3/S0 `RESEARCH_BASELINE` · `APPROVED_FOR_PILOT_RECOMMENDATION` · `ISOLATED_RESEARCH_ONLY`. Phạm vi dừng ở nghiên cứu tĩnh. Variation C và Unity runtime chưa chạy. `E8_5_OWNER_REVIEW_PENDING` · `GAME_READY_ART_NOT_APPROVED` · `E9_2_NOT_AUTHORIZED` · `DEEPSEEK_DEFERRED`. [Decision record](docs/reports/E9-CHARACTER-ARCHITECTURE-DECISION.md) · [Feasibility](docs/reports/E9-HYBRID-FEASIBILITY-PROPOSAL.md)

Để tái lập bằng chứng, chạy `node scripts/benchmark-e9h1.ts` rồi `node scripts/verify-e9h1.ts`. Để tái xuất HTML, chạy `python scripts/report-e9h1-portable.py --evidence-commit 47d9ed77b204d26369c5c98fc703b70c48295444`.
