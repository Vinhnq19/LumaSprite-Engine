# Reviewing the first prop

Look at both final sprites at **1×** over a light and a dark game background. Compare the silhouette and flat-color view to the shaded version. Then inspect 4× for pixels that break the outline, isolated dots and inconsistencies in the light. [Benchmark gallery](../../benchmarks/results/sample/README.md)

| Criterion | Look for |
| --- | --- |
| Silhouette | A compact, readable closed chest with a curved lid |
| Shape | Clear lid and body volumes with believable straps |
| Material readability | Long wood clusters and short iron highlights |
| Pixel clusters | Intentional, contiguous shelf, grain and rivet marks |
| Outline quality | Clean steps around corners and a readable keyhole |
| Color harmony | Warm upper-left light against cooler iron and shadows |
| Artistic appeal | A coherent shape and a clear focal point on the lock |
| Game readiness | A readable 32×32 sprite over the target game backgrounds |

Record each criterion and a short revision note. Set `ARTISTIC_PASS` or `NEEDS_REFINEMENT` after review. The benchmark starts in `PENDING_HUMAN_REVIEW`. Its technical diagnostics report objective results independently.

## Studio locked palette

| Preview 1× | Preview 4× |
| --- | --- |
| ![Chest with Studio's locked palette at native size](../../benchmarks/results/sample/studio-locked-1x.png) | ![Same Studio candidate enlarged with nearest-neighbor](../../benchmarks/results/sample/studio-locked-4x.png) |

Studio's default unmasked request uses transparent `0x00000000` and four opaque inks `#1c2434`, `#536da0`, `#f7ba5b` and `#eaf1f7`. Its limited warm tones collapse wood shades and give parts of the chest a blue cast. The local benchmark preserves the authored wood, iron and brass ramps. Both layouts share a front-facing silhouette with minimal perspective, and the main visible seed variation is strap spacing and lock position. These are the first candidates for review.
