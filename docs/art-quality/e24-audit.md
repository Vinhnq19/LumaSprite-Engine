# E2.4 game-scene art audit

The engineering checkpoint for E2.3 is `659b717`. E2.4 refines Barrel Wide, Barrel Tall and Travel. The Project Owner's acceptance remains **PENDING_HUMAN_REVIEW**. [Review gallery](../../benchmarks/results/e24/README.md) · [Owner score sheet](../../benchmarks/results/e24/review.md)

## Targeted changes at 1×

| Prop | Change | Remaining observation |
| --- | --- | --- |
| Barrel Wide | Both iron hoops drop from three pixels to two and use a shorter highlight. The lower hoop sits one row down. | The two hoops still read clearly and the uninterrupted wood face is larger. Check that the lower hoop remains visible in the locked preview. |
| Barrel Tall | The upper hoop sits two rows lower. The body uses five broader stave regions and the rim loses its interior grain line. | The visible wood between rim and upper hoop reads as one piece. Some stave boundaries still merge in the locked palette. |
| Travel Chest | A light plane on the front rail and feet separates the base from dark ground while the side trim retains the shadow ramp. | The short rail highlight is visible. Check if it draws too much attention away from the latch on bright ground. |

The silhouettes and occupied bounds of all three are unchanged. Compact, Domed and Crate reproduce their E2.3 pixels. The gallery compares before and after on the same light and dark mattes at 1×, with 4× inspection images.

## Set consistency

- **Outdoor RPG.** Compact, Travel, Barrel Wide and Crate share a floor line beside a native 32×32 traveler. Travel's bounding width is 30 pixels versus 26 for the traveler. The barrel and Crate read as large storage props. The warm path lowers contrast at some wood edges, especially where the sprite crosses the grass transition.
- **Dark Dungeon.** Barrel Tall, Domed, Travel and Crate sit on a dark red-brown floor. The revised Travel rail remains visible while its contour still separates it from the ground. The tall Barrel rim is distinct from its upper hoop. In locked colors the value separation between wood and iron is much weaker.
- **Neutral comparison.** All six use the same bottom-center pivot convention and one source pixel per scene pixel. The visible footprints are Compact 27×18, Domed 29×22, Travel 30×23, Crate 28×23, Barrel Wide 28×25 and Barrel Tall 22×31. The common upper-left light, cool iron and dark one-pixel contour read consistently. The tall Barrel reaches the top of its 32×32 frame and needs the same scene pivot rule as the others.

The two contextual scenes use existing CC0 pixel art from Kenney and Eldiran. The fixture notice identifies the selected files and the magenta-key conversion on the character crop. No filtering, invented light effects, runtime gameplay or AI was used. [Fixture provenance](../../benchmarks/fixtures/e24/README.md)

## Palette policy

Both modes are technically valid. The Studio four-ink sample is **PALETTE_LIMITED**. It maps the five authored wood tones to three inks and three iron tones to two. The representative wood and iron midtones map to the same blue. Their 8-bit brightness gap drops from 17 to 0. The structured warnings describe ramp compression, ink collision and contrast loss. The gap is a review cue for the selected ramps. Scene readability still needs human judgment.

The benchmark and CLI expose the warning codes, metrics and mapped ramps. The Engine logs them for v1 jobs and the request palette remains authoritative. **ARTISTICALLY_ACCEPTED** is reserved for the owner's decision. The proposed **Wood & Iron** Studio palette includes the authored swatches and transparent RGBA zero. A future Studio picker can preview it and pass the chosen values through the existing palette field. [Preset JSON](../../benchmarks/results/e24/wood-iron-preset.json)

## Geometry generalization

Chest and Crate use the same projected faces and face-space attachments. Barrel uses an ellipse and rounded wall projection, and shares the wood plane values, palette mapping, iron ramp, contour compositor and QA path. These primitives cover the current tapered boxes and one-axis curved volumes. The barrel's stave sections, hoop heights and rim are still object-specific, as are the chest's lock and the crate's diagonal brace. Lighting is fixed to upper-left. Metal placement rules depend on the host surface.

A prop in an existing family can use new dimensions without touching the compositor. A new family still requires an AssetSpec case and a dispatch branch in `renderAsset`. That small boundary is sufficient at the current size. A pluggable registry, scene graph and 3D layer would add complexity before the current primitives hit a demonstrated limit. A wooden bucket with an open rim is a useful later check for concavity and rim occlusion.

## Release decision

E2.4 engineering supports an owner review of the set as one game scene. Advance to E3 after that review, using the approved prop set to test terrain scale, seams, placement and background contrast. Keep E4 behind a separate runtime provider and budget decision. The observed gaps in the locked palette are best tested with the proposed swatch picker first.
