# E5.1 Studio animation compatibility

[Verified Studio output](../../benchmarks/results/e51/studio/parity.json) · [Studio-restored PNG strip](../../benchmarks/results/e51/studio/restored-strip.png)

The integration test runs Studio `bb5c384` read-only. It decodes the real Engine strip with Studio's PNG reader and slices the timing rectangles into RGBA frames. It calls Studio's `negotiateEngineV1` and `materializeEngineResultV1` raster adapter and stores the result with PixelStore. The test translates pixel pivot (30,59) to Studio's normalized (0.46875,0.921875).

| Contract | Result |
| --- | --- |
| Frame import | Four exact untrimmed 64 × 64 frame cells through the actual Studio decoder and adapter. |
| Timeline | One forward looping tag with 360, 480, 360 and 600 ms intervals. Studio's playback sampler selects the expected frame at each boundary and wraps at 1,800 ms. |
| Save/reopen | RGBA, tag, frame order, durations and pivot are preserved. Every individual PNG export matches the frame RGBA hash. |
| Backup/restore | Restored project preserves the same frame and timeline data. Studio's strip exporter emits PNG and JSON. Frame rectangles, exact RGBA, timings, pivot and loop tag match. |
| Revision protection | A stale save is rejected with status 409 and `STALE_REVISION`. The intact document is loaded afterward. |

Studio's UI strip import initializes imported frame durations to 100 ms. The tested adapter path supplies the real durations and loop tag. The Engine package's source locks, joint transforms, frame phase IDs and motion QA remain in the Engine JSON sidecars. The test is a Studio code-level integration with the existing adapter and store. [Engine timing](../../benchmarks/results/e51/package/timing.json) · [Engine manifest](../../benchmarks/results/e51/package/manifest.json)

Run `npm run test:animation-studio` from Engine. The test writes proof to `benchmarks/results/run/e51-studio`. The nearby outdoor scene in the HTML is an Engine preview. `GAME_RUNTIME_NOT_TESTED` applies to target-game import and execution.
