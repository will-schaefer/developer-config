#!/usr/bin/env python3
"""Render master-repo-list.md (a browsable view) from repos.jsonl (the source of truth).

repos.jsonl is the authoritative, machine-managed repo index + ingest queue.
master-repo-list.md is a GENERATED view for humans / GitHub rendering — never hand-edit it.

Usage:
    python3 scripts/render_repo_list.py            # rewrite master-repo-list.md in place
    python3 scripts/render_repo_list.py --stdout   # print to stdout (used by the lint sync-check)

Run from the wiki repo root — paths resolve relative to the current directory.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import pathlib
import sys

ROOT = pathlib.Path.cwd()  # the wiki checkout; commands run from its root
MANIFEST = ROOT / "repos.jsonl"
VIEW = ROOT / "master-repo-list.md"

# Section vocabulary — slug → (display order, title, one-line intro).
# A repo's `category` field MUST be one of these slugs. Order drives the view.
SECTIONS: list[tuple[str, str, str]] = [
    ("harness-meta", "1. Harness engineering & meta-harnesses",
     "Systems whose product **is the harness** — they wrap, generate, or orchestrate coding-agent "
     "CLIs (Claude Code, Codex, Gemini, Cursor…) as swappable backends — plus the skills, patterns, "
     "references, and reference implementations that treat harness engineering as a discipline."),
    ("coding-agents", "2. Coding agents & CLI/IDE harnesses",
     "Agents whose primary job is writing/editing code in a repo, with a terminal, IDE, or "
     "autonomous loop as the harness."),
    ("agent-frameworks", "3. Agent frameworks (build-your-own-agent)",
     "Libraries/SDKs for composing agents, tools, and control flow."),
    ("vendor-sdks", "4. Vendor agent SDKs, runtimes, substrates & sandboxing",
     "First-party SDKs and managed agent runtimes from model/cloud vendors, plus the execution "
     "substrates and sandboxes agents run their code in."),
    ("multi-agent-orch", "5. Multi-agent orchestration & agent platforms",
     "Frameworks/systems whose core idea is coordinating multiple agents or running a team of "
     "agents as an operational platform."),
    ("autonomous-experimental", "6. Autonomous & experimental agents",
     "Early/influential autonomous-loop agents and research prototypes."),
    ("memory-context", "7. Memory & context engineering",
     "Memory layers, long-term state, retrieval/graph context, and context compression / "
     "working-state engineering."),
    ("eval-observability", "8. Evaluation, benchmarks & observability",
     "Testing agent quality, benchmarking task performance, and tracing/telemetry/reliability ops."),
    ("protocols-interop", "9. Protocols, tool interfaces & interoperability",
     "Standards and contracts that let agents talk to tools and to each other."),
    ("prompt-optimization", "10. Prompt / agent optimization (+ adjacent training)",
     "Automatic improvement of prompts, programs, and policies."),
    ("skills-prompts", "11. Skills, prompts & agent configuration",
     "Reusable skills, prompt libraries, plugins, and config patterns. (Harness-specific skills "
     "live in §1; general-purpose skill packs and prompt libraries live here.)"),
    ("awesome-lists", "12. Awesome-lists, surveys & learning",
     "Meta-resources for finding more repos and grounding claims, plus essential readings & "
     "ecosystem maps."),
    ("guardrails-security", "13. Guardrails, security & governance",
     "Guardrail frameworks, agent/LLM security, policy enforcement, and governance tooling."),
]

SECTION_ORDER = {slug: i for i, (slug, _t, _i) in enumerate(SECTIONS)}
KNOWN_SLUGS = set(SECTION_ORDER)

FRONTMATTER = """\
---
title: Master repo list — agent harnesses & agentic engineering (generated view)
type: index
status: working-draft
generated_from: repos.jsonl
created: 2026-06-21
updated: {updated}
confidence: medium
owner: User
scope: >
  Vault-wide seed/reference index of GitHub repositories relevant to agent harnesses and agentic
  engineering. The authoritative source of truth is `repos.jsonl`; this markdown file is a
  GENERATED, browsable view — regenerate via the nxtlvl-wiki plugin's render_repo_list.py, never hand-edit.
note: >
  Working reference, not a published wiki page. Verify each URL before promoting any repo into
  raw/ as a cited source.
