---
id: ADR-020
title: "Debugging — adopt the introspection self-debug loop; scope the architecture audit to owned layers; diagnostic, never a gate"
status: Accepted
date: 2026-06-19
---

# ADR-020: Debugging — adopt the introspection self-debug loop; scope the architecture audit to owned layers; diagnostic, never a gate

## Context
Phase 4 (Debug) of the harness-review build method. ECC carries two debug surfaces:
`agent-introspection-debugging` (a runtime-agnostic self-debug workflow — Capture, Diagnose,
Contained Recovery, Introspection Report — with a failure-pattern table and recovery
heuristics) and `agent-architecture-audit` (a 12-layer diagnostic for a built agent
*application*: system prompt, session history, memory, distillation, recall, tool
selection/execution/interpretation, answer shaping, platform rendering, hidden repair loops,
persistence — with severity-ranked findings and a typed JSON report).

nxtlvl composes on the native Claude Code runtime and builds no wrapper, tool router, or memory
system ([ADR-003](ADR-003-compose-not-reconstruct.md),
[ADR-004](ADR-004-extend-native-memory.md)), so most of the 12 layers are infrastructure it
deliberately does not own. It already has a *static* promotion gate
([ADR-009](ADR-009-objective-invoked-audit-gate.md)), a logged fallback signal
([ADR-005](ADR-005-fallback-log-dual-metric.md)), and fail-open hooks
([ADR-006](ADR-006-hook-fail-open-gated-blocking.md)). This decides how the harness debugs a
misbehaving agent/skill without building audit machinery that overlaps the promotion gate.

## Decision
1. **Adopt `agent-introspection-debugging` as the in-session self-debug loop (adapted).** A
   caller-agnostic skill ([ADR-018](ADR-018-agent-authoring-method.md)) the orchestrator or a
   stuck executor invokes when a task loops, burns tokens, or drifts: Capture -> Diagnose (the
   pattern table) -> Contained Recovery (the smallest discriminating action) -> Introspection
   Report. Its honesty rule is adopted in spirit: never claim auto-healing actions not actually
   performed through real tools — the same posture as fail-open hooks
   ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md)). It pairs with ADR-018 stop-and-ask
   (when to halt) and [ADR-019](ADR-019-agent-evaluation-model.md) self-evaluation (quality
   reflection).
2. **Adapt `agent-architecture-audit` to a scoped harness-debug lens.** Keep it as a diagnostic
   over the layers nxtlvl owns: prompt-assembly conflict/bloat (agents, skills, rules,
   CLAUDE.md); context/memory injection discipline
   ([ADR-004](ADR-004-extend-native-memory.md),
   [ADR-007](ADR-007-context-budgeted-injection.md)); delegation that does not fire
   ([ADR-017](ADR-017-agent-design-contract.md) routing); and fallback visibility
   ([ADR-005](ADR-005-fallback-log-dual-metric.md)). Adopt its disciplines wholesale — severity
   ranking, code/config-first (not prompt-first) fixes, evidence with a confidence value, and
   "falsify the harness layer before blaming the model."
3. **Diagnostic, never a gate — no overlapping audit machinery.** The promotion audit
   ([ADR-009](ADR-009-objective-invoked-audit-gate.md)) stays the only static, objective, binary,
   build-time gate; Phase-4 debugging is runtime, judgment-based, and never blocks. Static
   overlap (dead references, invalid frontmatter) belongs to the promotion audit, not a second
   audit. A recurring failure a debug session uncovers feeds the fallback log
   ([ADR-005](ADR-005-fallback-log-dual-metric.md)) and the intake gate
   ([ADR-008](ADR-008-reactive-growth-intake-gate.md)) — it does not spawn standing audit
   machinery.
4. **Scoped + reactive** ([ADR-008](ADR-008-reactive-growth-intake-gate.md)). Both surfaces are
   vendored/refined when first needed; the harness-debug lens grows from logged failures, not
   pre-built to all 12 layers.

## Alternatives Considered

### Adopt the full 12-layer architecture audit with the JSON report envelope
- Pros: comprehensive; ready-made severity model + report schema.
- Cons: built for a standalone agent application with its own wrapper, router, memory, and
  transport — infrastructure nxtlvl composes from native CC and does not own
  ([ADR-003](ADR-003-compose-not-reconstruct.md), [ADR-004](ADR-004-extend-native-memory.md)).
- Rejected on scope: keep the relevant slice and its disciplines, drop the apparatus.

### Make the debug audit a promotion gate (or fold it into ADR-009)
- Pros: one audit surface.
- Cons: conflates a runtime, judgment-based diagnostic with a static, objective, binary gate;
  re-introduces the taste-as-gate failure [ADR-009](ADR-009-objective-invoked-audit-gate.md) was
  designed to prevent.
- Rejected: debugging stays diagnostic and never blocks; the gate stays static and objective.

### Build a runtime self-healing loop (auto-retry/repair agent)
- Pros: hands-off recovery.
- Cons: exactly the "hidden repair loop" the architecture audit warns against — opaque, and
  against the fallback-is-logged / fail-open posture
  ([ADR-005](ADR-005-fallback-log-dual-metric.md),
  [ADR-006](ADR-006-hook-fail-open-gated-blocking.md)).
- Rejected: debugging is an explicit, legible workflow, not a hidden runtime.

## Consequences
- nxtlvl gains an explicit self-debug workflow for stuck/looping/drifting delegations, ending in
  a legible introspection report rather than a silent retry — consistent with faithful reporting
  and fail-open hooks ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md)).
- The debug/gate boundary is crisp: runtime diagnostic (this ADR) vs static promotion gate
  ([ADR-009](ADR-009-objective-invoked-audit-gate.md)); no second audit is built.
- The architecture audit survives only as a scoped lens over owned layers; its severity and
  code-first disciplines carry into how fixes are prioritized.
- Recurring failures route to the fallback log ([ADR-005](ADR-005-fallback-log-dual-metric.md))
  and intake gate ([ADR-008](ADR-008-reactive-growth-intake-gate.md)), feeding reactive growth
  rather than standing machinery.
- Both surfaces are authored as caller-agnostic skills loaded by the executor that runs them
  ([ADR-018](ADR-018-agent-authoring-method.md)).
