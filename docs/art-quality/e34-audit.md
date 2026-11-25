# E3.4 terrain art direction

Project Owner approved E3.3 engineering and production bake for static raster backgrounds. Final E3.3 artistic acceptance was **NOT APPROVED**, and E3.4 targeted refinement was approved. The brief records a preliminary production-quality score of about 3.65/5 from ChatGPT.

## Root causes

| Signal | Cause and controlled comparison |
| --- | --- |
| Large flat areas felt uniformly stippled | E3.3 sampled several glyph positions independently in each tile. Its quiet region skipped one attempt and both full-material samples on Large had zero unmarked tiles. A and B increase the number of deliberately empty tiles. |
| Dirt lacked material structure | In E3.3 the packed tint appeared in small stamps. E3.4 shapes the tint into separate irregular soil fields with smaller fallback crumbs and occasional short shadows or cracks. |
| Large shapes felt rectangular | The existing Large source is an orthogonal fixture. Organic uses the **same E3.3 renderer** for the baseline image and already reads as a road with a fork and uneven shoulders. The Organic tile bitmap comes from authored control points, widths, two shoulders and seeded offsets. It has 181 connected dirt cells and three exits. |
| Long edges felt repetitive | The two E3.3 one-pixel bank profiles still repeat at the contour scale. At native resolution, the identical Stress geometry keeps corners legible in all three versions. Organic's longest straight internal run measures 9 tiles and Stress's measures 6, so run length alone misses the difference. Changes in direction, width and connected spaces account for Organic's improved layout. Edge profile and canonical joins are shared by A and B. |
| Scenes needed room around props | E3.3's evenly distributed marks filled almost every full tile. The quieter path in both E3.4 variants keeps barrels, chests and the traveler readable. Storage puts props at the rear edges beneath the wall and keeps a central aisle. |

Organic still resolves to a cell grid. The boundary raster can move about one pixel inside a transition tile. A and B preserve the E3.3 bank and soil-exposure pass, including the one-pixel shared borders. [Gallery](../LumaSprite-Engine-E3.4-Report.html) · [Organic layout](../../benchmarks/results/e34/organic-layout.json)

## Micro, meso and macro

Both candidates share TerrainSpec v4, Pixel Core and the material stamp routine. Spec `direction` is `conservative` or `art-directed`. TerrainSpec v3 remains the plain CLI default while v4 awaits the owner decision.

- **Micro** marks are 1–4 pixels, placed beside a successful patch when there is room or rarely as a short fallback near a bank.
- **Meso** marks use hand-shaped grass tufts and irregular compact-soil stamps. A prefers smaller patches. B can place wider tufts and packed surfaces up to 24 pixels in an active tile. Sparse highlights and lower shadow marks use the existing ramps.
- **Macro** density comes from interpolated world-coordinate anchors across overlapping 7 × 9 tile regions. A gives more weight to tile-local variation. B gives more weight to the continuous field, leading to visibly populated zones and clear spaces. Placements stay deterministic for the same seed and absolute coordinates.

The Large fixture has 333 full-grass tiles and 335 full-dirt tiles. E3.3 paints detail in all 668. A leaves 84 grass and 87 dirt tiles plain. B leaves 127 grass and 78 dirt tiles plain. For grass, marked pixels change from 6,000 in E3.3 to 3,350 in A and 3,498 in B. For dirt, they change from 7,612 to 3,927 and 4,969. B places more dirt detail than A into wider packed shapes and leaves more grass at rest. Flat tiles reduce the count of distinct patches by design. Check the images at native scale to judge repetition of visible marks. [QA measurements](../../benchmarks/results/e34/qa.json)

V4 uses the same Authored and Project ramps as E3.3. Project keeps the E2 inks. The four-color Locked palette has zero grass/dirt midtone separation, produces a valid raster and reports `PALETTE_LIMITED`.

## Preliminary scoring for review

ChatGPT scores use Standard density with Authored or Project and the baked raster workflow. Inspect B first at native size for the broad grass zones and better-defined packed soil. A is the quieter alternative for mostly bare dirt floors. The Project Owner is responsible for the final choice.

| Criterion | A | B | Observation |
| --- | ---: | ---: | --- |
| Grass texture | 3.5 | 4 | B creates adjacent groups of tufts and long intervals of open grass. |
| Dirt texture | 3.5 | 4 | B reads as packed islands in Storage and Large. A's small marks still read more like scattered crumbs. |
| Boundary naturalness | 4 | 4 | Both retain the same contours. The stepped grid remains visible on long rectangular runs. |
| Visible repetition | 3.5 | 4 | B is less uniform at 1×. Recurring stamp silhouettes are visible at 4×. |
| Palette harmony | 4 | 4 | Approved prop ramps stay prominent. Locked is outside this assessment because it collapses terrain colors. |
| Props readability | 4 | 4 | Outdoor and Storage keep readable sprite silhouettes in the active path and aisle. |
| Map readability | 4 | 4 | The Organic crossing and branch are distinct in both renders. |
| Game readiness | 4 | 4 | Applies to the verified static raster workflow. Editable world detail is outside this score. |

Use the [owner review sheet](../../benchmarks/results/e34/review.md) to score both at 1×, inspect clusters and joins at 4× and record the final E3 decision.
