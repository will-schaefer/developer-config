# Scripts

## Purpose

The `scripts/` directory contains two Bash scripts that support the plugin lifecycle and the brainstorming context-gathering flow.

## Files

| File | Role |
|---|---|
| `install-nxtlvl.sh` | Idempotent installer for the nxtlvl plugin into Claude Code. |
| `project-snapshot.sh` | Deterministic phase-1 signal gatherer for `context-scout`. |

## Contracts

### `install-nxtlvl.sh`

- Adds the repo root as a local Claude Code marketplace (`nxtlvl-dev`) and installs `nxtlvl@nxtlvl-dev` at project scope.
- Preflight-checks `claude` on PATH with a clear error message.
- Uses a helper `claude_capture()` to run CLI commands and surface their own output on failure.
- Verifies the end state by re-querying the plugin list and checking for `enabled` status.
- Safe to re-run; idempotent.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/scripts/install-nxtlvl.sh" />

### `project-snapshot.sh`

- Read-only; takes no free-text arguments (zero shell-injection surface).
- Run by the `brainstorming` orchestrator before spawning `context-scout`; stdout is inlined into the scout's prompt as a pre-gathered snapshot.
- Produces a deterministic set of signals:
  - Repo identity (branch, clean/dirty, ahead/behind, untracked count).
  - Recent commits and working-tree diff stat.
  - `docs/spec/` + `docs/decisions/` inventory.
  - Largest files (by line count, excluding vendored/generated).
  - TODO/FIXME/HACK markers.
  - Next collision-safe ADR number.
  - Language/size shape.
  - Test-harness presence (only for code trees).
- Tree-shape conditional:
  - Code tree → full snapshot.
  - Non-code tree with content → neutral snapshot (code-only probes omitted, domain-neutral labels).
  - Empty tree → one-line "empty tree — nothing to snapshot".
- Deliberately uses `set -uo pipefail` without `set -e` so benign non-zero exits (e.g., a grep with no matches) do not abort the whole script.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/scripts/project-snapshot.sh" />

## Configuration / kill switches

- `install-nxtlvl.sh` requires `claude` on PATH and a project-scope install context.
- `project-snapshot.sh` is read-only and has no kill switches; it degrades each probe independently to "— none —".

## Tests

- No automated tests for either script. The installer is validated by running it; the snapshot script is validated by the quality of the `context-scout` brief it produces.

## Dependencies

- `install-nxtlvl.sh` → `claude` CLI, `grep`, `awk`.
- `project-snapshot.sh` → `git`, `find`, `wc`, `grep`, `awk`, `xargs`, `sort`, `sed`.

## Relevant ADRs / intent

- [ADR-001](../../../docs/decisions/ADR-001-plugin-local-marketplace-packaging.md) — local marketplace packaging.
- [ADR-026](../../../docs/decisions/ADR-026-ideation-domain-orchestrator-skill-isolated-agents.md) — ideation orchestrator + context-scout snapshot.
- [Intent](../../../docs/intent/personal-harness.md) — install/promotion mechanics.

## Open questions / TODOs

- `install-nxtlvl.sh` parses `claude plugin list` output with text tools; it is sensitive to CLI output format changes.
- `project-snapshot.sh` excludes vendored/generated directories by name; new noise categories must be added manually.
- No rollback or uninstall script is provided.
