# Libraries

## Purpose

The `lib/` directory contains 13 shared libraries that power the C&M subsystem, instinct store, hook implementations, and metrics readouts. They are small, dependency-free (Node stdlib + TypeScript type files), and aggressively fail-open or fail-closed where safety matters.

## Files

| File | Lines | Role |
|---|---|---|
| `atomic.js` | 90 | Atomic write primitives (tmp+rename, append-line, liveness heartbeat). |
| `bookmarks.js` | 114 | Per-project, branch-grouped "where I left off" JSONL trail. |
| `evolve.js` | 121 | Deterministic instinct clustering engine for `/evolve`. |
| `instincts.js` | 405 | Instinct store: read/write/list/reinforce/promote with path-safe trust boundary. |
| `metrics.js` | 172 | Fallback-rate and confidence-distribution readouts for `/instinct-status`. |
| `obs-log.js` | 275 | Append-only JSONL observation log with seq-based cursor and purge. |
| `observer-runner.js` | 466 | Detached process that distills observations into instincts. |
| `open-files.js` | 136 | Extracts recently-touched file paths from the transcript. |
| `paths.ts` | 94 | Storage layout and directory helpers for C&M state. |
| `project-identity.js` | 77 | Deterministic project key + branch/folder grouping keys. |
| `recall.js` | 91 | Quality-gated instinct recall for the session-start briefing. |
| `scrub.js` | 288 | Secret-scrubbing with named patterns + entropy redactor; fail-closed. |
| `types.ts` | 291 | Claude Code ↔ hook JSON wire-format type contracts. |

## Contracts

### `atomic.js`

- `atomicWrite(target, data)` — tmp+rename so readers see either old or new, never a torn file.
- `appendLine(target, line)` — O_APPEND single-line JSONL append; strips embedded newlines.
- `writeLiveness(target, record)` — bounded heartbeat line; never throws.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/lib/atomic.js" />

### `bookmarks.js`

- One JSONL file per group key (`<bookmarksDir>/<groupKey>.jsonl`).
- `groupKeyFor(cwd)` returns the sanitized branch name or a folder hash.
- `append(projectId, groupKey, note, opts)` writes a dated note.
- `readNewest(projectId, groupKey)` returns the most recent bookmark.
- `isStale(projectId, groupKey, compareTs)` compares the newest bookmark against the newest observation timestamp.
- Readers skip torn/unparseable lines.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/lib/bookmarks.js" />

### `evolve.js`

- Pure, deterministic, no LLM, no file writes.
- `evolve({ projectId, now, strongBar })` returns `{ candidates, considered, total }`.
- Normalizes triggers by lowercasing and stripping keywords (`when`, `creating`, `writing`, etc.).
- Classifies clusters into exactly one type:
  - `agent` — size ≥ 3 and avg effective confidence ≥ 0.75.
  - `skill` — size ≥ 2.
  - `command` — size 1 and domain === `workflow`.
- Sorts deterministically by type rank, size, confidence, trigger key.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/lib/evolve.js" />

### `instincts.js`

- One Markdown file per instinct (`<id>.md`) with YAML frontmatter + `## Action` + `## Evidence`.
- Stores raw confidence; applies exponential decay at read time via `effectiveConfidence(inst, now)`.
- `reinforce(inst)` bumps confidence asymptotically toward (but never reaching) 1.0.
- Path-safe trust boundary: `assertSafeId` rejects separators, `..`, and leading dots; `safeFileIn` resolves paths and verifies containment.
- `promote(inst)` re-scopes project → global by writing the global copy first, then removing the project file (recoverable duplicate on crash).
- `list({ projectId, scope, minConfidence, now })` filters by effective confidence when requested.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/lib/instincts.js" />

### `metrics.js`

- `fallbackRate(env, home)` reads `~/.claude/nxtlvl/fallback-log.jsonl` and per-project `metrics.jsonl` files to compute the north-star fallback rate.
- `confidenceDistribution({ projectId, now })` loads instincts and histograms effective confidence into 5 bins.
- `bucketEffective(effValues)` is the pure histogram helper.
- Fallback rate is clamped to [0,1] to guard against crashed sessions that never record a `session_close`.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/lib/metrics.js" />

