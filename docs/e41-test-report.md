# E4.1 Field Surveyor technical report

**Engineering PASS. Artistic status PENDING_SHAPE_REVIEW.** The stage ends with geometry and silhouette review.

| Raster measurement | A · Compact Explorer | B · Taller Surveyor |
| --- | ---: | ---: |
| Canvas | 64 × 64 | 64 × 64 |
| Silhouette height | 50 px | 59 px |
| Connected silhouette components | 1 | 1 |
| Connected part masks | 20 | 20 |
| Landmarks verified on named parts | 21 | 21 |
| Joints with shared mask occupancy | 12 | 12 |
| Hand/handle overlap | 6 px | 6 px |
| Rows with lamp clearance | 5 | 9 |
| Rows with a visible leg gap | 6 | 6 |
| Maximum gap between lower legs | 5 px | 8 px |
| Ground pivot | (28, 56) | (30, 60) |

A is compact with a larger head proportion, shorter jacket and lower lantern. B has longer limbs and jacket, a higher grip, and more separation between the boots. Each has a single planted foot and retained alpha clearances. The comparative scene uses both poses at the same ground point in the E3.4 B Organic Clearing with the matching E2 chest, crate and barrel at their original offsets. [Gallery](LumaSprite-Engine-E4.1-Report.html) · [Geometry diagnostics](../benchmarks/results/e41/qa.json)

## Verification

- Lint, typecheck, build and CLI smoke passed. The smoke exercises the original prop entry point and the character CLI.
- 42 Engine tests passed, including four new geometry cases and the E3 catalog. The cases verify distinct silhouette heights and alpha, connected parts and joints, grip and layer-order corruption, bounds, binary alpha, authored/locked inks, PNG round-trip and determinism.
- Studio `bb5c384` preserved both draft profiles, including exact source RGBA and part masks. The test verified the pivot, links, landmarks and export after save and reopen. Studio reports both profiles as `unapproved`. Existing Studio prop, editable terrain and baked PNG integration passed at E3 closeout. The adapters remain unchanged.
- All 494 catalog entries matched SHA-256. E4 benchmark regeneration matched all 20 generated files. Approved E3/E2 content is reused locally. No package additions or AI runtime calls.
- The offline report decoded 14 native or integer-zoom images and five embedded downloads in Chrome at desktop and 390 px mobile widths. The regenerated HTML matched SHA-256.

```sh
npm run build
npm test
npm run smoke
npm run benchmark:e41
npm run test:character-studio
npm run report:e41
```

The benchmark defaults to the ignored run directory. The HTML report reads the published E4.1 artifacts. [Owner review sheet](../benchmarks/results/e41/review.md)
