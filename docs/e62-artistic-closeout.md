# E6.2 Artistic Decision and Quality Closeout

Project Owner approved E6.2 engineering, reviewed **C1 Courtyard** and **C2 Supply Stop** as **APPROVED_WITH_LIMITATIONS**, selected both as the composition baseline and authorized E6.3. Final Environment art remains pending owner review. E6.1R B1 is the historical control. [Original C1/C2 gallery](LumaSprite-Engine-E6.2-Report.html) · [Composition baseline manifest](../benchmarks/fixtures/e63/e62-composition-lock.json)

The brief names `e8f15e1`. That object is absent in this checkout. The clean local E6.2 branch and its configured origin tracking ref both resolved to `d68f151bba8fb6c44c6e9821b5f7c4840c01c0fd`. It descends from B1 `24b8ca6`, reproduces all 91 payloads and matches all 100 E6.2 checksums. E6.3 branches from that verified record.

## C2 Night Readability

At 1×, the low-contrast strip below the forecourt and the cool ground behind the delivery area touch the silhouettes of Surveyor and Courier. The C2-Q candidate changes three material-clipped lighting regions on the route and delivery apron. The building shadow still reads under the stone step and props. The door light remains warm. The cool fill spans the ground plane around each activity with clear space between them.

| Character | C2 Night edge p10 | C2-Q edge p10 | Visible pixels in both |
| --- | ---: | ---: | ---: |
| Field Surveyor | 11 | 16 | 1,072 |
| Forest Courier | 15 | 25 | 997 |

The check compares neighboring final scene pixels around visible actor edges. Actor bytes, pivots, layer/occlusion results, collision, walkable mask and the B1 atlas match. Review the stronger light bands and upper-body readability in the 1× comparison. **C2-Q is proposed for the next review**. C2 remains the approved baseline. [Before and after gallery](LumaSprite-Engine-E6.3-Report.html#quality-closeout) · [C2-Q package](../benchmarks/results/e63/packages/c2-night-quality-night/manifest.json)

## Rear occlusion

The rear probe at `(125,104)` has 0 visible actor pixels and lies outside the walkable mask. It tests whether the roof and wall correctly occlude the actor. The authored rear-turn runs around the side and ends at `(157,98)`. Across 175 positions it never hides Surveyor entirely, so the modeled duration of full occlusion on that route is 0 ms. Its lowest sampled visibility is 75 of 1,072 px, a tight portion that merits a camera check in a target game.

If a later gameplay layout extends the route through a fully obscured area, add an opt-in indicator for the player position at a visible point beside the wall. Keep the actor below the occluder and activate the indicator only on a route where the visibility probe requires it. The current C2 route passes the closeout gate with its declared walkable zone. [Route samples](../benchmarks/results/e63/e62-quality-closeout.json)

## Ground contact

Rechecked all eight E6.2 traces from the locked E5.4 W2 and Courier Walk. Each has 16 adjacent planted-foot pairs. All forward deltas are 0 px. The largest screen-y delta is 2 px. Subtracting the change in projected pivot-y yields 0 px residual on every planted pair. The displacement comes from the bounded depth placement used across the bottom edge of the doorway. It is visible in the harness and is a limitation of applying a right-moving clip to a depth transition. The source clip and world contact anchors remain locked.

Chrome verifies the E6.2 browser sequence. The retained Unity 6000.3.21f1 evidence covers Editor import of seven PNGs with exact RGBA for StandaloneWindows64. The pilot has no Unity gameplay runtime result. [E6.2 playback](LumaSprite-Engine-E6.2-Report.html#entrance) · [Unity import record](../benchmarks/results/e62/unity-import.json)

The remaining review questions include contrast in C2-Q, the near-hidden part of the rear route, and the depth projection at the doorway. E6.2 engineering remains approved, with its two original layouts held as controls for the variety pilot.