### `obs-log.js`

- The durable substrate of the C&M subsystem: one JSONL line per tool call.
- Uses a per-project monotonic `seq` counter (stored in `obs-seq.json`) so purge never invalidates the cursor.
- `append(projectId, obs)` assigns a seq and timestamp, normalizes start/complete fields, and appends.
- `readNew(projectId)` returns entries newer than the cursor and advances the cursor atomically.
- `pendingCount(projectId)` counts unconsumed entries without advancing the cursor (used by the cadence gate).
- `readAll(projectId)` and `count(projectId)` provide full-log access.
- `purge(projectId, { maxAgeDays, maxBytes, now })` archives when size ≥ 10 MB and drops consumed entries older than 30 days.
- Readers skip unparseable lines.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/lib/obs-log.js" />

### `observer-runner.js`

- Spawned by `hooks/observe.js` as a detached process.
- Reads new observations via `obs-log.readNew`, builds a prompt, and shells out to `claude -p --model claude-sonnet-4-6 --output-format json`.
- Asks the model to detect four patterns: corrections, error→fix, repeated workflows, tool preferences.
- Applies model-returned ops through `lib/instincts` with hard bounds:
  - Max 50 ops per batch (`NXTLVL_CM_MAX_OPS`).
  - Max 4,000 chars per stored field (`NXTLVL_CM_MAX_FIELD_LEN`).
  - Model timeout 120,000 ms (`NXTLVL_CM_MODEL_TIMEOUT_MS`).
- Create ids are always slugified; reinforce ids are validated before lookup.
- Writes a liveness line and releases the lock in a `finally` (except SIGKILL).

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/lib/observer-runner.js" />

### `open-files.js`

- Read-only transcript utility.
- `readTranscriptDefault(transcriptPath)` returns a tail-bounded `{ text, dropFirst }`.
- `extractOpenFiles(text, dropFirst)` scans main-thread assistant tool_use blocks for `Read`/`Edit`/`MultiEdit`/`Write`/`NotebookEdit` and returns the most-recent 8 unique file paths.
- Used by `briefing.js` on the post-compaction `SessionStart` path.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/lib/open-files.js" />

### `paths.ts`

- Single source of truth for the C&M storage layout.
- Storage root: `${XDG_STATE_HOME:-~/.local/state}/nxtlvl` (locked by ADR).
- `isSafeRoot` rejects synced roots (`.claude`, Dropbox, iCloud, OneDrive, Google Drive, `.Trash`).
- `layout(projectId)` returns absolute paths for `projectDir`, `observationsLog`, `obsCursor`, `obsArchiveDir`, `projectInstinctsDir`, `bookmarksDir`, `livenessLog`, `globalInstinctsDir`, and `root`.
- `ensureDir(dir)` is idempotent recursive mkdir.
- Type-strips to zero runtime code (erasable syntax only).

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/lib/paths.ts" />

### `project-identity.js`

- `projectIdentity(cwd)` returns a deterministic 16-hex-char key from `git rev-parse --git-common-dir` (sha256 of absolute path).
- `branchOrFolderKey(cwd)` returns a sanitized branch name or a folder hash for off-git/detached-HEAD.
- Pure: no writes.
- Worktrees of the same repo share identity; separate clones get distinct keys.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/lib/project-identity.js" />

### `recall.js`

- `recall({ projectId, now, bar, ceiling })` returns `{ injected, truncatedNames, total }`.
- Default bar = 0.7 (`NXTLVL_CM_RECALL_BAR`), default ceiling = 10 (`NXTLVL_CM_RECALL_CEILING`).
- Injects every instinct at or above the effective-confidence bar; if the set exceeds the ceiling, returns the names of truncated instincts so the UI can surface them.
- Delegates relevance and sort to `lib/instincts.forProject`.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/lib/recall.js" />

### `scrub.js`

- Secret-scrubbing for the C&M write path.
- Two passes: named-format regexes (tokens, keys, PEM, JWT, env assignments, etc.) and entropy-based redactor.
- `safeScrubObservation(obs)` is the fail-closed boundary: any error returns `{ dropped: true, reason }`; the caller must drop the observation.
- `scrubValue` recursively scrubs nested strings in objects/arrays while preserving structure.
- Bounds each scrubbed field to 64 KiB to prevent regex/entropy attacks.
- Entropy threshold: 20+ chars, mixes letters+digits or is long hex, Shannon entropy ≥ 3.5 bits/char.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/lib/scrub.js" />

