# Handoff

**E7.5 is `E7_5_READY_FOR_HUMAN_CHARACTER_REVIEW`.** Ridge Mechanic and the locked Marsh Harvester holdout have A0/A1/A2 shape gates, hand-tool overlap and clearance, visible soles, and stationary gameplay Day/Night. The existing A0 v3 supplies the body control. A1/A2 add equipment anchored to palms, and Marsh gains a cloak layer. Implementation `5998899d64fc8b2030b31354023af17e6bcef73b`. [Portable review](docs/reports/E7.5-PORTABLE-ART-REVIEW.html) · [Pipeline audit and next proposals](docs/reports/e75-character-pipeline-audit.md) · [Report Index](docs/reports/INDEX.md)

**Review.** Ridge A1 has nine rows of leg clearance, A2 lifts the wrench but shows 38 tool pixels against 45 in A1. Marsh keeps its russet palette, and the hook can read as a curved staff at 1×. No RGB patch improved the identified pose or tool shapes, and protected hashes match. Owner chooses A0/A1/A2 or Neither before any Walk Cycle. E7.6 remains a proposal. [Human Review JSON](benchmarks/results/e75/human-review.json)

**Verification.** Engine 73/73, 805 historical SHA-256, 361 rebuilt artifacts, E7.1–E7.4R replay, four negative controls and ten Studio RGBA round-trips. Chrome offline outside the repository verified all 144 PNGs, 72 exact 4× previews, 8 embedded metadata items and JSON export. Primary run 4.282 s CPU, 12 scenes, six ownership passes, zero AI calls. HTML SHA-256 `a8ed07c6873b8a6c0e89ca94f0dca6a8ee9384effe2b1cc756081f59635caed4`. [QA](benchmarks/results/e75/verification.json) · [SHA-256](benchmarks/results/e75/SHA256SUMS) · [Performance](benchmarks/results/e75/performance.json)

**Change inventory.** Three E7.5 modules under `src/experiments` implement the equipment geometry, character trial and context. New benchmark, Studio PNG parity and portable report scripts live in `scripts`. Locks and results live in `benchmarks/fixtures/e75` and `benchmarks/results/e75`. The E7.4R decision, E7.5 audit and portable HTML are indexed from Reports. `package.json` adds the three scripts and `.gitattributes` pins fixture/manifest line endings. Secret scan passed and dependency licenses are unchanged.

**E7.4R closeout.** The assistant recommendation approved engineering and selected Rain for art reference, accepted Beacon structure with limitations, rejected the Night patch on visual gain, and recorded partial Wind Vane holdout success. Owner acceptance remains pending. [Artistic closeout](docs/reports/e74r-artistic-closeout.md) · [Historical E7.4R gallery](docs/reports/E7.4R-PORTABLE-ART-REVIEW.html)

**E7.4 closeout.** Rain A1 and Beacon A2 were selected for refinement as an assistant review recommendation. Rain A2 and Beacon A1 are research only. Engineering passed and Owner acceptance is pending. [Decision record](docs/reports/e74-artistic-decision.md) · [Historical E7.4 gallery](docs/reports/E7.4-PORTABLE-ART-REVIEW.html)

**E7.3R final closeout.** Engineering APPROVED and artistic APPROVED_WITH_LIMITATIONS. Stormwatch A remains the readability control. Tidegate C is an art reference. Mistfen has mixed results and capability gaps for wetland water, ferry and wharf. C remains opt-in research. [Owner record](docs/reports/e73r-final-artistic-acceptance.md) · [Locked E7.3R gallery](docs/reports/E7.3R-PORTABLE-ART-REVIEW.html)

**E7.3 closeout.** Engineering APPROVED. ArtDirectionSpec v1 is approved for research. Stormwatch B is approved with limitations, Tidegate B has mixed results, Tidegate character A is preferred, and both prop B assets were selected for refinement. Production integration remains unauthorized. [Owner record](docs/reports/e73-artistic-acceptance.md) · [Historical gallery](docs/reports/E7.3-PORTABLE-ART-REVIEW.html)

**E7.2 final closeout.** Engineering APPROVED. M1 is approved as an art reference, S1 and Bonded Fracture are research only, S2 is approved with limitations, and H4 partially generalizes. Production geometry remains locked and S0 remains the production stone baseline. [Owner decision](docs/reports/e72-final-artistic-acceptance.md) · [Historical E7.2-R evidence](docs/reports/E7.2-R-PORTABLE-ART-REVIEW.html)

**E7.1R engineering is APPROVED and Bonded Fracture is RESEARCH_ONLY.** R1 shows local improvement, H1 is the fracture research reference and H2 did not establish useful generalization. S0/S1 use Production Geometry. [Human Review Pack](docs/reports/e71r-human-review.md)

