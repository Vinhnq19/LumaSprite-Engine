# E2.3 generalized prop geometry

E2.1/E2.2 combined box projection, profile edges and materials in the chest and crate renderer. That implementation and its benchmark are checkpointed at `bcd47ca`. AssetSpec files without a finish field reproduce those pixels. The original E0–E1 supply-chest preset still uses its original renderer and saved Seed 42 and 43 files.

## Geometry and composition

| Shared Pixel Core operation | How the props use it |
| --- | --- |
| Project front, side and top faces with a depth and taper | Chest and crate share the same box volume |
| Extrude a stepped profile along a top face | Compact, Domed and Travel supply their own lid profile and attach it to the same front and side seams |
| Interpolate a normalized face position and fill a material region | Bands, wood patches, crate braces and travel hardware attach to their host faces |
| Sample ellipses and project a bowed round wall as integer spans | Barrel supplies the rim size, wall height and bulge |
| Layer compositing and one-pixel contour | Chest, crate and barrel derive flat, final and silhouette from the same occupied pixels |
| Top, front and side wood tones, iron ramps and light/shadow values | All presets use the authored ramp or its nearest inks in the locked palette |

Bounds are enforced by the shape schemas and the RGBA writer. The box projection and roof sampling contain no prop-specific hardware. Curved and flat props retain their own AssetSpec extension and layer order. The light direction for this slice is fixed to upper-left.

Barrel adds its own recipe for radial stave placement, the elliptical rim and two curved hoops. Flat boards use face coordinates. Barrel staves use the projected arc of a curved wall, with the right side in shadow. Barrel reuses the wood plane tones, iron ramp, span drawing, RGBA, shared outline pass and raster QA. Hoop placement and stave seams stay in the Barrel generator because they describe this object. The current recipe uses seven stave regions, two fixed hoop heights and a small seed-dependent rim grain.

## Refinement review

| Variant | Change in E2.3 | What remains to inspect |
| --- | --- | --- |
| A · Compact | One contiguous leading-edge highlight and a wider brass highlight | Lid readability against bright ground and keyhole size at 1× |
| B · Domed | More evenly sampled crown and softer bands of wood tone between strips | The step into the crown is still visible at 32×32 |
| C · Travel | Raised value in the front rail and front of the feet with side shadows retained | The base still reads heavy on dark terrain. This is the primary development candidate |
| Crate | Darker far side and narrower light edge on the diagonal brace | Thin brace pixels and front/side balance on bright ground |
| Barrel · Wide and Tall | Different rim widths, wall heights and side bulges with two projected metal hoops | On the tall version, the rim and upper hoop compete for a few rows at 1× |

Start with the original size for all comparisons. Compare 4× only to locate clusters and seams. The same background colors and scene renderer are used for the current previews. The gallery includes the E0–E1 seed and E2.1/E2.2 for comparison. [E2.3 gallery and review sheet](../../benchmarks/results/e23/README.md)

## Locked palette and E2.4

The locked palette still compresses dark wood and iron and can shift wood midtones toward blue. The local benchmark records the warning codes and both mapped ramps. Engine logs the same warning codes for v1 jobs. Both released previews and the diagnostic preserve the request's ink values.

For E2.4, review Travel and the two barrel proportions before promoting a default. Prototype an authored wood-and-iron preset in Studio's submit flow with a swatch preview. Send the user's selection in the existing palette field and preserve it through preview. A narrow palette should surface the existing compression diagnostics before submit in that future UI. [Palette and v1 contract](../integration/studio-adapter.md)

The art remains **PENDING_HUMAN_REVIEW**.
