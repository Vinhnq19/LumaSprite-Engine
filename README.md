# LumaSprite Engine

LumaSprite Engine is an offline-first pixel art backend. The first vertical slice renders a 32×32 wooden supply chest with iron bands from a validated AssetSpec. It delivers PNGs for human review and a localhost adapter for LumaSprite Studio.

## Run locally

Use Node.js 24 LTS or newer.

```sh
npm ci
npm run build
npm run generate
npm run generate -- --design barrel-wide
npm run generate -- --design travel --seed 43 --out benchmarks/results/run/chest-43.png
npm run generate -- --spec benchmarks/results/sample/chest-42.json
npm run benchmark
npm run benchmark:e2
npm run benchmark:e23
npm run benchmark:e24
npm run terrain
npm run benchmark:e3
npm run report:e3
npm run benchmark:e32
npm run report:e32
npm run benchmark:e33
npm run report:e33
npm run benchmark:e34
npm run report:e34
npm run character -- --candidate a
npm run benchmark:e41
npm run report:e41
npm run benchmark:e41r
npm run report:e41r
npm run benchmark:e42
npm run report:e42
npm run benchmark:e43
npm run report:e43
npm run serve -- --port 4399
```

Generation and benchmarks write into `benchmarks/results/run/` by default. The [E2.4 game-scene gallery](benchmarks/results/e24/README.md) shows the six props and the three native-size benchmark scenes in both palettes. The [E2.3 gallery](benchmarks/results/e23/README.md) shows two barrel proportions and the refined chest and crate designs with locked-palette and game-scene previews. The [E2.1/E2.2 gallery](benchmarks/results/e2/README.md) preserves their first versions. The [baseline gallery](benchmarks/results/sample/README.md) preserves the original Seed 42 and 43 renders.

The [unified E2–E3.1 report](docs/LumaSprite-Engine-Report.html) contains the E2 owner decision, the terrain atlas, native map previews, palette comparisons and QA. The standalone `npm run terrain` command writes a PNG atlas and JSON manifest. Pass `--spec` with a TerrainSpec JSON object to override the default seed, palette or surface. [Studio tilemap workflow](docs/integration/studio-tilemap-contract.md)

The terrain CLI defaults to TerrainSpec v3. Supply a saved v1 or v2 spec to reproduce that edition. Pass `--map` with rows and a tile origin for world-space variation. Add `--bake` for a package that includes the canonical atlas, map PNG, layout and integrity hashes. Run `npm run terrain -- --verify <directory>` to check a package. [E3.3 single-file report](docs/LumaSprite-Engine-E3.3-Report.html) · [Studio import and parity](docs/integration/studio-terrain-production.md) · [E3.2 offline report](docs/LumaSprite-Engine-E3.2-Report.html)

For TerrainSpec v4, the Project Owner selected Art-Directed Terrain for Authored/Project and baked raster. Pass it with `--spec` or use Conservative Polish as an optional preset. [Art-directed spec](benchmarks/results/e34/b-spec.json) · [Conservative spec](benchmarks/results/e34/a-spec.json) · [E3 final acceptance](docs/e3-final-acceptance.md)

`npm run character -- --candidate a` produces a flat PNG, silhouette and geometry JSON for E4.1 review. Select `b` for Taller Surveyor or pass `--spec` with a CharacterSpec v1 JSON. [E4.1 shape gallery](docs/LumaSprite-Engine-E4.1-Report.html) · [Character architecture](docs/architecture/character-geometry.md)

Select `b1` for Grounded Surveyor or `b2` for Forward-Step Surveyor on the same CLI. Their CharacterSpec v2 records the pose intent, torso turn and projected ground offset, and their diagnostic bundle separates structure, pose constraints and visual review. [E4.1R review](docs/LumaSprite-Engine-E4.1R-Report.html)

Use `npm run character -- --material m2 --shape-lock benchmarks/results/e42/b1-shape-lock.json` for the B1 material review bundle. M1 uses `--material m1`. [Material architecture](docs/architecture/character-materials.md) · [E4.2 review](docs/LumaSprite-Engine-E4.2-Report.html)

E4 closed with Surveyor R2 + M2P and the E4.4 revised Forest Courier as approved single-view baselines. Verify a character package with `npm run character -- --verify-package <package-directory>`. [E4 final acceptance](docs/e4-final-acceptance.md) · [Character package index](benchmarks/results/e44/README.md)

E5.1 adds a four-frame Surveyor idle, AnimationSpec v1 and verified PNG strip/timing export. Run `npm run benchmark:e51` or use the animation CLI after building. [Idle gallery](docs/LumaSprite-Engine-E5.1-Report.html) · [Animation architecture](docs/architecture/animation-foundation.md)

## Verify

```sh
npm run lint
npm run typecheck
npm run build
npm test
npm run smoke
```

Unit tests use the local planner and simulated provider responses. HTTP tests bind and connect through loopback. Run `npm run test:studio` with a built sibling Studio checkout to exercise the real Studio API using temporary Engine-side project data.

- [Architecture and AssetSpec](docs/architecture/overview.md)
- [Art review and Studio palette preview](docs/art-quality/review.md)
- [Studio Adapter v1](docs/integration/studio-adapter.md)
- [Roadmap](docs/roadmap.md)
- [Bootstrap report](docs/bootstrap.md) and [test evidence](docs/test-report.md)
- [Handoff](HANDOFF.md)
