# Handoff: repo-local ADR tooling (`adr`)

> **Type:** session handoff — a made-decision transfer, not a spec or plan.
> **SDD phase:** between Plan and Build. Intent, runtime, **and shape are locked** — §7 records the
> two resolved taste-calls (A: importable core + thin CLI · B: `graph` → `--json` default for
> in-session render + `--html` opt-in viewer).
> A fresh session can pick this up cold.
> **Runtime: LOCKED → TypeScript**, run via native Node type-stripping
> ([ADR-034](../decisions/ADR-034-typescript-default-native-type-stripping.md)). No build step.
> **Decision anchors it implements:** the objective audit shape of
> [ADR-009](../decisions/ADR-009-objective-invoked-audit-gate.md) and **§5 of the global decision
> rule** (`~/.claude/rules/decisions.md`). **This tool is NOT itself ADR-worthy** — it *implements*
> already-recorded decisions, so it gets no new ADR.

---

## 1. What the tool is (one paragraph)

A **repo-local CLI**, `adr`, that lets me **locate, review, and analyze the nxtlvl repo's own
Architecture Decision Records** — the **35** files at
[`docs/decisions/`](../decisions/) plus their `README.md` index. Three verbs, five subcommands
(§4). Its load-bearing piece is the **`adr audit`** verb: a deterministic, two-tier integrity
gate over the ADR set (§5). That verb is a concrete, repo-local instance of the objective-gate
shape ADR-009 reserves for the future `nxtlvl:audit` — building it now serves the repo today *and*
prototypes the gate's two-tier / exit-code discipline so `nxtlvl:audit` can later **compose** it
rather than reconstruct it ([ADR-035](../decisions/ADR-035-compose-substance-defer-own-orchestration.md)).

## 2. Scope (in / out)

| | |
|---|---|
| **In** | The Developer repo's own ADRs (`docs/decisions/ADR-*.md` + `README.md`). One CLI + one local `/adr` command. Serves **this repo only**. |
| **Out** | ❌ Not a plugin (does **not** live under `plugins/nxtlvl/`; not shipped to users). ❌ Not an incubation cell, no `harness-lab` graduation path. ❌ No portability/abstraction layer. ❌ Does not parse anyone else's ADRs or a generic ADR format — it is hard-bound to *this* house format. |

Rationale for "repo-local, never graduates": the tool's value is entirely in serving these 35
files. A portability layer would be machinery for a second consumer that does not exist — exactly
the breadth-bloat the reactive-growth discipline rejects. If a second consumer ever appears, that
is a *new* decision then, not speculative surface now.

## 3. The data it operates on (house ADR format)

Author/format source of truth: **§3 of the decision rule** + the live files. Shape:

- **Filename:** `ADR-NNN-slug.md`, sequential `NNN` (currently `001`–`035`).
- **Frontmatter (YAML):** `id` (`ADR-NNN`), quoted `title`, `status`, clean-ISO `date`. Optional:
  `amended`, `implementation`, `superseded-by`, `amends`.
- **Body:** H1 title → `## Context` · `## Decision` · `## Alternatives Considered` ·
  `## Consequences`. ADRs cross-link each other by markdown link to `ADR-NNN-slug.md`.
- **Index:** [`docs/decisions/README.md`](../decisions/README.md) — a `| ADR | Decision | Status |`
  table, one row per ADR, plus a free-text "Numbering note".
- **Two real-world wrinkles the audit must tolerate / catch** (they exist in the live set today):
  1. **Supersession is expressed two ways** — README Status column prose (`Superseded by [035](…)`)
     and/or a frontmatter `superseded-by:`. The audit reconciles both (§5 B4).
  2. **A historical renumbering** (ADR-017–024 were renumbered on merge to dodge collisions; see
     the README Numbering note). Numbering is currently gap-free; the audit guards it staying so (§5 B5)
     — this is the operational guard for the known *doc-keeper glob-numbering collision hazard*.

## 4. The three verbs / five subcommands

