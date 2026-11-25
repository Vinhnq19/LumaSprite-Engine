# E4.1R verification

**E4_1R_READY_FOR_HUMAN_SHAPE_REVIEW**

Both refinements report **STRUCTURAL_VALID**, **POSE_CONSTRAINTS_VALID** and **VISUAL_REVIEW_PENDING**. These are separate results in the v2 diagnostics. Art approval belongs to the Project Owner.

| Measurement | A baseline | B baseline | B1 Grounded | B2 Forward-Step |
| --- | ---: | ---: | ---: | ---: |
| Silhouette height | 50 | 59 | 56 | 56 |
| Top clearance | 6 | 1 | 3 | 3 |
| Near sole projected clearance | — | — | 0 | 0 |
| Far sole projected clearance | — | — | 0 | 2 |
| Maximum leg gap | 5 | 8 | 5 | 11 |
| Hand/handle contact pixels | 6 | 6 | 7 | 8 |
| Visible handle opening rows | — | — | 2 | 2 |
| Ground pivot | (28, 56) | (30, 60) | (30, 59) | (29, 59) |

Dimensions and clearances are in pixels. In v2 the supporting foot sets the scene pivot. The other foot has an explicit relative depth on the same projected ground plane. B1's near and far soles touch at rows 59 and 58. B2's far contour is two transparent rows above its projected ground and the toe rises by one pixel on the part mask.

- Lint, typecheck, build, CLI smoke and 46 Engine tests passed. B1 and B2 CLI exports matched the benchmark bundles.
- Both full 64 × 64 silhouettes and all part masks are connected. PNG/RGBA round-trips and deterministic regeneration passed. Tests also reject head/lantern clipping, a backwards knee, a wrongly grounded step, false sole contact and a closed handle aperture.
- V2 checks pivot and contour clearance, visible heel/sole support, stance or step weight placement, projected shoulder and hip alignment, knee and elbow directions, distinct boot masks, the open handle and lamp/body separation. Existing layer-order and alpha checks cover both spec versions.
- Recreated 20 original E4.1 generator files and 20 E4.1R files byte for byte. The 23 original E4.1 files and 494 E3 catalog entries all match SHA-256. The original review and report are frozen.
- Studio `bb5c384` passed draft profile save/reopen, all part-mask resources, pivots, links and exact RGBA export for **A, B, B1 and B2**. Existing prop HTTP integration passes. The Engine schema version is independent from Studio's existing CharacterProfile v1.
- Published previews use local Engine renders, E2 props and approved E3.4 terrain. Dependencies and license provenance are unchanged. AI runtime calls total zero.
- Chrome decoded all 28 images at their native or integer-zoom dimensions and read five embedded downloads. The offline report fit desktop and 390 px mobile viewports. Regeneration matched its SHA-256.

[QA JSON](../benchmarks/results/e41r/qa.json) · [E4.1 lock](e41-baseline-sha256.txt) · [E4.1R artifact SHA-256](e41r-benchmark-sha256.txt)

```sh
npm run build
npm test
npm run smoke
npm run benchmark:e41r
npm run test:character-studio
npm run report:e41r
```
