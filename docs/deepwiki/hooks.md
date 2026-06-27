# Hooks

## Purpose

The `hooks/` directory contains the lifecycle interception layer of the nxtlvl plugin. Hooks are small, fail-open scripts (or one deliberate blocking gate) that run at Claude Code hook points: PreToolUse, PostToolUse, UserPromptSubmit, SessionStart, and SessionEnd. The registry in `hooks.json` declares which hooks run for which tool/matcher and with what timeouts.

## Files

### Registry

| File | Role |
|---|---|
| `hooks.json` | Declares all hooks, their lifecycle matchers, commands, descriptions, and timeouts. |

### Implementations

| File | Lifecycle | Role |
|---|---|---|
| `fallback-log.sh` | PreToolUse `Skill\|Task\|Agent` | Logs every `ecc:`-prefixed invocation to the global fallback log. |
| `dangerous-bash.js` | PreToolUse `Bash` | Blocking gate for catastrophic shell commands; warns on destructive-but-common ones. |
| `capture.js` | PreToolUse `*` + PostToolUse `*` | Records every tool call into the per-project observation log. |
| `context-alert.js` | PostToolUse `*` | Injects a context-usage FYI and fires a desktop notification backstop. |
| `observe.js` | PostToolUse `*` | Spawns a detached observer when enough new observations have accumulated. |
| `session-title.js` | UserPromptSubmit `*` | Keeps the session title as "folder · branch". |
| `briefing.js` | SessionStart `*` | Injects a "where you left off" briefing at session start. |
| `close.js` | SessionEnd `*` | Writes a dated bookmark and a session-close metrics line. |

### Evals

| Path | Role |
|---|---|
| `evals/dangerous-bash/adapter.js` | Adapter that runs dangerous-bash against a corpus of Bash commands. |
| `evals/dangerous-bash/corpus.jsonl` | Test commands with expected outcomes. |
| `evals/dangerous-bash/eval.yaml` | Eval configuration. |
| `evals/dangerous-bash/scorecard.json` | Latest scorecard. |

## Contracts

### `hooks.json`

The registry uses the `PreToolUse` / `PostToolUse` / `UserPromptSubmit` / `SessionStart` / `SessionEnd` event names and matchers:

- `PreToolUse` matcher `Skill|Task|Agent` → `fallback-log.sh`.
- `PreToolUse` matcher `Bash` → `dangerous-bash.js` (10s timeout).
- `PreToolUse` matcher `*` → `capture.js` (10s timeout).
- `PostToolUse` matcher `*` → `context-alert.js` (10s), `capture.js` (10s), `observe.js` (10s).
- `UserPromptSubmit` matcher `*` → `session-title.js` (10s).
- `SessionStart` matcher `*` → `briefing.js` (10s).
- `SessionEnd` matcher `*` → `close.js` (10s).

Every hook has a description and a kill-switch env var documented in its description. The registry expands `${CLAUDE_PLUGIN_ROOT}` to the plugin's install path.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/hooks/hooks.json" />

### `fallback-log.sh`

- North-star metric hook: records each `ecc:` Skill/Task/Agent invocation to `~/.claude/nxtlvl/fallback-log.jsonl`.
- Uses `jq` for injection-safe parsing; without `jq` it exits silently (fail-open).
- Extracts the invoked name from `.tool_input.skill` (Skill) or `.tool_input.subagent_type` (Task/Agent).
- Skips observer subprocesses (`NXTLVL_CM_OBSERVER`).
- Always exits 0 and emits nothing.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/hooks/fallback-log.sh" />

### `dangerous-bash.js`

- The only deliberate blocking gate in the plugin.
- Exits 2 (block) on high-confidence catastrophic commands: `rm -rf /`, force-push to `main`/`master`, `curl|sh`, `dd` to block devices, `mkfs`, recursive `chmod 777` on broad paths, fork bombs.
- Exits 0 with a stderr warning on `git reset --hard` and `git clean -f`.
- Errors always exit 0 (fail-open): a block is only ever a clean decision.
- Uses JSON.parse (Node) rather than `jq` so it has no external dependency.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/hooks/dangerous-bash.js" />

### `capture.js`

- Writes side: records every tool call start and completion into `lib/obs-log.js`.
- Truncates `tool_input` and `tool_response` to 5,000 chars before scrubbing.
- Uses `lib/scrub.js` (fail-closed: dropped observations never persist).
- Skips on kill switch, observer run, `isSidechain=true`, and non-interactive sessions (no session_id/transcript_path).
- Always exits 0 and emits nothing.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/hooks/capture.js" />

### `context-alert.js`

- Two-stage context-awareness hook:
  - Primary: injects a one-line FYI when live context crosses 200K tokens (default).
  - Backstop: fires a macOS notification at 325K tokens (default).
- Re-arms when context drops below 90% of a stage's threshold (e.g., after `/compact`).
- Reads live context from the transcript: `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`.
- Skips sidechain turns so it tracks the main thread only.
- Persists per-session state in a temp JSON file under `os.tmpdir()`.
- Darwin-only for notifications; silently no-ops elsewhere.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/hooks/context-alert.js" />

### `observe.js`

