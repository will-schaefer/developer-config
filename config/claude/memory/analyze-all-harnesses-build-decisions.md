---
name: analyze-all-harnesses-build-decisions
description: "For ANY nxtlvl harness-build decision (skills, agents, commands, rules, hooks, governance), comprehensively analyze how ALL reference harnesses (5+) handle it via a harness-review before deciding — agent-skills is one reference, not a default or fallback (ADR-027)."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 376ddea6-7bab-4576-bf14-6d5ff8e9260d
---

When making a harness-build decision — creating/shaping skills, agents, commands, rules, hooks, or governance — **comprehensively analyze how all the reference harnesses (5+) handle it via a harness-review** before deciding, then adopt / adapt / reject. **`agent-skills` is one reference, not a default or fallback** — **ADR-027** (`docs/decisions/ADR-027-router-endorses-only-established-items.md`) delisted the agent-skills floor (the router endorses only established nxtlvl items). The reference set is no longer just three: superpowers, agent-skills, ecc, plus the further distillations (hooks-mastery, agentic-os, claude-code-templates, awesome-claude-code-toolkit, ruflo, …).

**Why:** the user wants component decisions grounded in evidence from the field, not made by feel, and not anchored to one harness as a baseline. Stated explicitly 2026-06-19 (superseding the earlier "triangulate three"). This operationalizes the nxtlvl build method (review harnesses to shape ours) and the "what provides higher quality" lens ([[compose-on-native-quality-first]]).

**How to apply:** for each decision point, run the **harness-review** across the references and compare — then record the adopt/adapt/reject call (ADR-worthy ones become ADRs). Sources to mine instead of re-scanning: the per-harness distillations under `docs/reference/*-distillation.md`; superpowers + agent-skills → [[agent-skills-vs-superpowers-domain-map]] (`docs/reference/agent-skills-vs-superpowers-domain-map.md`); ecc → [[ecc-component-map]] + [[ecc-component-scoping-doctrine]] (`docs/reference/ecc-main-map.md`, `ecc-agent-vs-skill-scoping.md`) + [[ecc-knowledge-graph]]. This is the default — don't re-ask whether to compare. Extends [[nxtlvl-harness]]; respects [[distill-reusable-to-doc-plus-memory]].
