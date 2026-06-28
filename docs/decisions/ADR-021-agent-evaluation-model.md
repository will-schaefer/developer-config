---
id: ADR-021
title: "Agent evaluation — advisory per-task self-evaluation; formal eval suites stay reactive; never a gate"
status: Draft
date: 2026-06-28
---

# ADR-021: Agent evaluation — advisory per-task self-evaluation; formal eval suites stay reactive; never a gate

## Context
Phase 3 (Evaluate) of the harness-review build method.
[ADR-013](ADR-013-skill-agent-authoring-model.md) deferred one question: how the "done-condition
first" stand-in hardens into a real evaluation, and how that relates to the existing `review`
skill and stop-slop ([ADR-024](ADR-024-prose-quality-stop-slop.md)).

ECC carries three surfaces under the word "eval": `agent-self-evaluation` (a per-task 1-5
scorecard on accuracy / completeness / clarity / actionability / conciseness, with an evidence
rule and anti-patterns, explicitly not a gate); `eval-harness` (formal eval-driven development —
capability + regression evals, code/model/human graders, pass@k thresholds, a `.claude/evals/`
layout); and `agent-eval` (a CLI comparing coding-agent products on pass-rate / cost / time /
consistency).

nxtlvl already owns the adjacent surfaces: the `review` skill (five-axis code review),
[ADR-024](ADR-024-prose-quality-stop-slop.md) (prose quality),
[ADR-014](ADR-014-audit-gate.md) (the objective, binary, invoked promotion gate that blocks
unconditionally and explicitly rejects a self-tunable quality score), and
[ADR-011](ADR-011-observability-and-metrics.md) (the metric model — two automatic readouts,
fallback-rate and instinct-confidence, with no session quality score).

## Decision
1. **Adopt `agent-self-evaluation` as an advisory per-task done-condition check (adapted).**
   After non-trivial work, before returning to the orchestrator, the executor self-rates its
   output on the five axes with the evidence rule ("show the gap, don't just name it") and the
   anti-patterns adopted wholesale (no everything-is-5, no penalizing scope the user did not
   request, no re-litigating settled design, no preference-as-evidence). A weak axis triggers a
   fix-now (if cheap) or an explicit flag to the orchestrator.
2. **It is advisory, never a gate.** [ADR-014](ADR-014-audit-gate.md) already
   rejected a self-tunable quality score as a blocker; a self-rated scorecard used as a gate is
   that rejected thing. Self-evaluation therefore stays advisory by construction. The only
   blocking gate remains the promotion audit.
3. **No third rubric — defer to the surfaces that already exist.** For code diffs the self-check
   points to the `review` skill; for prose, clarity/conciseness defer to stop-slop
   ([ADR-024](ADR-024-prose-quality-stop-slop.md)). The generic five axes apply to what the
   existing surfaces do not fully cover: analysis, design, ADRs, and written deliverables.
4. **Formal eval suites stay reactive.** The eval-first principle is already adopted
   ([ADR-013](ADR-013-skill-agent-authoring-model.md)). Standing pass@k / regression suites
   (`eval-harness`) are reserved as intake-gated machinery
   ([ADR-015](ADR-015-scope-determination-and-extension-gate.md)), attached to the promotion audit
   ([ADR-014](ADR-014-audit-gate.md)) when justified — not a standing
   `.claude/evals/` harness built now.

## Alternatives Considered

### Adopt agent-self-evaluation as a delivery gate (block on a minimum score)
- Pros: a hard quality floor on every task.
- Cons: a self-rated score is gameable and drifts — exactly the self-tunable-score gate
  [ADR-014](ADR-014-audit-gate.md) rejected; it would also slow every task.
- Rejected: keep it advisory; the one blocking gate is the objective promotion audit.

### Stand up eval-harness now (capability/regression suites, pass@k in CI)
- Pros: rigorous, regression-proof.
- Cons: standing test-suite machinery for a product; heavyweight for a single-operator harness
  with nothing yet to regress against.
- Rejected: adopt the principle ([ADR-013](ADR-013-skill-agent-authoring-model.md)), defer the
  machinery to reactive intake ([ADR-015](ADR-015-scope-determination-and-extension-gate.md)) bound
  to the promotion audit ([ADR-014](ADR-014-audit-gate.md)).

### Adopt agent-eval (head-to-head coding-agent comparison)
- Pros: data-backed tool selection.
- Cons: a product bake-off (Claude Code vs Aider vs Codex); out of scope for one operator on
  Claude Code.
- Rejected on scope; the consistency-across-runs nugget is covered by pass^k if ever needed.

### Author a new nxtlvl five-axis rubric distinct from the review skill
- Pros: a single bespoke rubric.
- Cons: a third overlapping rubric next to `review` and stop-slop; duplication and drift.
- Rejected: self-eval defers to the existing surfaces; the generic axes cover only the gap.

## Consequences
- Executors gain a cheap, evidence-bound reflection step that catches omissions before the
  orchestrator (and the user) see them, without adding a gate or latency to the critical path.
- The quality model is now layered and non-overlapping: per-task self-check (advisory) -> code
  via `review`, prose via stop-slop -> promotion audit (the only block,
  [ADR-014](ADR-014-audit-gate.md)) -> the metric readouts
  ([ADR-011](ADR-011-observability-and-metrics.md)).
- Self-evaluation stays a per-task advisory signal; it does **not** feed a standing
  session-quality score — [ADR-009](ADR-009-session-lifecycle.md) settled that nxtlvl keeps
  none, and [ADR-011](ADR-011-observability-and-metrics.md)'s metric is two automatic readouts
  (fallback-rate + instinct-confidence). Recurring weak axes surface reactively through that
  signal, not a score.
- Complements the quality-first principle (quality of outcome over leanness): the self-check
  optimizes *quality of outcome*, never size — an axis is never marked down for staying within a
  budget, the mirror of the quality-first rule that a gate may never encode "smaller is better."
- Formal pass@k suites remain on the shelf, gated by intake
  ([ADR-015](ADR-015-scope-determination-and-extension-gate.md)) and bound to the promotion audit.
- The self-eval discipline is itself authored as a caller-agnostic skill loaded by the executor
  that runs it ([ADR-013](ADR-013-skill-agent-authoring-model.md)), not baked into each agent.
