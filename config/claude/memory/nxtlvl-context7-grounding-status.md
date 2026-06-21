---
name: nxtlvl-context7-grounding-status
description: "Context7 docs-grounding capability — built (T1–T4) + merged to main locally, but promote-gated; T5 manual smoke/dogfood pending."
metadata: 
  node_type: memory
  type: project
  originSessionId: c3afffcf-ff00-423b-b13f-faac3d6b87ad
---

nxtlvl's Context7 library-docs grounding capability is BUILT (plan Phase 1, T1–T4) and merged to
`main` locally (commit on 2026-06-21), but NOT yet promoted — the daily driver runs a SHA-pinned
snapshot, so it isn't live until a manual `/plugin` promote.

Shipped surfaces: `plugins/nxtlvl/.mcp.json` (2nd http server `context7` → tools
`mcp__plugin_nxtlvl_context7__resolve-library-id` / `__query-docs`, namespaced), `agents/context7-scout.md`
(read-only-by-withheld-tools, inverse of deepwiki-scout: *testifies* — CITE the doc URL@version, not
Context7), `references/context7-grounding.md` (trust contract), `commands/context7.md` (`/context7
<library> — <question>`). Governed by ADR-030 (inverse-companion to ADR-029); spec + plan in docs/.

**Remaining = T5 manual gate (user-run, agent can't):** post-promote MCP smoke (verify the namespaced
grant resolved — the exact ADR-029 bare-vs-namespaced failure spot), dogfood (100% CITE-stamped, no
main-thread doc dump), degradation (unknown library → one-line caveat, no block).

Companion to [[nxtlvl-context-memory-subsystem]] and [[nxtlvl-context-alert-hook]] (same
built-but-promote-gated pattern). The merge that landed this also fast-forwarded the C&M phase-2 work
onto `main` (context7 branch was cut off `feat/cm-phase2-6-write-read-lifecycle`).
