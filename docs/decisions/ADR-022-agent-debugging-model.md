---
id: ADR-022
title: "Agent debugging — an introspection self-debug loop and a scoped architecture-audit lens; diagnostic, never a gate"
status: Draft
date: 2026-06-28
---

# ADR-022: Agent debugging — an introspection self-debug loop and a scoped architecture-audit lens; diagnostic, never a gate

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
[ADR-007](ADR-007-memory-architecture.md)), so most of the 12 layers are infrastructure it
deliberately does not own. It already has a *static* promotion gate
([ADR-014](ADR-014-audit-gate.md)), a logged fallback signal
([ADR-011](ADR-011-observability-and-metrics.md)), and fail-open hooks
([ADR-010](ADR-010-hook-layer-contract.md)). This decides how the harness debugs a
misbehaving agent/skill without building audit machinery that overlaps the promotion gate.

## Decision
1. **Adopt `agent-introspection-debugging` as the in-session self-debug loop (adapted).** A
   caller-agnostic skill ([ADR-013](ADR-013-skill-agent-authoring-model.md)) the orchestrator or a
   stuck executor invokes when a task loops, burns tokens, or drifts: Capture -> Diagnose (the
   pattern table) -> Contained Recovery (the smallest discriminating action) -> Introspection
   Report. Its honesty rule is adopted in spirit: never claim auto-healing actions not actually
   performed through real tools — the same posture as fail-open hooks
   ([ADR-010](ADR-010-hook-layer-contract.md)). It pairs with the stop-and-ask discipline
   (when to halt) and [ADR-021](ADR-021-agent-evaluation-model.md) self-evaluation (quality
   reflection).
2. **Adapt `agent-architecture-audit` to a scoped harness-debug lens.** Keep it as a diagnostic
   over the layers nxtlvl owns: prompt-assembly conflict/bloat (agents, skills, rules,
   CLAUDE.md); context/memory injection discipline
   ([ADR-007](ADR-007-memory-architecture.md),
   [ADR-008](ADR-008-context-assembly.md)); delegation that does not fire
   ([ADR-012](ADR-012-agent-design-contract.md) routing); and fallback visibility
   ([ADR-011](ADR-011-observability-and-metrics.md)). Adopt its disciplines wholesale — severity
   ranking, code/config-first (not prompt-first) fixes, evidence with a confidence value, and
   "falsify the harness layer before blaming the model."
3. **Diagnostic, never a gate — no overlapping audit machinery.** The promotion audit
   ([ADR-014](ADR-014-audit-gate.md)) stays the only static, objective, binary,
   build-time gate; Phase-4 debugging is runtime, judgment-based, and never blocks. Static
   overlap (dead references, invalid frontmatter) belongs to the promotion audit, not a second
   audit. A recurring failure a debug session uncovers feeds the fallback log
   ([ADR-011](ADR-011-observability-and-metrics.md)) and the intake gate
   ([ADR-015](ADR-015-scope-determination-and-extension-gate.md)) — it does not spawn standing audit
   machinery.
4. **Scoped + reactive** ([ADR-015](ADR-015-scope-determination-and-extension-gate.md)). Both surfaces are
   vendored/refined when first needed; the harness-debug lens grows from logged failures, not
   pre-built to all 12 layers.

## Alternatives Considered

### Adopt the full 12-layer architecture audit with the JSON report envelope
- Pros: comprehensive; ready-made severity model + report schema.
- Cons: built for a standalone agent application with its own wrapper, router, memory, and
  transport — infrastructure nxtlvl composes from native CC and does not own
  ([ADR-003](ADR-003-compose-not-reconstruct.md), [ADR-007](ADR-007-memory-architecture.md)).
- Rejected on scope: keep the relevant slice and its disciplines, drop the apparatus.

### Make the debug audit a promotion gate (or fold it into the promotion audit)
- Pros: one audit surface.
- Cons: conflates a runtime, judgment-based diagnostic with a static, objective, binary gate;
  re-introduces the taste-as-gate failure [ADR-014](ADR-014-audit-gate.md) was
  designed to prevent.
- Rejected: debugging stays diagnostic and never blocks; the gate stays static and objective.

### Build a runtime self-healing loop (auto-retry/repair agent)
- Pros: hands-off recovery.
- Cons: exactly the "hidden repair loop" the architecture audit warns against — opaque, and
  against the fallback-is-logged / fail-open posture
  ([ADR-011](ADR-011-observability-and-metrics.md),
  [ADR-010](ADR-010-hook-layer-contract.md)).
- Rejected: debugging is an explicit, legible workflow, not a hidden runtime.

## Consequences
- nxtlvl gains an explicit self-debug workflow for stuck/looping/drifting delegations, ending in
  a legible introspection report rather than a silent retry — consistent with faithful reporting
  and fail-open hooks ([ADR-010](ADR-010-hook-layer-contract.md)).
- The debug/gate boundary is crisp: runtime diagnostic (this ADR) vs static promotion gate
  ([ADR-014](ADR-014-audit-gate.md)); no second audit is built.
- The architecture audit survives only as a scoped lens over owned layers; its severity and
  code-first disciplines carry into how fixes are prioritized.
- Recurring failures route to the fallback log ([ADR-011](ADR-011-observability-and-metrics.md))
  and intake gate ([ADR-015](ADR-015-scope-determination-and-extension-gate.md)), feeding reactive growth
  rather than standing machinery.
- Both surfaces are authored as caller-agnostic skills loaded by the executor that runs them
  ([ADR-013](ADR-013-skill-agent-authoring-model.md)).
