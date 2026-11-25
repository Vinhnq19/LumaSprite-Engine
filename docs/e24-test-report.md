# E2.4 validation

The E2.3 checkpoint `659b717` passed lint, typecheck, build, CLI smoke, 20 Engine tests and its Studio integration test before refinement.

| E2.4 gate on Node 24.22.3 | Result |
| --- | --- |
| Lint, typecheck, build and CLI smoke | Pass |
| Engine suite | 23 passed |
| Studio v1 integration | 1 passed covering normal chest, masked chest and tall barrel candidates |
| E0–E1 original PNG hashes | All 10 match |
| E0–E1 local benchmark beyond the captured Studio fixture | 13 byte-identical regenerated files |
| E2.1/E2.2 and E2.3 regenerate | 46 and 74 byte-identical files |
| E2.4 regenerate | 65 byte-identical files |
| CLI tall barrel versus gallery PNG | Byte-identical |

The tests check that all six archived E2.3 AssetSpecs still reproduce their native PNGs. All current silhouettes are byte-identical to E2.3. Barrel Wide, Barrel Tall and Travel change interior pixels. Compact, Domed and Crate reproduce their prior final pixels.

The current props pass alpha, palette, bounds, deterministic RGBA and PNG round-trip checks. Both palettes use identical scene placements and ground pivots. Each view copies its source pixels at native scale. The nearest-neighbor 4× check compares every output pixel to its source pixel. The locked palette renders are **TECHNICALLY_VALID** and **PALETTE_LIMITED**. Their structured warnings describe wood and iron ramp compression, ink collision and contrast loss.

Studio transport still accepts the v1 responses and SHA-256 digests. Protection, cancellation, receipt stability and stale revision rejection pass. The sibling Studio checkout remained clean. DeepSeek and AI image generation calls were both zero. [Fixture license and provenance](../benchmarks/fixtures/e24/README.md)

Art remains **PENDING_HUMAN_REVIEW**. [Gallery](../benchmarks/results/e24/README.md) · [Owner score sheet](../benchmarks/results/e24/review.md)
