"""Inventory Engine report/evidence files. This dry-run only writes a CSV."""
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
import os
from pathlib import Path
import posixpath
import re
import subprocess
from urllib.parse import unquote

ROOT = Path.cwd()
COORD = ROOT.parent / "LumaSprite-Coordination"
STUDIO = ROOT.parent / "LumaSprite-Studio"
SKIP = {".git", "node_modules", ".venv", "__pycache__", "dist", "Library"}
TEXT = {".md", ".html", ".htm", ".json", ".xml", ".ts", ".tsx", ".js", ".mjs", ".mts", ".py", ".ps1", ".txt", ".css"}
HTML = {".html", ".htm"}
REPORTS = HTML | {".md", ".pdf", ".tsv", ".csv"}
CHECKPOINTS = ("benchmarks/results/run/e53-checks/rnd-checkpoint/",
               "benchmarks/results/run/e54-checks/e53-checkpoint/",
               "benchmarks/results/run/e71r-report-archive/")
TOKEN = re.compile(r"(?<![\w./-])[\w.%@/-]{1,230}\.(?:[A-Za-z0-9_-]{1,12})(?=[\s,;:()'\"<>\]#?]|$)")
PREFIX = re.compile(r"(?:\.cache|benchmarks/results/run)/[\w./-]+/")
DIGEST = re.compile(r"[a-fA-F0-9]{64}\s+(.+)")

def walk(root):
    for folder, dirs, filenames in os.walk(root):
        dirs[:] = [name for name in dirs if name not in SKIP and not (Path(folder)/name).is_symlink()
                   and not (Path(folder)/name).is_junction()]
        for name in filenames:
            path = Path(folder)/name
            if not path.is_symlink() and path.is_file():
                yield path

def tracked(root):
    return set(subprocess.check_output(["git","-C",str(root),"ls-files","-z"]).decode("utf8").split("\0")) - {""}

def name(path):
    return Path(os.path.relpath(path,ROOT)).as_posix()

def read(path):
    return path.read_text(encoding="utf-8-sig",errors="replace")

def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream,"sha256").hexdigest()

def scan(scope,paths,engine_tracked):
    exact, static, recipes = defaultdict(set), defaultdict(set), defaultdict(set)
    by_name={name(p).casefold():name(p) for p in scope}
    basename_set={p.name.casefold() for p in scope}
    prefixes=set(CHECKPOINTS)
    for f in sorted(paths):
        if not f.is_file() or f.suffix.lower() not in TEXT:
            continue
        current=name(f)
        source=read(f).replace("\\","/")
        for token in set(TOKEN.findall(source)):
            token=unquote(token)
            base=posixpath.basename(token).casefold()
            if base not in basename_set:
                continue
            is_code=f.suffix in {".ts",".tsx",".js",".mjs",".mts",".py",".ps1"}
            if is_code and base.endswith((".html",".htm")):
                static[base].add(current)
                if f.name.startswith("report-"):
                    recipes[base].add(current)
            for key in (posixpath.normpath(token), posixpath.normpath(posixpath.join(posixpath.dirname(current),token))):
                target=by_name.get(key.casefold())
                if target and target!=current:
                    exact[target].add(current)
        if current in engine_tracked and current.startswith(("scripts/","tests/","src/")):
            prefixes.update(PREFIX.findall(source))
    return exact,static,recipes,tuple(sorted(prefixes))

