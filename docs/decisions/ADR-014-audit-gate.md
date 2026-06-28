---
id: ADR-014
title: "nxtlvl-harness audit gate — objective promotion criteria and invocation"
status: Draft
date: 2026-06-28
---

# ADR-014: nxtlvl-harness audit gate — objective promotion criteria and invocation

## Context

The harness needs a single, deliberate point where a capability is allowed to become part
of the daily-driver plugin. That point is the audit gate. It is the intentional counterpart
to the fail-open hook layer ([ADR-010](ADR-010-hook-layer-contract.md)): hooks run
continuously and fail open so the user is never blocked; the audit runs at promotion and
must block, because promoting a broken capability into the daily driver is worse than pausing
promotion. ADR-003 establishes that the production bar is the standard.

What the audit actually checks, how it is invoked, and how it relates to the labs graduation
gate (ADR-005) are all open. The only fixed constraint is that the audit must be objective and
binary: it checks facts, not taste. Everything else — rubric, invocation model, relationship
to other gates, and enforcement structure — is part of the decision.

### The questions

**1. What does the audit check?**

The audit must verify facts that can be answered yes or no. Candidate facts include: config
parses without errors, no dead references to skills/agents/commands, frontmatter is valid and
complete, hooks exit zero, no secrets in the diff, and the promoted item matches the sandbox
scaffolding pattern. What is in scope, what is reduced to a warning, and what is out of scope
entirely is open. The rubric must be defined in a way that cannot be stretched to encode a
quality judgment.

**2. When and how is the audit invoked?**

The audit could run only at promotion time, as a continuous session hook, on a schedule, or
as some combination. A promotion-only gate is explicit and easy to bypass on purpose; a
continuous hook can catch drift but a bug in the hook can lock the user out of their daily
driver. The invocation model is part of the gate design and must be chosen for its failure
modes, not just for coverage.

**3. What is the relationship between the audit and the labs graduation gate?**

ADR-005 will define a graduation gate for cells moving from labs to harness. The audit gate
could be the same mechanism, a complementary final check, or an entirely separate concern.
The answer depends on what each gate is meant to catch: graduation may test fitness for the
harness, while the audit may test objective readiness for daily-driver loading. The boundary
between them is open.

**4. How does the audit avoid encoding taste?**

A quality score, a minimum number of skills, or a "production-ready" judgment are all taste.
The audit must be structured so that taste cannot be used as a blocker — binary pass/fail on
objective facts, with taste items surfaced only as warnings. Whether that structure is enforced
by code, by the rubric format, by review, or by some other means is open.

### What agents-wiki is being queried on

- What promotion gate patterns do production agent harnesses use — what do they check, how do
  they invoke the gate, and what is binary vs. advisory?
- How do production harnesses prevent taste or quality judgments from becoming blockers in a
  promotion gate?
- What is the relationship between a harness promotion gate and a labs or staging graduation
  gate in production harnesses that have both?
- Any anti-patterns in audit gate design: gates that block too aggressively, gates that rot as
  the rubric drifts, gates that are bypassed in practice?

## Decision

> **Pending** — querying agents-wiki on production audit gate patterns.
> Decision to be recorded here once the call is made.

## Alternatives Considered

> To be completed alongside the decision.

## Consequences

> To be completed alongside the decision.
