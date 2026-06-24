# Plugin manifest & local-marketplace reference (confirmed vs live CC docs)

> **SUPERSEDED 2026-06-22 (decision change):** `agents-lab` is **no longer a standalone plugin** —
> it is a dev workspace whose cells graduate **into the nxtlvl plugin**, and in-flight cells are
> dogfooded as **project-scoped skills** (`.claude/skills → ../cells`; see [`../.claude/README.md`](../.claude/README.md)),
> not via a separate `.claude-plugin/` + local marketplace. The §2 "Local-marketplace install"
> section below **no longer applies to the lab**. The §1 `plugin.json` field reference is **kept**
> because it still describes the **nxtlvl plugin** (the graduation target).
>
> Originally captured for T10; sourced against **current** Claude Code docs, confirmed 2026-06-22.

## 1. `.claude-plugin/plugin.json` schema

**Source:** <https://code.claude.com/docs/en/plugins-reference.md> — "Plugin manifest schema" §.

**Required:**
- `name` (string, kebab-case) — unique plugin id; namespaces components as `/<plugin>:<component>`.

**Optional metadata** (strings unless noted):
- `displayName` · `version` (semver; omit → git SHA) · `description` ·
  `author` (`{name, email?}`) · `homepage` · `repository` · `license` ·
  `keywords` (string[]) · `defaultEnabled` (boolean, default `true`).

**Component path fields** (relative paths starting `./`; each *adds to* or *overrides* the default scan):
- `skills` · `commands` · `agents` · `hooks` · `mcpServers` · `lspServers` ·
  `outputStyles` · `experimental.themes` · `experimental.monitors`.

**Auto-discovery defaults** (no manifest entry needed):

| Component | Default location | Rule |
|-----------|------------------|------|
| Skills | `skills/` | `<name>/SKILL.md` subdirs auto-loaded |
| Commands | `commands/` | flat `.md` files (legacy; prefer `skills/`) |
| Agents | `agents/` | `.md` files auto-loaded |
| Hooks | `hooks/hooks.json` | loaded if present |
| MCP servers | `.mcp.json` | loaded if present |
| LSP servers | `.lsp.json` | loaded if present |
| Monitors | `monitors/monitors.json` | loaded if present |

**Minimal valid example:**

```json
{
  "name": "nxtlvl-agents-lab",
  "description": "agents-lab incubation pipeline — installable for dogfooding",
  "version": "0.1.0"
}
```

## 2. Local-marketplace install (for scratch-profile dogfooding)

**Source:** <https://code.claude.com/docs/en/plugin-marketplaces.md> — "Walkthrough: create a local marketplace" & "marketplace add" §.

A local marketplace is a directory with `.claude-plugin/marketplace.json` listing plugins by
local `source:` path:

```json
{
  "name": "nxtlvl-labs-local",
  "owner": { "name": "will-schaefer" },
  "plugins": [
    { "name": "nxtlvl-agents-lab", "source": "./agents-lab", "description": "incubation pipeline" }
  ]
}
```

**Command sequence (in a scratch profile):**

```bash
/plugin marketplace add ./<marketplace-dir>      # register the local marketplace
/plugin install nxtlvl-agents-lab@nxtlvl-labs-local
/plugin list                                     # verify
/plugin marketplace update nxtlvl-labs-local     # after changes
```

Non-interactive CLI equivalents: `claude plugin marketplace add ./<dir>` ·
`claude plugin install <name>@<marketplace>` · `claude plugin marketplace update <marketplace>`.
Direct-load (bypass marketplace): `claude --plugin-dir ./agents-lab`.

> **T10/T12 note:** the agent authors the on-disk manifest + wiring (T10); the actual `/plugin`
> calls are a **manual gate** (T12) — the agent cannot run `/plugin`.
