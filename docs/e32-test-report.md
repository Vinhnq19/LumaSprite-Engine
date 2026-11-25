# E3.2 technical validation

Checked on Node 24.22.3. The E3.2 branch starts at E3.1 source checkpoint `ad7cdbc`. Studio stayed at `bb5c384`.

| Gate | Result |
| --- | --- |
| Lint, typecheck, build and CLI smoke | Pass |
| Engine regression | 31 passed |
| Terrain CLI | TerrainSpec v2 atlas and world map exported. Scene B PNG reproduced byte-for-byte |
| E3.1 lock | Published atlas PNG, atlas JSON and QA SHA-256 match the checkpoint. All 28 E3.1 artifacts regenerate identically |
| Historical props | Original 10 PNG hashes still match. E2.1/E2.2, E2.3 and E2.4 regenerated 46, 74 and 65 identical files |
| Atlas compatibility | 47 canonical masks, 256 raw masks, and Dirt Center ID 48 |
| Seam QA per palette | 4,096 horizontal and 4,096 vertical pairs. All 131,072 compared border pixels match |
| Junction QA per palette | All 65,536 possible 4×4 occupancy neighborhoods agree at the central four-tile vertex |
| Studio | HTTP v1 prop regression passes. Real registration, map pixel comparison and backup restore pass for both E3.1 and E3.2 atlases |
| E3.2 benchmark | All 39 artifacts regenerate byte-for-byte |
| AI runtime | 0 DeepSeek calls and 0 image or model inference calls |

The terrain unit tests compare border RGBA directly against v1 for both insets, verify grass connectivity for every mask and guard alpha, palette and PNG round-trip. Changing the seed or origin changes interior clusters. Independently rendered windows match at overlapping absolute tile coordinates. The Studio check verifies the canonical atlas. Engine exports the world-space variation in its separate map path.

The atlas JSON records the static placement, map mode and coordinate unit. The supplied project and locked lists remain authoritative. The locked sample is **PALETTE_LIMITED**. E3.2 art is **PENDING_HUMAN_REVIEW**. [Batch QA JSON](../benchmarks/results/e32/qa.json) · [Owner review sheet](../benchmarks/results/e32/review.md) · [Single-file report](LumaSprite-Engine-E3.2-Report.html)
