# Handoff

**E5.3 is E5_3_READY_FOR_HUMAN_QUALITY_REVIEW.** W2 remains production. W2-Hybrid keeps the W2 torso, timing, planted targets and grip, and moves the passing knee by one pixel in two frames. Forest Courier has a verified `walk-free` package using the shared gait pipeline. Localized leather changes the satchel and strap with the original boots and silhouette. Independent art decisions remain open. [Offline gallery and score sheets](docs/LumaSprite-Engine-E5.3-Report.html) · [Quality gate and decisions](docs/e53-quality-review.md)

Browser runtime passed five fixed-camera laps and idle transitions in both scenes. Surveyor advanced 160 px and Courier 120 px with 0 px sampled foot sliding. Unity runtime verification remains open. Engine passed 66 tests, and Studio `bb5c384` passed E5.1 and E5.2 integration. [Runtime harness](docs/LumaSprite-Engine-E5.3-Runtime.html) · [Runtime proof](docs/e53-runtime-proof.json)

**Open-source art R&D is OPEN_SOURCE_ART_QUALITY_RND_READY_FOR_HUMAN_REVIEW.** The offline report has synchronized W2 and W2-IK playback, native 1× comparisons, three score sheets, downloadable QA, and source notices. [Offline report](research/open-source/art-quality/LumaSprite-Engine-Art-Quality-RnD.html) · [Provenance and reproduction](research/open-source/art-quality/README.md)

- W2-IK is `FURTHER_EVALUATION_REQUIRED`. The worst sampled knee-angle change decreased from 41.021° to 35.538°. All eight adjacent planted samples retained zero world displacement and 880 ms total duration. Review the lighter landing and test another character before evaluating a solver version.
- Surveyor-3Q is `REJECTED_FOR_INTEGRATION`. The angle reveals head and coat faces. The far arm reads less clearly at 1× and projecting the joints into CharacterSpec v2 violates the segment-length constraint.
- OKLab/OKLCH diagnostics and the Courier ochre-leather candidate are `FURTHER_EVALUATION_REQUIRED`. Replacing RGB nearest-ink is `REJECTED_FOR_INTEGRATION` in the shared four-color test. The diagnostic and candidate outputs have separate JSON.
- The R&D branch starts at `ba81037`. Engine regression passed all 65 tests, CLI smoke and 805 historical checksums. The paired experiments reproduced 54 PNG/JSON hashes. Studio was clean at `bb5c384`. Target-game execution is `GAME_RUNTIME_NOT_TESTED`.

**R0 is R0_CLEANUP_READY_FOR_RND.** Local generated duplicates were removed by checksum, and the milestone archive remains pinned. Use the documentation index for current workflows and historical galleries. [R0 audit](docs/r0-project-audit.md) · [Regression](docs/r0-regression.md) · [Documentation index](docs/README.md) · [R&D preparation](research/open-source/README.md)

The Project Owner approved E5.2 engineering and selected W2 Expressive Walk as the R&D baseline, with W1 Conservative Walk as the control. Walk Game-Ready Final Acceptance and target-game runtime validation remain pending. [Motion and package contract](docs/architecture/e52-walk-motion.md)

Surveyor R2 uses one gait pipeline for six-frame W1 and eight-frame W2. Planted foot anchors are fixed in sampled world space including both wraps. Studio preserves exact frame cells and their variable delays. [Offline gallery](docs/LumaSprite-Engine-E5.2-Report.html) · [Walk review](benchmarks/results/e52/review.md) · [QA](docs/e52-test-report.md) · [PR draft](docs/e52-pr.md)

The Project Owner approved E5.0 architecture and E5.1 as a subtle idle with limitations. The four 64 × 64 frame slots and 1,800 ms loop stay frozen. Target-game runtime is still pending. [Idle acceptance](docs/e51-idle-acceptance.md) · [E5.1 gallery](docs/LumaSprite-Engine-E5.1-Report.html)

**E4 is closed with artistic limitations.** The Project Owner approved E4 engineering and selected Field Surveyor R2 + M2P and the E4.4 revised Forest Courier as the single-view 64 × 64 baseline. The views favor the right-facing side and Courier still has limited coat-to-leather contrast in dark scenes. [Final acceptance](docs/e4-final-acceptance.md) · [E4.4 gallery](docs/LumaSprite-Engine-E4.4-Report.html) · [Owner decision](benchmarks/results/e44/review.md)

