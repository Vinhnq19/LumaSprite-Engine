# Draft PR · E3.4 terrain art direction

Branch `codex/e3-4-art-direction` starts at E3.3 checkpoint `6e3696d`. Use `codex/e3-3-production-tileset` as the comparison base once that checkpoint is available remotely.

- Add two explicit TerrainSpec v4 directions while retaining v3 as the default. Both preserve edge geometry, tile IDs, palette and the existing bake manifest.
- Compare E3.3, Conservative Polish and Art-Directed Terrain at native and 4× scales across five layouts. Add seed-driven Organic RPG Clearing, dirt-floor Storage, density and palette comparisons, and a worksheet for the owner's decision.
- Verify all ten candidate packages and Studio baked/static round-trips. Keep editable world-space variation scheduled for E8.

Status **E3_4_READY_FOR_HUMAN_ART_REVIEW**. The final Project Owner decision remains pending. [Art audit](art-quality/e34-audit.md) · [Technical QA](e34-test-report.md) · [Review gallery](LumaSprite-Engine-E3.4-Report.html)

```sh
git push -u origin codex/e3-4-art-direction
```
