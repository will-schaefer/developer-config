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

- **Task that required it:** record the decision rule (`~/.claude/rules/decisions.md`) and all future decisions in my house ADR format, and
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

## 2. `github-workflow` (skill) — VENDORED (2026-06-18)

- **Task that required it:** standardize the GitHub workflow *for agents* — give nxtlvl one
  documented `branch → commit → PR → review → CI → merge` loop instead of agents improvising branch
  names, commit style, and PR shape differently every session.
- **Existing thing that failed:** `git-workflow` + `github-ops` document the loop but leave three
  conventions unresolved for nxtlvl — ECC mandates Conventional Commits while this repo's history is
  sentence-case, attribution defaults disagree, and the bases re-derive review instead of reusing
  `nxtlvl:review`. A thin call to either upstream left the conventions unresolved.
- **Membership:** build-now. A standardized GitHub loop is task-independent machinery (it applies on
  every project that touches GitHub), so it qualifies on the spot — no logged near-miss needed.
- **Action taken:** vendored `git-workflow` + `github-ops` into
  [`plugins/nxtlvl/skills/github-workflow/SKILL.md`](../../plugins/nxtlvl/skills/github-workflow/SKILL.md),
  refined for fit ([ADR-003](../decisions/ADR-003-compose-not-reconstruct.md), [ADR-017](../decisions/ADR-017-git-workflows-domain.md)):
  Conventional Commits, draft-PR-first, no attribution, full-loop scope. The skill runs in-context
  and **composes** the existing `nxtlvl:review` agent at the review step rather than reconstructing
  it; per the agent-vs-skill axis ([`ecc-agent-vs-skill-scoping.md`](../reference/ecc-agent-vs-skill-scoping.md) §5)
  the write-and-push loop is a skill, not a standalone agent. Dropped the live upstream calls;
  long-tail recipes stay a pointer into `reference/ECC-main/skills/git-workflow`.
- **Upstream disposition:** `agent-skills`/ECC stay installed and untouched — dormant-not-deleted
  per [ADR-002](../decisions/ADR-002-ecc-dormant-reference-backstop.md).

## 3. `git-workflows` domain (command + agent) — BUILT (2026-06-19)

- **Task that required it:** ship the standardized GitHub loop as a reusable `git-workflows` *domain* —
  a `/git-workflow` entry that drives a change to a reviewed, mergeable PR with the noisy diff/CI/review
  work off the main thread, not just a documented procedure the main thread runs inline.
- **Existing thing that failed:** the single in-context `github-workflow` skill (entry #2, [ADR-017](../decisions/ADR-017-git-workflows-domain.md))
  ran the whole loop on the main thread — no isolation, no model routing, and **no sandbox** stopping an
  over-eager agent from editing source while "just committing." A skill *cannot* express a `tools:`
  allowlist or a `model:` tier ([`ecc-agent-vs-skill-scoping.md`](../reference/ecc-agent-vs-skill-scoping.md) §2),
  so the executor capability was inexpressible as a skill alone.
- **Membership:** build-now. A standardized, isolated GitHub-loop executor is task-independent machinery
  (it applies on every project that touches GitHub), so it qualifies on the spot.
- **Action taken:** added agent [`git-workflow-runner`](../../plugins/nxtlvl/agents/git-workflow-runner.md)
  (`tools: Read, Grep, Glob, Bash, Skill` — Bash but **no `Write`/`Edit`**; `model: sonnet`) and thin
  command [`/git-workflow`](../../plugins/nxtlvl/commands/git-workflow.md); refined the
  [`github-workflow`](../../plugins/nxtlvl/skills/github-workflow/SKILL.md) skill in place to stay
  caller-agnostic. The executor composes `nxtlvl:review` at the review step. Recorded as
  [ADR-017](../decisions/ADR-017-git-workflows-domain.md).
- **Upstream disposition:** `agent-skills`/ECC stay installed and untouched — dormant-not-deleted
  per [ADR-002](../decisions/ADR-002-ecc-dormant-reference-backstop.md).
