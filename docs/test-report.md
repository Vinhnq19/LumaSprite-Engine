# Bootstrap test report

Verified on Windows with Node.js 24.22.3 and the sibling Studio checkout at `bb5c384`.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm test` | 10 passed across raster, provider and Engine HTTP tests |
| `npm run smoke` | Pass on Node 24.22.3 and 26.13.1 |
| `npm run benchmark` | Pass for seeds 42 and 43 with different raster hashes |
| `npm run test:studio` | 1 passed using the actual Studio server and Engine, with normal and masked preview paths |
| Studio's two engine contract suites | 10 passed using Studio's own fixtures |

Engine tests check schema rejection, integer coordinates, PNG round-trip, exact 4× scaling, deterministic RGBA, binary alpha, palette, mask preservation, request replay, cancellation and version integrity. The actual Studio smoke test verifies preview receipt stability, refusal with approval set to false and rejection after a revision change. Studio's own fixtures cover corrupt hashes, mutated receipts, timeouts and apply/rollback.

The network sandbox denied unapproved loopback connections. HTTP tests subsequently ran with loopback access. Runtime inference calls and charges were both zero. CI is configured to run the Engine's credential-free gate on Node 24. This report records the local run.

Art review remains `PENDING_HUMAN_REVIEW`. [Samples and raster checks](../benchmarks/results/sample/README.md)
