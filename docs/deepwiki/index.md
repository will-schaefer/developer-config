# nxtlvl Plugin — DeepWiki Snapshot

> **Snapshot date:** 2026-06-27  
> **Snapshot commit:** `240348b`  
> **Scope:** the `plugins/nxtlvl/` Claude Code plugin as of this commit.

## What this is

A hand-curated, file-by-file milestone snapshot of the nxtlvl plugin — the personal agent harness built in this repo. It is read-oriented documentation, not a build target. Use it to orient yourself (or a subagent) to the plugin's current shape, contracts, and open questions without re-scanning the tree.

## Plugin at a glance

nxtlvl is a Claude Code plugin that layers a personal harness on top of native Claude Code. It provides:

- **Ideation / design gating** — front-door commands that shape ideas before implementation.
- **Context & Memory (C&M)** — observation capture, instinct distillation, bookmarks, and session briefing.
- **Quality & safety guardrails** — a dangerous-bash gate, context-alert, and adversarial review skills.
- **GitHub workflow** — a standardized branch → commit → PR → review → CI → merge loop.
- **Harness review** — a method for analyzing external agent harnesses via parallel fan-out.

The plugin is intentionally **scoped** — it does not try to cover every SDLC phase. Unowned phases (implementation specifics, testing, debugging, security, performance, CI/CD, observability, shipping) are handled natively per [ADR-027](../../../docs/decisions/ADR-027-router-endorses-only-established-items.md).

## Pages

| Page | What you'll find |
|---|---|
| [Manifest](manifest.md) | `plugin.json`, `.mcp.json`, packaging |
| [Agents](agents.md) | 8 read-only / specialist agents |
| [Commands](commands.md) | 12 slash commands |
| [Hooks](hooks.md) | 8 hook implementations + `hooks.json` registry + evals |
| [Libraries](lib.md) | 13 shared libraries that power hooks/commands |
| [Skills](skills.md) | 8 nxtlvl skills and the router |
| [Scripts](scripts.md) | Install + project-snapshot scripts |
| [References](references.md) | Bundled reference docs |
| [State at a glance](state-at-a-glance.md) | Counts, health snapshot, completeness |

## How to read this wiki

- Every page follows the same contract: purpose → files → contracts → configuration → tests → dependencies → relevant ADRs → open questions.
- Claims are tied to actual files in `plugins/nxtlvl/`. Where a specific detail matters, look at the cited file directly.
- Stubs, empty files, or TODO-only files are called out explicitly so the snapshot does not overstate completeness.

## Open questions across the plugin

- Several command files are thin aliases that currently point to upstream `agent-skills` skills as interim exceptions; their nxtlvl-refined bodies are planned but not authored yet.
- The `review` skill is a thin wrapper around the upstream `agent-skills:review` workflow; nxtlvl conventions are applied but not a fully reconstructed skill.
- The C&M subsystem has extensive tests but the integration path (live observer spawning, hook registration validation) is exercised primarily by the unit tests rather than an end-to-end smoke test in CI.
