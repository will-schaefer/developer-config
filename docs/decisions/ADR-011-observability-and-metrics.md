---
id: ADR-011
title: "nxtlvl-harness observability and metrics — north-star measurement and automatic logging"
status: Draft
date: 2026-06-28
---

# ADR-011: nxtlvl-harness observability and metrics — north-star measurement and automatic logging

## Context

The harness needs to measure itself to know if it is working. What constitutes a meaningful signal, what gets logged automatically, and how the harness distinguishes between improvement and degradation are all open questions. The scope here is the fallback log and dual metric, designed from scratch with the production-quality bar from ADR-003 as the standard.

Observability is not optional — without it, the harness cannot know whether changes are helping or hurting. But too much observability creates noise and maintenance burden. The right balance starts from what the harness actually needs to measure, not from what is easy to log.

### The questions

**1. What is the north-star metric?**

What single question does the harness answer to know if it is covering the user's work? Options: fallback rate (how often the user reaches for something outside the harness), quality of outputs, coverage of the workload, or something else. The metric must be measurable without willpower and resistant to gaming.

**2. What gets logged automatically?**

Whatever the metric is, it needs a substrate — a durable log written by the harness, not the user. What events are worth capturing, at what granularity, and where does the log live? Too much logging is noise; too little means the signal is lost.

**3. Is one metric enough, or is a dual metric needed?**

A single metric is gameable — you can optimize the number without improving reality. A dual metric (e.g. coverage + quality) is more robust but harder to maintain. Whether a second readout is warranted, and what it would measure, is open.

**4. What does production-quality observability look like?**

How do production harnesses instrument themselves — what do they log, what metrics do they surface, and what anti-patterns exist (metrics that rot, logs that grow unbounded, signals that mislead)?

### What agents-wiki is being queried on

- What observability and metrics patterns do production agent harnesses use — what is typically logged, what metrics are surfaced, and how automatic vs. manual is the instrumentation?
- How do production harnesses avoid gaming a single north-star metric — dual metrics, quality gates, or something else?
- What log designs appear in production harnesses — format, location, retention, and how logs feed back into harness behavior?
- Any anti-patterns: metrics that degrade over time, logs that become noise, observability that requires too much willpower to maintain?

## Decision

> **Pending** — querying agents-wiki on production observability and metrics patterns.
> Decision to be recorded here once the call is made.

## Alternatives Considered

> To be completed alongside the decision.

## Consequences

> To be completed alongside the decision.
