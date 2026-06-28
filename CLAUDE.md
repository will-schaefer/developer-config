# CLAUDE.md — nxtlvl workbench

This repo builds **nxtlvl**, a personal Claude Code harness. Anchor:
[`docs/intent/personal-harness.md`](docs/intent/personal-harness.md). Decisions (ADRs):
[`docs/decisions/`](docs/decisions/).

## Build method — build from scratch against a production-quality standard
nxtlvl is built from scratch, guided by **`nxtlvl-wiki`** — a queryable corpus of reviewed
production harnesses that sets the reference bar without imposing anyone else's design
([ADR-002](docs/decisions/ADR-002-reference-corpus-nxtlvl-wiki.md),
[ADR-003](docs/decisions/ADR-003-compose-not-reconstruct.md)). Harnesses in `reference/` are
study material; each review produces an ADR-recorded decision and a distillation under
[`docs/reference/`](docs/reference/). The main session orchestrates and delegates — **when
spawning a subagent during the build, pass this method along** so it knows we build against
the wiki's production standard, not from prior harness designs.

## Scaffolding new harness items — `sandbox/`
Build new skills/agents/commands in [`sandbox/`](sandbox/) — a staging tree **off the harness's
discovery path**, so work-in-progress isn't loaded, routed to, or warned about by the live plugin.
It mirrors the plugin's shape (`sandbox/{skills,agents,commands}/`); promote when ready with
`git mv sandbox/skills/<name> plugins/nxtlvl/skills/<name>` — the move *is* the activation. See
[`sandbox/README.md`](sandbox/README.md). For throwaway experiments use the gitignored
`*-workspace/` convention instead.

## ADR lifecycle (project override)
This repo **overrides** the global decision rule's keep-never-delete lifecycle
(`~/.claude/rules/decisions.md` §3, §4). Here:
- An ADR superseded by a newer decision is **moved to
  [`docs/decisions/archive/`](docs/decisions/archive/) and marked `status: Archived`** — not
  kept inline as `Superseded`. An archived ADR **may be deleted** once nothing references it.
- New ADRs are written as **standalone, original decisions**: no `replaces:`/supersession
  frontmatter, no "this revises ADR-N" prose, and no cross-links into archived ADRs.
- Everything else in the global ADR format still applies — frontmatter, the
  Context · Decision · Alternatives · Consequences body, the `docs/decisions/` location, and
  the `README.md` index.
