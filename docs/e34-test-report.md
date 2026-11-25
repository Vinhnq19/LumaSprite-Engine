# E3.4 test report

Technical disposition **E3_4_READY_FOR_HUMAN_ART_REVIEW**. Project Owner acceptance is pending.

| Check | Result |
| --- | --- |
| Lint, typecheck, build and Engine regression | PASS. 37 Engine tests, including three E3.4 regressions for E3.3 hashes, world coordinates and material boundaries, plus cluster coverage and density. |
| CLI smoke | Prop CLI smoke passed. Terrain `--bake` and `--verify` passed for A and B. Both Large packages matched all four published files byte for byte. |
| Canonical masks and IDs | All 47 grass masks plus dirt retain the existing IDs and rectangles. All 256 raw-mask lookups match the Studio checkpoint. |
| Seams and junctions | Each direction and palette validated 8,192 seam pairs and 65,536 junction configurations. Pixel assertions for world samples match the E3.3 outside border. |
| PNG, alpha and palette | Atlas and bake PNG round-trips passed. Opaque terrain pixels use the configured palette. Locked stays `PALETTE_LIMITED` and the overlay compositor keeps its binary-alpha checks. |
| Determinism and package integrity | A and B preserve their version, direction, seed, origin, layout and source hashes. The same inputs match byte for byte. An independently rendered overlapping window matched the world crop and different seeds/origins changed interiors. All 10 E3.4 packages passed manifest verification. |
| Historical regression | 265 regenerated files for Sample through E3.2 matched their locked references. E3.3 matched 58 Engine files and 9 Studio captures. The two historical Sample Studio images were checked against the Git checkpoint. |
| E3.4 regeneration | 124 Engine-generated files and 21 Studio captures matched SHA-256 on a second run. |
| Studio | Existing prop HTTP, E3.1/E3.2 static terrain and E3.3 production checks passed. All 10 E3.4 baked references preserved exact RGBA after Studio save/reopen and backup/restore. Static editable exports matched the corresponding Engine atlas render and portable map IDs. Studio checkout `bb5c384` was read-only. |
| Provenance and runtime | E2.4 authored props and existing CC0 traveler and dungeon wall. Wall source hash is pinned, and baked overlay hashes are in the manifests. 0 AI runtime calls. |
| Offline report | Chrome decoded all 56 previews at their declared dimensions and opened six embedded downloads. The gallery fit the desktop and 390 px mobile viewports, with zero external requests. Regeneration matched the HTML SHA-256. |

**BAKED_MAP_RGBA_PARITY_PASS** describes the static raster background, with props and wall where present. **STATIC_ATLAS_RGBA_MATCH** describes only the editable terrain render. `ENGINE_VARIATION_PASS / STUDIO_VARIATION_NOT_SUPPORTED` still applies to editable world-space detail, deferred to E8. [Engine QA](../benchmarks/results/e34/qa.json) · [Studio parity](../benchmarks/results/e34/studio/parity.json) · [E3.3 integration contract](integration/studio-terrain-production.md)

## Reproduce

Run with Node 24 and an adjacent Studio checkout. The benchmark defaults to an ignored output folder. Set the edition for the production integration test in PowerShell.

```powershell
npm run build
npm run benchmark:e34
npm run terrain -- --verify benchmarks/results/e34/packages/b-organic
$env:LUMASPRITE_TERRAIN_EDITION='34'
npm run test:terrain-production-studio
npm run report:e34
```

The report generator reads the published E3.4 artifacts and Studio export captures. The parity test writes regenerated exports to `benchmarks/results/run/e34-studio` by default. [Offline gallery](LumaSprite-Engine-E3.4-Report.html)
