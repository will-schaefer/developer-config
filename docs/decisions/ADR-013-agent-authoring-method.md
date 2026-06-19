---
id: ADR-013
title: "Authoring method — caller-agnostic skill injected into a lean executor; eval-first disciplines, scoped"
status: Accepted
date: 2026-06-19
---

# ADR-013: Authoring method — caller-agnostic skill injected into a lean executor; eval-first disciplines, scoped

## Context
Phase 2 (Author) of the harness-review build method. ADR-012 fixed *what* an agent is (static
contract + orchestrator model + scope + realization test). This decides *how* nxtlvl authors
specialists and the skills/commands that compose them.

ECC's authoring doctrine (sources): `agentic-engineering` — eval-first (define completion
criteria + baseline failures before executing), independently-verifiable units (the 15-minute
rule), model routing (haiku=narrow, sonnet=implement, opus=architecture/root-cause), session
strategy (compact at milestones, fresh after phase transitions), escalate tier only on a clear
reasoning-gap failure. The injection contract (ECC `CLAUDE.md`): "pass conventions from the
skill into the agent's prompt" — knowledge in the skill, executor lean. Command shape
(`code-review`, `build-fix`): explicit phases, severity table, binary decision rule,
deterministic output, stop-and-ask guardrails.

## Decision
1. **One-way authoring dependency: caller-agnostic skill -> lean executor.** Knowledge
   (conventions, rubric, procedure) lives in a skill, vendored from agent-skills and refined for
   fit ([ADR-003](ADR-003-compose-not-reconstruct.md)); the executor (agent or command) stays
   lean and *receives* it. In the orchestrator model
   ([ADR-012](ADR-012-agent-design-contract.md)), the main session injects the relevant skill
   into the delegated specialist's prompt. The skill never depends on its caller.
2. **Adopt agentic-engineering's authoring disciplines:**
   - Done-condition first — declare completion criteria before authoring. Formal capability/
     regression eval *suites* are deferred to Phase 3 (Evaluate).
   - Model routing — apply the tier heuristic per ADR-012; escalate only on a clear reasoning-gap
     failure.
   - Explicit stop-and-ask guardrails — every executor declares when it halts and returns to the
     orchestrator (no-progress loop, scope escalation, missing prerequisite).
   - Phased structure + deterministic output + a binary decision rule — not free-form prose.
   - Session/compaction discipline — compact at phase boundaries; delegate to isolate heavy
     context ([ADR-007](ADR-007-context-budgeted-injection.md)).
3. **Scoped + reactive.** A new skill/executor is authored only when the intake gate fires
   ([ADR-008](ADR-008-reactive-growth-intake-gate.md)); v1 workflows compose/refine, they don't
   re-derive.

## Alternatives Considered

### Fat executor (knowledge baked into the agent/command, no skill split)
- Pros: one file, nothing to inject.
- Cons: knowledge can't be reused across callers; duplicates across specialists; bloats context.
- Rejected: violates the one-way dependency and ADR-007; the split is what makes knowledge
  caller-agnostic.

### Re-derive review/dev substance (own checklists/rules from scratch)
- Pros: full ownership of content.
- Cons: re-expands the learning target beyond harness architecture; agent-skills already covers it.
- Rejected: refine agent-skills for fit, not re-derive (intent, Out of scope).

### Adopt ECC's cost ledger + GitHub-coupled command internals wholesale
- Pros: ready-made.
- Cons: the per-task cost ledger is deferred machinery (our metric is fallback x quality,
  [ADR-005](ADR-005-fallback-log-dual-metric.md)); the `gh`-baked command bodies are
  substance/coupling, not structure.
- Rejected: adopt the structural patterns only.

## Consequences
- A clear authoring recipe: knowledge -> caller-agnostic skill; executor -> lean, phased, with a
  done-condition, model tier, stop-and-ask guardrails, structured output; orchestrator injects
  the skill at delegation.
- Formal evals deferred to Phase 3; "done-condition first" is the lightweight stand-in.
- ECC's cost-ledger and gh-coupled internals are not adopted — structural shape only.
- Resolved in [ADR-014](ADR-014-agent-evaluation-model.md): the done-condition hardens into an
  *advisory* per-task self-evaluation (never a gate), which defers to the existing `review` skill
  (code) and ADR-011 stop-slop (prose); formal eval suites stay reactive.
