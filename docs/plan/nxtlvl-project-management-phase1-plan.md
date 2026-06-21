# Implementation Plan: `nxtlvl` Project Management — Phase 1 (read-side Status)

> SDD Phase: **Plan**. Implements the **APPROVED + schema-LOCKED** spec
> [`docs/spec/nxtlvl-project-management.md`](../spec/nxtlvl-project-management.md), which records the
> decision in [`ADR-028`](../decisions/ADR-028-project-management-domain-manage-and-see.md).
> 🤖 = agent-verifiable · 🧑 = manual gate · ◇ = decision to lock (none open — spec is locked).
> **Status: DRAFT — awaiting human review before implementation.**

## Overview

Give `nxtlvl` a read-only window into plan state: parse a plan's markdown into the locked status
schema and print **where a project stands** (counts, % done, next task, blocked set) in one command —
no hand-counting checkboxes. Phase 1 **only reads**; the write path (atomic + versioned) is Phase 2.
This is the foundation the Phase-2 dashboard and Phase-3 backlog grooming both consume.

## Architecture Decisions

- **Two lib files by responsibility** (a plan-level refinement of the spec's single-`plan-parser.js`
  listing — internal structure only, the locked schema is untouched):
  - `plan-parser.js` — **pure** `text → parsed-plan shape`. No I/O, total (never throws), trivially
    unit-testable. *This is the read contract.*
  - `status-brief.js` — `formatBrief(plan)` + the file-I/O CLI entry (target selection + read +
    print). Keeps the parser pure and makes the printed brief itself unit-testable.
- **Build location split** (Resolved Decision 1): the two lib files go **directly** in the shared
  `plugins/nxtlvl/lib/` (a `lib/*.js` module is never discovery-path-loaded; matches the C&M
  Phase-1 / `scrub.js` precedent). The **skill + command are discoverable**, so they stage in
  `sandbox/` and promote by `git mv`.
- **Fixtures are frozen copies, never live reads.** The backward-compat fixture is a *byte copy* of a
  real todo file taken at plan time — so tests stay deterministic as the live file evolves.
