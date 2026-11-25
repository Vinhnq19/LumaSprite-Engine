# Draft PR · E4.2 B1 character materials

Branch `codex/e4-2-character-materials` starts at E4.1R `58b2d4c`. Use `codex/e4-1r-silhouette-refinement` as the PR base.

- Add an explicit B1 shape lock and a pixel-owned shading pass with two material styles.
- Reuse the existing humanoid geometry, Pixel Core and approved pose to render M1/M2 with authored, project and locked palette policies.
- Deliver an offline 1×/4× gallery, closeups, material masks, dark/bright comparisons and E2/E3 scene context.
- Verify masks, palette diagnostics, the frozen geometry, PNG, deterministic output and Studio draft-profile round-trip. Material and game-ready approval remain owner decisions.

[Architecture](architecture/character-materials.md) · [QA](e42-test-report.md) · [Review gallery](LumaSprite-Engine-E4.2-Report.html)

```sh
git push -u origin codex/e4-2-character-materials
```
