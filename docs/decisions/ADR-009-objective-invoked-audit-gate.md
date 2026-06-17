---
id: ADR-009
title: "Promotion gated by an objective, binary, invoked audit (not a self-tunable score, not a session hook)"
status: Accepted
date: 2026-06-16
implementation: "Deferred to Phase ≥1 — the audit is built last (it needs something to measure); concrete rubric items remain open until the harness exists. The shape decided here is firm."
---

# ADR-009: Promotion gated by an objective, binary, *invoked* audit (not a self-tunable score, not a session hook)

## Context
Promotion (install into the daily driver) is the one place `nxtlvl` *should* be stoppable —
the gate that keeps unproven work out of live sessions
([ADR-001](ADR-001-plugin-local-marketplace-packaging.md)). But a gate can fail in two
characteristic ways:
- It can **encode taste as a blocker** — e.g. a score that effectively means "not enough
  skills," which would push the harness back toward ecc-scale breadth, contradicting the
  reactive-growth discipline ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).
- It can **lock me out** — a continuously-running gate-hook with a bug would block my own
  daily driver, the worst failure mode ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md)).

## Decision
The promotion gate is a **tailored audit** (`nxtlvl:audit`) with a deliberately constrained
shape:

- **Objective, binary, scope-independent.** It checks facts, not taste: config parses, no
  dead skill/agent references, valid frontmatter, hooks exit 0 on a smoke test, no secrets.
  **All must pass to promote.**
- **Taste/quality items are warnings, never blockers** — so the gate can never encode "not
  enough skills." It is **not** a single self-tunable score.
- **Versioned rubric;** deltas are intra-version only (no silent drift of the bar).
- **Runs at promotion only, as an invoked skill** — **not** a session hook. A buggy
  gate-hook could lock me out of my own daily driver; an invoked audit cannot.
- **This is the one gate that blocks unconditionally** — it is *meant* to stop promotion,
  the deliberate counterpart to fail-open session hooks
  ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md)).
- **Tailored to this codebase** — not ecc's `harness-audit`
  ([ADR-003](ADR-003-compose-not-reconstruct.md)).

## Alternatives Considered

### ecc's `harness-audit`
- Pros: exists already.
- Cons: built for ecc's scale/assumptions, not this codebase.
- Rejected: the audit must be tailored to what `nxtlvl` actually is.

### Single self-tunable quality score
- Pros: one number, simple dashboard.
- Cons: gameable; drifts over time; tends to encode "more is better" (→ breadth bloat).
- Rejected: objective binary checks + warnings-not-blockers prevent taste-as-gate.

### Continuous session-hook audit
- Pros: always-on enforcement.
- Cons: a bug blocks the daily driver — the highest-severity failure mode.
- Rejected: the audit is invoked at promotion only; session hooks stay advisory/fail-open.

## Consequences
- The audit is **backlog item 6 — built last**, because it needs a harness to measure; only
  its *shape* is decided now.
- Until it exists, promotion is gated **manually** by install + smoke-test + fault-injection
  (the milestone binary checks).
- The objective-gate guardrail holds regardless of which rubric items are eventually chosen —
  the open rubric does not threaten the decision.
- This is the deliberate-block exception to [ADR-006](ADR-006-hook-fail-open-gated-blocking.md):
  session hooks fail open; the invoked audit blocks on purpose.
