# Engine CLI and API

Use `npm run <script> -- <arguments>` from a source checkout or call the matching `node dist/cli/<command>.js` from the Windows review ZIP. Set explicit output paths. Review assets at native size.

| npm script | Entry point and primary flags |
| --- | --- |
| `generate` | `main.js` with `--seed <uint32> --out <png>`, or an existing `--spec <json>` |
| `component` | `component.js` with `--help`, build, revise or verify as shown below |
| `terrain` | `terrain.js --spec <json> --map <json> --bake --out <directory>` or `--verify <directory>` |
| `character` | `character.js --spec <json> --out <directory>` or `--verify-package <directory>` |
| `animation` | `animation.js --source <character-package> --spec <json> --out <directory>` or `--source <character-package> --verify <directory>` |
| `environment`, `composition`, `pixel-effects` | Versioned JSON input and a named export directory. See the [integration and spec index](README.md). |
| `serve` | `node dist/server/main.js --port 4399`. Listens on `127.0.0.1`. See the [Studio contract and routes](integration/studio-adapter.md). |

## Artist-authored PNG or components

Put `component.json` in a directory with `layer-<id>.png` and `layer-<id>.mask.png` for every layer. A single image uses one layer. Use one shared canvas between 1 and 128 pixels on each axis with non-interlaced, 8-bit RGBA PNGs. Transparent pixels are RGBA zero. Opaque pixels use only the declared shared palette. Each ownership mask uses opaque white for every opaque pixel of its layer and zero everywhere else.

```json
{
  "schema": "lumasprite.component-package.v1",
  "canvas": { "w": 16, "h": 16 },
  "pivot": [8, 13],
  "pixelsPerUnit": 16,
  "palette": ["#243455", "#e6bc69"],
  "layers": [{
    "id": "body",
    "pngSha256": "<sha256 of layer-body.png>",
    "maskSha256": "<sha256 of layer-body.mask.png>",
    "anchors": { "join": [8, 10] },
    "provenance": {
      "creator": "Artist name",
      "source": "Original art record or licensed source reference",
      "license": "Rights grant or license identifier",
      "rights": "review-only"
    }
  }],
  "revision": 1,
  "parent": null
}
```

Use 1–16 unique layers in bottom-to-top order and 1–64 palette colors. Pivot and anchors use integer coordinates from the top-left. An anchor must lie on a pixel owned by its layer. Compute source hashes with PowerShell `Get-FileHash -Algorithm SHA256` and write hex in lowercase. Use `production-declared` only when provenance records support that grant. The receipt reports the declaration. Owner approval and verification of the source grant remain separate.

```powershell
npm run component -- --manifest input/component.json --out r1
npm run component -- --revise r1 --layer body --png edited.png --edit-mask allowed.png --out r2
npm run component -- --verify r2 --parent r1
npm run component -- --verify r1
```

Build creates a new directory. It keeps the original layer PNGs and masks, writes canonical `component.json`, renders `sprite.png` and records `SHA256SUMS`. Revise recolors one existing layer within the supplied binary allowed mask and preserves all other pixels, ownership, metadata and source provenance. A child records the parent manifest digest and the edit mask. Verify with the parent to check the revision link and pixel protection. Without a parent, a child receipt explicitly reports `revisionLink: NOT_RUN`. Roll back by using the verified prior package and its `sprite.png`. The original revision stays available, including its digest. Use a different output directory for every revision.

In Studio, import `sprite.png` for review or import the individual layer PNG into a canvas of the same dimensions for edits. Export that layer as RGBA PNG, then use the revision command. Keep `component.json` and the masks with the package. Studio's native scene path separately preserves scene metadata and exports the E8.5 ZIP for Unity.

For a standalone Unity Sprite, import `sprite.png` with Point filtering, no mipmaps and no compression. Use the same PPU, and convert the top-left anchor in the manifest to a normalized Unity pivot `(x / w, 1 - y / h)`. Existing scene ZIPs still use the E8.5 importer.

## Local programmatic API

With the compiled tree available as ESM, import `buildComponentPackage(inputJsonPath, outDir)`, `reviseComponentPackage(parentDir, layerId, editedPngPath, editMaskPath, outDir)`, or `verifyComponentPackage(dir, parentDir?)` from `dist/components/package.js`. The functions resolve with a verification receipt and reject invalid inputs or an existing output directory. They share the CLI contract and have no network dependency.
