# deepagents — Mode-A harness analysis

> **deepagents (LangChain) — general review.** "The batteries-included agent harness": an
> opinionated `create_deep_agent` factory that assembles a middleware stack + pluggable backends +
> per-model profiles over LangChain `create_agent`/LangGraph, delivered as a TUI coding agent, an ACP
> bridge, and a managed-deploy CLI. Analyzed 2026-06-20 · 45M · source:
> https://github.com/langchain-ai/deepagents. Method: vendor → parallel read-only fan-out (3 domains:
> core / delivery / periphery) → quality + architecture synthesis. Scores are wiring-cited.

## Overview / thesis

deepagents is **not its own runtime** — it is a thin, opinionated *assembler* on top of LangChain's
`create_agent` + LangGraph. The entire framework reduces to one idea: **compose an ordered middleware
stack + a pluggable storage backend + a per-model profile, then hand off to `create_agent`.** That
recipe is wired exactly once (`libs/deepagents/deepagents/graph.py:236` — `create_deep_agent`) and
*reused unchanged* for the main agent, every subagent, and all three delivery surfaces (TUI, ACP,
deploy). The README's "extend, override, or replace any piece without forking" (`README.md:23`) is not
marketing — it is the literal wiring.

The central design strategy is **inject-into-one-factory, never fork it**, defended by *engineered*
(not asserted) robustness: un-excludable scaffolding that raises rather than silently degrades,
multi-stage fail-loud config validation, enforced filesystem permissions, and per-package threat
models backed by real guard code. Its honest ceiling is architectural, not qualitative — because
deepagents delegates execution/recursion/checkpointing to LangGraph, a slice of its correctness rests
on upstream behavior pinned to specific PR numbers rather than locally-owned invariants.

## Architecture map

```
create_deep_agent(graph.py:236)  ──the one factory, reused everywhere──
  ├─ ordered middleware stack   TodoList→Skills?→Filesystem→SubAgent?→Summarization
  │                             →PatchToolCalls→user→profile.extra→ToolExclusion
  │                             →PromptCaching→Memory?→HITL?      (graph.py:751-814)
  ├─ pluggable backends         BackendProtocol ABC; State(default)/Filesystem/Store/
  │                             LocalShell/Sandbox/Composite(prefix-routed)  (backends/)
  ├─ profiles                   ProviderProfile (model construction) ⟂
  │                             HarnessProfile (runtime: prompt/tools/middleware)  (profiles/)
  └─ subagents                  `task` tool → compiled inner agent built by the SAME recipe
                                                                   (middleware/subagents.py)

DELIVERY (libs/) — three shells, one unchanged factory:
  code  → Textual TUI coding agent (create_cli_agent, ~53k LOC)   inject SDK middleware+backends
  acp   → Agent Client Protocol bridge (agent-agnostic server + BYO build_agent factory)
  cli   → deploy-only tooling (init/deploy/agents) to managed LangSmith API

PERIPHERY — examples/ (14 teaching demos) + .github/ (reference-grade, self-tested CI/release rig)
```

## Per-component deep-dive

### Core framework (`libs/deepagents`) — the spine — **4.7/5**
One public entry point assembles a precisely-ordered middleware list (the docstring order
`graph.py:328-366` matches the wiring exactly), filters it by the profile's `excluded_middleware`, and
hands off to `create_agent` with a forced `recursion_limit: 9_999`. State sits on a `DeltaChannel`
with a custom reducer cutting checkpoint growth O(N²)→O(N) (`_messages_reducer.py:31-90`) — a real,
load-bearing optimization. Backends are a uniform `BackendProtocol` ABC with async twins; the
`CompositeBackend` routes by longest path-prefix (`backends/composite.py:163`). Profiles split model
*construction* (`ProviderProfile`) from agent *runtime* (`HarnessProfile`), with built-ins registered
explicitly so a broken `dist-info` can't disable SDK defaults (`profiles/_builtin_profiles.py:148`).