- **`next`/header semantics** (from the spec's worked example): `next` = first in-progress, else
  first todo, in document order. The brief header label = the plan **filename stem**
  (`basename(planPath, '.md')`) and shows the **phase of the `next` task**.
- **Zero new dependencies**; `node --test`; fail-soft everywhere (matches `atomic.js` house style).

## Dependency graph

```
__fixtures__ (T1)
     │
plan-parser.js: line grammar + status (T2)
     │
plan-parser.js: plan aggregation (T3)
     │
     ├── status-brief.js: formatBrief + CLI (T4)
     │         │
     │         └── /pm-status command (T6)
     └── project-management SKILL.md (T5)  ── (doc; depends on the locked schema, not on code)
                                   │
                          Promote (T7, 🧑)
```

---

## Task List

### Phase A — Pure parser library (`plugins/nxtlvl/lib/`, built direct)

#### Task 1: Freeze the fixture corpus
**Description:** Create the fixtures the parser tests run against. One real-file copy proves the
backward-compat guarantee; one authored glyph file proves status resolution and reproduces the spec's
worked example.

**Acceptance criteria:**
- [ ] `plugins/nxtlvl/lib/__fixtures__/real-current.md` is a **byte copy** of
  `docs/plan/nxtlvl-context-awareness-hooks-todo.md` (only `[ ]`/`[x]`; naturally contains a
  **duplicate ID** `D-docsel` and a **missing-ID** "Deferred" bullet and multi-line continuations).
  A header comment line records its provenance + the date copied.
- [ ] `plugins/nxtlvl/lib/__fixtures__/new-glyphs.md` is **authored** to yield exactly the spec's
  worked brief: 11 tasks → done 7 · in-progress 1 (`⏳ T5`) · blocked 1 (`⛔ D-docsel`) · todo 2 →
  **64%**; plus one contradictory `[x]`+`⛔` line and one glyph-after-ID line for coverage.

**Verification:** `[ ]` files exist; `diff` of `real-current.md` against the source is empty (modulo
the provenance comment); manual count of `new-glyphs.md` matches 7/1/1/2.

**Dependencies:** None. **Files:** 2 fixtures. **Scope:** S.

#### Task 2: `plan-parser.js` — task-line grammar + status resolution
**Description:** Parse markdown text into per-task objects: match the task-line grammar, resolve
status by the locked precedence, capture annotations, attach the nearest preceding phase, and treat
only `- [ ]`/`- [x]` lines as task starts (continuation lines belong to the prior task).

**Acceptance criteria:**
- [ ] Exports the per-task shape `{ id, status, description, phase, annotations:{agentVerifiable,
  manualGate,decision}, line, raw }`.
- [ ] Status precedence: `[x]`→done (glyphs ignored) → contains `⛔`→blocked → contains `⏳`→
  in-progress → else todo. **Contains-based** (tolerant of glyph position).
- [ ] Missing bold ID → `id: null` (never synthesized); IDs never invented.
- [ ] **Total**: malformed lines never throw — collected, not fatal.

**Verification:** `node --test plugins/nxtlvl/lib/plan-parser.test.js` — cases for all four states,
glyph-before vs glyph-after ID, `[x]`+`⛔` → done, missing ID → `id:null`, continuation line absorbed.

**Dependencies:** T1. **Files:** `plan-parser.js`, `plan-parser.test.js`. **Scope:** M.

#### Task 3: `plan-parser.js` — plan aggregation + warnings
**Description:** Aggregate parsed tasks into the full plan shape: group by phase, compute counts /
`pctDone` / `next` / `blocked`, extract `title` (H1), and emit lint `warnings`.

**Acceptance criteria:**
- [ ] Returns the plan shape `{ planPath, title, phases[], tasks[], counts{todo,doing,blocked,done},
  pctDone, next, blocked[], warnings[] }`.
- [ ] `pctDone = round(done/total*100)`, **0 when no tasks**; `next` = first in-progress else first
  todo (document order), `null` if none.
- [ ] `warnings` includes: contradictory markers (`[x]`+`⛔`), **duplicate IDs**, missing IDs.
- [ ] **Backward-compat proven on `real-current.md`**: every `[ ]`→todo, `[x]`→done; expected
  totals **15 tasks · 9 done · 6 todo · 0 doing · 0 blocked · 60% · next = "Checkpoint A"**;
  warnings flag the duplicate `D-docsel` and the missing-ID bullet.

**Verification:** `node --test` green; the `real-current.md` assertions above pass exactly.

**Dependencies:** T2. **Files:** `plan-parser.js`, `plan-parser.test.js`. **Scope:** M.

#### Checkpoint A — Parser (🤖)
- [ ] `node --test plugins/nxtlvl/lib/plan-parser.test.js` green.
- [ ] Backward-compat guarantee proven by the `real-current.md` fixture (spec Success Criterion 1).
- [ ] Four status states resolve per precedence, tolerant of glyph position (SC 3).
- [ ] Malformed input → shape + warnings, never a crash (SC 4).

### Phase B — Brief + surface (`sandbox/` for the discoverable parts)

#### Task 4: `status-brief.js` — `formatBrief` + CLI entry
**Description:** Format a parsed plan into the spec's brief, and provide the runnable entry: resolve
the target (arg, else most-recently-modified `docs/plan/*.md` — the Hook-2 D-docsel rule), read it,
parse, print. Fail-soft if no plan doc is found.

**Acceptance criteria:**
- [ ] `formatBrief(plan)` reproduces the spec's brief layout (header `stem · next.phase · N% done`,
  counts line, `next:`, `blocked:`).
- [ ] `node plugins/nxtlvl/lib/status-brief.js [file]` prints the brief; no-arg → most-recently-
  modified `docs/plan/*.md`; nothing found → one-line fail-soft message (no throw).
- [ ] **Golden test:** `formatBrief(parse(new-glyphs.md))` equals the spec's worked brief
  byte-for-byte (SC 2).

**Verification:** `node --test plugins/nxtlvl/lib/status-brief.test.js` green incl. the golden test;
manual `node …/status-brief.js docs/plan/nxtlvl-context-awareness-hooks-todo.md` matches by hand.

