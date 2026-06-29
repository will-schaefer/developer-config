---
id: ADR-023
title: "Agent operation — gated, interactive, single-operator sessions; no autonomous, continuous, or fleet runtime"
status: Draft
date: 2026-06-28
---

# ADR-023: Agent operation — gated, interactive, single-operator sessions; no autonomous, continuous, or fleet runtime

## Context
Phase 6 (Operate) of the harness-review build method — the final phase. ECC offers three
operate-time surfaces: `autonomous-agent-harness` (a self-directing runtime — scheduled crons,
webhook/CI dispatch, computer use, a task queue, and an MCP memory knowledge-graph, pitched as a
Hermes/AutoGPT replacement); `continuous-agent-loop` (a loop-selection runtime and "production
stack" with failure modes and a recovery sequence); and `enterprise-agent-ops` (fleet operation —
runtime lifecycle, observability, change management, metrics, kill switches, an incident pattern,
and PM2/systemd/container integrations).

All three are built to remove the human from the loop and run long-lived, autonomous, or fleet
workloads. nxtlvl is the deliberate opposite: a single-operator, gated, interactive, fail-open
personal harness. Its operate-time posture is already fixed by standing decisions — fail-open hooks
with blocking only via the intake gate and kill switches
([ADR-010](ADR-010-hook-layer-contract.md)), an invoked (not continuous) promotion gate
([ADR-014](ADR-014-audit-gate.md)), the fallback-log metric surfaced as two automatic readouts —
fallback-rate and instinct-confidence ([ADR-011](ADR-011-observability-and-metrics.md),
[ADR-009](ADR-009-session-lifecycle.md)), native file-memory with no new memory system
([ADR-007](ADR-007-memory-architecture.md)), and human gates in the pipeline
([ADR-016](ADR-016-orchestration-model.md)). This decides nxtlvl's operating mode and what,
if anything, it takes from ECC's operate layer.

The build also includes an always-on automatic **floor** — a SessionStart briefing, live
capture, a one-shot background observer, and a SessionEnd bookmark
([ADR-009](ADR-009-session-lifecycle.md)). That floor is automatic *observation and distillation*,
not autonomous *self-direction*; the line this ADR draws is exactly between the two.

## Decision
1. **nxtlvl operates as gated, interactive, single-operator sessions on the native runtime.**
   Day-to-day operation is interactive sessions with an automatic observation floor but **no
   autonomous self-direction**: the promotion gate runs when invoked
   ([ADR-014](ADR-014-audit-gate.md)), hooks stay fail-open
   ([ADR-010](ADR-010-hook-layer-contract.md)), and the always-on floor observes and
   distills in the background ([ADR-009](ADR-009-session-lifecycle.md)) — emitting two
   automatic readouts, fallback-rate and instinct-confidence
   ([ADR-011](ADR-011-observability-and-metrics.md)) — while graduation stays human-invoked
   (`/evolve`). Capability starts from a build-now confident-core and grows reactively beyond it
   ([ADR-015](ADR-015-scope-determination-and-extension-gate.md)).
2. **Reject autonomous, continuous-loop, and enterprise-fleet operation as the operating mode.**
   No self-directing cron/dispatch/computer-use runtime, no loop-selection engine, no fleet
   observability or lifecycle daemon. These reconstruct the orchestration runtime that
   [ADR-003](ADR-003-build-from-scratch.md) keeps native, and a memory system
   ([ADR-007](ADR-007-memory-architecture.md)), remove the human against the gated pipeline
   ([ADR-016](ADR-016-orchestration-model.md)) and the invoked-not-continuous gate
   ([ADR-014](ADR-014-audit-gate.md)), and target a multi-agent fleet that a
   single operator does not have. The distinction from the always-on floor
   ([ADR-009](ADR-009-session-lifecycle.md)) is deliberate: that floor *observes and
   distills* automatically, but never self-tasks, schedules its own work, or acts without the
   operator — automatic observation is not autonomous self-direction.
