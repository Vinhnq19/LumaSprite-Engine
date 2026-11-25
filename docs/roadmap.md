# Roadmap

| Stage | Deliverable |
| --- | --- |
| E0 | Bootstrap, offline tooling and CI gates |
| E1 | Validated AssetSpec v1, deterministic Pixel Core and supply-chest review |
| E2 | Refine the approved prop workflow and expand material and shape primitives |
| E3 | Tilesets with neighbor and seam checks |
| E4 | Character sprites with stable scale, anchor and silhouettes |
| E5 | Animation, frame constraints and export checks |
| E6 | Expand Studio capabilities with verified contracts as generators ship |
| E7 | Evaluate runtime planning and refinement within an owner-approved budget, then benchmark comparable briefs |

The bootstrap is an E0–E1 slice with a minimal local Studio adapter. Progress beyond it depends on the first art review.

## Roadmap update on 2026-11-25

The table above records the original plan. The Project Owner approved E2 engineering and the authored 32×32 art baseline. E0–E2 milestones retain their original scope and history. Local Engine development now comes before runtime AI.

| Stage | Current direction |
| --- | --- |
| E3 | Tileset and Terrain. E3.1 generates the Grass & Dirt MVP and is ready for owner review. |
| E4 | Character Geometry & Pose |
| E5 | Animation |
| E6 | Environment, UI and VFX |
| E7 | Universal Quality & Refinement |
| E8 | Studio Production Integration |
| E9 | DeepSeek integration after the local Engine is mature and the Project Owner authorizes it |

The existing E0 provider scaffold remains disabled. Planner, vision, refinement, retry, API cost and orchestration work are deferred to E9.

## E3.2 checkpoint update

The Project Owner approved E3.1 engineering at `ad7cdbc` and requested terrain art refinement. E3.2 adds stepped banks, material densities and world-space texture previews while preserving the Studio atlas contract. E3.2 engineering passes and its art remains pending review. [Review report](LumaSprite-Engine-E3.2-Report.html)

Wait for the owner's terrain review before E4. DeepSeek development remains deferred through E8. E9 requires completion of the local Engine stages and explicit Project Owner approval.

## E3.3 checkpoint update

ChatGPT recommended the E3.2 artistic baseline in Authored/Project palettes. E3.3 can ship world-space texture as a verifiable baked PNG and retains the canonical atlas for editable Studio maps. The candidate is ready for final art review. The Project Owner's E3 decision still gates E4. [E3.3 review gallery](LumaSprite-Engine-E3.3-Report.html)