**Dependencies:** T3. **Files:** `status-brief.js`, `status-brief.test.js`. **Scope:** M.

#### Task 5: `project-management` SKILL.md (sandbox)
**Description:** The methodology skill: state the LOCKED status schema (as the reference, pointing to
the spec — not re-deriving it), the brief format, and the compose-not-reconstruct discipline (PM
reads `/plan`, does not re-plan or execute).

**Acceptance criteria:**
- [ ] `sandbox/skills/project-management/SKILL.md` exists with valid frontmatter (name + triggering
  description) following house skill conventions.
- [ ] Documents the schema by **pointer** to the spec's locked contract (no divergent restatement).

**Verification:** Manual read; frontmatter parses; no schema drift vs the spec.

**Dependencies:** T3 (schema is locked; can run parallel to T4). **Files:** 1. **Scope:** S.

#### Task 6: `/pm-status` command (sandbox)
**Description:** The thin Status entry point: invoke `status-brief.js` against the target and surface
the brief. Accepts an optional `[plan-file]` arg.

**Acceptance criteria:**
- [ ] `sandbox/commands/pm-status.md` exists with valid command frontmatter; named `/pm-status`.
- [ ] Runs `status-brief.js`; passes through an optional plan-file arg; defaults to most-recently-
  modified `docs/plan/*.md`.

**Verification:** Invoked in a sandbox session, `/pm-status` prints the brief for the default plan and
for an explicit arg.

**Dependencies:** T4. **Files:** 1. **Scope:** S.

#### Checkpoint B — Surface (🧑)
- [ ] `/pm-status` on `nxtlvl-context-awareness-hooks-todo.md` reports correct counts/pctDone/next/
  blocked, **verified by hand** (SC 2).
- [ ] Everything still lives in `sandbox/` (skill+command) + `plugins/nxtlvl/lib/` (lib) — nothing
  promoted yet (SC 5).
- [ ] Full suite green: `node --test plugins/nxtlvl/lib/plan-parser.test.js plugins/nxtlvl/lib/status-brief.test.js`.

### Phase C — Promote

#### Task 7: Promote + document (🧑🤖)
**Description:** Activate the discoverable components and record completion.
**Acceptance criteria:**
- [ ] 🧑 `git mv sandbox/skills/project-management plugins/nxtlvl/skills/` and the command into
  `plugins/nxtlvl/commands/`; `/plugin` promote; confirm `/pm-status` fires live.
- [ ] 🤖 Spec status → built; confirm **no new ADR needed** (ADR-028 already covers Phase 1) via
  `nxtlvl:doc-keeper`.

**Verification:** `/pm-status` works from the installed plugin; spec marked built.
**Dependencies:** Checkpoint B. **Files:** moves + spec edit. **Scope:** S.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Multi-line task continuations parsed as new tasks / dropped | Med | Only `- [ ]`/`- [x]` lines start a task; `real-current.md` fixture has continuations and asserts the count (15). |
| Duplicate IDs in real plans (`D-docsel` ×2) | Med | Resolve per-line; emit a `warnings` entry; never throw. Real fixture exercises it. |
| Fixture drift makes tests flaky | Med | `real-current.md` is a **frozen byte copy**, not a live read. |
| Glyph Unicode position varies (`⏳`/`⛔` multi-byte) | Low | `String.includes` contains-match; glyph-before & glyph-after cases tested. |
| Putting format/I/O in the lib (vs the command) drifts from spec's component list | Low | Schema unchanged; documented as a plan-level structure decision above; surfaced for review. |
| No `docs/plan/*.md` found | Low | `status-brief.js` returns a one-line fail-soft message, never throws. |

## Open Questions

None — the spec is locked and all four of its open questions are resolved. Any newly-surfaced
schema question pauses work per the spec's *Boundaries → Ask first* (the schema is a locked contract).

## Verification (plan-level, before implementation)
- [x] Every task has acceptance criteria + a verification step.
- [x] Dependencies identified and ordered (foundation-first).
- [x] No task touches more than ~5 files.
- [x] Checkpoints between phases (A parser · B surface · C promote).
- [ ] Human has reviewed and approved this plan.
