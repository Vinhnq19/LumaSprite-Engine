# E2.4 prop review

Start at 1×. Inspect 4× only for clusters and outlines. The native scene pixels and sprite pixels have the same scale.

| Prop | Authored 1× | Locked 1× | Authored 4× | Locked 4× | Evidence |
| --- | --- | --- | --- | --- | --- |
| Compact Chest | ![Compact Chest native size](compact-1x.png) | ![Compact Chest Studio locked palette native size](compact-locked-1x.png) | ![Compact Chest enlarged nearest-neighbor](compact-4x.png) | ![Compact Chest Studio locked palette enlarged](compact-locked-4x.png) | [Spec](compact-spec.json) · [QA](compact-qa.json) |
| Domed Chest | ![Domed Chest native size](domed-1x.png) | ![Domed Chest Studio locked palette native size](domed-locked-1x.png) | ![Domed Chest enlarged nearest-neighbor](domed-4x.png) | ![Domed Chest Studio locked palette enlarged](domed-locked-4x.png) | [Spec](domed-spec.json) · [QA](domed-qa.json) |
| Travel Chest | ![Travel Chest native size](travel-1x.png) | ![Travel Chest Studio locked palette native size](travel-locked-1x.png) | ![Travel Chest enlarged nearest-neighbor](travel-4x.png) | ![Travel Chest Studio locked palette enlarged](travel-locked-4x.png) | [Spec](travel-spec.json) · [QA](travel-qa.json) |
| Crate | ![Crate native size](crate-1x.png) | ![Crate Studio locked palette native size](crate-locked-1x.png) | ![Crate enlarged nearest-neighbor](crate-4x.png) | ![Crate Studio locked palette enlarged](crate-locked-4x.png) | [Spec](crate-spec.json) · [QA](crate-qa.json) |
| Barrel Wide | ![Barrel Wide native size](barrel-wide-1x.png) | ![Barrel Wide Studio locked palette native size](barrel-wide-locked-1x.png) | ![Barrel Wide enlarged nearest-neighbor](barrel-wide-4x.png) | ![Barrel Wide Studio locked palette enlarged](barrel-wide-locked-4x.png) | [Spec](barrel-wide-spec.json) · [QA](barrel-wide-qa.json) |
| Barrel Tall | ![Barrel Tall native size](barrel-tall-1x.png) | ![Barrel Tall Studio locked palette native size](barrel-tall-locked-1x.png) | ![Barrel Tall enlarged nearest-neighbor](barrel-tall-4x.png) | ![Barrel Tall Studio locked palette enlarged](barrel-tall-locked-4x.png) | [Spec](barrel-tall-spec.json) · [QA](barrel-tall-qa.json) |

## Refinements against E2.3

The before/after images use identical backgrounds and the same 32×32 canvas.

| Prop | Before 1× light | After 1× light | Before 1× dark | After 1× dark |
| --- | --- | --- | --- | --- |
| Travel Chest | ![Travel Chest before on light](travel-before-light.png) | ![Travel Chest after on light](travel-after-light.png) | ![Travel Chest before on dark](travel-before-dark.png) | ![Travel Chest after on dark](travel-after-dark.png) |
| 4× nearest-neighbor | [Before Travel Chest](travel-before-4x.png) | [After Travel Chest](travel-4x.png) |  |  |
| Barrel Wide | ![Barrel Wide before on light](barrel-wide-before-light.png) | ![Barrel Wide after on light](barrel-wide-after-light.png) | ![Barrel Wide before on dark](barrel-wide-before-dark.png) | ![Barrel Wide after on dark](barrel-wide-after-dark.png) |
| 4× nearest-neighbor | [Before Barrel Wide](barrel-wide-before-4x.png) | [After Barrel Wide](barrel-wide-4x.png) |  |  |
| Barrel Tall | ![Barrel Tall before on light](barrel-tall-before-light.png) | ![Barrel Tall after on light](barrel-tall-after-light.png) | ![Barrel Tall before on dark](barrel-tall-before-dark.png) | ![Barrel Tall after on dark](barrel-tall-after-dark.png) |
| 4× nearest-neighbor | [Before Barrel Tall](barrel-tall-before-4x.png) | [After Barrel Tall](barrel-tall-4x.png) |  |  |

## Three game scenes at 1×

The bottom-center pivot uses one row below the last opaque pixel. Each scene aligns every pivot to its ground row. Outdoor includes the 32×32 traveler for scale.

| Scene | Authored | Studio locked | Layout |
| --- | --- | --- | --- |
| Outdoor RPG | ![Outdoor RPG authored at 1×](outdoor-authored-1x.png) | ![Outdoor RPG locked at 1×](outdoor-locked-1x.png) | [Layout](outdoor-layout.json) |
| Dark dungeon storage | ![Dark dungeon storage authored at 1×](dungeon-authored-1x.png) | ![Dark dungeon storage locked at 1×](dungeon-locked-1x.png) | [Layout](dungeon-layout.json) |
| Neutral comparison | ![Neutral comparison authored at 1×](neutral-authored-1x.png) | ![Neutral comparison locked at 1×](neutral-locked-1x.png) | [Layout](neutral-layout.json) |

## Palette validation

| Prop | Authored | Studio locked | Wood tones | Iron tones | Midtone gap |
| --- | --- | --- | --- | --- | --- |
| Compact Chest | FULL_RAMP | PALETTE_LIMITED | 3/5 | 2/3 | 0 vs 17 |
| Domed Chest | FULL_RAMP | PALETTE_LIMITED | 3/5 | 2/3 | 0 vs 17 |
| Travel Chest | FULL_RAMP | PALETTE_LIMITED | 3/5 | 2/3 | 0 vs 17 |
| Crate | FULL_RAMP | PALETTE_LIMITED | 3/5 | 2/3 | 0 vs 17 |
| Barrel Wide | FULL_RAMP | PALETTE_LIMITED | 3/5 | 2/3 | 0 vs 17 |
| Barrel Tall | FULL_RAMP | PALETTE_LIMITED | 3/5 | 2/3 | 0 vs 17 |

Technical validity and palette warnings are recorded independently. Artistic status stays **PENDING_HUMAN_REVIEW**.

![Proposed wood and iron preset swatches](wood-iron-swatches.png) · [Proposed preset](wood-iron-preset.json)

![Current Studio locked palette swatches](studio-locked-swatches.png) · #1c2434 · #536da0 · #f7ba5b · #eaf1f7

[Owner review sheet](review.md)