The Project Owner approved E4.3 engineering and the Forest Courier technical pilot and selected Surveyor M2P as the material baseline. The E4.3 packages remain frozen comparison assets. [E4.3 gallery](docs/LumaSprite-Engine-E4.3-Report.html) · [E4.3 QA](docs/e43-test-report.md)

The owner selected E4.2 M2 Art-Directed Materials with limitations as the E4.3 material baseline. M1 stays a control. [E4.2 material gallery](docs/LumaSprite-Engine-E4.2-Report.html) · [E4.3 art audit](docs/art-quality/e43-game-art-audit.md)

E4.1R B1 Grounded Surveyor was approved with notes as the geometry source for this material pass. B2 remains a motion reference. The E4.1R benchmark is frozen. [B1 Shape Lock](benchmarks/results/e42/b1-shape-lock.json) · [E4.1R gallery](docs/LumaSprite-Engine-E4.1R-Report.html)

E4.1 engineering is approved. The independent art assessment requested revision and chose Taller Surveyor as the starting point. A and B remain locked controls from `a1fcd76`. [Original gallery](docs/LumaSprite-Engine-E4.1-Report.html) · [Baseline SHA-256](docs/e41-baseline-sha256.txt)

**E3 is closed.** The Project Owner approved engineering and selected E3.4 Candidate B with limitations for Authored/Project and baked raster backgrounds. Candidate A remains an optional preset. TerrainSpec v3 stays the CLI default. [Final acceptance](docs/e3-final-acceptance.md) · [Review sheet](benchmarks/results/e34/review.md)

All ten E3.4 bake packages preserve RGBA through Studio save/reopen and backup/restore. Editable Studio maps use the static atlas. Editable world detail is deferred to E8. [E3.4 QA](docs/e34-test-report.md) · [PR draft](docs/e34-pr.md)

**E3.3 engineering and static-background production bake are APPROVED. E3.3 final art was NOT APPROVED.** The Project Owner authorized the bounded E3.4 refinement. The E3.3 PNGs and report stay available for comparison. [E3.3 report](docs/LumaSprite-Engine-E3.3-Report.html)

TerrainSpec v3 is the current CLI default. Run `npm run build`, then `npm run terrain -- --bake --spec benchmarks/results/e33/terrain-spec.json --map benchmarks/results/e33/map-input.json`. Verify with `npm run terrain -- --verify benchmarks/results/run/e33-terrain`. Studio editable maps still sample the canonical atlas. [Studio compatibility](docs/integration/studio-terrain-production.md) · [QA](docs/e33-test-report.md) · [Draft PR and push command](docs/e33-pr.md)

**E2 engineering and the six E2.4 props are approved for authored palette at 32×32.** The four-ink Studio palette stays **PALETTE_LIMITED**. [Owner review record](docs/art-quality/e2-owner-review.md)

**E3.1 engineering is APPROVED and its art is NEEDS_REFINEMENT.** The Project Owner approved E3.2 after reviewing the original HTML and maps. Checkpoint `ad7cdbc` retains the reference PNG, mapping, QA and report. [E3.1 report](docs/LumaSprite-Engine-Report.html)

**E3.2 engineering is APPROVED.** ChatGPT recommended approval for art with Authored/Project palettes, with Standard as the default. The historical single-file report compares A/B/C/D, three densities and palette modes. [E3.2 report](docs/LumaSprite-Engine-E3.2-Report.html) · [Review sheet](benchmarks/results/e32/review.md)

Rebuild the E3.2 gallery with `npm run benchmark:e32` and the standalone HTML with `npm run report:e32`. Run `npm run build` then `npm run terrain -- --spec benchmarks/results/e32/terrain-spec.json --map benchmarks/results/e32/map-input.json` to export the atlas and scene B with world detail. Studio reads the static atlas preview through the existing backup workflow. [Studio compatibility and preview](docs/integration/studio-terrain-variation.md)

E4 character geometry is authorized. DeepSeek runtime work stays deferred until after E8 and explicit owner approval for E9. [Terrain and material audit](docs/art-quality/e32-audit.md) · [QA](docs/e32-test-report.md) · [Draft PR](docs/e32-pr.md)
