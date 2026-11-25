# E4.2 character material architecture

B1 Grounded Surveyor is approved with notes as the geometry source for E4.2. The owner authorized this use by supplying the E4.2 brief. B2 stays available as a motion reference. The decision covers shape for this material pass. [Shape decision](../art-quality/e42-material-review.md) · [B1 Shape Lock](../../benchmarks/results/e42/b1-shape-lock.json)

## Rendering flow

1. Recreate the approved CharacterSpec v2 and exact geometry from checkpoint `58b2d4cb5180bd5935f1ab06fee79948b1170ece`. The benchmark pins the geometry digest and compares the three published B1 files byte for byte.
2. Validate the lock against the recreated plan. The verifier checks source digests, ordered topology, per-part geometry and alpha, landmarks, grip, both floor rows and pivot. The named masks reference the leg gap, hand/handle intersection, handle aperture and boot soles.
3. Route each pixel inside its part to a surface. Hair is a region within the head. Existing flat ink roles distinguish the brim, far jacket panel, metal and glass. Mask ownership and draw order come from the unmodified geometry.
4. Resolve ramps for the selected palette. Paint relative polygons through the shared `paintSurface` primitive, which fills a local integer-pixel patch and copies it only to the assigned indices. Composite in shape order. Both profiles use the existing E2 outline color, with selective lit-edge tinting in M2.
5. Verify alpha for every painted layer and the composite. Validate all visible inks and export the native final PNG, locked silhouette PNG, visible material mask and diagnostic JSON.

| Shared material behavior | Character-specific data |
| --- | --- |
| Relative surface planes, integer clipping, palette matching and binary alpha | Skin and hair within the head, shaded neck, cap and brim split |
| Ramp reuse and shadow, base, light and accent roles | Near/far coat and trousers, abbreviated folds, leather belts and boots |
| Edge selection from adjacent visible owners | Upper-left edging restricted to the locked contour |
| PNG integrity and repeatability checks | Lamp frame, glass and face highlights selected inside the approved part masks |

M1 uses compact fill planes and a uniform dark contour. M2 uses broader angular light planes, a separate recessed shoulder/arm fold, asymmetric leg folds and silhouette edges tinted only where the upper-left geometry exposes them. The glass core in M2 is nested inside a warmer colored border. Both styles use the same allowed authored palette and shape. The profile difference is paint placement and contour policy.

The Project palette keeps the complete authored character ramp and all E2/E3 project inks. Locked requests use only their submitted colors. The diagnostics identify compressed ramps and material base collisions. Raw material ownership is recorded by the labeled RGBA mask and legend, while the full per-part masks are verified against the lock. The renderer supports the current humanoid part convention and palette roles. A different anatomy or accessory layout needs a corresponding surface routing rule. [Core paint primitive](../../src/core/materials/surface.ts) · [Character material source](../../src/generators/character/materials.ts)

## Reproduce the material bundle

```sh
npm run build
npm run character -- --candidate b1 --material m2 --shape-lock benchmarks/results/e42/b1-shape-lock.json
```

Pass `--material-palette` with [Project](../../benchmarks/results/e42/palette-project.json) or [Locked](../../benchmarks/results/e42/palette-locked.json) JSON. With `--material`, B1 is the default candidate. Geometry-only CLI defaults stay the same. A changed shape needs a separate approval and its own manifest.
