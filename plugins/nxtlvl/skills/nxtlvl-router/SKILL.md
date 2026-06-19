---
name: nxtlvl-router
description: nxtlvl skill router — the meta-skill that decides which nxtlvl skill applies to the task at hand. It endorses only skills nxtlvl has *established* and goes native at unowned phases — there is no blanket agent-skills fallthrough; a few upstream skills remain only as explicitly-named, shrinking interim exceptions. Use at the start of any non-trivial task, when starting a session, or whenever you're unsure which skill (if any) governs what you're about to do. This is how all nxtlvl skills get discovered and invoked.
---

# nxtlvl Router

This router points you at the **right nxtlvl skill** for a task — and, deliberately, at *nothing* when nxtlvl owns no skill for the phase you're in. It endorses only what the project has **established**; it does **not** advertise the whole upstream `agent-skills` catalog as if nxtlvl had adopted it ([ADR-027](../../../../docs/decisions/ADR-027-router-endorses-only-established-items.md), which amends [ADR-003](../../../../docs/decisions/ADR-003-compose-not-reconstruct.md)).

It routes; it does not restate. Each skill holds its own knowledge ([ADR-012](../../../../docs/decisions/ADR-012-agents-execute-skills-hold-knowledge.md)) — this file sends you there, it doesn't duplicate what's inside. **Pointers over dumped content** applies to the router itself.

This router *is* nxtlvl's analog of `agent-skills:using-agent-skills` — that upstream meta-skill is deliberately not used, because this file replaces it.

## The precedence rule

For any task, resolve in this order — **first that exists wins:**

```
◆ nxtlvl:<skill>   →   native (handle it directly, no skill)
```

There is **no general agent-skills tier.** A nxtlvl-refined skill is self-contained — it replaces its upstream parent, it does not call it. Where the map below marks a phase ◆, invoke the nxtlvl skill and stop. Where the map shows nothing, **nxtlvl owns no skill for that phase — handle it natively** (see *Dark at unowned phases*). Not every task needs a skill: a one-line fix or a pure lookup is handled natively regardless. Skills exist to prevent recurring mistakes, not to ceremonialize trivial work.

**The one carve-out — named interim exceptions (‡).** A *small, finite, shrinking* set of upstream `agent-skills` skills are still pointed to **by name**, because an established nxtlvl skill composes them and their ◆ replacement isn't authored yet. These are tracked debt, not a floor: each retires the moment its ◆ version ships. They are the *only* upstream skills this router endorses. Everything else upstream is unendorsed — still installed and directly invokable, but the router neither recommends nor depends on it.

`agent-skills` is not uninstalled. Removing it from the router is an **endorsement** decision, not an access-control one ([ADR-027](../../../../docs/decisions/ADR-027-router-endorses-only-established-items.md)).

## Discovery map

`◆` = established nxtlvl skill (own refined body — use it, namespaced `nxtlvl:`).
`‡` = **interim exception**: nxtlvl architecture is established but the body is borrowed from upstream `agent-skills` until the ◆ version is authored. Pointed to by name; will become ◆.

```
Task arrives
    │
    ├── Starting any creative/build work, or unsure where to begin?
    │       ─────────────────────────────────────→ ◆ brainstorming   (front door — composes the rest, then hands off to spec → plan)
    │       ├── Just extract / sharpen intent? ───→ ‡ interview-me
    │       ├── Stress-test a plan/design hard? ──→ ‡ grill-me
    │       └── Diverge on an unfixed concept? ───→ ‡ idea-refine
    │
    ├── Need a written contract before code? ─────→ ‡ spec-driven-development
    ├── Have a spec, need tasks? ─────────────────→ ‡ planning-and-task-breakdown
    │
    ├── Implementing, stakes high / unfamiliar? ──→ ◆ doubt-driven-development
    ├── Reviewing a diff before merge? ───────────→ ◆ review
    ├── Committing / branching / PR → merge? ─────→ ◆ github-workflow
    ├── Writing docs / recording a decision? ─────→ ◆ documentation-and-adrs
    └── Reviewing an *external* harness for what nxtlvl should adopt? → ◆ harness-review

Any other phase — implementation detail, testing, debugging, security,
performance, CI/CD, deprecation, observability, shipping, …:
    nxtlvl owns no skill. Handle it natively. (See "Dark at unowned phases".)
```

