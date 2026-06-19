---
name: nxtlvl-router
description: nxtlvl skill router — the meta-skill that decides which skill applies to the task at hand, preferring nxtlvl-refined skills and falling through to upstream agent-skills for everything else. Use at the start of any non-trivial task, when starting a session, or whenever you're unsure which skill (if any) governs what you're about to do. This is how all other nxtlvl skills get discovered and invoked.
---

# nxtlvl Router

nxtlvl does not reconstruct the engineering lifecycle — it **composes on `agent-skills` and refines a few skills where my conventions diverge** (ADR-003). This router is how that composition is navigated: for any task, it points you at the *right* skill, preferring the nxtlvl-refined version where one exists and falling through to the upstream `agent-skills:*` skill otherwise.

It routes; it does not restate. Each skill holds its own knowledge (ADR-012) — this file sends you there, it doesn't duplicate what's inside. **Pointers over dumped content** applies to the router itself.

This router *is* nxtlvl's analog of `agent-skills:using-agent-skills` — that upstream meta-skill is the one skill deliberately absent from the map below, because this file replaces it.

## The precedence rule

For every phase below, resolve in this order — **first that exists wins:**

```
nxtlvl:<skill>   →   agent-skills:<skill>   →   native (handle it directly, no skill)
```

A nxtlvl-refined skill is **self-contained** — it does *not* call its upstream parent, it replaces it. So when the map marks a phase ◆, invoke the nxtlvl one and stop; don't also reach for the agent-skills version. Where there's no ◆, the upstream skill is the floor — use it directly. And not every task needs a skill: a one-line fix or a pure lookup is handled natively. Skills exist to prevent recurring mistakes, not to ceremonialize trivial work.

