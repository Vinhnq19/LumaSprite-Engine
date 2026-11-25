# E5.2 walk motion architecture

W1 and W2 share the approved Field Surveyor R2 body, M2P palette, layer order, geometry solver, material renderer, integer rasterizer and PNG package pipeline. The E5.1 idle spec and package remain byte-exact. [E5.1 acceptance](../e51-idle-acceptance.md) · [Offline comparison](../LumaSprite-Engine-E5.2-Report.html)

## Motion model

AnimationSpec v2 adds a lantern-holding walk with separate far and near lead keys. Each key records phase, milliseconds, forward root advance, body bob, swing-foot offset and lift, far-arm swing, grip displacement and lantern sway. Ground stays at y=59 for the near foot and y=58 for the far foot. Canvas pivot stays (30,59). The geometry generator keeps near parts in front of far parts through leg crossings.

| Phase | Geometry and timing |
| --- | --- |
| Contact | Both soles touch their projected ground. The leading foot lands ahead of the hips and the previous support remains behind on its same world anchor. |
| Down | The lead foot carries the weight. The body sinks two pixels for W1 and three for W2. The trailing foot starts to lift and the far arm swings against the lead side. |
| Passing | The swing boot clears the supporting boot. The stance sole is under the body mass. The knees use the hip-to-ankle path plus phase-specific flexion. |
| Up | W2 raises the stance heel by two pixels and retains a planted toe patch. The swing boot comes forward and starts to descend. W1 joins passing to the next contact on its shorter six-frame cycle. |

| Candidate | Timing per half-cycle | Root advance per frame | Travel per cycle |
| --- | --- | --- | --- |
| W1 | 90 / 135 / 165 ms | 3 / 4 / 5 px | 24 px over 780 ms |
| W2 | 120 / 115 / 95 / 110 ms | 4 / 4 / 4 / 4 px | 32 px over 880 ms |

W1 keeps a stationary grip and rigid lantern silhouette. W2 shifts the wrist and palm together, then moves the lantern body by at most one pixel relative to the grip, with a connected handle and the same seven pixels of hand contact. The waist, thighs and shins reshape around the original joints. Passing and the wrap keep both boot masks disjoint. [W1 QA](../../benchmarks/results/e52/w1/package/qa.json) · [W2 QA](../../benchmarks/results/e52/w2/package/qa.json)

## Root, contact and continuity

Root motion is **frame-stepped**. A runtime consuming this package should apply the exact delta when it advances the sprite frame. At a frame sample, the world contact coordinate is the current canvas forefoot anchor plus accumulated root X. The advancing step carries the plant backward by the same amount in canvas space. The verifier computes world displacement at every consecutive pair of planted samples, including the wrap with the cycle offset added. Every checked delta is (0,0). The table exports both foot states and positions, sole contact, knee and ankle points and ground height. The geometry also checks support coverage, swing clearance, balance at passing, joint attachments and body-to-lantern clearance.

The fixed-pivot sprite preview shows apparent in-place travel. In Outdoor RPG and Dark Dungeon, the preview adds the exported root offsets against the same background at 1×. The scene display resets its location each demonstration loop. A target runtime should accumulate root across loops. Advancing root continuously while holding a sprite frame may cause visible slip between samples. [W1 timing and root motion](../../benchmarks/results/e52/w1/package/timing.json) · [W2 timing and root motion](../../benchmarks/results/e52/w2/package/timing.json)

The idle-to-walk preview uses the frozen E5.1 idle and a 110 ms pose bridge with the far boot planted. The phase transition returns via the next far contact at the completed cycle's world root and reverses the bridge to recover idle. The shared QA checks frame-specific alpha, joints, identity, color ramps and PNG regions. The flicker test aligns unchanged authored parts to their local bounds and compares paint. Deforming parts, contour motion and perceived cadence remain on the human rubric.

## E5.3 proposal

After the owner chooses a walk baseline, use the same explicit contact model to validate a Courier motion. Author its free-arm and satchel constraints and confirm the same Studio timing path. Check nearest sampling, clip and pivot and per-frame world root in an available target game before extending the animation library.
