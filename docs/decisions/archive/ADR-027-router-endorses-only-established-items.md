---
id: ADR-027
title: "Router endorses only established nxtlvl items; delist the agent-skills fallthrough floor"
status: Accepted
date: 2026-06-19
---

# ADR-027: Router endorses only established nxtlvl items; delist the agent-skills fallthrough floor

## Context

The `nxtlvl-router` skill embodied [ADR-003](ADR-003-compose-not-reconstruct.md)'s workflow-floor
as a three-tier precedence rule — `nxtlvl:<skill> → agent-skills:<skill> → native` — and its
discovery map enumerated ~14 upstream `agent-skills:*` phases (implementation, testing, debugging,
security, performance, CI/CD, deprecation, observability, shipping, …) as first-class routing
destinations. Two problems converged:

1. **Staleness.** [ADR-026](ADR-026-ideation-domain-orchestrator-skill-isolated-agents.md)
   (same day) established the ideation domain — `interview-me`, `grill-me`, `idea-refine`,
   `brainstorming` — as refined `◆` nxtlvl skills. But the router still routed
   `interview-me`/`idea-refine` **upstream** and never mentioned `brainstorming`/`grill-me`. The
   router was actively pointing away from skills nxtlvl now owns.

2. **Blind adoption.** Enumerating every upstream phase as an adopted destination presents all of
   `agent-skills` as if nxtlvl had vetted and adopted it. That contradicts the project's
   reactive-growth posture ([ADR-008](ADR-008-reactive-growth-intake-gate.md)) and its **bounded
   confident-core** ([ADR-016](ADR-016-confident-core-capability-domains.md)): nxtlvl has actually
   established only a handful of phases (ideation, doubt-driven-development, review,
   github-workflow, documentation-and-adrs, harness-review). The map advertised ownership the
   project never earned.

The user directed that the router point **only** to what nxtlvl has established, and — stress-tested
branch-by-branch via `grill-me` — chose to go *dark* at unowned phases rather than keep a demoted
fallthrough. This reverses the specific router-floor conclusion of ADR-003, so it is recorded here.

The dividing question: ADR-003's "compose on agent-skills" was about **not reconstructing** SDLC
content. Going dark in the router is not reconstruction — it is *not endorsing* upstream content the
project hasn't vetted, and building `◆` versions reactively when a phase is actually needed. The
contradiction with ADR-003 is therefore **narrow** (the router's floor), not wholesale.

## Decision

Rewrite the router so it **endorses only established nxtlvl items**, and is silent at unowned phases:

- **Dark at unowned phases.** The discovery map lists only phases nxtlvl owns. For everything else
  the router offers nothing to route to; the phase is hand-flown **natively**. Accepted cost: most
  of the SDLC (implementation, testing, debugging, shipping, …) has no skill scaffolding in the
  router until nxtlvl builds it.
- **Precedence collapses** from `nxtlvl → agent-skills → native` to **`nxtlvl → native`**. The
  agent-skills tier is removed from the rule.
- **Endorsement-only, not a gate.** This is a pure router edit. `agent-skills` stays installed and
  its skills remain discoverable in the session; the router simply no longer endorses or depends on
  them. No hook, no uninstall.
- **Two named interim exceptions.** `spec-driven-development` and `planning-and-task-breakdown`
  remain in the router as the *only* explicitly-pointed-to upstream skills, because ADR-026's
  ideation domain composes them as the ideation→contract boundary. They are marked **interim** —
  nxtlvl `◆` versions are to be built later, at which point these pointers retire.
- **"Established" = ** the `◆` nxtlvl skills plus their nxtlvl agents/commands (per
  [ADR-012](ADR-012-agents-execute-skills-hold-knowledge.md)).
- **Staleness fixed.** The ideation domain is routed to its `◆` nxtlvl skills, not upstream.

This **amends ADR-003** — overriding its workflow-layer conclusion *only* insofar as the router
exposes an agent-skills floor — while leaving ADR-003's plumbing-reconstruct, orchestration-native,
and reactive-vendoring tiers fully in force. It is consistent with ADR-008/ADR-016 (the broad
enumeration was the part that contradicted reactive growth). ADR-026 is left intact via the two
named exceptions.

## Alternatives Considered

### Keep the floor, demote it (map shows only owned; quiet fallthrough remains)
- Pros: same visible map, but real guidance still available at unowned phases while domains are
  built; consistent with ADR-003/016 with no reversal.
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
- Cons: orphans the ideation→contract handoff that ADR-026 (same day) explicitly composes; would
  force amending a just-accepted ADR.
- Rejected: keep the two as interim named exceptions until `◆` versions exist.

### Build `◆` spec/plan first, then remove the floor
- Pros: most principled — handoff lands on owned items.
- Cons: blocks the router edit on two new skills via the intake gate.
- Rejected (deferred): user will build them later; keep upstream pointers interim for now.

## Consequences

- **ADR-003 is amended** (not superseded): its router-floor conclusion is overridden; its
  three-tier strategy otherwise stands. Per house lifecycle, ADR-003 stays `Accepted` with an
  `amended:` note and an index annotation.
- **The router goes dark across most of the SDLC** until nxtlvl builds each domain. This is the
  accepted cost, and it dovetails with ADR-016's bounded confident-core (Python, TS/JS, Rust,
  Frontend, Backend) and the ADR-008 intake gate: phases get covered as they are reactively built,
  not by inheriting an upstream floor.
- **Two interim upstream pointers remain** (`spec-driven-development`, `planning-and-task-breakdown`).
  When their `◆` nxtlvl versions ship, the router retires these pointers and the last upstream
  references leave the router. Until then the router is honest that they are borrowed, not owned.
- **ADR-026 is untouched** — its ideation→contract composition still resolves.
- **Endorsement-only** — `agent-skills` remains installed; a direct invocation of an upstream skill
  is still possible. The router neither prevents nor recommends it.
- **Follow-up work** (tracked outside this ADR): build `◆` `spec-driven-development` and
  `planning-and-task-breakdown`; continue the confident-core build-out so the dark phases close.
- Recorded per the global decision rule ([ADR-010](ADR-010-global-decision-rule.md)).
