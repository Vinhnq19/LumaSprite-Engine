# E2.5 palette policy

| Mode | Selection |
| --- | --- |
| Authored | Use each generator's native palette. E2's owner approval applies to the authored prop palette only. |
| Custom | Use the explicit project or artist color list to map every material role. |
| Locked | Use exactly the supplied inks. The Studio v1 request remains authoritative for the candidate. |

The six-digit RGB input is validated and normalized before rendering. Empty lists and duplicate colors are rejected. Nearest-ink mapping is deterministic, with ties retaining list order. It can collapse distinct material roles. The raster checks ensure the emitted opaque inks belong to the selected list. Transparent pixels use zero RGBA where the asset needs alpha. E3 grass and dirt tiles are opaque ground.

Structured diagnostics distinguish ramp compression, collision and loss of midtone value contrast. They compare each palette with the relevant authored material ramps and remain separate from RGBA validity and human review. The Studio four-ink sample compresses both ramps enough to make some terrain transitions unreadable. [Atlas diagnostics](../../benchmarks/results/e3/locked-atlas.json)

## Studio proposal

Offer the project's current palette and the **Wood & Iron** authored prop preset before submit. Show the swatches and contrast warning, preserve the chosen color order, and send the RGBA8 values through the existing request palette field. Keep the user's current palette for existing asset edits unless they choose a different compatible palette. [Wood & Iron preset and roles](../../benchmarks/results/e3/wood-iron-preset.json) · [Swatches](../../benchmarks/results/e3/wood-iron-swatches.png)

A future project palette can combine the approved Wood & Iron colors with the six authored grass and dirt ramp colors. Both sets currently render from their own source palettes. Native E2 sprites in the E3 scene retain their approved RGBA. [Terrain swatches](../../benchmarks/results/e3/terrain-swatches.png)
