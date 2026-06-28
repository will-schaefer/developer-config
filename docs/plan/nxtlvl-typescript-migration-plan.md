# Implementation Plan: nxtlvl JavaScript → TypeScript migration

> SDD Phase: **Plan**. Implements the decision in
> [`docs/decisions/ADR-034-typescript-default-native-type-stripping.md`](../decisions/ADR-034-typescript-default-native-type-stripping.md).
> 🤖 = agent-verifiable · 🧑 = manual gate · ◇ = decision (locked at plan review unless marked open).
> **Status: PLANNED (not started).**

---

## 1. Framing

[ADR-034](../decisions/ADR-034-typescript-default-native-type-stripping.md) makes **TypeScript
the default harness language** and chooses **native Node type-stripping** as the runtime (no build
step; `node hook.ts` runs directly on Node 24.12). This plan converts the existing JavaScript to
TypeScript without changing any runtime behaviour. Per the grill (2026-06-24, spiked on Node
24.12 / TS 6.0.3), the conversion also moves the code from CommonJS to **ESM** (`import`/`export`,
see D4) — the only module system that is both type-safe across modules *and* erasable by native
stripping.

**Scope — all nxtlvl-owned code:**

| Area | Path | Files (≈) | Notes |
|---|---|---|---|
| Production lib | `plugins/nxtlvl/lib/` | 11 + 11 tests | Pure modules, dependency-ordered |
| Production hooks | `plugins/nxtlvl/hooks/` | 8 + 7 tests + 1 adapter | Invoked by `hooks.json` as `node …/X.js`; `session-title` is the lone untested hook (gains a test, T2.8) |
| evals-lab | `Developer/nxtlvl-labs/evals-lab/bin/` | 4 + 4 tests + fixture | Own `package.json`; `node bin/X.js`. Now in the standalone `nxtlvl-labs` repo (moved out 2026-06-28) — migrate there, not in this repo |
| harness-lab | `Developer/nxtlvl-labs/harness-lab/bin/` | 5 + 5 tests + fixtures | Own `package.json`; `node bin/X.js`. Now in the standalone `nxtlvl-labs` repo (moved out 2026-06-28) — migrate there, not in this repo |
| Skill scripts | `config/claude/skills/brainstorming/scripts/` | `helper.js`, `server.cjs` | Lower priority; `server.cjs` stays explicit CJS |

**Explicitly out of scope:** `cm-phase0-workspace/` (throwaway, gitignored `*-workspace/`),
`**/vendor/**` and `plugins/agent-dev/` (not nxtlvl-owned), `reference/` (vendored harnesses),
`*.sh` hooks (e.g. `fallback-log.sh` stays shell).

**Three constraints shape every task:**

- **Source is the artifact — no build, no `dist/`.** Promotion stays `git mv` / install
  ([ADR-001](../decisions/ADR-001-plugin-local-marketplace-packaging.md)); the installed plugin is a
  SHA-pinned snapshot that runs the `.ts` directly. There is nothing to compile and nothing that can
  drift.
- **Erasable syntax only** ([ADR-034](../decisions/ADR-034-typescript-default-native-type-stripping.md)):
  type annotations, interfaces, type aliases, generics, `as`, `satisfies` — **no** enums,
  namespaces-with-runtime-code, parameter properties, or decorators. `tsconfig.json` is for
  `tsc --noEmit` + the editor only; **Node ignores it at runtime** (no path aliases).
- **The fail-open hook path must never be left broken in a committable state.** Each hook is renamed
  **and** its `hooks.json` command flipped `.js`→`.ts` in the *same* commit, with a stdin smoke test,
  so the repo is never one promote away from a hook pointing at a missing file
  ([ADR-006](../decisions/ADR-006-hook-fail-open-gated-blocking.md)).