**One naming wrinkle.** The labels below are the literal skill names — *except* `review`. Its upstream is the `agent-skills:code-review-and-quality` *skill* (`review` is only that skill's command alias). So `nxtlvl:review` supersedes `code-review-and-quality`, and the fallthrough for that one row is `code-review-and-quality`, not a skill literally named `review`. Every other row's label is both the map name and the resolved skill name.

## Discovery map

`◆` = nxtlvl-refined (use this, namespaced `nxtlvl:`). Everything else is upstream `agent-skills:*`.

```
Task arrives
    │
    ├── Don't know what you want yet? ──────→ interview-me
    ├── Rough concept, need variants? ──────→ idea-refine
    ├── New project/feature/change? ────────→ spec-driven-development
    ├── Have a spec, need tasks? ───────────→ planning-and-task-breakdown
    ├── Implementing code? ─────────────────→ incremental-implementation
    │   ├── UI work? ───────────────────────→ frontend-ui-engineering
    │   ├── API work? ──────────────────────→ api-and-interface-design
    │   ├── Need better context? ───────────→ context-engineering
    │   ├── Need doc-verified code? ────────→ source-driven-development
    │   └── Stakes high / unfamiliar code? ─→ ◆ doubt-driven-development
    ├── Writing/running tests? ─────────────→ test-driven-development
    │   └── Browser-based? ─────────────────→ browser-testing-with-devtools
    ├── Something broke? ───────────────────→ debugging-and-error-recovery
    ├── Reviewing a diff before merge? ─────→ ◆ review
    │   ├── Too complex? ───────────────────→ code-simplification
    │   ├── Security concerns? ─────────────→ security-and-hardening
    │   └── Performance concerns? ──────────→ performance-optimization
    ├── Committing/branching? ──────────────→ git-workflow-and-versioning
    ├── CI/CD pipeline work? ───────────────→ ci-cd-and-automation
    ├── Deprecating/migrating? ─────────────→ deprecation-and-migration
    ├── Writing docs / recording a decision?→ ◆ documentation-and-adrs
    ├── Adding logs/metrics/alerts? ────────→ observability-and-instrumentation
    └── Deploying/launching? ───────────────→ shipping-and-launch
```

Multiple skills routinely apply in sequence: a feature is often `spec-driven-development` → `planning-and-task-breakdown` → `incremental-implementation` → `◆ doubt-driven-development` (in-flight) → `test-driven-development` → `◆ review` → `◆ documentation-and-adrs`. When in doubt on a non-trivial task with no spec, start at `spec-driven-development`.

## Skills vs. agents

Skills hold knowledge; **agents execute it** (ADR-012). When a phase has a dedicated nxtlvl agent, the agent is the executor and the skill is its single source of truth — don't restate the skill into the agent's request.

- **`nxtlvl:doc-keeper`** (agent / `/doc-keeper`) executes `◆ documentation-and-adrs` — records the *why*, writes/supersedes ADRs, keeps the index honest. Reach for the agent when you want the documentation pass *done*; reach for the skill when you want to do it inline.

## Core operating behaviors

These hold across every skill the router dispatches to. The two house conventions come first because they're the through-line of every nxtlvl skill:

1. **Pointers over dumped content.** Reference `file:line` and link. Don't paste large blocks back into the conversation — a pointer is cheaper to read and doesn't rot.

2. **Surface assumptions.** State what you assumed about intent or environment *before* acting, so a wrong assumption is visible rather than silent. The most common failure mode is running with an unchecked guess. This is cheaper than rework and often becomes the contract a later doubt cycle reviews against.

3. **ADRs are advisory, not canonical.** Reference the relevant ADR for the *why*, but don't treat it as binding scripture — designs evolve. When you act against a recorded decision, say so and record the override (a superseding ADR, per `◆ documentation-and-adrs`), rather than silently diverging.

4. **Manage confusion actively.** On a contradiction or unclear spec: stop, name the specific confusion, present the tradeoff or ask — don't plow ahead on a guess. *"I see X in the spec but Y in the code — which wins?"* beats silently picking one.

5. **Push back when warranted.** You are not a yes-machine. When an approach has a concrete problem, name it, quantify the downside where you can, propose the alternative — then accept an informed override. Sycophancy is a failure mode.

6. **Enforce simplicity, hold scope.** Prefer the boring, obvious solution; resist the pull to overcomplicate. Touch only what the task requires — no orthogonal "cleanup," no deleting code you don't understand, no unrequested features.

7. **Verify, don't assume.** A task isn't done until there's evidence — passing tests, build output, runtime behavior. "Looks right" is not verification.

## Quick reference

| Phase | Skill | nxtlvl-refined? |
|-------|-------|-----------------|
| Define | interview-me · idea-refine · spec-driven-development | upstream |
| Plan | planning-and-task-breakdown | upstream |
| Build | incremental-implementation · source-driven-development · context-engineering · frontend-ui-engineering · api-and-interface-design | upstream |
| Build | **doubt-driven-development** — in-flight adversarial review of non-trivial decisions | ◆ nxtlvl |
| Verify | test-driven-development · browser-testing-with-devtools · debugging-and-error-recovery | upstream |
| Review | **review** — five-axis review, refined for my conventions | ◆ nxtlvl |
| Review | code-simplification · security-and-hardening · performance-optimization | upstream |
| Ship | git-workflow-and-versioning · ci-cd-and-automation · deprecation-and-migration · observability-and-instrumentation · shipping-and-launch | upstream |
| Ship | **documentation-and-adrs** — record the *why*, house ADR format (exec: `nxtlvl:doc-keeper`) | ◆ nxtlvl |

## Verification

- [ ] Checked for an applicable skill before starting non-trivial work
- [ ] Resolved each phase by precedence (nxtlvl ◆ → agent-skills → native); invoked the nxtlvl skill where one exists and did **not** also call its upstream parent
- [ ] Surfaced assumptions and used pointers, not dumped content, throughout
- [ ] Recorded any override of an ADR rather than diverging silently

$ARGUMENTS
