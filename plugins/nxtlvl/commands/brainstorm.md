---
description: Start the nxtlvl brainstorming front door — turn an idea of any kind (software, writing, strategy, research, a decision) into an approved direction before any building, then hand off to spec → plan. Runs the brainstorming skill on the main thread (the interview is interactive); it does NOT spawn an agent.
argument-hint: "[the idea, or what you want to build] (optional)"
---

# /brainstorm

The front door for any creative or build work. This command **invokes the `brainstorming` skill on the
main thread** and runs its arc with the user — explore context → discover intent → shape a direction →
approval gate → hand off to the native spec/plan pipeline.

**It does not delegate to an agent — and that is deliberate.** Unlike `/git-workflow` (which spawns an
isolated executor), the work here is an *interactive interview*, and agents can't talk to the user. The
executor is a main-thread skill by design — the "executor inversion"
([ADR-018](../../../docs/decisions/ADR-018-ideation-domain.md)).

## What it does

1. **Invoke `brainstorming`** (Skill tool) on the main thread — do not run the interview as an agent.
2. The skill **explores context** (spawning the read-only `context-scout` to sweep whatever context exists —
   repo, docs, notes, prior decisions — so file-dumps stay off the thread), then **discovers intent** —
   composing `interview-me` / `grill-me` when the idea is underspecified or high-stakes, and `idea-refine`
   when the concept is unfixed.
3. It **shapes the direction** — 2–3 approaches with a recommendation, presented in sections — and spawns the
   read-only `idea-critic` before the **approval gate**.
4. On approval it **hands off**: record any ADR-worthy decision via the decision rule, then
   `spec-driven-development` → `planning-and-task-breakdown`. It does **not** enter implementation.

## When to use

- Before building or committing to anything — writing code, scaffolding a project, drafting a document,
  starting a plan — for every feature, change, or idea, even when it looks too simple to need shaping.
- When you have a raw idea and want it driven to a direction the user has approved.

Not for: jumping straight to building (that's the pipeline *after* the gate), or running a single sub-skill
on its own — for that, use the `/interview-me`, `/grill-me`, or `/idea-refine` aliases.

$ARGUMENTS
