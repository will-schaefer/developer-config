# nxtlvl — Skill/Workflow Intake Backlog

> Interim home for [ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md) intake entries
> until M7 lands the runtime `fallback-log.jsonl` — which *is* the canonical intake backlog and
> un-defer trigger (spec [`nxtlvl-phase-0-mvh.md`](../spec/nxtlvl-phase-0-mvh.md)). Every
> skill/workflow added to `nxtlvl` logs **one entry** here naming **the task that required it** and
> **the existing thing that failed** — the falsifiable gate, never a vibe. Vendoring an upstream
> `agent-skills` skill ([ADR-003](../decisions/ADR-003-compose-not-reconstruct.md)) is an intake
> event and logs here too.
>
> **Membership test:** *would I want this no matter what I'm working on this week?* → build/vendor
> now (task-independent machinery). Otherwise → reactive, admitted only on a logged repeat-need.

---

## 1. `documentation-and-adrs` — VENDORED (2026-06-17)

- **Task that required it:** record ADR-010 and all future decisions in my house ADR format, and
  make the canonical `/documentation-and-adrs` invocation resolve to my conventions rather than
  upstream defaults.
- **Existing thing that failed:** `agent-skills:documentation-and-adrs` emits a `## Status` /
  `## Date` ADR template — the wrong format — forcing a manual override on every invocation
  (rule §3). A thin wrapper left the upstream template authoritative and the override re-applied
  each time.
- **Membership:** build-now. The house ADR format is task-independent machinery (it applies on
  every project), so it qualifies on the spot — no logged near-miss needed.
- **Action taken:** vendored the upstream into
  [`plugins/nxtlvl/skills/documentation-and-adrs/SKILL.md`](../../plugins/nxtlvl/skills/documentation-and-adrs/SKILL.md),
  refined for fit ([ADR-003](../decisions/ADR-003-compose-not-reconstruct.md)) with the §3 format
  baked into the template; dropped the live `agent-skills:` call; repointed the canonical name to
  `/nxtlvl:documentation-and-adrs` in `~/.claude/CLAUDE.md` and `~/.claude/rules/decisions.md`.
- **Upstream disposition:** `agent-skills` stays installed and untouched — dormant-not-deleted
  endpoint per [ADR-002](../decisions/ADR-002-ecc-dormant-reference-backstop.md) once enough of it
  is vendored.

## 2. `github-workflow` skill → `git-workflows` workflow domain (seed) — INTAKE (2026-06-18, realigned 2026-06-19)

- **Task that required it:** standardize the GitHub workflow *for agents* — one documented
  `branch → commit → PR → review → CI → merge` loop instead of agents improvising branch names,
  commit style, and PR shape differently every session.
- **Existing thing that failed:** `git-workflow` + `github-ops` document the loop but leave three
  conventions unresolved for nxtlvl — Conventional Commits vs this repo's sentence-case history,
  attribution defaults disagree, and the bases re-derive review instead of reusing `nxtlvl:review`.
- **Classification (domain map):** `git-workflows` is a **Layer-2 workflow domain** (a verb/entry
  point, like `review`/`dev`/`research`), **not** a confident-core capability domain — so it is
  *not* build-now; it enters via **this intake entry** ([ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md)).
  Same posture as `agent-building` (a reactive workflow), admitted because the task above is real
  and recurring.
- **Action taken (seed only):** vendored `git-workflow` + `github-ops` into
  [`plugins/nxtlvl/skills/github-workflow/SKILL.md`](../../plugins/nxtlvl/skills/github-workflow/SKILL.md),
  refined for fit ([ADR-003](../decisions/ADR-003-compose-not-reconstruct.md)): Conventional Commits,
  draft-PR-first, no attribution, full-loop scope; composes `nxtlvl:review` at the review step. This
  is the **knowledge layer only** — the domain's thin command + isolated executor agent are still to
  build as the §6 triad, with the agent **loading this skill as its single source of truth** (not
  restating it) per [ADR-012](../decisions/ADR-012-agents-execute-skills-hold-knowledge.md), mirroring
  `doc-keeper`. The domain decision is recorded by the build session as **ADR-015**. See
  [`nxtlvl-git-workflows-domain-handoff.md`](nxtlvl-git-workflows-domain-handoff.md).
- **Upstream disposition:** `agent-skills`/ECC stay installed and untouched — dormant-not-deleted
  per [ADR-002](../decisions/ADR-002-ecc-dormant-reference-backstop.md).
