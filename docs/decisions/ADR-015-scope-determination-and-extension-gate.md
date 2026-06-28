---
id: ADR-015
title: "nxtlvl-harness scope determination and extension gate"
status: Draft
date: 2026-07-28
---

# ADR-015: nxtlvl-harness scope determination and extension gate

## Context

The harness is a project with a defined scope, not a capability that accretes from work signal.
A comprehensive agent harness spans multiple well-understood domains — agent loop, context
assembly, memory, hooks, tools, skills, orchestration, multi-agent, observability, and others —
and the goal is to build across all of them deliberately, informed by what production harnesses
do in each. This is scope determination: a one-time exercise that produces the build backlog.

Scope determination is distinct from capability growth. Once the build backlog is set and the
harness is running, new things will surface during the build and after launch that were not in
the original scope. That is where an extension gate applies — but it governs the residual, not
the primary build path.

The two risks this ADR must hold simultaneously are opposite in nature:

- **Under-scoping**: building a harness that omits whole domains because they weren't in the
  original reactive demand signal. Addressed by deliberate, wiki-informed scope determination.
- **Re-explosion**: a running harness pulling in capabilities beyond its defined scope faster
  than they can be evaluated and hardened. Addressed by a written extension gate.

ADR-003 sets the production standard against which all scope and extension decisions are judged.
Nothing from prior exploration or archived decisions is binding here.

### The questions

**1. What domains does a comprehensive agent harness cover?**

There is a known domain map — agent loop, context assembly, memory & state, tool design, skills
& hooks, orchestration, multi-agent structure, observability, prompt strategy, and workflow
substance (dev, review, research, documentation). But the boundaries between domains, what a
production harness typically includes versus defers within each domain, and what the right
first-pass include/defer/exclude call is for nxtlvl in each — all of this is open and requires
querying agents-wiki for a principled domain checklist.

**2. What is the right include/defer/exclude frame?**

Not every domain needs to be built in full before the harness is useful. Some domains have a
thin version that delivers most of the value (build now) and a thick version that can be deferred.
Others may be out of scope entirely given nxtlvl's identity as a CC plugin. The frame for making
those calls — and how it is documented so the build backlog is traceable — is open.

**3. What governs extensions beyond the defined scope?**

During the build and after launch, things will surface that were not in the original domain map.
A new capability should require more than a decision to add it. There should be a written record
of the task that required it and the existing thing that failed or was absent. The form of that
record, where it lives, and how it is enforced without becoming bureaucratic overhead is open.

**4. What triggers hardening an existing capability?**

A capability already in scope that keeps failing in the same way should be revised. What the
signal is — a log of repeat failures, a count of fallbacks, a pattern in the observability data
from [ADR-011](ADR-011-observability-and-metrics.md) — and what the threshold is, is open.

**5. What is the relationship between the extension gate and the labs pipeline?**

[ADR-005](ADR-005-labs-internal-structure.md) will define an incubation pipeline for new
capabilities. Whether the extension gate governs entry into the labs pipeline, entry from labs
into the harness, or both, is open.

### What agents-wiki is being queried on

- What domains does a comprehensive agent harness cover, and what does a production harness
  typically include versus defer in each?
- How do production harnesses make deliberate scope decisions — what is the unit of scope (a
  domain, a capability, a feature), and how are include/defer/exclude calls documented?
- How do production harnesses govern additions beyond their defined scope — what intake or
  membership tests exist, and how are they enforced without becoming bureaucratic?
- What signals do production harnesses use to decide when to harden an existing capability —
  fallback logs, observability data, explicit backlogs?
- Anti-patterns: scope that is too broad (harness bloats before it stands), too narrow (whole
  domains are missing), or extension gates that are bypassed in practice.

## Decision

> **Pending** — querying agents-wiki on comprehensive harness domain coverage and scope
> determination patterns. Decision to be recorded here once the call is made.

## Alternatives Considered

> To be completed alongside the decision.

## Consequences

> To be completed alongside the decision.
