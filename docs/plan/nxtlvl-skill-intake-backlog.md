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