**Strategy:** incremental, **tests-green per module**, dependency-ordered (leaves first). `allowJs`
lets `.ts` and `.js` coexist during the transition; CJS↔ESM interop (Node 24) lets the
half-converted tree run in both directions, and a **typeless repo-root `package.json`** keeps both
`tsc` and `node --test` green at every step (D10). `allowJs` is flipped off — and `"type":
"module"` flipped on — only at the end.

---

## 2. Architecture decisions (plan-level)

### ◇ Decisions — LOCKED at plan review

| ◇ | Decision | Resolution |
|---|----------|------------|
| D1 | Runtime | **Native Node type-stripping** — `node X.ts`, no build (ADR-034). |
| D2 | Scope | **All nxtlvl-owned code** (table above); throwaway + vendored excluded. |
| D3 | Sequencing | **Incremental, tests-green per module**, dependency-ordered. |
| D4 | Module system | **Convert to ESM** (`import`/`export`). *Supersedes the original "keep CommonJS"; amends [ADR-034](../decisions/ADR-034-typescript-default-native-type-stripping.md).* CJS `require('./x.ts')` types every cross-module import as `any` (verified); `import = require()` is type-safe but non-erasable (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`); only ESM is both type-safe and erasable. |
| D5 | Test framework | **Keep `node:test`** — runs `.test.ts` via the same type-stripping; zero new dependency. |
| D6 | Type-check gate | **`tsc --noEmit`** (dev-only). Candidate objective check for the ADR-009 audit. |
| D7 | Dev-dependency home | A **repo-root `package.json`** (devDeps: `typescript`, `@types/node`) — `tsc`/types are dev tooling, not runtime; the two labs keep their own `package.json`. |

### ◇ Resolved empirically (spiked 2026-06-24, Node 24.12 / TS 6.0.3)

| ◇ | Question | Resolution |
|---|----------|------------|
| D8 | Does CJS `require('./x')` resolve `x.ts`? | **No — explicit `.ts` extensions are mandatory** (`require('./x.ts')`). Renaming a leaf breaks every stale importer until its specifier is flipped `.js`→`.ts`. |
| D9 | Does `node --test` discover `*.test.ts`? | **Yes**, by default. Mixed CJS `.test.js` + ESM `.test.ts` both run green under a typeless `package.json`. |
| D10 | What `package.json` `"type"` during transition? | **Omit it** (typeless) — the only setting where `tsc` *and* runtime are both green. `"commonjs"` is a *false green* (tsc passes; ESM `.ts` dies at runtime because explicit commonjs disables Node's syntax-detection); `"module"` breaks un-converted `.js`. Flip to `"type": "module"` at the final gate (T5.1). |

---

## 3. Tasks

### Phase 0 — Foundation & de-risking spike (no behaviour change)

- **T0.1 🤖 Spike on a dependent pair (not a lone leaf).** Convert `lib/paths.js`→`paths.ts` to ESM
  **and** flip a still-CJS importer's specifier to `require('./paths.ts')`, **and** rewrite one
  `require.main === module` CLI-guard to its ESM form — confirming the idiom on Node 24.12
  (`import.meta.main`, else `process.argv[1] === fileURLToPath(import.meta.url)`), since 8 dual-mode
  files need it. Confirm: (a) `node --test` runs `paths.test.ts` green; (b) the CJS importer resolves
  `require('./paths.ts')` and the converted file runs both as an import target and when invoked
  directly; (c) `tsc --noEmit` clean. D8/D9/D10 are **already resolved** (table above); this spike
  validates the ESM seam + main-guard rewrite before breadth. *(De-risks the migration before any
  breadth.)*
- **T0.2 🤖 Add repo-root `package.json`** with devDeps **`typescript@6`** (pin the major — TS 6.x
  errors `TS5112` if files are passed alongside a tsconfig) + `@types/node` (D7). **Omit the `type`
  field** (D10) — an explicit `"type": "commonjs"` is a false green. Add `typecheck`
  (`tsc --noEmit`, **no file args**) and `test` (`node --test`) scripts.
- **T0.3 🤖 Add repo-root `tsconfig.json`** (spike-verified set): `strict`, `noEmit`, `allowJs: true`,
  `checkJs: false`, `module`/`moduleResolution` = `nodenext`, `target`/`lib` = `es2024` (Node 24),
  `types: ["node"]`, `erasableSyntaxOnly: true` (the flag that actually rejects non-erasable syntax —
  enums, namespaces-with-runtime-code, parameter properties; **`verbatimModuleSyntax` does NOT — it
  silently passes `enum`**), **`allowImportingTsExtensions: true`** (required for ESM `./x.ts`
  specifiers under `noEmit`), `esModuleInterop: true`, `include` scoped to owned paths, `exclude` =
  `reference/`, `**/vendor/`, `*-workspace/`, `node_modules/`.
- **T0.4 🤖 Author the hook I/O type contracts** — `plugins/nxtlvl/lib/types.ts`: the per-event stdin
  payload shapes (`PreToolUse`/`PostToolUse` `tool_input`, `SessionStart`, `UserPromptSubmit`,
  `PreCompact`, `SessionEnd`) and hook-output shapes (`additionalContext`, exit-code conventions).
  **This is the migration's core value** — it encodes the platform-boundary shapes that have bitten
  before (`Skill→tool_input.skill` vs `Agent→tool_input.subagent_type`). Hooks consume these via
  **`import type { … }`** — fully erasable, no runtime import.
- **T0.5 🤖 Verify the green-bar** runs end-to-end on the converted leaf: `npm run typecheck` clean +
  `npm test` green + a hook smoke (`echo '<payload>' | node hooks/<any>.ts`).

### Phase 1 — Production `lib/` (dependency order, leaves first)

Per module (atomic commit): rename `X.js`→`X.ts` **and** `X.test.js`→`X.test.ts`; **flip every
importer's specifier `.js`→`.ts` in the same commit** (a rename breaks every stale importer until
flipped); ESM-convert (`require`→`import`, `module.exports`→`export`, `node:*` requires→imports);
add types (consume `lib/types.ts` via `import type`); `tsc --noEmit` clean; `node --test` green; commit.

- **T1.1** `paths` *(done in T0.1 spike — fold in)*
- **T1.2** `atomic` · **T1.3** `scrub` *(leaves — no intra-lib deps)*
- **T1.4** `obs-log` · **T1.5** `project-identity` · **T1.6** `bookmarks`
- **T1.7** `instincts` · **T1.8** `metrics` · **T1.9** `recall` · **T1.10** `evolve` · **T1.11** `observer-runner`

### Phase 2 — Production `hooks/`

Per hook (atomic commit): rename `X.js`→`X.ts` (+ test); ESM-convert (`require`→`import`,
`module.exports`→`export`, `node:*` imports, `require.main === module`→ESM main-guard,
`__dirname`→`import.meta.dirname`) and flip importer specifiers; type against `lib/types.ts`
(`import type`); **flip the `hooks.json` command `node …/X.js` → `node …/X.ts` in the same commit**;
stdin smoke test; `node --test` green; commit.

- **T2.1** `dangerous-bash` (+ regression suite) · **T2.2** `capture` · **T2.3** `observe`
- **T2.4** `briefing` · **T2.5** `close` · **T2.6** `precompact` · **T2.7** `context-alert`
- **T2.8** `session-title` (**author a new `session-title.test.ts`** — the lone untested hook, and a `UserPromptSubmit` stdin-parser: the exact bug class this migration targets) · **T2.9** `evals/dangerous-bash/adapter`
- *(`fallback-log.sh` stays shell — no change.)*

### Phase 3 — Labs (`Developer/nxtlvl-labs/`)

> **Note (2026-06-28):** the labs moved out of this repo's `sandbox/` into the standalone `nxtlvl-labs`
> repo. This phase now applies to that sibling repo, not the nxtlvl repo, and would be driven from there.

Each lab has its own `package.json` — update its `bin`/`scripts` (`node bin/X.js`→`X.ts`); shebangs
stay `#!/usr/bin/env node` (Node strips types). Update lab-local docs/READMEs that *name* the scripts.

- **T3.1** evals-lab: `lib/engine`, `lib/graders`, `lib/scorecard`, `run-eval` (+ tests, `__fixtures__/sample-eval/adapter`).
- **T3.2** harness-lab: `lib/manifest`, `new-cell`, `ledger`, `eval`, `graduate` (+ tests, JS fixtures).
  These are the scripts named in [ADR-032](../decisions/ADR-032-cells-installable-as-plugin-architecture.md)/[ADR-033](../decisions/ADR-033-three-part-objective-graduation-contract.md);
  the ADRs are **not** edited (per ADR-034) — only the files and the lab's own docs.

### Phase 4 — Skill scripts

- **T4.1** `config/claude/skills/brainstorming/scripts/helper.js`→`.ts`; `server.cjs`→`.cts` (keep
  explicit CommonJS); confirm the brainstorming skill's invocation still works.

### Phase 5 — Finalize & gate

- **T5.1 🤖** Flip `tsconfig` `allowJs: false` **and add `"type": "module"` to the repo-root
  `package.json`** (D10 final gate — silences the dev-time `MODULE_TYPELESS_PACKAGE_JSON` warning and
  makes any stray `require`/`module.exports` fail loudly); confirm no owned `.js` remain
  (`tsc --noEmit` + full `node --test` green across all areas).
- **T5.2 🤖** Add `tsc --noEmit` to the pre-promote checklist and register it as a candidate objective
  check for the ADR-009 audit.
- **T5.3 🤖** Update `CLAUDE.md` (+ `sandbox/README.md`): TS is the default; the erasable-syntax rule;
  how to run/typecheck. Reference ADR-034.
- **T5.4 🧑** Promote + verify live: `/plugin` re-install (manual), then confirm the daily-driver's
  SHA-pinned snapshot runs the `.ts` hooks under Node 24 (smoke a session: briefing fires, capture
  writes, dangerous-bash still blocks).

---

## 4. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `require('./x')` won't resolve `.ts` | **Resolved (spiked):** explicit `.ts` extensions are mandatory; each leaf's rename flips every importer's specifier `.js`→`.ts` atomically. |
| `node --test` misses `*.test.ts` | **Resolved (spiked):** discovered by default; mixed CJS/ESM test files both run under a typeless `package.json`. |
| `package.json` set to `"type": "commonjs"` mid-migration | **False green** — `tsc` passes while every ESM `.ts` dies at runtime (explicit commonjs disables Node's syntax-detection). Mitigation: T0.2 omits `type`; D10. |
| Live hook left broken at a promotable commit | Each hook + its `hooks.json` entry flipped **atomically** with a smoke test (Phase 2); promote only after T5.1 full-green. |
| Non-erasable syntax sneaks in (enum/decorator) | `tsc --noEmit` + `erasableSyntaxOnly: true` catch it (**`verbatimModuleSyntax` does not — it silently passes `enum`**); `--experimental-transform-types` is an **ask-first / amend-ADR-034** escape hatch, never a default. |
| ~~Parallel epitaxy automation commits mid-migration~~ | **Retired 2026-06-25** — "epitaxy" was a transient session behavior (06-18/19), not a standing daemon; no defensive measures needed. Verifying landed bytes with `git show HEAD:<path>` is still sound general hygiene. |
| Debugging line numbers | Type-stripping replaces types with whitespace → stack-trace lines stay 1:1; no source maps needed. |

## 5. Verification

- **Per step:** `tsc --noEmit` clean for converted files · `node --test` green · hook stdin smoke where applicable.
- **Per hook (Phase 2):** `hooks.json` points at the `.ts`; `echo '<event payload>' | node hooks/<name>.ts` exits 0 (or exit 2 for a deliberate dangerous-bash block) and emits the expected channel.
- **Final:** every owned file is `.ts`; `allowJs: false`; full suite green across production + both labs; live daily-driver verified post-promote (T5.4).
