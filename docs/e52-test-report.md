# E5.2 technical verification

**E5_2_READY_FOR_HUMAN_WALK_REVIEW**

| Gate | Result |
| --- | --- |
| Engine | Lint, typecheck, build, CLI smoke and all 65 Engine tests passed. Three new tests cover gait phases, sampled world contact, paint consistency, locked idle and deterministic package verification. |
| Geometry | Six W1 frames and eight W2 frames at 64 × 64. All pass joint, connectivity, mask ownership, palette, layer depth, canvas margin, boot separation and stable pivot checks. |
| Feet and root | Zero world displacement on six W1 and eight W2 planted-foot comparisons, including each wrap. Per-frame projected ground, contact state, knee, ankle, sole and tracking point are recorded. |
| Held equipment | Seven grip pixels, two open handle rows and five pixels of minimum lantern-body clearance in all 14 frames. W2 swings the lamp body at most one pixel relative to its held grip. |
| Continuity and flicker | Both gait wraps pass pose limits. The 110 ms bridge retains the far boot exactly across idle and the next contact. Ten to thirteen registered unchanged parts per transition show zero paint drift. Body contours, gait feel and deformed regions are on the human rubric. |
| Timing and export | Exact RGBA in all checked sheet cells, 780 ms for W1 and 880 ms for W2. The CLI verified both packages. Benchmark regeneration matched 78 files. |
| Studio | `bb5c384` preserved both strips, their exact variable frame timings, frame order, pivots, repeat tag and RGBA after save, reopen and backup restore. Both stale saves were rejected. Four captured files reproduced exactly. E5.1 also passed its original round-trip. |
| Offline gallery | Chrome at 1,440 and 390 px decoded 70 embedded images and opened 12 downloads. Six canvases rendered the native loops, matching the expected phases and positions in both game scenes. Both start/stop previews used the approved idle, bridge, correct root offsets and the closing contact. |
| Frozen baselines | 22 E2-series prop digests and the existing E3–E5.1 catalogs match. All 31 regenerated E5.1 benchmark files match the published originals. No dependencies or runtime AI calls were added. |
| Target-game runtime | `GAME_RUNTIME_NOT_TESTED`. The supplied workspace has the offline Engine/Studio path. Target-engine foot contact and playback remain pending. |

[QA and packages](../benchmarks/results/e52/README.md) · [Studio proof](integration/e52-walk-studio.md) · [SHA-256 catalog](e52-benchmark-sha256.txt)

```powershell
npm run lint
npm run typecheck
npm run build
npm test
npm run smoke
npm run benchmark:e52
foreach ($candidate in @('w1','w2')) {
  npm run animation -- --source benchmarks/results/e44/packages/r2 --verify "benchmarks/results/e52/$candidate/package"
}
$env:LUMASPRITE_ANIMATION_EDITION='52'
npm run test:animation-studio
npm run report:e52
```

E5.2 verifies frame-stepped root and contact at sampled frames. Artistic selection or approval remains with the Project Owner. [Walk review sheet](../benchmarks/results/e52/review.md)
