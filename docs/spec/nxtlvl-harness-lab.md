# Spec: `harness-lab` — the agent-capability incubation pipeline

> Status: **BUILT** (2026-06-22 — T1–T11 implemented; one capability graduated end-to-end. The
> live install + dogfood (T12) is the one remaining manual step, owned by the user.) Produced via
> `nxtlvl:brainstorm` → `spec-driven-development`
> (2026-06-21; **home relocated 2026-06-22** — see §The 3-tier promotion ladder). The approved design
> from the brainstorm is the input; this is its written contract. Sibling lab `evals-lab`
> (`nxtlvl:evals-lab`) is designed in a later cycle — out of scope here except for the seam contract
> (§Lab↔evals-lab seam).

## Objective

**What:** A self-contained R&D **workspace**, `harness-lab` (a dev workspace, *not*
a standalone plugin — its cells graduate into the `nxtlvl` plugin, e.g. `nxtlvl:pointer-summary`), living
at `Developer/nxtlvl-labs/harness-lab/` in the standalone `nxtlvl-labs` repo (a sibling of the nxtlvl
repo; moved out of the harness repo's `sandbox/` on 2026-06-28), where new agent capabilities — skills, agents/subagents,
commands, hooks — are **incubated to production quality and then graduate into the `nxtlvl` plugin.**

**Why:** The `nxtlvl` workbench already *authors* and *promotes* capabilities, but it has no dedicated
space for high-churn experimentation, rigorous pressure-testing, and an objective, measured graduation
bar. `harness-lab` is the new upstream-most tier of the promotion ladder — where churn is highest and
promotion pressure is lowest — so half-built or unproven capabilities never touch the daily driver.

**Who:** The user (solo), running daily, building agents *with* the agent harness (dogfooding).

**Success looks like:** a capability can be conceived, built, pressure-tested against a *pre-declared*
bar, and graduate end-to-end into the `nxtlvl` plugin (`plugins/nxtlvl/`) with its eval cases in tow — with an objective
gate that blocks on facts and never on taste.

### The 3-tier promotion ladder

```
harness-lab                       →   nxtlvl plugin        →   installed ~/.claude
(Developer/nxtlvl-labs/, highest     (the workbench,           (stable daily driver)
 churn, lowest pressure)              Developer repo)
```

`harness-lab` lives in the **standalone `nxtlvl-labs` repo** at `Developer/nxtlvl-labs/harness-lab/` — a
sibling of the nxtlvl repo, fully off the live plugin's discovery path (a separate tree entirely, so
in-flight cells are never loaded, routed to, or warned about by the live plugin). It is **its own repo**
(`will-schaefer/nxtlvl-labs`) with its own git history — not a subdir of the nxtlvl repo, not gitignored
scratch — and sits beside its sibling `evals-lab/` under the shared `nxtlvl-labs/` parent.
It is decoupled from the `nxtlvl` plugin only *logically* — its own `package.json`, machinery, and tests;
graduation is an **in-repo `git mv`** from a cell to its `target:` under `plugins/nxtlvl/`, carrying the
cell's `evals/`.

> **Relocated 2026-06-22.** This supersedes the original design's "separate git repo at `~/agent-lab`,
> outside `Developer`, fully decoupled." Consolidating both labs under the existing `sandbox/` staging
> tree keeps them version-controlled by `Developer`, brings every build step inside the sandbox
> write-allowlist, and turns the cross-repo graduation hand-off into a single in-repo `git mv`.

## Tech Stack

- **Node.js** (LTS) — the lab machinery (graduation check, ledger, cell scaffolder).
- **bash** — thin glue / install scripts.
- **`node:test`** — unit/regression tests for the lab machinery (matches existing nxtlvl convention,
  e.g. `plugins/nxtlvl/hooks/dangerous-bash.test.js`).
