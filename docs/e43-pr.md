# Draft PR · E4.3 character production validation

Branch `codex/e4-3-character-production` is based on E4.2 `67875ec`. Use `codex/e4-2-character-materials` as the PR base.

- Add M2P material-only polish with identical B1 alpha, landmarks, pose and part masks.
- Compare M1, M2 and M2P across Outdoor, Dungeon, neutral lineup and a stocked path at native size.
- Establish a second 64 × 64 technical pilot, Forest Courier, through the shared solver and material renderer.
- Deliver versioned packages and exact Studio save/reopen, backup/restore and revision-conflict results. Keep game art approval and geometry proposals in the human review.

[Report](LumaSprite-Engine-E4.3-Report.html) · [Technical QA](e43-test-report.md) · [Production architecture](architecture/character-production.md)

```sh
git push -u origin codex/e4-3-character-production
```
