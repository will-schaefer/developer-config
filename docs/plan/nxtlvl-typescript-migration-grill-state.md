# Grill-me session state — nxtlvl JS→TS migration plan

> **Continuation handoff.** Resume the `/nxtlvl:grill-me` of
> [`nxtlvl-typescript-migration-plan.md`](nxtlvl-typescript-migration-plan.md), grilled against
> [`ADR-034`](../decisions/ADR-034-typescript-default-native-type-stripping.md).
> Session date: **2026-06-24**. This file records what was empirically resolved and what's still open
> so the next session can pick up at **Q2** without re-spiking.

---

## Empirical findings (spiked this session — Node **24.12.0**, TypeScript **6.0.3**)

Run in throwaway gitignored workspaces (since deleted). These **overturn plan assumptions** — treat
them as verified ground truth; do not re-spike unless the toolchain changes.

1. **D8 — bare `require('./paths')` does NOT resolve `paths.ts`** (`MODULE_NOT_FOUND`). Explicit
   `require('./paths.ts')` works. `node --test` **does** discover `*.test.ts`. → "explicit extensions"
   is **mandatory, not a fallback** (the plan's framing is wrong). The codebase *already* uses explicit
   extensions (`require('./paths.js')` ×12 in lib + ×5 in hooks; `instincts` ×12; `project-identity`
   ×10), so migration = **flip `.js`→`.ts` in every importer**; renaming a leaf breaks every stale
   importer (whether `.js` or `.ts`) until its specifier is flipped.

2. **CRUX — `require()`/`module.exports` (D4) types every cross-module import as `any`.** Verified: a
   `string`→`number` bug passes silently through `require('./paths.ts')`; ESM `import` catches it
   (`TS2322`). The typed-CJS escape `import x = require()` is **non-erasable** — Node throws
   `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. → D4 as written forfeits cross-module typing; only **within-file**
   typing survives under CJS (typed stdin parsing via `import type` — the ADR's *headline* bug class is
   still covered, but `lib/` exports stay `any` at all hook call sites).

3. **CJS↔ESM interop holds in BOTH directions on Node 24.** CJS `require('./esm.ts')` → works
   (namespace, named destructure); ESM `import { x } from './cjs.js'` → works (cjs-module-lexer reads a
   static `module.exports = {…}`). Node 24 ESM **syntax-detection is on by default** (an ESM `.ts` runs
   with no `package.json`). → an incremental, half-converted tree **executes safely**.

4. **erasable-syntax guard:** the plan's T0.3 claim that `verbatimModuleSyntax` "guards against
   accidental non-erasable syntax" is **false** — it did NOT flag an `enum`. The correct flag is
   **`erasableSyntaxOnly`** (`TS1294` caught it).

## ESM conversion cost (sized this session)

- `require('node:*')` → `import` across nearly every file (fs ×28, path ×25, os ×18, test ×18,
  assert/strict ×16, child_process ×7, crypto ×3).
- **8 `if (require.main === module)` CLI-guards** to rewrite (every hook + `lib/observer-runner.js`;
  these files are dual-mode: imported by their test *and* run directly by CC).
- **1 `__dirname`** (`hooks/observe.js`) → `import.meta.dirname`.
- all `module.exports` → `export`; all relative requires → `import … from './x.ts'`.
- tsconfig needs **`allowImportingTsExtensions: true`** (ESM `.ts` specifiers) — missing from plan T0.3.

---

## Decisions LOCKED this session

- **Q1 / D4 → ESM.** Convert `require`/`module.exports` → ESM `import`/`export` for full cross-module
  typing. *(Supersedes D4's "keep CommonJS, rename + type only." This is an **ADR-034-level** change —
  ADR-034 must be amended: it currently records keeping CJS implicitly via the plan.)*

## Grill tree — REMAINING open branches

- **Q2 — Sequencing (D3) [ANSWER PENDING].** Recommendation: **keep per-module leaves-first** (now
  de-risked by interop finding #3), with two plan edits: (1) make "flip all importer specifiers
  `.js`→`.ts`" an explicit sub-step of every rename; (2) expand **T0.1** spike acceptance to a
  *dependent pair* (a CJS hook requiring an ESM-converted leaf) + one `require.main`-guard rewrite —
  not a lone leaf. Caveat: interop direction 2 assumes **static** `module.exports`; any module building
  exports dynamically needs default-import. Alternative offered: **per-layer atomic** (lib → hooks →
  labs), which shrinks the mixed-mode window to one direction but drops per-module green bars.
- **Q3 — tsconfig (T0.3).** Swap `verbatimModuleSyntax` → `erasableSyntaxOnly`; add
  `allowImportingTsExtensions: true`.
- **Q4 — `package.json` "type" during transition [NOT YET SPIKED].** Tension: `tsc`-nodenext wants
  `type: module` for ESM `.ts`, but transition `.js` are CJS. Resolve empirically: does `tsc --noEmit`
  stay green on ESM `.ts` under an omitted/`commonjs` type while `.js` remain? Determines whether the
  per-module `tsc` green-bar is achievable *mid*-transition, or only the final gate is.
- **Q5 — live runtime context.** Hooks execute from the SHA-pinned plugin cache dir (no `package.json`
  there — confirmed none in `plugins/nxtlvl/`). ESM `.ts` runs via syntax-detection (verified bare).
  Confirm nothing new is needed at runtime; T5.4 live smoke covers it.
- **Q6 — scope corrections.** `hooks/session-title.js` has **no** co-located test → the plan's
  "8 + 8 tests" is actually **8 hooks + 7 tests**. Confirm the count and whether session-title should
  gain a test during conversion. (`hooks/evals/…/adapter` also in scope per T2.9.)
- **Q7 — tsc 6.x CLI.** Passing files on the command line *with* a `tsconfig` present now errors
  (`TS5112`). The `typecheck` script must run `tsc --noEmit` with **no file args**. Decide whether to
  pin a TypeScript major (6.x is current).
- **Q8 — how hooks consume `types.ts`.** Via `import type { … }` (fully erasable, legal in any module,
  no runtime import). Plan T0.4 creates `types.ts` but never states the consumption mechanism.

## How to resume

Re-enter `/nxtlvl:grill-me docs/plan/nxtlvl-typescript-migration-plan.md` (this file is the context).
Start at **Q2**. After the grill resolves, fold the answers into the plan **and amend ADR-034** (the
Q1 D4→ESM decision changes the recorded language/module choice).
