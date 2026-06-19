# nxtlvl Domain Catalog — Shipped Agents · Skills · Commands

> A concrete inventory of every domain that **actually ships components today**, grouped as the
> harness organizes them: each domain is a `COMMAND → AGENT → SKILL` bundle
> ([ADR-016](../decisions/ADR-016-confident-core-capability-domains.md) §Decision).
>
> **Companion, not duplicate.** [`nxtlvl-domain-map.md`](nxtlvl-domain-map.md) is the *abstract
> filing lens* (3 layers; most cells deliberately empty — "a lens for filing and scoping, not a
> build manifest"). **This** doc is the opposite: only what is on disk in `plugins/nxtlvl/`.
> When the two disagree, the filesystem wins — regenerate from `plugins/nxtlvl/{agents,commands,skills}`.
>
> Generated 2026-06-19 from the live plugin surface.

---

## Legend

- **Component types:** `cmd` = command (`/name` entry point) · `agent` = isolated executor
  (own context window) · `skill` = methodology/knowledge loaded into a context.
- **Native** = authored in nxtlvl. **Alias** = a thin entry point that resolves through router
  precedence (`nxtlvl:` → `agent-skills:` → native) to an upstream skill until an nxtlvl-refined
  version is authored ([ADR-024](../decisions/ADR-024-git-workflows-domain-command-agent-skill.md),
  router skill).

---

## 1. Ideation domain

*Turn a raw idea into an approved direction before any building, then hand off to spec → plan.*
Orchestrator skill + isolated read-only agents ([ADR-026](../decisions/ADR-026-ideation-domain-orchestrator-skill-isolated-agents.md)).

| Type | Name | Native? | Purpose |
|------|------|---------|---------|
| cmd | `/brainstorm` | native | Front door: runs the `brainstorming` skill on the main thread (interactive), hands off to spec → plan. |
| cmd | `/interview-me` | alias | Direct entry to intent extraction (hypothesis + confidence, one question at a time). |
| cmd | `/grill-me` | alias | Direct entry to the deep-interrogation tier — branch-by-branch stress-testing. |
| cmd | `/idea-refine` | alias | Direct entry to divergent ideation — generate/stress-test variants from a rough concept. |
| agent | `context-scout` | native | Read-only repo/doc/history sweep at the brainstorming phase-1 seam; returns pointers-over-content brief. |
| agent | `idea-critic` | native | Fresh-context adversarial reviewer before the approval gate; hunts holes/risks (pre-decision sibling of `doubt-reviewer`). |
| skill | `brainstorming` | native | The methodology the front door runs; composes the pipeline, doesn't duplicate it. |

---

## 2. Git workflows domain

*Drive a change through branch → commit → PR → review → CI → merge.*
([ADR-024](../decisions/ADR-024-git-workflows-domain-command-agent-skill.md))

| Type | Name | Native? | Purpose |
|------|------|---------|---------|
| cmd | `/git-workflow` | native | Drives the current change through the GitHub loop; delegates to the runner agent. |
| agent | `git-workflow-runner` | native | Executes the git/gh mechanics in isolation; can commit/push but **not** Write/Edit source (fixes hand back to caller). |
| skill | `github-workflow` | native | The standardized loop (Conventional Commits, draft-PR-first, no attribution); composes `review` at the review step. |

---

## 3. Documentation & ADRs domain

*Record the* why *behind decisions and keep docs honest.*

| Type | Name | Native? | Purpose |
|------|------|---------|---------|
| cmd | `/doc-keeper` | native | Launch the doc-keeper agent to record an ADR, document a shipped feature, or reconcile drifted docs. |
| agent | `doc-keeper` | native | Writes/supersedes ADRs in house format, maintains the `docs/decisions` index, keeps README/changelog/API/CLAUDE.md current. |
| skill | `documentation-and-adrs` | native | House ADR format + ADR-worthy threshold; single source of truth the agent loads. |

---

## 4. Doubt & review domain

*Adversarial verification before a decision or diff stands.* No dedicated command — invoked by
skill, and composed by the git-workflow domain at its review step.

| Type | Name | Native? | Purpose |
|------|------|---------|---------|
| agent | `doubt-reviewer` | native | Fresh-context reviewer for doubt-driven development's DOUBT step; biased to disprove; returns typed JSON (`reviewer-output.schema.json`). |
| skill | `doubt-driven-development` | native | Subjects every non-trivial decision to fresh-context adversarial review, with a typed reviewer contract. |
| skill | `review` | native | The agent-skills five-axis review (correctness · readability · architecture · security · performance), refined for house conventions. |

---

## 5. Harness review domain

*Systematically review an external harness/repo and decide, area by area, what nxtlvl should
adopt / adapt / reject* — the mechanical realization of the build method in
[`CLAUDE.md`](../../CLAUDE.md). Skill-only (no command/agent): it orchestrates parallel read-only
fan-out subagents and lands findings via the decision rule, rather than shipping its own executor.

| Type | Name | Native? | Purpose |
|------|------|---------|---------|
| skill | `harness-review` | native | Vendor a repo (disposable clone) → partition → parallel fan-out analysis → synthesize, in one of three modes: (A) general review (scored quality + architecture), (B) adopt/adapt/reject ledger for a target, (C) single-component domain review (deep specialist audit of one subsystem — hooks/agents/skills/commands/tools/rules). Output into `docs/reference/`. Full phase detail + per-mode references in the skill's `references/`. |

---

## 6. Router (meta-domain)

*Decides which skill applies and in what precedence — how every other nxtlvl skill is discovered.*

| Type | Name | Native? | Purpose |
|------|------|---------|---------|
| skill | `nxtlvl-router` | native | Meta-skill: prefer nxtlvl-refined skills, fall through to upstream agent-skills, then native. Run at the start of any non-trivial task. |

---

## 7. Confident-core capability domains — committed, **not yet built**

[ADR-016](../decisions/ADR-016-confident-core-capability-domains.md) commits five capability
domains to a full `COMMAND → AGENT → SKILL` triad (15 components), tracked one GitHub issue per
domain. **None ship files yet** — listed here so the catalog is honest about scope. Adding a
sixth build-now domain is itself an ADR-worthy decision (the boundary is the brake).

| Domain | Planned triad | Status |
|--------|---------------|--------|
| Python | cmd + agent + skill | committed, unbuilt |
| TypeScript / JavaScript | cmd + agent + skill | committed, unbuilt |
| Rust | cmd + agent + skill | committed, unbuilt |
| Frontend & UI | cmd + agent + skill | committed, unbuilt |
| Backend / Architecture | cmd + agent + skill | committed, unbuilt |

Everything beyond these five stays governed by the reactive intake gate
([ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md)) — built only when a real task
proves the need.

---

## Summary count (shipped)

- **Commands:** 6 — `/brainstorm`, `/interview-me`, `/grill-me`, `/idea-refine`, `/git-workflow`, `/doc-keeper`
- **Agents:** 5 — `context-scout`, `idea-critic`, `git-workflow-runner`, `doc-keeper`, `doubt-reviewer`
- **Skills:** 7 — `brainstorming`, `github-workflow`, `documentation-and-adrs`, `doubt-driven-development`, `review`, `nxtlvl-router`, `harness-review`
