# E3.4 terrain review artifacts

[Single-file review gallery](../../../docs/LumaSprite-Engine-E3.4-Report.html) · [Owner score sheet](review.md) · [Engine QA](qa.json) · [Studio parity](studio/parity.json)

| Scene | E3.3 at 1× | Candidate A at 1× | Candidate B at 1× | Nearest-neighbor 4× |
| --- | --- | --- | --- | --- |
| Organic RPG Clearing | [E3.3 renderer](e33-organic-1x.png) | [A](packages/a-organic/map.png) | [B](packages/b-organic/map.png) | [E3.3](e33-organic-4x.png) · [A](a-organic-4x.png) · [B](b-organic-4x.png) |
| Outdoor RPG | [Locked](../e33/packages/outdoor/map.png) | [A](packages/a-outdoor/map.png) | [B](packages/b-outdoor/map.png) | [E3.3](../e33/outdoor-4x.png) · [A](a-outdoor-4x.png) · [B](b-outdoor-4x.png) |
| Large Grass/Dirt | [Locked](../e33/packages/large/map.png) | [A](packages/a-large/map.png) | [B](packages/b-large/map.png) | [E3.3](../e33/large-4x.png) · [A](a-large-4x.png) · [B](b-large-4x.png) |
| Transition Stress | [Locked](../e33/packages/stress/map.png) | [A](packages/a-stress/map.png) | [B](packages/b-stress/map.png) | [E3.3](../e33/stress-4x.png) · [A](a-stress-4x.png) · [B](b-stress-4x.png) |
| Dungeon / Storage | [E3.3 renderer](e33-storage-1x.png) | [A](packages/a-storage/map.png) | [B](packages/b-storage/map.png) | [E3.3](e33-storage-4x.png) · [A](a-storage-4x.png) · [B](b-storage-4x.png) |

Each directory under `packages/` contains the verification manifest, finished PNG, atlas and overlays used for that scene. [Organic layout source](organic-layout.json) · [Organic A manifest](packages/a-organic/map.json) · [Organic B manifest](packages/b-organic/map.json)

All images are Engine renders or Studio module exports from the matching fixture. Authored props and the CC0 traveler come from the E3.3 Outdoor package. The Dungeon wall uses the repeat of the existing CC0 wall tile. [Asset provenance](../../fixtures/e24/README.md)
