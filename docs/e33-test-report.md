# E3.3 technical test report

Decision **E3_READY_FOR_FINAL_ART_REVIEW**. Project Owner final artistic acceptance is pending.

| Check | Result |
| --- | --- |
| Lint, typecheck and build | PASS |
| Engine full regression | 34 tests passed, including three new E3.3 cases |
| CLI | Prop smoke passed. Terrain `--bake` and `--verify` passed. All four files in the Large package matched the benchmark byte for byte. |
| Autotile mapping | 47 canonical grass masks plus dirt. All 256 raw masks match Studio. IDs, rectangles and collision fields remain stable. |
| Adjacent tiles and junctions | 8,192 seam pairs and 65,536 2×2 configurations per palette passed. Tests cover all production bank profiles at both supported insets. |
| Determinism and world coordinates | Same inputs gave identical output, distinct seeds/origins change interior detail, and an overlapping window matched the original raster. Borders remained identical to the static map. |
| PNG, RGBA and package integrity | Atlas and map render round-trips passed. Asset hashes and reproducible package bytes were verified. Tests reject tampered PNGs, unsafe overlay paths and changed contents at an existing destination. |
| Palette | Authored and Project `FULL_RAMP`. Locked `PALETTE_LIMITED`, with zero grass/dirt midtone gap and only the supplied colors. |
| Studio | Prop HTTP integration and E3.1/E3.2 static atlas tests passed. Studio checkpoint `bb5c384` passed four baked PNG fixtures and four editable map comparisons, including save/reopen and backup/restore. |
| Historical SHA-256 | Regenerated 265 files across Sample, E2, E2.3, E2.4, E3.1 and E3.2 and matched all. The two pre-existing Studio capture PNGs in Sample were preserved and are outside the local generator's output. Published baselines and fixtures match `010e82c`. |
| E3.3 SHA-256 | Matched all 58 Engine benchmark files and 9 Studio captures after regeneration. |
| Production cost and assets | 0 AI runtime calls. No new dependency or third-party asset. Outdoor uses five approved E2.4 renders and the existing CC0 traveler with provenance and hashes. |
| Offline report | Checked 47 PNG previews at native or embedded 4× dimensions, six download links, four Studio rows and no external resources in Chrome. |

The baked result is **BAKED_MAP_RGBA_PARITY_PASS**. The editable result is **STATIC_ATLAS_RGBA_MATCH**. Use **ENGINE_VARIATION_PASS / STUDIO_VARIATION_NOT_SUPPORTED** for editable world detail. [Integration scope](integration/studio-terrain-production.md) · [Engine QA](../benchmarks/results/e33/qa.json) · [Studio parity](../benchmarks/results/e33/studio/parity.json)

Review 1× images first and record the owner's decision before closing E3. [Offline report](LumaSprite-Engine-E3.3-Report.html)
