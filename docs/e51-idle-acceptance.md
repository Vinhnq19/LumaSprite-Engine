# E5.1 Idle Acceptance

**E5.0 ANIMATION ARCHITECTURE: APPROVED**

**E5.1 SUBTLE IDLE BASELINE: APPROVED_WITH_LIMITATIONS**

The Project Owner accepted the four-frame Field Surveyor R2 + M2P idle at checkpoint `2575ac3` and authorized E5.2. The accepted loop is 64 × 64 at 360 / 480 / 360 / 600 ms, with a fixed pivot at (30,59) and grip at (49,33). [Original gallery](LumaSprite-Engine-E5.1-Report.html) · [Frozen benchmark hashes](e51-benchmark-sha256.txt)

The four frame RGBA hashes remain in the original timing file. Frames 1 and 3 are identical. The owner measured 107 changed pixels from frame 1 to 2 and 184 from frame 3 to 4. [Spritesheet](../benchmarks/results/e51/package/spritesheet.png) · [Timing and frame hashes](../benchmarks/results/e51/package/timing.json) · [AnimationSpec](../benchmarks/results/e51/package/animation-spec.json) · [Original frame QA](../benchmarks/results/e51/package/qa.json) · [Source revision manifest](../benchmarks/results/e51/package/manifest.json)

The breathing is subtle at 1×. Recovery holds for 600 ms and lowers the head by one pixel. Four timing slots use three distinct images. The lantern has limited secondary motion. Target-game runtime remains `GAME_RUNTIME_NOT_TESTED`. [Original QA report](e51-test-report.md) · [Original review rubric](../benchmarks/results/e51/review.md)
