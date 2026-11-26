# LumaSprite Engine documentation

## Current checkpoint

- [E5.3 art and runtime gallery](LumaSprite-Engine-E5.3-Report.html), [playback harness](LumaSprite-Engine-E5.3-Runtime.html) and [artistic quality gate](e53-quality-review.md#artistic-quality-gate).
- [R0 project audit and cleanup](r0-project-audit.md) and [regression record](r0-regression.md).
- [R&D experiment plan](../research/open-source/README.md). W2 Expressive Walk is the research reference and W1 is the control.
- [E5.2 walk gallery](LumaSprite-Engine-E5.2-Report.html), [W1/W2 packages](../benchmarks/results/e52/README.md) and [motion and root contract](architecture/e52-walk-motion.md).
- [Studio compatibility](integration/e52-walk-studio.md) and [handoff](../HANDOFF.md).

## Architecture and integration

| Area | Documentation |
| --- | --- |
| Pixel Core and prop generation | [Engine and AssetSpec](architecture/overview.md) · [Palette policy](integration/palette-policy.md) |
| Terrain | [Approval and limits](e3-final-acceptance.md) · [Studio tilemap contract](integration/studio-tilemap-contract.md) · [Production baking](integration/studio-terrain-production.md) |
| Character | [Geometry](architecture/character-geometry.md) · [Materials](architecture/character-materials.md) · [Production packages](architecture/character-production.md) · [Final acceptance](e4-final-acceptance.md) |
| Animation | [E5.1 foundation](architecture/animation-foundation.md) · [E5.2 walk model](architecture/e52-walk-motion.md) · [Studio timing and root sidecars](integration/e52-walk-studio.md) |
| Loopback transport | [Studio Adapter v1](integration/studio-adapter.md) |

## Milestone archive

| Checkpoint | Gallery or artifacts | QA and acceptance |
| --- | --- | --- |
| E0–E1 | [Seed 42/43 fixtures](../benchmarks/results/sample/README.md) | [Bootstrap](bootstrap.md) · [Verification](test-report.md) |
| E2–E2.4 | [E2](../benchmarks/results/e2/README.md) · [E2.3](../benchmarks/results/e23/README.md) · [E2.4](../benchmarks/results/e24/README.md) | [Owner review](art-quality/e2-owner-review.md) · [E2.4 QA](e24-test-report.md) |
| E3–E3.4 | [E3](LumaSprite-Engine-Report.html) · [E3.2](LumaSprite-Engine-E3.2-Report.html) · [E3.3](LumaSprite-Engine-E3.3-Report.html) · [E3.4](LumaSprite-Engine-E3.4-Report.html) | [Approval](e3-final-acceptance.md) · [SHA-256](e3-final-sha256.txt) |
| E4.1–E4.2 | [E4.1](LumaSprite-Engine-E4.1-Report.html) · [E4.1R](LumaSprite-Engine-E4.1R-Report.html) · [E4.2](LumaSprite-Engine-E4.2-Report.html) | [E4.1 SHA-256](e41-baseline-sha256.txt) · [E4.1R SHA-256](e41r-benchmark-sha256.txt) · [E4.2 SHA-256](e42-benchmark-sha256.txt) |
| E4.3–E4.4 | [E4.3](LumaSprite-Engine-E4.3-Report.html) · [E4.4](LumaSprite-Engine-E4.4-Report.html) | [Approval](e4-final-acceptance.md) · [E4.3 SHA-256](e43-benchmark-sha256.txt) · [E4.4 SHA-256](e44-benchmark-sha256.txt) |
| E5.1 | [Idle gallery](LumaSprite-Engine-E5.1-Report.html) · [Idle package](../benchmarks/results/e51/README.md) | [Owner approval](e51-idle-acceptance.md) · [SHA-256](e51-benchmark-sha256.txt) |
| E5.2 | [Walk gallery](LumaSprite-Engine-E5.2-Report.html) · [Walk packages](../benchmarks/results/e52/README.md) | [Technical QA](e52-test-report.md) · [Human review](../benchmarks/results/e52/review.md) · [SHA-256](e52-benchmark-sha256.txt) |

## Regenerate a milestone

Run `npm ci` and `npm run build` with Node 24. Choose the benchmark for the desired checkpoint.

| Area | Command names after `npm run` |
| --- | --- |
| Seed fixtures | `benchmark` |
| Props | `benchmark:e2`, `benchmark:e23`, `benchmark:e24` |
| Terrain | `benchmark:e3`, `benchmark:e32`, `benchmark:e33`, `benchmark:e34` |
| Character | `benchmark:e41`, `benchmark:e41r`, `benchmark:e42`, `benchmark:e43`, `benchmark:e44` |
| Animation | `benchmark:e51`, `benchmark:e52` |

The default outputs go to ignored `benchmarks/results/run/`. Use `-- --out benchmarks/results/run/<experiment>` for a fresh run. The benchmark archive under `benchmarks/results/` supplies reference fixtures and approval evidence. The `report:e*` scripts regenerate the corresponding published HTML, so use them only when working on that report. [Roadmap](roadmap.md) · [R0 reproduction results](r0-regression.md)