- Cadence gate that wakes the background observer.
- When `obs-log.pendingCount(projectId) >= 20` (default) and a session-scoped lock is free, spawns `lib/observer-runner.js` as a detached process.
- Lock file: `<projectDir>/observer.<session>.lock`; atomic exclusive create; stale locks older than 5 minutes are reclaimed.
- The lock TTL (5 min default) must stay above the model timeout (2 min default) to prevent double observers.
- Always exits 0 and emits nothing.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/hooks/observe.js" />

### `session-title.js`

- Runs on every `UserPromptSubmit` to set the session title.
- Title format: `<folder> · <branch>`; falls back to folder name alone when not on a branch.
- Emits `hookSpecificOutput.sessionTitle`.
- Never blocks prompt submission; every failure path degrades silently.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/hooks/session-title.js" />

### `briefing.js`

- Runs at `SessionStart` and injects a "where you left off" brief via `additionalContext`.
- Composes four blocks:
  1. Git line: current branch + uncommitted-changes flag.
  2. Newest bookmark for the current branch, with a staleness flag if observation log is newer.
  3. Quality-gated instincts from `lib/recall.js`, naming any truncated instincts.
  4. Key open files (only when `source === 'compact'`, via `lib/open-files.js`).
- Kill switch: `NXTLVL_CM_BRIEFING=off`.
- Skips observer runs and sidechains.
- Absolute fail-open: any error returns `''`.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/hooks/briefing.js" />

### `close.js`

- Runs at `SessionEnd`.
- Writes a dated bookmark only when the session was non-trivial: `toolCalls >= 10` (default) OR a commit/file-mutation occurred.
- Always records a `session_close` telemetry line in `metrics.jsonl`.
- Derives stats from the transcript so it works even when capture is disabled.
- Kill switch: `NXTLVL_CM_CLOSE=off`.
- Skips observer runs and sidechains.
- Reads only the tail of the transcript by default; re-reads the whole file only when the tail is inconclusive.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/hooks/close.js" />

## Configuration / kill switches

| Hook | Kill switch | Tunable |
|---|---|---|
| fallback-log | `NXTLVL_CM_OBSERVER` (skip) | none |
| dangerous-bash | `NXTLVL_DANGEROUS_BASH=off` | none |
| capture | `NXTLVL_CM_CAPTURE=off` | none |
| context-alert | `NXTLVL_CONTEXT_ALERT=off` | `NXTLVL_CONTEXT_ALERT_TOKENS`, `NXTLVL_CONTEXT_ALERT_BACKSTOP_TOKENS`, `NXTLVL_CONTEXT_ALERT_NOTIFY=off` |
| observe | `NXTLVL_CM_OBSERVE=off` | `NXTLVL_CM_OBSERVE_CADENCE`, `NXTLVL_CM_OBSERVE_LOCK_TTL_MS` |
| session-title | `NXTLVL_SESSION_TITLE=off` | none |
| briefing | `NXTLVL_CM_BRIEFING=off` | none |
| close | `NXTLVL_CM_CLOSE=off` | `NXTLVL_CM_CLOSE_MIN` |

All hooks also skip when `NXTLVL_CM_OBSERVER` is truthy (the observer's own session should not capture/brief/close itself).

## Tests

- Six of the eight hook implementations have a `.test.js` file; `session-title.js` currently does not.
- The dangerous-bash eval in `evals/dangerous-bash/` provides a scored corpus test.
- Tests exercise kill switches, fail-open paths, guard conditions, and core output contracts.

## Dependencies

- `fallback-log.sh` → `jq` (optional), `~/.claude/nxtlvl/fallback-log.jsonl`.
- `dangerous-bash.js` → Node stdlib only.
- `capture.js` → `lib/scrub.js`, `lib/obs-log.js`, `lib/project-identity.js`.
- `context-alert.js` → Node stdlib (fs, os, path, child_process, crypto).
- `observe.js` → `lib/obs-log.js`, `lib/project-identity.js`, `lib/paths.ts`.
- `session-title.js` → Node stdlib only.
- `briefing.js` → `lib/recall.js`, `lib/bookmarks.js`, `lib/obs-log.js`, `lib/project-identity.js`, `lib/open-files.js`.
- `close.js` → `lib/bookmarks.js`, `lib/scrub.js`, `lib/atomic.js`, `lib/paths.ts`, `lib/project-identity.js`.

## Relevant ADRs / intent

- [ADR-005](../../../docs/decisions/ADR-005-fallback-log-dual-metric.md) — fallback log and dual metric.
- [ADR-006](../../../docs/decisions/ADR-006-hook-fail-open-gated-blocking.md) — hook fail-open + gated blocking.
- [ADR-007](../../../docs/decisions/ADR-007-context-budgeted-injection.md) — context-budgeted injection policy.
- [ADR-025](../../../docs/decisions/ADR-025-project-identity-observer-concurrency.md) — project identity and observer concurrency.
- [Intent](../../../docs/intent/personal-harness.md) — C&M subsystem, hook safety, fail-open contract.

## Open questions / TODOs

- The dangerous-bash eval scorecard exists but is not wired into an automated CI gate.
- `context-alert.js` notifications are Darwin-only; other platforms get no backstop.
- The observer's lock TTL vs model timeout invariant is documented and defaulted but not automatically enforced by a test.
- `briefing.js` and `close.js` share similar transcript-tail parsing logic; there is no shared transcript utility yet.
