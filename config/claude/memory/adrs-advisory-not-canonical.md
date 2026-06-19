---
name: adrs-advisory-not-canonical
description: "On nxtlvl, treat ADRs as advisory history, not binding constraints — pivot freely and record overrides."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0c56ecee-9634-4760-bf21-ccf8f9f3841a
---

On the `nxtlvl` harness, ADRs in `docs/decisions/` are **advisory references, not canonical constraints**. Reference them for context and rationale, but don't let an existing ADR veto a new direction — the user is actively rethinking the harness and wants room to pivot.

**Why:** (2026-06-18) Mid-redesign of the Context & Memory + session-lifecycle subsystem, the user chose to un-defer continuous-learning and adopt ecc's background-observer model — overriding ADR-004 ("extend native memory, no separate store") and ADR-008 (continuous-learning deferred). They explicitly said to stop holding ADRs canonical.

**How to apply:** When a new decision conflicts with an ADR, surface the conflict once (so it's recorded), then proceed with the new direction and record it as a superseding/amending ADR per the decision rule ([[ADR-010-global-decision-rule]]). Don't relitigate or block on the old ADR.
