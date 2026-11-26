# LumaSprite Engine · E5.3 Quality Review

**E5_3_READY_FOR_HUMAN_QUALITY_REVIEW**

W2 Expressive Walk is the production reference. Review W2, W2-IK and W2-Hybrid at 1× in both scenes before opening the measurements. Courier Walk and Courier-Leather-Localized are candidates for the owner to score. [Standalone gallery and independent score sheets](LumaSprite-Engine-E5.3-Report.html) · [Browser runtime harness](LumaSprite-Engine-E5.3-Runtime.html)

## R&D final decision record

| Source | Decision | E5.3 treatment |
| --- | --- | --- |
| Ink & Bones / W2-IK | `FURTHER_EVALUATION_REQUIRED` | Keep W2. The owner saw smoother knees, lighter weight transfer and worse continuity on one knee at the wrap. The single permitted Hybrid tests two bounded passing-pose corrections with W2's upper body intact. |
| LucasJRamos SpriteKiln / Surveyor-3Q | `REJECTED_FOR_INTEGRATION` | Archive the projection evidence. The side planes are informative, but the silhouette and hands/lantern read weaker at 1×. Direct projection exceeded a CharacterSpec v2 segment constraint. Revisit during a separately approved directional-art milestone. |
| @texel/color / OKLab and OKLCH | `DIAGNOSTICS_CANDIDATE` | Compare lightness and color distance per material. Keep the current nearest-ink mapper and locked palettes. Courier ochre leather remains an art candidate. |

The clean R&D checkpoint was `f9c6f77`. E5.3 forked from it onto `codex/e5-3-animation-quality`. The R&D verifier ran twice in a Git archive under the ignored E5.3 verification directory. Its 54 deterministic files and the corresponding stored R&D checksums match. The R&D HTML, pose sidecars, historical fixtures and source notices remain at the checkpoint. [R0 audit](r0-project-audit.md) · [R&D report](../research/open-source/art-quality/LumaSprite-Engine-Art-Quality-RnD.html) · [Pins and source licenses](../research/open-source/art-quality/README.md)

## Hybrid and character generalization

| Clip | Total | Root travel | Max sampled knee delta | Wrap near / far | Planted pairs |
| --- | ---: | ---: | ---: | ---: | ---: |
| W2 | 880 ms | 32 px | 41.021° | 0.605° / 17.113° | 8 at 0 px |
| W2-IK | 880 ms | 32 px | 35.538° | 3.851° / 7.367° | 8 at 0 px |
| W2-Hybrid | 880 ms | 32 px | 24.444° | 0.605° / 17.113° | 8 at 0 px |
| Forest Courier Walk | 960 ms | 24 px | 26.718° | 9.034° / 20.344° | 8 at 0 px |

Hybrid moves the swing knee 1 px screen-left on frame 3 (near) and frame 7 (far), using the R&D joint targets as a reference. Its spec pins the W2 fixture, W2 manifest and IK QA. The six other frames are RGBA-identical to W2. The existing geometry renderer repaints the two updated thigh/shin poses. Hips, shoulders, arms, lantern grip and handle, foot targets, sizes, palette, phase durations and root contract match W2. The worst observed joint delta improved and the wrap stays identical. At 1× gameplay scale the correction is subtle. W2 remains selected unless an independent reviewer can identify the benefit and confirms equivalent weight transfer. [Hybrid AnimationSpec](../benchmarks/fixtures/e53/w2-hybrid.json)

Courier uses its own validated CharacterSpec v3, source hashes, shape lock and M2 russet-moss outfit. The existing AnimationSpec v2 walk pipeline now accepts the explicit `walk-free` intent with an unarmed v3 source, rejects nonzero grip/sway fields and uses ordinary opposition for both arms. Shared renderer, pose QA, wrap, root/contact, mask paint and portable package verification are the same paths. Courier-specific timing, swing geometry and cadence are in the fixture. It uses two 12 px steps per cycle, 25 px/s effective speed and asymmetric passing targets for its geometry. The satchel touches the strap on every frame. The frozen standing Courier frame serves as its idle because E5.1 supplies Surveyor idle. [Courier AnimationSpec](../benchmarks/fixtures/e53/courier-walk.json) · [Shared gait source](../src/generators/character/walk.ts)

Hybrid uses a bounded knee callback from the benchmark only. Its research manifest pins the refinement spec and files, and `benchmark-e53.ts` verifies it by exact regeneration. Courier uses the normal animation CLI and manifest format. Keeping the candidate callback outside the CLI avoids a second solver contract. Maintenance is one typed unarmed intent and one shared set of quality checks. A later decision to ship Hybrid would need a serializable production contract, QA for other proportions, and another target-game run.

## Runtime verification

**BROWSER_RUNTIME_PASS** · **UNITY_RUNTIME_NOT_TESTED**

Unity 6000.3.15f1 and 6000.3.21f1 were present. The discovered compatible-version projects contain separate game assets and scenes. No LumaSprite runtime test project was identified. Unity CLI reported no connected Pipeline instance. E5.3 exercised the browser fallback without modifying those projects.

