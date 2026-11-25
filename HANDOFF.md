# Handoff

The E0–E1 baseline is `368c8eb`. The E2.1/E2.2 checkpoint is `bcd47ca`. The E2.3 checkpoint is `659b717`. Both earlier comparison sets remain in the repository. [E2.3 gallery](benchmarks/results/e23/README.md)

## Owner review

Start with the [E2.4 gallery](benchmarks/results/e24/README.md) at native size. Inspect Barrel Tall's rim and upper hoop first, then Barrel Wide's body and Travel's front rail on the dark scene. Compare the six props together in the neutral scene and score each asset. Engineering validation has passed and art stays **PENDING_HUMAN_REVIEW**. [Owner score sheet](benchmarks/results/e24/review.md)

Run `npm run benchmark:e24` from the Engine checkout to rebuild the scenes and props. Default CLI and Studio jobs use the latest finishes. Archived specs keep their previous render behavior. The fixture license and the future Studio preset are included. [Fixture notice](benchmarks/fixtures/e24/README.md) · [Wood & Iron swatches and preset](benchmarks/results/e24/README.md#palette-validation)

Use the owner decision to choose which variants carry into E3. Treat E4's runtime integration as a separate decision after the terrain and palette evidence. [Art and geometry audit](docs/art-quality/e24-audit.md) · [Test evidence](docs/e24-test-report.md) · [Draft PR and publishing commands](docs/e24-pr.md)
