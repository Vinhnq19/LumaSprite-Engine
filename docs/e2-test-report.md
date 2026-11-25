# E2 test report

Baseline E0–E1 commit `368c8eb` passed lint, typecheck, build and its 10 tests before work moved to `codex/e2-prop-quality`.

| Gate on Node 24.22.3 | Result |
| --- | --- |
| `npm run lint` and `npm run typecheck` | Pass |
| `npm run build` and `npm run smoke` | Pass |
| `npm test` | 14 passed, including all 10 baseline tests |
| `npm run benchmark` and `npm run benchmark:e2` | Pass |
| `npm run test:studio` | 1 passed against the real Studio server on loopback |

The E2 tests verify all 10 original PNG hashes and reproduce the final PNGs from the saved Seed 42 and 43 AssetSpecs. E2 coverage includes deterministic raster hashes, binary alpha, transparent RGB, palette membership, flat/silhouette agreement, outline connectivity, invalid composition rejection and PNG round-trip. Each benchmark variant passes in both authored and locked palettes. Palette compression warnings describe material legibility independently of the technical result.

The Studio test exercised normal and masked requests. It confirmed the protected pixel was preserved, a locked color was written in the selected region, an unapproved apply was rejected and a stale revision could not preview. The Studio checkout remained clean. The quality gates used zero runtime AI calls.

Artistic review is **PENDING_HUMAN_REVIEW**. [E2 benchmark](../benchmarks/results/e2/README.md) · [Owner review sheet](../benchmarks/results/e2/review.md)
