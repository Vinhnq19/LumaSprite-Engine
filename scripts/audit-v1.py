"""Check locked evidence, the report cleanup list and visible credential patterns."""

import csv
import hashlib
import json
from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
BASE = "c60d03736d0597fc44673223a08873756229dce8"
INDEX_SNAPSHOT = "ee8a4c9970ac2998a1328e67ef693d2396374a34"
TEXT_TYPES = {".ts", ".js", ".mjs", ".py", ".ps1", ".cs", ".json", ".md", ".txt", ".html", ".yml", ".yaml", ".csv", ".xml", ".ini", ".toml"}
SECRET = re.compile(
    rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b"
    rb"|\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b|-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----"
    rb"|(?im:\b(?:DEEPSEEK|OPENAI|GEMINI|ANTHROPIC)_API_KEY\s*[:=]\s*[\x22\x27]?[A-Za-z0-9_-]{24,})"
)


def git(*args):
    return subprocess.check_output(["git", "-C", str(ROOT), *args])


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verify_catalog(catalog, bases, index_entries):
    rows = catalog.read_text(encoding="utf-8-sig").splitlines()
    for row in rows:
        sha, filename = row.split("  ", 1)
        assert re.fullmatch(r"[0-9a-f]{64}", sha), (catalog, filename)
        if catalog == ROOT / "benchmarks/results/e71r/SHA256SUMS" and filename == "docs/reports/INDEX.md":
            assert digest(git("show", f"{INDEX_SNAPSHOT}:{filename}")) == sha
            index_entries.append({"path": filename, "commit": INDEX_SNAPSHOT, "sha256": sha,
                                  "reason": "E7.1R pins a Git snapshot of the rolling index."})
            continue
        paths = [(base / filename).resolve() for base in bases]
        assert any(p.is_relative_to(ROOT) and p.is_file() and digest(p.read_bytes()) == sha for p in paths), (catalog, filename)
    return len(rows)


def main():
    assert not git("diff", "--name-only", BASE, "--", "benchmarks"), "Published benchmark changed."
    index_entries = []
    historical = json.loads((ROOT / "docs/e53-evidence.json").read_bytes())["catalogs"]
    for filename, count in historical.items():
        assert verify_catalog(ROOT / "docs" / filename, [ROOT], index_entries) == count
    assert sum(historical.values()) == 805
    catalogs = {}
    for filename in git("ls-files", "--", "benchmarks/results/*/SHA256SUMS").decode().splitlines():
        catalog = ROOT / filename
        catalogs[catalog.parent.name] = verify_catalog(catalog, [catalog.parent, ROOT], index_entries)
    assert len(index_entries) == 1

    audit_path = ROOT / "benchmarks/results/e101/legacy-report-audit.csv"
    prior = json.loads((ROOT / "benchmarks/results/e9h1-closeout/workspace-audit.json").read_bytes())
    with audit_path.open(encoding="utf-8", newline="") as file:
        rows = list(csv.DictReader(file))
    assert [row["PATH"] for row in rows] == [row["path"] for row in prior["files"]]
    protected = 0
    for row in rows:
        path = row["PATH"]
        assert git("ls-files", "--", path).strip().decode() == path
        assert (ROOT / path).read_bytes() == git("show", f"{BASE}:{path}"), path
        assert row["SAFE_ACTION"] == "KEEP" and row["HISTORICAL_REFERENCE"] != "NONE_FOUND_IN_SCOPED_SCAN"
        protected += row["MANIFEST_PROTECTED"] != "NONE_FOUND_IN_SCOPED_SCAN"
    assert len(rows) == prior["unstagedDeletionCount"] == 38 and protected == 13

    paths = set(git("ls-files", "-z", "--cached", "--others", "--exclude-standard").decode().split("\0")) - {""}
    text_paths = [ROOT / path for path in sorted(paths) if Path(path).suffix in TEXT_TYPES or Path(path).name.startswith(".env")]
    found = [p.relative_to(ROOT).as_posix() for p in text_paths if p.is_file() and SECRET.search(p.read_bytes())]
    sensitive_names = [p for p in sorted(paths) if Path(p).name == ".npmrc" or
                       (Path(p).name.startswith(".env") and Path(p).name != ".env.example")]
    assert not found and not sensitive_names, {"possibleCredentials": found, "sensitiveFilenames": sensitive_names}
    assert not any(p.is_file() for p in ROOT.glob("LICENSE*")), "Update the distribution gate for the new project license."
    result = {
        "status": "PASS", "base": BASE, "historical": sum(historical.values()), "catalogs": catalogs,
        "catalogEntries": sum(catalogs.values()), "historicalIndex": index_entries[0],
        "legacyReports": {"historicalUnstagedDeletions": 38, "retainedAndExact": len(rows), "manifestProtected": protected,
                          "removed": 0, "currentlyUncommittedDeletions": 0},
        "secrets": {"scope": "Current tracked and proposed text files", "files": len(text_paths), "matches": 0},
        "projectLicense": "PENDING_OWNER_REDISTRIBUTION_DECISION",
    }
    out = ROOT / ".cache/e10-v1/integrity.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
