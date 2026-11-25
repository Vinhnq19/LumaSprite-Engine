# E4.3 game art audit

The Project Owner selected M2 as the E4.2 baseline with limitations for this production validation. M1 remains a comparison control. E4.3 keeps the same geometry and palette for all three Surveyor samples.

| Area | Native-scale observation |
| --- | --- |
| Lantern | M2P extends one warm light cluster inside the existing 15-pixel glass. Bright warm glass increases from 4 to 10 pixels. The average glass-to-frame gap rises from 68.11 to 81.80 luminance levels. The frame-to-far-trouser gap rises from 23.94 to 30.25. Both improve recognition, especially on the darker floor and near the barrels. |
| Clothing volume | M2P opens the upper-left front plane and carries the arm light toward a shorter cuff. The average near coat remains brighter than the far coat by 44.76 levels in Authored mode. The far plane stays at the M2 average of 60.55. |
| Grip and pose | The side of the cuff reads distinctly from the skin and dark handle. The hand/handle intersection and aperture are identical. The forearm still appears nearly level and the head is still closer to profile on some backgrounds. Both come from the approved geometry. |
| Boots | The M2 boot planes carry through. The dominant visual gains are the lantern and upper body. The deepest sole still has lower separation on dark floors. |
| Context | Outdoor uses the approved Organic fixture. Dark Dungeon uses the previously sourced CC0 floor and wall with approved props. The neutral lineup gives the same baseline to all three. The stocked outdoor path puts barrels close to the lantern without changing the approved sprite scale. |
| Palette | The result is strongest in Authored or Project. The four-color locked example compresses material ramps and weakens the glass/metal distinction. The benchmark preserves the request palette and reports `PALETTE_LIMITED`. |
| Reuse | Courier's hood, front bag, shortened torso and open gesture produce a distinct read using the same material renderer. The rust and moss ramps separate it from Surveyor at 1×. It remains a technical generalization pilot. |

**Recommend M2P for the human game-art review** at 1×. The gain is localized. The full sprite proportions and lamp outline remain frozen. The numeric gaps describe actual mask means in 8-bit luminance and do not provide a human rubric score. [Offline scene comparison](../LumaSprite-Engine-E4.3-Report.html) · [Measured data](../../benchmarks/results/e43/readability.json)

If the owner wants a stronger view turn or a less rigid holding arm, review the separate geometry proposal before editing those regions. [Geometry proposal](e43-surveyor-geometry-proposal.md)

For E4.4, review the ten criteria in all four 1× conditions, record the intended palette and confirm the target game's native scale and import settings before final acceptance. Keep Courier's decision independent. [Human review sheet](../../benchmarks/results/e43/review.md)
