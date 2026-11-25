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

## E3.4 checkpoint update

The Project Owner approved E3.3 engineering and static-background production bake, and requested a bounded final art refinement. E3.4 delivers two candidate treatments for review. The owner's final E3 decision still gates E4. Editable world detail in Studio remains part of E8. [E3.4 review gallery](LumaSprite-Engine-E3.4-Report.html)

## E3 closeout and E4.1 shape review

The Project Owner selected E3.4 B under Authored/Project for static baked raster backgrounds. E3 is closed with the recorded art limitations. E4.1 delivers two validated Field Surveyor poses. The next E4.2 material pass depends on the owner's silhouette decision. [E3 decision](e3-final-acceptance.md) · [E4.1 shape gallery](LumaSprite-Engine-E4.1-Report.html)

E4.1R refines the Taller Surveyor silhouette into B1 for standing and B2 for a forward step. The owner can compare both with the original A/B checkpoint before choosing a silhouette for materials. [E4.1R review](LumaSprite-Engine-E4.1R-Report.html)

E4.2 uses the approved-with-notes B1 geometry for two material treatments. The owner can choose a material candidate before E4.3 scale, scene and export validation. [E4.2 review](LumaSprite-Engine-E4.2-Report.html)
