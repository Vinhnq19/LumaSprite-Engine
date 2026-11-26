# E5 Final Acceptance

The Project Owner issued this decision on 2026-11-26 through the E5 Final Acceptance and E6 Environment Art Foundation brief. The scope is the checked E5.4 production baseline.

| Item | Owner decision |
| --- | --- |
| E5 engineering | `APPROVED` |
| E5 artistic baseline | `APPROVED_WITH_LIMITATIONS` |
| Surveyor | R2 + M2P, E5.1 Idle and W2 Expressive Walk |
| Forest Courier | E4.4 revised standing reference and approved E5.3 Walk |
| Root playback | A · Discrete Root |
| Pixel-Snapped B | `NOT_SELECTED` |
| E6.0–E6.1 | `AUTHORIZED` |

The frozen bundles come from Engine `b776487`. The lock links each manifest to the character spec, production render, shape lock, material, timing, pivot, root/foot-contact track and PNG RGBA. Both walk packages retain the frame-stepped contract. A consumer must advance the visual root in the same update that presents the authored frame and add the cycle displacement at wrap. W2 advances 32 px in 880 ms. Courier advances 24 px in 960 ms. The entry/exit PNG and stop contact stay with their respective packages. [Production baseline lock](../benchmarks/results/e54/baseline-lock.json) · [Surveyor manifest](../benchmarks/results/e54/packages/surveyor/manifest.json) · [Courier manifest](../benchmarks/results/e54/packages/courier/manifest.json)

The E5.4 Standalone run verified Discrete Root at 0 px measured planted-foot slip, including inner-frame samples at 0.75×, 1× and 1.25×. Pixel-Snapped B carried the held planted pose up to 4 px for Surveyor and 3 px for Courier. W2-IK and W2-Hybrid are frozen as research evidence. The original Courier material remains selected. [Unity evidence](../benchmarks/results/e54/unity/evidence.json) · [E5.3 archive](e53-quality-review.md)

## Accepted limits

- Coverage is two humanoids and one profile-biased view.
- Courier idle is a held standing pose.
- Discrete Root presents movement in steps tied to the authored frames.
- Studio's direct PNG strip importer initializes durations to 100 ms per frame. Keep the Engine timing sidecar for authored durations, root and contacts.
- The Unity smoke covers fixed-camera Windows Standalone scenes, with production game conditions still subject to the target project's tests.

The E6 checkout verified 66 Engine tests before branching, the E5.4 proof files and bundle bytes, and the 805 historical SHA-256 entries. E6 uses frozen character PNGs at native scale and retains the E5 contract. [E5.4 report](LumaSprite-Engine-E5.4-Report.html) · [E6 handoff](e61-environment-foundation.md)
