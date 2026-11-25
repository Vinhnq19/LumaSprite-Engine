# E4.3 technical verification

**E4_3_READY_FOR_HUMAN_GAME_ART_REVIEW**. The art decision and game readiness are pending.

| Gate | Result |
| --- | --- |
| Engine | Lint, typecheck, build, CLI smoke and all 54 Engine tests pass. Four new cases cover material ownership and contrast, a second character, baselines and package tampering. |
| M2P shape lock | B1's 1,086-pixel alpha and 20 binary part masks match. Landmark, grip, pivot, standing intent and clearances remain exactly those pinned in E4.2. |
| Materials | The M2P mask equals M2's. The glass-to-frame gap rises from 68.11 to 81.80 and warm, bright glass pixels increase from 4 to 10. Near coat remains brighter than far coat. Locked uses only its four submitted inks. |
| Courier generalization | Separate CharacterSpec v3 and lock. The preview has 19 attached part masks, independent head/body proportions, both ground contacts and a different hood/crossbody arrangement. Exact alpha is preserved across shared material alternatives. |
| Portable production | Both packages regenerate byte for byte with transparent PNG, packed part masks, spec version, pivot, material, shape and lineage. The verifier rejects changes to the PNG or manifest and checks all named files. The CLI verified the published packages. |
| Studio | Studio `bb5c384` passed the eight-profile run. Verified saves, reopens and backup restores for M2P and Courier with exact RGBA, masks, pivots and mapped material/provenance. Both stale saves returned 409 `STALE_REVISION`. Existing prop HTTP and E3.4 terrain production tests also passed. |
| Historical integrity | 494 E3, 23 E4.1, 21 E4.1R and 39 E4.2 catalog entries matched SHA-256. Regeneration matched 20 E4.1, 20 E4.1R and 38 E4.2 files. |
| E4.3 regeneration | 37 generated benchmark files, three Studio captures and the offline HTML matched their recorded SHA-256. |
| Offline gallery | At 1,440 and 390 pixels in offline Chrome, all 25 embedded previews decoded, nine 64 × 64 sprites displayed at native size, all six downloads and navigation targets resolved, and all 20 score inputs were present. No external requests, horizontal page overflow or console errors. |
| Assets and cost | Uses existing E2/E3 art and previously licensed CC0 Dungeon tiles. Dependency and license records are intact. Runtime AI calls total zero. |

[Studio proof](../benchmarks/results/e43/studio/parity.json) · [Readability measurements](../benchmarks/results/e43/readability.json) · [Artifact SHA-256](e43-benchmark-sha256.txt)

```powershell
npm run build
npm test
npm run smoke
npm run benchmark:e43
npm run character -- --verify-package benchmarks/results/e43/packages/m2p
npm run character -- --verify-package benchmarks/results/e43/packages/courier
npm run test:character-studio
npm run report:e43
```

The Studio test defaults to `benchmarks/results/run/e43-studio`. The published PNGs are native outputs following backup and restore. The portable package remains the source of the complete Engine CharacterSpec and lineage. [Production architecture](architecture/character-production.md)
