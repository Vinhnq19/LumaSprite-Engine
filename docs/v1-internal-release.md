# LumaSprite Engine v1 · Internal release

## Acceptance record

**`ENGINE_V1_RC_ACCEPTED_FOR_INTERNAL_USE_WITH_EXCEPTIONS`** · 2026-11-28 ICT.

The Project Owner directed this internal acceptance in the current conversation. The attached assistant-prepared record is preserved byte-for-byte. This entry records the directive and its scope. Signature status is `NOT_PROVIDED`. [Supplied record](../../LumaSprite-Coordination/LUMASPRITE-V1-RC-INTERNAL-ACCEPTANCE.md)

| Decision | Status |
| --- | --- |
| Internal Windows RC | `INTERNAL_USE_ONLY` for use, QA, benchmarking, AI research preparation and Studio/Unity integration |
| Release gates | `ENGINE_V1_RC_ACCEPTED_INTERNAL_WITH_EXCEPTIONS` and `ENGINE_V1_CORE_FROZEN` |
| Unrestricted `ENGINE_V1_OWNER_ACCEPTED` | `NOT_GRANTED` |
| Physical keyboard playthrough | `NOT_RUN` |
| Visible-window HUD review | `NOT_RUN` |
| Public distribution | `NOT_APPROVED` |
| Game-ready art | `NOT_APPROVED` |

The manual checklist remains open with its review fields blank. The transparent framebuffer from the hidden Player run remains a capture failure. [Physical review checklist](../../LumaSprite-Coordination/ENGINE-V1-OWNER-CHECK.md) · [Locked readiness evidence](reports/LUMASPRITE-ENGINE-V1-RELEASE-READINESS.html)

## Release notes

- Frozen core covers deterministic rendering, PNG/RGBA and palette validation, masks and ordered layers, masked component revisions and rollback. Existing procedural defaults and Studio Adapter v1 retain the behavior of the pinned source build.
- CLI supports file-based component intake and verified export. The offline Windows ZIP contains compiled runtime and two locked dependencies. Studio integration and Unity E8.5 runtime results remain pinned evidence.
- GitHub's offline suite now runs 86 Engine tests. The E8.5 Studio integration is one separate test. Together these account for the 87/87 Engine checkpoint. Studio's 107/107 result is the recorded read-only checkpoint.
- Engine v1 is the internal scope name. The locked npm metadata is `0.1.0`, package `lumasprite-engine`, Node.js `>=24`. The ZIP is the internal RC. Public version numbering and tagging require the Owner's separate release decision.

| Evidence | Pinned value |
| --- | --- |
| Build commit | `c919d4aee3c55df6f1e61519f6fa83826ad8f453` |
| Readiness report commit | `09b888a96662f154df1418f0c53eec8284d87003` |
| Engine engineering checkpoint | `923662e04785c92736a41015987e876508252ce1` on `codex/e10-v1-release-readiness` |
| Verified main merge | `e55ff254dffd0682d06c6d843d2de6ef240ad612` |
| Studio checkpoint | `471ac90555d3545beff5182146e291ba97b9ae20` |
| Integrity recheck | 805 historical SHA-256, 3,386 manifest entries, all 38 old reports, 1,119 RC payloads |
| RC file | `.cache/e10-v1/release/LumaSprite-Engine-v1-Windows-RC.zip` |
| RC SHA-256 | `b0cac7eb889d8f0fd92128a7b9f9275612b52f13d1a7540ad873becf825dc299` |
| Approval source SHA-256 | `bc846e1cb5d875857fb874041456cc912adec24068ac06ddde6cb1027cef2ff7` |

The build is an ancestor of the readiness commit and the CI-fix checkpoint. The CI-fix checkpoint is part of the verified main merge. GitHub's push, PR #6 sync and main-merge CI passed. The RC retains the exact original build bits. [CI for the main merge](https://github.com/Vinhnq19/LumaSprite-Engine/actions/runs/46144427802)

The ZIP carries MIT notices for pngjs 7.0.0 and Zod 4.6.7 and the adapted-code notices. Release audit verified the lock. The current-tree credential-pattern scan found zero matches and the npm audit found zero advisories at closeout. Project-level redistribution permission and asset grants remain unresolved.

Before closeout, the working tree contained prior edits to `HANDOFF.md` and `docs/reports/INDEX.md`. The PR draft includes the updated handoff. The existing Report Index edit stays outside the draft.

## Local PR draft and release plan

**Draft title** · docs(engine): record v1 internal RC closeout

**Base and head** · `main` ← existing `codex/e10-v1-release-readiness` branch. PR #6 is the already merged engineering PR. This draft covers the closeout documentation following it.

**Summary for reviewers**

- Record the Owner-directed internal RC decision and both manual exceptions.
- Document the frozen source, verified ZIP, version metadata and installation steps.
- Keep the Engine and Studio checkpoints, original reports and RC available for rollback.

**Validation** · Check the documentation-only diff, ancestry, protected hashes, [CI](https://github.com/Vinhnq19/LumaSprite-Engine/actions/runs/46144427802) and [known limitations](known-limitations.md). The Owner controls authorization to push, merge, tag or publish. Read the PR diff and check the target branch tip again before those actions.

**Release artifact** · Reuse the verified RC for the approved internal scope. A later approved packaging run writes a new directory and uses a distinct artifact identity. Bind any approved tag or release record to its exact source and ZIP digest, and document manual test and distribution decisions there.

**Rollback** · Install from the pinned RC ZIP into a separate directory after checking its SHA-256. For component rollback, choose the prior verified package with `component --verify`. For a later Git change accepted by the Owner, prepare a focused revert on the affected history with approval. Preserve the release branch and the locked artifacts.

[Installation](installation.md) · [Scope](v1-scope.md) · [Change history](../CHANGELOG.md) · [Current handoff](../HANDOFF.md)
