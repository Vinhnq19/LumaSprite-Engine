# E3.2 terrain shape, material and variation audit

The Project Owner approved E3.1 engineering and requested art refinement after reviewing the HTML, atlas and map previews. That decision applies to checkpoint `ad7cdbc`. Its atlas, mapping, QA and report remain the historical record. E3.2 artwork is **PENDING_HUMAN_REVIEW**. [Before/after report](../LumaSprite-Engine-E3.2-Report.html)

## Shape

E3.1 uses the four quadrant neighborhoods of a canonical mask to derive straight banks, inset corners and a one-pixel shadow. E3.2 TerrainSpec v2 still evaluates the same quadrants. The edge profile offsets a bank by up to one pixel over short runs. Extra beveling around the interior corner creates diagonally stepped joins. Receding grass can expose a narrow darker soil strip. Border pixels take the original distance rule, so both insets keep the E3.1 edge signature with the same palette.

Tests verify that grass remains a connected region in every mask, both edge insets move actual contour pixels, and the 47 tile IDs, rects and raw-mask rules stay fixed. The atlas's straight stretches still repeat the same short profile. Natural shape changes are bounded to the interior of each tile. [Atlas mapping](../../benchmarks/results/e32/atlas.json)

## Material clusters and variation

Grass uses four designed shapes for tufts, short blades, highlights and dark clumps. Dirt uses four compact soil shapes. Each group has connected value clusters. A candidate fits entirely in its material, clears the bank and outer row, and leaves space around accepted groups. The seed and absolute tile coordinates select a group and its anchor. Sparse, Standard and Dense use progressively more placement attempts. Counts can vary with the available interior space.

The canonical atlas uses one fixed placement per tile. Engine map rendering uses the same bank then paints the chosen clusters for each world position. It records the seed, map rows, absolute tile origin and TerrainSpec. Independent views of the same tile IDs agree at the same world coordinates. The method fills neither the boundary rows nor the narrow grass lips with decorative pixels.

| Region of scene B | Measured center tiles | Distinct 16×16 RGBA blocks | Identical adjacent pairs at 16 px |
| --- | --- | --- | --- |
| Grass | 333 | 1 → 333 | 624/624 → 0/624 |
| Dirt | 335 | 1 → 335 | 630/630 → 0/630 |

Counts describe seed 42, Standard density and origin `[-17, 24]` on the authored scene B. The same intentional shapes may appear across a large world. Their placements and group combinations vary, while Studio's static atlas still repeats placements. [Repetition and seam evidence](../../benchmarks/results/e32/qa.json)

## Scene and palette observations

- **A · Outdoor RPG.** Five approved prop PNGs and the existing CC0 traveler appear at identical pivots in both versions. Standard adds readable texture without hiding the silhouettes. Sparse is a useful option around props. Dense can make a large background busier.
- **B · Large terrain.** Both material fields show varied texture at 1×. Some straight stretches still show a regular rhythm in the bank shape.
- **C · Stress.** Long horizontal and vertical edges, holes, interior corners, outside corners, narrow strips and diagonal adjacency share the same rules.
- **D · Palette.** All three variants share the identical map, seed, detail density and origin. Project Palette adds a subdued terrain ramp while retaining every approved Wood & Iron color. Midtone brightness gaps measured 11 for authored, 12 for project and 0 for the four-ink locked list. The locked atlas and map use only that list and report **PALETTE_LIMITED**.

Use the four scenes and three density views for art review at game scale. This pass tests the style with the existing 32×32 props and reference character. [Owner review sheet](../../benchmarks/results/e32/review.md) · [Project Palette proposal](../../benchmarks/results/e32/project-palette.json)
