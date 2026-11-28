# Installation

## Windows Owner review package

Extract `LumaSprite-Engine-v1-Windows-RC.zip` to a new directory. Install Node.js 24 or later separately and open PowerShell in the extracted directory. The ZIP includes compiled JavaScript, the resolved runtime dependencies and their notices. It needs no package install or network for the smoke steps.

```powershell
node --version
node dist/cli/component.js --help
node dist/cli/component.js --verify samples/r1
node dist/cli/component.js --verify samples/r2 --parent samples/r1
node dist/cli/main.js --seed 43 --out .\chest.png
```

Compare the ZIP SHA-256 with the readiness report using `Get-FileHash -Algorithm SHA256`. The ZIP catalog `SHA256SUMS` binds the shipped payload. The review fixture and ZIP are available for internal acceptance. External distribution requires the Owner's project license decision.

## Source checkout

Use Node.js 24 or newer, npm and Git. A clean checkout runs `npm ci` and `npm run build`. To run the documented checks use `npm test`, `npm run smoke` and `npm run test:studio`. The Studio check needs a compatible sibling checkout or `LUMASPRITE_STUDIO_ROOT`. Keep the Studio checkout read-only for Engine acceptance.

To recreate the local ZIP, build the Engine, run `node scripts/verify-v1-workflow.ts` against the pinned Studio checkout, then run `python scripts/package-v1-windows.py` on Windows. This uses the repository's npm cache and a locked, offline installation of the two runtime dependencies. Set `--npm-cache` to an alternate npm cache containing those tarballs. The script prepares a new staging directory and validates the result in a separate OS temporary directory.

The Unity sandbox uses Editor `6000.3.21f1`, Test Framework `1.6.0`, and Windows x64. From a populated E8.5 sandbox, run `scripts/e8-unity/run-e85.ps1` with the installed Editor path. Use the existing Studio scene ZIP manifest. See the [E8.5 report](reports/E8.5-END-TO-END-PRODUCTION-ACCEPTANCE.html) for the fixture lineage and application controls.