**Engineered robustness** is the standout: `_REQUIRED_MIDDLEWARE` makes scaffolding un-excludable
(strip it → `ValueError`, `graph.py:206`); a three-stage exclusion guard verifies that an exclusion
matching *nothing* raises rather than no-ops (`_excluded_middleware.py:168`); filesystem permissions
are enforced at 14+ tool sites with deny-returns-error (`filesystem.py:963…`); lazy bootstrap is
thread-safe with full rollback (`_builtin_profiles.py:134`). Backed by a 2.2:1 test:src ratio (~45K
test LOC / ~20K core). **Caps:** a 630-line `create_deep_agent` with `C901/PLR0912/PLR0915` all
silenced and a near-duplicated GP/main build path — the one place composition discipline slips; plus
correctness pinned to upstream PRs (`subagents.py:684` cites langgraph#7926/#3634).

### Delivery & extension (`libs/code` + `libs/cli` + `libs/acp`) — **4.2/5**
Three genuinely different shells over the one unchanged factory: a 53k-LOC Textual TUI coding agent
(`code`, entry `create_cli_agent` at `agent.py:1100`), an ACP protocol bridge whose `server.py` is
agent-agnostic and takes a BYO `build_agent` factory (`acp`), and a deploy-only CLI after the REPL was
deliberately *moved out* (`cli/README.md:9`). The load-bearing pattern — **inject SDK
middleware/backends, never fork** — is documented at the seams (`code/skills/load.py:1` reuses SDK
internals and says so; MCP OAuth is an ordered registry + ABC, `mcp_providers/_registry.py:13`).
**Security ships as code, not prose:** ~60KB threat models per package backed by a 563-LOC
`unicode_security.py` feeding approval prompts, an allow-list shell middleware that rejects inline as
error `ToolMessage`s, and a `PYTHONPATH` leak guard (`agent.py:1083`). **Caps:** a 12.7k-LOC `app.py`
god-module, a 16-parameter/490-line factory whose PTC resolver is a genuine thicket
(`agent.py:229-370`), per-surface `LocalContextMiddleware` duplication, and a deliberate **PTC→HITL
approval bypass** (`agent.py:1180`) — the single soft spot in an otherwise tight approval model.

### Periphery (`examples/` + `.github/`) — two-faced, **does not cap the harness**
A coherent 14-project **teaching gallery** (signal about intended usage: "agent = `AGENTS.md` + `skills/`
+ `subagents.yaml`", `content-builder-agent/README.md:9`) bolted to a **reference-grade CI/release
rig**: 36 workflows, path-filtered monorepo matrix, *unit-tested CI scripts* (8 `test_*` files),
release guards that re-resolve manifests against **real PyPI** before publish (`check_release_deps.py:1`),
and a `ci_success` gate that reasons about cancellation semantics rather than blanket-passing
(`ci.yml:446`). Examples carry ordinary demo fragility (hard-pinned model IDs, experimental runtimes)
and aren't CI-covered — noted as demo, not scored as craft. The CI half would *raise* a whole-harness
robustness rollup; "periphery" undersells it.

## Strategy & workflow

A task flows: `create_deep_agent` resolves the model → looks up its `HarnessProfile` → assembles the
ordered middleware stack → filters by profile exclusions → compiles via `create_agent`. At runtime,
middleware mediate every turn (todos, skills, filesystem, summarization, prompt-caching, optional
HITL); the `task` tool recurses into compiled subagents built by the *same* recipe, which strip
private state, inherit-or-override permissions, and return a single distilled `ToolMessage`. Delivery
packages don't change any of this — they pre-build a middleware list + composite backend and inject.
The harness optimizes for **long-horizon, multi-step work that stays extensible without forking**, and
the wiring honors that claim.

## Quality assessment (scored)

| Domain | Cohesion | Composition | Robustness | Discoverability | Clarity | Effectiveness | Rollup |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Core framework | 5 | 5 | 5 | 4 | 4 | 5 | **4.7** |
| Delivery & extension | 4 | 5 | 4 | 4 | 4 | 4 | **4.2** |
| Periphery (CI / examples) | 4 | 5 | 5 | 4 | 5 | 4 | (CI strong; examples demo) |

**Overall verdict — ~4.4/5, reference-grade.** deepagents is one of the most architecturally
disciplined harnesses in the review set: a single composition thesis ("assemble over `create_agent`,
never fork") carried *consistently* from the core factory through subagents to three delivery shells,
with robustness that is engineered and test-backed rather than asserted, and security that ships as
guard code plus threat models. Nothing fatal caps it. The honest limits are (1) architectural — it is
a thin opinionated layer over LangChain/LangGraph, so part of its correctness is upstream-pinned, not
locally owned; and (2) a recurring **god-function/god-module** smell (the 630-line factory, the 12.7k
`app.py`) where the otherwise-tight composition discipline relaxes. For a harness builder the mineable
lessons are concrete: **inject-middleware-into-one-factory** composition, **ordered-registry + ABC**
provider extension, **fail-loud config validation that raises on a no-op exclusion**, **enforced (not
advisory) permissions**, and **threat-model-as-shipped-artifact**.

---
*Mode-A general review. The load-bearing caveat for any roll-up: deepagents is a thin assembler over
LangChain/LangGraph — judge it as composition + robustness craft, not as an independent runtime.*
