# LumaSprite Engine

LumaSprite Engine is an offline-first pixel art backend. The first vertical slice renders a 32×32 wooden supply chest with iron bands from a validated AssetSpec. It delivers PNGs for human review and a localhost adapter for LumaSprite Studio.

## Run locally

Use Node.js 24 LTS or newer.

```sh
npm ci
npm run build
npm run generate
npm run generate -- --seed 43 --out benchmarks/results/run/chest-43.png
npm run generate -- --spec benchmarks/results/sample/chest-42.json
npm run benchmark
npm run serve -- --port 4399
```

Generation and benchmarks write into `benchmarks/results/run/` by default. The [review gallery](benchmarks/results/sample/README.md) shows seeds 42 and 43 at 1× and 4×.

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
