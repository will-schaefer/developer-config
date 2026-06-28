# Implementation Plan: nxtlvl Context & Memory + Session Lifecycle

> Consumes [`docs/spec/nxtlvl-context-memory-lifecycle.md`](../spec/nxtlvl-context-memory-lifecycle.md)
> (Status: FINAL — design). Produced via `/agent-skills:planning-and-task-breakdown` (2026-06-19).
> **Supersedes** [`nxtlvl-context-awareness-hooks-plan.md`](nxtlvl-context-awareness-hooks-plan.md)
> + its `-todo.md` for all remaining scope — the only thing those shipped is `context-alert`
> (kept **as-is**, no work here). PreCompact (their unbuilt "Hook 2") is re-planned as T4.2 below.
> 🤖 = agent-verifiable · 🧑 = manual gate (needs a live interactive `claude`) · ◇ = decision to lock.

## Overview

Build the **always-on session-lifecycle floor** (brief → capture → distill → save-spot) plus the
**on-demand graduation commands** (`/evolve`, `/promote`, `/prune`, `/instinct-status`) over a small
fixed set of machine-local stores. The floor extends Claude Code's native memory; it never replaces
it. Every hook is **fail-open** (never halts a session) and carries an env kill switch, reusing the
proven shape of [`context-alert.js`](../../plugins/nxtlvl/hooks/context-alert.js).

Current build state: only `context-alert.js` + `dangerous-bash.js` are live; `fallback-log.sh` is an
M0 no-op skeleton. Everything else below is new.

## Architecture decisions (already locked by the spec)

- **Two stores split by provenance.** Human-typed "remember this" → native memory (no decay, no
  gate). Observer-inferred → the separate **instinct store outside `~/.claude`**. (ADR-004 amended.)
