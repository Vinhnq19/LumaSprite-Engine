# Draft PR · E3.2 terrain art and variation

## Summary

- Preserve E3.1 and approved E2 artwork as locked checkpoints.
- Add stepped grass–dirt banks, designed material clusters, three densities and deterministic world-space map placement.
- Preserve the fixed Studio atlas and tile IDs. Export a standalone atlas plus native and 4× world-space map previews.
- Compare authored, project and locked palettes on the same layout and keep structured _palette limited_ diagnostics.

## Main files

- `src/specs/terrain.ts` adds TerrainSpec v2 and map origin validation while keeping v1.
- `src/generators/terrain/edges.ts` and `detail.ts` implement bounded bank shaping and cluster placement.
- `src/generators/terrain/project-palette.ts` defines the proposed preset. `src/quality/terrain.ts` adds corner-junction checks.
- `scripts/benchmark-e32.ts`, `scripts/report-e32.ts` and `benchmarks/results/e32/` produce the scenes, palette comparison, atlas and owner review evidence.
- `tests/terrain-variation.test.ts` verifies historical hashes, connected shapes, seams and corners, seed and origin agreement, density and palette constraints.

## Review

Technical gate passed. Art remains **PENDING_HUMAN_REVIEW**. Studio supports the static atlas path. World-space detail ships in the Engine map export. DeepSeek development stays deferred. [Tests](e32-test-report.md) · [Unified E3.2 report](LumaSprite-Engine-E3.2-Report.html)

Use `main` as the PR base after its E3.1 checkpoint is available on the remote. The local E3.2 branch is `codex/e3-2-terrain-quality`.
