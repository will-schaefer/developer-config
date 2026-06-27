# State at a Glance

## Snapshot counts

| Component | Count | Notes |
|---|---|---|
| Agents | 8 | All specialist/read-only agents in `agents/`. |
| Commands | 12 | Slash commands in `commands/`. |
| Hook implementations | 8 | 7 Node scripts + 1 Bash script in `hooks/`. |
| Hook tests | 6 | `.test.js` files in `hooks/`; `session-title.js` currently has no test. |
| Hook evals | 4 | `evals/dangerous-bash/` corpus + adapter + config + scorecard. |
| Libraries | 13 | Shared libraries in `lib/` (11 `.js` + 2 `.ts`). |
| Library tests | 12 | `lib/*.test.js` + `paths.test.ts`; `types.ts` has no test. |
| Skills | 8 | `skills/*/SKILL.md` files. |
| Scripts | 2 | `install-nxtlvl.sh`, `project-snapshot.sh`. |
| References | 1 | `references/context7-grounding.md`. |

## Health snapshot

### What is complete and exercised

- **C&M subsystem** — capture, obs-log, observer, briefing, close, bookmarks, recall, and instincts are implemented and have unit tests.
- **Hook layer** — all hooks are registered, have kill switches, and all but `session-title.js` have tests.
- **Instinct lifecycle** — create, reinforce, promote, prune, effective-confidence decay, and graduation via `/evolve` are wired end-to-end.
- **Quality guardrails** — dangerous-bash gate, context-alert, session-title, and doubt-driven development are in place.
- **GitHub workflow** — command, agent, and skill form a complete loop.
- **Harness review** — skill + command + deepwiki-scout agent are present.

### What is thin or still an interim exception

- **`review` skill** — thin wrapper around upstream `agent-skills:review`; a fully nxtlvl-refined body is not authored yet.
- **`/grill-me`, `/interview-me`, `/idea-refine`** — thin aliases to upstream `agent-skills` skills as interim exceptions per [ADR-027](../../../docs/decisions/ADR-027-router-endorses-only-established-items.md).
- **`/context7`** — command and scout are present, but the Context7 MCP is not exercised in an automated test.
- **No README in the plugin root** — `plugins/nxtlvl/README.md` does not exist; the plugin is documented via this deepwiki and the command/skill/agent files.

### What is missing / not yet built

- **Plugin root README** — no `plugins/nxtlvl/README.md`.
- **CI / automated audit** — the audit skill exists as a concept in the intent but is not yet a file in the plugin.
- **End-to-end hook smoke test** — hooks are unit-tested in isolation but not validated as a registered set in a live Claude Code session by CI.
- **Session-title test** — `hooks/session-title.js` has no `.test.js`.
- **Cross-platform context-alert backstop** — desktop notifications are Darwin-only.

## Completeness summary

The plugin is a **walking skeleton with substantial muscle**: the core C&M loop, ideation gating, GitHub workflow, and harness review are all functional and mostly tested. The remaining gaps are either thin wrappers on upstream skills (deliberate interim exceptions) or polish/tests that the reactive growth loop can address once the fallback log shows repeat need.
