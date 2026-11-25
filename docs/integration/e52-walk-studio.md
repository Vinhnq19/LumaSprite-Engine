# E5.2 Studio animation integration

Studio `bb5c384` decoded the real W1 and W2 PNG strips, sliced them using the verified timing JSON, and materialized them through its existing EngineResultV1 adapter. The test normalizes pivot (30,59) to (0.46875,0.921875).

| Gate | Evidence |
| --- | --- |
| Frame import | All six W1 and eight W2 cells matched the published RGBA hashes. |
| Timing and tag | A forward looping tag used the actual timing per frame. The sampler matched each timing boundary and restarted at the correct wrap. |
| Persistence | Saving, reopening and backup restore preserved tags, pivot, frame order and timings. |
| Export | Each restored PNG frame and the strip PNG matched Engine RGBA. Studio's strip JSON used the same frame rectangles, durations, pivot and repeat tag. |
| Revision protection | Studio rejected both stale saves with status 409 and `STALE_REVISION`, then reopened the intact projects. |

[W1 Studio proof](../../benchmarks/results/e52/studio/w1/parity.json) · [W2 Studio proof](../../benchmarks/results/e52/studio/w2/parity.json)

## E8 integration backlog

The Studio UI's direct PNG strip importer initializes each frame at 100 ms. This production test reads the Engine timing sidecar and exercises Studio's raster adapter, timeline and store. Root offsets, foot-contact tracks and phase metadata remain in the Engine timing JSON. E8 can add a native paired PNG/JSON import plus preservation of root and contact metadata through Studio export.

```powershell
$env:LUMASPRITE_ANIMATION_EDITION='52'
npm run test:animation-studio
```

The automated integration uses the sibling Studio source read-only and writes proof under Engine. `GAME_RUNTIME_NOT_TESTED` applies to target-game playback and root integration. [Timing and root contract](../architecture/e52-walk-motion.md)