That last ◆ branch is an off-ramp from the SDLC, not a phase within it. `◆ harness-review` is wholly native — it studies *someone else's* repo to mine patterns, which is not the same as `◆ review` (five-axis review of *our own* diff).

A feature still flows in sequence: `◆ brainstorming` → (its handoff) `‡ spec-driven-development` → `‡ planning-and-task-breakdown` → implement *natively* with `◆ doubt-driven-development` in-flight when stakes are high → `◆ review` → `◆ github-workflow` → `◆ documentation-and-adrs`. The implement/test/debug middle is currently native — nxtlvl owns no skill there yet.

**Two named ◆ skills carry names different from the upstream they replaced** (historical context, no longer a fallthrough concern): `◆ review` supersedes the upstream `code-review-and-quality` skill (`review` is its command alias), and `◆ github-workflow` supersedes `git-workflow-and-versioning`, renamed for its GitHub/`gh` focus ([ADR-024](../../../../docs/decisions/ADR-024-git-workflows-domain-command-agent-skill.md)).

## Dark at unowned phases

For any phase not on the map, **the router offers nothing to route to** — by design ([ADR-027](../../../../docs/decisions/ADR-027-router-endorses-only-established-items.md)). nxtlvl has established only the phases above; the rest of the SDLC (implementation specifics, testing, debugging, security, performance, CI/CD, deprecation, observability, shipping) is **hand-flown natively** until nxtlvl builds a skill for it.

This is deliberate, and it has a cost: most of the lifecycle has no skill scaffolding right now. The fix is **reactive, not a floor** — phases get covered as nxtlvl builds them (the bounded confident-core of [ADR-016](../../../../docs/decisions/ADR-016-confident-core-capability-domains.md) — Python, TS/JS, Rust, Frontend, Backend — plus anything that earns its way in through the [ADR-008](../../../../docs/decisions/ADR-008-reactive-growth-intake-gate.md) intake gate). Until then, *handle it natively* is the honest answer, not *borrow an unvetted upstream skill*.

The upstream `agent-skills` skills remain installed and directly invokable if you choose — the router simply doesn't endorse them.

## Interim exceptions ledger (‡)

These five are the **only** upstream skills the router points to, and the list is meant to shrink to zero:

| ‡ Skill | Why it's still here | Retires when |
|---|---|---|
| `interview-me` | ideation sub-skill; body pending authoring (per its command file) | its ◆ body is authored |
| `grill-me` | ideation sub-skill; body pending authoring | its ◆ body is authored |
| `idea-refine` | ideation sub-skill; body pending authoring | its ◆ body is authored |
| `spec-driven-development` | composed by `◆ brainstorming`'s ideation→contract handoff ([ADR-026](../../../../docs/decisions/ADR-026-ideation-domain-orchestrator-skill-isolated-agents.md)) | its ◆ version is built |
| `planning-and-task-breakdown` | composed by the same handoff | its ◆ version is built |

`◆ brainstorming` already has its own body; it composes the three ‡ ideation sub-skills until they're authored.

## Skills vs. agents

Skills hold knowledge; **agents execute it** ([ADR-012](../../../../docs/decisions/ADR-012-agents-execute-skills-hold-knowledge.md)). When a phase has a dedicated nxtlvl agent, the agent is the executor and the skill is its single source of truth — don't restate the skill into the agent's request.

