---
id: ADR-011
title: "Prose quality is governed harness-wide by a vendored stop-slop skill, with a condensed always-on chat convention"
status: Accepted
date: 2026-06-17
---

# ADR-011: Prose quality is governed harness-wide by a vendored stop-slop skill, with a condensed always-on chat convention

## Context
`nxtlvl` produces prose constantly — specs, ADRs, plans, knowledge-base and LLM-wiki deliverables,
memory entries, and every chat response. AI writing tells (throat-clearing openers, binary
"not-X-but-Y" contrasts, em-dashes, narrator-from-a-distance voice) degrade all of it. The
`anthropic-skills:stop-slop` skill (Hardik Pandya; 8 core rules + a 5-dimension rubric + three
reference files) removes those tells, but it ships as a single manually-invoked prose editor. The
question this ADR settles is *how* it becomes a permanent part of the harness — which surfaces it
governs, and by what mechanism — decided one fork at a time via `/brainstorming` (2026-06-17). The
implementing spec is [`../spec/nxtlvl-stop-slop-pipeline.md`](../spec/nxtlvl-stop-slop-pipeline.md).

## Decision
Incorporate stop-slop as a **vendored canonical source with two faces**, with five locked choices:

1. **Vendor as the single source** ([ADR-003](ADR-003-compose-not-reconstruct.md)). Copy stop-slop
   into `plugins/nxtlvl/skills/stop-slop/` faithfully (no rule edits), exposed as `nxtlvl:stop-slop`.
   Both faces draw from this one copy. Refinement is **reactive** — tune a rule only on a logged miss
   ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).
2. **Two faces, four surfaces.** A **composed edit-pass** (Face A) on harness docs, deliverable
   prose, and — lightly — memory writes; a **condensed always-on convention** (Face B) for chat.
   Face A is a step inside the writing workflows in use now (`/spec`, `documentation-and-adrs`,
   `brainstorming`); workflow-less prose (KB/wiki) is covered by on-demand `nxtlvl:stop-slop` until a
   workflow exists.
3. **Face B is a deliberate exception to "pointers over content"**
   ([ADR-007](ADR-007-context-budgeted-injection.md)). Prose-shaping cannot work from a pointer, and
   chat has no trigger that reliably loads the skill, so a tight condensed block (≤ 15 lines) is
   inlined into global `~/.claude/CLAUDE.md` and earns its always-on tokens. It is held to a hard
   size cap and points back to the full vendored skill.
4. **Face B sync = literal copy + audit check**, not `@import`. The block is a literal copy in the
   global layer; the audit verifies it matches the skill. This keeps the daily-driver layer
   independent of the workbench path. (`@import` inlines identically to ADR-010's rejected case and
   adds cross-layer path coupling across the promotion boundary.)
5. **Structural guard + objective enforcement.** The pass edits prose tells only and **never**
   restructures required doc scaffolding (ADR frontmatter, the four ADR headings, spec sections).
   Drift between the condensed block and the skill is an objective, binary check → the audit's
   **block-tier** ([ADR-009](ADR-009-objective-invoked-audit-gate.md)); rule refinement is gated by
   the intake test ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).

## Alternatives Considered

### Shape: vendored-skill-only, pipeline-step, hook/gate, or intake-first
- Manual vendored skill only — Pros: lowest risk. Cons: relies on remembering to call it; no
  coverage of the prose I produce by default.
- Hook/gate — Pros: strongest reach. Cons: a rewriting hook mangles code/tool output; even a
  warn-only hook spends an intake-gate slot before the soft path is shown to be insufficient.
- Intake-first — Pros: maximally disciplined. Cons: the incorporation is already wanted; the fork
  worth resolving is *how*, not *whether*.
- Rejected all three: chose **pipeline-step (composed pass) + a standing convention** — broad
  coverage, all enforcement composed or soft, no risky output rewriting.

### Chat mechanism: condensed convention, warn-only Stop hook, on-demand, or cut
- Warn-only Stop hook — Pros: scores every response. Cons: real machinery + latency, spends an
  intake slot now; better held as the reactive escalation if the soft convention proves too soft.
- On-demand only — Cons: relies on remembering, so chat goes ungoverned in practice.
- Cut chat — Cons: forfeits the highest-frequency surface.
- Rejected all three: chose the **condensed always-on convention**; the hook stays a logged-signal
  escalation.

### Face B sync: literal copy + audit check, or `@import` a single source
- `@import` single source — Pros: zero drift. Cons: inlines just like the ADR-010-rejected case, and
  couples always-on global context to a plugin path across the promotion boundary.
- Rejected: **literal copy + objective audit drift-check** — layer independence, drift caught
  mechanically.

### Refinement: tune-to-voice now, or vendor-faithful-then-reactive
- Tune-now — Cons: pre-tuning on spec, against reactive growth; some rules only fight specific
  surfaces, which only real use reveals.
- Rejected: **vendor faithfully, refine on logged misses** ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).

## Consequences
- The vendored skill lives in the **plugin** (promoted via install, git-tagged); the condensed block
  lives in the **global `~/.claude/` layer** (not part of plugin promotion, not version-controlled by
  this repo — same split as [ADR-010](ADR-010-global-decision-rule.md)). This ADR + the spec are the
  repo's record of the global-layer change.
- The audit's drift-check spans the global↔plugin boundary; it is built when `nxtlvl:audit` exists
  (Phase ≥1, [ADR-009](ADR-009-objective-invoked-audit-gate.md)). Until then drift is caught by eye.
- Always-on context grows by ≤ 15 lines — the one budgeted exception to
  [ADR-007](ADR-007-context-budgeted-injection.md). Its quality bar is **coverage of every core
  rule** (the floor, checked by the audit); the ≤ 15-line figure is a soft densification target, not
  a license to drop a rule to hit the count ([ADR-012](ADR-012-quality-first-over-leanness.md)). It
  stays a tight, dense extract that still covers every rule, or it loses its justification.
- Coverage gap by design: workflow-less prose (KB/wiki) leans on on-demand invocation until a KB/wiki
  workflow is built reactively ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).
- Two reactive escalations stay on the shelf, gated by the fallback log: a warn-only Stop hook (if
  the convention is too soft) and per-workflow expansion of the pass.
- First dogfood: this ADR and its spec are themselves run through the pass once the skill is vendored.

## Implementation
Build follows the implementing spec ([`../spec/nxtlvl-stop-slop-pipeline.md`](../spec/nxtlvl-stop-slop-pipeline.md))
via `/plan` → build. The audit drift-check (Decision 5) is deferred to when `nxtlvl:audit` is built
([ADR-009](ADR-009-objective-invoked-audit-gate.md)).
