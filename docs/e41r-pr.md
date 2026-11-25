# Draft PR · E4.1R silhouette refinement

The branch `codex/e4-1r-silhouette-refinement` starts from `a1fcd76`. Compare it against `codex/e4-character-geometry` once the geometry checkpoint is available remotely.

- Add CharacterSpec v2 with declared standing or forward-step intent, torso turn and an explicit relative ground projection for the secondary foot.
- Add Grounded and Forward-Step Surveyor through shared body geometry. Both use alternate grip and stance geometry with the existing palette and renderer.
- Verify both projected feet, silhouette and clearance on the raster. Keep A, B and the E3 fixtures byte-locked. Compare all four in the offline review gallery.

Recommend B1 for standing silhouette review. E4.2 awaits a Project Owner decision. [Art audit](art-quality/e41r-audit.md) · [Tests](e41r-test-report.md) · [Gallery](LumaSprite-Engine-E4.1R-Report.html)

```sh
git push -u origin codex/e4-1r-silhouette-refinement
```
