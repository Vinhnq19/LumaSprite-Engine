# E5.1 technical verification

**E5_1_READY_FOR_HUMAN_ANIMATION_REVIEW**

| Gate | Evidence |
| --- | --- |
| Engine | Lint, typecheck, build and CLI smoke passed. All 62 Engine tests passed. Four animation tests cover motion, source and timing validation, flicker detection and package rejection. |
| Frame geometry | Four 64 × 64 frames. There are three distinct silhouettes. Neutral and return match the exact approved R2 RGBA. Rebuilt joints, body masks, palette, part order, canvas margin, grip and clearances pass per-frame QA. |
| Ground and equipment | Pivot (30,59). Both boot masks and projected grounds are fixed. The grip at (49,33) keeps seven contact pixels and a two-row handle opening in all frames. |
| Motion and flicker | Four transitions including the wrap stay within one pixel per joint axis. Each compares 16 aligned unchanged parts and finds zero paint changes. Deforming regions and contour readability are reviewed at native scale. |
| Export and determinism | The 256 × 64 transparent sheet decodes exactly. Four checksummed cells preserve 360 / 480 / 360 / 600 ms and a repeat duration of 1,800 ms. The CLI verified the five-file package. Independent regeneration matched the 31 benchmark files and the two Studio captures. |
| Studio | Studio `bb5c384` preserved the exact frame RGBA, normalized pivot, forward loop tag, frame order and durations after save and backup restore. PNG and JSON strip export match the source frame data. Studio rejected the stale revision with status 409. |
| Browser | Offline Chrome at 1,440 px and 390 px decoded 25 previews, resolved six downloads and played all four poses plus the wrap at the expected elapsed times. Canvas pixels matched the selected frame and remained at native size on both displays. |
| Historical integrity | E2 prop hashes and all E3/E4 catalogs match. Regeneration reproduced 63 E4.4 benchmark files. The historical review sheet records the owner's decision. The locked character packages and their geometry sources are unchanged. |
| Game runtime | `GAME_RUNTIME_NOT_TESTED`. The two project workspaces supply Studio and the offline gallery preview. Target-engine slicing, sampling and playback remain pending. |
| Costs and provenance | Uses the approved R2 geometry, M2P materials and existing RPG scene. Zero AI API calls and no new dependencies. |

[Frame QA](../benchmarks/results/e51/package/qa.json) · [Studio evidence](../benchmarks/results/e51/studio/parity.json) · [Artifact SHA-256](e51-benchmark-sha256.txt)

```powershell
npm run lint
npm run typecheck
npm run build
npm test
npm run smoke
npm run benchmark:e51
npm run animation -- --source benchmarks/results/e44/packages/r2 --verify benchmarks/results/e51/package
npm run test:animation-studio
npm run report:e51
```

[Human animation review](../benchmarks/results/e51/review.md) determines acceptance for the idle and authorization for the E5.2 walk cycle.
