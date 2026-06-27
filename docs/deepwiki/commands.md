# Commands

## Purpose

The `commands/` directory contains 12 slash commands. They are the discoverable entry points of the plugin. Some are thin aliases into skills; others orchestrate agents or run small Node snippets against the C&M libraries.

## Files

| Command | Description | Argument hint |
|---|---|---|
| `/brainstorm` | Front door for any creative/build work; invokes `brainstorming` skill on main thread. | `[idea]` (optional) |
| `/context7` | Ground a claim in official library docs via `context7-scout`. | `<library>[@version] — <question>` |
| `/doc-keeper` | Dispatch `doc-keeper` agent to record docs/ADRs. | `[what to document]` (optional) |
| `/evolve` | List instinct graduation candidates or author artifacts. | `[--generate]` |
| `/git-workflow` | Drive the current change through the GitHub loop. | `[what to ship]` (optional) |
| `/grill-me` | Thin alias into `grill-me` skill for deep plan/design interrogation. | `[plan/design]` (optional) |
| `/harness-review` | Invoke `harness-review` skill to analyze an external harness. | `<mode A|B|C> <REPO> [extras]` |
| `/idea-refine` | Thin alias into `idea-refine` skill for divergent/convergent ideation. | `[rough concept]` (optional) |
| `/instinct-status` | Show C&M instinct store + fallback-rate metrics. | none |
| `/interview-me` | Thin alias into `interview-me` skill for intent extraction. | `[ask/idea]` (optional) |
| `/promote` | Lift a project instinct to global scope (≥0.8 effective confidence). | `[instinct-id]` (optional) |
| `/prune` | Dry-run (default) or delete stale pending instincts. | `[--confirm] [--max-age N]` |

## Contracts

### `/brainstorm`

- The front door for creative/build work.
- Invokes the `brainstorming` **skill on the main thread** (not as an agent) because the interview is interactive.
- Composes `context-scout` (context sweep), `interview-me` / `grill-me` / `idea-refine` (intent sharpening), and `idea-critic` (pre-approval critique).
- On approval hands off to `spec-driven-development` → `planning-and-task-breakdown`.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/commands/brainstorm.md" />

### `/context7`

- Parses `/context7 <library>[@version] — <question>`.
- Spawns `context7-scout` and relays its cited brief unmodified.
- Degrades to one-line "unavailable" caveat if Context7 fails.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/commands/context7.md" />

### `/doc-keeper`

- Dispatches `nxtlvl:doc-keeper` agent with the user's argument.
- If no argument is given, asks the user what to document before launching.
- Relays the agent's structured report (status, changed files, next_actions).

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/commands/doc-keeper.md" />

### `/evolve`

- Dry-run by default. Only authors artifacts when `--generate` is passed.
- Runs `lib/evolve.js` to cluster strong instincts into candidates (`agent`, `skill`, `command`).
- On `--generate`, dispatches `nxtlvl:evolver` for each candidate.
- Artifacts land in `.claude/evolved/` for manual review/promotion.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/commands/evolve.md" />

### `/git-workflow`

- Spawns `git-workflow-runner` agent to execute branch → commit → PR → review → CI → merge.
- The agent has no `Write`/`Edit`; code fixes surface back to the main session.
- Composes `nxtlvl:review` at the review step.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/commands/git-workflow.md" />

### `/grill-me`, `/interview-me`, `/idea-refine`

- Thin aliases into upstream `agent-skills` skills as interim exceptions.
- Each invokes its named skill on the main thread.
- Will be retired once nxtlvl-refined bodies ship.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/commands/grill-me.md" />
<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/commands/interview-me.md" />
<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/commands/idea-refine.md" />

### `/harness-review`

- Entry surface for the `harness-review` skill.
- Supports three modes: A (general review), B (adopt/adapt/reject), C (domain review).
- For public GitHub repos, optionally uses `deepwiki-scout` for orientation (leads only, not evidence).

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/commands/harness-review.md" />

### `/instinct-status`

- Runs a Node snippet against `lib/instincts.js` and `lib/metrics.js`.
- Lists project-scoped and global instincts ranked by effective confidence.
- Shows confidence-distribution histogram and fallback-rate readout.
- No LLM judgment; prints the snippet output verbatim.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/commands/instinct-status.md" />

### `/promote`

- Promotes a project-scoped instinct to global if its effective confidence is ≥ 0.8.
- With no argument, lists eligible project instincts.
- Uses `lib/instincts.promote` (atomic: write global copy first, then remove project file).

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/commands/promote.md" />

### `/prune`

- Dry-run by default; deletes only with `--confirm`.
- Removes pending instincts that are: effective confidence < 0.7, never reinforced, and older than 30 days (or `--max-age N`).
- Uses `lib/instincts.remove`.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/commands/prune.md" />

## Configuration / kill switches

- `/evolve` is gated by `--generate` to prevent accidental writes.
- `/prune` is gated by `--confirm` to prevent accidental deletes.
- `/promote` enforces the 0.8 effective-confidence bar before calling `lib/instincts.promote`.
- `NXTLVL_INSTINCT_HALFLIFE_DAYS` affects the decay math in `/instinct-status`, `/promote`, and `/prune`.

## Tests

- No dedicated command tests. Commands are thin orchestration wrappers; their logic is exercised through the agents/libs they call and through real usage.

## Dependencies

- `/brainstorm` → `skills/brainstorming/SKILL.md` + agents.
- `/context7` → `agents/context7-scout.md` + `.mcp.json`.
- `/doc-keeper` → `agents/doc-keeper.md` + `skills/documentation-and-adrs/SKILL.md`.
- `/evolve` → `lib/evolve.js` + `agents/evolver.md`.
- `/git-workflow` → `agents/git-workflow-runner.md` + `skills/github-workflow/SKILL.md` + `skills/review/SKILL.md`.
- `/grill-me`, `/interview-me`, `/idea-refine` → upstream `agent-skills` skills (interim exceptions).
- `/harness-review` → `skills/harness-review/SKILL.md` + `agents/deepwiki-scout.md` (optional).
- `/instinct-status`, `/promote`, `/prune` → `lib/instincts.js` + `lib/metrics.js` + `lib/project-identity.js`.

## Relevant ADRs / intent

- [ADR-003](../../../docs/decisions/ADR-003-compose-not-reconstruct.md) — compose, don't reconstruct.
- [ADR-024](../../../docs/decisions/ADR-024-git-workflows-domain-command-agent-skill.md) — git-workflows domain command + agent + skill.
- [ADR-027](../../../docs/decisions/ADR-027-router-endorses-only-established-items.md) — router endorses only established items; interim exceptions.
- [ADR-029](../../../docs/decisions/ADR-029-deepwiki-orientation-not-evidence.md) — harness-review DeepWiki orientation.
- [Intent](../../../docs/intent/personal-harness.md) — C&M floor, fallback-rate metric, reactive growth.

## Open questions / TODOs

- `/grill-me`, `/interview-me`, `/idea-refine` are interim aliases; their nxtlvl bodies are not authored yet.
- `/harness-review` currently has no automated test coverage; its contract is validated by manual runs.
- No unified command test harness exists; commands are tested indirectly through their subsystems.
