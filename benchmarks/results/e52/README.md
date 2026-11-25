# E5.2 walk cycle artifacts

[Offline gallery and preview](../../../docs/LumaSprite-Engine-E5.2-Report.html) · [Human review](review.md) · [Motion model](../../../docs/architecture/e52-walk-motion.md) · [SHA-256](../../../docs/e52-benchmark-sha256.txt)

| Candidate | PNG | Timing and root | QA | Studio restore |
| --- | --- | --- | --- | --- |
| W1 Conservative Walk | [384 × 64 strip](w1/package/spritesheet.png) | [Six timed frames](w1/package/timing.json) | [Contact and geometry](w1/package/qa.json) | [Parity proof](studio/w1/parity.json) |
| W2 Expressive Walk | [512 × 64 strip](w2/package/spritesheet.png) | [Eight timed frames](w2/package/timing.json) | [Contact and geometry](w2/package/qa.json) | [Parity proof](studio/w2/parity.json) |

Each package has a manifest and its AnimationSpec v2. The gallery includes frame galleries, native loops, 4× strips, silhouettes, landmarks, onion-skin, grip, world-foot trajectories and the idle transition in the source RPG scenes. [Scene provenance](scene-source.json)
