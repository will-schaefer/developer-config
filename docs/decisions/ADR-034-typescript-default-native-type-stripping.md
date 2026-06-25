---
id: ADR-034
title: "TypeScript is the default harness language (no new JavaScript), run via native Node type-stripping"
status: Accepted
date: 2026-06-24
amended: 2026-06-24
implementation: "Migration in progress — incremental, tests-green per module. Master plan: docs/plan/nxtlvl-typescript-migration-plan.md"
---

# ADR-034: TypeScript is the default harness language (no new JavaScript), run via native Node type-stripping

## Context

The harness's own code — hooks (`plugins/nxtlvl/hooks/`), the shared library
(`plugins/nxtlvl/lib/`), and the lab tooling (`sandbox/nxtlvl-labs/`) — grew up in
JavaScript/Node because Claude Code hooks are conventionally invoked as `node script.js`. **No
prior ADR ever chose the implementation language.** JS is *emergent*, not decided; this is the
first ADR to address it.

The footprint is now substantial — ~38 production files (hooks + lib, each with a co-located
`node:test` suite), ~20 lab files, plus skill scripts. Every hook parses **untyped JSON off the
platform's stdin** (the tool-call payloads), and the harness has repeatedly been bitten by
shape mismatches at exactly that boundary (e.g. `Skill→tool_input.skill` vs
`Agent→tool_input.subagent_type`). That is the precise bug class a type checker prevents.

The operator has set a standing preference: **TypeScript over JavaScript as the default**, while
keeping other languages (Python, Rust) available when they are genuinely the best tool.

Two facts make this cheap and shape the decision:

- **Node 24.12 ships stable, default TypeScript type-stripping** (confirmed against the v24.x
  API docs: *"Type stripping is stable as of v24.12.0"* — the exact version on the build
  machine). A `.ts` file runs directly via `node file.ts`; erasable TypeScript syntax is
  replaced by whitespace, with **no type-checking and no build at runtime**. Node **ignores
  `tsconfig.json`** for execution.
- **The installed plugin is a SHA-pinned cache snapshot that CC reads directly** — promotion is
  a `git mv` / install ([ADR-001](ADR-001-plugin-local-marketplace-packaging.md)), not a deploy.
  Any *compiled* artifact therefore introduces a drift surface: a forgotten rebuild on promote
  would silently run stale code on the live daily-driver.

## Decision

A single decision in three parts:

**1. TypeScript is the default language for all nxtlvl-owned harness code; no new JavaScript is
authored.** Existing JS migrates to TS per the master plan. This *displaces JS as the default* —
it does not mandate TS for everything.

**2. Other languages stay first-class when justified.** Python, Rust, and others remain valid
where they are the best tool, chosen **deliberately (with explicit agreement)** — never as a
default. The decision is **"no new JavaScript," not "only TypeScript."** This is orthogonal to
[ADR-016](ADR-016-confident-core-capability-domains.md)'s capability domains
(Python · TS/JS · Rust · Frontend · Backend), which describe the *apps the harness helps build*,
not the harness's own implementation language — those are untouched.

**3. TypeScript runs via native Node type-stripping; there is no build step.** Hooks invoke
`node "${CLAUDE_PLUGIN_ROOT}"/hooks/<name>.ts` directly. Authoring is constrained to **erasable
TypeScript syntax** (type annotations, interfaces, type aliases, generics, `as`, `satisfies`) —
**no** enum declarations, namespaces with runtime code, parameter properties, or decorators
(those require `--experimental-transform-types`, which we do **not** enable). A repo-root
`tsconfig.json` exists for **`tsc --noEmit` type-checking and editor support only** — Node does
not read it at runtime. **Source is the artifact:** nothing compiled is committed or shipped, so
"promotion = `git mv`" still equals activation with zero drift.

The quality contract: `tsc --noEmit` + `node --test` are the green bar before any promote, and
`tsc --noEmit` is a candidate objective check for the ADR-009 audit.

## Alternatives Considered

### Build step (`tsc → dist/`, ship compiled JS)

- Pros: full TS feature set (enums, decorators, parameter properties); type-check and emit in
  one pass.
