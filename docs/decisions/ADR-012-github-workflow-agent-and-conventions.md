---
id: ADR-012
title: "Standardize the GitHub workflow as an agent that composes skills — Conventional Commits, no attribution"
status: Accepted
date: 2026-06-18
---

# ADR-012: Standardize the GitHub workflow as an agent that composes skills — Conventional Commits, no attribution

## Context

Agents working in `nxtlvl` improvise the path from working tree to merged PR — branch naming,
commit style, PR shape, when to review, when to merge — differently each session. That drift is
exactly the kind of task-independent machinery the harness is meant to standardize: *would I want
this no matter what I'm working on this week?* → yes ([ADR-008](ADR-008-reactive-growth-intake-gate.md)
membership test). agent-skills/ECC ship two bases — `git-workflow` (local git → PR) and
`github-ops` (issues/CI/releases) — but neither matches nxtlvl as-is, and three choices are
genuinely contested:

1. **Commit convention.** The ECC base mandates Conventional Commits; this repo's *actual* history
   is imperative sentence-case ("Add dangerous-bash gate", "Vendor ECC-main reference"). A standard
   must pick one, and the two sources disagree.
2. **Shape.** A plain skill documents conventions but nothing *drives* the loop. The ECC shape is an
   **agent that executes skills** — but the intent doc lists agent-building as a *deferred, reactive*
   question and forbids reconstructing orchestration ([ADR-003](ADR-003-compose-not-reconstruct.md)).
   Introducing the **first nxtlvl agent** is therefore an architectural commitment, not a detail.
3. **Attribution.** ECC disables commit attribution globally; this repo's history carries
   `Co-Authored-By` trailers. The standard has to say which is canonical.

## Decision

Ship the GitHub workflow as a **skill the agent executes**, refined for fit:

- **Skill `nxtlvl:github-workflow`** — vendored from `git-workflow` + `github-ops`, self-contained
  for the everyday loop (`branch → commit → PR → review → CI → merge`), with the long tail left as a
  pointer into `reference/ECC-main`. Scope is the **full loop**; issue triage / releases / stale /
  security stay out until a logged repeat-need pulls them in.
- **Agent `nxtlvl:github-workflow`** — the **first nxtlvl agent**. It *drives* the loop and
  **composes skills** rather than reconstructing them: the loop/commit/PR conventions come from
  `nxtlvl:github-workflow`, and the review stage delegates to `nxtlvl:review`. This stays inside the
  [ADR-003](ADR-003-compose-not-reconstruct.md) boundary — it composes existing skills via the native
  dispatcher; it does **not** reimplement routing or the tool-loop.
- **Conventional Commits** is the nxtlvl standard (`<type>(<scope>): <subject>`), refining *toward*
  the ECC base and *away* from this repo's sentence-case history — machine-parseable, enables
  changelog tooling, and aligns branch names with commit types.
- **No attribution** — commits are clean, no `Co-Authored-By` / agent signature, matching the ECC
  global default. (An execution environment that *forces* a trailer, e.g. a remote CI harness, is
  that environment's policy, not the nxtlvl standard.)

## Alternatives Considered

### Plain skill, no agent
- Pros: smallest surface; no new layer; defers the agent question the intent doc parks.
- Cons: documents the loop but nothing *executes* it — the standardization the request asked for
  ("for agents") stays advisory; every session still hand-drives the steps.
- Rejected: the user explicitly wants the ECC shape — an agent that executes the skills.

### Keep imperative sentence-case (match existing history)
- Pros: zero churn; consistent with the 20 commits already in the repo.
- Cons: not machine-parseable; no type vocabulary to share with branch names; diverges from the
  base every other agent-skills/ECC artifact assumes.
- Rejected: the standard is forward-looking; Conventional Commits buys tooling and a shared
  vocabulary that one-off sentence-case can't.

### Reconstruct review inside the workflow agent
- Pros: a single self-contained agent.
- Cons: duplicates `nxtlvl:review`, re-deriving SDLC substance the harness already owns — the exact
  anti-goal of [ADR-003](ADR-003-compose-not-reconstruct.md).
- Rejected: the agent composes `nxtlvl:review`; it does not re-implement it.

### Full github-ops scope (issues, releases, stale, security)
- Pros: one skill covers everything GitHub.
- Cons: most of it is task-dependent and unproven for this workload; violates the intake gate's
  "build the task-independent core, grow the rest reactively."
- Rejected: ship the full *loop*; admit ops only on a logged repeat-need ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).

## Consequences

- `nxtlvl` gains its **first agent** and an `agents/` directory; this agent is the template the next
  one (a likely reactive `agent-builder`) will follow — agents **compose skills**, they don't
  reconstruct them.
- Commit history going forward is Conventional-Commit form; the earlier sentence-case commits are
  left as-is (not rewritten — public history).
- The workflow agent leans on the `dangerous-bash` gate ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md))
  for force-push protection rather than re-implementing guards.
- Logged as an intake event in `docs/plan/nxtlvl-skill-intake-backlog.md` per
  [ADR-008](ADR-008-reactive-growth-intake-gate.md); recorded here per the global decision rule
  ([ADR-010](ADR-010-global-decision-rule.md)). `agent-skills`/ECC stay the dormant upstream
  ([ADR-002](ADR-002-ecc-dormant-reference-backstop.md)).