- **Distillation is one-shot, not a daemon.** At 20 observations, spawn a fresh Sonnet pass (D5)
  that exits — no PID/lock/runaway machinery (avoids ecc's daemon complexity).
- **Recall is quality-gated, not size-gated.** Inject every relevant instinct ≥0.7, best-first; the
  soft ceiling is a backstop that **names** what it left out, never silent truncation. (ADR-007 amended.)
- **Project identity = `git rev-parse --git-common-dir`.** Worktrees share, clones don't, folder
  fallback off-git. Irreversible once instincts persist → recorded as **ADR-025**.
- **Crash-safe substrate = the observation log** (appended every tool call). The bookmark is a
  best-effort distillation on top; a missed bookmark is caught by the next briefing's staleness flag.
- **No close ritual / no session quality score.** Quality attaches to saved artifacts (per-instinct
  confidence), ecc-style. (ADR-005 amended; ADR-008 superseded; backbone = ADR-013/014.)

Shared-module convention: put reusable logic in `plugins/nxtlvl/lib/*.js` with colocated
`*.test.js` (`node --test`); hooks stay thin wrappers in `plugins/nxtlvl/hooks/`.

---

## Dependency graph

```
Phase 0 spikes (platform unknowns) ─── gate everything
        │
Phase 1  FOUNDATION (stores)
  paths ─┬─ atomic ─┬─ obs-log ────────────┐
 identity┘          ├─ instincts ──────────┤
                    └─ bookmarks ──────────┤
        │                                   │
Phase 2  WRITE PATH        Phase 4 LIFECYCLE │
  scrub → capture → observer   close ┐       │
        │  (writes instincts)  precompact┘    │
        ▼                                      ▼
Phase 3  READ PATH:  recall → briefing  (reads instincts + bookmark + git)
        │
Phase 5  COMMANDS:  instinct-status · prune · promote · evolve  (read/graduate instincts)
        │
Phase 6  METRICS + DOCS + PROMOTE
```

Implementation order is bottom-up: stores first, then the write path that fills them, then the read
path that surfaces them, then close/compaction, then the human-invoked graduation commands.

---

## Phase 0 — De-risk + lock decisions

> No production code. Throwaway spikes + a locked decisions table. Highest-risk unknowns first.

### Task 0.1 ◇ Lock the open `/plan` parameters
**Description:** Resolve every value the spec punted to `/plan` and record them in the Decisions
table at the bottom of this doc.
**Acceptance criteria:**
- [ ] Storage root chosen (recommend `${XDG_STATE_HOME:-$HOME/.local/state}/nxtlvl`), confirmed
  outside `~/.claude` **and** outside any sync/backup root (Dropbox/iCloud/Time Machine).
- [ ] Numeric knobs locked: observer cadence (20 obs), truncation (~5k chars), obs-log purge
  (>30d / ~10MB), bookmark size-gate threshold (tool-calls ≥ N), confidence bar (0.7),
  promotion bar (0.8), decay shape.
- [ ] Observer model locked (`claude-sonnet-4-6`, D5 — quality-first over the cost-era Haiku default) + token budget.
**Verification:** Decisions table filled; no `TBD` left.
**Dependencies:** None. **Scope:** XS (this doc).

### Task 0.2 🧑 Spike — SessionStart injection channel
**Description:** Confirm a `SessionStart` hook can inject text the agent actually reads on turn one
(via `hookSpecificOutput.additionalContext` or stdout). The entire read path depends on this.
**Acceptance criteria:**
- [x] A trivial SessionStart hook's payload is observably present in the first assistant turn.
- [x] Failure mode (hook errors) leaves the session unaffected (fail-open holds).
**Verification:** Manual install + fresh session; note the result in the Risks table.
**Dependencies:** None. **Scope:** S (throwaway).
**Result (2026-06-20): GREEN.** Run headlessly via `claude -p --settings <isolated>`: a SessionStart
hook injecting `hookSpecificOutput.additionalContext` with a sentinel ("secret word PINEAPPLE-7731")
caused the model to return that token; an identical run **without** the hook returned `NONE`. The
control rules out hallucination — the injection channel genuinely reaches the model.
Kit: `cm-phase0-workspace/sessionstart-spike-hook.js` + `sessionstart-settings.json`.

### Task 0.3 🧑 Spike — detached observer survives hook exit
**Description:** Confirm a hook can spawn a **detached** `node` subprocess that keeps running and
writes a file *after* the parent hook has exited 0 (same `detached`/`unref` idiom as
`context-alert.js` `notify()`, but longer-lived).
**Acceptance criteria:**
- [x] Spawned child writes its output file after the hook process returns.
- [x] If the child cannot spawn, the hook still exits 0 (fail-open).
**Verification:** Manual; observe the child's output file appears post-exit.
**Dependencies:** None. **Scope:** S (throwaway). **Risk: HIGH** — if false, fall back to a
"queue file, next hook drains it" design (record the pivot).
**Result (2026-06-20): GREEN — no pivot needed.** Tested against a real `claude -p` process (not a
proxy): a PostToolUse:Read hook spawned a detached 20s observer; the headless `claude` then exited,
and the observer wrote its `child-done` marker **+13.5 s after the claude process was gone**. The
child was reparented to `init` (`ppid:1`) the instant the hook returned — *before* claude exited — so
CC never had a handle to signal it (it `setsid`'d into its own process group via `detached:true`).
Fail-open also confirmed: a forced spawn failure (`CM_SPIKE_FORCE_FAIL=1`) still exited 0.
Kit: `cm-phase0-workspace/observer-spike-hook.js` + `observer-spike-child.js` + `observer-spike-RUNBOOK.md`.
**The detached one-shot observer architecture stands** (unblocks Task 2.3).

### Task 0.4 🤖 Spike — fail-closed secret scrub
**Description:** Prototype the scrubber (named-format regexes for tokens/API-keys/`.env`
assignments + an entropy redactor) over both tool **input and output**, and prove the fail-closed
contract: a scrub that throws ⇒ the observation is dropped, never written raw.
**Acceptance criteria:**
- [x] Planted token in input **and** in output is redacted in the persisted record.
- [x] A forced scrub exception drops the observation (nothing persisted), not a raw passthrough.
**Verification:** `node --test` on the spike file, green.
**Dependencies:** None. **Scope:** S. **Risk: HIGH (severity)** — a leak here writes secrets to disk.
**Result: GREEN** — 9 tests pass (`cm-phase0-workspace/scrub.js` + `scrub.test.js`); fail-closed
verified on both a throwing redactor and a malformed field. Residual for Task 2.1: entropy
thresholds are spike-grade and need corpus tuning + more named shapes (JWT/GCP/Stripe).

### Task 0.5 🤖 Spike — storage path + project identity
**Description:** Confirm `git rev-parse --git-common-dir` yields shared identity for worktrees and
distinct identity for separate clones, with a folder fallback off-git; confirm the chosen root is
writable and clears CC's sensitive-path guard.
**Acceptance criteria:**
- [x] Worktree-vs-clone-vs-off-git identity behaves per spec §5 against fixtures.
- [x] A background writer can create + atomically rename a file under the chosen root.
**Verification:** `node --test` + a manual write check. **Dependencies:** 0.1. **Scope:** S.
**Result: GREEN** — 8 tests pass (`cm-phase0-workspace/identity.js` + `identity.test.js`) against
real `git worktree` fixtures; `~/.local/state/nxtlvl` confirmed writable (the sandbox `EPERM` was a
session artifact — production hooks run in CC's hook runtime, which the 0.2/0.3 runs above just
exercised end-to-end).

### ✅ Checkpoint A-pre
- [x] All four spikes resolved — **all GREEN, no pivots** (0.2/0.3 run against the real `claude`
  binary 2026-06-20; 0.4/0.5 `node --test`). Decisions table complete.
- [ ] **Human reviews** spike outcomes before any foundation code is written. ← only remaining gate

---

## Phase 1 — Foundation (stores)

> Pure libraries under `plugins/nxtlvl/lib/`, each unit-tested. No hooks wired yet — the system
> still behaves exactly as today after this phase.

### Task 1.1 🤖 `lib/paths.js` — storage-root resolver
**Description:** Resolve the machine-local root, refuse sync/backup roots, ensure subdirs exist.
**Acceptance criteria:**
- [x] Returns `${XDG_STATE_HOME:-~/.local/state}/nxtlvl`; refuses a path under a known sync root.
- [x] Idempotent dir creation; never throws on the happy path.
**Verification:** `node --test plugins/nxtlvl/lib/paths.test.js`. **Done 2026-06-20: 17 tests green.**
`paths.js` also owns `layout(projectId)` — the single source of truth for the storage tree.
**Dependencies:** 0.1. **Files:** `lib/paths.js`, `lib/paths.test.js`. **Scope:** S.

### Task 1.2 🤖 `lib/project-identity.js` — identity key
**Description:** Derive a stable identity key from `git --git-common-dir`, folder fallback off-git.
**Acceptance criteria:**
- [x] Worktrees of one repo → same key; separate clones → distinct keys; off-git → folder key.
- [x] Pure/deterministic; no writes. (Also adds `branchOrFolderKey` for bookmark grouping.) **Done 2026-06-20: 9 tests green.**
**Verification:** `node --test` with git fixtures. **Dependencies:** 0.5. **Files:**
`lib/project-identity.js` + test. **Scope:** S.

### Task 1.3 🤖 `lib/atomic.js` — atomic write + append + liveness
**Description:** `tmp`+`rename` writer, append helper, and a one-line heartbeat/liveness writer
(invariant §7-a/§7-b). Reuse `context-alert.js`'s `writeState` pattern.
**Acceptance criteria:**
- [x] Concurrent writers never leave a torn/half file; crash leaves the target intact.
- [x] Liveness writer appends one bounded line and never throws. **Done 2026-06-20: 11 tests green (incl. 50-way concurrency sim).**
**Verification:** `node --test` incl. a concurrency simulation. **Dependencies:** 1.1. **Files:**
`lib/atomic.js` + test. **Scope:** S.

### Task 1.4 🤖 `lib/obs-log.js` — observation log
**Description:** Append-only JSONL (ecc `observations.jsonl` shape), read-new-since-cursor,
auto-purge (>30d, archive at ~10MB).
**Acceptance criteria:**
- [x] Append + cursored read return only new entries. (Cursor = monotonic `seq`, purge-safe.)
- [x] Purge drops >30d and archives at the size cap; never corrupts on truncation; preserves the unconsumed tail on archive. **Done 2026-06-20: 13 tests green.**
**Verification:** `node --test`. **Dependencies:** 1.3. **Files:** `lib/obs-log.js` + test. **Scope:** M.

### Task 1.5 🤖 `lib/instincts.js` — instinct store
**Description:** One-file-per-instinct CRUD with ecc frontmatter
(`id/trigger/confidence/domain/scope(+project_id)/source` + `## Action`/`## Evidence`),
confidence update, decay, scope filter (project + global). Atomic writes via 1.3.
**Acceptance criteria:**
- [x] Create/update/read round-trips frontmatter; confidence increments and decays correctly.
- [x] Scope filter returns project-relevant + global only. **Done 2026-06-20: 17 tests green.**
  Decay = read-time exponential (`raw·0.5^(days/30)`, `NXTLVL_INSTINCT_HALFLIFE_DAYS`-tunable); stored confidence never mutated.
**Verification:** `node --test`. **Dependencies:** 1.2, 1.3. **Files:** `lib/instincts.js` + test.
**Scope:** M. *(Reference: `reference/ECC-main/docs/continuous-learning-v2-spec.md`.)*

### Task 1.6 🤖 `lib/bookmarks.js` — bookmark trail
**Description:** Dated note per session, branch-keyed (folder fallback), read-newest, staleness
compare (is the obs-log newer than the newest bookmark?). Stored outside shared git history.
**Acceptance criteria:**
- [x] Append + read-newest by branch; staleness compare returns the right boolean.
- [x] Off-git falls back to folder key. **Done 2026-06-20: 12 tests green.**
**Verification:** `node --test`. **Dependencies:** 1.2, 1.3. **Files:** `lib/bookmarks.js` + test.
**Scope:** S.

### ✅ Checkpoint: Foundation — **DONE 2026-06-20**
- [x] All `lib/*.test.js` pass; full suite green. No behavior change in a live session yet.
  **Result:** 6 libs built via parallel subagents (2 waves: paths/identity/atomic → obs-log/instincts/bookmarks);
  **79/79 lib tests green**, existing **24/24 hook tests green** (no regression), `hooks.json` untouched (nothing wired),
  + a cross-module integration smoke (identity→obs cursor→scoped best-first recall→bookmark staleness) PASSED.
  Built on branch `feat/cm-phase1-foundation`. **Next: Phase 2 (write path) — scrub → capture → observer.**

---

## Phase 2 — Write path (Slice A: *the harness learns*)

### Task 2.1 🤖 `lib/scrub.js` — productionized scrubber
**Description:** Harden the 0.4 spike into the real module: named regexes + entropy redactor over
input+output, fail-closed.
**Acceptance criteria:**
- [ ] Redacts planted secrets in input and output; drops the observation on any scrub failure.
- [ ] Bounded runtime on ~5k input.
**Verification:** `node --test` incl. fail-closed drop. **Dependencies:** 0.4, 1.4. **Files:**
`lib/scrub.js` + test. **Scope:** M.

### Task 2.2 🤖 `hooks/capture.js` — live capture hook
**Description:** PreToolUse + PostToolUse on `*`: truncate ~5k, scrub (drop on fail), append via
obs-log. Skip guards (subagents/automated/observer's own runs). Env kill switch. Fail-open absolute.
**Acceptance criteria:**
- [ ] Records a scrubbed observation per tool call; skips guarded contexts.
- [ ] Any error → exit 0, no session effect; kill switch silences it.
**Verification:** `node --test` (fail-open, skip guards, scrub-drop paths). **Dependencies:** 2.1,
1.4. **Files:** `hooks/capture.js` + test. **Scope:** M.

### Task 2.3 🤖 observer (one-shot Sonnet)
**Description:** When obs count hits 20, a per-session **single-flight** guard admits one detached
`claude-sonnet-4-6` (D5) subprocess that reads new obs, detects ecc's four patterns (corrections, error→fix, repeated
workflows, tool prefs), creates/updates instincts, and writes a liveness line on death.
**Acceptance criteria:**
- [ ] Cadence gate fires at 20; single-flight admits exactly one observer per session.
- [ ] Observer writes/updates instinct files; a killed observer leaves a heartbeat (no silent death).
**Verification:** `node --test` (cadence, single-flight, fail-open). **Dependencies:** 0.3, 1.5,
2.2. **Files:** `hooks/observe.js` (+ `lib/observer-runner.js`) + test. **Scope:** M. **Risk: HIGH**
(depends on 0.3 outcome).

### Task 2.4 🤖 Wire capture + observer into `hooks.json`
**Description:** Add PreToolUse `*` + PostToolUse `*` entries; document kill switches; leave
`context-alert` + `dangerous-bash` + `fallback-log` intact.
**Acceptance criteria:**
- [ ] `hooks.json` parses; new hooks fire; existing hooks unchanged.
**Verification:** JSON valid + grep; full test suite green. **Dependencies:** 2.2, 2.3. **Files:**
`hooks/hooks.json`. **Scope:** XS.

### ✅ Checkpoint A (🧑 manual install-observe)
- [ ] Live session: `observations.jsonl` grows; a planted secret is scrubbed on disk; after 20 obs an
  instinct file appears; **no session interruption**; an observer crash leaves a heartbeat. **Write path ships.**

---

## Phase 3 — Read path (Slice B: *the harness briefs you*)

### Task 3.1 🤖 `lib/recall.js` — quality-gated recall
**Description:** Select relevant (project+global) instincts ≥0.7, best-first, to a soft ceiling;
return the injected set **plus the names** of any truncated instincts for the nudge (spec §6).
**Acceptance criteria:**
- [ ] Gate + best-first ordering correct; over-ceiling returns injected set + truncated names.
- [ ] Off-project / stale / <0.7 excluded.
**Verification:** `node --test`. **Dependencies:** 1.5. **Files:** `lib/recall.js` + test. **Scope:** S.

### Task 3.2 🤖 `hooks/briefing.js` — SessionStart briefing
**Description:** Assemble fresh git line + newest bookmark (actual words) + staleness flag +
recall block; emit as `additionalContext`; fail-open.
**Acceptance criteria:**
- [ ] Briefing contains all three blocks; staleness flag appears only when the log is newer.
- [ ] Over-ceiling emits the "N strong instincts NOT loaded: [names] → `/evolve`" nudge.
**Verification:** `node --test`. **Dependencies:** 0.2, 1.6, 3.1. **Files:** `hooks/briefing.js` +
test. **Scope:** M.

### Task 3.3 🤖 Wire briefing into `hooks.json` (SessionStart)
**Acceptance criteria:** [ ] Entry added; JSON valid; suite green.
**Verification:** grep + tests. **Dependencies:** 3.2. **Files:** `hooks.json`. **Scope:** XS.

### ✅ Checkpoint B (🧑 manual)
- [ ] Fresh session shows the briefing on top of CLAUDE.md/MEMORY.md: git line + newest bookmark +
  strong instincts (+ staleness flag / truncation nudge when applicable). **Read path ships.**

---

## Phase 4 — Lifecycle close + compaction (Slice C: *your spot is saved*)

### Task 4.1 🤖 `hooks/close.js` — SessionEnd close
**Description:** Size gate — `(tool-calls ≥ N) OR (a commit/file-mutation occurred)` → write a dated
bookmark (best-effort); record fallback-rate. Fail-open.
**Acceptance criteria:**
- [ ] Non-trivial session (either gate arm) writes a bookmark; "glanced and left" writes nothing.
- [ ] fallback-rate recorded; any error → exit 0.
**Verification:** `node --test` (both gate arms, skip path). **Dependencies:** 1.6. **Files:**
`hooks/close.js` + test. **Scope:** M.

### Task 4.2 🤖 `hooks/precompact.js` — PreCompact steer
**Description:** Emit summary-steer text only: current task/bookmark pointer + next step + key open
files, worded to survive both `/compact` and ~900K auto-compaction. No bookmark write. Fail-open.
(Replaces the old plan's unbuilt "Hook 2".)
**Acceptance criteria:**
- [ ] Emits the pointer + next step + open files; absolute fail-open.
**Verification:** `node --test` (fixture + fail-open). **Dependencies:** 1.6. **Files:**
`hooks/precompact.js` + test. **Scope:** S.

### Task 4.3 🤖 Wire close + precompact into `hooks.json`
**Acceptance criteria:** [ ] SessionEnd + PreCompact entries added; JSON valid; suite green.
**Dependencies:** 4.1, 4.2. **Files:** `hooks.json`. **Scope:** XS.

### ✅ Checkpoint C (🧑 manual)
- [ ] Non-trivial session → bookmark written; trivial session → none; `/compact` → pointer + next
  step survive the summary. **Lifecycle ships.**

---

## Phase 5 — On-demand commands (Slice D: *review + graduate*)

> All human-invoked (they cluster with an LLM and write files — you eyeball first). Each is a
> command in `plugins/nxtlvl/commands/`, matching `doc-keeper.md` / `git-workflow.md` shape.

### Task 5.1 🤖 `/instinct-status`
**Description:** Read the instinct store; show confidence + scope + the two metric readouts (§8).
**Acceptance criteria:** [ ] Lists project + global instincts with confidence; shows fallback-rate
+ confidence distribution. **Verification:** run against a seeded store. **Dependencies:** 1.5.
**Files:** `commands/instinct-status.md`. **Scope:** S.

### Task 5.2 🤖 `/prune`
**Description:** Drop stale pending instincts. **Acceptance criteria:** [ ] Removes only
below-bar/stale pending instincts; reports what it dropped. **Dependencies:** 1.5. **Files:**
`commands/prune.md`. **Scope:** S.

### Task 5.3 🤖 `/promote`
**Description:** Promote a project-scoped instinct to global (≥0.8 bar). **Acceptance criteria:**
[ ] Re-scopes a qualifying instinct to global; refuses below-bar. **Dependencies:** 1.5. **Files:**
`commands/promote.md`. **Scope:** S.

### Task 5.4a 🤖 `lib/evolve.js` — deterministic clustering (adopt from ecc)
**Description:** Cluster strong instincts into graduation candidates — **adopted** from ecc's
`instinct-cli.py cmd_evolve` (bucket by normalized trigger key, avg confidence per cluster):
**skill** candidate = trigger cluster ≥2 instincts; **command** = a single workflow instinct;
**agent** = cluster ≥3 instincts **and** avg confidence ≥0.75. Pure/deterministic, no LLM.
**Acceptance criteria:**
- [ ] Given a seeded store, returns the same candidate set every run (deterministic).
- [ ] Classifies skill/command/agent by the thresholds above; honors the 0.8 strong bar.
**Verification:** `node --test`. **Dependencies:** 1.5. **Files:** `lib/evolve.js` + test. **Scope:** S.

### Task 5.4b 🤖 `/evolve` command + `evolver` agent (D3 — locked)
**Description:** Thin `/evolve` command calls `lib/evolve` (5.4a) for candidates, shows them
(dry-run default), and on `--generate` dispatches the **`evolver` subagent** to author each
artifact. We **reject** ecc's mechanical regex/string-concat stub generation (low quality) and
**replace** it with real LLM authoring: the agent loads `skill-creator` conventions and writes
valid frontmatter + body in an **isolated context** (per [ADR-018](../decisions/ADR-018-ideation-domain.md)
isolated-agents pattern). Command = cheap orchestration; agent = expensive authoring.
**Acceptance criteria:**
- [ ] `/evolve` (no flag) lists candidates from 5.4a; writes nothing.
- [ ] `/evolve --generate` dispatches `evolver`, which produces a **skill-creator-valid** artifact
  (not a stub), tagged with its source instinct ids.
**Verification:** run against a seeded store; generated artifact passes skill-creator validation.
**Dependencies:** 5.4a, 1.5. **Files:** `commands/evolve.md`, `agents/evolver.md`. **Scope:** M.

### ✅ Checkpoint D (🧑)
- [ ] Each command runs against a seeded store; `/evolve --generate` produces a valid skill scaffold.

---

## Phase 6 — Metrics, docs, promote

### Task 6.1 🤖 Metrics readouts + fallback-log role
**Description:** Wire the two automatic readouts (§8): fallback-rate (from the fallback log) +
instinct-confidence distribution. Retire `fallback-log.sh`'s M0 spike code to its remaining job —
fallback-rate counting — or fold that count into `close.js`. **Acceptance criteria:** [ ] Both
readouts computed and surfaced (via `/instinct-status` §5.1); fallback-log no longer a no-op spike.
**Dependencies:** 4.1, 5.1. **Files:** `hooks/fallback-log.sh`, `lib/metrics.js` (+ test). **Scope:** M.

### Task 6.2 🤖🧑 doc-keeper consistency pass
**Description:** Confirm the spec's §10 ADR work is fully recorded & consistent — ADR-004/005/007
amended, ADR-008 superseded, ADR-013/014 + **ADR-025 (project identity)** present, README index
matches. Flip the spec status to **built**. Mostly verification (design ADRs already landed).
**Acceptance criteria:** [ ] doc-keeper reports ADR integrity green; spec marked built; no new ADR
needed (or one recorded if a Phase-0 pivot warranted it). **Dependencies:** all build phases.
**Scope:** S. **Run via:** `nxtlvl:doc-keeper`.

### Task 6.3 🧑 Promote + live floor confirmation
**Description:** `/plugin` promote the committed work and confirm the **whole floor** in the daily
driver: brief → capture → distill → close, end to end, across a real session and a `/compact`.
**Acceptance criteria:** [ ] Daily-driver session exercises all four floor stages with no
interruption. **Dependencies:** 6.2. **Scope:** S.

### ✅ Checkpoint: Complete
- [ ] All acceptance criteria met; full `node --test` suite green; floor confirmed live.

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| ~~SessionStart injection channel unproven~~ **RESOLVED 2026-06-20** | High — kills the read path | T0.2 GREEN: sentinel injected via SessionStart `additionalContext` reached the model (control returned `NONE`) |
| ~~Detached observer killed when hook exits~~ **RESOLVED 2026-06-20** | High — kills distillation | T0.3 GREEN: observer wrote +13.5 s after a real `claude` process exited (reparented to `init`, own process group); no pivot needed |
| Secret written raw to disk (scrub fails open) | **Severe** | Fail-closed contract; T0.4 + T2.1 dedicated drop tests |
| Storage on a synced FS corrupts JSONL | High — data loss | `paths.js` refuses sync roots (T1.1); atomic renames |
| Project-identity key irreversible | Med — migration pain | Locked Phase 0; recorded as ADR-025 |
| Silent wrong instinct steers next session | Med | ≥0.7 bar + decay bound blast radius; probation flag deferred (reactive) |
| Observer cost/latency on hands-on path | Low | One-shot detached background; never blocks (X5) |

## Open questions (need human input before Phase 1)

- ✅ **D1 Storage root** — locked: `${XDG_STATE_HOME:-~/.local/state}/nxtlvl` (non-synced, env-overridable, cross-platform).
- ✅ **D2 Bookmark size-gate N** — locked: tool-calls ≥ 10 **OR** any commit/mutation (mutation arm catches all change sessions; N governs only the read-only tail).
- ✅ **D3 `/evolve` shape** — locked: thin command + deterministic `lib/evolve` clustering (adopted from ecc) + dedicated `evolver` agent that authors via `skill-creator` (ecc's mechanical stub-generation rejected). See Tasks 5.4a/5.4b.
- ✅ **D4 Metric surface** — locked: `/instinct-status` only (briefing stays lean — health metrics aren't per-session-actionable).
- ✅ **D5 Observer model** — locked: `claude-sonnet-4-6` (quality-first; the spec's Haiku default was cost-era and cost is irrelevant on Max + latency is hidden by the detached run). **Spec amended** (2026-06-19): §3/§4.2/Stage-2 updated + decision recorded as spec **X7**.

## Decisions table (fill in Task 0.1)

| Knob | Value | Status |
|---|---|---|
| Storage root | `${XDG_STATE_HOME:-~/.local/state}/nxtlvl` | ✅ D1 locked |
| Observer cadence | 20 observations | locked (spec) |
| Truncation | ~5k chars | locked (spec) |
| Obs-log purge | >30 days / archive ~10MB | locked (spec) |
| Bookmark size gate | tool-calls ≥ 10 **OR** commit/mutation | ✅ D2 locked |
| `/evolve` shape | thin command + `lib/evolve` clustering + `evolver` agent (authors via skill-creator) | ✅ D3 locked |
| Confidence bar | 0.7 strong / 0.8 promote | locked (spec) |
| Observer model | `claude-sonnet-4-6` (was Haiku — quality-first override) | ✅ D5 locked |
| Metric surface | `/instinct-status` only (not in briefing) | ✅ D4 locked |

## Parallelization

- **Phase 1:** `paths`, `project-identity`, `atomic` are independent (parallel-safe); `obs-log`,
  `instincts`, `bookmarks` each depend only on `atomic`+`paths` → parallel after those.
- **Slices A / B / C** share the foundation but are otherwise independent code; B's *briefing* only
  needs the store interfaces (not live data) to be built and tested. Safe to parallelize across
  agents once Phase 1 lands; **sequential** only at the `hooks.json` wiring tasks (shared file).
- **Commands (Phase 5)** are fully independent of each other.
