---
id: ADR-002
title: "Keep ecc installed-but-dormant as reference + backstop"
status: Accepted
date: 2026-06-16
---

# ADR-002: Keep `ecc` installed-but-dormant as reference + backstop

## Context
`nxtlvl` is a deliberate rebuild after wiping `~/.claude`. The prior harness, `ecc`, is
large (≈271 skills / ≈67 agents) and was previously **all-on**. Two needs pull in opposite
directions:
- I want `nxtlvl` to be **primary** — its small surface in my namespace and context, not
  drowned by ecc's breadth, and not propped up by ecc's active hooks editing over my shoulder.
- I do **not** want to throw ecc away — it is a genuine backstop for edge cases, and the act
  of reaching for it is the **signal** that powers my success metric
  ([ADR-005](ADR-005-fallback-log-dual-metric.md)).

This is a dependency-posture decision: keep, remove, or neutralize ecc.

## Decision
Flip `ecc` from **all-on → installed-but-dormant**:
- Not loaded by default — `~/.claude/settings.json` → `enabledPlugins."ecc@ecc": false`.
  Its skills/agents stay out of my namespace and context.
- ecc's **active hooks are off** (GateGuard, `pre:observe`, …) so build sessions are clean.
- **Re-enabling ecc is a deliberate, logged act** (flip to `true`) — the friction is the
  point: a reach for ecc becomes a real signal, not an ambient crutch.
- The `ecc` marketplace stays in `extraKnownMarketplaces` (still installed, recoverable).

ecc is **a book on the shelf, not a coworker** — `nxtlvl` is primary from the first install;
ecc covers only what I consciously reach for, and every reach is logged.

## Alternatives Considered

### Uninstall ecc entirely
- Pros: zero footprint, no temptation.
- Cons: loses the edge-case backstop and the sub-minute rollback safety net; destroys the
  fallback signal that the metric is built on.
- Rejected: the backstop and the signal are both load-bearing.

### Keep ecc active
- Pros: full capability always available.
- Cons: namespace/context pollution; ecc's hooks act during build; ecc stays an ambient
  crutch, so "did I need ecc?" is unanswerable.
- Rejected: directly contradicts "nxtlvl is primary" and poisons the metric.

### `ECC_GATEGUARD=off` env-var band-aid (neutralize hooks only)
- Pros: leaves ecc loaded but quiets one gate.
- Cons: **proven ineffective in this setup**; partial — leaves skills/agents in namespace.
- Rejected: full dormancy is the reliable fix and matches the intended end-state.

## Consequences
- Every reach for ecc is a deliberate, logged event → feeds the fallback log and the
  north-star metric ([ADR-005](ADR-005-fallback-log-dual-metric.md)).
- Re-enabling ecc is an **ask-first** action.
- Dormant ecc is the deeper escape hatch during any promotion rollback
  ([ADR-001](ADR-001-plugin-local-marketplace-packaging.md)) — sub-minute recovery.
- Confirmed 2026-06-17: ecc's agents/MCP disconnected at runtime after restart — dormant in
  practice, not just in config.
- Generalized 2026-06-17: **dormant-not-deleted is the standard endpoint for *any* vendored
  upstream, not just ecc.** As `agent-skills` skills are vendored into `nxtlvl` and refined for
  fit ([ADR-003](ADR-003-compose-not-reconstruct.md)) under the gated intake
  ([ADR-008](ADR-008-reactive-growth-intake-gate.md)), the upstream plugin is retired the same
  way — installed-but-dormant once enough is vendored, **never `rm`-ed** — preserving it as
  reference/backstop and keeping the fallback signal intact. First vendored:
  `documentation-and-adrs` (2026-06-17).
