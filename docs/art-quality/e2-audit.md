# E2 prop quality audit

The Project Owner approved the engineering baseline at commit `368c8eb` and marked the original art **NEEDS_REFINEMENT**. Seed 42 is the comparison baseline. Seed 43 remains the control. The original PNGs and their saved AssetSpecs stay under `benchmarks/results/sample/`. [Baseline PNG hashes](../../benchmarks/briefs/e0-e1-png-sha256.txt)

## Shape system

The legacy generator placed body, lid, grain, straps and lock at absolute canvas coordinates. Seed parity moved some fittings while preserving the silhouette. The right-hand face was drawn as a dark patch inside the front-facing body, which gave little indication of real depth at 1×.

E2 derives front and side faces from width, depth, height and the chosen lid profile. A common seam anchors the lid and front hardware. The base follows the body's lower edge. Bounds, minimum depth, minimum lid rise and clearance between bands and lock are validated in AssetSpec. A four-neighbor one-pixel contour joins the silhouettes of the layers.

| Design | Structural distinction |
| --- | --- |
| A · Compact | Low flat lid, rectangular body, short straps and an open front panel |
| B · Domed | Raised sectional lid with rolled shoulders, deeper visible side and full straps |
| C · Travel | Beveled lid, tapered front, projecting iron feet and side hardware |
| Crate | Square volume, diagonal wooden brace and metal corners |

The crate reuses the same front and side geometry, face interpolation, material shading, contour and palette mapping. It exercises wood and iron with a brace in the focal region. E2 itself requires one prop-specific composition schema. A second prop family should determine which of its dimensions belong in shared geometry.

## Material system

The legacy chest renderer painted horizontal spans in screen space. Its ramps were reusable, while application depended on the chest's exact outline. In E2, a wood patch is measured along a face. Grain follows that face's horizontal axis, lower edges shade with the plane, and upper surfaces read lighter. The seed moves a small grain cluster while the preset determines the silhouette.

Iron plates have a shadow edge and a short light cluster at lit turns. Body straps, rails and corner feet use the same plate rule. The brass latch occupies a small area across the seam, with a dark keyhole and a warm upper-left edge. Dedicated rivets were left out at 32×32 to preserve the main metal clusters.

## Palette lock and E2.3 proposal

The authored ramps keep separate wood and metal tones. Studio's four-ink default maps the wood midtone to blue and collapses both shadow ramps. The renderer reports `WOOD_RAMP_COMPRESSED`, `IRON_RAMP_COMPRESSED` and `WOOD_IRON_INK_COLLISION` when relevant. Ink selection stays within the supplied palette. Benchmark reports include both mappings, and HTTP jobs write warning codes to the Engine log. The Studio v1 JSON response retains its existing shape.

For a future Studio integration, expose a palette choice before submit. Offer the authored wood-and-iron preset in addition to the user's locked palette, show a swatch preview, and freeze the selected inks in the request. Show a warning when the wood and metal ramps compress. A selected palette remains authoritative during rendering.

## Visual observations for the owner review

- A's hardware is subordinate to the wood panel. Its shallow lid may need a clearer leading edge against a bright floor.
- B has the broadest visible side and highest lid. The ridge still reads stepped at 1× because there are few pixels across the curved profile.
- C's dark lower reinforcement adds weight, especially on a dark background. Review the feet and side handle together before lightening either.
- The four locked inks still merge parts of the wood and iron on all designs. Review the authored and locked versions independently.

E2 candidates are **PENDING_HUMAN_REVIEW**. Review 1× before 4× and use the light, dark and tile scene views to score the seven core criteria. [Benchmark and review sheet](../../benchmarks/results/e2/README.md)
