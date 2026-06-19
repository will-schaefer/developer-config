---
id: ADR-016
title: "Ship the GitHub workflow as a three-layer git-workflows domain — command → agent → skill — with an isolated, edit-less executor"
status: Accepted
date: 2026-06-19
supersedes: ADR-015
---

# ADR-016: Ship the GitHub workflow as a three-layer git-workflows domain — command → agent → skill — with an isolated, edit-less executor

## Context

[ADR-015](ADR-015-github-workflow-skill-and-conventions.md) standardized the GitHub loop as a single
**in-context skill** and *deliberately rejected* a standalone agent. Its argument: the loop writes /
commits / pushes (so "there's no read-only sandbox to express"), git work should stay visible on the
main thread, and the one isolatable step — review — is already its own agent. At the time that fit, and
it kept nxtlvl agent-free.

Two things changed:

1. **The framing widened from a loop to a domain.** The goal is no longer just "one documented commit
   path" — it is a reusable `git-workflows` domain that other entries can grow into, and a vehicle for
   the harness-learning goal. A domain in ECC's model ships as a *layered set*, not one file
   ([`../reference/ecc-agent-vs-skill-scoping.md`](../reference/ecc-agent-vs-skill-scoping.md) §3).
2. **nxtlvl now has agents.** `doc-keeper` landed on `main` as nxtlvl's first agent; ADR-015's premise
   that nxtlvl "ships no agents of its own" no longer holds, so introducing the loop's executor is no
   longer pre-emptive — the reactive trigger (a domain that wants an isolated worker) has arrived.

That reopens the agent-vs-skill question ADR-015 closed — and ADR-015's "no sandbox to express" claim
turns out to be wrong on inspection (see Decision).

## Decision

Ship the GitHub workflow as a three-layer **git-workflows domain**, in ECC's `command → agent → skill`
shape with a strict one-way dependency:

- **Skill `github-workflow`** (refined in place, not replaced) — the caller-agnostic knowledge:
  Conventional Commits, draft-PR-first, no attribution, the full `branch → commit → PR → review → CI →
  merge` loop, language-plural. It names no caller; the conventions from ADR-015 carry forward unchanged.
- **Agent `git-workflow-runner`** — a lean, isolated executor (`model: sonnet`) that walks the loop and
  composes `nxtlvl:review` at the review step. Its tools are `Read, Grep, Glob, Bash, Skill` — **`Bash`
  but no `Write`/`Edit`**.
- **Command `/git-workflow`** — a thin entry that detects context, spawns the executor (injecting the
  skill's conventions, since subagents don't auto-load skills), and surfaces the verdict.

**Why an agent is now justified** — refuting ADR-015's decisive point. The agent-vs-skill axis
([scoping doc](../reference/ecc-agent-vs-skill-scoping.md) §5) says the tell is *isolation / a
restricted tool sandbox / autonomy / a model tier*. ADR-015 conflated "writes via `git`" with "needs
`Write`/`Edit`." They are different: the executor needs **`Bash`** (to run git/gh) but **not**
`Write`/`Edit` (to rewrite source). An agent scoped to `Bash`-without-`Edit` **can** commit and push yet
is *structurally incapable* of silently editing your code — a real, expressible constraint a skill
cannot hold. That single sandbox satisfies the axis; isolation (the full loop's diff reads, CI logs, and
review spew stay off the main thread — only a status line returns, exactly the `/go-review` payoff in
§4) and a `sonnet` model tier are the additional wins.

## Alternatives Considered

### Keep it a single in-context skill (ADR-015's shape)
- Pros: simplest; one file; git work stays visible on the main thread.
- Cons: the *full* loop is noisy and pollutes the main thread; no model routing; no sandbox guardrail
  against an over-eager agent editing source while "just committing"; doesn't compose into a reusable
  domain or serve the harness-learning goal.
- Rejected: the domain framing plus the now-recognized `Bash`-without-`Edit` sandbox justify the executor
  that ADR-015 declined.

### Read-only executor (analyze + recommend; main thread commits/pushes)
- Pros: maximal safety; mirrors the `*-reviewer` read-only shape exactly.
- Cons: not actually an executor — every commit/push/PR bounces back to the main thread, defeating
  "drive a change to merge." The genuinely dangerous capability is editing *source*, not running *git*.
- Rejected: draw the sandbox line at `Write`/`Edit`, not at `Bash`. The executor runs git/gh; it cannot
  touch source.

### Several commands (`/git-commit`, `/git-pr`, `/git-review`) mirroring ECC
- Pros: granular entries per sub-step.
- Cons: premature proliferation against the reactive-growth gate ([ADR-008](ADR-008-reactive-growth-intake-gate.md));
  the loop is *one coherent thing* and a single executor already sequences its steps.
- Rejected for now: ship one `/git-workflow`; split only on a logged repeat-need.

## Consequences

- nxtlvl's `git-workflows` domain is its **first full `command → agent → skill` triple**; the dependency
  runs one-way and the skill stays reusable by the command, the agent, or the main thread alike
  ([scoping doc](../reference/ecc-agent-vs-skill-scoping.md) §3).
- The executor **cannot edit source by design** — when review surfaces a code fix, it hands it back to
  the caller rather than applying it. This is a feature (visible, caller-owned changes), and a constraint
  callers must expect.
- The loop **composes `nxtlvl:review`** rather than reconstructing it ([ADR-003](ADR-003-compose-not-reconstruct.md)),
  and leans on the `dangerous-bash` gate ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md)) for
  force-push protection instead of re-implementing guards.
- Supersedes [ADR-015](ADR-015-github-workflow-skill-and-conventions.md) (conventions unchanged; only the
  shape changes). Logged as intake event #3 in
  [`../plan/nxtlvl-skill-intake-backlog.md`](../plan/nxtlvl-skill-intake-backlog.md) per
  [ADR-008](ADR-008-reactive-growth-intake-gate.md); recorded here per the global decision rule
  ([ADR-010](ADR-010-global-decision-rule.md)).
