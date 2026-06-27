# Manifest & Packaging

## Purpose

The plugin is packaged as a Claude Code local-marketplace plugin. These files declare the plugin identity, register bundled MCP servers, and define how the plugin is installed from the repo into Claude Code.

## Files

| File | Role |
|---|---|
| `.claude-plugin/plugin.json` | Plugin identity: name `nxtlvl`, description "Personal agent harness for building next-level agents." |
| `.mcp.json` | Registers two bundled MCP servers: `deepwiki` and `context7`. |
| `scripts/install-nxtlvl.sh` | Idempotent installer that adds the local marketplace and installs the plugin at project scope. |

## Contracts

### `.claude-plugin/plugin.json`

Minimal Claude Code plugin manifest. Only `name` and `description` are declared; the plugin content is discovered conventionally from sibling directories (`agents/`, `commands/`, `skills/`, `hooks/`, `lib/`).

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/.claude-plugin/plugin.json" />

### `.mcp.json`

Defines two HTTP MCP servers used by nxtlvl agents:

- `deepwiki` — `https://mcp.deepwiki.com/mcp` (used by `deepwiki-scout` for orientation leads).
- `context7` — `https://mcp.context7.com/mcp` (used by `context7-scout` for docs-grounding).

Tool grants in agent frontmatter must use the namespaced form `mcp__plugin_nxtlvl_<server>__*`; the bare `mcp__<server>__*` form grants nothing.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/.mcp.json" />

### `scripts/install-nxtlvl.sh`

Idempotent, project-scope install script:

1. Preflight-checks that `claude` is on PATH.
2. Adds the repo root as a local marketplace `nxtlvl-dev` if not already present.
3. Installs `nxtlvl@nxtlvl-dev` if not already installed.
4. Verifies the end state by re-querying the plugin list and checking status for `enabled`.

It is the source of truth for installing the plugin from this repo; the per-machine `settings.json` path is gitignored.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/scripts/install-nxtlvl.sh" />

## Configuration / kill switches

- `claude` CLI must be on PATH.
- The plugin loads at the start of a new Claude Code session; the installer warns that a new session is needed for skills/hooks to register.
- No env vars in the manifest itself.

## Tests

- No automated tests for the installer or manifest. Verification is manual via `install-nxtlvl.sh` and starting a new Claude Code session.

## Dependencies

- Claude Code CLI (`claude`) for installation and hook/skill registration.
- `mcp.deepwiki.com` and `mcp.context7.com` at runtime (degrade gracefully when unavailable).

## Relevant ADRs / intent

- [ADR-001](../../../docs/decisions/ADR-001-plugin-local-marketplace-packaging.md) — plugin local-marketplace packaging.
- [ADR-029](../../../docs/decisions/ADR-029-deepwiki-orientation-not-evidence.md) — DeepWiki produces leads, not evidence.
- [ADR-030](../../../docs/decisions/ADR-030-context7-testifies-primary-sources-version-pinned.md) — Context7 testifies; cite doc URL, version-pinned.
- [Intent](../../../docs/intent/personal-harness.md) — the plugin's purpose and scope.

## Open questions / TODOs

- The installer currently parses `claude plugin list` output with grep/awk; it could break if the CLI output format changes.
- No rollback script is provided beyond the intent doc's "git tag + reinstall" procedure.
