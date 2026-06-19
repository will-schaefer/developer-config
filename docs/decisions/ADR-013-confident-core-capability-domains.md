---
id: ADR-013
title: "Pre-build a bounded confident-core of capability domains; intake gate governs the rest"
status: Accepted
date: 2026-06-18
---

# ADR-013: Pre-build a bounded confident-core of capability domains; intake gate governs the rest

## Context
[ADR-008](ADR-008-reactive-growth-intake-gate.md) classified **all** capability-domain growth
as reactive, naming language reviewers (`react-reviewer`, a `postgres-migration` skill) as the
canonical *reactive* examples. But a subset of domains is used on essentially every task
**regardless of the week's work**: the three workload languages (Python, TypeScript/JavaScript,
Rust) and the two app-build domains hit on every Next.js project (Frontend & UI,
Backend/Architecture). For these, ADR-008's own **membership test** already answers yes —
*"Would I want this no matter what I'm working on this week?"* (`ADR-008:22`). Waiting for the
fallback log to re-discover a known certainty wastes the early sessions and leaves the
highest-frequency work uncovered.

The risk this must **not** reintroduce: *"build the ones I know I'll use"* has no natural
stopping point — Python, then Postgres, then Docker, then React — which re-explodes to ecc
scale, the exact failure ADR-008 exists to prevent.

## Decision
Define a **bounded confident-core** of capability domains that are **build-now**, and keep the
**intake gate governing everything beyond it**:

- **Confident-core (build-now — 5 domains):** Python · TypeScript/JavaScript · Rust ·
  Frontend & UI · Backend/Architecture. Each ships the full **COMMAND → AGENT → SKILL** triad
  (see [nxtlvl-domain-map.md](../reference/nxtlvl-domain-map.md) §6).
- **Still reactive (ADR-008 gate, unchanged):** Integrations & APIs, DevOps & Infra, and every
  domain in the domain map §2b. These join only via the one-line intake entry (the task that
  required it + the existing thing that failed).
- **The boundary is the new brake.** The falsifiable line is the **explicit five-domain list**
  — *not* "languages I feel sure about." Adding a sixth build-now domain is itself an
  ADR-worthy decision, not a reactive add.
- **Content strategy:** vendor agent-skills + refine for fit; ecc (dormant) is cross-reference,
  never copied ([ADR-003](ADR-003-compose-not-reconstruct.md)).
- **Reviewer concern-scopes (no overlap):** language reviewers own *language-level* concerns;
  app-build reviewers own *framework/architecture* concerns and **defer language-level findings
  one-way** to the language layer — the ecc pattern where `react-reviewer` and a TypeScript
  reviewer coexist without redundancy.

This **amends ADR-008's classification** (languages move reactive → build-now) while
**preserving its mechanism** (the intake gate for all non-core growth). ADR-008 stays Accepted;
this is its capability-domain corollary.

## Alternatives Considered

### Keep all capability growth reactive (status-quo ADR-008)
- Pros: tightest possible brake; zero pre-build.
- Cons: leaves certain, highest-frequency work uncovered; wastes early sessions re-proving known
  needs through the fallback log.
- Rejected: the membership test's *build-now* branch already authorizes building certainties.

### Drop the intake gate entirely ("build whatever I think I'll use")
- Pros: maximum freedom.
- Cons: no falsifiable stop; re-bloats to ecc scale — the precise failure the rebuild exists to
  escape.
- Rejected: the brake is the point; only its *classification* changes, not its existence.

### Pre-build the whole active map (§2a, ~12 domains)
- Pros: maximal upfront capability.
- Cons: highest re-bloat risk; most cells unused; closest to the ecc pattern.
- Rejected: the core is bounded to *demonstrated* certainties, not the full active map.

## Consequences
- Five domains are **build-committed** (**15 components**); they do not wait on the fallback
  signal. Immediate build was **deferred 2026-06-18** — execution is tracked as **one GitHub
  issue per domain** (committed work, *not* subject to the reactive intake gate).
- The fallback log + intake gate still govern all non-core growth; ADR-008's membership and
  harden triggers are unchanged for everything outside the core.
- Resolves the intent's parked open question (`../intent/personal-harness.md:220`, *"which
  agent-skills get vendored first"*) — by usage-confidence for the core, by signal for the rest.
- Adding a 6th build-now domain requires a **new ADR** (the boundary is curated, not elastic).
- Domain map §2/§7 updated to mark the confident-core and the standing build-now exception.
- Cross-links: amends [ADR-008](ADR-008-reactive-growth-intake-gate.md); content/vendoring per
  [ADR-003](ADR-003-compose-not-reconstruct.md); fallback substrate
  [ADR-005](ADR-005-fallback-log-dual-metric.md).
