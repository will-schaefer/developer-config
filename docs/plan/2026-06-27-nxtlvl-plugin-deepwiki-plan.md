# Implementation Plan: nxtlvl Plugin DeepWiki

## Goal

Create the curated milestone-snapshot wiki in `docs/deepwiki/` per the approved design in `docs/spec/2026-06-27-nxtlvl-plugin-deepwiki-design.md`.

## Plan

### Phase 1: Scaffold

1. Create `docs/deepwiki/`.
2. Read `plugins/nxtlvl/.claude-plugin/plugin.json` and `plugins/nxtlvl/.mcp.json`.
3. Read the top-level tree of `plugins/nxtlvl/` to verify component counts.

### Phase 2: Read components

Read every component in parallel where possible:

- **Manifest**: `plugin.json`, `.mcp.json`.
- **Agents**: all `plugins/nxtlvl/agents/*.md`.
- **Commands**: all `plugins/nxtlvl/commands/*.md`.
- **Hooks**: `hooks.json`, each `*.js` hook, and `evals/dangerous-bash/*`.
- **Lib**: every `plugins/nxtlvl/lib/*.js` / `*.ts` and its test.
- **Skills**: every `plugins/nxtlvl/skills/*/SKILL.md` and key references.
- **Scripts**: `install-nxtlvl.sh`, `project-snapshot.sh`.
- **References**: `references/context7-grounding.md`.

### Phase 3: Write pages

Write each page following the content contract:

1. `index.md` — snapshot header + navigation + summary table.
2. `manifest.md` — plugin packaging + MCP configuration.
3. `agents.md` — agent inventory and contracts.
4. `commands.md` — command inventory and flows.
5. `hooks.md` — hook registry, implementations, kill switches, evals.
6. `lib.md` — library inventory, exports, tests, dependencies.
7. `skills.md` — skill inventory, triggers, key files.
8. `scripts.md` — installation and snapshot scripts.
9. `references.md` — bundled reference material.
10. `state-at-a-glance.md` — counts, health snapshot, completeness.

### Phase 4: Verify

- Cross-check file lists against the live tree.
- Add `<ref_file>` / `<ref_snippet>` citations where a claim needs grounding.
- Flag stubs, empty files, or TODO-only files explicitly.
- Read the generated wiki once through for consistency.

### Phase 5: Commit

Commit the `docs/deepwiki/` directory with a clear message.

## Notes

- This is a manual curation pass, so pages are read and written one component at a time.
- No generator or CI is introduced; future snapshots are separate work.
