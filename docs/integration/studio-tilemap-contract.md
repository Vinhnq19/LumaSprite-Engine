# E3.0 Studio tilemap contract audit

Checked the local Studio source and actual model at `bb5c384`.

| Boundary | Verified behavior |
| --- | --- |
| Atlas | Studio supports 16×16 or 32×32 tiles in a fixed 8×6 atlas. E3 uses 16×16 and emits a 128×96 RGBA PNG. |
| Adjacency | The cardinal bits are N=1, E=2, S=4, W=8. Diagonals are NE=16, SE=32, SW=64, NW=128. A diagonal survives only when both adjacent cardinals connect. |
| Mask and ID | Atlas slots 0–46 follow ascending canonical masks. Studio's registration gives IDs 1–47. Slot 47 has mask null and receives ID 48. Map cell ID 0 means unpainted. Studio excludes mask-null tiles from autotile membership. E3 uses that tile for Dirt Center. |
| Corners | Both cardinals absent produces an outer corner. A single missing cardinal produces a straight edge. With both present, a missing diagonal creates an inner corner. |
| Collision | Studio supports empty, solid and one-way tile metadata. Its registration defaults the first 47 slots to solid and the spare slot to empty. E3 explicitly marks the ground tiles empty for walking. |
| Atlas source | The internal tileset stores an asset ID, frame ID and rect positions. Studio validates tile size, mask order, unique IDs and the registered source dimensions on reload. |
| Map and chunks | Maps are 1–256 cells per side and up to 16 layers. A map uses one tile size. Layer metadata includes tileset ID, visibility, lock and 0–255 opacity. The store uses sparse 32×32 chunks containing row-major Uint32 tile IDs. |
| Composition | Studio composites the registered atlas frame then renders visible map layers in order. Zero-alpha samples are skipped. RGBA and layer opacity drive blending. |
| Export | Studio's terrain worker emits `pxl-tileset` JSON and a PNG ZIP, and map PNG/JSON/ZIP. Studio's exported `pxl-map` nests tileset metadata and row-major chunks. Engine's JSON is a standalone atlas manifest with coordinates, seed and SHA-256. |

The Engine builds terrain pixels, the atlas and benchmark maps. Studio places and edits tiles in project maps. [Engine atlas manifest](../../benchmarks/results/e3/atlas.json)

## Preview the atlas in Studio

Studio can import the atlas PNG as one native 128×96 asset. Keep frame splitting unchecked. The current UI does not offer a standalone Engine manifest importer, and the v1 External Engine transport only recognizes character, prop and icon. The Engine HTTP capabilities stay unchanged.

To open a fully registered preview map, run this against a sibling Studio checkout and use **Mở sao lưu** in Studio on the extracted folder containing `pxl.project.json`.

```powershell
$env:LUMASPRITE_CAPTURE_TERRAIN_BACKUP = '1'
npm run test:terrain-studio
Remove-Item Env:LUMASPRITE_CAPTURE_TERRAIN_BACKUP
```

The command writes `benchmarks/results/run/e3-studio.zip` from the actual Studio backup serializer. It validates the atlas hash, all 256 raw mask mappings, registration metadata, map pixels and restoration before writing the ZIP. Its temporary project roots are inside Engine's ignored cache. Studio assigns snapshot IDs, so the generated backup is a preview artifact separate from the byte-reproducible benchmark.

A future Studio integration can add explicit external atlas registration, a preview with collision selection and manifest format negotiation. The current PNG and JSON are the MVP exchange surface.