3. **Adapt the transferable disciplines into decisions already made.** Loop failure modes (churn
   without progress, retry on the same root cause, cost drift from unbounded escalation) and the
   freeze -> reduce-scope -> replay-with-acceptance-criteria recovery are the self-debug loop
   ([ADR-022](ADR-022-agent-debugging-model.md)) plus stop-and-ask and model-escalation discipline
   ([ADR-013](ADR-013-skill-agent-authoring-model.md)) at operate time. The failure-class distribution
   idea may reactively shape the fallback log
   ([ADR-011](ADR-011-observability-and-metrics.md)). The incident pattern is the debug loop plus
   the review/security gate ([ADR-016](ADR-016-orchestration-model.md)).
4. **Any future automation rides native platform features, opted-in and scoped.** If scheduled
   check-ins or event-driven responses are ever added (the kind this project's own cloud build
   sessions already use), they ride native platform capabilities — not a hand-built orchestration
   runtime ([ADR-003](ADR-003-build-from-scratch.md) keeps orchestration native) — and inherit ECC's consent discipline:
   explicit opt-in, dry-run first, credentials kept out of versioned artifacts. They are added
   reactively through the intake gate
   ([ADR-015](ADR-015-scope-determination-and-extension-gate.md)).

## Alternatives Considered

### Adopt autonomous-agent-harness as nxtlvl's operating mode
- Pros: hands-off operation; scheduled briefings, autonomous PR review, a personal-assistant loop.
- Cons: reconstructs the orchestration runtime that [ADR-003](ADR-003-build-from-scratch.md) keeps
  native, plus a memory knowledge-graph ([ADR-007](ADR-007-memory-architecture.md));
  removes the human from a deliberately gated harness
  ([ADR-016](ADR-016-orchestration-model.md),
  [ADR-014](ADR-014-audit-gate.md)); a Hermes/AutoGPT replacement is scope a
  single operator does not need.
- Rejected: keep the consent discipline for any future opted-in, native-rooted automation; do not
  adopt the runtime.

### Adopt the continuous-agent-loop runtime + production stack
- Pros: unattended throughput; ready loop-selection and quality-gate stack.
- Cons: an unattended loop contradicts the gated, interactive mode; its real value (failure modes,
  recovery) is already covered by [ADR-022](ADR-022-agent-debugging-model.md) /
  [ADR-013](ADR-013-skill-agent-authoring-model.md) / [ADR-016](ADR-016-orchestration-model.md).
- Rejected: fold the failure-modes and recovery into existing decisions; skip the loop runtime.

### Adopt enterprise-agent-ops (fleet observability, lifecycle, rollout/rollback, PM2/systemd)
- Pros: production-grade operability for many long-lived agents.
- Cons: fleet machinery for a single-operator personal harness; "deployment" is already plugin
  install + git-tag rollback ([ADR-001](ADR-001-plugin-local-marketplace-packaging.md)), and the
  metric is already the fallback log's readouts ([ADR-011](ADR-011-observability-and-metrics.md)),
  not a dashboard.
- Rejected: keep kill switches ([ADR-010](ADR-010-hook-layer-contract.md)) and the
  incident pattern (already covered); skip the platform.

## Consequences
- nxtlvl's operating mode is settled and consistent end-to-end: interactive, gated,
  single-operator sessions; no autonomous runtime is built, so the harness cannot run away from
  its operator.
- Phase 6 reaffirms rather than extends the safety/metric/floor decisions
  (ADR-009/010/011/014): the operate layer is those decisions seen from the running-it-daily
  angle.
- Operate-time failures are handled by the existing self-debug loop and gates; recurring ones feed
  the fallback log ([ADR-011](ADR-011-observability-and-metrics.md)) and intake gate
  ([ADR-015](ADR-015-scope-determination-and-extension-gate.md)), not a new ops platform.
- A clear, narrow door is left open for future automation — native-rooted, opted-in,
  dry-run-first, credentials-out — added reactively if a real need appears.
- This closes the six-phase ECC agent-lifecycle review (Design -> Author -> Evaluate -> Debug ->
  Orchestrate -> Operate); the method now applies to any future harness brought in as a reference.
