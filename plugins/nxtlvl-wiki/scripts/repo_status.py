#!/usr/bin/env python3
"""The ONLY writer of repos.jsonl. Every mutation re-renders master-repo-list.md so the
source-of-truth manifest and its browsable view can never drift.

Used by /auto-ingest (claim/ingest/off_scope/fail/reclaim/next) and /add-repo (add).

Subcommands:
    next                          print the id of the next pending repo (render order), or nothing
    reclaim-stale [--minutes N]   reset claimed repos whose claim is older than N min -> pending
                                  (prints each reclaimed id; N default 60)
    claim   <id>                  status -> claimed, claimed_at = now (UTC)
    ingest  <id>                  status -> ingested, ingested_at = today, claimed_at cleared
    offscope <id>                 status -> off_scope
    fail    <id> --error "<why>"  status -> failed, error = why
    add --url U --category SLUG --summary "..." [--tags a,b] [--referenced]
                                  append a new pending repo (canonical id from URL, deduped);
                                  prints one of: added / skipped-dup / updated-rename

Exit 0 on success; 2 if the target id is not found / a dup-skip occurred (non-fatal signals).
All commands re-render the view unless they made no change.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import pathlib
import sys

ROOT = pathlib.Path.cwd()  # the wiki checkout; commands run from its root
MANIFEST = ROOT / "repos.jsonl"
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import render_repo_list as R  # noqa: E402

FIELDS = ["id", "url", "category", "tags", "summary", "status", "referenced",
          "claimed_at", "ingested_at", "error", "sources"]


def _now_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _today() -> str:
    return _dt.datetime.now(_dt.timezone.utc).date().isoformat()


def load() -> list[dict]:
    return R.load(MANIFEST)


def save(records: list[dict]) -> None:
    recs = sorted(records, key=R.sort_key)
    with MANIFEST.open("w", encoding="utf-8") as f:
        for r in recs:
            f.write(json.dumps({k: r.get(k) for k in FIELDS}, ensure_ascii=False) + "\n")
    # keep the view in lock-step with the manifest
    view = R.render(recs, _today())
    R.VIEW.write_text(view, encoding="utf-8")


def find(records: list[dict], rid: str) -> dict | None:
    low = rid.lower()
    for r in records:
        if r["id"].lower() == low:
            return r
    return None


def url_id(url: str) -> str:
    return url.split("github.com/", 1)[-1].rstrip("/") if "github.com/" in url else url


def cmd_next(_a) -> int:
    for r in sorted(load(), key=R.sort_key):
        if r["status"] == "pending":
            print(r["id"])
            return 0
    return 0  # silence = queue empty


def cmd_reclaim(a) -> int:
    records = load()
    now = _dt.datetime.now(_dt.timezone.utc)
    changed = []
    for r in records:
        if r["status"] != "claimed" or not r.get("claimed_at"):
            continue
        try:
            ts = _dt.datetime.strptime(r["claimed_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=_dt.timezone.utc)
        except ValueError:
            ts = None
        if ts is None or (now - ts).total_seconds() / 60 >= a.minutes:
            r["status"], r["claimed_at"] = "pending", None
            changed.append(r["id"])
    if changed:
        save(records)
        for c in changed:
            print(c)
    return 0


def _set(rid: str, **fields) -> int:
    records = load()
    r = find(records, rid)
    if r is None:
        print(f"not-found: {rid}", file=sys.stderr)
        return 2
    r.update(fields)
    save(records)
    print(f"{rid} -> {fields.get('status')}")
    return 0


def cmd_claim(a) -> int:
    return _set(a.id, status="claimed", claimed_at=_now_iso(), error=None)


def cmd_ingest(a) -> int:
    return _set(a.id, status="ingested", ingested_at=_today(), claimed_at=None, error=None)


def cmd_offscope(a) -> int:
    return _set(a.id, status="off_scope", claimed_at=None)


def cmd_fail(a) -> int:
    return _set(a.id, status="failed", claimed_at=None, error=a.error)


def cmd_add(a) -> int:
    records = load()
    rid = url_id(a.url)
    if a.category not in R.KNOWN_SLUGS:
        print(f"bad-category: {a.category} (known: {sorted(R.KNOWN_SLUGS)})", file=sys.stderr)
        return 2
    existing = find(records, rid)
    if existing is not None:
        print(f"skipped-dup: {rid} ({existing['status']}, {existing['category']})")
        return 2
    records.append({
        "id": rid, "url": f"https://github.com/{rid}", "category": a.category,
        "tags": [t.strip() for t in (a.tags or "").split(",") if t.strip()],
        "summary": a.summary.strip(), "status": "pending", "referenced": bool(a.referenced),
        "claimed_at": None, "ingested_at": None, "error": None,
        "sources": [s.strip() for s in (a.sources or "").split(",") if s.strip()] or ["add-repo"],
    })
    save(records)
    print(f"added: {rid} -> {a.category}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("next").set_defaults(fn=cmd_next)
    p = sub.add_parser("reclaim-stale"); p.add_argument("--minutes", type=int, default=60); p.set_defaults(fn=cmd_reclaim)
    for name, fn in [("claim", cmd_claim), ("ingest", cmd_ingest), ("offscope", cmd_offscope)]:
        p = sub.add_parser(name); p.add_argument("id"); p.set_defaults(fn=fn)
    p = sub.add_parser("fail"); p.add_argument("id"); p.add_argument("--error", required=True); p.set_defaults(fn=cmd_fail)
    p = sub.add_parser("add")
    p.add_argument("--url", required=True); p.add_argument("--category", required=True)
    p.add_argument("--summary", required=True); p.add_argument("--tags", default="")
    p.add_argument("--sources", default=""); p.add_argument("--referenced", action="store_true")
    p.set_defaults(fn=cmd_add)
    a = ap.parse_args()
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
