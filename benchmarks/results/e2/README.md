# E2 prop quality benchmark

Review each 1× image first. Then inspect the shape and material transitions at 4×.

| Design | Final 1× | Flat 1× | Silhouette 1× | Final 4× |
| --- | --- | --- | --- | --- |
| Compact rectangular supply chest | ![Compact rectangular supply chest native size](compact-1x.png) | ![Compact rectangular supply chest flat colors](compact-flat.png) | ![Compact rectangular supply chest silhouette](compact-silhouette.png) | ![Compact rectangular supply chest nearest-neighbor enlargement](compact-4x.png) |
| Domed-lid fantasy chest | ![Domed-lid fantasy chest native size](domed-1x.png) | ![Domed-lid fantasy chest flat colors](domed-flat.png) | ![Domed-lid fantasy chest silhouette](domed-silhouette.png) | ![Domed-lid fantasy chest nearest-neighbor enlargement](domed-4x.png) |
| Reinforced travel chest | ![Reinforced travel chest native size](travel-1x.png) | ![Reinforced travel chest flat colors](travel-flat.png) | ![Reinforced travel chest silhouette](travel-silhouette.png) | ![Reinforced travel chest nearest-neighbor enlargement](travel-4x.png) |
| Reinforced wooden crate | ![Reinforced wooden crate native size](crate-1x.png) | ![Reinforced wooden crate flat colors](crate-flat.png) | ![Reinforced wooden crate silhouette](crate-silhouette.png) | ![Reinforced wooden crate nearest-neighbor enlargement](crate-4x.png) |

## Seed 42 before and after

| Baseline 1× | Domed 1× | Baseline 4× | Domed 4× |
| --- | --- | --- | --- |
| ![Baseline 42 actual size](baseline-42-1x.png) | ![Domed 42 actual size](domed-1x.png) | ![Baseline 42 zoom](baseline-42-4x.png) | ![Domed 42 zoom](domed-4x.png) |

Baseline PNG SHA-256 · `a179df270c7c02cd88c28787253bcfd43d6fca6d281e6482a7822ae342fd72e0`

## Game context at 1×

| Design | Light ground | Dark ground | 96×64 tile scene | Locked palette 1× |
| --- | --- | --- | --- | --- |
| Compact rectangular supply chest | ![Compact rectangular supply chest on a light background](compact-light.png) | ![Compact rectangular supply chest on a dark background](compact-dark.png) | ![Compact rectangular supply chest beside another prop on tiles](compact-scene.png) | ![Compact rectangular supply chest with Studio locked colors](compact-locked.png) |
| Domed-lid fantasy chest | ![Domed-lid fantasy chest on a light background](domed-light.png) | ![Domed-lid fantasy chest on a dark background](domed-dark.png) | ![Domed-lid fantasy chest beside another prop on tiles](domed-scene.png) | ![Domed-lid fantasy chest with Studio locked colors](domed-locked.png) |
| Reinforced travel chest | ![Reinforced travel chest on a light background](travel-light.png) | ![Reinforced travel chest on a dark background](travel-dark.png) | ![Reinforced travel chest beside another prop on tiles](travel-scene.png) | ![Reinforced travel chest with Studio locked colors](travel-locked.png) |
| Reinforced wooden crate | ![Reinforced wooden crate on a light background](crate-light.png) | ![Reinforced wooden crate on a dark background](crate-dark.png) | ![Reinforced wooden crate beside another prop on tiles](crate-scene.png) | ![Reinforced wooden crate with Studio locked colors](crate-locked.png) |

## Palettes and evidence

Authored · ![Authored palette swatches](authored-swatches.png) · #201a24 · #4a2927 · #723e2c · #a15a36 · #ca8248 · #eea761 · #343344 · #51546a · #777d8b · #935630 · #e0a051 · #ffe3a0

Studio locked · ![Studio locked palette swatches](locked-swatches.png) · #1c2434 · #536da0 · #f7ba5b · #eaf1f7

- Compact rectangular supply chest · [shape configuration](compact-spec.json) · [technical diagnostics](compact-qa.json)
- Domed-lid fantasy chest · [shape configuration](domed-spec.json) · [technical diagnostics](domed-qa.json)
- Reinforced travel chest · [shape configuration](travel-spec.json) · [technical diagnostics](travel-qa.json)
- Reinforced wooden crate · [shape configuration](crate-spec.json) · [technical diagnostics](crate-qa.json)

[Owner review sheet](review.md)
