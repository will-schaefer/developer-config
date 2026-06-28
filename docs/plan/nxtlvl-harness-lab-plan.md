# Implementation Plan: `harness-lab` — the agent-capability incubation pipeline

> SDD Phase: **Plan**. Implements the spec
> [`docs/spec/nxtlvl-harness-lab.md`](../spec/nxtlvl-harness-lab.md) (DRAFT → approve before build).
> 🤖 = agent-verifiable · 🧑 = manual gate · ◇ = decision to lock at plan review.
> **Status: BUILT (2026-06-22).** T1–T11 implemented & verified (63 node:test green; gate
> doubt-reviewed); T13 graduation of the `pointer-summary` cell done (→ `plugins/nxtlvl/skills/`).
> T12 live install + dogfood is the one remaining manual step (agent cannot run `/plugin`).**

---

## 1. Framing

The spec defines a workspace in the **standalone `nxtlvl-labs` repo** (`harness-lab`, ships as `nxtlvl:harness-lab`)
living at `Developer/nxtlvl-labs/harness-lab/` — a sibling of the nxtlvl repo, fully off its discovery path, beside its
sibling `evals-lab/`. It is the upstream-most tier of the promotion ladder:
`harness-lab → nxtlvl plugin → installed ~/.claude`. This plan orders the build of that workspace's
skeleton, its three machinery scripts (`new-cell`, `ledger`, `graduate`), the evals-lab seam **stub**, the
installable-plugin wiring, and one capability graduated end-to-end into `plugins/nxtlvl/` via in-repo
`git mv`. *(Home relocated 2026-06-22 from the original `~/agent-lab` separate-repo design; see ◇ D1.)*

Three constraints shape every task:

- **The gate is the keystone.** `graduate.js` is the lab's analog of the still-unbuilt `nxtlvl:audit`.
  It blocks on **three objective criteria** and warns (never blocks) on taste, with a strict exit-code
  contract (`exit 2` = deliberate block, `exit 0` = pass, a crash must **never** masquerade as a block).
  It is **regression-locked** the same way the dangerous-bash gate was — one test per criterion proving
  block-a-bad-cell and pass-a-clean-cell, plus a crash-fails-open test.
- **Stage is data, never location** (spec). The machinery is built around a single shared
  `manifest.yaml` contract; cells never move directories as they mature. So the dependency graph is
  **foundation-first** (shared manifest module → the scripts that read/write it), not vertically sliced.
- **A real manual seam exists.** The agent cannot run `/plugin` install or observe a scratch-profile
  dogfood — install + dogfood remain the manual gates. The old `~/agent-lab` **sandbox-write-allowlist
  problem is gone**: the lab now lives under `Developer/nxtlvl-labs/`, inside the write-allowlist, so every
  build step runs sandboxed (no `dangerouslyDisableSandbox`).

---

## 2. Architecture decisions (plan-level — surfaced for review)

- **A self-contained Node subproject with its own `package.json`.** Unlike the in-plugin builds
  (`plugins/nxtlvl/lib/*`), `harness-lab` carries its own `package.json`, `npm run` scripts (`eval` /
  `graduate` / `ledger`), and `node:test` — matching the spec's Commands section — but it is **tracked
  within the `Developer` repo**, sharing its git history rather than running a separate `git init`.
- **One shared manifest module is the contract.** `bin/lib/manifest.js` (pure: `text → parsed manifest`
  + `validate(manifest) → {errors,warnings}`) is the single source the three scripts depend on. Keeping
  it pure and total (never throws) makes it trivially unit-testable, mirroring the PM `plan-parser.js`
  split.
- **The evals-lab seam ships as a stub now.** `evals-lab` is a later cycle (spec §Lab↔evals-lab seam).
  This plan builds only the **interface shape** (`{eval spec} → engine → {scorecard}`) backed by a
  deterministic stub. `graduate.js` reads the scorecard; it does not know the engine is a stub.
- **Two failure paths, two rules** (house hook-safety doctrine) apply to `graduate.js`: a script
  *erroring* fails open (exit 0, do nothing); a script *deciding to block* is a clean exit 2.
- **Pointers over dumped content** in `ledger.md` and all gate output — reference `path:line`, never
  paste blocks.

