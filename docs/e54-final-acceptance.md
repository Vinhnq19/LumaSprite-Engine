# LumaSprite Engine · E5.4 Unity Production Acceptance

**E5_READY_FOR_FINAL_OWNER_ACCEPTANCE**

The selected production baseline is Surveyor R2 + M2P with W2 and E5.1 Idle. Forest Courier uses the approved-with-limitations E5.3 walk and its original E4.4 standing pose. The final gameplay art decision belongs to the Project Owner. [Offline A/B and Final Review Sheet](LumaSprite-Engine-E5.4-Report.html) · [Handoff](../HANDOFF.md)

## E5.3 artistic decision record

| Item | Owner decision | Production treatment |
| --- | --- | --- |
| W2 Expressive Walk | `SELECTED_PRODUCTION_BASELINE` | Surveyor uses W2. W1 stays a locked reference. |
| W2-Hybrid | `RESEARCH_ONLY` | Its two passing poses lowered the peak knee-angle change to 24.444°. At 1× the improvement was insufficient for replacement. The callback was removed from the production builder. Reproduction reads the archived E5.3 build path from `7fa1f23`. |
| W2-IK | `RESEARCH_ARCHIVED` | Retain the original comparison files and evidence. |
| Forest Courier Walk | `APPROVED_WITH_LIMITATIONS` | Use the shared gait's `walk-free` export as the Courier baseline, with a single frozen idle reference. |
| Courier-Leather-Localized | `NOT_SELECTED` | Use the original Courier material and colors. |
| OKLab/OKLCH | `DIAGNOSTICS_CANDIDATE` | Keep the material diagnostics opt-in. Production maps color with the existing RGB nearest-ink rule. |

E5.4 forked `codex/e5-4-unity-production` from the clean E5.3 checkpoint `7fa1f23`, a descendant of the R&D checkpoint `f9c6f77`. The six observed art decisions above supersede the pending decisions recorded in E5.3's archived report. [E5.3 report and reproduction](e53-quality-review.md) · [Baseline and source SHA-256 lock](../benchmarks/results/e54/baseline-lock.json) · [Source and notices](../research/open-source/art-quality/README.md)

## Unity Windows Standalone Runtime Report

**UNITY_RUNTIME_PASS**

The smoke project uses Unity **6000.3.21f1 (c02631ffc030)**, Windows Standalone x64, Direct3D11 and the Built-in render pipeline. The project and build outputs are under Engine's ignored `.cache/e54-unity`. The project uses the installed Windows module, with Image Conversion and JSON Serialize resolved as built-in modules, each at 1.0.0. The Editor compiled the generated scene, built a standalone executable and stepped out. The separate Player process ran all runtime trials, wrote the evidence and exited successfully.

The outdoor camera uses approved E3.4 terrain and E2.4 props. The dark dungeon uses the existing approved E2.4 tiles and props. The neutral scene uses the same camera and actors. All three reference scenes use Engine-owned fixtures and the established fixture attributions. The SpriteRenderer uses a 320×176 fixed orthographic camera at **32 pixels per unit**, Gamma, point sampling, no mipmaps, uncompressed textures, and no MSAA. The Player creates sprite slices directly from Engine's JSON using full rectangles. Top-left Engine pivots (30,59) and (32,58) are converted to Unity's bottom-left convention. Imported source cells match **all 21 Engine RGBA hashes** across the Surveyor idle/walk and Courier standing/walk. Six native render captures match the independent Engine compositor pixel for pixel, at the same held sprite and different A/B root offsets.