- **YAML** — `manifest.yaml` per cell (structured, script-parseable).
- **Claude Code project skills** — the lab is a live CC *project*, not a standalone plugin;
  `.claude/skills` symlinks to `../cells`, so each skill-type cell (`cells/<name>/SKILL.md`) is
  dogfooded as a **project-scoped skill** in-session — no install, no marketplace, no second plugin
  identity. *(Amended 2026-06-22 from the original installable-as-plugin design — see ADR-032.)*
- **Vendored authoring toolkit** — `agent-dev`, `skill-creator`, `plugin-dev`, `harness-review`,
  pinned as a snapshot under `vendor/` with `SOURCES.md` (source SHAs + re-sync procedure).

## Commands

> Intended surface (nothing is built yet). Final names land in the plan.

```
Scaffold a cell:     node bin/new-cell.js <name> --type=skill|agent|command|hook
Run a cell's evals:  npm run eval -- <cell>          # delegates to evals-lab via the seam
Graduation check:    npm run graduate -- <cell>      # the objective gate; exit 2 = block, 0 = pass/warn
Update/view ledger:  npm run ledger                  # regenerates ledger.md from all manifests
Test the machinery:  node --test 'bin/*.test.js'     # explicit glob (directory arg breaks the runner)
Install for dogfood: <local-marketplace install>     # confirm against current CC plugin docs
```

## Project Structure

```
Developer/nxtlvl-labs/harness-lab/  # in the standalone nxtlvl-labs repo (beside evals-lab/)
  cells/<capability>/          # the unit of work — one incubating capability each
    manifest.yaml              #   intent · type · stage · deps · graduation criteria · intake · target
    <capability files>         #   SKILL.md | agent .md | command .md | hook(s)
    evals/                     #   the cell's own eval cases/fixtures — TRAVEL with it on graduation
    run.md                     #   how to exercise/dogfood this cell
  vendor/                      # pinned snapshot of the authoring toolkit (read-only; re-sync only)
    SOURCES.md                 #   source repo + SHA per vendored item + the re-sync procedure
  bin/                         # lab machinery: new-cell, graduate, ledger (+ *.test.js)
  inbox.md                     # lab-local intake queue (seeded once from Developer backlogs)
  ledger.md                    # generated single-glance view: every cell + its stage
  .claude/                     # makes the lab a live CC project (cells invocable in-session)
    skills -> ../cells         #   symlink: skill-type cells auto-discovered as project skills (dogfood)
  docs/                        # lab-local process, conventions, lab ADRs
```

**Stage is data, never location.** A cell never moves directories as it matures — its `stage:` field in
`manifest.yaml` changes, and `ledger.md` is regenerated. (Avoids the "files-as-state" anti-pattern.)

### Cell manifest (`manifest.yaml`)

```yaml
name: example-skill
type: skill                      # skill | agent | command | hook
stage: develop                   # develop | review | pressure-test | refine | graduation-ready | graduated
intent: >                        # what this capability does and why it should exist
  One-paragraph statement of purpose.
intake:                          # ADR-008 membership: presence is gate-checked, quality is not
  task: "the task that required it"
  failed: "the existing thing that fell short"
graduation_criteria:             # eval-FIRST: declared BEFORE building; the gate measures against these
  - id: trigger-accuracy
    bar: ">= 0.9 on the declared trigger set"
  - id: behavioral
    bar: "all behavioral eval cases pass"
deps: []                         # other cells or vendored tools relied on
target: plugins/nxtlvl/skills/example-skill   # where it lands in the nxtlvl plugin on graduation
```

## Code Style

Follow existing nxtlvl conventions:

- **Pointers over dumped content** in all generated reports/ledgers — reference `path:line`, don't paste
  blocks.
- **Two failure paths, two rules** (the hook-safety doctrine): a script *erroring* always fails open
  (exit 0, do nothing); a script *deciding to block* is a clean, deliberate exit 2. The `graduate` check
  is the one place a deliberate block is intended.
- **Exit-code contract** for the graduation gate: `exit 0` = pass (warnings allowed on stderr),
  `exit 2` = block. A crash/exception must never masquerade as a block.

