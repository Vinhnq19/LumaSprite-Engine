# Draft PR

## Title

E2.4 refine storage props and add native game-scene validation

## Summary

- Preserve the E0–E1, E2.1/E2.2 and E2.3 rendered benchmarks and specs.
- Refine the two barrels and Travel at 32×32 while preserving their silhouettes.
- Add authored and Studio locked scene comparisons, structured palette warnings and owner score sheets.
- Use a cropped CC0 character and original CC0 terrain fixtures. [Fixture notice](../benchmarks/fixtures/e24/README.md)

## Files and modules

- `src/generators/props/` and `src/specs/asset.ts` contain the versioned finish, latest presets and targeted barrel and Travel changes.
- `src/quality/prop-palette.ts` adds structured midtone contrast and ramp assessment. `src/cli/main.ts` and `src/jobs/manager.ts` report warning details without changing the Studio v1 HTTP response.
- `scripts/benchmark-e24.ts` and `scripts/prop-review-scenes.ts` create the local gallery and native snapshots. `benchmarks/results/e24/` contains the results, layout metadata, review sheet and preset swatches.
- `tests/prop-review.test.ts` covers the three refinements, baseline reproduction, palettes and scene placement. CI runs the E2.4 benchmark.

## Validation

Lint, typecheck, build, CLI smoke, 23 Engine tests and the real Studio v1 integration passed on Node 24.22.3. The technical evidence covers determinism, alpha, palette, PNG round-trip, old PNG regression and scene regeneration. The E2.4 artwork is **PENDING_HUMAN_REVIEW**. [Report](e24-test-report.md)

## Publish the branch

From the Engine checkout, review the local history and publish when ready.

```sh
git log --oneline main..codex/e2-prop-quality
git push -u origin codex/e2-prop-quality
```

In GitHub, use base `main` and compare `codex/e2-prop-quality`. Paste the summary, validation and review links into the PR. Post the owner art decision on the PR at review time. [GitHub compare](https://github.com/Vinhnq19/LumaSprite-Engine/compare/main...codex/e2-prop-quality)
