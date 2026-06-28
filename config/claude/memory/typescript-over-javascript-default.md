---
name: typescript-over-javascript-default
description: "Standing default — TypeScript over JavaScript always; Python/Rust/etc. stay first-class when genuinely the best tool (chosen deliberately, not by default)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 51a44202-3b19-49fb-912c-faabbb401d9c
---

The user's standing preference (2026-06-24): **always use TypeScript over JavaScript.** This is
"no new JavaScript," **not** "only TypeScript" — Python, Rust, and others remain first-class when
they're genuinely the best tool for a job, chosen deliberately (with the user's agreement), never
as a default. Confirmed they want my genuine agreement on the TS-over-JS default, not just compliance.

**Why:** for glue/harness code that parses untyped platform JSON (CC hook stdin payloads), a type
checker catches the recurring shape-mismatch bug class (e.g. `Skill→tool_input.skill` vs
`Agent→tool_input.subagent_type`); on Node ≥24.12 the cost is ~nil.

**How to apply:** default new scripts to `.ts`. For nxtlvl specifically, the runtime is **native
Node type-stripping** (no build step; `node X.ts`; erasable-syntax-only; `tsconfig` is
`tsc --noEmit`/editor only) — see the migration plan at
docs/plan/nxtlvl-typescript-migration-plan.md. If another provider/runtime can't guarantee Node
≥23.6, a build step is the fallback (ask first). Reach for Python/Rust when it's the right tool, and
say why. See [[nxtlvl-harness]] and [[nxtlvl-install-promotion]].
