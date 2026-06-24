# agent-dev

The **agent-development domain** carved out of [ECC](https://github.com/affaan-m/ECC) as a
standalone, self-contained Claude Code plugin — skills, agents, and commands for *building agents*,
without the rest of ECC's 271-skill surface.

Vendored from `reference/ECC-main` (ECC's `agentic-patterns` skill module plus the matching agents
and commands, which ECC itself ships monolithically). Frozen at copy time; update by re-vendoring.

## What's inside

### Skills (23) — invoke as `/<skill-name>`
`agent-architecture-audit`, `agent-harness-construction`, `agentic-engineering`, `agentic-os`,
`ai-first-engineering`, `autonomous-loops`, `blueprint`, `claude-devfleet`, `content-hash-cache-pattern`,
`continuous-agent-loop`, `cost-aware-llm-pipeline`, `data-scraper-agent`, `dynamic-workflow-mode`,
`enterprise-agent-ops`, `nanoclaw-repl`, `prompt-optimizer`, `ralphinho-rfc-pipeline`,
`regex-vs-llm-structured-text`, `search-first`, `team-agent-orchestration`, `team-builder`,
`token-budget-advisor`, `continuous-learning-v2`

### Agents (6)
`harness-optimizer`, `loop-operator`, `agent-evaluator`, `gan-planner`, `gan-generator`, `gan-evaluator`

### Commands (10) — invoke as `/<command>`
`loop-start`, `loop-status`, `gan-build`, `gan-design`, `harness-audit`, `evolve`,
`instinct-export`, `instinct-import`, `instinct-status`, `santa-loop`

## Provenance & scope notes
- The skill set is ECC's `agentic-patterns` module verbatim. `continuous-learning-v2` was added on
  top to satisfy the `evolve` / `instinct-*` commands, which target the instinct system.
- ECC's `agents-core` and `commands-core` are all-or-nothing, so the 6 agents and 10 commands here
  were hand-picked as the ones belonging to this domain.
- ECC rules, hooks-runtime, and platform configs are intentionally **not** included — skills, agents,
  and commands only.

## Operational caveats
- **Instinct system is hook-driven.** `continuous-learning-v2` + `evolve` + `instinct-*` observe
  sessions via hooks and write learned instincts under `.claude/homunculus/`. The skill bundles its
  own `hooks/` and `scripts/`, but they must be wired into your `settings.json` to actually capture
  anything. Without that wiring, `instinct-status` simply reports an empty store.
- **`nanoclaw-repl` expects `scripts/claw.js`.** The helper is vendored at
  `plugins/agent-dev/scripts/claw.js`; the skill refers to it by the relative path `scripts/claw.js`,
  so run it from the plugin root (or adjust the path) if it doesn't resolve.
- The `adding-tests-agent` mentioned in `evolve.md` is illustrative example output, not a dependency.

## Install
Registered in this repo's `nxtlvl-dev` marketplace
(`/.claude-plugin/marketplace.json`) as the `agent-dev` plugin, source `./plugins/agent-dev`.
