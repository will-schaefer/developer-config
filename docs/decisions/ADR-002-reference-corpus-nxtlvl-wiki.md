---
id: ADR-002
title: "nxtlvl-wiki is the sole reference corpus for the harness build"
status: Accepted
date: 2026-06-27
---

# ADR-002: `nxtlvl-wiki` is the sole reference corpus for the harness build

## Context

Building a production agent harness requires a reference standard — a body of prior art
that guides what to reconstruct, what to compose, and what the finished harness should
cover. The question is what that corpus is, what role it plays, and what it doesn't do.

The nxtlvl plugin family ([ADR-001](ADR-001-plugin-local-marketplace-packaging.md))
includes `nxtlvl-wiki` — the agents-wiki plugin (`will-schaefer/nxtlvl-wiki`) — a
synthesized, queryable knowledge layer over reviewed reference harnesses (ecc,
agent-skills, and others). Those harnesses have been ingested into the corpus; they have
no runtime posture in this setup. Their role is "ingested source material," which lives
in the wiki's own documentation.

Two concerns that are sometimes bundled together are cleanly separated here:

- **Runtime gap coverage** — when nxtlvl can't handle something, what fills the gap.
  This is not a reference corpus concern. Native Claude Code covers it; recurring gaps
  enter the `nxtlvl-labs` incubation pipeline.
- **Reference material** — prior art that guides the build and provides a standard
  against which to assess coverage. This is `nxtlvl-wiki`'s job.

## Decision

**`nxtlvl-wiki` is the sole reference corpus for the nxtlvl harness build.**

### Role in the build

- **Plumbing guidance.** During reconstruction of the harness machinery (context
  assembly, memory, hooks, audit, composition layer), `nxtlvl-wiki` is queried for
  structural orientation: how reference harnesses approached a problem, what patterns
  recur, where they diverged. It guides where to look and what questions to ask.

- **Workflow substance sourcing.** When composing workflow content (dev, review,
  research), `nxtlvl-wiki` surfaces what upstream harnesses ship in a given area. The
  decision of what to vendor, adapt, or skip is mine; the wiki accelerates the survey.

- **Coverage assessment.** `nxtlvl-wiki` is the reference standard for evaluating what
  `nxtlvl` covers and what it doesn't. Coverage gaps are identified by querying the wiki
  and comparing against the harness's actual capabilities — judgment-assisted by me, not
  automatic. Assessment cadence is deliberate, not continuous.

### Evidence boundary

`nxtlvl-wiki` output is **orientation and leads, never evidence**:

- Zero wiki claims reach any ADR, artifact, or decision record directly.
- Every wiki output that informs a build decision is verified at primary source before
  it is acted on or cited.
- ADRs cite primary sources (local code, official docs, direct observation) — never
  "nxtlvl-wiki says."

Secondary sources orient; primary sources testify.

### What it is not

- **Not a runtime backstop.** There is no installed fallback plugin. Runtime gaps are
  covered by native Claude Code; recurring gaps become cell intakes in `nxtlvl-labs`.
- **Not a citation source.** Wiki output does not appear in ADRs, specs, or artifacts
  as evidence.
- **Not an automated metric instrument.** Coverage assessment is deliberate and
  judgment-assisted; the wiki is the reference standard, not a hook-driven signal.

## Alternatives Considered

### Keep a reference harness installed-but-dormant
- Pros: runtime escape hatch available; familiar posture.
- Cons: bundles reference material with runtime posture unnecessarily; native CC already
  covers runtime gaps; a large dormant plugin adds namespace and cognitive overhead for
  no active benefit.
- Rejected: the two concerns are cleanly separable and should be separated.

### Use reference harnesses directly without a wiki layer
- Pros: primary sources only; no synthesis layer to distrust.
- Cons: surveying multiple harness repos ad-hoc is slow and inconsistent; ingestion work
  has already been done; `nxtlvl-wiki` exists precisely to make the corpus queryable
  without repeated raw review.
- Rejected: the wiki is the right abstraction over already-ingested material.

### Automated coverage metric (hook-driven signal)
- Pros: continuous, automatic signal; no reliance on deliberate assessment cadence.
- Cons: any automated proxy measures a signal once removed from actual coverage;
  judgment-assisted direct assessment against a reference standard is more honest and
  less gameable.
- Rejected: deliberate assessment is the more reliable instrument here.

## Consequences

- **`nxtlvl-wiki` owns the guidance substrate** named in the build strategy — the
  "reviewed reference harnesses" input that guides both plumbing reconstruction and
  workflow substance composition.
- **No installed reference plugin.** Reviewed harnesses are ingested corpus, not
  installed plugins. There is no dormant fallback plugin in this setup.
- **Coverage assessment is periodic and deliberate**, not ambient. A forced review is
  more honest than a continuous metric that can be ignored or gamed.
- **Consistent evidence boundary across all secondary sources.** `nxtlvl-wiki` follows
  the same doctrine as any other secondary source the harness consults: orient from it,
  verify at primary before acting.