[Unity runtime JSON](../benchmarks/results/e54/unity/runtime.json) · [Texture import report](../benchmarks/results/e54/unity/unity-import.json) · [Camera verification](../benchmarks/results/e54/unity/evidence.json) · [Unity Sprite.Create](https://docs.unity.com/en-us/engine/6000.3/script-reference/unityengine/sprite/create) · [Unity BuildPlayer](https://docs.unity.com/en-us/engine/6000.3/script-reference/unityeditor/buildpipeline/buildplayer)

| Clip | Frames and authored delays | Root per loop | Root after three loops |
| --- | --- | ---: | ---: |
| Surveyor Idle | 4 · 360/480/360/600 ms | Stationary | Stationary |
| Surveyor W2 | 8 · 120/115/95/110 ms twice | 32 px | 96 px |
| Courier standing reference | 1 · 1,800 ms presentation hold | Stationary | Stationary |
| Courier Walk | 8 · 125/130/110/115 ms twice | 24 px | 72 px |

### Root and foot contact

The test evaluates the full journey at 60 Hz of presentation time, with playback speeds 0.75×, 1.0× and 1.25×. The 36 cases cover both characters and modes in all three scenes. For each planted foot, the Player computes world X from the rendered pivot, the sample's root and the foot's canvas coordinates. It compares that to the Engine's authored world anchor plus the accumulated cycle displacement. A separate step checks world X deltas between consecutive planted samples. Sampling includes inner-frame timestamps, frame starts/ends, each cycle wrap and the stop contact. At 1.0× outdoors there were 197 planted inner-frame samples for Surveyor and 217 for Courier per mode.

| Mode | Surveyor root step / max foot slip | Courier root step / max foot slip | Choice |
| --- | --- | --- | --- |
| A · Discrete Root | 4 px / 0 px | 3 px / 0 px | Use with the current strips. The planted foot holds between frames and across the wrap. |
| B · Pixel-Snapped | 1 px / 4 px | 1 px / 3 px | Keep for comparison. The root moves more smoothly while the held pose carries its planted foot forward, then the foot moves back at the next pose. |

A and B completed actual wall-clock playback in both outdoor and dungeon scenes, including Idle → Walk, three loops, stop contact and Walk → Idle. Each character displayed all 24 walk slots on each route. Observed frame rate was 59.98–60.13 FPS and p95 frame time was 16.74–16.77 ms. At capture time 2,115 ms, Surveyor's root was +4 px in A and +7 px in B while both showed the same pose. Courier was at +3 px and +5 px. The 1× presentation and contact overlay in the report make the distinction visible.

[Surveyor A trace](../benchmarks/results/e54/unity/surveyor-A-trace.csv) · [Surveyor B trace](../benchmarks/results/e54/unity/surveyor-B-trace.csv) · [Courier A trace](../benchmarks/results/e54/unity/courier-A-trace.csv) · [Courier B trace](../benchmarks/results/e54/unity/courier-B-trace.csv) · [Scene comparisons](LumaSprite-Engine-E5.4-Report.html#unity)

The published captures certify integer-aligned rendering for the fixed camera at selected native positions. The live routes exercise pose availability and cadence on this Windows device. The intermediate contact analysis follows authored landmarks, not a physics or IK ground simulation. Dynamic cameras, fractional viewport scales, target-game collision and motion controllers, and other graphics backends remain outside this smoke test. At the tested art scale use synchronized root and pose advancement. A game can keep an independent continuous physics position if its visual pose and presentation anchor remain synchronized with the foot-contact contract.

## Production bundles and Studio compatibility

| Bundle | Contents |
| --- | --- |
| Surveyor | Exact Idle and W2 production packages, entry/exit bridge, source palette metadata and per-file SHA-256. |
| Courier | Frozen E4.4 standing PNG with hold timing, exact E5.3 walk production package, bridge, palette metadata and per-file SHA-256. |

[Surveyor manifest](../benchmarks/results/e54/packages/surveyor/manifest.json) · [Courier manifest](../benchmarks/results/e54/packages/courier/manifest.json) · [Full baseline lock](../benchmarks/results/e54/baseline-lock.json)

Studio `bb5c384` passed EngineResultV1 import, exact cell RGBA, normalized pivot, original frame delays, forward repeat or hold, save/reopen, stale revision rejection, backup/restore and strip PNG/JSON export for all four new bundle clips. E5.1 and E5.2 Studio suites also passed. The direct PNG strip UI stores pixels in the chosen cell order and initializes each frame to 100 ms. Retain the original timing sidecar for per-frame duration, pivot, authored tag and phase, root offsets, foot contacts, bridge and source hashes. The paired Engine adapter route preserves the timing, manually applied normalized pivot and playback tag tested here. Root and foot tracks remain sidecar data in that route as well.

## Technical gates and reproduction

- Engine lint, typecheck, build, CLI smoke and **66/66 tests** passed. The locked W1/W2 and idle packages were verified byte-for-byte. Courier's production package and bridge match the E5.3 SHA-256 evidence. Repeated E5.4 exports match the package manifests, all exact cells and palettes.
- **805** historical SHA-256 entries, **361** regenerated historical outputs, **50** E5.3 files and **54** R&D files passed. Archive replay uses isolated output directories. [Historical verification](../benchmarks/results/e54/historical-verification.json)
- Direct check of the three upstream MIT notices matched the pinned originals. The production change removes the research callback from the walk builder. Art-side evidence and source attributions remain on the earlier commits.
- The offline gallery's A/B at capture time also matches all six Unity captures pixel for pixel. The gallery lets reviewers choose scene, speed, exact time, contact markers and integer 4×, and exports their rubric as JSON.

Run from the Engine root using Node 24 or later and Windows PowerShell. The run used Node 26.13.1.

```powershell
node scripts/export-e54.ts
$env:LUMASPRITE_ANIMATION_EDITION='54'
npm run test:animation-studio
& scripts/e54-unity/run.ps1
node scripts/verify-e54.ts --history
node scripts/report-e54.ts
```

The source project and standalone player stay under `.cache/e54-unity`. Fresh render and trace evidence stays in `benchmarks/results/run/e54/unity`. The reports link the fixed evidence under `benchmarks/results/e54`. Inspect the build and Player logs in the isolated project if rerunning. The published snapshot includes actual runtime observations, so timestamps and wall-clock FPS will vary between reruns.

## Proposed final acceptance and E6 handoff

Approve the selected W2 and Courier exports with method A after the Project Owner signs off on the 1× native comparisons. Observe the discrete root step, Courier's held idle and Surveyor's lantern and weight transfer in both scenes. If the authored cadence is acceptable, record the E5 owner decision and keep these SHA-256 locks as the reference for later runtime work.

E6 preparation can use the approved terrain, props and pixel scale to define the first Environment, UI and VFX art brief. Carry the fixed-camera review rubric and palette rules into that brief. Wait for owner authorization before implementing E6. Paired strip/timing import and native root/contact metadata remain E8 integration work. E9/DeepSeek stays owner-gated after E8.
