# E8 Integration Backlog

E6.4 verified native UI PNG import and an offline bridge through the existing Studio v1 animation codec. Studio persisted frame pixels, delays, pivots and one-shot tags for the two VFX sheets. [Parity evidence](../../benchmarks/results/e64/studio-parity.json)

Future integration work for E8, subject to owner approval:

- Negotiate supported UI/VFX package types and map manifest IDs to Studio assets and asset versions.
- Preserve the association between Normal and Active icon states, the E2 source reference and the output approval history.
- Import and re-export timing sidecars, RGBA strips, pivots and straight one-shot or repeat tags without changing frame data.
- Let Studio reference signal and pickup anchors in scene composition while retaining per-scene provenance, light pass and collision references.
- Present 1× and 4× views, state and frame controls, masks and the human review record in the asset workflow.
- Verify published exports in the target runtime during integration and record its exact import and playback scope.

The Engine authors and verifies specs, geometry, palette, frames, QA and export packages. Studio owns editing, preview, approval, asset management and scene composition.