### ◇ Decisions — LOCKED at plan review (2026-06-21)

| ◇ | Decision | Resolution |
|---|----------|------------|
| **D1** | Lab home path + topology | **RE-LOCKED 2026-06-22; RELOCATED 2026-06-28: `Developer/nxtlvl-labs/harness-lab/`** — now in the standalone `nxtlvl-labs` repo (sibling of the nxtlvl repo, beside `evals-lab/`). Originally a tracked subdir under the harness repo's `sandbox/nxtlvl-labs/` (2026-06-22, superseding the earlier `~/agent-lab` lock); moved out to its own repo on 2026-06-28. |
| **D2** | **YAML parsing strategy** — `manifest.yaml` needs a parser; Node has none built in, and the nxtlvl house style is zero-dep. | **LOCKED: pin `js-yaml`** in the lab's own `package.json`. `harness-lab` is a self-contained Node subproject with its own `package.json` (distinct from the plugin), so a single controlled, pinned dep is acceptable and round-trips cleanly for `new-cell` writes + `graduate`/`ledger` reads. |
| **D3** | Vendored-snapshot re-sync cadence (on-demand vs periodic) | **LOCKED: on-demand only**, triggered by the documented `vendor/SOURCES.md` procedure; no scheduler. |

---

## 3. Dependency graph

```
Phase 0  DECISIONS & PRE-FLIGHT (no machinery code)
  T1  Record ADR-031/032/033  (verify numbering vs remote FIRST)        🤖
  T2  Confirm .claude-plugin/ manifest shape + install cmd vs live docs 🤖
        │
Phase 1  REPO SKELETON + MANIFEST CONTRACT (foundation)
  T3  Scaffold Developer/nxtlvl-labs/harness-lab: tree · package.json ·   🤖(sandboxed)
      README · docs/ · seed inbox.md · empty ledger.md · vendor/SOURCES.md stub
        │
  T4  manifest.yaml schema + bin/lib/manifest.js (parse + validate) + tests
        │
        ├───────────────┬───────────────┬───────────────┐
Phase 2  MACHINERY (each a unit + tests; graduate is the keystone)
  T5 ledger.js        T6 new-cell.js    T7 evals-lab seam STUB
  (manifests→ledger)  (--type scaffold) (spec→scorecard, agreed shape)
        │                   │                   │
        └───────────────────┴─────────┬─────────┘
                                       ▼
  T8  graduate.js — 3 objective blockers + taste-warnings + exit 0/2,
      REGRESSION-LOCKED (block-bad + pass-clean per criterion)          🤖
        │
Phase 3  VENDOR · DOGFOOD · GRADUATE ONE CELL END-TO-END
  T9  vendor/ snapshot + SOURCES.md (source+SHA+re-sync)   [dep T3]      🤖
  T10 .claude-plugin/ manifest + .claude/ project wiring   [dep T2,T3]  🤖
  T11 scaffold a real sample cell (eval-first), advance stages,         🤖
      run graduate locally → pass   [dep T6,T7,T8]
        │  ── Checkpoint: node --test 'bin/*.test.js' green; gate proven
  T12 install as plugin in scratch profile + dogfood on a real task     🧑  [dep T10,T11]
  T13 graduate end-to-end → nxtlvl plugin with evals carried            🧑🤖 [dep T12]
```

**Critical path:** `T3 → T4 → T7 → T8 → T11 → T12 → T13`. T5/T6/T9/T10 are off-path and parallelizable.

---

## 4. Phases & tasks

Sizes: XS (<30 min) · S (~1 hr) · M (~half day). Each task is an independently-verifiable slice.

### Phase 0 — Decisions & pre-flight (no machinery code)

#### T1 — Record the three ADRs *(S, 🤖)*
- **Steps:** Via `nxtlvl:doc-keeper`, record the three architectural decisions the spec names: (1)
  labs topology (incubation `harness-lab` vs standing `evals-lab`, both in the standalone `nxtlvl-labs`
  repo at `Developer/nxtlvl-labs/`), (2) cells + installable-as-plugin
  architecture (stage-as-data manifests), (3) the three-part objective graduation contract. **Verify
  ADR numbering against the committed/remote tree first** (collision hazard — memory: doc-keeper globs
  the working tree); spec proposes ~031–033.
