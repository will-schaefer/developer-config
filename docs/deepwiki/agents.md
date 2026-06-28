# Agents

## Purpose

The `agents/` directory contains 8 read-only or specialist agents that the main session or commands spawn to do isolated work. Each agent is a single markdown file with YAML frontmatter defining its name, description, tools, and model. Agents hold no skill knowledge themselves; they load skills as their source of truth where needed.

## Files

| Agent | Description | Model | Tools |
|---|---|---|---|
| `context-scout.md` | Read-only context sweep for the brainstorming skill. | sonnet | Read, Grep, Glob |
| `context7-scout.md` | Read-only docs-grounding via Context7. | sonnet | `mcp__plugin_nxtlvl_context7__*` + WebFetch |
| `deepwiki-scout.md` | Read-only DeepWiki orientation for harness-review. | sonnet | `mcp__plugin_nxtlvl_deepwiki__*` + WebFetch |
| `doc-keeper.md` | Documentation & ADR keeper. | sonnet | Read, Write, Edit, Grep, Glob, Bash, Skill |
| `doubt-reviewer.md` | Fresh-context adversarial reviewer for doubt-driven development. | sonnet | Read, Grep, Glob |
| `evolver.md` | Authors evolved artifacts from instinct clusters. | sonnet | Read, Write, Skill |
| `git-workflow-runner.md` | GitHub-loop executor. | sonnet | Read, Grep, Glob, Bash, Skill |
| `idea-critic.md` | Fresh-context idea critique before the brainstorming approval gate. | sonnet | Read, Grep, Glob |

## Contracts

### `context-scout`

- Spawned by the `brainstorming` skill at its "explore project context" seam.
- Returns a **pointers-over-content** brief: `path/to/file.ts:142` with a one-line why, no pasted code blocks.
- May receive a pre-gathered snapshot from `scripts/project-snapshot.sh`; if present, it digests it but never relays it.
- Ends with 2–4 open questions for the interview.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/agents/context-scout.md" />

### `context7-scout`

- Grounds a library/API claim in official docs via Context7.
- Every returned claim is stamped `CITE — /org/project@version + doc URL`.
- Budget: 1 `resolve-library-id` + ≤3 `query-docs`.
- Degrades to one-line "unavailable" if Context7 fails or the library doesn't resolve.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/agents/context7-scout.md" />

### `deepwiki-scout`

- Used by the `harness-review` skill at Phase 2 (structural map & partition) for public GitHub repos.
- Returns lead-stamped orientation: every claim is `LEAD — verify at source`, never a citation in the final artifact.
- Budget: 1 `read_wiki_structure` + 3–5 `ask_question` calls.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/agents/deepwiki-scout.md" />

### `doc-keeper`

- Invoked by `/doc-keeper` to record ADRs, specs, plans, changelogs, or README updates.
- Loads the `documentation-and-adrs` skill as its source of truth.
- Routes decisions to ADRs (architectural + expensive-to-reverse), specs (verified facts), plans (methodology), or amends existing ADRs.
- Returns a structured report: status, summary, changed files, verification, next_actions.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/agents/doc-keeper.md" />

### `doubt-reviewer`

- Spawned by the `doubt-driven-development` skill at Step 3 (DOUBT).
- Biased to DISPROVE, never to approve.
- Receives only `ARTIFACT + CONTRACT`; the author's claim is stripped to avoid bias.
- Returns JSON conforming to `reviewer-output.schema.json`.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/agents/doubt-reviewer.md" />

### `evolver`

- Dispatched by `/evolve --generate` to author one artifact (skill, command, or agent) from a cluster of strong instincts.
- Loads the `skill-creator` skill for conventions; falls back to documented defaults if unavailable.
- Writes to `<project-root>/.claude/evolved/` (off the discovery path) for user review and promotion.
- Tags every artifact with source instinct ids in a trailing comment.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/agents/evolver.md" />

### `git-workflow-runner`

- Executes branch → commit → PR → review → CI → merge in an isolated context.
- Has `Bash` but no `Write`/`Edit` — it cannot modify source; code fixes hand back to the caller.
- Composes `nxtlvl:review` at the review step.
- Loads the `github-workflow` skill as its source of truth.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/agents/git-workflow-runner.md" />

### `idea-critic`

- Spawned by `brainstorming` just before the approval gate.
- Reviews an idea draft (not a finished artifact) for holes and risks.
- Returns a Markdown verdict: `holes_found | clean | cannot_assess` with findings and a probe per finding.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/agents/idea-critic.md" />

## Configuration / kill switches

- Agent behavior is controlled by the env vars and kill switches of the skills they execute, not by per-agent env vars.
- `context7-scout` and `deepwiki-scout` degrade gracefully when their MCP servers are unavailable.

## Tests

- No dedicated agent tests; each agent is a prompt + contract document. Effectiveness is validated by the commands/skills that spawn them and by the quality of produced artifacts.

## Dependencies

- `context-scout` depends on `scripts/project-snapshot.sh` (optional accelerator).
- `context7-scout` / `deepwiki-scout` depend on the MCP servers declared in `.mcp.json`.
- `doc-keeper` depends on `skills/documentation-and-adrs/SKILL.md`.
- `doubt-reviewer` depends on `skills/doubt-driven-development/reviewer-output.schema.json`.
- `evolver` depends on `lib/evolve.js` (clustering engine) and `skill-creator` skill.
- `git-workflow-runner` depends on `skills/github-workflow/SKILL.md` and `nxtlvl:review`.
- `idea-critic` is a standalone adversarial reviewer.

## Relevant ADRs / intent

- [ADR-012](../../../docs/decisions/ADR-012-agents-execute-skills-hold-knowledge.md) — agents execute; skills hold knowledge.
- [ADR-017](../../../docs/decisions/ADR-017-agent-design-contract.md) — agent design contract.
- [ADR-018](../../../docs/decisions/ADR-018-ideation-domain.md) — ideation orchestrator skill + isolated agents.
- [ADR-025](../../../docs/decisions/ADR-025-deepwiki-orientation-not-evidence.md) — DeepWiki leads.
- [ADR-026](../../../docs/decisions/ADR-026-context7-testifies-primary-sources.md) — Context7 evidence.

## Open questions / TODOs

- No agent currently has automated unit tests; correctness is validated by the output contracts they produce in real usage.
- `context-scout` and `idea-critic` are optimized for the brainstorming flow; their reuse outside that flow is untested.
