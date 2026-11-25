# Handoff

**E3.3 is E3_READY_FOR_FINAL_ART_REVIEW.** The PNG bake preserves world detail through Studio, and the editable tilemap matches the static atlas. All four fixtures passed save/reopen and backup/restore. The Project Owner's final art decision remains pending. [Single-file report](docs/LumaSprite-Engine-E3.3-Report.html) · [Review sheet](benchmarks/results/e33/review.md)

TerrainSpec v3 is the current CLI default. Run `npm run build`, then `npm run terrain -- --bake --spec benchmarks/results/e33/terrain-spec.json --map benchmarks/results/e33/map-input.json`. Verify with `npm run terrain -- --verify benchmarks/results/run/e33-terrain`. Studio editable maps still sample the canonical atlas. [Studio compatibility](docs/integration/studio-terrain-production.md) · [QA](docs/e33-test-report.md) · [Draft PR and push command](docs/e33-pr.md)

**E2 engineering and the six E2.4 props are approved for authored palette at 32×32.** The four-ink Studio palette stays **PALETTE_LIMITED**. [Owner review record](docs/art-quality/e2-owner-review.md)

**E3.1 engineering is APPROVED and its art is NEEDS_REFINEMENT.** The Project Owner approved E3.2 after reviewing the original HTML and maps. Checkpoint `ad7cdbc` retains the reference PNG, mapping, QA and report. [E3.1 report](docs/LumaSprite-Engine-Report.html)

**E3.2 engineering is APPROVED.** ChatGPT recommended approval for art with Authored/Project palettes, with Standard as the default. The historical single-file report compares A/B/C/D, three densities and palette modes. [E3.2 report](docs/LumaSprite-Engine-E3.2-Report.html) · [Review sheet](benchmarks/results/e32/review.md)

Rebuild the E3.2 gallery with `npm run benchmark:e32` and the standalone HTML with `npm run report:e32`. Run `npm run build` then `npm run terrain -- --spec benchmarks/results/e32/terrain-spec.json --map benchmarks/results/e32/map-input.json` to export the atlas and scene B with world detail. Studio reads the static atlas preview through the existing backup workflow. [Studio compatibility and preview](docs/integration/studio-terrain-variation.md)

E4 remains gated on Project Owner review. DeepSeek runtime work stays deferred until after E8 and explicit owner approval for E9. [Terrain and material audit](docs/art-quality/e32-audit.md) · [QA](docs/e32-test-report.md) · [Draft PR](docs/e32-pr.md)
