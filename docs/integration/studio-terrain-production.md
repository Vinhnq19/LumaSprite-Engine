# E3.3 production terrain in Studio

E3.3 uses **world-space map export**. Import `map.png` as a native-size single-frame PNG asset for the finished background. Keep the package together to reproduce or verify it in Engine. Use `atlas.png` with the canonical mapping for maps that need Studio's autotile editing and per-tile collision.

## Studio audit at `bb5c384`

| Surface | Engine world-space rendering | Studio static atlas rendering |
| --- | --- | --- |
| Tile IDs and atlas mapping | The 47 grass masks occupy IDs 1–47 in ascending canonical order. Dirt uses ID 48. Atlas is 8 × 6 at 16 px per tile. World detail depends on seed and absolute tile origin. | `src/studio/tilemaps.ts` validates the 48 canonical slots. Each slot has one rectangle and one collision value. |
| Autotile lookup | Diagonal neighbors count when both adjoining cardinals are present. All 256 raw masks normalize to the same canonical IDs as Studio. | `src/studio/terrain.ts` computes the slot. `MapStroke` in `src/studio/map-commands.ts` assigns the corresponding ID to each affected cell. |
| Serialization and collision | `map.json` stores the rows, origin, versioned TerrainSpec, row-major canonical IDs, dimensions, PNG/RGBA hashes, and overlay sources. | Project map layers reference one registered tileset and chunk resources with row-major Uint32 tile IDs. `pxl-map` v1 exports those IDs. Existing collision and saved map layouts use those IDs. |
| Texture and map layers | The sampler selects bank profiles and paints texture inside each tile. Optional sprite PNGs are composed in list order at integer pixel offsets. | `src/studio/tilemap-render.ts` draws the atlas rectangle for each ID and composites map layers by order, visibility and opacity. The map renderer has no per-mask variants, world seed/origin or world detail pass. |
| Import and export | Engine exports PNG/JSON, uses native resolution, and can reconstruct a baked package for exact byte comparisons. | The pixel workspace accepts PNG through `studio/pixel/read-png.ts` and the single-image import flow in `studio/pixel/app.ts`. `pixel-render.ts` exports PNG assets. `terrain-worker.ts` exports editable tilemaps to PNG or `pxl-map` JSON. Register the atlas to edit terrain. The baked manifest is read by Engine. |
| Save, reopen, backup and restore | Each fixture has a self-contained package. Overlays record provenance and expected bytes. | `PixelStore` persists documents, cels and chunk resources. The integration suite ran the real decoder, commands, exporters and backup methods on temporary Engine-side data. The browser import dialog was inspected in source. |

A variant atlas would need additional slots or indirection between masks and sample rectangles. The current validator and renderer would still resolve one atlas tile per mask, so this route would require a Studio change. World-space raster export preserves texture today and keeps the canonical atlas usable alongside it.

## Four fixed fixtures

| Fixture | Dimensions | Baked RGBA | Editable static RGBA | World vs static terrain pixels that differ |
| --- | --- | --- | --- | ---: |
| Large Grass/Dirt | 576 × 336 | PASS | MATCH | 29,414 |
| Transition stress | 288 × 176 | PASS | MATCH | 7,808 |
| Outdoor RPG | 416 × 224 | PASS | MATCH | 13,017 |
| Multiple regions | 512 × 288 | PASS | MATCH | 22,561 |

`BAKED_MAP_RGBA_PARITY_PASS` covers all pixels, including Outdoor props and traveler. `STATIC_ATLAS_RGBA_MATCH` covers grass and dirt using the same atlas. The latter scope has no props. All four fixtures also passed save/reopen and backup/restore. Tile ID, collision metadata, and the portable map version matched the checked contracts. Both comparisons were repeated after restoration. [Parity JSON](../../benchmarks/results/e33/studio/parity.json) · [Integration test](../../scripts/terrain-production-studio.ts)

The editable path reports **ENGINE_VARIATION_PASS / STUDIO_VARIATION_NOT_SUPPORTED**. To edit terrain now, change the Engine rows and rebake, or use the static atlas in Studio. If editable variation becomes a requirement, a separate Studio task can persist an optional versioned terrain render configuration on the map layer and share the same deterministic world sampler between preview and PNG export. Old maps can keep the existing atlas sampling path and their stored IDs.

## Reproduce

```sh
npm run build
npm run terrain -- --bake --spec benchmarks/results/e33/terrain-spec.json --map benchmarks/results/e33/map-input.json --out benchmarks/results/run/e33-cli
npm run terrain -- --verify benchmarks/results/run/e33-cli
npm run benchmark:e33
npm run test:terrain-production-studio
npm run report:e33
```

`--bake` accepts a world-variation spec and rectangular rows of `#` grass and `.` dirt. Origin is measured in tiles. Use an empty output folder or rerun with identical inputs. The CLI exports terrain only. The benchmark adds pre-approved sprites through the Engine composition API. Pass the PNG to the game as a 16 px grid-aligned background and use the separate canonical ID grid when tile semantics are required. [Packages and gallery](../../benchmarks/results/e33/README.md)
