# E3.2 Studio compatibility

Verified at Studio `bb5c384` using the read-only source and the actual map store, renderer and backup importer.

| Capability | Evidence and E3.2 impact |
| --- | --- |
| Tile IDs and variants | `tilemaps.ts` fixes the atlas to the ordered 47 masks plus slot 48. A slot has one ID. `MapStroke.set` chooses the fixed slot for the resolved mask. There is no per-mask seed or variant selection in this path. |
| Decoration layers | `MapLayer` references one tileset and stores tile IDs in chunks. The renderer supports layer order, visibility and opacity. There is no coordinate-generated layer in that renderer. |
| Atlas variants | Multiple tilesets can exist as different assets. A layer renders the registered atlas. This is not automatic variation within one tile. |
| World-space map preview | Engine TerrainSpec v2 has a separate map output. Its procedural details are baked into the preview PNG using the saved world origin. Studio sees the canonical atlas and IDs only. |
| Native import | The existing importer can read the PNG atlas as an asset. The optional verification fixture constructs the registered map with real Studio functions and produces the existing Studio backup format. |

The E3.2 atlas uses the same 128×96 canvas, mask order, collision values and IDs as E3.1. Its export records the static atlas placement and the map detail mode. Both E3.1 and E3.2 pass registration, all 256 masks, authored map pixel comparison and backup restoration. Studio HTTP v1 retains its existing contract.

To produce the E3.2 Studio preview archive from Engine with a sibling Studio checkout:

```powershell
$env:LUMASPRITE_TERRAIN_EDITION = '32'
$env:LUMASPRITE_CAPTURE_TERRAIN_BACKUP = '1'
npm run test:terrain-studio
Remove-Item Env:LUMASPRITE_TERRAIN_EDITION,Env:LUMASPRITE_CAPTURE_TERRAIN_BACKUP
```

Extract `benchmarks/results/run/e32-studio.zip`, then open its folder through **Mở sao lưu**. This archive previews the static E3.2 atlas. The benchmark's map PNGs show Engine world-space detail. [Atlas metadata](../../benchmarks/results/e32/atlas.json)
