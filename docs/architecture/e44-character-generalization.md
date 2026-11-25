# Character generalization after E4.4

[Geometry audit](../art-quality/e44-geometry-audit.md) · [Revision evidence](../../benchmarks/results/e44/revision-comparison.json)

| Audit point | Current behavior |
| --- | --- |
| Shared v2 and v3 | Both use the versioned schema, a 64 × 64 canvas, absolute-pixel joints, proportions, segment/oval/polygon primitives, ordered masks, a contour pass, palette mapping, contact and balance checks and a deterministic RGBA renderer. |
| Pose reuse | The shared tapered segment constructs every limb. Shoulder and hip projection, sole placement, knees, planted balance and silhouette margins use the same solver. V2 supports hold and forward step. V3 supports a free-standing pose. |
| Material regions | Part IDs and authored flat inks assign the material surfaces. The renderer applies the same bounds-relative patches and does not route by character name. Leather geometry may mark an owned seam with the contour ink, which resolves to the mapped leather shadow. |
| Attachments | V2 has a handheld lantern and cap topology. V3 has a hood and a crossbody strap-to-satchel attachment. Their attachment checks and depth order are explicit. A new equipment topology needs its own point, mask, order and contact rules. |
| Configurable geometry | Proportions and absolute limb landmarks are spec fields. The optional revision record accepts face opening and torso-plane offset. V3 also accepts crossbody offset and flap geometry. The bounds are schema-validated. |
| Hardcoded geometry | Cap, hood, boots, lantern and bag still use small fixed polygon recipes relative to anchors. Hair coverage uses relative head bounds. The fixtures remain within one stylized right-facing humanoid family. |
| Surveyor-specific rules | Lantern grip, grip depth, handle opening and body clearance belong to the holding profile. V3 checks hood and strap connections. Shared Pixel Core is independent of both. |
| E5 prerequisites | Record the owner-selected shape, palette, intended actions and import scale. Specify per-frame joint ownership and depth changes, fixed grip behavior, root/pivot convention, contact and timing tests, and silhouette continuity. Validate those against the chosen profile before authoring any animation. |

A geometry revision keeps its CharacterSpec major version and adds a revision number to the spec and shape lock. Each package records the E4.3 checkpoint, parent lock path description and SHA-256. R2 references the R1 lock. The package verifier rebuilds the part geometry and all eight files. The original B1 and original Courier locks continue to verify. [Package index](../../benchmarks/results/e44/README.md)