---
"""

PREAMBLE = """\
# Master Repo List — Agent Harnesses & Agentic Engineering

> **Generated file — do not hand-edit.** Source of truth is [`repos.jsonl`](repos.jsonl).
> Regenerate via the nxtlvl-wiki plugin (`render_repo_list.py`). Edits here will be overwritten.

A curated, categorized index of GitHub repositories for **agent harnesses** and **agentic
engineering**, and the ingest queue that feeds this `llm-wiki`.

## How to read this list

- **★** — already referenced somewhere in the wiki (the `referenced` flag in the manifest).
- **Status** (4th column) — ingestion state, maintained by `/auto-ingest` against the manifest:
  `—` pending · `⟳ started <ts>` claimed (in progress) · `✓ <YYYY-MM-DD>` ingested ·
  `⋯ off-scope` refused by `/ingest-repo` · `⚠ <reason>` failed.
- Descriptions are short and factual. No live star counts / activity metrics — those go stale.
- Canonical `owner/name` (the manifest `id`) is used throughout; a repo appears in exactly one
  section (no duplicate rows — the manifest dedups by `id`).
- Categories are a convenience, not a taxonomy — many repos span several.
"""

STATUS_CELL = {
    "pending": lambda r: "—",
    "ingested": lambda r: f"✓ {r.get('ingested_at') or '?'}",
    "claimed": lambda r: f"⟳ started {r.get('claimed_at') or '?'}",
    "off_scope": lambda r: "⋯ off-scope",
    "failed": lambda r: f"⚠ {r.get('error') or 'failed'}",
}


def load(path: pathlib.Path = MANIFEST) -> list[dict]:
    records = []
    for ln, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError as e:  # pragma: no cover
            sys.exit(f"repos.jsonl:{ln}: invalid JSON: {e}")
    return records


def sort_key(r: dict) -> tuple:
    return (SECTION_ORDER.get(r.get("category"), len(SECTIONS)), r.get("id", "").lower())


def status_cell(r: dict) -> str:
    fn = STATUS_CELL.get(r.get("status"))
    return fn(r) if fn else f"⚠ unknown status: {r.get('status')!r}"


def render(records: list[dict], updated: str) -> str:
    out: list[str] = [FRONTMATTER.format(updated=updated), PREAMBLE, "---\n"]
    by_section: dict[str, list[dict]] = {slug: [] for slug, _t, _i in SECTIONS}
    for r in sorted(records, key=sort_key):
        by_section.setdefault(r.get("category", "?"), []).append(r)

    for slug, title, intro in SECTIONS:
        rows = by_section.get(slug, [])
        if not rows:
            continue
        out.append(f"## {title}\n")
        out.append(f"{intro}\n")
        out.append("| Repo | URL | What it is | Status |")
        out.append("|---|---|---|---|")
        for r in rows:
            mark = "★ " if r.get("referenced") else ""
            name = r.get("id", "?")
            summary = (r.get("summary") or "").replace("|", "\\|").replace("\n", " ").strip()
            out.append(f"| {mark}{name} | {r.get('url','')} | {summary} | {status_cell(r)} |")
        out.append("")  # blank line after table
        out.append("---\n")

    # Any records whose category is not a known slug — surface loudly rather than drop.
    unknown = [r for r in records if r.get("category") not in KNOWN_SLUGS]
    if unknown:
        out.append("## ⚠ Uncategorized (fix `category` in repos.jsonl)\n")
        out.append("| Repo | URL | category value |")
        out.append("|---|---|---|")
        for r in unknown:
            out.append(f"| {r.get('id','?')} | {r.get('url','')} | `{r.get('category')}` |")
        out.append("")
    return "\n".join(out).rstrip() + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stdout", action="store_true", help="print to stdout instead of writing the view")
    ap.add_argument("--updated", default=_dt.date.today().isoformat(),
                    help="value for the frontmatter `updated:` field (default: today)")
    args = ap.parse_args()
    text = render(load(), args.updated)
    if args.stdout:
        sys.stdout.write(text)
    else:
        VIEW.write_text(text, encoding="utf-8")
        print(f"wrote {VIEW.relative_to(ROOT)} ({len(load())} repos)")


if __name__ == "__main__":
    main()
