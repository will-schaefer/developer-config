---
id: ADR-015
title: "Agents that front a skill load it only when they run the skill to completion; spawn-target agents must not"
status: Accepted
date: 2026-06-19
---

# ADR-015: Agents that front a skill load it only when they run the skill to completion; spawn-target agents must not

## Context

[ADR-012](ADR-012-agents-execute-skills-hold-knowledge.md) established the nxtlvl convention: an
agent fronting a skill loads that skill as its single source of truth and does not restate the
skill's domain rules. `doc-keeper` is the first instance — it loads `documentation-and-adrs` and
follows it.

When `doubt-reviewer` was designed, a direct application of ADR-012 would have had it load
`doubt-driven-development`. That turned out to be wrong, for a structural reason ADR-012 did not
anticipate: **the skill itself forbids being loaded into an agent**.
[`plugins/nxtlvl/skills/doubt-driven-development/SKILL.md:31-35`](../../plugins/nxtlvl/skills/doubt-driven-development/SKILL.md)
states:

> "Do NOT add this skill to a persona's `skills:` frontmatter. A persona following Step 3 would
> spawn another persona — the orchestration anti-pattern."

The difference that drove this prohibition is what role the agent plays relative to the skill:

- `doc-keeper` **runs** `documentation-and-adrs` end-to-end. Loading the skill is the correct
  expression of ADR-012 — the skill is the methodology, the agent is its execution envelope.
- `doubt-reviewer` is **not the runner of** `doubt-driven-development`. It is the object the
  skill's Step 3 spawns — the fresh-context adversarial reviewer the main-session orchestrator
  calls out. If it loaded the skill, it would follow Step 3 and spawn another reviewer: a
  nested spawn one level deeper, exactly the anti-pattern SKILL.md forbids.

This session crystallized the distinction as a rule. Without recording it, the next agent author
will apply ADR-012 blindly and build a nested-spawn silently, only catching the error when the
doubt cycle fires.

## Decision

Loading a skill into an agent's `skills:` frontmatter is governed by the **role** the agent plays
relative to that skill:

- **Methodology agents** — the agent's purpose is to *run the skill to completion*. The skill is
  the domain-rules source the agent follows. Load it. `doc-keeper` loading
  `documentation-and-adrs` is the model.
- **Spawn-target agents** — the agent is *spawned by the skill as a step in its process*. The
  agent must **not** load the skill; doing so would cause the agent to re-enter the spawning
  skill's process from inside the spawned context, creating nested orchestration. `doubt-reviewer`
  is the first instance: it is the fresh-context reviewer that `doubt-driven-development` Step 3
  calls; its contract is fixed by the schema the skill defines
  ([`plugins/nxtlvl/skills/doubt-driven-development/reviewer-output.schema.json`](../../plugins/nxtlvl/skills/doubt-driven-development/reviewer-output.schema.json)),
  not by loading the skill itself.

The test to apply when authoring any new agent that fronts a skill: **does this agent run the
skill, or is it spawned by the skill?** Runner → load. Spawn target → do not load.

## Alternatives Considered

### Have doubt-reviewer load doubt-driven-development, rely on the skill's own warning to suppress Step 3

- Pros: consistent with ADR-012 on the surface; single authoring pattern.
- Cons: the skill's warning is prose; a model under a different prompt could miss or override it.
  The structural risk (nested spawn) exists regardless of whether the agent heeds the warning.
  Making the no-load rule structural — encoded in the agent's frontmatter as an absence — is
  stronger than relying on an in-context prose guard.
- Rejected: the anti-pattern is best prevented by design, not instruction.

### Apply ADR-012 uniformly with no exception (all agents load their skill)

- Pros: one rule, no case-split, simpler to teach.
- Cons: only works when the agent is the skill's runner. For spawn-target agents the uniform rule
  produces broken orchestration. The case-split exists in reality; suppressing it in the rule
  makes the rule wrong, not simple.
- Rejected: an inaccurate rule is worse than a rule with an explicit, well-defined exception.

### No dedicated agent — orchestrator pastes adversarial prompt onto a generic subagent each time

- Pros: nothing to maintain; the skill already contains the full adversarial prompt template.
- Cons: the orchestrator must then override the subagent's default balanced-verdict instinct on
  every invocation, which is recovery-table row 1 in the skill
  (`plugins/nxtlvl/skills/doubt-driven-development/SKILL.md`). A purpose-built agent whose
  *default* output shape already conforms to the typed contract removes that row structurally —
  the orchestrator never has to fight the agent's instincts. This is also why SKILL.md Step 3
  names `nxtlvl:doubt-reviewer` as the preferred reviewer (tier 1) over a role-based persona
  (tier 2) or generic subagent (tier 3).
- Rejected: structural removal of a failure mode beats procedural mitigation on every invocation.

## Consequences

- ADR-012's "load the skill" rule now has an explicit exception class: spawn-target agents do not
  load the skill that spawns them. ADR-012 is not superseded — the runner case still holds
  unchanged — but any author applying it must first identify which role the new agent plays.
- `doubt-reviewer`'s tool restriction (Read, Grep, Glob only — no Write, Edit, Bash, Skill) is
  the spawn-target consequence carried to its limit: a spawn target that could invoke tools or
  spawn further agents would widen the blast radius of prompt-injection attacks, since the
  artifact under review is treated as potentially hostile input. Read-only toolset makes the
  agent safe to aim at untrusted artifacts.
- The reviewer-selection tiers in SKILL.md Step 3 (`nxtlvl:doubt-reviewer` preferred, role-based
  persona second, generic subagent third) are a direct consequence of this rule: the purpose-built
  agent wins tier 1 because it is the only tier where conforming to the typed contract is the
  *default* rather than a prompt-override.
- Future agents that are spawn targets of a skill should follow the same template: no skill load,
  read-only tools where the artifact is untrusted, output contract fixed by the schema the skill
  defines rather than by the skill's own instructions.
- Cross-link: [ADR-012](ADR-012-agents-execute-skills-hold-knowledge.md) (the rule this refines),
  [ADR-003](ADR-003-compose-not-reconstruct.md) (compose, don't reconstruct — the loader/no-loader
  distinction is a composition boundary), [ADR-007](ADR-007-context-budgeted-injection.md)
  (pointers over content — spawn-target agents receive a schema pointer, not the full skill).
