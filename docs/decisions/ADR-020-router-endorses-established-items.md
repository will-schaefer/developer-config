---
id: ADR-020
title: "The skill router endorses only established nxtlvl items and goes dark at unowned phases"
status: Draft
date: 2026-06-28
---

# The skill router endorses only established nxtlvl items and goes dark at unowned phases

## Context

The `nxtlvl-router` skill is how nxtlvl skills get discovered and invoked. The open question is
what it should endorse. One option is a three-tier precedence rule — `nxtlvl:<skill> →
agent-skills:<skill> → native` — whose discovery map enumerates ~14 upstream `agent-skills:*`
phases (implementation, testing, debugging, security, performance, CI/CD, deprecation,
observability, shipping, …) as first-class routing destinations. That option has two problems:

1. **Staleness.** A static upstream enumeration goes stale the moment nxtlvl establishes its own
   version of a phase. The ideation domain — `interview-me`, `grill-me`, `idea-refine`,
   `brainstorming` — is established as refined `◆` nxtlvl skills (see
   [ADR-018](ADR-018-ideation-domain.md)); a three-tier map would route
   `interview-me`/`idea-refine` **upstream** and never mention `brainstorming`/`grill-me`,
   pointing away from skills nxtlvl owns.

2. **Blind adoption.** Enumerating every upstream phase as an adopted destination presents all of
   `agent-skills` as if nxtlvl had vetted and adopted it. That contradicts the project's
   reactive-growth posture and its **bounded confident-core** (see
   [ADR-015](ADR-015-scope-determination-and-extension-gate.md)): nxtlvl has actually established
   only a handful of phases (ideation, doubt-driven-development, review, github-workflow,
   documentation-and-adrs, harness-review). Such a map advertises ownership the project never earned.

The user directed that the router point **only** to what nxtlvl has established, and — stress-tested
branch-by-branch via `grill-me` — chose to go *dark* at unowned phases rather than carry a demoted
upstream fallthrough.

The dividing question: what the router should endorse. Going dark at unowned phases is *not
endorsing* upstream content the project hasn't vetted, and building `◆` versions reactively when a
phase is actually needed. This is **consistent with build-from-scratch
([ADR-003](ADR-003-build-from-scratch.md)) at the router layer**: the router endorses only nxtlvl's
own from-scratch items; upstream is neither endorsed nor depended on. The router exposes no
agent-skills floor.

## Decision

The router **endorses only established nxtlvl items**, and is silent at unowned phases:

- **Dark at unowned phases.** The discovery map lists only phases nxtlvl owns. For everything else
  the router offers nothing to route to; the phase is hand-flown **natively**. Accepted cost: most
  of the SDLC (implementation, testing, debugging, shipping, …) has no skill scaffolding in the
  router until nxtlvl builds it.
- **Precedence is `nxtlvl → native`.** There is no agent-skills floor in the rule; the rule has
  no upstream tier.
- **Endorsement-only, not a gate.** This is a router-level rule, not an installation change.
  `agent-skills` stays installed and its skills remain discoverable in the session; the router does
  not endorse or depend on them. No hook, no uninstall.
- **Two named interim exceptions.** `spec-driven-development` and `planning-and-task-breakdown`
  remain in the router as the *only* explicitly-pointed-to upstream skills, because the ideation
  domain ([ADR-018](ADR-018-ideation-domain.md)) composes them as the ideation→contract boundary.
  They are marked **interim** — nxtlvl `◆` versions are to be built later, at which point these
  pointers retire.
- **"Established" =** the `◆` nxtlvl skills plus their nxtlvl agents/commands (per
  [ADR-012](ADR-012-agent-design-contract.md)).
- **Staleness fixed.** The ideation domain is routed to its `◆` nxtlvl skills, not upstream.

This is consistent with the reactive-growth intake gate and the bounded confident-core
([ADR-015](ADR-015-scope-determination-and-extension-gate.md)): the broad enumeration was the part
that contradicted reactive growth. The ideation domain ([ADR-018](ADR-018-ideation-domain.md)) is
left intact via the two named exceptions.

## Alternatives Considered

### Keep the floor, demote it (map shows only owned; quiet fallthrough remains)
- Pros: same visible map, but real guidance still available at unowned phases while domains are
  built; consistent with the existing composition and confident-core posture with no reversal.
- Cons: keeps the router endorsing upstream skills the project hasn't vetted; the user's objection
  is precisely that endorsement.
- Rejected: the user chose to go dark on purpose after the "goes dark" consequence was put to them.

### Just fix the staleness (keep full upstream enumeration; only mark ideation `◆`)
- Pros: smallest change; corrects the active bug.
- Cons: leaves the blind-adoption problem entirely — the router still advertises ~14 unvetted
  upstream phases as adopted.
- Rejected: doesn't address the actual objection.

### Hard-disable upstream (uninstall agent-skills / blocking hook)
- Pros: makes "dark" enforceable, not just advisory.
- Cons: large scope beyond the router file; the router is navigation, not access control; the user
  confirmed endorsement-removal is sufficient.
- Rejected: out of scope; endorsement-only meets the intent.

### Let `spec`/`plan` go dark too (fully literal floor removal)
- Pros: maximal consistency — zero upstream in the router.
- Cons: orphans the ideation→contract handoff that the ideation domain explicitly composes; would
  force amending a just-accepted decision.
- Rejected: keep the two as interim named exceptions until `◆` versions exist.

### Build `◆` spec/plan first, then remove the floor
- Pros: most principled — handoff lands on owned items.
- Cons: blocks the router edit on two new skills via the intake gate.
- Rejected (deferred): user will build them later; keep upstream pointers interim for now.

## Consequences

- **The router goes dark across most of the SDLC** until nxtlvl builds each domain. This is the
  accepted cost, and it dovetails with the bounded confident-core (Python, TS/JS, Rust, Frontend,
  Backend) and the intake gate ([ADR-015](ADR-015-scope-determination-and-extension-gate.md)):
  phases get covered as they are reactively built, not by inheriting an upstream floor.
- **Two interim upstream pointers remain** (`spec-driven-development`, `planning-and-task-breakdown`).
  When their `◆` nxtlvl versions ship, the router retires these pointers and the last upstream
  references leave the router. Until then the router is honest that they are borrowed, not owned.
- **The ideation domain is untouched** — its ideation→contract composition still resolves.
- **Endorsement-only** — `agent-skills` remains installed; a direct invocation of an upstream skill
  is still possible. The router neither prevents nor recommends it.
- **Build-from-scratch still holds.** This refines the router layer only; the
  build-from-scratch, orchestration-native, and reactive build-from-scratch posture of
  [ADR-003](ADR-003-build-from-scratch.md) remains in force.
- **Follow-up work** (tracked outside this ADR): build `◆` `spec-driven-development` and
  `planning-and-task-breakdown`; continue the confident-core build-out so the dark phases close.
- Recorded per the global decision rule (`~/.claude/rules/decisions.md`).
