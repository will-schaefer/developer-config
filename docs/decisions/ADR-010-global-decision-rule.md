---
id: ADR-010
title: "A global decision rule governs how decisions are made and recorded; ADR-worthy tier first"
status: Accepted
date: 2026-06-17
---

# ADR-010: A global decision rule governs how decisions are made and recorded; ADR-worthy tier first

## Context
ADRs 001–009 are worked examples, and the recording convention existed only as a `feedback`
memory — not a durable, self-applying rule. Two facets needed formalizing into one convention
that spans *all* my work (not just `nxtlvl`): decision **recording** (when an ADR is warranted,
its format, lifecycle) and decision **making** (the interview→spec→plan→record pipeline). The
question this ADR settles is the *shape* of that rule — scope, composition, artifact, layering,
enforcement — decided one detail at a time.

## Decision
A single **decision rule**, authored in the global config layer, with five locked choices:

1. **Scope — ADR-worthy tier now, expandable.** The rule governs only genuinely architectural,
   expensive-to-reverse decisions today. It is deliberately structured to grow into a full
   decision-tier ladder (everyday ask-vs-proceed) later; that tier is out of scope for now.
2. **Composition — mostly pointers** ([ADR-003](ADR-003-compose-not-reconstruct.md)). The rule
   composes existing skills (`/interview-me`→`/grill-me`→`/spec`→`/plan`→`/documentation-and-adrs`)
   and owns only what no skill provides: the ADR-worthy **threshold**, the **wiring**, and the
   **format override**. The format override on `/documentation-and-adrs` is by **pointer now**;
   vendoring that skill is deferred until the override actually causes friction
   ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).
3. **Artifact shape — dedicated file + thin trigger** ([ADR-007](ADR-007-context-budgeted-injection.md)).
   The full procedure lives in `~/.claude/rules/decisions.md` (read **on demand**); a ~2–3 line
   recognition trigger lives in `~/.claude/CLAUDE.md` (always loaded) as a **plain** pointer, not
   an `@import` (which would inline it and defeat the budget).
4. **Layering — global default + project override.** The rule is global; default ADR location is
   `docs/decisions/`. A project's own CLAUDE.md (read last, wins on conflict) may rebind the
   location, opt out, or add conventions. Safe by default because the ADR-worthy test is
   self-limiting.
5. **Enforcement — advisory now, audit-earmarked.** In-session the rule only nudges and is
   **never a session hook** ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md)). It is
   earmarked for the invoked `nxtlvl:audit` ([ADR-009](ADR-009-objective-invoked-audit-gate.md))
   in two tiers: ADR **integrity** may block (objective), ADR **completeness** warns only (taste).

## Alternatives Considered

### Scope: full spectrum now, or ADR-only forever
- Full-spectrum-now — Pros: one coherent ladder immediately. Cons: drifts into generic agent
  conduct the base harness already covers; dilutes the curated set.
- ADR-only-forever — Pros: maximally tight. Cons: leaves everyday ask-vs-proceed permanently
  ungoverned, which I explicitly want eventually.
- Rejected both: chose **ADR-only now, structured to expand** — tight today, no design dead-end.

### Composition: vendor `/documentation-and-adrs` now, or restate the process
- Vendor-now — Pros: single source of truth for the format. Cons: premature; reactive-growth
  work better triggered by real friction.
- Restate-internals — Pros: self-contained. Cons: violates compose-not-reconstruct
  ([ADR-003](ADR-003-compose-not-reconstruct.md)).
- Rejected both: **override-by-pointer now, vendor later if it recurs.**

### Artifact: inline CLAUDE.md section, or `@import` the rule file
- Inline section — Pros: everything guaranteed in-context. Cons: burns tokens every session and
  bloats as scope grows ([ADR-007](ADR-007-context-budgeted-injection.md)).
- `@import` — Cons: inlines the file = identical cost to an inline section.
- Rejected both: **dedicated on-demand file + thin always-loaded trigger.**

### Layering: global-only (no override), or per-project (no global)
- Global-only — Cons: rigid; a repo wanting ADRs elsewhere or not at all can't adapt.
- Per-project — Cons: defeats "across all my work"; forces restating the rule everywhere.
- Rejected both: **global rule + thin project override.**

### Enforcement: block on completeness, or pure-advisory forever
- Block-on-completeness — Cons: encodes taste as a gate, forbidden by
  [ADR-009](ADR-009-objective-invoked-audit-gate.md).
- Pure-advisory-forever — Cons: wastes the audit's natural fit for objective ADR-integrity checks.
- Rejected both: **advisory in-session + integrity-blocks/completeness-warns at the invoked audit.**

## Consequences
- The rule lives in the **global `~/.claude/` config layer**, not the `nxtlvl` plugin or this
  repo — it governs *all* my work, including non-`nxtlvl` projects, and is **not** part of plugin
  promotion ([ADR-001](ADR-001-plugin-local-marketplace-packaging.md)). It is therefore not
  version-controlled by this repo; this ADR is the repo's record of the decision, and `~/.claude`
  backups are its only mirror.
- The `decision-recording-conventions` memory is slimmed to a pointer at the rule file.
- The future `nxtlvl:audit` inherits a ready-made spec — the rule's enforcement section *is* its
  integrity/completeness rubric ([ADR-009](ADR-009-objective-invoked-audit-gate.md)).
- The full decision-tier ladder is **deferred, not designed away**; the rule's structure
  anticipates it.
- Follow-up (reactive): when `/documentation-and-adrs` is vendored, re-point the rule's format
  steps to the vendored copy and swap `/`-skill names to `nxtlvl:` equivalents
  ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).
- First dogfood: this ADR is the decision rule governing its own creation.
