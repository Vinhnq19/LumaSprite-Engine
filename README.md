# LumaSprite Engine

LumaSprite Engine is an offline pixel-art pipeline for deterministic rendering and artist-authored sprites. The v1 release candidate preserves the existing generator defaults and adds a file-based component workflow.

```powershell
npm ci
npm run build
npm run component -- --help
npm run generate -- --seed 43 --out .cache/chest.png
```

Use Node.js 24 or newer. A Windows review ZIP with compiled CLI and locked runtime dependencies is prepared locally for Owner acceptance.

| Task | Documentation |
| --- | --- |
| Install from source or open the Windows ZIP | [Installation](docs/installation.md) |
| Import a PNG or components, apply a masked revision, verify or roll back | [CLI and API](docs/engine-cli-api.md) |
| Use the Engine with Studio and Unity | [Architecture](docs/architecture/overview.md) · [Studio Adapter](docs/integration/studio-adapter.md) · [Unity acceptance](docs/integration/e8-runtime-acceptance.md) |
| Review the release candidate | [Scope](docs/v1-scope.md) · [Known limitations](docs/known-limitations.md) · [Report index](docs/reports/INDEX.md) · [Handoff](HANDOFF.md) |
| Review changes and the future provider boundary | [Changelog](CHANGELOG.md) · [AI integration contract draft](docs/ai-integration-contract.md) |

```powershell
npm run lint
npm run typecheck
npm run build
npm test
npm run smoke
npm run test:studio
```

The HTTP tests use loopback. The last command uses the sibling Studio checkout and an isolated data directory. The [documentation index](docs/README.md) retains links to the original generators, specifications and benchmark evidence.