- **Acceptance:** three ADRs exist in `Developer/docs/decisions/` in house format (frontmatter + Context
  · Decision · Alternatives · Consequences), README index updated, no numbering gap/dup, cross-linked.
- **Verify (agent):** `ls docs/decisions/ADR-03*.md`; frontmatter parses; README table row per ADR;
  numbers unique against `git ls-tree -r origin/main --name-only docs/decisions/`.
- **Depends on:** plan approval + ◇ D1–D3 locked.

#### T2 — Confirm the plugin-manifest shape against live docs *(XS, 🤖)*
- **Steps:** The spec forbids relying on memory for the `.claude-plugin/` manifest + local-marketplace
  install command. Confirm both against **current** CC docs (via `claude-code-guide` and/or
  `nxtlvl:context7`). Capture the confirmed shape as a short note for T10 (in the lab's `docs/`).
- **Acceptance:** confirmed `.claude-plugin/plugin.json` field shape + the exact local-marketplace
  install/update command, sourced (not from memory).
- **Verify (agent):** the note cites a doc URL/source for each claim; T10 consumes it.
- **Independent of T1** — can run in parallel.

### Phase 1 — Repo skeleton + manifest contract (foundation)

#### T3 — Scaffold the `harness-lab` workspace *(M, 🤖 — sandboxed; writes under `Developer/nxtlvl-labs/`)*
- **Steps:** At the locked path (D1, `Developer/nxtlvl-labs/harness-lab/`): create the spec's tree (`cells/`,
  `vendor/`, `bin/`, `docs/`, `.claude/`, `.claude-plugin/`); `package.json` with `scripts` for
  `eval`/`graduate`/`ledger` + `node --test 'bin/*.test.js'`; `README.md`; `docs/` lab-process stubs;
  **seed `inbox.md` once** from the Developer backlogs (`docs/plan/nxtlvl-skill-intake-backlog.md`,
  `…-harness-adopt-backlog.md` — pointers, not copies); empty `ledger.md`; `vendor/SOURCES.md` skeleton.
  **No `git init`** — the workspace is tracked by the surrounding `Developer` repo.
- **Acceptance:** the tree matches the spec §Project Structure; `package.json` scripts present; the
  workspace is populated under `Developer/nxtlvl-labs/harness-lab/` and shows up in `git status` (tracked by
  the `nxtlvl-labs` repo).
- **Verify (agent):** `ls -R Developer/nxtlvl-labs/harness-lab` matches the spec tree;
  `node -e "require('./harness-lab/package.json')"` (from the `nxtlvl-labs` repo root); `git status --short` lists the new
  files under that path.
- **Depends on:** D1 locked. **Files:** workspace skeleton (many, but all scaffold). **Scope:** M.

#### T4 — `manifest.yaml` schema + `bin/lib/manifest.js` + tests *(M, 🤖)*
- **Steps:** Fix the `manifest.yaml` field schema from the spec (name · type · stage · intent · intake ·
  graduation_criteria · deps · target). Write `bin/lib/manifest.js`: pure `parse(text) → manifest` and
  `validate(manifest) → {errors[], warnings[]}` (total — never throws; malformed → errors, not crash).
  Per D2, YAML parsing via the locked strategy.
- **Acceptance:** `validate` flags missing required fields, an unknown `type`, an unknown `stage`, and a
  missing `intake` (the ADR-008 presence check the gate later reuses); valid manifest → no errors.
- **Verify (agent):** `node --test bin/lib/manifest.test.js` — cases for each missing field, bad
  type/stage, valid manifest, and a malformed-YAML-doesn't-throw case.
- **Depends on:** T3, D2. **Files:** `bin/lib/manifest.js`, `…test.js`, schema note. **Scope:** M.

### Phase 2 — Machinery (each a unit + tests; `graduate` is the keystone)

#### T5 — `bin/ledger.js` — regenerate `ledger.md` from all manifests *(S, 🤖)*
- **Steps:** Read every `cells/*/manifest.yaml` via `manifest.js`, emit `ledger.md`: one row per cell
  (name · type · **stage** · target), **pointers not content**. `npm run ledger` wraps it.
