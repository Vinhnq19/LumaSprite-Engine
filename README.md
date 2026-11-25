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
npm run serve -- --port 4399
```

Generation and benchmarks write into `benchmarks/results/run/` by default. The [E2.4 game-scene gallery](benchmarks/results/e24/README.md) shows the six props and the three native-size benchmark scenes in both palettes. The [E2.3 gallery](benchmarks/results/e23/README.md) shows two barrel proportions and the refined chest and crate designs with locked-palette and game-scene previews. The [E2.1/E2.2 gallery](benchmarks/results/e2/README.md) preserves their first versions. The [baseline gallery](benchmarks/results/sample/README.md) preserves the original Seed 42 and 43 renders.

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
