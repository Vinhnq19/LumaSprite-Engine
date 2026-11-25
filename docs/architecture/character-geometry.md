# E4.0 Character geometry architecture

The E4 pilot generates 64 × 64 static humanoid geometry facing right in 3/4 view. [CharacterSpec v1 schema](../../src/specs/character.ts) · [Compact spec](../../benchmarks/results/e41/a-spec.json) · [Tall spec](../../benchmarks/results/e41/b-spec.json)

| Step | Input and output |
| --- | --- |
| Parse CharacterSpec | Validates the exact canvas, view, palette selection, seed, body and gear extents, hip position, torso lean, joint positions, planted foot and ground pivot. |
| Solve the humanoid plan | Derives proximal landmarks from the hip and torso width. Resolves explicit elbow, wrist, palm, knee and ankle coordinates into connected limb segments. Emits the shapes of all 20 parts, 21 landmarks and 20 links in geometry JSON. |
| Rasterize ordered regions | Fills shared integer pixel spans and polygons. Tapered round-ended limb segments share the same endpoints across adjacent parts. The far limbs and satchel lie behind the body. The lantern goes above the near sleeve, and the near hand sits over its handle. |
| Validate geometry and export | Measures each region and the silhouette, tests raster overlap at 12 body joints, checks the support projection and negative space, and confirms the palm and lantern masks overlap at the saved grip anchor. Writes flat PNG, silhouette PNG and geometry JSON with hashes. |

The named pilot view and pose select the anatomical topology and depth rules. The spec supplies measured points and region dimensions. Keeping valid joint connections and part order in the solver means saved poses can vary proportions or move joints without substituting a different renderer. Pose validation rejects inverted limbs, an unsupported standing position or clipped parts. A small cap-crest choice reads the seed. Both pilot specs use seed 42 and the same palette, so their differences come from proportions and pose.

## Pixel Core reuse

- Geometry uses `fillPolygon`, span clusters, ellipse projection and rectangle faces. Joint segments add pilot-specific tapered envelopes around the endpoints.
- Composition uses the existing ordered rasters, binary alpha, silhouette and contour code. Native and nearest-neighbor images use the shared PNG and raster routines.
- Palette selection resolves authored, custom or locked colors through the existing nearest-ink mapper. Flat fills identify parts and depth. Material ramp rendering belongs to the next stage.
- QA uses the shared PNG decode and hash checks and adds humanoid rules that examine both part masks and the composited raster. Geometry B and A are dispatched through the same entry point.

Shape regions stay open to owner edits during this stage. The bundle records the masks' geometric shapes and pixel-space anchors so a subsequent review can define which regions to protect. There is one topology, one holding hand, one instrument silhouette and a fixed view. Occlusion is a fixed drawing order with far-side foreshortening. Balance checks project the torso and head pixel mass horizontally onto the planted boot. A constrained 64 × 64 canvas can reject a combination of valid independent dimensions once the full pose is solved.

## Studio boundary

The current Engine job adapter serves its existing prop requests. CharacterSpec is an offline review input. The integration test at Studio `bb5c384` projects the geometry into an **unapproved CharacterProfile v1** with standard PNG RGBA, source resource, 20 binary part masks, 21 authored landmarks, links and pivot. Studio's decoder, profile validator, PixelStore and PNG exporter validate the data end to end. Pilot artifacts include layout and anchors in portable JSON for review. [Studio contract test](../../scripts/character-studio.ts) · [Technical evidence](../e41-test-report.md)

E4.2 is the owner-approved silhouette's next material pass, including a stable lock and separate fabric, leather, boot and lamp treatment. E4.3 can test gameplay scale, outfit readability and export after that pass. Today the hand and foot crops are structural evidence, and the scene composites are a scale preview.
