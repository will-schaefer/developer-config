---
name: triangulate-three-harnesses-build-decisions
description: "For ANY nxtlvl harness-build decision (skills, agents, commands, rules, hooks, governance), first review how superpowers, agent-skills, AND ecc each accomplish it."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 376ddea6-7bab-4576-bf14-6d5ff8e9260d
---

When making a harness-build decision — creating/shaping skills, agents, commands, rules, hooks, or governance — review how **all three reference harnesses** handle it before deciding: **superpowers**, **agent-skills**, and **ecc**. Triangulate, then choose.

**Why:** the user wants component decisions grounded in evidence from the field, not made by feel. Stated explicitly 2026-06-19. This operationalizes the nxtlvl build method (review harnesses to shape ours) and the "what provides higher quality" lens ([[compose-on-native-quality-first]]).

**How to apply:** for each decision, pull the relevant pattern from each harness and compare — then record the adopt/adapt/reject call (ADR-worthy ones become ADRs). Sources to mine instead of re-scanning: superpowers + agent-skills → [[agent-skills-vs-superpowers-domain-map]] (`docs/reference/agent-skills-vs-superpowers-domain-map.md`); ecc → [[ecc-component-map]] + [[ecc-component-scoping-doctrine]] (`docs/reference/ecc-main-map.md`, `ecc-agent-vs-skill-scoping.md`) + [[ecc-knowledge-graph]]. This is the default — don't re-ask whether to compare. Extends [[nxtlvl-harness]]; respects [[distill-reusable-to-doc-plus-memory]].
