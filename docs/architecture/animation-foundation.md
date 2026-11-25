# E5.0 animation foundation

The idle clip reuses the E4 character solver, silhouette and ordered part masks, M2P material planes, palette mapping, Pixel Core, PNG encoding and Studio raster contract. Key poses alter the source's integer elbow coordinates and jacket dimensions. The renderer builds each frame's geometry and draws it at 64 × 64. [AnimationSpec v1](../../benchmarks/fixtures/e51/surveyor-idle.json) · [Idle gallery](../LumaSprite-Engine-E5.1-Report.html)

## AnimationSpec v1

| Fields | Supported behavior |
| --- | --- |
| Source | CharacterSpec v2 or v3 revised standing source. The acceptance checkpoint labels the source. Geometry revision and SHA-256 of the CharacterSpec, shape lock and production manifest must match the verified character package. |
| Name and intent | One named `standing-idle` clip. The E5.1 fixture identifies the approved R2 package. |
| Key poses | Two to four ordered phases starting at neutral, each with its exact duration in milliseconds, near/far elbow offsets and jacket width/height offsets. Offsets are integer −1 to +1. Neutral and return use the source geometry. |
| Contact | Both boots and projected ground retain exact source masks. Held equipment retains the source shape, grip and aperture. Frame-to-frame joint displacement is at most one pixel per axis including the wrap. |
| Identity | Fixed pivot, ordered part IDs and material ramps. The source seed carries into each frame. |
| Output | 64 × 64, untrimmed transparent RGBA, one horizontal strip, nearest sampling and repeat. Each frame has an explicit rectangle, duration and RGBA SHA-256. |

## Frame pipeline

1. Rebuild the source character package and compare it with the pinned source hashes.
2. Apply each key pose to a copy of the source CharacterSpec and run the existing geometry solver and contact checks. Generate an independent frame shape lock.
3. Reapply the source's material style and verify palette, part-mask alpha, ordering, planted support, grip contact and hand-to-lantern clearance. For the two neutral phases, require exact source RGBA.
4. Check all consecutive transitions, including the final return to frame 1. Compare paint on identical authored parts aligned to local bounds. This detects changes even when the whole part moved a pixel. The diagnostic excludes deforming regions. Review contours, deformations and perceived cadence at 1×.
5. Pack and decode the PNG. Slice each rectangle, compare RGBA hashes and record timing, provenance and frame QA. The verifier rebuilds the five exported files and compares the bytes.

Builds are deterministic. The three distinct silhouette hashes are expected motion. Head and equipment retain their shapes and ramps. Equipment stays still in this clip. [Frame QA](../../benchmarks/results/e51/package/qa.json)

## After idle review

E5.2 can begin only after the owner accepts the idle. The walk proposal needs a separate pose intent, signed root travel, left/right contact phases, foot placement and release rules, body weight transfer and gait timing. Start by validating contact, down, passing and up poses with both feet taking a turn. Keep the lantern attached, account for movement and apparent weight, and retain native-scale timing and contour review.

E5.3 should validate the same attachment and contact interface on a second profile and in the target game. Courier already shares the humanoid solver, renderer and no-held-equipment branch. It will need a clip-specific satchel and arm clearance check, plus an authored motion brief.
