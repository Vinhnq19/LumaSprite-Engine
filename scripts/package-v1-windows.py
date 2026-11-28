"""Build and smoke-test the local Windows Owner review ZIP."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / ".cache" / "e10-v1"
DOCS = (
    "CHANGELOG.md", "docs/installation.md", "docs/engine-cli-api.md",
    "docs/known-limitations.md", "docs/ai-integration-contract.md",
    "docs/integration/studio-adapter.md", "docs/architecture/overview.md",
)
RUNTIME_SCRIPTS = (
    "generate", "component", "terrain", "character", "animation",
    "environment", "composition", "pixel-effects", "serve",
)


def run(args, cwd=ROOT):
    return subprocess.check_output(args, cwd=cwd, text=True, encoding="utf-8").strip()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def catalog(directory):
    return {
        f.relative_to(directory).as_posix(): sha(f.read_bytes())
        for f in sorted(directory.rglob("*"))
        if f.is_file() and f != directory / "SHA256SUMS"
    }


def stage_runtime(stage, cache):
    original = json.loads((ROOT / "package.json").read_bytes())
    lock = json.loads((ROOT / "package-lock.json").read_bytes())
    shutil.copyfile(ROOT / "package.json", stage / "package.json")
    shutil.copyfile(ROOT / "package-lock.json", stage / "package-lock.json")
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    subprocess.run([npm, "ci", "--omit=dev", "--ignore-scripts", "--offline",
                    "--no-audit", "--no-fund", "--cache", str(cache)], cwd=stage, check=True)
    (stage / "package-lock.json").unlink()
    (stage / "node_modules/.package-lock.json").unlink(missing_ok=True)
    installed = {}
    for name in original["dependencies"]:
        packet = stage / "node_modules" / name
        meta = json.loads((packet / "package.json").read_bytes())
        expected = lock["packages"]["node_modules/" + name]
        assert meta["version"] == expected["version"] and meta["license"] == expected["license"]
        (stage / "notices").mkdir(exist_ok=True)
        shutil.copyfile(packet / "LICENSE", stage / "notices" / (name + "-LICENSE.txt"))
        installed[name] = {"version": meta["version"], "license": meta["license"], "integrity": expected["integrity"]}
    for notice in (ROOT / "research/open-source/art-quality/licenses").glob("*.txt"):
        shutil.copyfile(notice, stage / "notices" / notice.name)
    manifest = {key: original[key] for key in ("name", "version", "private", "type", "engines", "dependencies")}
    manifest["scripts"] = {key: original["scripts"][key] for key in RUNTIME_SCRIPTS}
    (stage / "package.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    subprocess.run(["node", "node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json",
                    "--outDir", str(stage / "dist")], cwd=ROOT, check=True)
    return installed


def smoke(archive, expected):
    with tempfile.TemporaryDirectory(prefix="LumaSprite v1 smoke ") as tmp:
        directory = Path(tmp).resolve()
        assert not directory.is_relative_to(ROOT), "Smoke must run outside the repository."
        with ZipFile(archive) as z:
            assert z.testzip() is None
            z.extractall(directory)
        assert catalog(directory) == expected
        assert (directory / "SHA256SUMS").read_text(encoding="utf-8") == sums_text(expected)
        cli = ["node", "dist/cli/component.js"]
        assert "--edit-mask" in run([*cli, "--help"], directory)
        initial = json.loads(run([*cli, "--verify", "samples/r1"], directory))
        revised = json.loads(run([*cli, "--verify", "samples/r2", "--parent", "samples/r1"], directory))
        assert initial["revisionLink"] == "ROOT" and revised["revisionLink"] == "PASS"
        rebuilt = json.loads(run([*cli, "--manifest", "samples/r1/component.json", "--out", "smoke-r1"], directory))
        changed = json.loads(run([*cli, "--revise", "smoke-r1", "--layer", "cap", "--png", "samples/r2/layer-cap.png",
                                  "--edit-mask", "samples/r2/edit-mask.png", "--out", "smoke-r2"], directory))
        assert rebuilt == initial and changed == revised
        for i in range(2):
            prop = json.loads(run(["node", "dist/cli/main.js", "--seed", "43", "--out", f"chest-{i}.png"], directory))
            assert prop["technical"] == "PASS"
        first = (directory / "chest-0.png").read_bytes()
        assert first == (directory / "chest-1.png").read_bytes()
        return {"status": "PASS", "externalWindowsTemp": True, "revision": revised, "rollback": initial,
                "deterministicPropPngSha256": sha(first), "node": run(["node", "--version"], directory)}


def sums_text(entries):
    return "".join(f"{digest}  {path}\n" for path, digest in sorted(entries.items()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--proof", type=Path, help="Workflow proof directory")
    parser.add_argument("--npm-cache", type=Path, default=ROOT / ".cache/npm")
    parser.add_argument("--out", type=Path, default=DEFAULT / "release")
    args = parser.parse_args()
    assert os.name == "nt", "Run this Windows candidate builder on Windows."
    proof = args.proof or Path((DEFAULT / "workflow/latest.txt").read_text(encoding="utf-8").strip())
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    source_sha = run(["git", "rev-parse", "HEAD"])
    source_tree = "DIRTY" if run(["git", "status", "--porcelain"]) else "CLEAN"
    name = "LumaSprite-Engine-v1-Windows-RC.zip"
    with tempfile.TemporaryDirectory(prefix="v1-stage-", dir=out) as staging:
        stage = Path(staging) / "payload"
        stage.mkdir()
        locked = stage_runtime(stage, args.npm_cache.resolve())
        for filename in DOCS:
            dest = stage / filename
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / filename, dest)
        shutil.copytree(proof / "samples", stage / "samples")
        (stage / "README.txt").write_text(
            "LumaSprite Engine v1 Windows review candidate\n\n"
            "For local Owner acceptance. A project redistribution license has not been recorded.\n"
            "Use an installed Node.js 24 or later. See docs/installation.md.\n"
            "The samples are internal QA fixtures. Runtime and adapted-code notices are in notices/.\n",
            encoding="utf-8",
        )
        build = {"scope": "ENGINE_V1_OWNER_REVIEW", "sourceCommit": source_sha, "workingTree": source_tree,
                 "sourceLockSha256": sha((ROOT / "package-lock.json").read_bytes()), "runtime": locked}
        (stage / "build-info.json").write_text(json.dumps(build, indent=2) + "\n", encoding="utf-8")
        entries = catalog(stage)
        (stage / "SHA256SUMS").write_bytes(sums_text(entries).encode("utf-8"))
        candidate = Path(staging) / name
        with ZipFile(candidate, "w", compression=ZIP_DEFLATED, compresslevel=9) as z:
            for filename in sorted([*entries, "SHA256SUMS"]):
                info = ZipInfo(filename, (2026, 11, 28, 0, 0, 0))
                z.writestr(info, (stage / filename).read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
        verified = smoke(candidate, entries)
        receipt = dict(build, filename=name, bytes=candidate.stat().st_size, sha256=sha(candidate.read_bytes()),
                       archiveEntries=len(entries) + 1, smoke=verified)
        candidate.replace(out / name)
        (out / "release-package.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
