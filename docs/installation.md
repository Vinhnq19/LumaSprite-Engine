# Installation

## Frozen Windows RC

Install Node.js 24 LTS or a newer LTS release from the official Windows installer and reopen PowerShell. Run `node --version` to check the selected installation. Verify the ZIP before extracting it into a new directory. The RC includes compiled JavaScript, resolved runtime dependencies and their notices. The smoke steps in the extracted directory run offline. [Official Node.js downloads](https://nodejs.org/en/download)

```powershell
$archive = 'D:\LumaSprite-Engine\.cache\e10-v1\release\LumaSprite-Engine-v1-Windows-RC.zip'
$expected = 'b0cac7eb889d8f0fd92128a7b9f9275612b52f13d1a7540ad873becf825dc299'
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) {
  throw 'Windows RC checksum mismatch'
}
```

```powershell
node --version
node dist/cli/component.js --help
node dist/cli/component.js --verify samples/r1
node dist/cli/component.js --verify samples/r2 --parent samples/r1
node dist/cli/main.js --seed 43 --out .\chest.png
```

The ZIP catalog `SHA256SUMS` binds the shipped payload. The Windows RC is accepted for internal use with exceptions. [Acceptance and rollback](v1-internal-release.md)

## Source checkout

Use Node.js 24 or newer, npm and Git. A clean checkout runs `npm ci` and `npm run build`. To run the documented checks use `npm test`, `npm run smoke` and `npm run test:studio`. The Studio check needs a compatible sibling checkout or `LUMASPRITE_STUDIO_ROOT`. Keep the Studio checkout read-only for Engine acceptance.

Run `npm run test:e85-studio` for E8.5 integration against a built Studio checkout. This check uses the runtime export in `.cache/e8-adapter-1` and the original Owner ZIP in `.cache/e85-studio-zips`. The offline CI suite uses only the Engine checkout.

For an explicitly authorized packaging exercise, build the Engine and run `node scripts/verify-v1-workflow.ts` against the pinned Studio checkout. Choose a new output directory with `python scripts/package-v1-windows.py --out <new-directory>` so the frozen RC remains intact. The two locked runtime dependencies install offline from the repository's npm cache or the cache passed with `--npm-cache`. The script validates the result in a separate OS temporary directory.

The Unity sandbox uses Editor `6000.3.21f1`, Test Framework `1.6.0`, and Windows x64. From a populated E8.5 sandbox, run `scripts/e8-unity/run-e85.ps1` with the installed Editor path. Use the existing Studio scene ZIP manifest. See the [E8.5 report](reports/E8.5-END-TO-END-PRODUCTION-ACCEPTANCE.html) for the fixture lineage and application controls.
