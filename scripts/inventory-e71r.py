"""Inventory report/evidence paths before E7.1R cleanup. Run from Engine root."""
from collections import defaultdict
import csv
import hashlib
import re
from pathlib import Path
import subprocess
import sys

root = Path.cwd()
coordination = root.parent / "LumaSprite-Coordination"
reports = {".md", ".html", ".htm", ".log", ".txt", ".tsv", ".pdf"}
text = reports | {".ts", ".js", ".mjs", ".json", ".py", ".yml", ".yaml"}
tracked = set(subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0"))
locked = set()
for catalog in [*root.glob("benchmarks/results/*/SHA256SUMS"), *root.glob("docs/*sha256.txt")]:
    locked.add(catalog.relative_to(root).as_posix())
    for line in catalog.read_text(encoding="utf-8-sig").splitlines():
        if re.match(r"^[0-9a-fA-F]{64}  ", line):
            locked.add(line[66:].replace("\\", "/"))

files = {p for p in tracked if p and (
    p.startswith(("docs/", "benchmarks/results/")) or
    Path(p).suffix in reports or Path(p).name == "SHA256SUMS")}
for base in [root, root / "docs", root / "benchmarks/results", root / "graphify-out"]:
    scope = base.iterdir() if base in (root, root / "graphify-out") else base.rglob("*")
    for entry in scope:
        if entry.is_file() and (base != root or entry.suffix in reports) and entry.suffix != ".tmp":
            files.add(entry.relative_to(root).as_posix())
for folder in (root / ".cache").iterdir():
    if folder.is_dir():
        for entry in folder.glob("*.log"):
            files.add(entry.relative_to(root).as_posix())
        for entry in folder.glob("*.html"):
            files.add(entry.relative_to(root).as_posix())
for entry in coordination.rglob("*"):
    if entry.is_file() and entry.suffix in reports and ".git" not in entry.parts:
        files.add("../LumaSprite-Coordination/" + entry.relative_to(coordination).as_posix())
# Build references from human docs, implementation, test code and catalog filenames.
references = defaultdict(set)
external = {name for name in files if name.startswith("../")}
for name in sorted(tracked | external):
    if not name:
        continue
    entry = root / name
    if entry.suffix not in text and entry.name != "SHA256SUMS":
        continue
    if not entry.is_file():
        continue
    content = entry.read_text(encoding="utf-8-sig", errors="replace")
    for term in set(re.findall(r"(?<![A-Za-z0-9_./-])[A-Za-z0-9_./-]{1,240}\.[A-Za-z0-9_-]{1,12}(?=[\s,;:()'\"<>\]]|$)", content)):
        # Basename matches are conservative where dynamic paths cannot be resolved.
        references[term.rsplit("/", 1)[-1]].add(name)
rows = []
groups = defaultdict(list)
for p in sorted(files):
    path = root / p
    if not path.is_file():
        continue
    if path.is_symlink():
        continue
    with path.open("rb") as handle:
        sha = hashlib.file_digest(handle, "sha256").hexdigest()
    groups[sha].append(p)
    refs = references[path.name] - {p}
    is_external = p.startswith("../")
    is_locked = p in locked or re.match(r"^benchmarks/results/e[^/]+/", p) is not None
    milestone = re.search(r"(?:^|[/\W])([er]\d+(?:[.r-]\d*[\dr]?)?)(?:[/.\W]|$)", p, flags=re.I)
    name = path.name.lower()
    owner = "Engine"
    if is_external:
        owner = "Studio" if "studio-" in name or "art-review" in name else "Coordination"
    group = "HISTORICAL" if is_locked or p.startswith(("docs/", "benchmarks/results/e", "research/")) else "CURRENT"
    if p.startswith(("benchmarks/results/run/", "graphify-out/", ".cache/")):
        group = "TEMPORARY / DUPLICATE"
    if p in ("docs/README.md", "docs/roadmap.md", "HANDOFF.md") or p.startswith("docs/reports/"):
        group = "CURRENT"
    rows.append({"path": p, "bytes": path.stat().st_size, "sha256": sha,
                 "milestone": milestone[1] if milestone else ("Studio Workbench" if owner == "Studio" else "shared"),
                 "owner": owner, "git_tracked": "YES" if p in tracked else ("EXTERNAL" if is_external else "NO"),
                 "referenced": "YES" if refs else "NONE_FOUND", "reference_count": len(refs),
                 "locked": "YES" if is_locked else "NO", "duplicate_count": 0,
                 "retained_twin": "", "classification": group, "recommendation": "KEEP"})

for row in rows:
    paths = groups[row["sha256"]]
    row["duplicate_count"] = len(paths) - 1
    twin = next((p for p in paths if p != row["path"] and p in tracked), "")
    row["retained_twin"] = twin
    if row["classification"] == "TEMPORARY / DUPLICATE":
        if twin and row["referenced"] == "NONE_FOUND" and row["git_tracked"] == "NO" and row["locked"] == "NO":
            row["recommendation"] = "DELETE_CANDIDATE"
        else:
            row["recommendation"] = "REVIEW_REQUIRED"
    elif row["classification"] == "HISTORICAL" and not row["locked"] == "YES":
        row["recommendation"] = "ARCHIVE_IN_PLACE"

output = Path(sys.argv[1])
output.parent.mkdir(parents=True, exist_ok=True)
with output.open("x", encoding="utf-8", newline="") as handle:
    report = csv.DictWriter(handle, fieldnames=list(rows[0]), delimiter="\t", lineterminator="\n")
    report.writeheader()
    report.writerows(rows)
print(len(rows), "files,", sum(row["bytes"] for row in rows), "bytes")
for row in rows:
    if row["recommendation"] == "DELETE_CANDIDATE" and Path(row["path"]).suffix in reports:
        print(row["path"], row["retained_twin"], row["bytes"])
