---
id: ADR-003
title: "Build nxtlvl from scratch against a production-quality reference standard"
status: Accepted
date: 2026-06-27
---

# ADR-003: Build nxtlvl from scratch against a production-quality reference standard

## Context

Three things frame the build problem:

1. **Scope must be bounded.** "Build everything" without a clear north star re-explodes to
   the scale of the harnesses being studied — a build that never ends and produces a slower
   shim around tools that already exist. The learning target must be precise.

2. **A reference standard is needed.** Building in a vacuum risks missing the production
   bar. The standard comes from active production harnesses and top-tier research — not as
   blueprints to copy from, but as the bar to build against.

3. **The CC plugin identity establishes a native-first constraint.** `nxtlvl-harness` is a
   Claude Code plugin ([ADR-001](ADR-001-plugin-local-marketplace-packaging.md)) — it
   composes above the native CC loop rather than replacing it. Owning a runtime before the
   harness stands is premature; the plugin identity sets the correct starting posture.

[ADR-001](ADR-001-plugin-local-marketplace-packaging.md) establishes the family structure
and plugin identity. [ADR-002](ADR-002-reference-corpus-nxtlvl-wiki.md) establishes
`nxtlvl-wiki` as the reference corpus — queryable, synthesized guidance over reviewed
production harnesses, serving as orientation and leads throughout the build. The remaining
question is the build strategy itself.

## Decision

**The north star:** a production-quality, domain-agnostic agent harness — built from
scratch, held to the standard of active production harnesses and top-tier research —
capable of supporting revenue-generating work.

### Everything → build from scratch

Plumbing and workflow substance alike are built from scratch. No vendoring, no forking, no
adapting someone else's design. Every layer is owned and understood.

`nxtlvl-wiki` guides the build throughout — surfacing how production harnesses approached
a problem, what patterns recur, where the bar is set — as orientation and leads, never as
a blueprint to copy. The wiki is what keeps "build from scratch" from meaning "build in a
vacuum." Every wiki output that informs a build decision is verified at primary source
before acting on it (per [ADR-002](ADR-002-reference-corpus-nxtlvl-wiki.md)'s evidence
boundary).

The scope of reconstruction:
- **Plumbing** — the machinery native CC doesn't hand over: context assembly, memory,
  hooks, composition layer, audit. This is where the core harness learning lives.
- **Workflow substance** — dev, review, research, documentation. Built from scratch rather
  than adapted from upstream, informed by what the wiki surfaces from production harnesses
  and top-tier research.

### Orchestration → native CC through the build; own runtime a deliberate second phase

As a CC plugin, nxtlvl composes above the native loop rather than replacing it. Building a
runtime before the harness stands is premature — you cannot meaningfully design
orchestration for something that doesn't exist yet, and a hand-built dispatcher at this
stage is only a slower, capped shim.

**Phase one:** build the complete harness on native CC. Skill routing, agent dispatch, the
tool-use loop, and context-window assembly stay native. Deterministic multi-agent control
uses the native Workflow tool.

**Phase two:** once the harness stands complete on native rails, explore adding nxtlvl's
own runtime/orchestration — guided by the wiki and informed by the reference harnesses that
ship their own runtimes. This is a deliberate future phase, not a permanent exclusion.

`nxtlvl-labs` follows the same sequencing: native CC through its build; own runtime only
after nxtlvl-harness has explored it first.

## Alternatives Considered

### Vendor or adapt from upstream harnesses

Build by vendoring skills, agents, or workflows from reviewed harnesses and refining them
for fit.

- Pros: faster to a working harness; inherits proven patterns directly.
- Cons: inherits upstream assumptions, structure, and constraints alongside the patterns;
  the harness is no longer fully owned and understood at every layer; the production bar
  becomes "good enough for the source" rather than the independent standard nxtlvl is
  held to. The wiki already provides the survey acceleration without requiring inheritance
  of someone else's design.
- Rejected: build from scratch is the stated goal; the wiki provides the reference
  without the inheritance cost.

### Build without a reference standard (scratch only, no wiki)

Build entirely from first principles with no reference corpus.

- Pros: maximum independence; no external reference to distrust.
- Cons: risks missing the production bar entirely; the work of surveying active harnesses
  has already been done and is queryable via the wiki — discarding it is waste, not purity.
  [ADR-002](ADR-002-reference-corpus-nxtlvl-wiki.md) already decided this question.
- Rejected: the wiki is the mechanism that makes the production bar real; building without
  it is building in a vacuum.

### Reconstruct orchestration now (own the runtime up front)

Build nxtlvl's own runtime/orchestration from the start rather than sequencing it after
the harness.

- Pros: maximum ownership; nxtlvl becomes its own full-stack harness immediately.
- Cons: re-explodes scope before there is a harness worth orchestrating; collides with
  the CC plugin identity ([ADR-001](ADR-001-plugin-local-marketplace-packaging.md)) — a
  CC plugin composes above the native loop, not below it; a premature dispatcher is a
  slower shim with nothing real to orchestrate yet.
- Deferred, not rejected: sequenced after the native build, when the harness is complete
  and there is something real to orchestrate. Phase two is explicit.

## Consequences

- **Every layer is owned.** No inherited assumptions from upstream designs. The wiki
  informs; nxtlvl decides and builds.
- **The wiki's orientation role is load-bearing.** It is what keeps the production bar
  real throughout the build — plumbing and workflow substance alike. Without it, "build
  from scratch" is building in a vacuum.
- **Orchestration is phased, not closed.** Native CC through the build-out; own
  runtime/orchestration is an explicit future phase. When that phase opens it will revisit
  the plugin identity ([ADR-001](ADR-001-plugin-local-marketplace-packaging.md)) and the
  orchestration posture — flagged now, decided then.
- **`nxtlvl-labs` follows the same runtime sequencing.** Native CC first; own runtime
  only after nxtlvl-harness has explored it. Labs' team creation lifecycle and incubation
  pipeline both run on native CC through their respective builds.
- **The production bar is set by active harnesses and top-tier research**, not by what
  upstream sources happen to ship. Domain-agnostic means no vertical assumptions are
  inherited; revenue-generating capable means the bar is real production, not demo quality.
- Recorded per the global decision rule.
