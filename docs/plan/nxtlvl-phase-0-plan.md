# Implementation Plan: `nxtlvl` Phase 0 — Minimum Viable Harness

> Planning artifact (SDD Phase: Plan). Consumes [`docs/spec/nxtlvl-phase-0-mvh.md`](../spec/nxtlvl-phase-0-mvh.md),
> which consumes [`docs/intent/personal-harness.md`](../intent/personal-harness.md).
> Produced by `planning-and-task-breakdown`, 2026-06-16. **Status: DRAFT — awaiting human review before implementation.**

## Overview

Build the thinnest end-to-end slice that runs one real session on `nxtlvl` (a Claude Code plugin
installed via a local marketplace), then thicken to the seven Phase-0 contents. The plugin packaging
is **table-stakes** (stand up once in M0, freeze); the real budget is M1–M7: layered config, build
loop, memory, context-injection, three workflow scaffolds, fail-open hook layer, and the fallback log
+ metric baseline.

This plan turns the spec's eight milestones (M0–M7) into **16 ordered, vertically-sliced tasks** with
acceptance criteria, verification, and dependencies. The spec already vertical-slices via the
walking-skeleton method (M0 ships thin slices of #1/#5/#6/#7; later milestones thicken them), so the
phases below preserve milestone boundaries.

## Ground-state findings (verified 2026-06-16)

- **Greenfield.** No `plugins/`, no `.claude-plugin/`, no `~/.claude/CLAUDE.md`, no `~/.claude/nxtlvl/`.
  Everything is net-new **except** native memory (live at `~/.claude/projects/-Users-willschaefer-Developer/memory/`)
  and `.claude/settings.local.json` (pre-existing).
- **Composition targets present.** `agent-skills` installed (marketplace `addy-agent-skills`):
  `agent-skills:review`, `:spec`, `:plan`, `:build`, `:test` all invokable. `deep-research` is a
  top-level skill (structural reference for M5 research). ecc marketplace present; ecc plugin already
  **dormant** via `enabledPlugins."ecc@ecc": false` (Resolved Decision 5 — done).
- **Structural reference.** `reference/ECC-main/hooks/hooks.json` shows the stdin-parse + fail-open
  pattern (node-based). The spec deliberately chooses POSIX shell + `python3` — simpler; follow the spec.

## Architecture Decisions

- **Vertical slicing via walking skeleton.** M0 is the first complete slice (manifest + one skill + one
  hook + install = a working session). Each later milestone is a thin vertical addition that leaves the
  system installable and runnable.
- **Fail-fast on the highest risk.** The stdin-field unknown (which `tool_input` field carries the
  invoked `Skill`/`Task` name) gates the entire north-star metric. Its spike is **Task 5, inside M0** —
  resolved before anything in M7 is built.
- **Incremental hook wiring (recommended).** Each hook event is wired in `hooks.json` only when its
  script lands: `PreToolUse`→M0, `SessionStart`→M4, `SessionEnd`→M6. This keeps every milestone in a
  working state and avoids referencing not-yet-existing scripts. (Alternative: wire all three at M0
  with `exit 0` stubs — see Open Question 2.)
- **`~/.claude/CLAUDE.md` is config authoring, not a boundary violation.** The "never hand-edit
  `~/.claude`" rule targets bypassing the marketplace install of the *plugin*; authoring the global
  `CLAUDE.md` config layer (M1) and letting hooks write `~/.claude/nxtlvl/*.jsonl` (M7) are expected.
- **Manual gates are explicit.** `/plugin …` install and `/nxtlvl:*` invocation only work from an
  interactive `claude` session — the agent cannot run them. Those tasks are marked **[MANUAL]**; the
  user runs them and reports the binary result. Scriptable checks (`json.load`, shell fail-open,
  fault-injection) the agent runs directly.

## Dependency Graph

```
T1 manifests ─┬─ T2 review skill ──────────┐
              ├─ T3 hooks.json + fallback-log.sh (spike branch) ─┬─ T4 install+smoke [MANUAL]
              │                                                   └─ T5 stdin SPIKE [MANUAL] ── gates ─▶ T12/T13
              ├─ T7 dev skill ──────────────┐
              └─ T10 research skill ─────────┼─ T11 three-workflow integration [MANUAL]
                                             │
T6 layered config (global+project CLAUDE.md) │  (independent — can run parallel to M0)
T8 memory layering + recall (native; no code)│  (surfacing half soft-depends on T9)
T3 ─ T9 session-context.sh + SessionStart wiring
T5,T9 ─ T12 thicken fallback-log + session-metrics.sh + SessionEnd wiring + fault-injection
T12 ─ T13 fallback-log exactly-one-line ─ T14 sessions.jsonl + dual metric
(all) ─ T15 full real session, ecc dormant ─ T16 promotion tag + rollback rehearsal
```

Implementation order follows the spec's sequencing: **M0 first** (envelope + spike), then **M1→M4**
(high-leverage reconstruction), then **M5** (thicken workflows), **M6** (harden hooks), **M7** (turn on
the metric), then integration + promotion.

---

## Task List

### Phase M0 — Walking skeleton (the vertical slice)

#### Task 1: Plugin + marketplace manifests
**Description:** Create the minimal plugin manifest and the repo-root local marketplace so the plugin is installable.
**Acceptance criteria:**
- [ ] `plugins/nxtlvl/.claude-plugin/plugin.json` exists with `name: "nxtlvl"`, `version: "0.0.1"`, `description`.
- [ ] `.claude-plugin/marketplace.json` (repo root) exists with `name: "nxtlvl-dev"`, `owner.name`, and a `plugins[]` entry `source: "./plugins/nxtlvl"`.
**Verification:**
- [ ] `python3 -c "import json; json.load(open('.claude-plugin/marketplace.json'))"` (exit 0)
- [ ] `python3 -c "import json; json.load(open('plugins/nxtlvl/.claude-plugin/plugin.json'))"` (exit 0)
**Dependencies:** None
**Files:** `.claude-plugin/marketplace.json`, `plugins/nxtlvl/.claude-plugin/plugin.json`
**Scope:** S

#### Task 2: `nxtlvl:review` skill (composes `agent-skills:review`)
**Description:** First workflow skeleton — composes the agent-skills five-axis review, refined for nxtlvl conventions (language-plural reviewer, surface assumptions, pointers over content).
**Acceptance criteria:**
- [ ] `plugins/nxtlvl/skills/review/SKILL.md` has valid YAML frontmatter (`description`) and a body that invokes `agent-skills:review` on the current diff, passing `$ARGUMENTS`.
- [ ] Body composes (does not copy/reconstruct) the agent-skills skill.
**Verification:**
- [ ] Frontmatter parses (python3 frontmatter extraction).
- [ ] **[MANUAL]** after install, `/nxtlvl:review` produces a report addressing all five named axes on a real diff (runs to completion, not a stub).
**Dependencies:** T1
**Files:** `plugins/nxtlvl/skills/review/SKILL.md`
**Scope:** S

#### Task 3: Fallback-log hook + `hooks.json` (PreToolUse) with spike branch
**Description:** The first piece of self-built machinery. A fail-open PreToolUse hook on `Skill|Task`, plus a toggleable debug branch that dumps raw stdin for the M0 spike.
**Acceptance criteria:**
- [ ] `plugins/nxtlvl/hooks/hooks.json` wires **only** `PreToolUse` (matcher `Skill|Task`) → `"${CLAUDE_PLUGIN_ROOT}"/hooks/fallback-log.sh`.
- [ ] `hooks/fallback-log.sh` is executable, reads stdin, and **always `exit 0`** with no decision output on any path (no `set -e`; explicit `exit 0`); creates `~/.claude/nxtlvl/` if missing.
- [ ] A debug branch (env-toggled, e.g. `NXTLVL_SPIKE=1`) writes raw stdin to `~/.claude/nxtlvl/spike-stdin.json` for Task 5.
**Verification:**
- [ ] `python3 -c "import json; json.load(open('plugins/nxtlvl/hooks/hooks.json'))"` (exit 0)
- [ ] `echo '{}' | bash plugins/nxtlvl/hooks/fallback-log.sh; echo $?` → `0` (fail-open smoke)
**Dependencies:** T1
**Files:** `plugins/nxtlvl/hooks/hooks.json`, `plugins/nxtlvl/hooks/fallback-log.sh`
**Scope:** M

#### Task 4: Install + run one real session  **[MANUAL]**
**Description:** Prove the envelope. Install via local marketplace and run the review workflow end-to-end.
**Acceptance criteria:**
- [ ] `/plugin marketplace add /Users/willschaefer/Developer` then `/plugin install nxtlvl@nxtlvl-dev` succeed with no error.
- [ ] `nxtlvl:review` is listed and runs one real session to completion.
**Verification:**
- [ ] **[MANUAL]** install output shows no error; `/nxtlvl:review` produces the five-axis report (Success Criteria 1, 3, 4).
**Dependencies:** T1, T2, T3
**Files:** none (install action)
**Scope:** S (manual)

#### Task 5: Stdin spike — confirm the invoked name is extractable  **[MANUAL — GATE for M7]**
**Description:** Resolve the one un-verified platform fact: which `tool_input` field carries the invoked `Skill`/`Task` name. Discovery can use **any** skill invocation (the field is the same regardless of prefix); confirming the literal `ecc:` prefix optionally needs one temporary, logged ecc re-enable (see OQ3).
**Acceptance criteria:**
- [ ] With `NXTLVL_SPIKE=1`, invoke a `Skill`/`Task`; `~/.claude/nxtlvl/spike-stdin.json` captures the raw stdin.
- [ ] The field holding the invoked name is identified and documented (update the spec's "Hook stdin → invoked name" row from GATED to verified).
**Verification:**
- [ ] **[MANUAL]** `cat ~/.claude/nxtlvl/spike-stdin.json` shows the invoked name in a named field; the extraction expression is recorded for T12/T13.
**Dependencies:** T3 (+ a Skill/Task invocation available)
**Files:** updates `docs/spec/nxtlvl-phase-0-mvh.md` (platform-facts row); records field in this plan.
**Scope:** S (manual)

### ✅ Checkpoint A — after M0 (Tasks 1–5)
- [ ] Manifests parse; plugin installs with no error.
- [ ] `nxtlvl:review` runs a real five-axis review to completion.
- [ ] Fallback-log hook exits 0 on smoke; spike resolves the stdin field (metric precondition met).
- [ ] **Human review before proceeding** — the envelope is frozen here.

---

### Phase M1 — Layered config (#1)

#### Task 6: Global + project `CLAUDE.md` with probe values
**Description:** Stand up the two config layers and prove they coordinate without collision.
**Acceptance criteria:**
- [ ] `~/.claude/CLAUDE.md` (global durable conventions) and `Developer/.claude/CLAUDE.md` (project conventions) both exist, each carrying a distinct observable probe line.
- [ ] A project-only value **and** a global-only value are both observable in one session.
**Verification:**
- [ ] Both files parse as markdown (non-empty, valid).
- [ ] **[MANUAL]** start a session; both probe values surface (Success Criterion 5).
**Dependencies:** None (independent of the plugin — may run parallel to M0)
**Files:** `~/.claude/CLAUDE.md`, `Developer/.claude/CLAUDE.md`
**Scope:** S

### Phase M2 — Build loop (#2)

#### Task 7: `nxtlvl:dev` skill (composes the `/spec → /plan → /build → /test → /review` loop)
**Description:** v1 composes (does not copy) the agent-skills build loop, refined for fit (language-plural reviewer, stop at each gate, pointers over content).
**Acceptance criteria:**
- [ ] `plugins/nxtlvl/skills/dev/SKILL.md` has valid frontmatter and a body composing the five stages.
- [ ] Each of the five stages is individually invokable through the skill.
**Verification:**
- [ ] Frontmatter parses.
- [ ] **[MANUAL]** after `/plugin marketplace update nxtlvl-dev`, drive one trivial change end-to-end through the five stages (Success Criterion 6).
**Dependencies:** T1
**Files:** `plugins/nxtlvl/skills/dev/SKILL.md`
**Scope:** S

### Phase M3 — Memory (#3)

#### Task 8: Layer native memory (global vs project) + recall proof — **no new store**
**Description:** Extend the existing native file-memory only: document the global-vs-project layering convention and surface it via the M4 context pointer; prove cross-session recall. Zero new storage code.
**Acceptance criteria:**
- [ ] A short convention note states what scope of fact lives where (global vs project native memory) and references the M4 pointer.
- [ ] A fact saved to native memory in one session is recalled in a fresh session via the native mechanism.
- [ ] **No new storage system / code** is introduced (verified by diff).
**Verification:**
- [ ] **[MANUAL]** save a fact, open a fresh session, confirm recall (Success Criterion 7).
- [ ] `git diff --stat` shows no new storage code — only a convention note.
**Dependencies:** None to save/recall; the *surfacing* half soft-depends on T9.
**Files:** a convention note (e.g. `docs/reference/memory-layering.md` or a `CLAUDE.md` section); **no code**.
**Scope:** S (mostly verification + one doc — flag: this milestone is deliberately near-zero-build)

### Phase M4 — Context-injection (#4)

#### Task 9: `session-context.sh` + wire `SessionStart`
**Description:** A budgeted SessionStart hook that injects a bounded **pointer** block; fail-open absolute.
**Acceptance criteria:**
- [ ] `plugins/nxtlvl/hooks/session-context.sh` emits, in priority order (cut lowest-value first if over budget): (1) git branch + dirty/clean flag, (2) current-task pointer (a *pointer*, never file content), (3) last N (default 3) fallback-log digest lines — all via `additionalContext`.
- [ ] Emits a one-line **`nxtlvl-router` entry pointer** (e.g. *"Non-trivial task? consult `nxtlvl:nxtlvl-router` to pick the skill"*). A meta-router cannot self-fire via its frontmatter description (measured: 0% recall across the desc-opt sweep; see [PR #15](https://github.com/will-schaefer/developer-config/pull/15)), so its discoverability **must** live in this floor brief, not its description — consistent with [ADR-003](../decisions/ADR-003-compose-not-reconstruct.md) ("reconstruct only the plumbing, never the orchestration"). Highest-priority block (never cut), pointer-only.
- [ ] Always `exit 0`, even on error; output never exceeds the token budget (OQ1 — propose ≤ ~300 tokens / ~20 lines).
- [ ] `hooks.json` adds the `SessionStart` entry.
**Verification:**
- [ ] `echo '{}' | bash plugins/nxtlvl/hooks/session-context.sh; echo $?` → `0`.
- [ ] Faulted body (e.g. point at a missing file) still exits 0.
- [ ] **[MANUAL]** start a session; the block is present, bounded, and pointer-only (Success Criterion 8).
**Dependencies:** T3 (hooks.json shape); reads fallback-log from T3/T13.
**Files:** `plugins/nxtlvl/hooks/session-context.sh`, `plugins/nxtlvl/hooks/hooks.json`
**Scope:** M

### Phase M5 — Workflow scaffolds (#5)

#### Task 10: `nxtlvl:research` skill (fresh skeleton)
**Description:** Built fresh (not composing ecc, which is dormant): web-search fan-out → fetch → verify → synthesize cited. `deep-research` is a structural reference only.
**Acceptance criteria:**
- [ ] `plugins/nxtlvl/skills/research/SKILL.md` has valid frontmatter and a built-skeleton body that does **not** compose ecc.
**Verification:**
- [ ] Frontmatter parses.
- [ ] **[MANUAL]** runs to completion on a real research question.
**Dependencies:** T1
**Files:** `plugins/nxtlvl/skills/research/SKILL.md`
**Scope:** S

#### Task 11: Integration — all three workflows invokable  **[MANUAL]**
**Description:** Confirm the composition layer's first concrete expression: review + dev + research all live.
**Acceptance criteria:**
- [ ] `nxtlvl:review`, `nxtlvl:dev`, `nxtlvl:research` are each invokable and each runs to completion on a real task.
**Verification:**
- [ ] **[MANUAL]** after reinstall, invoke each; all three complete.
**Dependencies:** T2, T7, T10
**Files:** none (integration check)
**Scope:** XS (manual)

### ✅ Checkpoint B — after M1–M5 (Tasks 6–11)
- [ ] Config layers coordinate (project + global value both observable).
- [ ] Build loop drives a trivial change end-to-end.
- [ ] A fact recalls across sessions via native memory; no new store.
- [ ] SessionStart hook injects a bounded pointer block and never halts.
- [ ] All three workflows invokable and complete.
- [ ] **Human review before proceeding.**

---

### Phase M6 — Hook layer hardening (#6)

#### Task 12: Thicken fallback-log + add `session-metrics.sh` + wire `SessionEnd` + fault-injection
**Description:** Finalize the fallback-log to append the real JSONL line (using the spike-confirmed field; disable the debug branch). Add the SessionEnd metrics hook. Prove fail-open under deliberate faults.
**Acceptance criteria:**
- [ ] `fallback-log.sh`: on an `ecc:`-prefixed Skill/Task, append one line `{timestamp, ecc_thing, task}` to `~/.claude/nxtlvl/fallback-log.jsonl`; non-ecc appends nothing; spike debug branch disabled by default.
- [ ] `session-metrics.sh`: on SessionEnd, append `{timestamp, session_id, ecc_fallback_count}` to `~/.claude/nxtlvl/sessions.jsonl`; always `exit 0`.
- [ ] `hooks.json` adds the `SessionEnd` entry. Every hook exits 0 under a deliberately faulted body; no session is blocked.
**Verification:**
- [ ] Fault-injection: break each hook's body (e.g. point at a missing file) → `echo '{}' | bash <hook>; echo $?` → `0` (Success Criterion 11).
- [ ] **[MANUAL]** a real session with a faulted hook is not blocked.
**Dependencies:** T5 (field), T3, T9 (hooks.json shape)
**Files:** `plugins/nxtlvl/hooks/fallback-log.sh`, `plugins/nxtlvl/hooks/session-metrics.sh`, `plugins/nxtlvl/hooks/hooks.json`
**Scope:** M

### Phase M7 — Fallback log + metric baseline (#7)

#### Task 13: Fallback-log correctness — exactly one line
**Description:** Prove the north-star precondition: one well-formed line per ecc reach, none otherwise.
**Acceptance criteria:**
- [ ] An `ecc:`-prefixed Skill/Task invocation appends **exactly one** well-formed JSONL line; a non-ecc invocation appends none.
**Verification:**
- [ ] Feed a synthetic `ecc:` stdin payload (shape from T5) → exactly one line; feed a non-ecc payload → zero lines (scriptable).
- [ ] **[MANUAL]** confirm live with one real `ecc:` invocation (logged re-enable per OQ3) (Success Criterion 9).
**Dependencies:** T12, T5
**Files:** none new (exercises `fallback-log.sh`)
**Scope:** S

#### Task 14: `sessions.jsonl` row + dual metric computable
**Description:** Auto-write the rot-prone session row; the single `quality` field is hand-appended; the dual (fallback-rate × quality) metric is computable from session 1.
**Acceptance criteria:**
- [ ] On session end, `session-metrics.sh` appends one row to `~/.claude/nxtlvl/sessions.jsonl` (fail-open).
- [ ] The `quality` field (1–5 / "did I redo this") is hand-appendable; the dual metric is computable.
**Verification:**
- [ ] **[MANUAL]** end a session → one row appears; append `quality` by hand; compute fallback-rate × quality (Success Criterion 10).
**Dependencies:** T12, T13
**Files:** none new (exercises `session-metrics.sh`)
**Scope:** S

### ✅ Checkpoint C — after M6–M7 (Tasks 12–14)
- [ ] Every hook exits 0 under a faulted body; no session blocked.
- [ ] Fallback log: exactly one line per ecc reach, none otherwise.
- [ ] `sessions.jsonl` row auto-written; dual metric computable.

---

### Phase 8 — Integration + promotion

#### Task 15: Full real session on `nxtlvl`, ecc dormant  **[MANUAL]**
**Description:** End-to-end proof of the harness in daily use.
**Acceptance criteria:**
- [ ] One full real work session runs end-to-end on `nxtlvl` with ecc **not loaded by default** (Success Criterion 12).
**Verification:**
- [ ] **[MANUAL]** complete a real session; confirm ecc dormant throughout.
**Dependencies:** all prior
**Files:** none
**Scope:** S (manual)

#### Task 16: Promotion tag + rollback rehearsal
**Description:** Mark the first promotable state and exercise the rollback path once.
**Acceptance criteria:**
- [ ] `git tag -a nxtlvl-phase0-mvh -m "Phase 0 walking skeleton promoted"` marks the state.
- [ ] Rollback path exercised once: checkout previous tag + reinstall (Success Criterion 13).
**Verification:**
- [ ] `git tag` lists the tag; **[MANUAL]** rollback rehearsed and recovered.
**Dependencies:** T15
**Files:** none (git tag)
**Scope:** XS

### ✅ Checkpoint Complete
- [ ] All 13 Success Criteria met; one full real session ran on `nxtlvl` with ecc dormant.
- [ ] Promotion tag set; rollback exercised once. Ready for Phase 1.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stdin field carrying the invoked name is unknown | **High** — the whole north-star metric rides on it | M0 spike (T5) is **fail-fast**, before any M7 build; discover the field with any Skill/Task. |
| Spike/fallback verification needs an `ecc:` invocation, but ecc is dormant + re-enable is "ask first" | Med | Discover the field with a **non-ecc** skill; only the final literal-`ecc:`-prefix confirmation needs one temporary, **logged** re-enable (OQ3). |
| `hooks.json` referencing not-yet-built scripts errors mid-build | Med | **Incremental wiring** — wire each event only when its script lands (PreToolUse@M0, SessionStart@M4, SessionEnd@M6). |
| Install / `/nxtlvl:*` steps are interactive-only; agent cannot run them | Med | Tasks 4, 5, 11, 13–15 marked **[MANUAL]**; user runs and reports the binary result. |
| Shell fail-open is subtle (`set -e`, `pipefail`, traps, missing files) | **High** — a blocking session hook is the worst failure mode | No `set -e`; explicit `exit 0` on every path; wrap body; **fault-injection test** (T12) is a required gate. |
| Context-injection token budget undefined | Low | Pick a concrete budget now (OQ1: ≤ ~300 tokens) as a **soft backstop**; densify first, cut lowest-value (non-earning) block before dropping proven value ([ADR-014](../decisions/ADR-014-quality-first-over-leanness.md)). |

## Open Questions (resolve before / during implementation; defaults proposed)

1. **Context-injection token budget (M4/T9).** Propose a concrete **soft backstop** (not a hard cap): **≤ ~300 tokens (~20 lines)**; over budget → densify/consolidate first, then cut order = fallback digest → task pointer → git line (lowest-value non-earner first, never proven value to hit the number; [ADR-014](../decisions/ADR-014-quality-first-over-leanness.md)). Confirm or set a number.
2. **`hooks.json` wiring strategy (T3/T9/T12).** Recommend **incremental** (wire each event with its script). Alternative: wire all three at M0 with `exit 0` stubs. Confirm incremental.
3. **Spike ecc-prefix confirmation (T5/T13).** Is non-ecc field discovery + reasoning sufficient for Phase 0, or do you want one temporary **logged** ecc re-enable to confirm the literal `ecc:` prefix end-to-end? (Recommend: discover with non-ecc; do one logged ecc confirmation at T13.)
4. **dev-skill vendoring (T7).** Spec resolves this as "stays reactive" — v1 **composes**, does not vendor individual agent-skills skills. Confirmed unless you want a specific skill vendored now.
5. **Plan-doc location.** Written to `docs/plan/nxtlvl-phase-0-plan.md` (mirrors `docs/intent/`, `docs/spec/`). Move if you prefer elsewhere.

## Parallelization Opportunities

- **Independent of the plugin:** T6 (layered config) — can run parallel to M0.
- **Independent skill files (after T1):** T2, T7, T10 are separate `SKILL.md` files — safe to author in parallel; integration (T11) is the barrier.
- **Must be sequential:** T3 → T9 → T12 (shared `hooks.json`); T5 → T12 → T13 (spike field → fallback append → correctness); install/smoke gates between phases.