**E7.1R structure evidence.** Bonded Fracture is an isolated architectural candidate. R1 and H1 compare against production and Q. The fresh H2 includes both retained control and candidate for day/night. H2's tall wall reads more clearly at 1×, and the low parapet changes little. [Report index](docs/reports/INDEX.md) · [Gallery](docs/reports/E7.1R-Ruin-Structure.html) · [Geometry audit and QA](docs/reports/e71r-structure-and-qa.md)

**E7.1 artistic closeout.** The Project Owner selected Relay A1 for a material study, marked R1 Q research-only and requested revision of H1 Q. Production uses the accepted baselines. E7.2 Final Acceptance and E7.3 await owner decisions. [Artistic Decision Record](docs/reports/e71-artistic-decision.md)

**E7.1 technical handoff.** Relay Box A0/A1 and Ruin Structure Q are available at native 1× and nearest 4× with masks and a downloadable review sheet. H1 is the frozen holdout for an independent art review. Engine passed 73 tests and reproduced all 79 E7.1 payloads. Studio preserved six pilot PNGs. E7.2 requires owner approval. [Offline gallery](docs/LumaSprite-Engine-E7.1-Report.html) · [QA and handoff](docs/e71-structure-quality.md) · [Quality Contract v1](docs/art-quality/quality-contract-v1.md)

**E6.4 engineering is APPROVED and art is APPROVED_WITH_LIMITATIONS.** Inventory Barrel is an approved UI baseline. Interaction Icon, Signal Activation and Pickup Sparkle are approved with limitations. The 82 E6.4 payloads reproduce exactly. Target-game UI/VFX runtime is `PRODUCTION_GAME_RUNTIME_NOT_TESTED`. [Acceptance](docs/e64-artistic-acceptance.md) · [Baseline lock](benchmarks/fixtures/e71/e64-baseline-lock.json) · [E8 Integration Backlog](docs/integration/e8-runtime-backlog.md)

**E6.3 engineering is APPROVED.** R1 and R2 were accepted with limitations at `6efc683`. R1 is the showcase and R2 the generalization benchmark. C2-Q needs further artistic refinement. [Acceptance and baseline](docs/e63-artistic-acceptance.md) · [E7 Art Quality Backlog](docs/art-quality/e7-backlog.md) · [Environment gallery](docs/LumaSprite-Engine-E6.3-Report.html)

**E6.2 engineering is APPROVED.** The owner selected C1 and C2 with artistic limitations. The verified checkpoint is `d68f151`. C2-Q is proposed as a separate night refinement. Its edge p10 improves from 11 to 16 for Surveyor and 15 to 25 for Courier. The rear probe is outside the walkable region. E5.4 forward slip remains 0 px with a deliberate 2 px screen-depth projection at the threshold. The Unity result covers Editor import. [Artistic decision and closeout](docs/e62-artistic-closeout.md) · [C1/C2 original gallery](docs/LumaSprite-Engine-E6.2-Report.html)

**E6.1R engineering is APPROVED and art is APPROVED_WITH_LIMITATIONS.** The owner locked B1 at `24b8ca6` and retained B0 as the historical control. [Artistic acceptance](docs/e61r-artistic-acceptance.md) · [Production baseline](benchmarks/fixtures/e62/b1-production-lock.json) · [Original comparison](docs/LumaSprite-Engine-E6.1R-Report.html)

**E6.1 engineering is APPROVED.** The owner selected art-directed ENV-B for refinement and retained ENV-A as control at `537f604`. The eight original packages reproduce all 104 archived hashes. [Original E6.1 A/B report](docs/LumaSprite-Engine-E6.1-Report.html) · [E6.1 foundation](docs/e61-environment-foundation.md)

**E5 Engineering is APPROVED and the Artistic Baseline is APPROVED_WITH_LIMITATIONS.** The owner selected W2, the E5.3 Courier walk, the original Courier standing pose and Discrete Root A. The E5.4 source, PNG, timing, root/contact, palette and pivot locks are the production references. [E5 Final Acceptance](docs/e5-final-acceptance.md) · [Production lock](benchmarks/results/e54/baseline-lock.json)

**E5.4 is E5_READY_FOR_FINAL_OWNER_ACCEPTANCE.** Surveyor uses W2 with E5.1 Idle. Courier Walk is approved with limitations and uses the original E4.4 standing pose and material. Hybrid and W2-IK are research records. The production walk builder uses its established solver, with the Hybrid callback available only through E5.3 archive replay. [Final owner review gallery](docs/LumaSprite-Engine-E5.4-Report.html) · [Decision and Unity report](docs/e54-final-acceptance.md)

Unity 6000.3.21f1 Windows Standalone passed. At the tested speeds, Discrete Root held the authored contacts at 0 px slip including samples between frames. Pixel-Snapped moved the root smoothly and shifted the held planted pose by up to 4 px for Surveyor and 3 px for Courier. The packet selects method A. Studio `bb5c384` round-tripped all four bundled clips. [Production lock](benchmarks/results/e54/baseline-lock.json) · [Unity and Studio evidence](benchmarks/results/e54/unity/evidence.json)

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