| Verb (intent) | Subcommand | Does |
|---|---|---|
| **Locate** | `adr list` | Print the index — `id · status · title` for all ADRs (the at-a-glance table). |
| **Locate** | `adr find <query>` | Filter by keyword / `--status` / "links-to ADR-NNN" / "superseded". |
| **Review** | `adr show <id>` | Render one ADR with its resolved context — supersession chain, amends/amended-by, inbound + outbound cross-links. |
| **Analyze** | `adr graph` | Emit the ADR relationship graph (supersedes · amends · cross-links). **Default emits the nodes+edges JSON for in-session render; `adr graph --html` writes the opt-in standalone viewer (§7-B).** |
| **Analyze / gate** | `adr audit` | The deterministic integrity gate. **§5.** Exit 2 = deliberate block; exit 0 = pass / warn-only / fail-open. |

`list` / `find` / `show` are cheap renderers over a shared parse layer. `audit` is the verb that
earns the script (deterministic, testable, gate-wireable). `graph` emits a `--json` contract by
default (in-session render); `--html` is an opt-in standalone viewer over the same model (§7-B).

## 5. The audit contract (load-bearing — build this first and test it hardest)

`adr audit` is **two-tier**, mirroring the dangerous-bash gate and the cell-graduation contract
([ADR-033](../decisions/ADR-033-three-part-objective-graduation-contract.md)) — *block on facts,
warn on taste, fail open on bugs*.

### Block-tier — Integrity (objective/binary; **any failure → exit 2**)

Pulled verbatim-in-intent from decision-rule §5 "ADR integrity → may BLOCK":

| ID | Check |
|---|---|
| **B1** | **Frontmatter validity** — every `ADR-NNN-*.md` parses as YAML and has required keys `id`, quoted `title`, `status`, clean-ISO `date`; `id` equals `ADR-NNN` and matches the filename number. |
| **B2** | **Cross-link resolvability** — every ADR→ADR reference (markdown link to `ADR-NNN-slug.md`) points to a file that exists on disk. |
| **B3** | **README ↔ disk parity** — every ADR file has exactly one README index row, and every README row links to a real file (no orphan in either direction). |
| **B4** | **Supersession integrity** — every ADR marked superseded (frontmatter `superseded-by:` *or* README "Superseded by [NNN]") resolves to an existing ADR; flag a superseded ADR that names no successor. |
| **B5** | **Numbering integrity** — `001…NNN` sequential, no gaps, no duplicate numbers. (Operationalizes the doc-keeper glob-numbering collision guard.) |

### Warn-tier — Completeness (**report only; never changes exit code**)

Decision-rule §5 is explicit: completeness is **WARNING only, never a blocker** — judging
ADR-worthiness is taste, and the gate must never encode taste.

| ID | Warning |
|---|---|
| **W1** | "A decision may be unrecorded." (Pure heuristic; never blocks.) |
| **W2** | Structural nits — a missing `Context`/`Decision`/`Alternatives Considered`/`Consequences` H2, a `status` outside the known set, date drift in non-required fields. (Keep minimal; these edge toward taste.) |

### Fail-open (absolute)

Any **internal exception** in the audit itself → print a one-line `stderr` note and **exit 0**.
A bug in the tool must never block. Per [ADR-006](../decisions/ADR-006-hook-fail-open-gated-blocking.md)
/ ADR-033 / the dangerous-bash precedent.

### Exit codes

| Code | Meaning |
|---|---|
| `0` | All block-tier checks pass (warnings may print) **or** internal crash (fail-open). |
| `2` | ≥1 block-tier check failed — **deliberate block**. |

**Precedent to mirror, not reinvent:**
[`plugins/nxtlvl/hooks/dangerous-bash.js`](../../plugins/nxtlvl/hooks/dangerous-bash.js) +
[`dangerous-bash.test.js`](../../plugins/nxtlvl/hooks/dangerous-bash.test.js) — an objective
exit-code gate with a fixture-driven `node:test` suite and a kill switch. `adr audit` is the same
shape applied to ADRs. Read it before writing the audit.

## 6. Runtime & build (TypeScript — the locked decision, with the one real gotcha)

Governed by [ADR-034](../decisions/ADR-034-typescript-default-native-type-stripping.md) and the
[TS migration plan](nxtlvl-typescript-migration-plan.md):

- **Native Node type-stripping, no build step.** `node adr.ts` runs directly on Node 24.12.
  **Source is the artifact** — nothing compiled is committed.
- **Erasable syntax only** — type annotations, interfaces, type aliases, generics, `as`,
  `satisfies`. **No** enums, namespaces-with-runtime-code, parameter properties, decorators.
