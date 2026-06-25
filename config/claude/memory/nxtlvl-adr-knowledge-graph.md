---
name: nxtlvl-adr-knowledge-graph
description: "Semantic understand-anything knowledge graph of nxtlvl's 35 ADRs; location + how to update."
metadata: 
  node_type: memory
  type: reference
  originSessionId: aa98ade3-3c70-4c33-b481-75125a69ac78
---

A persistent **understand-anything semantic knowledge graph of the nxtlvl ADRs** lives at
`docs/decisions/.understand-anything/knowledge-graph.json` (built 2026-06-25). 44 nodes (36
`document` = 35 ADRs + README, + 8 `concept` theme nodes), 197 edges (`depends_on` ×19 = the
supersede/amend/invert spine, `related` ×143, `documents` ×35 = README index links), grouped
into 8 thematic layers (Foundation, Composition/Governance, Context & Memory, Hooks & Gating,
Agent Model, Capability & Workflow Domains, Docs-Grounding, Labs/Build) + an 11-step tour.

**This is the SEMANTIC graph — complementary to, not a replacement for, the bespoke structural
ADR map** `scripts/adr/graph.ts` → `docs/decisions/graph.html` (ADR-format-aware: typed
supersedes/amends/references edges, re-run `node scripts/adr/graph.ts --html` to refresh). The
two answer different questions: adr-graph = "who supersedes/amends whom"; this = "what
concepts/themes run across the ADRs". See [[nxtlvl-harness]], [[ecc-knowledge-graph]].

**To view:** `/understand-dashboard` (pass the `docs/decisions/` path). **To update:** re-run
`/understand docs/decisions/ --full` — full rebuild is the clean path because the graph is
scoped to a subdir (not the git root), so the incremental `git diff` refresh path mismatches
paths; 36 small markdown files make a full rebuild cheap. `graph.html` is excluded via
`.understand-anything/.understandignore`.
