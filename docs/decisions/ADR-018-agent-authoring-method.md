---
id: ADR-018
title: "Authoring method — caller-agnostic skill loaded by a lean executor; eval-first disciplines, scoped"
status: Accepted
date: 2026-06-19
---

# ADR-018: Authoring method — caller-agnostic skill loaded by a lean executor; eval-first disciplines, scoped

## Context
Phase 2 (Author) of the harness-review build method. ADR-017 fixed *what* an agent is (static
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

The "inject the skill into the prompt" delivery this phase assumed was later superseded by the
build decision that an agent **loads** the skill it fronts
([ADR-012](ADR-012-agents-execute-skills-hold-knowledge.md)) — and that spawn-target agents do
**not** load it ([ADR-015](ADR-015-agent-skill-load-rule-methodology-vs-spawn-target.md)). This
ADR is reconciled to that load model below; the one-way knowledge dependency it establishes is
unchanged.

## Decision
1. **One-way authoring dependency: caller-agnostic skill -> lean executor.** Knowledge
   (conventions, rubric, procedure) lives in a skill, vendored from agent-skills and refined for
   fit ([ADR-003](ADR-003-compose-not-reconstruct.md)); the executor (agent or command) stays
   lean and *receives* it. In the orchestrator model
   ([ADR-017](ADR-017-agent-design-contract.md)), a specialist **loads** the skill it fronts when
   it runs that skill to completion (the runner case of
   [ADR-012](ADR-012-agents-execute-skills-hold-knowledge.md)); a spawn-target agent instead
   receives the skill's typed-output schema as a pointer and must not load the skill
   ([ADR-015](ADR-015-agent-skill-load-rule-methodology-vs-spawn-target.md)). The skill never
   depends on its caller.
2. **Adopt agentic-engineering's authoring disciplines:**
   - Done-condition first — declare completion criteria before authoring. Formal capability/
     regression eval *suites* are deferred to Phase 3 (Evaluate).
   - Model routing — apply the tier heuristic per ADR-017; escalate only on a clear reasoning-gap
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
- Pros: one file, nothing to load.
- Cons: knowledge can't be reused across callers; duplicates across specialists; bloats context.
- Rejected: violates the one-way dependency and ADR-007; the split is what makes knowledge
  caller-agnostic.

### Re-derive review/dev substance (own checklists/rules from scratch)
- Pros: full ownership of content.
- Cons: re-expands the learning target beyond harness architecture; agent-skills already covers it.
- Rejected: refine agent-skills for fit, not re-derive (intent, Out of scope).

### Adopt ECC's cost ledger + GitHub-coupled command internals wholesale
- Pros: ready-made.
- Cons: the per-task cost ledger is deferred machinery (our metric is the fallback log's
  readouts, [ADR-005](ADR-005-fallback-log-dual-metric.md)); the `gh`-baked command bodies are
  substance/coupling, not structure.
- Rejected: adopt the structural patterns only.

## Consequences
- A clear authoring recipe: knowledge -> caller-agnostic skill; executor -> lean, phased, with a
  done-condition, model tier, stop-and-ask guardrails, structured output; the runner agent
  **loads** the skill it fronts ([ADR-012](ADR-012-agents-execute-skills-hold-knowledge.md)), and
  a spawn-target agent takes a schema pointer instead
  ([ADR-015](ADR-015-agent-skill-load-rule-methodology-vs-spawn-target.md)).
- Formal evals deferred to Phase 3; "done-condition first" is the lightweight stand-in.
- ECC's cost-ledger and gh-coupled internals are not adopted — structural shape only.
- Resolved in [ADR-019](ADR-019-agent-evaluation-model.md): the done-condition hardens into an
  *advisory* per-task self-evaluation (never a gate), which defers to the existing `review` skill
  (code) and ADR-011 stop-slop (prose); formal eval suites stay reactive.