- **Tests:** `node --test` over co-located `*.test.ts` (zero new dependency — same as the whole harness).
- **Type-check gate:** `tsc --noEmit` is the green bar alongside `node --test`.

### Resolved — self-contained subproject (does NOT touch repo-root infra)

The repo has **no repo-root `tsconfig.json` or `package.json` yet** (the migration is *planned, not
started*, and its repo-root `package.json type` is still open — grill Q3/Q4). Rather than pre-empt
that call, `adr` is built as a **self-contained subproject**: `scripts/adr/` carries **its own**
`package.json` (`"type": "module"`) and `tsconfig.json` (`strict`, `noEmit`, `nodenext`,
`erasableSyntaxOnly: true`, `allowImportingTsExtensions: true`). This stands up *zero* repo-root
infra, so the tool ships today and still serves as the clean **pilot** of the type-stripping +
`node:test` (+ later `tsc --noEmit`) loop *before* the big JS→TS migration touches the hot path.

> `erasableSyntaxOnly` vs `verbatimModuleSyntax`: the migration plan (T0.3) named
> `verbatimModuleSyntax` as the guard against non-erasable syntax. That is **wrong** —
> `verbatimModuleSyntax` silently passes `enum`. We use **`erasableSyntaxOnly: true`** (plus
> `allowImportingTsExtensions: true` so explicit-`.ts` imports type-check), which actually raises
> `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` for enums/namespaces/parameter-properties. *(Plan + ADR-034
> still carry the old wording pending their own amendment — tracked separately.)*

### ⚠ Module system — the one genuinely technical open call (recommend ESM)

Migration-plan **D4 keeps CommonJS** — but that decision governs *migrating existing CJS modules*.
This is **new** code, where CJS carries a real cost:

- `require('./x.ts')` returns **`any`** → you lose **all** cross-module type safety (the whole
  point of going TS). `import = require()` *is* caught by `tsc` but is **not** erasable by Node's
  type-stripping. Only **ESM `import { x } from './y.ts'`** is *both* type-safe *and* erasable.
- Native CJS resolution also won't find `.ts` by bare name — `require('./module')` throws
  `MODULE_NOT_FOUND`; you'd need explicit `require('./module.ts')` everywhere.

**Adopted (with §7-A):** author `adr` as **ESM** — `scripts/adr/` carries its own `package.json`
with `"type": "module"`, and every import uses **explicit `.ts` extensions**. That gets full
cross-module types + erasability and sidesteps the `any` footgun. This **aligns with the
grill-locked D4→ESM direction** (the migration plan's body still reads "keep CJS" pending its own
amendment + an ADR-034 update — tracked separately). `node --test` discovers `*.test.ts` fine once
imports carry explicit extensions.

## 7. Resolved decisions (locked 2026-06-24; B refined 2026-06-25)

Both taste-calls are now **locked**. Recorded with the alternative each beat, so the rationale
survives the handoff.

- **A — Placement & shape → LOCKED: importable core + thin CLI** (not a monolith). As-built tree:
  ```
  scripts/adr/
    package.json      # { "type": "module" } — scopes ESM to this dir (see §6)
    tsconfig.json     # self-contained: erasableSyntaxOnly + allowImportingTsExtensions (see §6)
    adr.ts            # CLI entry: arg-parse → dispatch to lib, set exit code (ONLY place exit is set)
    graph.ts          # thin runnable entry for `adr graph` (--json default / --html opt-in) — folds into adr.ts later
    lib/
      parse.ts        # raw string → typed frontmatter model (pure; shared by all verbs)   ✅
      load.ts         # docs/decisions/ → typed AdrNode[] (the one file-I/O seam; shared by graph + audit)  ✅
      audit.ts        # B1–B5 + W1–W2, returns a structured result (NO process.exit here)
      graph.ts        # pure: AdrNode[] → nodes+edges model + the HTML viewer (importable, no I/O)  ✅
      *.test.ts       # co-located node:test, fixture-driven like dangerous-bash
  .claude/commands/adr.md   # the local /adr slash command, wraps `adr <verb>`
  ```
  `audit.ts` is a **pure function that returns a verdict** — the CLI translates that verdict into an
  exit code. That separation is what lets the future `nxtlvl:audit` `import` the audit core instead
  of reconstructing it ([ADR-035](../decisions/ADR-035-compose-substance-defer-own-orchestration.md)).
  The shared **`lib/load.ts`** is the single file-I/O seam (every verb loads through it; the pure
  cores stay string/model-only and unit-testable). *Beat:* a single `scripts/adr.ts` monolith —
  simpler today, but not reusable by the gate.

