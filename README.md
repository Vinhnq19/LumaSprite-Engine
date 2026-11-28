# LumaSprite Engine

LumaSprite Engine is an offline pixel-art pipeline for deterministic rendering and artist-authored sprites. The v1 core is frozen. The Windows RC is accepted for internal use with documented exceptions.

```powershell
npm ci
npm run build
npm run component -- --help
npm run generate -- --seed 43 --out .cache/chest.png
```

Use [Node.js 24 LTS or newer](https://nodejs.org/en/download). The pinned Windows RC ZIP includes the compiled CLI and locked runtime dependencies.

| Task | Documentation |
| --- | --- |
| Install from source or open the Windows ZIP | [Installation](docs/installation.md) |
| Import a PNG or components, apply a masked revision, verify or roll back | [CLI and API](docs/engine-cli-api.md) |
| Use the Engine with Studio and Unity | [Architecture](docs/architecture/overview.md) · [Studio Adapter](docs/integration/studio-adapter.md) · [Unity acceptance](docs/integration/e8-runtime-acceptance.md) |
| Review the release candidate | [Internal release notes and acceptance](docs/v1-internal-release.md) · [Scope](docs/v1-scope.md) · [Known limitations](docs/known-limitations.md) · [Report index](docs/reports/INDEX.md) · [Handoff](HANDOFF.md) |
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
