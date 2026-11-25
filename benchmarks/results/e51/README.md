# E5.1 Field Surveyor idle artifacts

[Offline gallery with loop controls](../../../docs/LumaSprite-Engine-E5.1-Report.html) · [Artistic review sheet](review.md) · [Studio round-trip](studio/parity.json) · [Artifact SHA-256](../../../docs/e51-benchmark-sha256.txt)

| Phase | Duration | 1× sprite | 1× silhouette | 4× landmark | Outdoor 1× |
| --- | --- | --- | --- | --- | --- |
| Neutral | 360 ms | [Sprite](neutral-1x.png) | [Shape](neutral-silhouette-1x.png) | [Overlay](neutral-landmarks-4x.png) | [Scene](neutral-outdoor-1x.png) |
| Inhale | 480 ms | [Sprite](inhale-1x.png) | [Shape](inhale-silhouette-1x.png) | [Overlay](inhale-landmarks-4x.png) | [Scene](inhale-outdoor-1x.png) |
| Return | 360 ms | [Sprite](return-1x.png) | [Shape](return-silhouette-1x.png) | [Overlay](return-landmarks-4x.png) | [Scene](return-outdoor-1x.png) |
| Recovery | 600 ms | [Sprite](recovery-1x.png) | [Shape](recovery-silhouette-1x.png) | [Overlay](recovery-landmarks-4x.png) | [Scene](recovery-outdoor-1x.png) |

A loop takes 1,800 ms. The first and third frames reproduce R2 exactly. Inhale widens the shoulders by adjusting jacket width and lifts the near elbow a pixel. Recovery drops the upper body one pixel. The holder's wrist, grip, boots and pivot stay fixed. [4× strip](strip-4x.png) · [Onion-skin at wrap](onion-recovery-neutral-4x.png) · [Scene source](scene-source.json)

Use the five-file Engine package for import and verification. [Strip PNG](package/spritesheet.png) · [Timing JSON](package/timing.json) · [AnimationSpec](package/animation-spec.json) · [Manifest](package/manifest.json) · [Frame QA](package/qa.json).