- **`nxtlvl:git-workflow-runner`** (agent / `/git-workflow`) executes `◆ github-workflow` — branch → commit → PR → review → CI → merge in isolation, composing `◆ review` at the review step. It has `Bash` but no `Write`/`Edit`, so it commits and pushes yet cannot touch source — code fixes hand back to you ([ADR-024](../../../../docs/decisions/ADR-024-git-workflows-domain-command-agent-skill.md)). Reach for the agent to drive a change to a reviewed PR; reach for the skill to do it inline.
- **`nxtlvl:doc-keeper`** (agent / `/doc-keeper`) executes `◆ documentation-and-adrs` — records the *why*, writes/supersedes ADRs, keeps the index honest. Reach for the agent when you want the documentation pass *done*; the skill when you want to do it inline.
- **`◆ brainstorming`** spawns the read-only support agents **`nxtlvl:context-scout`** (repo/context sweep) and **`nxtlvl:idea-critic`** (adversarial idea critique) at its seams; **`nxtlvl:doubt-reviewer`** is the post-decision executor that `◆ doubt-driven-development` spawns. These run in isolation and return a brief/verdict — the interactive interview itself stays on the main thread ([ADR-026](../../../../docs/decisions/ADR-026-ideation-domain-orchestrator-skill-isolated-agents.md)).

## Core operating behaviors

These hold across every skill the router dispatches to — and across natively-handled phases too. The two house conventions come first because they're the through-line of every nxtlvl skill:

1. **Pointers over dumped content.** Reference `file:line` and link. Don't paste large blocks back into the conversation — a pointer is cheaper to read and doesn't rot.

2. **Surface assumptions.** State what you assumed about intent or environment *before* acting, so a wrong assumption is visible rather than silent. The most common failure mode is running with an unchecked guess. This is cheaper than rework and often becomes the contract a later doubt cycle reviews against.

3. **ADRs are advisory, not canonical.** Reference the relevant ADR for the *why*, but don't treat it as binding scripture — designs evolve. When you act against a recorded decision, say so and record the override (a superseding/amending ADR, per `◆ documentation-and-adrs`), rather than silently diverging.

4. **Manage confusion actively.** On a contradiction or unclear spec: stop, name the specific confusion, present the tradeoff or ask — don't plow ahead on a guess. *"I see X in the spec but Y in the code — which wins?"* beats silently picking one.

5. **Push back when warranted.** You are not a yes-machine. When an approach has a concrete problem, name it, quantify the downside where you can, propose the alternative — then accept an informed override. Sycophancy is a failure mode.

6. **Enforce simplicity, hold scope.** Prefer the boring, obvious solution; resist the pull to overcomplicate. Touch only what the task requires — no orthogonal "cleanup," no deleting code you don't understand, no unrequested features.

7. **Verify, don't assume.** A task isn't done until there's evidence — passing tests, build output, runtime behavior. "Looks right" is not verification.

## Quick reference

| Phase | Skill | Status |
|-------|-------|--------|
| Ideate (front door) | **brainstorming** — composes the rest, hands off to spec → plan | ◆ nxtlvl |
| Ideate (sub-skills) | interview-me · grill-me · idea-refine | ‡ interim (body upstream, pending ◆) |
| Contract | spec-driven-development | ‡ interim (composed by brainstorming) |
| Plan | planning-and-task-breakdown | ‡ interim (composed by brainstorming) |
| Build (in-flight) | **doubt-driven-development** — adversarial review of non-trivial decisions | ◆ nxtlvl |
| Build (everything else) | *implementation, testing, debugging, …* | native — nxtlvl owns no skill yet |
| Review | **review** — five-axis review, refined for my conventions | ◆ nxtlvl |
| Ship (git) | **github-workflow** — standardized GitHub loop (exec: `nxtlvl:git-workflow-runner` / `/git-workflow`) | ◆ nxtlvl |
| Ship (everything else) | *CI/CD, deprecation, observability, shipping, …* | native — nxtlvl owns no skill yet |
| Document | **documentation-and-adrs** — record the *why*, house ADR format (exec: `nxtlvl:doc-keeper`) | ◆ nxtlvl |
| Build-method | **harness-review** — vendor an external harness → fan-out → distill adopt/adapt/reject | ◆ nxtlvl |

## Verification

- [ ] Checked for an applicable **nxtlvl** skill before starting non-trivial work
- [ ] Resolved by precedence (◆ nxtlvl → native); used a ‡ interim exception only for the five named skills, and **did not** silently reach for any other upstream `agent-skills` skill
- [ ] At an unowned phase, handled it natively rather than borrowing an unvetted upstream skill
- [ ] Surfaced assumptions and used pointers, not dumped content, throughout
- [ ] Recorded any override of an ADR rather than diverging silently

$ARGUMENTS