### `types.ts`

- Typed source of truth for the Claude Code ↔ hook JSON wire contract.
- Discriminated unions on `hook_event_name` (input) and `hookEventName` (output).
- Models the `tool_input` distinction: `Skill` uses `.skill`, `Task`/`Agent` uses `.subagent_type`.
- Documented exit-code convention: 0 = proceed/fail-open, 2 = block (PreToolUse deny).
- Erasable TypeScript only: no runtime values, no enums, no namespaces.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/lib/types.ts" />

## Configuration / env vars

| Env var | Effect | Default |
|---|---|---|
| `XDG_STATE_HOME` | C&M storage root base | `~/.local/state` |
| `NXTLVL_INSTINCT_HALFLIFE_DAYS` | Decay half-life for effective confidence | 30 |
| `NXTLVL_CM_RECALL_BAR` | Minimum effective confidence for recall | 0.7 |
| `NXTLVL_CM_RECALL_CEILING` | Max instincts injected at session start | 10 |
| `NXTLVL_CM_MAX_OPS` | Max observer ops per batch | 50 |
| `NXTLVL_CM_MAX_FIELD_LEN` | Max chars stored per instinct field | 4000 |
| `NXTLVL_CM_MODEL_TIMEOUT_MS` | Observer model-call timeout | 120000 |

Hook-specific env vars are documented in [Hooks](hooks.md).

## Tests

- Every library has a corresponding `.test.js` (or `.test.ts`) file.
- Tests cover: atomic writes, bookmark staleness, evolve clustering, instinct decay/reinforce/promote, metrics histograms, obs-log cursor/purge, observer-runner op parsing, open-files extraction, path safety, recall ceiling, scrubbing, and type-stripping.

## Dependencies

- `lib/` is dependency-free except for Node stdlib and internal cross-references.
- Key internal graph:
  - `obs-log.js` → `atomic.js`, `paths.ts`
  - `instincts.js` → `atomic.js`, `paths.ts`
  - `bookmarks.js` → `atomic.js`, `paths.ts`, `project-identity.js`
  - `recall.js` → `instincts.js`
  - `metrics.js` → `paths.ts`, `instincts.js`
  - `observer-runner.js` → `obs-log.js`, `instincts.js`, `atomic.js`, `paths.ts`
  - `briefing.js` (hook) → `recall.js`, `bookmarks.js`, `obs-log.js`, `project-identity.js`, `open-files.js`
  - `capture.js` (hook) → `scrub.js`, `obs-log.js`, `project-identity.js`
  - `close.js` (hook) → `bookmarks.js`, `scrub.js`, `atomic.js`, `paths.ts`, `project-identity.js`
  - `observe.js` (hook) → `obs-log.js`, `project-identity.js`, `paths.ts`

## Relevant ADRs / intent

- [ADR-004](../../../docs/decisions/ADR-004-extend-native-memory.md) — extend native memory, no fourth system.
- [ADR-005](../../../docs/decisions/ADR-005-fallback-log-dual-metric.md) — fallback log + dual metric.
- [ADR-025](../../../docs/decisions/ADR-025-project-identity-observer-concurrency.md) — project identity + observer concurrency.
- [ADR-034](../../../docs/decisions/ADR-034-typescript-default-native-type-stripping.md) — TypeScript default native type-stripping.
- [Intent](../../../docs/intent/personal-harness.md) — C&M subsystem design, storage layout, reactive growth.

## Open questions / TODOs

- `types.ts` is not imported by any `.js` hook today; it is a type contract for future `.ts` hook migration or external tooling.
- `observer-runner.js` shells out to `claude` CLI; if the CLI is not on PATH in the detached process's environment, the observer silently fails (recorded in liveness log).
- No automated integration test runs the full capture → observe → instinct pipeline end-to-end; coverage is by unit tests and manual dogfooding.
- `project-identity.js` uses `git rev-parse --git-common-dir`; if git is not on PATH, it falls back to the folder hash.