- Cons: the SHA-pinned cache install would run the *compiled* output, so a forgotten rebuild on
  `git mv`/promote silently runs stale code — a correctness hazard unique to this install model;
  adds build tooling and a build-before-promote step to every change; breaks the
  [ADR-001](ADR-001-plugin-local-marketplace-packaging.md) "promotion = activation" equivalence.
  None of the runtime-only TS features are needed for hook/lib glue.
- Rejected: **lower quality for this architecture** — it trades a real drift hazard for features
  we don't use.

### `tsx` / `bun` as the hook runtime (`tsx hook.ts`)

- Pros: full TS, no build, no erasable-syntax constraint.
- Cons: adds an external runtime that must be present on `PATH` wherever CC spawns hooks — one
  more thing that can be missing or version-mismatched on the **fail-open hook path**
  ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md)); contradicts "compose on native"
  ([ADR-003](ADR-003-compose-not-reconstruct.md)) when the platform's own Node already runs TS.
- Rejected: native Node already does the job; an extra runtime is unjustified surface area on the
  hook path.

### Stay on JavaScript (status quo)

- Pros: zero migration cost; no syntax constraint.
- Cons: keeps untyped JSON parsing at every hook boundary — the recurring stdin-shape bug class
  stays un-caught; contradicts the operator's standing default.
- Rejected: the recurring cost (untyped platform I/O) is exactly what types prevent, and the cost
  to switch is ~nil on Node 24.

### TypeScript everywhere (mandate TS, retire polyglot)

- Pros: one language; simplest mental model.
- Cons: would force TS where Python or Rust are genuinely better (data/ML glue, perf-critical
  native code), over-constraining for no benefit.
- Rejected: the decision is "no new JavaScript," not "only TypeScript"; deliberate polyglot is
  preserved by design.

## Consequences

- **Erasable-syntax discipline is an "always" boundary.** No enums, namespaces-with-runtime-code,
  parameter properties, or decorators. If a future need is real, enabling
  `--experimental-transform-types` or a scoped build is an **"ask first" / amend-this-ADR**
  decision.
- **`tsconfig.json` is type-check-only.** Node ignores it at runtime, so path aliases and
  syntax down-leveling are unavailable — imports use real, runtime-resolvable specifiers
  (e.g. `./paths.ts`), not aliases.
- **Module system — ESM, not CommonJS** *(amended 2026-06-24, from the JS→TS migration grill;
  verified by spike on Node 24.12 / TypeScript 6.0.3)*. The migration plan originally kept
  CommonJS (rename + type only); the grill overturned that. **All nxtlvl-owned code converts to
  ESM** (`import`/`export`), because CommonJS forfeits exactly the safety this ADR exists to buy:
  `require('./x.ts')` types every cross-module import as `any` (a `string`→`number` mismatch
  passes silently), while ESM `import` catches it (`TS2322`). The typed-CJS escape
  `import x = require()` *is* type-checked but is **non-erasable** — Node throws
  `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` — so only ESM is **both** type-safe and erasable, the two
  non-negotiables here. CJS↔ESM interop holds in both directions on Node 24, so the tree converts
  incrementally and executes safely throughout. The mid-transition mechanics (a typeless
  repo-root `package.json` until a final `"type": "module"` gate; `erasableSyntaxOnly` rather than
  `verbatimModuleSyntax`, which silently passed an `enum`; explicit `.ts` import specifiers) are
  task-level detail in the [migration plan](../plan/nxtlvl-typescript-migration-plan.md). This
  **supersedes the plan's D4** ("keep CommonJS").
- **`tsc --noEmit` + `node --test` are the per-module green bar.** The migration is incremental
  with `allowJs` during the transition so `.ts` and `.js` coexist; the heavy co-located test
  culture is preserved (tests become `*.test.ts`, run by `node --test`). See the master plan at
  `docs/plan/nxtlvl-typescript-migration-plan.md`.
