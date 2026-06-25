# Handoff: repo-local ADR tooling (`adr`)

> **Type:** session handoff — a made-decision transfer, not a spec or plan.
> **SDD phase:** between Plan and Build. Intent, runtime, **and shape are locked** — §7 records the
> two resolved taste-calls (A: importable core + thin CLI · B: `graph --json` → in-session render).
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
| **Analyze** | `adr graph` | Emit the ADR relationship graph (supersedes · amends · cross-links). **`adr graph --json` emits nodes+edges; rendering is in-session (§7-B).** |
| **Analyze / gate** | `adr audit` | The deterministic integrity gate. **§5.** Exit 2 = deliberate block; exit 0 = pass / warn-only / fail-open. |

`list` / `find` / `show` are cheap renderers over a shared parse layer. `audit` is the verb that
earns the script (deterministic, testable, gate-wireable). `graph` emits a `--json` contract; its
in-session rendering is a separate, swappable concern (§7-B).

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

### ⚠ Prerequisite — this tool is the repo's FIRST new TS code

There is **no repo-root `tsconfig.json` or `package.json` yet** (the migration is *planned, not
started*). Building `adr` therefore requires standing up that dev infra first — which the migration
plan already specifies:

- **T0.2:** repo-root `package.json` (devDeps `typescript` + `@types/node`; `test` + `typecheck` scripts).
- **T0.3:** repo-root `tsconfig.json` (`strict`, `noEmit`, `nodenext`, `target` ~Node 24,
  `erasableSyntaxOnly: true`, owned-paths `include`, `reference/`+`vendor/`+`*-workspace/` excluded).

→ **Framing opportunity:** `adr` is a clean, self-contained **pilot** that proves the
type-stripping + `node:test` + `tsc --noEmit` loop on a few new files *before* the big JS→TS
migration touches the hot path. Treat standing up T0.2/T0.3 as step 0 of this build.

> Note on `erasableSyntaxOnly` vs `verbatimModuleSyntax`: the migration plan (T0.3) names
> `verbatimModuleSyntax` as the guard against non-erasable syntax. That is **wrong** —
> `verbatimModuleSyntax` silently passes `enum`. Use **`erasableSyntaxOnly: true`**, which is what
> actually raises `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` for enums/namespaces/parameter-properties.

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
cross-module types + erasability and sidesteps the `any` footgun. This is a **deliberate divergence
from migration-plan D4** (which governs *migrating existing CJS*, not new code). `node --test`
discovers `*.test.ts` fine once imports carry explicit extensions.

## 7. Resolved decisions (locked 2026-06-24)

Both taste-calls are now **locked**. Recorded with the alternative each beat, so the rationale
survives the handoff.

- **A — Placement & shape → LOCKED: importable core + thin CLI** (not a monolith):
  ```
  scripts/adr/
    package.json      # { "type": "module" } — scopes ESM to this dir (see §6)
    adr.ts            # CLI entry: arg-parse → dispatch to lib, set exit code (ONLY place exit is set)
    lib/
      parse.ts        # ADR + README → typed model (shared by all verbs)
      audit.ts        # B1–B5 + W1–W2, returns a structured result (NO process.exit here)
      graph.ts        # relationship graph builder
      *.test.ts       # co-located node:test, fixture-driven like dangerous-bash
  .claude/commands/adr.md   # the local /adr slash command, wraps `adr <verb>`
  ```
  `audit.ts` is a **pure function that returns a verdict** — the CLI translates that verdict into an
  exit code. That separation is what lets the future `nxtlvl:audit` `import` the audit core instead
  of reconstructing it ([ADR-035](../decisions/ADR-035-compose-substance-defer-own-orchestration.md)).
  *Beat:* a single `scripts/adr.ts` monolith — simpler today, but not reusable by the gate.

- **B — `graph` output form → LOCKED: `adr graph --json` → in-session render.** `graph` emits a
  deterministic, testable nodes+edges JSON contract; rendering is pushed to the chat surface (the
  operator's standing preference is to render visuals in-session). No artifact is written to the
  repo. *Beat:* generating a gitignored `docs/decisions/.adr-dashboard.html`. A file renderer
  remains an easy, non-breaking add later precisely *because* the data contract is `--json`.

## 8. Suggested build order (mirrors the dangerous-bash discipline)

1. **Step 0 — infra:** repo-root `package.json` + `tsconfig.json` (`erasableSyntaxOnly: true`), per
   §6, **and** `scripts/adr/package.json` with `"type": "module"` (scopes ESM to the tool, §7-A).
   Confirm `node --test` + `tsc --noEmit` run green on a trivial `.ts`.
2. **`parse.ts` + tests** — the shared typed model over the 35 live ADRs (they *are* the happy-path fixtures).
3. **`audit.ts` + tests** — B1–B5, W1–W2, fail-open. Fixture per failure mode (bad frontmatter,
   dangling cross-link, README orphan, superseded-without-successor, numbering gap/dupe). The live
   set is the all-green case.
4. **`adr.ts` CLI** — wire `list`/`find`/`show`/`audit`; set exit codes (0 / 2) only here.
5. **`graph.ts` + `adr graph --json`** — nodes+edges contract (§7-B); in-session render consumes it.
6. **`.claude/commands/adr.md`** — wrap the CLI for in-session use.
7. Green bar throughout: `tsc --noEmit` clean + `node --test` green.

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
