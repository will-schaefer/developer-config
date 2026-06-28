---
id: ADR-013
title: "nxtlvl-harness skill and agent authoring model — skill files, agent files, and load rules"
status: Draft
date: 2026-06-28
---

# ADR-013: nxtlvl-harness skill and agent authoring model — skill files, agent files, and load rules

## Context

nxtlvl's skills and agents are core Claude Code primitives: markdown files that define
knowledge and subagent behavior. Their internal structure, the boundary between them, when
they are loaded into context, and how they are authored are all open.
[ADR-003](ADR-003-compose-not-reconstruct.md) establishes that the harness is built from
scratch against a production-quality standard.

A skill is a markdown file loaded into context. An agent is a markdown file that defines a
subagent. The two files are conceptually separate: skills hold domain knowledge; agents
execute. But the exact contents of each file, the schema for a skill pointer in an agent,
the load rule, and the authoring discipline are not yet fixed.

### The questions

**1. What does a skill file contain and how is it structured?**

A skill is a CC primitive — a markdown file loaded into context. What it should contain
(domain rules, conventions, format specs, procedures), how it should be organized, and what
it should never contain (executable logic, agent-specific workflow) is open. The structure
determines how easy skills are to maintain and how reliably agents can load and follow them.

**2. What does an agent file contain and how is it structured?**

An agent is a CC primitive — a markdown file that defines a subagent's behavior. What
belongs in the agent definition (role, tools allowlist, output contract, skill pointer) vs.
what belongs in a skill is the boundary question from ADR-012. The authoring model must make
that boundary concrete and enforceable.

**3. What is the load rule — when does an agent load its skill?**

An agent that runs a full workflow needs its knowledge skill loaded. An agent that is a
spawn target (handed a specific task by the orchestrator) may not. The load rule determines
when skills are injected into context and prevents unnecessary context bloat. The right
rule is open.

**4. What is the eval-first discipline for authoring?**

A capability should have its acceptance criteria declared before it is built — not validated
after. What "eval-first" means concretely in the authoring workflow, what pre-declared
graduation criteria look like, and how they are enforced without blocking authoring velocity
is open.

### What agents-wiki is being queried on

- How do production agent harnesses structure skill files — what do they contain, how are
  they organized, and what do they explicitly exclude?
- How do production harnesses handle the agent/skill load relationship — when do agents
  load skills, and what patterns prevent unnecessary context bloat?
- What authoring workflows do production harnesses use for skills and agents — is there an
  eval-first or contract-first discipline, and how is it enforced?
- Any anti-patterns in skill/agent authoring: skills that grow too large, agents that carry
  too much inline knowledge, load rules that pollute context?

## Decision

> **Pending** — querying agents-wiki on production skill and agent authoring patterns.
> Decision to be recorded here once the call is made.

## Alternatives Considered

> To be completed alongside the decision.

## Consequences

> To be completed alongside the decision.
