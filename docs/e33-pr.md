# Draft PR · E3.3 production terrain

Branch `codex/e3-3-production-tileset` starts from the E3.2 checkpoint `010e82c`. Use `codex/e3-2-terrain-quality` as PR base while main is behind that checkpoint.

## Summary

- Adds TerrainSpec v3 for deterministic grass clusters, packed soil and gentler bank profiles. Keeps E3.1 and E3.2 renders and the canonical tile contract intact.
- Adds `terrain --bake` and `--verify` with versioned map and atlas files, reproducible hashes, seed, origin and layout.
- Verifies four baked Studio PNG round-trips through the production modules and a separate editable/static comparison.
- Delivers an offline gallery, palette and density comparisons, and a reviewer scorecard. Owner final artistic decision remains pending.

[Technical checks](e33-test-report.md) · [Studio compatibility and fixture scope](integration/studio-terrain-production.md) · [Review gallery](LumaSprite-Engine-E3.3-Report.html)

## Publish after review

```sh
git push -u origin codex/e3-3-production-tileset
```
