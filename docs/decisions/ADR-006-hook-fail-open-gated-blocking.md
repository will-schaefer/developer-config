---
id: ADR-006
title: "Hook safety — fail-open on error (absolute); deliberate blocking only via the intake gate, with kill switches"
status: Accepted
date: 2026-06-16
amended: 2026-06-19
---

# ADR-006: Hook safety — fail-open on error (absolute); deliberate blocking only via the intake gate, with kill switches

## Context
The hook layer is the harness's lifecycle-interception point, and it is also its
**highest-severity failure mode**: a hook that halts a session can lock me out of my own
daily driver. But a blanket "hooks may never block" would throw away a genuinely useful
capability (deliberate, well-scoped gates) to avoid the failure mode.

The key insight (optimized from ecc's model) is that a hook *erroring* and a hook *deciding
to block* are **two different things** and deserve two different rules.

## Decision
Separate the two code paths:

- **Errors always fail open — absolutely, gates included.** Any *unexpected* failure
  (exception, bad parse, missing dependency, timeout) → swallow it, `exit 0`, do/inject
  nothing. A broken hook must never halt a session. A block is only ever a decision a hook
  reached **cleanly**; it is never the byproduct of a crash. In shell: no `set -e`, explicit
  `exit 0` on every path, no decision output, errors swallowed.
- **Deliberate blocking (`exit 2`) is permitted but gated.** A session hook *may* block, but
  only as a **named, whitelisted gate** that earned its slot through the reactive intake gate
  ([ADR-008](ADR-008-reactive-growth-intake-gate.md)). Exit-code contract is uniform:
  `exit 0` = pass/warn (stderr surfaced as a non-blocking nudge), `exit 2` = block.
- **Every blocking gate ships an env-var kill switch** (ecc pattern, e.g. `ECC_GATEGUARD=off`)
  — one variable disables it with no reinstall, the in-session escape hatch *before* rollback
  is even needed.
- **The invoked audit is the one exception** — it blocks *unconditionally* because it is the
  gate *meant* to stop promotion ([ADR-009](ADR-009-objective-invoked-audit-gate.md)). Session
  gates are advisory-by-construction: killable, and fail-open on error.

**Restraint is a policy choice, not a missing capability.** The harness *can* block; which
gates turn on is governed by the intake gate. `nxtlvl` stays "a book on the shelf, not a
coworker" by enabling *few* gates — not by being unable to.

## Alternatives Considered

### Fail-closed gates (block on error)
- Pros: "safe by default" intuition.
- Cons: a buggy hook locks me out of my own daily driver — the worst possible outcome.
- Rejected: errors must never halt a session.

### Blanket "no session hook may ever block"
- Pros: trivially safe; impossible to lock out.
- Cons: drops a real, sometimes-wanted capability; makes restraint structural rather than
  a deliberate policy choice.
- Rejected: capability is retained but gated; the *default* is few/no gates.

### No kill switch (rely on rollback for escape)
- Pros: less surface.
- Cons: forces a full promotion rollback to escape a misbehaving gate mid-session.
- Rejected: every gate gets an env-var kill switch as the cheap in-session escape.

## Consequences
- All Phase-0 session hooks (`fallback-log.sh`, `session-context.sh`, `session-metrics.sh`)
  are fail-open: explicit `exit 0`, no `set -e`, errors swallowed.
- **Fault-injection is a required gate** (M6): break a hook's body and confirm the session is
  not blocked and the hook still exits 0.
- Hooks are smoke-tested at promotion; rollback (git tag + reinstall, dormant ecc) is the
  deeper escape hatch ([ADR-001](ADR-001-plugin-local-marketplace-packaging.md),
  [ADR-002](ADR-002-ecc-dormant-reference-backstop.md)).
- The platform nuance is respected: `SessionStart`/`SessionEnd`/`Notification` cannot be
  blocked anyway; our session hooks fail open regardless.

## Clarifying Note (2026-06-19) — carve-out, not a reversal

The context-and-memory spec (§7) makes explicit what "fail open" means and does **not** mean.
This note records that clarification; it does **not** change the rule above.

**"Fail open" means *never HALT the session*.** Any crash / bad-parse / timeout → `exit 0`,
session proceeds. It does **not** mean "silently do nothing on error." Three invariants hold
even on the error path:

**(a) Liveness record.** A hook or background observer that dies must leave a one-line
heartbeat/liveness record. A silent observer death is a fault to surface at the next briefing
(spec §4.1 staleness flag), not an invisible no-op.

**(b) Write-atomicity on shared stores.** Every write to a shared file (instinct files, logs)
is atomic — temp file + rename. A crashed or concurrent writer can never leave a torn or
half-written record. (See [ADR-025](ADR-025-project-identity-observer-concurrency.md) for the
observer concurrency model.)

**(c) The secret invariant is fail-*closed*.** If scrubbing throws or cannot complete, the
observation is **dropped, never persisted raw**. A scrub failure must not fall through the
"error → do nothing" path into a raw secret on disk.

Cross-reference: spec §7 and [ADR-013](ADR-013-floor-on-demand-backbone.md).