- **Reversibility caveat.** The one condition that would invalidate native stripping is hooks
  needing to run where Node ≥ 23.6 (stable ≥ 24.12) cannot be guaranteed. On this single-operator
  machine it can; if that ever changes, the build-step alternative is the fallback (amend this
  ADR).
- **Incidental `.js` filenames in prior ADRs are NOT amended here.** References like
  `graduate.js`/`ledger.js`/`new-cell.js` ([ADR-032](ADR-032-cells-installable-as-plugin-architecture.md),
  [ADR-033](ADR-033-three-part-objective-graduation-contract.md)) and the Node dashboard server
  ([ADR-028](ADR-028-project-management-domain-manage-and-see.md)) are historical records of
  **language-agnostic** decisions; only the file *extensions* change, in code. Those decisions
  stand. This ADR is the single canonical record of the language change.
- **The polyglot seam is the execution model, not the task domain** *(re-examination confirmed
  2026-06-24 — Python stress-tested against this decision; conclusion unchanged)*. The ADR's
  original Alternatives section weighed TS against JS only; Python was not considered. A
  subsequent branch-by-branch grill brought Python into the ring and confirmed it does not take
  the harness plumbing on two decisive grounds: (a) CC spawns hooks as `command`-type
  subprocesses on the fail-open path on every tool call — Node's runtime is guaranteed present
  because CC *is* Node; Python reintroduces the exact "runtime must be present on PATH on the
  fail-open path" liability used to reject `tsx`/`bun` (see the `tsx`/`bun` alternative above),
  and harder, because Python is not the platform runtime; (b) JS→TS is a mechanical type-strip
  (already planned, tests stay green); JS→Python is a full rewrite for zero ecosystem gain on
  glue. The decision therefore stands; what was missing is a testable boundary for the
  already-stated "deliberate polyglot":
  - **Default = TypeScript-on-Node** for everything CC spawns or that is plain orchestration /
    file / JSON glue: the hook path (`plugins/nxtlvl/hooks/`), the shared lib
    (`plugins/nxtlvl/lib/`, including `lib/types.ts`), and operator/lab CLIs
    (`sandbox/nxtlvl-labs/` — harness-lab, evals-lab). These share the typed contract and have
    no ecosystem reason to split, even though the CLIs are off the hot path.
  - **Python is a deliberate, recorded exception ONLY when BOTH hold:** (a) it is *off* the
    CC-spawned fail-open hook path (latency-insensitive, invoked deliberately), AND (b)
    Python's data/ML/numeric ecosystem (numpy / pandas / scikit-class) is the *genuine*
    reason — e.g. instinct clustering for `/evolve`, statistical eval / metric analysis.
    "Python is comfortable for scripts" is not sufficient.
  - **The crossing test:** Would a numpy/scikit-class library materially do this better, AND is
    it off the spawned fail-open path? Both yes → Python as a deliberate recorded exception.
    Otherwise → TypeScript.
  - **Rust** remains the reserved exception for a genuine perf hotspot (see Decision §2 above —
    cross-reference, not duplicate).
  - **Precedent:** the harness is already polyglot at the seam on this same principle —
    `fallback-log.sh` is a thin `jq` shell logger; thin, principled, fit-justified exceptions
    are the model.
  - **Scope caveat:** this is forward-guidance. There is no nxtlvl-owned Python today — the
    large `plugins/agent-dev/.../instinct-cli.py` is vendored `agent-dev`, explicitly outside
    ADR-034's scope. This amendment guides *future* exceptions; it does not reclassify any
    existing code and does not change the migration plan
    (`docs/plan/nxtlvl-typescript-migration-plan.md`).
- **Cross-links:** preserves "promotion = `git mv` / install"
  ([ADR-001](ADR-001-plugin-local-marketplace-packaging.md)); applies "compose on native, don't
  add runtimes" ([ADR-003](ADR-003-compose-not-reconstruct.md)); keeps the fail-open hook path
  intact ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md)); leaves the capability domains of
  [ADR-016](ADR-016-confident-core-capability-domains.md) untouched (apps built, not the harness's
  own language); the `tsc --noEmit` gate is a candidate objective check for
  [ADR-009](ADR-009-objective-invoked-audit-gate.md).
