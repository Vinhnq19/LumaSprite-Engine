# E4.4 technical verification

**E4_4_READY_FOR_FINAL_HUMAN_ART_REVIEW**

| Gate | Evidence |
| --- | --- |
| Engine | Lint, typecheck, build, CLI smoke and 58 tests pass. Four new tests cover the frozen E4.3 artifacts, R1 mask locality and grip, R2 contact and shape changes and the Courier revision's independent lock and palette. |
| Geometry and shape locks | R1, R2 and Courier use distinct alpha hashes, source geometry hashes, ordered part masks and parent lineage. The solver reports valid joints, planted support, balance, headroom, attachment order and negative space. Applying a parent lock to changed geometry fails. |
| Material transfer | R1 and R2 reproduce the M2P ramps and 10 bright glass pixels. The renderer checks exact alpha ownership for every part, selected palette membership and PNG determinism. Courier uses its original M2 palette with the flap carried by the leather mask. |
| Engine production output | The CLI verified the three new production packages. Each package includes PNG RGBA, spec, shape lock, material and mask files, SHA-256, pivot and provenance. Rebuilding the benchmark reproduced its 63 files byte for byte. |
| Studio production output | Studio `bb5c384` validated 11 draft profiles and restored five production packages. Both originals and all three revisions saved, reopened and restored with exact RGBA, masks, pivots, landmarks and mapped metadata. Studio rejected all five stale saves with status 409 and `STALE_REVISION`. The prop HTTP test and the E3.4 terrain production test passed. |
| Game runtime | Pending target-engine verification. The checked game scenes are deterministic Engine-composited illustrations at native scale. |
| Historical integrity | The SHA-256 catalogs matched 494 E3, 23 E4.1, 21 E4.1R, 39 E4.2 and 41 E4.3 entries. Independent regeneration matched 20 E4.1, 20 E4.1R, 38 E4.2 and 37 E4.3 benchmark files. The E4.4 catalog covers 63 generated files, six Studio captures and the offline gallery. |
| Browser | Chrome offline at 1,440 px and 390 px resolved six anchors, eight downloads, 46 embedded images and 48 score fields. Sprite and scene previews kept their native dimensions. No external requests, page overflow or console issues. |
| Provenance and licensing | The terrain, prop and CC0 Dungeon fixtures match their existing sources. No dependency, external art or runtime AI call was introduced. |

[Studio captures](../benchmarks/results/e44/studio/parity.json) · [Revision evidence](../benchmarks/results/e44/revision-comparison.json) · [Artifact SHA-256](e44-benchmark-sha256.txt)

```powershell
npm run lint
npm run typecheck
npm run build
npm test
npm run smoke
npm run benchmark:e44
foreach ($candidate in @('r1','r2','courier-rev')) {
  npm run character -- --verify-package "benchmarks/results/e44/packages/$candidate"
}
$env:LUMASPRITE_CHARACTER_EDITION = '44'
npm run test:character-studio
npm run report:e44
```

The Studio run writes proof to `benchmarks/results/run/e44-studio` by default. The gallery embeds the published Studio proof and stays available offline. The Project Owner's review determines E4 Final Acceptance. [Human review sheet](../benchmarks/results/e44/review.md)
