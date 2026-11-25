# Handoff

**E2 engineering and the six E2.4 props are approved for authored palette at 32×32.** Recorded 2026-11-25 from the Project Owner's adoption of the ChatGPT visual review. The Studio four-ink locked palette stays **PALETTE_LIMITED**. [Owner review record](docs/art-quality/e2-owner-review.md)

**E3.1 engineering passes and terrain artwork is PENDING_HUMAN_REVIEW.** Open the self-contained report to see the approved props, the atlas and three terrain scenes before reviewing the seam and palette evidence. [Unified report](docs/LumaSprite-Engine-Report.html) · [Terrain score sheet](benchmarks/results/e3/review.md)

The E3 branch starts at E2.4 checkpoint `54eb98d`. E0–E2 benchmark bytes were preserved. Run `npm run build` and `npm run terrain` for a standalone PNG/JSON atlas. `npm run benchmark:e3` rebuilds the full benchmark. `npm run report:e3` rebuilds the standalone report from the published results. [Test evidence](docs/e3-test-report.md)

Use the existing Studio **Mở sao lưu** workflow to inspect the registered transition map. The integration test can write the preview ZIP and validates it against Studio's actual backup serializer and map renderer. [Studio tilemap contract and preview instructions](docs/integration/studio-tilemap-contract.md)

E3.2 starts with the owner's E3.1 review. Assess terrain repetition on larger maps, then test edge variation that leaves seam signatures unchanged and a shared project palette for E2 props and terrain. Native Studio atlas registration is a separate integration change. DeepSeek runtime work is deferred to E9, after the local Engine is mature and the owner authorizes it. [Roadmap](docs/roadmap.md)