```js
// bin/graduate.js — the objective gate (illustrative)
// Blocks on THREE objective criteria; taste observations only warn.
const blockers = [];
const warnings = [];

checkIntegrity(cell, blockers);          // frontmatter/parse/refs/secrets/hooks-exit-0
checkDeclaredEvals(cell, blockers);      // scorecard from evals-lab vs. cell.graduation_criteria
checkIntakePresent(cell, blockers);      // ADR-008 justification present (presence, not quality)
collectTasteObservations(cell, warnings);// never a blocker

warnings.forEach(w => console.error(`⚠ ${w}`));
if (blockers.length) { blockers.forEach(b => console.error(`✗ ${b}`)); process.exit(2); }
process.exit(0);
```

## Testing Strategy

- **Lab machinery** (`bin/*.js`) is unit-tested with `node:test` under `bin/*.test.js`. Run with an
  explicit glob: `node --test 'bin/*.test.js'`.
- **The graduation gate is regression-locked** — each of the three blocking criteria has a test proving
  it blocks a bad cell and passes a clean one (the same discipline that locked the dangerous-bash gate).
- **Per-cell evals** live in `cells/<capability>/evals/` and are the capability's own behavioral/trigger
  cases — declared eval-first, run via the evals-lab seam, and they **travel with the capability** when it
  graduates so it stays regression-guarded in the plugin.
- **Dogfooding** is a first-class test level: a candidate is exercised on a real task as a
  **project-scoped skill** (the lab as a live CC project; `.claude/skills → ../cells`) before it can
  reach `graduation-ready` — no separate plugin install. *(Amended 2026-06-22 — see ADR-032.)*

## The pipeline & "extreme" pressure-testing

Stages (a cell advances by updating `stage:`): `develop → review → pressure-test → refine (loop) →
graduation-ready → graduated`.

The **pressure-test** stage is the emphasized pillar. It stacks multiple independent lenses on a
candidate, and the cell only advances when it survives the stack **against its pre-declared bar**:

1. the cell's own declared evals (trigger accuracy, behavioral);
2. `evals-lab`'s general battery (via the seam);
3. an adversarial/GAN loop;
4. a `doubt-driven` adversarial review;
5. real-task dogfooding in the installed runtime.

`refine` loops back to `pressure-test` until the bar is met — never a subjective "looks good enough."

## The graduation gate (output contract — LOCKED)

A cell graduates only when **all three** objective criteria pass. Each is pass/fail or presence — never
a taste judgment (honors ADR-009 objective-gate doctrine):

1. **Integrity** — frontmatter valid, files parse, no dead refs, hooks exit 0 on a smoke test, no
   secrets.
2. **Declared evals pass** — the `evals-lab` scorecard meets the `graduation_criteria` the cell declared
   up front (eval-first ⇒ the bar is falsifiable and pre-committed, not in-the-moment taste).
3. **Intake justification present** — the ADR-008 membership record exists (presence checked, quality
   not judged).

Taste/quality observations are surfaced as **warnings**, never blockers. The gate is the lab's analog of
the still-unbuilt `nxtlvl:audit`. On pass, the capability promotes by an **in-repo `git mv`** straight to
its `target:` under `plugins/nxtlvl/` — the lab already lives under `sandbox/`, so there is no
intermediate hop — with its `evals/` traveling alongside the capability.

## Lab↔evals-lab seam (provisional — constrains the later evals-lab design)

The cell declares its evals in a **shared format**; the lab hands that spec to `evals-lab`'s engine and
receives a **scorecard**; the graduation gate reads the scorecard. The interface contract is:

```
{ eval spec } ──→ evals-lab engine ──→ { scorecard }
```

This single contract is what keeps the two repos decoupled. This spec fixes only the *shape*
(`spec in → scorecard out`); the concrete schema is co-designed with the `evals-lab` cycle. Until that
engine exists, the seam may be backed by a stub that returns a scorecard in the agreed shape.

## Boundaries

- **Always:** declare `graduation_criteria` *before* building a cell (eval-first); keep `stage` as
  manifest data; treat `vendor/` as read-only (change only via the documented re-sync); ensure a cell's
  `evals/` travel with it on graduation; keep gate criteria objective.