def verify_scope():
    coord=list(walk(COORD))
    scope={ROOT/"HANDOFF.md",*walk(ROOT/"docs/reports"),*walk(ROOT/"docs/art-quality"),*walk(ROOT/"benchmarks/results"),
           *coord,*(ROOT/"docs").glob("*.html"),*(ROOT/"research").rglob("*.html")}
    # Add cache reports used by the earlier review, outside the mandatory roots.
    scope.update((ROOT/".cache").glob("*.html"))
    scope.update((ROOT/".cache/portable-art-review").glob("*.html"))
    return scope,coord

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output",type=Path)
    args=parser.parse_args()
    source=tracked(ROOT)
    workspace=set(ROOT/p for p in source)
    studio={STUDIO/p for p in tracked(STUDIO) if p.startswith(("docs/","studio/","src/","test/","scripts/"))}
    scope,coord=verify_scope()
    manifest_members=defaultdict(set)
    catalogs=list(ROOT.glob("docs/*-sha256.txt"))+list((ROOT/"benchmarks/results").glob("*/SHA256SUMS"))
    for file in catalogs:
        manifest_members[name(file)].add(name(file))
        for line in read(file).splitlines():
            match=DIGEST.fullmatch(line.strip())
            if match:
                rel=match[1].replace("\\","/")
                rel=posixpath.normpath(rel if file.parent==ROOT/"docs" else posixpath.join(name(file.parent),rel))
                manifest_members[rel].add(name(file))
    for item in (ROOT/"benchmarks/results").glob("*/portable-verification.json"):
        data=json.loads(read(item))
        path=data.get("report") or data.get("html")
        if isinstance(path,str):
            manifest_members[path.replace("\\","/")].add(name(item))

    exact,static,recipes,prefixes=scan(scope,workspace|studio|set(coord)|scope,source)
    bytes_by_hash=defaultdict(list)
    rows=[]
    for path in sorted(scope):
        rel=name(path)
        ext=path.suffix.lower()
        posix=rel.casefold()
        is_html=ext in HTML
        is_replay=rel.startswith("benchmarks/results/run/")
        is_cache=rel.startswith(".cache/")
        is_historical=bool(re.match(r"benchmarks/results/[er]\d[^/]*/",rel)) or "/archive/" in rel \
            or (is_html and rel in source and not is_replay)
        protections=manifest_members[rel].copy()
        if is_historical:
            protections.add("historical-evidence")
        if "human-review" in posix or "owner-review" in posix or ext in HTML and rel.startswith("../"):
            protections.add("owner-or-external-review")
        if any(rel.startswith(p) for p in CHECKPOINTS):
            protections.add("historical-replay-tree")
        votes=exact[rel]
        guard=static[path.name.casefold()] - {rel}
        recognized = re.search(r"(?<![a-z0-9])[er]\d+(?:\.\d+)?(?:s-r|sr|s|r)?(?![a-z0-9])",posix)
        h=sha(path)
        row={"path":rel,"bytes":path.stat().st_size,"sha256":h,"milestone":recognized[0] if recognized else "",
             "git":"TRACKED" if rel in source else "EXTERNAL" if rel.startswith("../") else "UNTRACKED",
             "type":"HTML" if is_html else "REPORT" if ext in REPORTS else "EVIDENCE",
             "manifest":";".join(sorted(manifest_members[rel])),"historical":is_historical,
             "referenced_from":";".join(sorted(votes)),
             "script_basename_guard":";".join(sorted(guard)),
             "reproducibility":"PINNED_GIT_ARCHIVE" if any(rel.startswith(p) for p in CHECKPOINTS[:2])
                 else "GENERATOR_LOCATED" if recipes[path.name.casefold()] else "TRACKED_BYTES" if rel in source
                 else "UNVERIFIED",
             "canonical":"","identical_other_paths":0,"classification":"KEEP","reason":""}
        if protections:
            row.update(classification="PROTECTED",reason=";".join(sorted(protections)))
        elif is_html and (is_replay or is_cache):
            row.update(classification="NEEDS_REVIEW",reason="temporary HTML; canonical, provenance and reference checks required")
        elif is_html and rel not in source:
            row.update(classification="NEEDS_REVIEW",reason="untracked HTML outside temporary output")
        rows.append(row)
        bytes_by_hash[h].append(row)
    for row in rows:
        rel=row["path"]
        group=bytes_by_hash[row["sha256"]]
        row["identical_other_paths"]=len(group)-1
        canonical=next((x["path"] for x in group if x is not row and x["git"]=="TRACKED" and
                       not x["path"].startswith("benchmarks/results/run/")),"")
        row["canonical"]=canonical
        if row["classification"]!="NEEDS_REVIEW":
            continue
        if row["referenced_from"] or row["script_basename_guard"] or rel.startswith(prefixes):
            row["reason"]="reference or replay prefix guard"
        elif canonical and rel.startswith((".cache/","benchmarks/results/run/")):
            row.update(classification="REMOVE_CANDIDATE",reason="exact tracked twin and no static/report/replay reference found")
        elif canonical:
            row.update(classification="ARCHIVE_CANDIDATE",reason="exact twin outside temporary output; needs placement decision")
        else:
            row["reason"]="no tracked source with identical bytes"
    cats=Counter(r["classification"] for r in rows)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open("x",encoding="utf8",newline="") as stream:
        writer=csv.DictWriter(stream,fieldnames=rows[0].keys(),lineterminator="\n")
        writer.writeheader(); writer.writerows(rows)
    html=[r for r in rows if r["type"]=="HTML"]
    totals=lambda v:{"files":len(v),"bytes":sum(r["bytes"] for r in v)}
    print(json.dumps({"mode":"DRY_RUN","inventorySha256":sha(args.output),"all":totals(rows),"html":totals(html),
                      "classification":dict(cats),"htmlClassification":dict(Counter(r["classification"] for r in html)),
                      "htmlWithIdenticalTwin":sum(r["identical_other_paths"]>0 for r in html),
                      "candidates":[[r["path"],r["canonical"],r["sha256"],r["bytes"]]
                                    for r in html if r["classification"]=="REMOVE_CANDIDATE"]},ensure_ascii=False))
if __name__=="__main__":
    main()
