---
id: ADR-010
title: "nxtlvl-harness hook layer contract"
status: Draft
date: 2026-07-28
---

# ADR-010: nxtlvl-harness hook layer contract

## Context

The harness needs a defined boundary for hooks: the layer that executes rules in response
to session lifecycle events. What happens when a hook fails, what a hook's exit codes mean,
whether a hook can block and under what conditions, and how many hooks are enough are all
open questions. ADR-003 establishes that everything is built from scratch and that the
production bar is the standard — not convenience, not what was built in prior exploration.

ADR-004 places hooks as one layer of the harness internal structure. ADR-009 defines the
session lifecycle — hooks are the execution mechanism that makes those lifecycle events
automatic. The boundary between a hook unexpectedly erroring and a hook deliberately
blocking is central; the contract must be explicit enough that hook authors cannot
accidentally halt the harness.

### The questions

**1. What is the failure contract?**

A hook can terminate with an error, a deliberate block, or success. The harness must
distinguish between a hook that crashed and a hook that is asserting a stop. Should
failures default to fail-open, fail-closed, or depend on hook type? The decision defines
how resilient the lifecycle is and how easy it is for a hook to accidentally break the
session.

**2. What is the exit-code contract?**

Hooks are scripts or commands that exit with codes. Zero, one, specific non-zero values,
reserved ranges — all need a clear meaning. The contract must be consistent across the
harness so hook authors know what their exit code does and the harness knows what to do
with it.

**3. What kill switches does every blocking hook need?**

If a hook can block the session, there must be a way to bypass it. The form could be a
flag, a config, an environment variable, or a per-hook override. The decision must set a
uniform policy: which hooks require a kill switch, how it is exposed, and whether it is
opt-in or opt-out.

**4. What events warrant hooks, and how many hooks is too many?**

The session lifecycle from ADR-009 defines candidate events, but not every event needs a
hook. The right set depends on what is actually automatic and what is better handled by
explicit commands. Too many hooks fragment behavior and make the harness hard to reason
about; too few forces logic into the wrong layer. The balance between single-responsibility
and consolidation is part of the decision.

### What agents-wiki is being queried on

- What failure contracts do production agent harnesses use for hooks — fail-open,
  fail-closed, or conditional on hook type?
- How do production harnesses distinguish an unexpected hook error from a deliberate
  block or veto?
- What kill switch patterns exist for blocking hooks — flags, config, environment
  variables, per-hook overrides — and which are considered production-grade?
- Any anti-patterns in hook design: too many hooks, hooks that are too heavy, hooks that
  silently mutate state, or hooks that blur the line between error and decision?

## Decision

> **Pending** — querying agents-wiki on production hook layer contracts and kill switch
> patterns. Decision to be recorded here once the call is made.

## Alternatives Considered

> To be completed alongside the decision.

## Consequences

> To be completed alongside the decision.
