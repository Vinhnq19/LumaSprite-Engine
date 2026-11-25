# E4.3 character production architecture

The owner selected E4.2 M2 as the material baseline with limitations. M2P uses B1's exact CharacterSpec v2 and shape-lock bytes. Forest Courier is an independent technical pilot with a CharacterSpec v3 and its own geometry lock. [M2P package](../../benchmarks/results/e43/packages/m2p/manifest.json) · [Courier package](../../benchmarks/results/e43/packages/courier/manifest.json)

## Shared solver and materials

The same CharacterSpec parser, arm and leg primitives, torso projection, layer composition, surface masks, relative clipped patches, palette mapping, contour pass and PNG renderer serve both assets. The v3 traveler profile adds a hood, a crossbody satchel in front of the jacket, free hands, and a choice of cloth ramps. It reuses the v2 standing checks for contact, balance, headroom, knee and shoulder offsets. Accessory checks follow the configured topology. Courier validates the hood attachment and strap-to-satchel overlap. Surveyor validates the existing lantern grip and clearance.

The Courier fixture uses a 17 px head and a 13 px jacket length against 14 px and 16 px for Surveyor. Its silhouette occupies 978 pixels over 52 rows. Its palette uses russet coat planes and moss trousers. The front accessory order and continuous hood read differently from the brimmed Surveyor. The same material routing still paints the skin, cloth, leather and their outlines through owned masks. M2P specifies larger warm glass patches and different coat and sleeve planes using M2's input geometry and colors.

Both profiles share a 64 × 64, single-view stylized humanoid solver. V3 supports the pilot's free-standing pose, hood and crossbody satchel. New holdable equipment or another view needs a defined attachment, mask and validation rule. The Courier geometry lock proves reproducibility for this pilot.

## Portable package and Studio round-trip

Each package contains the transparent `final.png`, `silhouette.png`, a visible material-region PNG, the versioned CharacterSpec, the shape lock with ordered parts and landmarks, material metadata, and a packed set of binary part masks. The mask payload is row-major base64, least-significant bit first. The manifest pins each file's SHA-256, source lineage, raw RGBA hash, alpha hash and ground pivot. The verifier regenerates the package from the spec and compares every file byte for byte.

Studio receives CharacterProfile v1 and its normal source RGBA and mask resources. The test imports the exact bundled PNG, maps engine provenance and material ramps into the existing Studio batch provenance fields, and verifies those fields after save/reopen and backup/restore. The complete CharacterSpec, lock and Engine lineage remain in the portable sidecars. Studio's revision check rejects a stale save and the stored project is checked afterward. Both profiles remain drafts. [Actual Studio parity](../../benchmarks/results/e43/studio/parity.json)

```sh
npm run build
npm run character -- --verify-package benchmarks/results/e43/packages/m2p
npm run character -- --verify-package benchmarks/results/e43/packages/courier
```

The packages are Engine-produced and tested in Studio. The browser gallery compares game-style scenes rendered at native scale.
