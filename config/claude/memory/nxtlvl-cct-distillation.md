---
name: nxtlvl-cct-distillation
description: "adopt/adapt/reject of claude-code-templates (aitmpl) — a distribution catalog, mined as contrast not peer; full doc at docs/reference/claude-code-templates-distillation.md"
metadata: 
  node_type: memory
  type: reference
  originSessionId: d347bcf8-b155-4e09-aca6-02ad33424fc8
---

Harness-review distillation of `davila7/claude-code-templates` (aitmpl) at
`docs/reference/claude-code-templates-distillation.md`. Reviewed across 4 lenses
(distribution, observability, meta-harness, catalog) via parallel fan-out.

CCT is a **distribution catalog product**, not a peer harness — so weight its *contrasts*
(it ratifies nxtlvl's curation + local-only + sandbox/promote choices) over its *content*
(mostly reject). Spine: CCT repeatedly builds the right *mechanism* but wires it to the wrong
*gate* (5-axis validator exists but install never calls it; marketplace.json lists 8 of 434).

Top harvest:
- **A1 (top adopt):** CCT's 5-axis validator design → a **pre-`git mv` promotion gate** +
  `harness-review` vendoring scan; objective Structural+Semantic checks, "block on facts / warn on
  taste." Highest-value transplant; likely a real ADR.
- **A3:** `hooks:`-in-agent-frontmatter read-only enforcement (belt-and-suspenders over withheld
  tools) for doubt-reviewer/idea-critic/context-scout — pairs w/ [[agentic-os-distillation]] +
  hooks-mastery. **VERIFIED supported** (frontmatter hooks are scoped to agent lifetime).
- **A4:** path-scoped `rules/*.md` (`paths:` glob) to split monolithic CLAUDE.md — **VERIFIED
  supported**; nuance: path-scoped rules are summarized-away on compaction until a matching file is
  re-read (matters for context-awareness work).
- **A5:** transcript token-summation (incl. cache fields) corroborates "context = transcript usage
  sum"; reusable tool_use↔tool_result correlation parse.

Rejects all confirm an nxtlvl choice by contrast: npx-installer/publish-to-main-is-live →
sandbox+promote+pin; dashboard+tunnel+default-on-telemetry → CLI-first/local-only; Linear-as-queue
→ file-based memory; "5590 skills" is ~870 real, much Anthropic-verbatim → curated-not-cataloged.
False friend: CCT's `sandbox/` = remote execution isolation, NOT nxtlvl's staging tree.

Fourth external voice for [[triangulate-three-harnesses-build-decisions]] (but a product, not a
harness). Mine the doc instead of re-scanning the 116M clone.
