# E3 final acceptance

The Project Owner accepted the E3 artistic baseline with limitations and approved the engineering results. Candidate B, **Art-Directed Terrain**, is the selected baseline for Authored and Project palettes and the baked raster background workflow. The brief records a reference score of about 4.06/5. Candidate A, **Conservative Polish**, remains an optional preset. [Owner decision](../benchmarks/results/e34/review.md) · [E3.4 gallery](LumaSprite-Engine-E3.4-Report.html)

Dirt texture remains simple, long transition runs still read on a tile grid, and wide clearings have limited plant variety. The four-color Locked palette remains `PALETTE_LIMITED`. Studio editable maps sample the static atlas. Editable world-space variation is scheduled for E8. E3 is closed and the next milestone is character geometry.

## Compatibility and recovery

The Candidate B preset is explicit. The terrain CLI continues to default to TerrainSpec v3 for existing callers. TerrainSpec v4 still carries the direction and all reproducibility data inside the versioned bake manifest. Either v4 preset can regenerate its locked output. The atlas retains 47 canonical grass masks and dirt, the 256 raw lookups, and existing tile IDs. [Candidate B spec](../benchmarks/results/e34/b-spec.json) · [Optional A spec](../benchmarks/results/e34/a-spec.json)

```sh
npm run build
npm run terrain -- --bake --spec benchmarks/results/e34/b-spec.json --map benchmarks/results/e33/map-input.json --out benchmarks/results/run/approved-terrain
npm run terrain -- --verify benchmarks/results/run/approved-terrain
```

The recoverable E3.4 checkpoint is `51d7a7e` on `codex/e3-4-art-direction`, already integrated by `6a238b9`. The SHA-256 catalog pins the published benchmark assets and review reports. The owner decision is maintained in the E3.4 review sheet. [Final SHA-256 catalog](e3-final-sha256.txt) · [Engineering and Studio evidence](e34-test-report.md)

Closeout passed lint, typecheck, build, 37 existing Engine tests, the SHA-256 catalog test and CLI smoke. All 477 regenerated benchmark files and Studio captures matched. The catalog covers 494 published artifacts. Both v4 Organic packages verified, and Studio's prop, static terrain and baked raster checks passed at `bb5c384`.

## PR summary

Record the owner decision, freeze the published E3 benchmarks and open character geometry on a separate branch. The closeout commit carries the decision and hash regression without altering the existing renderer or its default preset.

```sh
git push -u origin codex/e3-finalization
```

Compare `codex/e3-finalization` against `main`.
