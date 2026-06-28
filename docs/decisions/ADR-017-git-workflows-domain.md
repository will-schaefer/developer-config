---
id: ADR-017
title: "git-workflows domain — three-layer command → agent → skill with an isolated, edit-less executor"
status: Draft
date: 2026-06-28
---

# ADR-017: git-workflows domain — three-layer command → agent → skill with an isolated, edit-less executor

## Context

Agents working in `nxtlvl` improvise the path from working tree to merged PR — branch naming,
commit style, PR shape, when to review, when to merge — differently each session. That drift is
exactly the kind of task-independent machinery the harness is meant to standardize: *would I want
this no matter what I'm working on this week?* → yes ([ADR-015](ADR-015-scope-determination-and-extension-gate.md)
membership test). agent-skills/ECC ship two bases — `git-workflow` (local git → PR) and
`github-ops` (issues/CI/releases) — but neither matches nxtlvl as-is, and several choices are
genuinely contested:

1. **Commit convention.** The ECC base mandates Conventional Commits; this repo's *actual* history
   is imperative sentence-case ("Add dangerous-bash gate", "Vendor ECC-main reference"). A standard
   must pick one, and the two sources disagree.
2. **Attribution.** ECC disables commit attribution globally; this repo's history carries
   `Co-Authored-By` trailers. The standard has to say which is canonical.
3. **Shape — how many layers, and where the isolation lives.** The framing here is not just "one
   documented commit path" — it is a reusable `git-workflows` domain that other entries can grow
   into, and a vehicle for the harness-learning goal. A domain in ECC's model ships as a *layered
   set*, not one file ([`../reference/ecc-agent-vs-skill-scoping.md`](../reference/ecc-agent-vs-skill-scoping.md)
   §3). The operative axis for the agent-vs-skill choice ([scoping doc](../reference/ecc-agent-vs-skill-scoping.md)
   §5) is **isolation / a restricted tool sandbox / autonomy / a model tier** — so the question is
   whether the loop has a real sandbox to express.

## Decision

Ship the GitHub workflow as a three-layer **git-workflows domain**, in ECC's `command → agent → skill`
shape with a strict one-way dependency:

- **Skill `github-workflow`** — the caller-agnostic knowledge: Conventional Commits
  (`<type>(<scope>): <subject>`), draft-PR-first, no attribution, the full `branch → commit → PR →
  review → CI → merge` loop, language-plural. It names no caller and stays reusable by the command,
  the agent, or the main thread alike. Scope is the **full loop**; issue triage / releases / stale /
  security stay out until a logged repeat-need pulls them in.
- **Agent `git-workflow-runner`** — a lean, isolated executor (`model: sonnet`) that walks the loop
  and composes `nxtlvl:review` at the review step. Its tools are `Read, Grep, Glob, Bash, Skill` —
  **`Bash` but no `Write`/`Edit`**.
- **Command `/git-workflow`** — a thin entry that detects context, spawns the executor (injecting the
  skill's conventions, since subagents don't auto-load skills), and surfaces the verdict.

**The carried conventions, settled:**

- **Conventional Commits** is the nxtlvl standard — refining *toward* the ECC base and *away* from
  this repo's sentence-case history. It is machine-parseable, enables changelog tooling, and aligns
  branch names with commit types.
- **No attribution** — commits are clean, no `Co-Authored-By` / agent signature, matching the ECC
  global default. (An execution environment that *forces* a trailer, e.g. a remote CI harness, is
  that environment's policy, not the nxtlvl standard.)
- **Scope is the full loop.** The everyday `branch → commit → PR → review → CI → merge` path is
  self-contained in the skill, with the long tail left as a pointer into `reference/ECC-main`.
- **The review step composes `nxtlvl:review`** rather than reconstructing it
  ([ADR-003](ADR-003-compose-not-reconstruct.md)).

**Why an agent is justified.** The tell on the agent-vs-skill axis ([scoping doc](../reference/ecc-agent-vs-skill-scoping.md)
§5) is *isolation / a restricted tool sandbox / autonomy / a model tier*. A naive read conflates
"writes via `git`" with "needs `Write`/`Edit`" — but they are different: the executor needs **`Bash`**
(to run git/gh) but **not** `Write`/`Edit` (to rewrite source). An agent scoped to
`Bash`-without-`Edit` **can** commit and push yet is *structurally incapable* of silently editing your
code — a real, expressible constraint a skill cannot hold. That single sandbox satisfies the axis;
isolation (the full loop's diff reads, CI logs, and review spew stay off the main thread — only a
status line returns, exactly the `/go-review` payoff in §4) and a `sonnet` model tier are the
additional wins.

## Alternatives Considered

### Keep it a single in-context skill
- Pros: simplest; one file; git work stays visible on the main thread.
- Cons: the *full* loop is noisy and pollutes the main thread; no model routing; no sandbox guardrail
  against an over-eager agent editing source while "just committing"; doesn't compose into a reusable
  domain or serve the harness-learning goal.
- Rejected: the domain framing plus the `Bash`-without-`Edit` sandbox justify a dedicated executor.

### Read-only executor (analyze + recommend; main thread commits/pushes)
- Pros: maximal safety; mirrors the `*-reviewer` read-only shape exactly.
- Cons: not actually an executor — every commit/push/PR bounces back to the main thread, defeating
  "drive a change to merge." The genuinely dangerous capability is editing *source*, not running *git*.
- Rejected: draw the sandbox line at `Write`/`Edit`, not at `Bash`. The executor runs git/gh; it cannot
  touch source.

### Several commands (`/git-commit`, `/git-pr`, `/git-review`) mirroring ECC
- Pros: granular entries per sub-step.
- Cons: premature proliferation against the extension gate ([ADR-015](ADR-015-scope-determination-and-extension-gate.md));
  the loop is *one coherent thing* and a single executor already sequences its steps.
- Rejected for now: ship one `/git-workflow`; split only on a logged repeat-need.

### Keep imperative sentence-case (match existing history)
- Pros: zero churn; consistent with the commits already in the repo.
- Cons: not machine-parseable; no type vocabulary to share with branch names; diverges from the base
  every agent-skills/ECC artifact assumes.
- Rejected: the standard is forward-looking; Conventional Commits buys tooling and a shared
  vocabulary one-off sentence-case can't.

## Consequences

- nxtlvl's `git-workflows` domain is its **first full `command → agent → skill` triple**; the dependency
  runs one-way and the skill stays reusable by the command, the agent, or the main thread alike
  ([scoping doc](../reference/ecc-agent-vs-skill-scoping.md) §3). This sets the domain-shape precedent
  later capability domains follow.
- The executor **cannot edit source by design** — when review surfaces a code fix, it hands it back to
  the caller rather than applying it. This is a feature (visible, caller-owned changes), and a constraint
  callers must expect.
- The loop **composes `nxtlvl:review`** rather than reconstructing it ([ADR-003](ADR-003-compose-not-reconstruct.md)),
  and leans on the `dangerous-bash` gate ([ADR-010](ADR-010-hook-layer-contract.md)) for force-push
  protection instead of re-implementing guards.
- Commit history going forward is Conventional-Commit form; the earlier sentence-case commits are left
  as-is (not rewritten — public history).
- Logged as an intake event in [`../plan/nxtlvl-skill-intake-backlog.md`](../plan/nxtlvl-skill-intake-backlog.md)
  per [ADR-015](ADR-015-scope-determination-and-extension-gate.md); recorded per the global decision
  rule (`~/.claude/rules/decisions.md`).
