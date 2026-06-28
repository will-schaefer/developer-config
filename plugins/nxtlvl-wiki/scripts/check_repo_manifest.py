#!/usr/bin/env python3
"""Deterministic health-check for repos.jsonl + its generated view. Used by /lint.

Checks:
  1. Each line is valid JSON with the required fields and correct types.
  2. `status` is a known enum; status-dependent fields are consistent
     (ingested→ingested_at, claimed→claimed_at, failed→error).
  3. `category` is a known section slug.
  4. `id` is unique (the manifest's dedup invariant) and matches the URL path.
  5. master-repo-list.md is in sync with a fresh render (no stale hand-edits / un-regenerated view).

Exit code 0 = clean, 1 = problems found (printed to stdout). Read-only.
"""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path.cwd()  # the wiki checkout; commands run from its root
MANIFEST = ROOT / "repos.jsonl"
VIEW = ROOT / "master-repo-list.md"

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import render_repo_list as R  # noqa: E402

REQUIRED = {"id", "url", "category", "status", "summary"}
STATUSES = set(R.STATUS_CELL)


def main() -> int:
    problems: list[str] = []
    if not MANIFEST.exists():
        print(f"FAIL: {MANIFEST} not found")
        return 1

    records: list[dict] = []
    seen: dict[str, int] = {}
    for ln, line in enumerate(MANIFEST.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
        except json.JSONDecodeError as e:
            problems.append(f"L{ln}: invalid JSON: {e}")
            continue
        records.append(r)

        missing = REQUIRED - r.keys()
        if missing:
            problems.append(f"L{ln} ({r.get('id','?')}): missing fields {sorted(missing)}")
            continue

        rid = r["id"]
        if rid in seen:
            problems.append(f"L{ln}: duplicate id '{rid}' (also L{seen[rid]})")
        seen[rid] = ln

        if r["status"] not in STATUSES:
            problems.append(f"L{ln} ({rid}): unknown status '{r['status']}'")
        if r["category"] not in R.KNOWN_SLUGS:
            problems.append(f"L{ln} ({rid}): unknown category '{r['category']}'")

        # status ↔ field consistency
        st = r["status"]
        if st == "ingested" and not r.get("ingested_at"):
            problems.append(f"L{ln} ({rid}): status=ingested but no ingested_at")
        if st == "claimed" and not r.get("claimed_at"):
            problems.append(f"L{ln} ({rid}): status=claimed but no claimed_at")
        if st == "failed" and not r.get("error"):
            problems.append(f"L{ln} ({rid}): status=failed but no error")

        # id ↔ url consistency (id is the github path)
        path = r["url"].split("github.com/", 1)[-1].rstrip("/") if "github.com/" in r["url"] else None
        if path and path.lower() != rid.lower():
            problems.append(f"L{ln}: id '{rid}' != url path '{path}'")

    # view-in-sync: the committed markdown must equal a fresh render
    if VIEW.exists():
        # reuse the view's own `updated:` so a date diff alone doesn't trip the check
        cur = VIEW.read_text(encoding="utf-8")
        updated = "unknown"
        for line in cur.splitlines():
            if line.startswith("updated:"):
                updated = line.split(":", 1)[1].strip()
                break
        fresh = R.render(records, updated)
        if fresh != cur:
            problems.append("master-repo-list.md is OUT OF SYNC with repos.jsonl — "
                            "run `python3 scripts/render_repo_list.py`")
    else:
        problems.append("master-repo-list.md (generated view) is missing")

    if problems:
        print(f"repo-manifest: {len(problems)} problem(s):")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(f"repo-manifest: OK ({len(records)} repos, {len(seen)} unique ids)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