- **Acceptance:** running it on a fixture cell-set produces a deterministic `ledger.md`; no cell content
  is pasted (only `cells/<name>/manifest.yaml` pointers).
- **Verify (agent):** `node --test bin/ledger.test.js` against a `__fixtures__/` cell-set; golden
  `ledger.md` match; `npm run ledger` exits 0.
- **Depends on:** T4. **Files:** `bin/ledger.js`, `…test.js`. **Scope:** S.

#### T6 — `bin/new-cell.js` — scaffold a cell from `--type` *(M, 🤖)*
- **Steps:** `node bin/new-cell.js <name> --type=skill|agent|command|hook` creates
  `cells/<name>/` with a starter `manifest.yaml` (stage `develop`, **empty `graduation_criteria` the
  author must fill eval-first**, `intake` placeholder), an empty `evals/`, `run.md`, and a type-correct
  capability stub. Validates name/type; refuses to clobber an existing cell.
- **Acceptance:** each `--type` yields the right stub; the manifest validates (T4) except for the
  author-owed fields; rerun on an existing name refuses (exit non-zero, no overwrite).
- **Verify (agent):** `node --test bin/new-cell.test.js` — one case per type, the clobber-refusal, and
  `validate()` passing on the scaffold modulo author-owed fields (write into `$TMPDIR`).
- **Depends on:** T4. **Files:** `bin/new-cell.js`, `…test.js`. **Scope:** M.

#### T7 — evals-lab seam **stub** — `{eval spec} → {scorecard}` *(S, 🤖)*
- **Steps:** Define the **shared eval-spec + scorecard shape** (the seam contract the spec fixes only by
  shape) and document it in the lab `docs/`. Build `bin/eval.js` (backing `npm run eval -- <cell>`): read
  the cell's declared evals, hand them to a **deterministic stub engine**, return/write a scorecard in
  the agreed shape. The stub stands in until the real `evals-lab` engine exists.
- **Acceptance:** `npm run eval -- <cell>` emits a scorecard matching the documented schema; the schema
  is recorded as the seam contract; `graduate.js` (T8) can read it without knowing it's a stub.
- **Verify (agent):** `node --test bin/eval.test.js` — scorecard shape conforms; deterministic output;
  contract doc states the `spec in → scorecard out` shape.
- **Depends on:** T4. **Files:** `bin/eval.js`, `…test.js`, seam-contract doc. **Scope:** S.

#### T8 — `bin/graduate.js` — the objective gate (keystone) *(M, 🤖)*
- **Steps:** Implement the three-blocker gate from the spec, exit-code contract enforced:
  1. **Integrity** — frontmatter valid, files parse, no dead refs, hooks exit 0 on a smoke test, no
     secrets.
  2. **Declared evals pass** — read the T7 scorecard; compare against the cell's `graduation_criteria`.
  3. **Intake present** — ADR-008 membership record exists (presence, not quality — reuses T4 check).
  Taste/quality observations → `warnings` on stderr, **never** a blocker. `if (blockers) exit 2; else
  exit 0`. Any thrown error is caught and **fails open** (exit 0), never a fake block.
- **Acceptance:** a clean cell → exit 0 (warnings allowed); a cell failing **any** one criterion → exit
  2 with that blocker named; an induced crash → exit 0 (never 2).
- **Verify (agent):** `node --test bin/graduate.test.js` — **regression-locked**: one block-bad +
  pass-clean pair per criterion (3 pairs), a taste-only-warns case, and a crash-fails-open case
  (dangerous-bash-gate discipline). `node --test 'bin/*.test.js'` green overall.
- **Depends on:** T4, T7. **Files:** `bin/graduate.js`, `…test.js`. **Scope:** M.

#### Checkpoint — Machinery (🤖)
- [ ] `node --test 'bin/*.test.js'` green (manifest, ledger, new-cell, eval, graduate).
- [ ] `graduate` proven to block on each of the 3 criteria and pass a clean cell (spec Success Criterion 2).
- [ ] `ledger` reflects scaffolded cells; `new-cell` scaffolds each type.

### Phase 3 — Vendor · dogfood · graduate one cell end-to-end

