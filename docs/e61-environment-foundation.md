# E6.0–E6.1 · Environment Art Foundation

**E6_1_READY_FOR_HUMAN_ENVIRONMENT_REVIEW**

RPG Field Outpost uses nine reusable kit components, E3.4 terrain, E2.4 approved props and locked E4/E5 figures. Front Court and Roadside share the same code and profile. Both layouts have an A/B day and night pair at native 320×208. Final art selection remains with the Project Owner. [Offline A/B and review sheet](LumaSprite-Engine-E6.1-Report.html) · [E5 Final Acceptance](e5-final-acceptance.md)

## E6.0 architecture and art audit

Earlier scenes composited approved props and figures on a flat terrain bake. Props had no shared façade, approach, or entry threshold to explain where they belonged. Large quiet ground patches were useful for silhouette contrast, but there was no architectural tier to lead the eye. The critical gap was spatial relationships among the approach, pad, wall, doorway, props and actors. The pilot establishes those relationships with a small structure and explicit occlusion. Surface detail stays attached to material planes.

| Existing system | Reuse in E6.1 | Boundary |
| --- | --- | --- |
| E2 prop generator | Approved crate and tall barrel PNGs. The bench uses Core's box projection and face-patch functions. | The approved prop renderer and art remain frozen. Prop footprint and visual size are separate. |
| E3 terrain generator | Pinned E3.4 B manifest, Blob47 mapping and seeded world rasterization. Each layout supplies its own grass/dirt rows. | The approved E3 package stays unchanged. New paving is an environment layer. |
| E4 character production | Exact R2 and E4.4 PNG bytes, 64×64 cells and attached ground pivots. | Actors contribute source RGBA and native scale. Their body parts have no new material treatment here. |
| E5 animation | Acceptance and production lock preserve Idle/W2/Courier, contacts and method A. | E6.1 poses are still frames. E5 animation ownership stays with its existing pipeline. |
| Pixel Core | Polygon fills, face patches, box projection, binary-alpha compositing, nearest-neighbor scaling and PNG round-trip. | Environment assembles the same raster type and palette ink codec. |
| Terrain and scene export | World map origin/rows, raster PNG, manifest hashes and native placement metadata. | Environment adds kit rectangles, anchor/door coordinates, collision polygons and owner masks. |
| Studio Adapter | Studio's PNG decoder, pixel document persistence and PNG export. | The Engine adapter advertises props. Studio keeps editing, version approval and scene placement. Environment editing and sidecar import are E8 backlog. |

[Pixel Core](../src/core) · [Terrain bake](../src/generators/terrain/baked.ts) · [Studio capability contract](../src/adapters/studio/contract.ts)

## Art Style Profile v1

The profile pins the E2–E5 right-facing three-quarter presentation, 16 px tiles, 32 pixels per unit and native 64×64 actors. The right return rises 8 px over 16 px, using the same projected rise rule as the E2 box. The upper-left key light brightens the top/left planes. The stone front, dark right return, slate roof and warm wood trim form the building hierarchy. A cooler night ramp keeps the same light direction and adds a small warm, hard-edged reflection near the lamp in B. E3 grass/dirt retains its day palette. At night its terrain inks map by material role. Imported props and character PNGs keep their source inks in both conditions.

A uses broad planes and smaller hard contact bands. B adds broad roof courses, staggered masonry, restrained paving clusters and an upper-left cast offset of 5×4 px. Large forms read before the six-pixel detail span. Single-pixel highlights are limited to rims, fasteners or bright edges. Contour ink is concentrated in the doorway and recesses. Lower planes use dark material tones with no smooth gradient or partial alpha. Warm metal on the compass, lamp and workbench anchors attention near the approach. [Executable profile](../benchmarks/fixtures/e61/style-profile.json)

## EnvironmentSpec and reusable kit

Version 1 validates project-relative asset references with SHA-256 and reads the profile by digest. The spec contains terrain rows and their world origin, one façade module sequence, the path polygon, sign bay, seed and anchor-based placements. The library derives the wall/window/door modules, right return, roof, column, compass sign, lamp and workbench. Published atlases contain nine native pieces, placement pivots, material masks and their RGBA/alpha hashes. Roof spans derive from the number of façade bays.

