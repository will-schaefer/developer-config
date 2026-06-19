---
name: nxtlvl-toolkit-distillation
description: adopt/adapt/reject of rohitg00/awesome-claude-code-toolkit, scoped to its rules/+contexts/ surfaces; mostly reject, spine = activation is the dividing line
metadata:
  type: reference
---

Adopt/adapt/reject of `rohitg00/awesome-claude-code-toolkit` ("Claude Code Toolkit") at
[docs/reference/awesome-claude-code-toolkit-distillation.md](../../../docs/reference/awesome-claude-code-toolkit-distillation.md).
A **breadth-branded hybrid** (awesome-meta-list wrapped around 3.3M of vendored content); reviewed
via a **focused 2-agent fan-out** scoped to the only surfaces prior distillations didn't cover —
its **`rules/` library** and **`contexts/` presets**.

**Spine = activation is the dividing line.** Both would-be primitives are inert catalog prose with
NO loader: `rules/` is hand-`cp`'d into `.claude/rules/`; `contexts/` advertises a `/context load`
command that **does not exist anywhere in the repo** (README + examples assert it; `commands/` has
no context command, `context-loader.js` is a name-coincidence). Documentation décor, not a feature.

**Verdict: mostly reject, ADOPT empty, no ADR candidates.** rules/ = generic style-guide
boilerplate (13/15 stylistic, not behavioral) with no composition → confirms nxtlvl's
few/deep/behavioral/composed/pointer-based rules stance by contrast. contexts/ = mode-persona prose
fully subsumed by existing skills, and its manual mode-switch is the exact thing nxtlvl's
`nxtlvl-router` + `description:`-triggering auto-discovery designed away → reject the primitive.
Only ADAPT (optional): `contexts/deploy.md` quantified rollback thresholds if shipping-and-launch
ever needs concrete numbers.

Third breadth-branded mega-collection reviewed (with [[nxtlvl-cct-distillation]] and agents-main) —
all converge: **breadth-as-product is the inverse of nxtlvl's curated-depth thesis.** Expect a thin
ledger from "comprehensive toolkit" repos; scope the pass small. The `/context load` vaporware also
reinforces the docs-must-match-code / doc-keeper discipline. Mine this instead of re-scanning the
clone. Related: [[triangulate-three-harnesses-build-decisions]], [[distill-reusable-to-doc-plus-memory]].
