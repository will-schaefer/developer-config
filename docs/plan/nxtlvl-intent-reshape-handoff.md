# Handoff: post intent re-derivation — open threads

> **Type:** session handoff — a made-decision/where-we-are transfer, not a spec or plan.
> **Date:** 2026-06-28. **Picks up cold:** yes — a fresh session can act on any thread below.
> **Origin session:** reviewed the intent anchor, re-derived it via `interview-me`, audited
> scope growth, and reconciled repo-wide ADR-reference rot. Landed as commit **`f9d5bac`**
> (*"docs: re-derive nxtlvl intent anchor + reconcile ADR-reference rot"*), not pushed.
> **Anchor:** [`../intent/personal-harness.md`](../intent/personal-harness.md) (re-derived).

---

## Context (what the origin session changed)

1. **Re-derived the intent anchor.** [`personal-harness.md`](../intent/personal-harness.md) was
   superseded at its foundation: the 2026-06-16 version's mechanism layer (fallback-rate
   north-star metric, ecc-as-dormant-backstop, fallback-fed intake gate) had been overtaken by
   the build and by [ADR-002](../decisions/ADR-002-reference-corpus-nxtlvl-wiki.md). It was
   re-derived via `interview-me`, surfacing the real why-now: **nxtlvl is the production
   foundation for a potential AI agent company** (job loss ≈2026-06-21). New model: native-CC
   backstop, `nxtlvl-labs` incubation, deliberate `nxtlvl-wiki` coverage assessment, map-first /
   build-reactive posture. See the doc's reshape-ledger table.
2. **Audited scope growth vs. the old intake gate.** It did **not** hold — 1 of 12 shipped
   components had the required intake entry; `spec → plan → ADR` is the real gate
   ([ADR-015](../decisions/ADR-015-scope-determination-and-extension-gate.md)). This is recorded
   in the new anchor's growth section.
3. **Migrated ADR-reference rot.** 120 broken ADR links across 25 docs (pre-renumber slugs) were
   reconciled by concept; verified 0 broken ADR `.md` links remain across all 387 occurrences in
   `docs/`.

> **Note for whoever picks this up:** the working tree also holds *pre-existing, unrelated*
> uncommitted work that the origin session deliberately did **not** touch: `docs/decisions/ADR-001`,
> `ADR-004`, `README.md`; `config/claude/settings.json`; `config/claude/memory/cc-sandbox-blocks-keychain-auth.md`;
> and the new `plugins/nxtlvl/skills/headless-doubt/` skill. Don't assume those are part of this work.

---

## Thread 1 — Lock the anchor, then map the architecture *(primary, ordered)*

The two next steps the re-derived intent itself names (see its **"Still open"** section). Do them
in order.

1. **`grill-me` hardening pass on the new anchor.** The re-derivation went through `interview-me`
   only. The *original* 2026-06-16 anchor earned its authority through a 20-question `grill-me`
   pass after the interview; this one hasn't had it yet. Stakes are higher now (company
   foundation), so harden before treating it as locked. The doc's header explicitly flags this as
   pending.
2. **Produce the complete agent-harness architecture outline / spec** — the *immediate downstream
   deliverable*. Per the anchor's reshaped build posture: map a **pretty-complete** agent-harness
   architecture up front as the standing **coverage map** (components/areas a production harness
   needs), then build incrementally + reactively against it. This is the artifact the deliberate
   `nxtlvl-wiki` coverage assessment measures against. Likely inputs:
   [`agent-harness-atomic-taxonomy.md`](../reference/agent-harness-atomic-taxonomy.md) (already a
   space map, just reconciled) and `nxtlvl-wiki` (the production bar).

**Done when:** the anchor has survived a grill-me pass (or its corrections are folded in), and a
first architecture-outline artifact exists.

---

## Thread 2 — Reconcile two Draft ADRs the migration leaned on

The ADR-reference migration relinked citations to two **Draft** ADRs whose decisions aren't
recorded yet, leaving the links topically correct but pointing at unwritten decisions.

- **[ADR-004](../decisions/ADR-004-harness-internal-structure.md) (harness internal structure) —
  record the TypeScript-default decision.** 9 citations (in `nxtlvl-adr-tooling-handoff.md`,
  `nxtlvl-typescript-migration-plan.md`, `deepwiki/lib.md`) were relinked from the deleted old
  `ADR-034-typescript-default-native-type-stripping` to ADR-004 as the topical home. ADR-004 is
  Draft and has **not** yet recorded "TS is the default harness language via native type-stripping."
  Record it there to make the relinks fully truthful. *(The TS-default is already a global
  convention — see `CLAUDE.md` + the `typescript-over-javascript-default` memory.)* **Watch:**
  ADR-004 already has ~83 lines of uncommitted pre-existing edits in the tree — check whether
  those changes already record this before adding it.
- **[ADR-011](../decisions/ADR-011-observability-and-metrics.md) (observability & metrics) — its
  eventual decision must NOT re-introduce an automatic north-star.** ADR-011 is Draft and still
  *re-poses* the metric as an open question (it lists "fallback rate" among options). But
  [ADR-002](../decisions/ADR-002-reference-corpus-nxtlvl-wiki.md) (Accepted) already decided
  **against** an automated coverage metric in favor of **deliberate** assessment, and the
  re-derived anchor commits to "no hook-instrumented north-star." The fallback-rate/dual-metric
  model is dead (the `hooks/fallback-log.sh` + `lib/metrics.js` code still physically exists but
  the model is superseded). When ADR-011's decision is written, align it with ADR-002 or it will
  re-create the contradiction this session just removed.

**Done when:** ADR-004 records TS-default (or it's confirmed already recorded) and ADR-011's
decision is written consistent with ADR-002.

---

## Thread 3 — Bare-prose ADR stragglers *(quick cleanup)*

Not broken links (so outside the link-integrity sweep that's now clean), but stale prose
referencing old ADR numbers/counts:

- [`../spec/nxtlvl-project-management.md`](../spec/nxtlvl-project-management.md)**:209-210** — plain
  prose says "ADR-025" / "ADR-025's model" twice; should reference **ADR-007** (memory-architecture),
  matching the link relink already done at line 208.
- [`./nxtlvl-parent-folder-migration.md`](nxtlvl-parent-folder-migration.md)**:134** — carries
  old supersession-model phrasing ("Flip the superseding ADR's `implementation:` note to done")
  that conflicts with nxtlvl's standalone-ADR lifecycle.
- [`../reference/agent-harness-atomic-taxonomy.md`](../reference/agent-harness-atomic-taxonomy.md)
  **K6 row** — says "30 ADRs"; the set is now **26**.

**Done when:** the three prose references are corrected.

---

## Quick status board

| Thread | What | Priority | Blocked by |
|--|--|--|--|
| 1 | grill-me anchor → architecture outline | **Primary** | nothing |
| 2 | Record ADR-004 TS-default; align ADR-011 with ADR-002 | Medium | nothing (check ADR-004's pending edits first) |
| 3 | Fix 3 bare-prose ADR stragglers | Low | nothing |
