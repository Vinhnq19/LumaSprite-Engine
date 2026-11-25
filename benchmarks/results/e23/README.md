# E2.3 prop quality benchmark

Review each 1× image first. Then inspect the shape and material transitions at 4×.

| Design | Final 1× | Flat 1× | Silhouette 1× | Final 4× |
| --- | --- | --- | --- | --- |
| Compact rectangular supply chest | ![Compact rectangular supply chest native size](compact-1x.png) | ![Compact rectangular supply chest flat colors](compact-flat.png) | ![Compact rectangular supply chest silhouette](compact-silhouette.png) | ![Compact rectangular supply chest nearest-neighbor enlargement](compact-4x.png) |
| Domed-lid fantasy chest | ![Domed-lid fantasy chest native size](domed-1x.png) | ![Domed-lid fantasy chest flat colors](domed-flat.png) | ![Domed-lid fantasy chest silhouette](domed-silhouette.png) | ![Domed-lid fantasy chest nearest-neighbor enlargement](domed-4x.png) |
| Reinforced travel chest | ![Reinforced travel chest native size](travel-1x.png) | ![Reinforced travel chest flat colors](travel-flat.png) | ![Reinforced travel chest silhouette](travel-silhouette.png) | ![Reinforced travel chest nearest-neighbor enlargement](travel-4x.png) |
| Reinforced wooden crate | ![Reinforced wooden crate native size](crate-1x.png) | ![Reinforced wooden crate flat colors](crate-flat.png) | ![Reinforced wooden crate silhouette](crate-silhouette.png) | ![Reinforced wooden crate nearest-neighbor enlargement](crate-4x.png) |
| Fantasy wooden barrel · wide | ![Fantasy wooden barrel · wide native size](barrel-wide-1x.png) | ![Fantasy wooden barrel · wide flat colors](barrel-wide-flat.png) | ![Fantasy wooden barrel · wide silhouette](barrel-wide-silhouette.png) | ![Fantasy wooden barrel · wide nearest-neighbor enlargement](barrel-wide-4x.png) |
| Fantasy wooden barrel · tall | ![Fantasy wooden barrel · tall native size](barrel-tall-1x.png) | ![Fantasy wooden barrel · tall flat colors](barrel-tall-flat.png) | ![Fantasy wooden barrel · tall silhouette](barrel-tall-silhouette.png) | ![Fantasy wooden barrel · tall nearest-neighbor enlargement](barrel-tall-4x.png) |

## Seed 42 before and after

| Baseline 1× | Domed 1× | Baseline 4× | Domed 4× |
| --- | --- | --- | --- |
| ![Baseline 42 actual size](baseline-42-1x.png) | ![Domed 42 actual size](domed-1x.png) | ![Baseline 42 zoom](baseline-42-4x.png) | ![Domed 42 zoom](domed-4x.png) |

Baseline PNG SHA-256 · `a179df270c7c02cd88c28787253bcfd43d6fca6d281e6482a7822ae342fd72e0`

## E2.1/E2.2 compared with E2.3

| Design | Before 1× | After 1× | Before 4× | After 4× |
| --- | --- | --- | --- | --- |
| Compact rectangular supply chest | ![Before native size](before-compact-1x.png) | ![Refined native size](compact-1x.png) | ![Before enlarged](before-compact-4x.png) | ![Refined enlarged](compact-4x.png) |
| Domed-lid fantasy chest | ![Before native size](before-domed-1x.png) | ![Refined native size](domed-1x.png) | ![Before enlarged](before-domed-4x.png) | ![Refined enlarged](domed-4x.png) |
| Reinforced travel chest | ![Before native size](before-travel-1x.png) | ![Refined native size](travel-1x.png) | ![Before enlarged](before-travel-4x.png) | ![Refined enlarged](travel-4x.png) |
| Reinforced wooden crate | ![Before native size](before-crate-1x.png) | ![Refined native size](crate-1x.png) | ![Before enlarged](before-crate-4x.png) | ![Refined enlarged](crate-4x.png) |

## Game context at 1×

| Design | Light ground | Dark ground | 96×64 tile scene | Locked palette 1× |
| --- | --- | --- | --- | --- |
| Compact rectangular supply chest | ![Compact rectangular supply chest on a light background](compact-light.png) | ![Compact rectangular supply chest on a dark background](compact-dark.png) | ![Compact rectangular supply chest beside another prop on tiles](compact-scene.png) | ![Compact rectangular supply chest with Studio locked colors](compact-locked.png) |
| Domed-lid fantasy chest | ![Domed-lid fantasy chest on a light background](domed-light.png) | ![Domed-lid fantasy chest on a dark background](domed-dark.png) | ![Domed-lid fantasy chest beside another prop on tiles](domed-scene.png) | ![Domed-lid fantasy chest with Studio locked colors](domed-locked.png) |
| Reinforced travel chest | ![Reinforced travel chest on a light background](travel-light.png) | ![Reinforced travel chest on a dark background](travel-dark.png) | ![Reinforced travel chest beside another prop on tiles](travel-scene.png) | ![Reinforced travel chest with Studio locked colors](travel-locked.png) |
| Reinforced wooden crate | ![Reinforced wooden crate on a light background](crate-light.png) | ![Reinforced wooden crate on a dark background](crate-dark.png) | ![Reinforced wooden crate beside another prop on tiles](crate-scene.png) | ![Reinforced wooden crate with Studio locked colors](crate-locked.png) |
| Fantasy wooden barrel · wide | ![Fantasy wooden barrel · wide on a light background](barrel-wide-light.png) | ![Fantasy wooden barrel · wide on a dark background](barrel-wide-dark.png) | ![Fantasy wooden barrel · wide beside another prop on tiles](barrel-wide-scene.png) | ![Fantasy wooden barrel · wide with Studio locked colors](barrel-wide-locked.png) |
| Fantasy wooden barrel · tall | ![Fantasy wooden barrel · tall on a light background](barrel-tall-light.png) | ![Fantasy wooden barrel · tall on a dark background](barrel-tall-dark.png) | ![Fantasy wooden barrel · tall beside another prop on tiles](barrel-tall-scene.png) | ![Fantasy wooden barrel · tall with Studio locked colors](barrel-tall-locked.png) |

## Palettes and evidence

Authored · ![Authored palette swatches](authored-swatches.png) · #201a24 · #4a2927 · #723e2c · #a15a36 · #ca8248 · #eea761 · #343344 · #51546a · #777d8b · #935630 · #e0a051 · #ffe3a0

Studio locked · ![Studio locked palette swatches](locked-swatches.png) · #1c2434 · #536da0 · #f7ba5b · #eaf1f7

- Compact rectangular supply chest · [shape configuration](compact-spec.json) · [technical diagnostics](compact-qa.json)
- Domed-lid fantasy chest · [shape configuration](domed-spec.json) · [technical diagnostics](domed-qa.json)
- Reinforced travel chest · [shape configuration](travel-spec.json) · [technical diagnostics](travel-qa.json)
- Reinforced wooden crate · [shape configuration](crate-spec.json) · [technical diagnostics](crate-qa.json)
- Fantasy wooden barrel · wide · [shape configuration](barrel-wide-spec.json) · [technical diagnostics](barrel-wide-qa.json)
- Fantasy wooden barrel · tall · [shape configuration](barrel-tall-spec.json) · [technical diagnostics](barrel-tall-qa.json)

[Owner review sheet](review.md)
