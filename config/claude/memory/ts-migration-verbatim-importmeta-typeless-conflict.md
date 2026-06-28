---
name: ts-migration-verbatim-importmeta-typeless-conflict
description: "During CJS->ESM TS migration, nodenext+typeless package.json mis-classifies ESM .ts as CommonJS, so verbatimModuleSyntax (TS1295/TS1287) and import.meta (TS1470) both fail tsc even though Node runs the file fine; use module=preserve/moduleResolution=bundler during the mixed phase."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 0146c41c-3a0b-4720-adf5-03d15d48859e
---

In the nxtlvl TypeScript migration (plan [[nxtlvl-harness]]), the plan's D10 chose a
**typeless** root/lab `package.json` for the mixed CJS->ESM phase — correct for the RUNTIME (Node's
per-file syntax detection loads ESM `.ts` as ESM while CJS `.js` stay CJS). But `tsc --noEmit` with
`module: nodenext` derives each file's module KIND from the nearest `package.json type`: typeless →
nodenext classifies ESM `.ts` as **CommonJS**, and then:

- `verbatimModuleSyntax: true` rejects the `import`/`export` (TS1295 / TS1287), and
- any `import.meta` (the ESM main-guard `import.meta.main` and `import.meta.dirname`) is forbidden
  in a "CommonJS" file (**TS1470**) — this one is NOT fixable by dropping verbatimModuleSyntax.

So the setting that's correct for the mixed runtime (typeless) is incompatible with
`nodenext + verbatimModuleSyntax + import.meta` at check time. The parallel Phase-0 root tsconfig
ADDED `verbatimModuleSyntax: true` (the plan only required `erasableSyntaxOnly`), so any
`plugins/nxtlvl` hook converted to `import.meta.dirname` will hit TS1470 the same way.

**Fix used in harness-lab's own tsconfig:** during the mixed phase set `module: "preserve"` +
`moduleResolution: "bundler"` — these treat every file as ESM and ignore `package.json type`, so
`import.meta` + `verbatimModuleSyntax` typecheck cleanly while the typeless runtime mix still works.
At the FINAL gate (all `.js` gone), flip `package.json` to `type: module` and switch tsconfig back
to `module/moduleResolution = nodenext` + `allowJs: false` to match root; nodenext then classifies
`.ts` as ESM and everything passes. Keep explicit `.ts` import extensions throughout (mandatory
under Node type-stripping; the final nodenext switch re-validates them). Tests stay green the whole
time because the runtime never depended on tsc's classification. See [[nxtlvl-harness-lab-status]].
