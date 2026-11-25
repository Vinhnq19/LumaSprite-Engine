# Open-source R&D preparation

Use W2 Expressive Walk as the research reference at Engine checkpoint `ea62de7`. Keep W1 Conservative Walk as the control. Both use Field Surveyor R2 + M2P and the same 64 × 64 canvas, pivot, palette and view. The Project Owner accepted E5.2 engineering. Walk Game-Ready Final Acceptance remains pending. [W2 timing and root](../../benchmarks/results/e52/w2/package/timing.json) · [W1 timing and root](../../benchmarks/results/e52/w1/package/timing.json) · [Frozen hashes](../../docs/e52-benchmark-sha256.txt)

## Data boundary for an experiment

1. Pin the approved R2 manifest, W2 manifest and both animation timing files by SHA-256. Set an experiment ID, seed and expected measurements in its report.
2. For ideas that fit AnimationSpec v2, supply an isolated spec file to the current animation CLI. Keep the input spec and report in this research area. Write generated PNG/JSON to the ignored run directory.
3. For a future alternative gait solver, the integration seam is structural joints and contact. The existing solver takes a verified CharacterSpec and a validated key pose, and returns a pose plus GaitPose. A research-only adapter can feed this shape to the existing character renderer and check the resulting frame geometry. Export a versioned sidecar that preserves per-frame duration, root advance, world contact samples and phase IDs. Full package verification will require a separately approved spec/solver version if the alternative cannot be represented by current v2 keys.
4. Compare W1, W2 and the experimental output side by side using the same camera, scale, colors and lighting. Record ankle and knee trajectory, planted world deltas across the wrap, contact depth, grip pixels, stable-part paint, timings and native 1× playback. Measure time and memory with the same inputs and Node version. Confirm exact regeneration on two runs.
5. Keep imports from experiments pointed toward Engine and shared fixtures. Production entrypoints continue to load the approved solver. Keep frame-stepped root synchronized with frame changes and report a separate target-game run when a supported runtime becomes available. [Architecture seam](../../docs/architecture/e52-walk-motion.md) · [Studio timing contract](../../docs/integration/e52-walk-studio.md)

## Research streams

| Stream | Question | Evidence to collect |
| --- | --- | --- |
| Gait and articulation | Does an alternative joint or contact solver improve weight transfer and silhouette at 1×? | Root displacement, support windows, ankle/knee motion, grip and wrap before visual scoring. |
| Raster and silhouettes | Does an integer-pixel technique improve edges or clusters under the same geometry? | RGBA, palette membership, changed mask locations, contour continuity and PNG regeneration. |
| Color science | Does a ramp or metric improve the dark-scene read without changing material goals? | Exact source colors, contrast by region, palette-lock behavior and side-by-side previews. |

## Provenance record for a source review

Record the exact upstream URL, commit hash, license path and license text at that revision. Record the file or method being studied, copyright notices, dependency licenses, any separately licensed assets and the reviewer’s decision. Describe whether the proposed use is a conceptual reference, a clean implementation or a future code import. Confirm upstream MIT status from the source before any reuse. Store only evidence needed for the review and place experimental outputs under `benchmarks/results/run/`. Create source-specific folders when there are reviewable records.

R0 establishes the comparison protocol. The next decision is which source revision and hypothesis the Project Owner wants reviewed. Approval for a source review and approval to integrate code are separate decisions. [R0 audit](../../docs/r0-project-audit.md) · [Project roadmap](../../docs/roadmap.md)
