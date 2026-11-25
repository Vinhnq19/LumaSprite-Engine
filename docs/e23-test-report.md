# E2.3 validation

Verified on Node 24.22.3. E2.1/E2.2 passed lint, typecheck, build, CLI smoke, 14 Engine tests and its real Studio preview test before the local checkpoint `bcd47ca`.

| E2.3 gate | Result |
| --- | --- |
| Lint, typecheck and build | Pass |
| Engine tests | 20 passed |
| CLI smoke and tall Barrel generation | Pass |
| Real Studio v1 integration | 1 passed covering chest, masked chest and tall Barrel candidates |
| Baseline PNG SHA-256 | All 10 preserved |
| E2.1/E2.2 gallery regeneration | All 46 artifacts byte-identical |
| E2.3 gallery regeneration | All 74 artifacts byte-identical |

Both barrel silhouettes are connected and distinct from chest and crate. Regression tests check centered ellipse spans, wall bulge, attachment edges, barrel layer order, shape bounds, binary alpha, locked-palette membership, deterministic rendering and exact PNG round-trip. Saved Seed 42 and 43 specs reproduce their original images. Saved E2.1/E2.2 specs reproduce the earlier authored and locked pixels.

The v1 integration checks candidate receipt stability, protected pixels outside the mask, refusal without approval and stale revision rejection. The tall barrel uses the same result shape and passes palette and hash validation. The sibling Studio checkout remained clean. Runtime AI calls and DeepSeek calls were both zero.

Technical gate **PASS**. Artistic state **PENDING_HUMAN_REVIEW**. [Gallery](../benchmarks/results/e23/README.md) · [Owner review sheet](../benchmarks/results/e23/review.md)
