# Handoff

E0–E1 engineering baseline `368c8eb` is approved. Its art is marked **NEEDS_REFINEMENT** by the Project Owner. Seed 42 was selected as the comparison baseline and Seed 43 is the control. [Original gallery](benchmarks/results/sample/README.md)

## Review E2

Compare A Compact, B Domed and C Travel at 1×, then use the 4× and tile previews to inspect shape and material. The gallery includes the Seed 42 before/after, the shared-material crate and the Studio locked-palette previews. Record which design should advance and the revisions it needs. E2 candidates are **PENDING_HUMAN_REVIEW**. [E2 gallery](benchmarks/results/e2/README.md) · [Owner review sheet](benchmarks/results/e2/review.md)

Regenerate through `npm run benchmark:e2`. Use `npm run generate -- --design compact --seed 42` for an individual prop. Design options are `compact`, `domed`, `travel` and `crate`. Saved E0–E1 JSON still renders through `--spec`.

The next E2 round can refine the selected silhouette and test a user-selectable wood-and-iron palette preset in Studio. Confirm locked-palette diagnostics before proposing a protocol change. [Shape and material audit](docs/art-quality/e2-audit.md) · [E2 test evidence](docs/e2-test-report.md)
