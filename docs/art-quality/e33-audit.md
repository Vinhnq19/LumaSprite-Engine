# E3.3 terrain art audit

The E3.2 brief records Engineering **APPROVED** and **RECOMMENDED APPROVAL** from ChatGPT for art with Authored/Project palettes. The final Project Owner decision remains pending. E3.3 keeps the E3.2 scenes and places the same Outdoor props at the same offsets.

| Concern | Change in candidate | Evidence at 1× and 4× |
| --- | --- | --- |
| Grass marks felt evenly sized | Introduced small and medium tuft silhouettes and selected quieter 4 × 4 tile regions. Standard retains the same upper bound on placement attempts as E3.2. | Outdoor and Large contain broad fields between larger marks. Compare the density samples on the same Outdoor layout. |
| Dirt lacked material hierarchy | Added a lower-contrast packed-soil tone and varied the shape and footprint of packed patches. | Outdoor has more continuous ground behind the props. The dirt value changes are easier to read at 4×. |
| Long banks repeated one rhythm | Selected between two stepped profiles per axis using seed and absolute tile coordinates. Displacements stay within one pixel of the nominal cardinal edge and preserve the canonical outside pixel strips. | Large and Multiple regions show the differences along long boundaries. Stress isolates inner and outer corners. All masks and profile choices were tested with edge insets 2 and 3. |
| Palette crowded the background | Authored and Project keep three grass and four dirt roles. Project preserves the previous project palette and adds one packed-soil color. | Same Transition layout in all three modes. The four-color Locked palette still produces a technically valid export and reports `PALETTE_LIMITED` with four documented warnings. |

Large grass has 333 distinct full-tile patches in both E3.2 and E3.3. Dirt changes from 335 to 329 distinct patches. Neither benchmark had a byte-identical pair among the 624 adjacent grass pairs or 630 dirt pairs. This metric checks exact repetition, so visual review is still needed for the recurring shapes and stepped bank rhythm.

Standard remains the proposed default. Sparse is suitable for crowded scenes and Dense for deliberate use where the terrain carries more of the visual detail. I reviewed the native and enlarged images and recommend taking this candidate to final review with the Authored and Project palettes. The authored clusters are reused by design, while the editable static atlas repeats a single sample per mask. [Offline gallery](../LumaSprite-Engine-E3.3-Report.html) · [Palette and repetition QA](../../benchmarks/results/e33/qa.json)

## ChatGPT provisional scores

These are for E3.3 at Standard density with Authored and Project palettes. Game readiness covers the baked delivery path.

| Criterion | Score | Observation |
| --- | ---: | --- |
| Grass texture | 4/5 | Small marks and longer tufts break up the field. The same glyph shapes remain visible in large open areas. |
| Dirt texture | 4/5 | Packed patches are quieter than the E3.2 highlights and leave flatter areas under props. |
| Boundary naturalness | 4/5 | The stepped contours interrupt the sawtooth rhythm. Long banks still follow the tile grid. |
| Visible repetition | 4/5 | Neighboring patches vary at 1×. The recurring footprints are easier to spot at 4×. |
| Palette harmony | 4/5 | The two full ramps separate materials and keep the props prominent. The four-color Locked palette loses that separation and scores 2/5. |
| Props readability | 4/5 | The five prop silhouettes and traveler remain readable on the quieter path. |
| Map readability | 4/5 | Large regions read at 1× and the stress fixture retains legible corners. |
| Game readiness | 4/5 | A game can use the verified raster and canonical ID grid. Editable world variation in Studio remains unavailable. |

Project Owner to record scores for grass, dirt, banks, repetition, palette, props, map readability and game readiness. The proposed threshold is at least 4/5 on core criteria, with no severe seams or repetition at 1×. [Owner review sheet](../../benchmarks/results/e33/review.md)
