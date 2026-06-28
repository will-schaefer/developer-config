---
name: nxtlvl-harness-lab-status
description: harness-lab incubation pipeline — BUILT (T1–T11 + T13); NOT a standalone plugin (dogfood as project skills via .claude/skills→../cells); only the user's manual project-skill dogfood remains.
metadata:
  node_type: memory
  type: project
  originSessionId: 13002644-fcd3-4c14-9c82-96f20584c69e
---

The **harness-lab** incubation tier (upstream-most of `harness-lab → nxtlvl plugin → installed ~/.claude`)
is **BUILT** as of 2026-06-22. Home: `Developer/nxtlvl-labs/harness-lab/` — in the standalone
`nxtlvl-labs` repo (sibling of the nxtlvl repo; **moved out of the harness repo's `sandbox/` on
2026-06-28**, beside `evals-lab/`; not `~/agent-lab`). Spec `docs/spec/nxtlvl-harness-lab.md`
+ plan `docs/plan/nxtlvl-harness-lab-plan.md` both marked BUILT. The decisions live in that spec + plan
(labs topology · cells + stage-as-data · 3-part objective graduation contract); their dedicated ADRs
(old ADR-031/032/033) were **removed in the 2026-06-28 ADR reorg** and not re-recorded.

**What shipped (T1–T11 + T13):**
- Machinery in `bin/`: `lib/manifest.js` (pure parse+validate, error *codes* route to gate criteria) ·
  `ledger.js` (golden-tested) · `new-cell.js` (per-type scaffold, eval-first empty criteria) ·
  `eval.js` (deterministic STUB seam → `docs/seam-contract.md`; real evals-lab is a later cycle) ·
  `graduate.js` — the keystone 3-criterion objective gate (integrity · declared-evals · intake), exit
  0 pass / 2 block / **crash fails open**. **63 node:test green** (`npm test` = `node --test 'bin/*.test.js'`).
- The gate was **doubt-reviewed** (nxtlvl:doubt-reviewer): found+fixed a secret-scan-crash bypass, an
  over-trusted `allPassed` false-block, and a hung-hook timeout bypass — all regression-locked.
- Vendored `agent-dev`/`skill-creator`/`plugin-dev` under `vendor/`; `harness-review` is an in-repo
  pointer (no self-duplication); `vendor/SOURCES.md` honest about unpinned upstream SHAs.
- **Dogfood model CHANGED 2026-06-22 (user correction):** the lab is **NOT a standalone plugin**. The
  `.claude-plugin/plugin.json` + the `nxtlvl-labs/.claude-plugin/marketplace.json` local
  marketplace were **removed**. Replacement = **lab-as-CC-project**: `.claude/skills` is a **symlink to
  `../cells`**, so skill-type cells auto-discover as **project skills** (`/<name>`) when the lab is the
  working dir — no install, no marketplace, no second plugin identity. Verified vs live CC docs:
  project skills live at `.claude/skills/<name>/SKILL.md`, NO settings path override exists, symlinks
  are followed; discovery walks upward so cells don't leak into the Developer session. **The cells
  decision was amended** (its installable-as-plugin half reversed; stage-as-data half unchanged); spec/plan/README
  reconciled.
- **Graduated one cell end-to-end:** `pointer-summary` (skill) → `plugins/nxtlvl/skills/pointer-summary/`
  with its `evals/cases.yaml` carried (now live as `nxtlvl:pointer-summary`). The lab cell record
  remains (stage `graduated`).

**Remaining = T12 (manual, user-owned):** dogfood a cell by working with `harness-lab` as the project
dir (cells load as project skills) and exercising it on a real task. No `/plugin` needed. A cell already
graduated into `plugins/nxtlvl/` is dogfooded via the nxtlvl plugin (needs a /plugin promote to go live).

**Build-environment gotchas hit (reusable):**
- Writing `.claude/` (any path) and anything outside `harness-lab/` (e.g. `plugins/nxtlvl/`, the parent
  marketplace dir) is **sandbox-write-denied** → needs `dangerouslyDisableSandbox` per step. The rest of
  the lab builds sandboxed (it's inside the write-allowlist — the `~/agent-lab` allowlist problem is gone).
- `npm install` fails EPERM on the root-owned `~/.npm/_cacache` → use `npm install --cache "$TMPDIR/..."`.
- `js-yaml` pinned (`4.1.0`) in the lab's own `package.json` (D2); `node_modules` gitignored.

As of writing the whole lab + ADRs + spec/plan edits are **uncommitted**. See [[nxtlvl-harness]],
[[nxtlvl-install-promotion]], [[adr-numbering-collision-hazard]], [[cc-context-hook-facts]].