- **Ask first:** changing the three graduation-gate criteria; changing the lab↔evals-lab seam contract;
  adding a new cell `type`; re-syncing the vendored snapshot; retiring `sandbox/`'s staging role.
- **Never:** hand-edit `vendor/`; graduate a cell that fails any of the three gate criteria; commit
  secrets; encode taste as a *blocking* gate criterion; let a script crash masquerade as a deliberate
  block.

## Success Criteria

- [x] A cell can be scaffolded, advanced through stages (manifest updates), and `ledger.md` reflects it.
      *(`pointer-summary` walked develop → pressure-test → graduation-ready → graduated.)*
- [x] `graduate` blocks a cell that fails each of the three criteria (one regression test each) and
      passes a clean cell — proven by `node --test 'bin/*.test.js'` (63 green; gate doubt-reviewed).
- [ ] A candidate skill is invocable in-session as a **project skill** and dogfooded on a real task
      (the lab as a live CC project; `.claude/skills → ../cells`). *(MANUAL — owned by the user: work
      with the lab as your project dir and exercise the cell. Amended 2026-06-22 from the
      install-as-plugin design — see ADR-032.)*
- [x] One capability graduates end-to-end: `cell → plugins/nxtlvl/<type>/` with its `evals/` carried
      along. *(`pointer-summary` → `plugins/nxtlvl/skills/pointer-summary/` with `evals/cases.yaml`.)*
- [x] The lab↔evals-lab seam is exercised by at least one cell (stub engine acceptable) returning a
      scorecard the gate reads. *(`npm run eval -- pointer-summary` → 2/2; the gate read the scorecard.)*
- [x] `vendor/SOURCES.md` records every vendored item's source + SHA and a runnable re-sync procedure.

## Open Questions

- ~~Exact repo root path~~ — **RESOLVED 2026-06-22; RELOCATED 2026-06-28:** now
  `Developer/nxtlvl-labs/harness-lab/`, in the standalone `nxtlvl-labs` repo (sibling of the nxtlvl
  repo) beside `evals-lab/`. Originally lived as a tracked subdir under the harness repo's
  `sandbox/nxtlvl-labs/`; moved out to its own repo on 2026-06-28.
- The concrete shared **eval spec / scorecard schema** — co-designed with the `evals-lab` cycle; this
  spec fixes only the interface shape.
- ~~Whether the installable-plugin uses the local-marketplace mechanism~~ — **RESOLVED/REVERSED
  2026-06-22:** the lab is **not** a standalone plugin; in-flight cells dogfood as **project skills**
  (`.claude/skills → ../cells`). See ADR-032 amendment.
- Re-sync cadence/trigger for the vendored snapshot (on-demand vs. periodic).

## Decisions to record as ADRs (after this spec is approved)

Per the decision rule (`~/.claude/rules/decisions.md`), record after spec+plan — each is architectural
and expensive to reverse. Verify ADR numbering against the committed/remote tree first (collision
hazard); next is ~ADR-031.

1. **Labs topology** — the incubation lab (`harness-lab`) and the standing measurement
   instrument (`evals-lab`) live in the standalone `nxtlvl-labs` repo at `Developer/nxtlvl-labs/`
   (a sibling of the nxtlvl repo); a cell graduates by `git mv` into the `nxtlvl` plugin in the
   harness repo. *(Originally incubated as tracked subdirs under the harness repo's `sandbox/` per the
   2026-06-22 relocation away from the separate-`~/agent-lab`-repo design; moved out to its own
   `nxtlvl-labs` repo on 2026-06-28.)*
2. **Cells + stage-as-data architecture** — capability cells with stage-as-data manifests; in-flight
   cells dogfooded as **project skills** (the lab as a live CC project), *not* as a standalone plugin.
   *(ADR-032, with its 2026-06-22 amendment reversing the original installable-as-plugin half.)*
3. **Three-part objective graduation contract** — integrity + declared-evals + intake-justification;
   taste warns only.