- **B — `graph` output form → LOCKED (refined 2026-06-25): `--json` default + `--html` opt-in.**
  Default `adr graph` emits the deterministic, testable, **body-free** nodes+edges JSON contract and
  rendering happens **in-session** — the operator's standing preference; **no artifact is written**.
  `adr graph --html` is an explicit opt-in that writes a self-contained interactive viewer to
  `docs/decisions/graph.html` (**git-ignored**, regenerated on demand). This **reconciles** the
  original lock (which was `--json`-only) with a richer viewer the parallel build produced: the
  in-session default is preserved *exactly*; the viewer is purely additive and never the default.
  *Beat:* adopting the HTML artifact as the **default** — would overturn the in-session preference
  and litter the repo; or **dropping** the viewer — loses a genuinely better read of 35 dense ADRs.

## 8. Suggested build order (mirrors the dangerous-bash discipline)

1. **Step 0 — infra (self-contained, ✅ done):** `scripts/adr/package.json` (`"type": "module"`) +
   `scripts/adr/tsconfig.json` (`strict`, `noEmit`, `nodenext`, `erasableSyntaxOnly: true`,
   `allowImportingTsExtensions: true`). The tool is a **self-contained subproject** — it does *not*
   touch repo-root infra, so it sidesteps the migration's still-open repo-root `package.json type`
   call (grill Q3/Q4) while piloting the type-stripping + `node:test` loop. *(Deferred: `npm install`
   + the `tsc --noEmit` gate — the runtime already type-strips & runs green, proving erasability.)*
2. **`parse.ts` + tests — ✅ done.** The shared typed model over the 35 live ADRs (they *are* the
   happy-path fixtures). 13 `node:test` cases.
3. **`audit.ts` + tests** — B1–B5, W1–W2, fail-open. Fixture per failure mode (bad frontmatter,
   dangling cross-link, README orphan, superseded-without-successor, numbering gap/dupe). The live
   set is the all-green case. Loads via `lib/load.ts`.
4. **`adr.ts` CLI** — wire `list`/`find`/`show`/`audit` (+ fold in `graph`); set exit codes (0 / 2) only here.
5. **`graph` — ✅ done (§7-B hybrid):** `lib/load.ts` (shared loader) + `lib/graph.ts` (pure model +
   viewer) + thin runnable `scripts/adr/graph.ts` (`--json` default / `--html` opt-in);
   `lib/graph.test.ts` covers edge derivation. The HTML artifact is git-ignored.
6. **`.claude/commands/adr.md`** — wrap the CLI for in-session use.
7. Green bar throughout: `node --test` green now (20/20); `tsc --noEmit` once deps are installed.

## 9. References

- Decisions implemented: [ADR-009](../decisions/ADR-009-objective-invoked-audit-gate.md)
  (objective invoked audit) · **decision-rule §5** (`~/.claude/rules/decisions.md`, integrity-blocks
  / completeness-warns) · [ADR-006](../decisions/ADR-006-hook-fail-open-gated-blocking.md) (fail-open)
  · [ADR-033](../decisions/ADR-033-three-part-objective-graduation-contract.md) (two-tier exit-code gate).
- Runtime: [ADR-034](../decisions/ADR-034-typescript-default-native-type-stripping.md) ·
  [TS migration plan](nxtlvl-typescript-migration-plan.md) (T0.2/T0.3 infra, D4 CJS caveat).
- Compose-don't-reconstruct: [ADR-035](../decisions/ADR-035-compose-substance-defer-own-orchestration.md)
  · [ADR-003](../decisions/ADR-003-compose-not-reconstruct.md).
- Precedent code: [`plugins/nxtlvl/hooks/dangerous-bash.js`](../../plugins/nxtlvl/hooks/dangerous-bash.js)
  + [`.test.js`](../../plugins/nxtlvl/hooks/dangerous-bash.test.js).
- Data: [`docs/decisions/`](../decisions/) (35 ADRs) + [`README.md`](../decisions/README.md) index.