- Front Court uses seven bays, a left approach and both actors in front of the shell. Roadside uses six bays, a right approach and a Courier stance slightly behind the east return.
- The two finishes share every atlas cell's silhouette and pivot, collision polygons, façade attachments, scene placement and layer order. Day pairs differ by 1,572 and 1,348 pixels respectively. Night pairs differ by 1,583 and 1,381 pixels. Differences stay in surface paint, contact shadows and the localized warm reflection.
- Eight packages expose scene PNG, actual integer 4× PNG, material and ownership masks, collision overlay and raw collision raster, atlas, fixture/profile and manifest. Scene order is ground, path, contact, then y-sorted objects at their ground anchors. Layer ownership records actual visible pixels after composition.
- The continuous route at the center of each 10 px threshold was tested across the jamb boundary. Side and back walls and prop silhouettes use explicit ground collision polygons. Door pixels are drawn as a shadowed recessed entrance. A complete interior and roof cutaway are follow-up scope.

[Front Court EnvironmentSpec](../benchmarks/fixtures/e61/front-court.json) · [Roadside EnvironmentSpec](../benchmarks/fixtures/e61/roadside.json) · [Kit atlas metadata](../benchmarks/results/e61/packages/front-court-b-day/kit.json)

## Lighting, orientation and read at 1×

| Layout | Seams checked | Collision polygons | Native actor visibility |
| --- | ---: | ---: | --- |
| Front Court | 210 | 14 | Surveyor 1072/1072, Courier 997/997 |
| Roadside | 180 | 13 | Surveyor 1072/1072, Courier 848/997 |

Roadside's nearer building return hides 149 Courier pixels by design. The source sprite, footprint and reference pivot remain exact. The character stays readable beside the return at 1×. Front Court's Surveyor was moved forward during review so the doorway and lamp stay visible. All components still use one camera/profile and both layouts use the same compositor.

ENV-B is the proposed candidate for human review. Shingle courses, contact bands and different front/side values clarify the structure. ENV-A remains a quieter control. Some base tones remain close in luma, especially roof and metal. The diagnostics flag seven near pairs by day and eight by night at the selected threshold, with zero exact same-ink architecture ramp collisions. Use the native scenes to judge whether these boundaries remain clear. The mask colors identify regions and do not represent the approved art palette. [Palette and occlusion comparisons](LumaSprite-Engine-E6.1-Report.html#qa)

## Technical regression

- Engine lint, typecheck, build, CLI smoke and 68/68 tests passed. The two focused E6 tests cover reused geometry, occlusion, native alpha and exports, plus invalid paths, provenance, missing doorway and detached approaches.
- The CLI regenerated and verified eight packages. All 104 payload checksums matched. Versioned styles and fixtures are pinned and both geometry and raster are regenerated when verifying a package.
- Existing E2.4, E3.4, E4.4, E5.1 and E5.2 benchmarks regenerated 361 exact outputs. All 805 historical checksums, 50 E5.3 artifact hashes and 54 R&D hashes matched. The E5.4 Unity proof was rechecked with the same six pixel-exact captures. E6 evidence is a raster benchmark.
- Studio `bb5c384` preserved exact RGBA after PNG import, save/reopen and export for two scenes and a transparent atlas. E5.4's four animation clips passed the existing integration again. EnvironmentSpec, collision and editing layers remain Engine sidecar data. [Studio PNG parity](../benchmarks/results/e61/studio-parity.json) · [Benchmark SHA-256](../benchmarks/results/e61/benchmark.json)

```powershell
npm run build
npm run benchmark:e61
npm run environment -- --verify benchmarks/results/e61/packages/front-court-b-day
npm run test:environment-studio
npm run report:e61
```

The default benchmark path is `benchmarks/results/run/e61`. The published packages are under `benchmarks/results/e61/packages`. From the Engine root, the CLI can also build a single package using `--spec`, `--out`, `--finish A|B` and `--lighting day|night`.

## PR draft and proposed E6.2

**E6.1 · RPG Field Outpost Environment Kit**

Record the bounded E5 acceptance and add the EnvironmentSpec, versioned art profile, nine-part kit and verified export pipeline. Compare Functional and Art-Directed paint on two placements of the same kit in daylight and dark. The native gallery includes the owner rubric and diagnostic overlays.

After the owner selects a treatment, E6.2 can test scene composition through a deliberate foreground, midground and background arrangement with a walkable route and clearer destination cues. Hold the approved scale and palette, reuse the accepted kit, and test any placement or lighting changes one at a time. E8 can consider paired PNG/sidecar import and editable scene placement. DeepSeek remains owner-gated after E8. [Handoff](../HANDOFF.md)
