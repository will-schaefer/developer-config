---
id: ADR-006
title: "nxtlvl-wiki internal structure — layers, runtime contracts, and language"
status: Draft
date: 2026-07-28
---

# ADR-006: nxtlvl-wiki internal structure — layers, runtime contracts, and language

## Context

ADR-001 establishes `nxtlvl-wiki` as an independent plugin — the reference corpus for
the harness build. ADR-002 establishes its role: queryable, synthesized guidance over
reviewed production harnesses, serving as orientation and leads throughout the build.
ADR-003 establishes that everything is built from scratch. None of these record what
the plugin actually contains, how it is structured, what its runtime contracts are, or
what language and tooling it uses.

The wiki has a distinct identity from both the harness and the labs: it is a read-only
query interface over a knowledge corpus. ADR-002 specifies it as an MCP server bundled
with its knowledge corpus — both corpus and server live together as one plugin. That
establishes the primary execution model (MCP server — a long-lived process), but leaves
the internal structure, query interface design, corpus format, and language open.

The corpus itself exists today as `llm-wiki/` — a Karpathy-style wiki with a defined
schema (`raw/` immutable source notes, `wiki/` synthesized pages, `/query` command).
Whether and how that corpus maps into the plugin, what the MCP server's tool surface
looks like, and what language the server is written in are all open questions.

### The questions

**1. What does the MCP server expose?**

The server's tool surface — what queries it answers, what format it returns, how it
navigates the corpus — needs to be defined. Options range from a thin pass-through
over the raw corpus files, to a structured query layer that surfaces synthesized wiki
pages, to something richer. The query contract determines the server's complexity and
the corpus format requirements.

**2. How does the corpus live inside the plugin?**

The corpus could be bundled as static files alongside the server, generated at build
time from `llm-wiki/` sources, served directly from the live `llm-wiki/` repo via a
path reference, or something else. The right answer depends on the update model —
how often the corpus changes and whether updates require a plugin reinstall.

**3. What language and build tooling?**

An MCP server is a long-lived process with its own `package.json` — unlike hooks, it
is not startup-sensitive and can have a build step and dependencies. The language and
tooling question is less constrained here than in ADR-004, but it still needs a
deliberate answer. The MCP SDK has TypeScript as its primary supported language;
whether that is the right choice here is open.

**4. What is the boundary between the wiki and the harness at runtime?**

ADR-002 establishes that the wiki is orientation and leads only — never citations,
never evidence. The runtime boundary — how the harness queries the wiki, whether it
is always-on or on-demand, what the failure mode is when the wiki is not installed —
needs to be defined.

### What agents-wiki is being queried on

- How do production harnesses structure knowledge corpus plugins or MCP servers —
  bundled static files, live corpus references, generated indexes?
- What MCP server patterns appear for read-only query interfaces over a knowledge base?
- What language and build tooling choices are common for MCP servers in agent harnesses?
- Any patterns for keeping a corpus plugin decoupled from the daily-driver harness
  at runtime?

## Decision

> **Pending** — querying agents-wiki on MCP server structure and knowledge corpus
> plugin patterns. Decision to be recorded here once the call is made.

## Alternatives Considered

> To be completed alongside the decision.

## Consequences

> To be completed alongside the decision.