The harness uses Canvas with a fixed 320×176 camera, exact frame rectangles, integer sprite pivots and disabled image smoothing. It reads the same PNG strips and duration/root sidecars displayed in the gallery. Outdoor uses the E3.4 terrain bake with E2.4 prop overlays. Dungeon uses the E2.4 approved dungeon materials and props. Press **Chạy cảnh** to play verified Surveyor Idle, entry, five cumulative walks, planted stop contact, exit and idle again. Courier plays the same state sequence with its own gait duration.

- Real browser playback completed both routes. Each actor displayed all 40 walk cells across five cycles, then reached the terminal idle stage. Surveyor advanced 160 px and Courier advanced 120 px. W2 ran outdoors and Hybrid ran in the dungeon alongside Courier.
- At deterministic boundary probes, all four clips held each frame until its requested delay expired. Five wraps and 40 adjacent planted samples per actor/route were checked in world coordinates. Max observed slip was 0 px. The root never teleported when the journey ended.
- Tested gallery controls, manual frame selection, all five preview modes, three-way synchronization and the JSON review form at a 390 px viewport. Runtime renders 1× without interpolation. PPU, Unity import/slicing settings and the game's own scene integration remain open for a Unity test project.

[Runtime proof and stage traces](e53-runtime-proof.json) · [Outdoor capture](e53-runtime-outdoor.png) · [Dungeon capture](e53-runtime-dungeon.png)

## Color diagnostics and localized leather

The explicit `e53-color.ts` command reports OKLab ΔL/ΔE, OKLCH swatches, ramp order and saturation, exact color collisions, near collisions and candidate ramps. It reads the original Courier and Surveyor packages. `Courier-Leather-Localized` edits the intersection of the visible satchel/strap owner and the authored leather mask, retaining the exact original alpha, other material pixels and both boot rasters. The 68 satchel pixels and 24 strap pixels have separate palettes. The test protected all 77 visible boot-owned pixels.

Coat-to-strap midtone ΔE moved from 0.047 to 0.063. Coat-to-satchel moved from 0.047 to 0.048 while its ΔL fell from 0.034 to 0.024. The far coat separates more strongly, and the bag color change is restrained at native scale. The small gain against the near coat needs an independent review outdoors and in the dark scene. Keep the baseline Courier selected until the localized candidate has a visible benefit. [Before/after and per-material QA](LumaSprite-Engine-E5.3-Report.html#color)

## Artistic quality gate

Every subsequent algorithm needs a named art problem, a pinned baseline and one controlled candidate. Hold camera, size, pose, scene and palette constant where applicable. Review native 1× and a representative gameplay scene first. An independent reviewer scores the animation or material rubric, records an Accept/Reject decision and checks technical QA, architecture effects and ongoing maintenance cost. When art reads equivalently, keep the baseline. Record technical success separately from the art decision and target runtime.

- Animation rubric covers motion clarity, weight, foot planting, knee/hip motion, arm motion, equipment, pixel stability, loop, gameplay readability and overall appeal.
- Character/material rubric covers silhouette, proportions, separation, lightness order, pixel clusters, color harmony, dark-scene readability and gameplay scale.
- Recommended E5 decision is to review Hybrid and Courier with the gallery and finish a Unity route when a project is available. Preserve W2 production and E5.1 acceptance during that review. The E5 game-ready decision remains with the Project Owner.

## Technical QA and reproduction

Run from the Engine root using Node 24 or later. This run used Windows x64 and Node 26.13.1.

```powershell
node scripts/verify-e53.ts
npm run lint
npm run typecheck
npm run build
npm test
npm run smoke
node dist/cli/animation.js --source benchmarks/results/e44/packages/courier-rev --verify benchmarks/results/run/e53/courier/package
npm run test:animation-studio
$env:LUMASPRITE_ANIMATION_EDITION = '52'
npm run test:animation-studio
```

For a targeted rebuild, run `e53-checkpoint.ts`, `benchmark-e53.ts`, `e53-color.ts` and `report-e53.ts` from `scripts/` in that order. The verifier runs those pieces, checks the historical catalogs and compares fresh E2.4, E3.4, E4.4, E5.1 and E5.2 fixtures with their archived bytes.

The E5.3 build verifies binary alpha, transparent RGB, palette membership, full strip round-trip, phase/duration, root increments, both wraps, planted samples, stable-part repaint, grip, pose limits and E5.2 continuity. The current checkout passed lint, typecheck, build, CLI smoke and 66 tests, including the retained W1/W2 and idle checks. All 805 historical checksums matched. Fresh E2.4, E3.4, E4.4, E5.1 and E5.2 renders matched 361 archived files. E5.3's two runs matched on 50 output files. Studio `bb5c384` passed E5.1 idle and E5.2 W1/W2 PNG, pivot, timing and project restore integration. Outputs live under `benchmarks/results/run/e53/`.

[SHA verification and raw evidence index](e53-evidence.json) · [Runtime proof](e53-runtime-proof.json) · [HANDOFF](../HANDOFF.md)

## PR summary

**E5.3 · Art-directed walk quality and runtime verification**

Preserve the W2 baseline, add the single bounded Hybrid for independent comparison, generalize the existing unarmed gait path for Courier, and add a fixed-camera browser route plus opt-in color diagnostics. Review the 1× comparisons and the exact PNG/timing/package artifacts from the offline report. This branch ships the quality gate and pilot artifacts for review. E5 final acceptance and Unity runtime verification remain open.
