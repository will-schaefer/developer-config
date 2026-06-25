---
name: nxtlvl-signal-noise-landscape
description: "Signal-vs-noise initiative — 3-stream landscape (doctrine/audit/subsystem) tracked in nxtlvl-harness#25; doctrine diving first."
metadata: 
  node_type: memory
  type: project
  originSessionId: ba915daa-6140-4b83-be23-b9742270f163
---

"Construct nxtlvl to prioritize signal, minimize noise" = a **landscape of 3 streams** (not one task), tracked in [nxtlvl-harness#25](https://github.com/will-schaefer/nxtlvl-harness/issues/25):

1. **Doctrine** (diving first, per user override of audit-first rec) — name signal-vs-noise as a parent principle. Measure = **displacement cost**; default = **just-in-time, not just-in-case** (pointer by default, eager loading must justify). Existing doctrines (pointers-over-content/ADR-007, hooks-inform-not-force, context-budget) become its children. Advisory, never a forcing hook. ADR-worthy → record in docs/decisions/.
2. **Audit** (queued) — measure & fix concrete loud spots; SessionStart firehose is the headline (146 unloaded instinct IDs + full catalogs ≈10K+ tokens/session). Produces the BLOCK/WARN checklist the doctrine delegates to.
3. **Subsystem** (queued, YAGNI-gated by audit) — active curation machinery; build only where audit proves machinery beats deletion.

Dependency chain = build order: doctrine defines the measure → audit measures → subsystem automates only what's proven. Follows the [[nxtlvl-harness]] landscape-brainstorm pattern (map IS the artifact). Resume = the 4 open questions in the issue. "Noise" = opportunity cost in tokens against the ~150–200K ceiling ([[user-1m-context-degradation]]).
