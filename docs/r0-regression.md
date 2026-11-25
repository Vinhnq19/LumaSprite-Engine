# R0 regression record

Run on 2026-11-25 in the Engine checkout with Node `24.22.3`, npm `11.6.0` and sibling Studio `bb5c384`. The Engine starting point was `ea62de7`. Regression ran after removal of the audited duplicate files. Detailed logs are under ignored `benchmarks/results/run/r0-verification/logs/`.

## Gates

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run lint`, `npm run typecheck`, `npm run build` | PASS | Clean exit for all three commands. |
| `npm test` | PASS | 65 tests, 0 failed and 0 skipped. |
| `npm run smoke` | PASS | Compiled CLI checks cover generation, character and idle export. |
| Historical hashes | PASS | All 805 entries from the eight E3–E5.2 catalogs match. The E2 check also matches 22 published PNG/RGBA digests. |
| PNG/RGBA | PASS | 608 tracked benchmark and fixture PNGs decoded with the expected RGBA length. The existing tests and package verifiers also check exact crop/sheet RGBA and contact metadata. |
| Installed dependency graph | PASS | `npm ls --all --json` reported an empty problems array. |
| Published advisory database | PASS | Official `npm audit` returned 0 advisories for the installed lockfile on the run date. |
| Fresh install in an empty checkout | NOT RUN | Regression used the validated installed dependency tree. |
| Target-game runtime | `GAME_RUNTIME_NOT_TESTED` | CLI and Studio round-trip were exercised. Target-game playback and world root remain pending. |

## Benchmark regeneration

Each row ran against a separate destination under `benchmarks/results/run/r0-verification/`. Every output had the same bytes as its published counterpart.

| Commands after `npm run` | Files matched |
| --- | ---: |
| `benchmark` (Seed 42/43) | 13 |
| `benchmark:e2`, `benchmark:e23`, `benchmark:e24` | 46 / 74 / 65 |
| `benchmark:e3`, `benchmark:e32`, `benchmark:e33`, `benchmark:e34` | 28 / 39 / 58 / 124 |
| `benchmark:e41`, `benchmark:e41r`, `benchmark:e42`, `benchmark:e43`, `benchmark:e44` | 20 / 20 / 38 / 37 / 63 |
| `benchmark:e51`, `benchmark:e52` | 31 / 78 |
| **Total** | **734** |

The after-cleanup comparison checks all files produced by these 15 commands, including PNG, geometry, metadata and QA. The published archive also contains signed-off material, Studio captures and additional manual review documents. Its SHA-256 catalogs remain unchanged. [Published checkpoint index](README.md#milestone-archive)

## Studio integration

All nine invocations passed. Studio remained clean on `main` at `bb5c384`. Outputs were written in Engine's ignored workspace.

| Test | Editions | Result |
| --- | --- | --- |
| `test:studio` | Prop HTTP loopback | PASS |
| `test:terrain-studio` | E3.1, E3.2 | PASS for both |
| `test:terrain-production-studio` | E3.3, E3.4 | PASS for both |
| `test:character-studio` | E4.3, E4.4 | PASS for both |
| `test:animation-studio` | E5.1, E5.2 W1/W2 | PASS for both invocations |

## Storage after regression

Counts cover the same five local generated directories as the before/after cleanup table. Byte counts sum file lengths and exclude Git objects, filesystem allocation overhead and tracked documentation.

| Scope | Files | Bytes |
| --- | ---: | ---: |
| `.cache` | 537 | 179,395,629 |
| `benchmarks/results/run` | 936 | 8,209,040 |
| `dist` | 126 | 605,727 |
| `node_modules` | 3,584 | 49,552,102 |
| `graphify-out` | 24 | 410,643 |
| **Total** | **5,207** | **238,173,141** |

The cleanup removed 2,334 files and 16,259,953 bytes. Regression then created 808 files and 5,876,776 bytes in the measured directories, including outputs and logs. Studio recreated 39 of the deleted paths with the exact original hashes. The measured net reduction is **1,526 files and 10,383,177 bytes**, about **9.90 MiB**. No files were moved. [Cleanup audit and recovery ledger](r0-project-audit.md#cleanup-và-tài-liệu)
