"""Dry-run report inventory. Run from the Engine root; this script never removes files."""
import csv
from collections import defaultdict
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path.cwd()
STUDIO = ROOT.parent / "LumaSprite-Studio"
COORD = ROOT.parent / "LumaSprite-Coordination"
SKIP = {".git", "node_modules", ".venv", "__pycache__", ".aws", ".agents", ".codex", "dist", "Library"}
TEXT = {".md",".txt",".html",".htm",".json",".tsv",".ts",".tsx",".cjs",".mjs",".js",".py",".yml",".yaml",".cs",".ps1",".xml"}
REPORTS = {".md",".html",".htm",".txt",".log",".tsv",".pdf",".xml"}
TRACKED = set(subprocess.check_output(["git","ls-files","-z"]).decode().split("\0")) - {""}
STUDIO_TRACKED = set(subprocess.check_output(["git","-C",str(STUDIO),"ls-files","-z"]).decode().split("\0")) - {""}

def files(path):
    for folder, dirs, names in os.walk(path):
        dirs[:] = sorted(name for name in dirs if name not in SKIP and not (Path(folder)/name).is_symlink())
        for name in sorted(names):
            item = Path(folder)/name
            if not item.is_symlink() and item.is_file():
                yield item

def read(path):
    return path.read_text(encoding="utf-8-sig",errors="replace")

def rel(path):
    return Path(os.path.relpath(path,ROOT)).as_posix()

def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream,"sha256").hexdigest()

scope = {ROOT/"HANDOFF.md", *list((ROOT/"docs").glob("*.html"))}
roots = [ROOT/"docs/reports", ROOT/"docs/art-quality", ROOT/"benchmarks/results", ROOT/".cache", ROOT/".studio-logs",
         COORD, STUDIO/".studio-logs"]
for base in roots:
    for path in files(base):
        if base==STUDIO/".studio-logs" and path.suffix.lower() not in REPORTS|{".json"}:
            continue
        if "e91r-" not in path.relative_to(base).parts[0] or base != ROOT/".cache":
            scope.add(path)
locked = set()
catalogs = list(ROOT.glob("docs/*sha256.txt")) + list(ROOT.glob("benchmarks/results/e*/SHA256SUMS"))
for catalog in catalogs:
    locked.add(rel(catalog))
    for line in read(catalog).splitlines():
        if not re.match(r"^[a-f0-9A-F]{64}  ",line):
            continue
        path=line[66:].replace("\\","/").strip()
        locked.add(path if catalog.parent==ROOT/"docs" else rel(catalog.parent/path))
# Full paths and basenames catch static references; temporary path namespaces used by code are also guarded.
refs = defaultdict(set)
tokens = re.compile(r"(?<![A-Za-z0-9_./-])[A-Za-z0-9_./-]{1,240}\.[A-Za-z0-9_-]{1,12}(?=[\s,;:()'\"<>\]#]|$)")
blocked_prefixes = {".cache/e91-development/","benchmarks/results/run/e91/","benchmarks/results/run/e54-checks/",
                    "benchmarks/results/run/e71r-report-archive/"}
for item in sorted((ROOT/p for p in TRACKED),key=str)+list(files(COORD)):
    if not item.is_file() or item.suffix.lower() not in TEXT and item.name!="SHA256SUMS":
        continue
    name=rel(item)
    content=read(item).replace("\\","/")
    for value in set(tokens.findall(content)):
        refs[value.rsplit("/",1)[-1]].add(name)
    if name.startswith(("scripts/","tests/","src/")):
        blocked_prefixes.update(match.rstrip("/")+"/" for match in re.findall(
            r"(?:\.cache|benchmarks/results/run)/[A-Za-z0-9_.-]+/",content))

rows = []
groups = defaultdict(list)
for path in sorted(scope,key=str):
    name=rel(path)
    external=name.startswith("../")
    tracked = name in TRACKED or name.startswith("../LumaSprite-Studio/") and name.removeprefix("../LumaSprite-Studio/") in STUDIO_TRACKED
    temporary=name.startswith((".cache/","benchmarks/results/run/",".studio-logs/"))
    is_locked=name in locked or bool(re.match(r"benchmarks/results/e[^/]+/",name)) or "human-review" in path.name.lower()
    hint=re.search(r"(?:^|[/_-])([er]\d+(?:\.\d+)?r?)(?=[._/-]|$)",name,re.I)
    key=sha(path)
    row={"path":name,"bytes":path.stat().st_size,"sha256":key,"milestone":hint[1] if hint else "shared/undetermined",
        "git_tracked":"YES" if tracked else "EXTERNAL" if external else "NO",
        "references":";".join(sorted(refs[path.name]-{name})), "protected":is_locked, "copy_count":0,"unique_bytes":False,
        "canonical":"","category":"KEEP", "temporary":temporary,"report_like":path.suffix.lower() in REPORTS,
        "reason":"Studio/Coordination read-only inventory" if external else "tracked or protected evidence"}
    rows.append(row)
    groups[key].append(row)
for row in rows:
    name=row["path"]
    twins=groups[row["sha256"]]
    row["copy_count"]=len(twins)
    row["unique_bytes"]=len(twins)==1
    canonical = next((r["path"] for r in twins if r["git_tracked"]=="YES" and r["path"]!=name and not r["temporary"]), "")
    row["canonical"]=canonical
    if "/archive/" in name or name.startswith("benchmarks/results/run/e71r-report-archive/"):
        row.update(category="ARCHIVE", reason="existing archive; retains its original path")
    elif row["temporary"] and row["git_tracked"]=="NO" and not row["protected"]:
        if canonical and not row["references"] and not name.startswith(tuple(blocked_prefixes)):
            row.update(category="SAFE_TO_REMOVE",reason="byte-identical tracked copy; no static or generated-prefix reference found")
        else:
            row.update(category="NEEDS_REVIEW",reason="unique bytes, referenced path/prefix or no retained tracked twin")
    elif row["git_tracked"]=="NO" and not row["protected"]:
        row.update(category="NEEDS_REVIEW",reason="untracked outside temporary area")

output=Path(sys.argv[1])
output.parent.mkdir(parents=True,exist_ok=True)
with output.open("x",encoding="utf-8",newline="") as handle:
    table=csv.DictWriter(handle,fieldnames=list(rows[0]),delimiter="\t",lineterminator="\n")
    table.writeheader()
    table.writerows(rows)

def count(seq):
    return {"files":len(seq),"bytes":sum(row["bytes"] for row in seq)}

summary={"all":count(rows),"reportLike":count([r for r in rows if r["report_like"]]),
         "byCategory":{key:count([r for r in rows if r["category"]==key])
                       for key in ("KEEP","ARCHIVE","SAFE_TO_REMOVE","NEEDS_REVIEW")}}
print(json.dumps(summary))
for row in rows:
    if row["category"]=="SAFE_TO_REMOVE" and (row["report_like"] or row["path"].startswith(".cache/") and row["path"].count("/")==1):
        print(row["path"],row["bytes"],row["canonical"],sep="\t")