#### T9 — Vendor the authoring toolkit + `SOURCES.md` *(S, 🤖)*
- **Steps:** Snapshot `agent-dev`, `skill-creator`, `plugin-dev`, `harness-review` into read-only
  `vendor/`; complete `vendor/SOURCES.md` with each item's source repo + pinned SHA + a runnable re-sync
  procedure (D3: on-demand). Treat `vendor/` as read-only thereafter (an "ask first"/"never hand-edit"
  boundary).
- **Acceptance:** each vendored item present; `SOURCES.md` records source + SHA + re-sync steps for each
  (spec Success Criterion 6).
- **Verify (agent):** `SOURCES.md` has a row per vendored dir with a resolvable SHA; the re-sync
  procedure is a concrete command sequence.
- **Depends on:** T3. **Files:** `vendor/*` (snapshot) + `SOURCES.md`. **Scope:** S.

#### T10 — Project-skills dogfood wiring *(S, 🤖)* — **AMENDED 2026-06-22**
> **Amendment:** the lab is **not** a standalone plugin. The `.claude-plugin/plugin.json` + local
> marketplace originally built here were **removed**; replaced by `.claude/skills → ../cells` so
> skill-type cells are dogfooded as **project skills** (no install, no marketplace). See ADR-032.
- **Steps (as amended):** Create the `.claude/skills → ../cells` symlink so each `cells/<name>/SKILL.md`
  is auto-discovered as the project skill `/<name>` when the lab is the working dir. (Verified CC
  project-skills mechanics against live docs: fixed `.claude/skills/` location, no settings override,
  symlinks followed.)
- **Acceptance:** manifest matches the T2-confirmed shape and validates; `.claude/` makes cells
  discoverable in a live session.
- **Verify (agent):** `plugin-dev:plugin-validator` (or equivalent) passes; manifest is valid JSON with
  the confirmed fields.
- **Depends on:** T2, T3. **Files:** `.claude-plugin/plugin.json`, `.claude/` config. **Scope:** S.

#### T11 — Scaffold + advance one real sample cell, gate it locally *(M, 🤖)*
- **Steps:** Use `new-cell` to scaffold a genuine candidate capability; **declare its
  `graduation_criteria` eval-first** (before building it); build it; run `npm run eval` (stub seam) and
  `npm run graduate` locally → expect pass. Advance `stage:` through `develop → … → graduation-ready`,
  regenerating `ledger.md` at each step.
- **Acceptance:** the cell exists with eval-first criteria, passes the local gate, and `ledger.md`
  tracks its stage transitions (spec Success Criteria 1 + 5).
- **Verify (agent):** `npm run graduate -- <cell>` exits 0; a deliberately-broken copy exits 2;
  `ledger.md` shows the advanced stage.
- **Depends on:** T6, T7, T8. **Files:** `cells/<sample>/*`. **Scope:** M.

#### T12 — Dogfood as a project skill *(S, 🧑)* — **AMENDED 2026-06-22**
- **Steps (as amended):** Work with `harness-lab` as your project directory so its cells load as
  project skills (via `.claude/skills → ../cells`); exercise the sample cell on a real task. No
  `/plugin` install — the lab is not a standalone plugin. (For a cell that has already graduated into
  `plugins/nxtlvl/`, dogfood it via the nxtlvl plugin instead.)
- **Acceptance:** the candidate is invocable from the installed plugin and behaves on a real task
  (spec Success Criterion 3 — dogfooding demonstrated end-to-end).
- **Verify:** manual — user installs, invokes, reports back.
- **Depends on:** T10, T11.

#### T13 — Graduate the cell end-to-end *(S, 🧑🤖)*
- **Steps:** Run the gate; on pass, promote the capability by a **cross-repo `git mv`** from
  `Developer/nxtlvl-labs/harness-lab/cells/<cell>/…` (in the `nxtlvl-labs` repo) straight to its `target:` under `plugins/nxtlvl/<type>/` (in the nxtlvl repo),
  **carrying its `evals/` alongside**. (The lab already lives under `sandbox/`, so there is no
  intermediate hop.) Mark the spec built; confirm the three ADRs (T1) cover it (no new ADR).
- **Acceptance:** the capability lands under `plugins/nxtlvl/<type>/<name>/` with its `evals/` (spec
  Success Criterion 4); spec status → built.
