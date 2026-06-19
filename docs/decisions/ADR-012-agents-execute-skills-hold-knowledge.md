---
id: ADR-012
title: "Agents execute, skills hold knowledge; agent definitions point to a skill as single source of truth"
status: Accepted
date: 2026-06-18
---

# ADR-012: Agents execute, skills hold knowledge; agent definitions point to a skill as single source of truth

## Context
`nxtlvl` just gained its first agent, `doc-keeper`
([`plugins/nxtlvl/agents/doc-keeper.md`](../../plugins/nxtlvl/agents/doc-keeper.md)), whose
job is to record the *why* behind decisions and keep docs honest. Its rules — the ADR-worthy
threshold, the house YAML+body format, the lifecycle, the verification checklist — already
live in the `documentation-and-adrs` skill
([`plugins/nxtlvl/skills/documentation-and-adrs/SKILL.md`](../../plugins/nxtlvl/skills/documentation-and-adrs/SKILL.md)),
which itself defers to the global decision rule (`~/.claude/rules/decisions.md`,
[ADR-010](ADR-010-global-decision-rule.md)).

Authoring the agent forced a choice with no obvious default: should the agent prompt **carry**
those rules, or **point at** them? The answer sets the template for every nxtlvl agent that
follows, so it is worth fixing once. The choice rests on a component-type distinction that ECC
already operationalizes — agents are task executors, skills are knowledge repositories
([`../reference/ecc-agent-vs-skill-scoping.md`](../reference/ecc-agent-vs-skill-scoping.md)) —
adopted here as a binding nxtlvl convention rather than as external prior art.

## Decision
In nxtlvl, **agents execute and skills hold knowledge**, and the two stay separated:

- An **agent definition is minimal and behavioral** — it owns workflow (the phases it runs),
  the output contract (the deterministic shape it returns), stop conditions, and *which skill
  to load*. It runs in its own context window for isolated execution.
- A **skill is the single source of truth for domain rules** — format, thresholds,
  conventions. The agent **loads** the skill and follows it; it does **not** restate, paraphrase,
  or fork those rules into its own prompt.
- `doc-keeper` is the first instance and the template: it points to `documentation-and-adrs`
  for all ADR format/threshold/convention knowledge, carrying only its own execution scaffolding.
  Every future nxtlvl agent points to a skill the same way.

## Alternatives Considered

### Bake the full domain rules into the agent prompt
- Pros: self-contained agent; one file to read; no load-time skill dependency.
- Cons: the rules now live in two places. The skill is still the canonical copy (it governs
  on-demand and workflow use), so the agent's copy **drifts** the moment either side changes —
  exactly the silent doc/reality mismatch the doc-keeper exists to prevent. Re-editing every
  agent on each rule change does not scale past one agent.
- Rejected: duplication guarantees drift; a knowledge keeper that itself carries stale knowledge
  is self-defeating.

### No agent — skill only, invoked directly
- Pros: nothing to keep in sync; the skill already holds every rule.
- Cons: forfeits isolated-context execution (the work runs in the caller's window, polluting it)
  and the **deterministic output contract** (status/summary/changed/verification/next_actions)
  that makes the keeper's output machine-checkable and auditable. A skill describes *how*; it
  doesn't *run* with a guaranteed return shape.
- Rejected: the execution envelope and the contract are the value the agent adds over the skill.

## Consequences
- A standing nxtlvl convention: **point to a skill; don't restate it.** Agent prompts carry
  behavior (workflow, contract, stop conditions) and a skill pointer — nothing the skill already
  owns. This is the agent-layer expression of "pointers over content"
  ([ADR-007](ADR-007-context-budgeted-injection.md)) and of "compose, don't reconstruct"
  ([ADR-003](ADR-003-compose-not-reconstruct.md)): the agent composes the skill, it doesn't
  rebuild it.
- Drift between an agent and its skill becomes structurally impossible to introduce, because the
  agent holds no copy to drift. The single failure mode left is the skill failing to load by
  name — handled by the agent's explicit fallback (Read the SKILL.md from the plugin root).
- The agent↔skill split must be honored on every future agent; an agent that restates a skill's
  rules is a convention violation, the agent-layer analogue of the prose-drift the audit catches
  ([ADR-011](ADR-011-prose-quality-stop-slop.md)). When an objective audit exists
  ([ADR-009](ADR-009-objective-invoked-audit-gate.md)), this is a candidate binary check.
- Skills become the heavier, longer-lived artifacts; agents stay thin and cheap to add. New
  capability is added by writing/extending a skill, then a thin agent that loads it — not by
  growing an agent prompt.
