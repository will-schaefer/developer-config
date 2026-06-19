---
name: nxtlvl-ideation-domain-status
description: ideation domain (raw idea → approved direction front door); pass-1 connective tissue BUILT; refined skills + router wiring still pending.
metadata: 
  node_type: memory
  type: project
  originSessionId: 215812b8-8b33-45ef-8d28-7372a247c34a
---

The **ideation domain** turns a raw idea → confirmed intent → approved direction, then hands to the
native spec/plan pipeline. Architecture is FINAL: spec at `docs/spec/nxtlvl-ideation-domain.md` +
[ADR-026]. The load-bearing move is the **executor inversion** — the executor is a MAIN-THREAD
SKILL (the interview is interactive; agents can't talk to the user), and agents are demoted to
read-only support. This is the deliberate inverse of ADR-024 (git-workflows).

**Scope is WIDE-SPECTRUM, not software-only (corrected 2026-06-19):** the domain takes ideas of
*any* kind — software, but equally writing, strategy, research, a process, a decision. The spec's
§1 architecture was always neutral, but the *component descriptions* had leaked a code-only frame;
`idea-critic`, `context-scout`, `brainstorm.md`, and the spec's component rows were generalized
so software is one domain among many (lenses/sweeps adapt to the idea's domain), never the frame.
**Do not re-narrow to apps/code** — this is a coding harness, so the pull to assume software is
real and must be resisted.

**Vocabulary was de-software-ified too (2026-06-19):** the agent `design-critic` → **`idea-critic`**
(file renamed; reviews an **IDEA DRAFT**, not a "DESIGN DRAFT"); and the domain's word for the
phase-2 shaped deliverable, **"design" → "direction"** ("approved direction", "shape the
direction") — chosen over "approach" because phase 2 explores *2–3 approaches* that converge to one
*direction*, so "direction" keeps the candidate-vs-chosen distinction. Left intact: "by design"
(idiom), "Design spec" (doc type). Don't reintroduce `design-critic` / "design draft" / "approved
design".

**Build status (as of 2026-06-19):**
- **BUILT — connective tissue (mine):** agents `context-scout` + `idea-critic` (read-only
  Read/Grep/Glob, return structured-Markdown briefs — `idea-critic` is the pre-decision sibling
  of `doubt-reviewer`, deliberately *not* JSON); commands `/brainstorm` + `/interview-me` +
  `/grill-me` + `/idea-refine` (thin; invoke skills on the MAIN THREAD, not agents).
- **3 decisions locked (spec §13):** command name = `/brainstorm`; `approach-explorer` DEFERRED to
  a later pass (pass 1 = context-scout + idea-critic only); `idea-critic` = its OWN agent (not
  a composition of doubt-driven-development).
- **PENDING — skills (USER, via `/skill-creator`):** refined nxtlvl `interview-me` → `grill-me` →
  `idea-refine` → `brainstorming` (orchestrator, LAST). `brainstorming` stays SKILL.md-only for
  now (visual seam = native `visualize` MCP, not superpowers' bundled server — parked to step 2).
- **PENDING — router wiring (mine, LAST):** ideation section in `nxtlvl-router/SKILL.md`; deferred
  until the refined skills exist so the `◆` marks don't lie (precedence = "first that exists wins").

**Why:** this is a multi-session build; a fresh session needs what's done vs. pending without
re-deriving it. **How to apply:** verify file state with `ls plugins/nxtlvl/{agents,commands}/`
before building; resume at skill authoring (user-driven) or router wiring (mine, after skills).
When the user authors `brainstorming` (step 2), wire the `context-scout` spawn into phase-1 and the
`idea-critic` spawn into the pre-gate. Division of labor: USER owns the 4 skills (I facilitate);
I own agents/commands/router. Links: [[nxtlvl-harness]], [[nxtlvl-context-memory-subsystem]],
[[meta-skill-discoverability-in-plumbing]].