- **Verify:** 🤖 `ls plugins/nxtlvl/<type>/<name>/evals/` shows the carried evals; 🧑 user confirms the
  promote; spec marked built.
- **Depends on:** T12.

---

## 5. Verification summary — who runs what

| Check | 🤖 | 🧑 |
|-------|:--:|:--:|
| ADR-031/032/033 recorded, numbering verified vs remote (T1) | ✅ | |
| Plugin-manifest shape confirmed vs live docs (T2) | ✅ | |
| Workspace tree matches spec; tracked by Developer (no separate init) (T3) | ✅ | |
| `manifest.js` validate/parse total + tested (T4) | ✅ | |
| `ledger.js` golden output, pointers-only (T5) | ✅ | |
| `new-cell.js` per-type scaffold + clobber-refusal (T6) | ✅ | |
| Seam stub emits agreed-shape scorecard (T7) | ✅ | |
| `graduate.js` blocks each criterion, passes clean, crash→exit 0 (T8) | ✅ | |
| `vendor/SOURCES.md` source+SHA+re-sync per item (T9) | ✅ | |
| `.claude-plugin/` manifest validates (T10) | ✅ | |
| Sample cell gated locally; ledger tracks stages (T11) | ✅ | |
| Install as plugin + dogfood on a real task (T12) | | ✅ |
| Capability graduates to `plugins/nxtlvl/` with evals (in-repo `git mv`) (T13) | ✅ | ✅ |

---

## 6. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| In-flight cells get auto-loaded/routed by the live plugin | Low | the `nxtlvl-labs` repo is a separate tree entirely, fully off the plugin's discovery path; cells are invoked only via the lab's own `.claude/` or an explicit dogfood install. *(The earlier "`~/agent-lab` outside the sandbox write-allowlist" risk was eliminated by the 2026-06-22 move into `Developer/sandbox/`; the lab now lives in its own `Developer/nxtlvl-labs/` repo as of 2026-06-28.)* |
| YAML parsing strategy unresolved (zero-dep house style vs `manifest.yaml`) | Med | ◇ D2 locked at review; if `js-yaml`, pin it in the lab's own `package.json` (an SDD "ask first" item). |
| A `graduate` **crash masquerades as a block** (false exit 2) | High | Exit-code contract + a dedicated crash-fails-open test (T8); honors the spec's two-failure-paths rule. |
| ADR **numbering collision** (doc-keeper globs the working tree) | Med | T1 verifies numbers against the committed/remote tree before assigning (memory: adr-numbering-collision-hazard). |
| Seam stub silently drifts from the real `evals-lab` schema later | Med | T7 records the seam contract as the **shared shape**; `evals-lab` cycle co-designs the concrete schema against it; changing the seam is an "ask first" boundary. |
| Vendored snapshot rots vs upstream | Low | `SOURCES.md` SHAs + on-demand re-sync (D3); `vendor/` is read-only by boundary. |
| Scope creep — building `evals-lab` here | Med | Out of scope (spec); only the seam **stub** is in this plan. |

---

## 7. Open questions / deferred

- **Concrete eval-spec / scorecard schema** — co-designed with the `evals-lab` cycle; this plan fixes
  only the interface shape (stub-backed).
- **`evals-lab` itself** — a later cycle; not built here.
- **Re-sync cadence** beyond on-demand (D3) — revisit if drift becomes a problem.

## 8. Plan-level verification (before implementation)
- [x] Every task has acceptance criteria + a verification step.
- [x] Dependencies identified and ordered foundation-first (manifest contract → scripts → dogfood).
- [x] No task touches more than ~5 files (T3 is scaffold-only).
- [x] Checkpoints between phases (machinery checkpoint; the gate is regression-locked).
- [x] 🤖/🧑 seam explicit; all build steps sandboxed (lab now inside the write-allowlist).
- [x] ◇ D1–D3 locked (D1 **re-locked 2026-06-22; relocated 2026-06-28**): `Developer/nxtlvl-labs/harness-lab` · pin `js-yaml` ·
      on-demand re-sync.
- [x] Human has reviewed and approved this plan. *(Approved 2026-06-22; implemented T1–T13 except the
      T12 manual install/dogfood, which is the user's.)*
