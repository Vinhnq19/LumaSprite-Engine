# Changelog

## Engine v1 · Frozen internal release candidate

- Added deterministic import, validation, compositing and verified PNG package export for artist PNGs and ordered components.
- Added mask-bounded color revisions with a parent manifest digest and explicit revision verification. Prior directories remain available for rollback.
- Added a local Windows review build with offline dependency staging and an external-folder smoke test.
- Recorded regression gates and the boundary for future candidate providers. Existing generators and Studio Adapter v1 keep their production defaults.
- Separated the E8.5 Studio integration from the offline CI suite so the Engine checkout runs its default tests without a Studio sibling or local fixtures.
- Recorded Owner-directed internal acceptance with keyboard and visible HUD exceptions. [Release notes and pinned RC](docs/v1-internal-release.md)

The [Report Index](docs/reports/INDEX.md) tracks earlier milestone evidence and Owner decisions.
