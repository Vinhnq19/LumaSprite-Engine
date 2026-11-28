# Engine v1 scope

`ENGINE_V1_SCOPE_FROZEN` · 2026-11-28 ICT. Engine base `c60d03736d0597fc44673223a08873756229dce8`. Studio read-only baseline `471ac90555d3545beff5182146e291ba97b9ae20`. The technical release gate and Owner approval are separate from the E10.1 art brief selection.

| Classification | Scope and starting state | Acceptance evidence |
| --- | --- | --- |
| `RELEASE_REQUIRED` | Keep the deterministic Pixel Core, PNG/RGBA, palette, binary alpha, masks and integer layer composition. Retain the existing prop, terrain, environment, composition, character, animation and pixel-effects CLI behavior and production defaults. | Existing unit tests, CLI smoke and historical hashes. No rewrite or optimization is required. |
| `RELEASE_REQUIRED` | Keep the localhost Engine Adapter v1 for 32 × 32 props. Keep Studio's PNG editing and its separate native scene adapter as the existing integration surfaces. | Real Studio prop preview, protected pixels, revision rejection, PNG save/reopen/export and E8.5 scene ZIP round-trip. |
| `RELEASE_REQUIRED` | Keep the E8.5 Windows sandbox workflow, import, navigation, interaction state, save/reload and runtime parity. | Fresh EditMode, PlayMode and standalone checks. Physical input and artistic approval remain Owner actions. |
| `FIX_BEFORE_RELEASE` | E10.1 accepts only an internal DRAFT glove and its proof lives under `scripts/`. Expose the minimum file-based CLI for artist-owned or licensed input, with stable metadata, layer and ownership masks, masked revision, immutable rollback and a verified native sprite export. | One versioned input and package contract shared by local and future providers. Exercise the exported pixels through Studio and Unity. |
| `FIX_BEFORE_RELEASE` | The README is still oriented around the first vertical slice. A portable Windows review package and final verification record are missing. | Ship runtime dependencies, their notices and documentation together. Smoke-test from outside the repo and verify manifest integrity. |
| `FIX_BEFORE_RELEASE` | Engine has no project redistribution license recorded. E10.1 reference studies are review-only. | Internal Owner review package only. Owner must record distribution rights before external release. Keep reference packs and screenshots out of the runtime package. |
| `DEFER_TO_V2` | Native Studio component-package UI/API, arbitrary component transforms, multiview/animated component sets and broader Unity deployment targets. | Use current PNG and native scene paths for v1. Track these separately from the accepted scope. |
| `DEFER_TO_V2` | Training dataset curation, labeling, quality evaluation, model training and inference. | Draft an input provider boundary. Schedule this work only after an explicit Owner decision. |
| `RND_ONLY` | E7–E9 quality pilots, Character v4, pose and character art research, E10.1 reference pack and all provider/model experiments. E9.H1 found no meaningful art-quality gain. | Retain diagnostics and hashes. No new generators, promotion or threshold changes. |

The E10.1 audit reconciles 38 historical unstaged deletions. All 38 are present and tracked at the release base, all have historical references and 13 have explicit checksum or manifest protection. Preserve their paths and update navigation. The audit must also compare every file byte against the base.

[E10.0/E10.1 foundation](reports/E10-ART-DIRECTED-PRODUCTION-FOUNDATION.md) · [E9.H1 Closeout](reports/E9-H1-CLOSEOUT-ART-QUALITY-DECISION.html) · [Audit of the 38 reports](../benchmarks/results/e101/legacy-report-audit.csv)
