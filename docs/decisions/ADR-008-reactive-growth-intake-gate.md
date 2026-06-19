---
id: ADR-008
title: "Reactive growth governed by a written membership/intake gate"
status: Accepted
date: 2026-06-16
amended-by: [ADR-013, ADR-014]
---

# ADR-008: Reactive growth governed by a written membership/intake gate

> **Amended by [ADR-013](ADR-013-confident-core-capability-domains.md)** (2026-06-18): the
> membership-test classification below is amended for a **bounded confident-core** of five
> capability domains (Python · TypeScript/JavaScript · Rust · Frontend & UI ·
> Backend/Architecture), which move *reactive → build-now*. The intake gate and harden trigger
> here remain **unchanged** for everything outside that core.
>
> **Amended by [ADR-014](ADR-014-quality-first-over-leanness.md) (2026-06-19):** the gate stays
> verbatim, but its *reason* is **defer the UNPROVEN** (unproven machinery is maintenance/attention
> cost), **not** "keep things small." Build the moment a real need proves out. "Lean" below means
> *un-bloated by deferral*, never small-for-small's-sake.

## Context
My workload is varied — Next.js full-stack, Python, Rust, knowledge-base and LLM-wiki
construction, and agentic engineering. With that much variety, the risk **inverts**: the
danger is not that `nxtlvl` stays too thin, but that a reactive "just add a skill for this"
engine pulls things in *fast* and re-explodes the harness back to ecc scale — the exact
bloat the rebuild exists to escape.

So growth needs a brake that is **falsifiable**, not a vibe ("this seems useful").

## Decision
Govern all growth with two written tests:

- **Membership test:** *Would I want this no matter what I'm working on this week?*
  → **build now** (task-independent machinery / workflow shape). *Only matters once a
  specific task names it?* → **reactive** (e.g. a `react-reviewer`, a `postgres-migration`
  skill) — not pre-built.
- **Written intake gate (not a vibe):** a new skill/workflow joins **only** via a one-line
  backlog entry naming **the task that required it** *and* **the existing thing that failed.**
  This is falsifiable and is fed by the fallback log
  ([ADR-005](ADR-005-fallback-log-dual-metric.md)).
- **Harden trigger:** when the log shows the same recurring miss **N≈2–3 times** for a
  specific workflow, that becomes a revision ticket. Workflows are revised on **logged
  repeat-need, never on inspiration.**

The fallback log *is* the reactive catalog backlog and the un-defer trigger; deferred
machinery (continuous-learning capture, governance, the optimizer loop, the heavyweight
Bash dispatcher) un-defers only when the log proves repeat-need.

### Hook-layer corollary

The same gate governs hook *structure*, not just hook *count*. Hooks register **flat — one
per event+matcher lane** (e.g. `PreToolUse`/`Bash`, `PostToolUse`/`*`). A consolidating
dispatcher (one thin entry point fanning out to a registered chain of sub-checks) is itself
**reactive machinery subject to this gate**: it is admitted only when a single lane first
carries **≥2 independent hooks** that share input parsing *or* need deterministic ordering,
short-circuit, or result-merging. Until then, flat registration wins. Consolidating *within
one concern* (e.g. the 200K ping and ~325K backstop living in one `context-alert.js` with a
two-stage state machine, per [ADR-006](ADR-006-hook-fail-open-gated-blocking.md)) is the
right grain and needs no dispatcher.

Rationale: ECC's `bash-hook-dispatcher` is a **family** consolidation — it bundles the Bash
*quality* checks that share command-parsing — **not** "one hook per event." ECC's own
`hooks.json` registers ~28 hooks across 7 events, and a single `Bash` call still fires four
separate hook processes (the dispatcher is one of them). Adopting that scaffold now — for a
harness whose every lane holds ~1 hook by design — would be architecture-before-earned, the
precise failure this ADR exists to prevent.

## Alternatives Considered

### Proactive breadth (pre-build for anticipated needs)
- Pros: capability ready before it's needed.
- Cons: re-explodes to ecc-scale breadth; most of it never gets used; defeats the rebuild.
- Rejected: "core machinery first; scale machinery reactively."

### Vibe-based reactive additions (add when it feels useful)
- Pros: low friction.
- Cons: no falsifiable bar; the harness drifts back toward bloat by a thousand small "seems
  useful" calls.
- Rejected: the one-line intake entry (task + what failed) is the required falsifiable gate.

### Never grow past Phase 0
- Pros: maximally lean.
- Cons: real recurring gaps go uncovered; fallback-rate never plateaus low.
- Rejected: growth is wanted — but *gated*, not free.

## Consequences
- Adding any new skill/workflow is an **ask-first** action requiring the written intake entry.
- `nxtlvl` stays **focused (un-bloated) by deferring the unproven** — the intake gate **plus**
  dormant-ecc as the fallback ([ADR-002](ADR-002-ecc-dormant-reference-backstop.md)) for genuine edge
  cases. Focus is the goal, not smallness; a proven need is built at once
  ([ADR-014](ADR-014-quality-first-over-leanness.md)).
- Vendoring individual agent-skills skills, and a likely fourth "agent-building" workflow,
  both stay **reactive** rather than pre-built ([ADR-003](ADR-003-compose-not-reconstruct.md)).
- The success metric and the growth engine share one substrate: the fallback log.
- Hook registration stays **flat per event+matcher lane**; a consolidating dispatcher is
  earned structure, admitted only once a lane carries ≥2 hooks (see Hook-layer corollary).
