# Agent-Harness Atomic Taxonomy — the periodic table of harness engineering

> **Drafted 2026-06-22.** A complete, design-space-first decomposition of agent-harness
> engineering into its **atoms** — the smallest independently-specifiable units a harness is
> built, configured, or composed from — with a column mapping each atom to **nxtlvl's** reality.
>
> **Two jobs:**
> 1. **Foundational reference** — the harness-agnostic map of *what there is to build out of*,
>    independent of what nxtlvl chooses to build. Where the
>    [domain map](nxtlvl-domain-map.md) scopes *down* (most cells deliberately empty), this maps
>    the space *up* (exhaustive by construction).
> 2. **Backlog feeder** — every atom carries an nxtlvl status; atoms marked **◻ OPEN** are
>    uncovered design-space the harness has taken no position on, and are surfaced in
>    [§17](#17-open-atoms--intake-gate-candidates) as candidates for the reactive intake gate
>    ([ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md)). **OPEN ≠ TODO** — most
>    stay OPEN until a real task earns them; the value is in *naming* them so the choice is
>    deliberate, not accidental.
>
> **Relation to the existing maps.** This is an **orthogonal axis** to
> [`nxtlvl-domain-map.md`](nxtlvl-domain-map.md). That map answers *"which subjects/workflows/
> subsystems does nxtlvl organize around?"* (its 3 layers). This one answers *"what primitive
> elements does any harness decompose into?"* — and the two compose: see
> [§16](#16-how-this-reconciles-with-the-three-layer-domain-map). For the concrete on-disk
> inventory, the authority remains [`nxtlvl-domain-catalog.md`](nxtlvl-domain-catalog.md); for
> the per-component-type review lens, the `harness-review` skill's
> [`references/domains/`](../../plugins/nxtlvl/skills/harness-review/references/domains/). **When
> any of those disagree with this doc, the filesystem wins** — regenerate the status column from
> `plugins/nxtlvl/` + `config/claude/`.

---

## What counts as an atom

An **atom** is a unit that satisfies all three tests:

1. **Independently specifiable** — you can describe, build, configure, or reject it on its own.
2. **Irreducible *for harness purposes*** — splitting it further drops below the harness layer
   into platform internals (token sampling, file I/O) that no harness re-implements.
3. **Compositional** — it combines with other atoms to form the components, subsystems, and
   workflows of the [three-layer map](nxtlvl-domain-map.md), but is not itself one of those.

Atoms group into **families** (the "groups" of the periodic table) by the engineering concern
they serve. Families A–N below are exhaustive over the concerns; atoms within them are
exhaustive over the *current understanding* of the design space and grow as harness review
([CLAUDE.md build method](../../CLAUDE.md)) surfaces more.

---

## The coverage column — status legend

Each atom's nxtlvl status, per the build philosophy in
[`personal-harness.md`](../intent/personal-harness.md):

| Mark | Status | Meaning |
|:--:|---|---|
| ⬛ | **NATIVE** | Provided by the Claude Code platform; **never reconstructed** — the floor under everything ([ADR-003](../decisions/ADR-003-compose-not-reconstruct.md)). nxtlvl *uses* it, doesn't own it. |
| ✅ | **BUILT** | Ships today in `plugins/nxtlvl/` (plugin layer) and/or `config/claude/` (global layer). |
| 🟡 | **PLANNED** | Committed via ADR / spec / plan / backlog; not yet on disk. |
| ⛔ | **REJECTED** | Deliberately not built — a recorded *no* (ADR or intent). |
| ⚪ | **OOS** | Out-of-scope: dormant-in-ecc backstop ([ADR-002](../decisions/ADR-002-ecc-dormant-reference-backstop.md)), reached only via the logged fallback. |
| ◻ | **OPEN** | A real design-space atom nxtlvl has taken **no position on**. Feeds the intake gate (§17). |

> **Layer note.** "BUILT" spans two config layers — the **plugin** (`plugins/nxtlvl/`, the
> versioned/promoted artifact) and the **global** (`config/claude/`, the linked `~/.claude`
> surface: `settings.json`, `memory/`, `rules/`, `output-styles/`, `statusline-command.sh`).
> The `(g)` tag in the Pointer column marks atoms that live in the global layer rather than the
> plugin.

---

## A · Orchestration primitives — the native floor

*The dispatcher, the loop, the window. nxtlvl's first principle is that these stay native: a
hand-built version is structurally a slower, capped shim around the real one
([`personal-harness.md`](../intent/personal-harness.md):57–61).*

| ID | Atom | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| A1 | Skill routing | Description-triggered selection of which skill loads for a prompt | ⬛ | The router *biases* (D8); dispatch is native |
| A2 | Agent dispatch | Spawning an isolated subagent (`Task`/`Agent` tool) | ⬛ | nxtlvl owns *which* agents + *when*, not the mechanism |
| A3 | Deterministic multi-agent control | DAG-style fixed multi-agent execution (`Workflow` tool) | ⬛ | Intent: "deterministic control uses native `Workflow`" |
| A4 | Tool-use loop | The reason→call-tool→observe→repeat cycle | ⬛ | — |
| A5 | Context-window assembly | Platform-side packing of the prompt window | ⬛ | nxtlvl shapes *inputs* (family D), not the packer |
| A6 | Model inference / sampling | Token generation itself | ⬛ | — |
| A7 | Subagent context isolation | Each agent's own fresh window | ⬛ | The substrate delegation rides on (G) |
| A8 | Permission enforcement engine | The allow/deny/ask decision machinery | ⬛ | nxtlvl writes the *rules* (B5); platform enforces |

---

## B · Packaging & configuration

*How the harness is declared, layered, installed, versioned, and permissioned.*

| ID | Atom | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| B1 | Plugin manifest | The `plugin.json` that declares the plugin | ✅ | `plugins/nxtlvl/.claude-plugin/plugin.json` ([ADR-001](../decisions/ADR-001-plugin-local-marketplace-packaging.md)) |
| B2 | Marketplace / install mechanism | Local-marketplace install (never hand-edit `~/.claude`) | ✅ | `plugins/nxtlvl/scripts/install-nxtlvl.sh` |
| B3 | Layered settings | global → project → local `settings.json` precedence | ✅ | `config/claude/settings.json` (g) |
| B4 | Environment variables | Runtime config + hook kill switches | ✅ | `NXTLVL_*` switches across `hooks.json` |
| B5 | Permissions (allow/deny/ask) | The permission ruleset the engine (A8) enforces | ✅ | `settings.json` (g) |
| B6 | Permission modes | Default / accept-edits / plan / bypass posture | ⬛ | Platform feature; nxtlvl sets defaults |
| B7 | MCP server config | Declaring MCP servers the harness exposes | ✅ | `plugins/nxtlvl/.mcp.json` (context7, deepwiki) |
| B8 | Namespace | The `nxtlvl:` prefix isolating the surface | ✅ | [`personal-harness.md`](../intent/personal-harness.md):13 |
| B9 | Versioning / promotion tag | git-tag-per-promotion = rollback unit | 🟡 | [ADR-001](../decisions/ADR-001-plugin-local-marketplace-packaging.md); install script exists, tag ritual pending |
| B10 | Dev/prod separation | Workbench repo vs. installed daily driver | ✅ | This repo = workbench ([`personal-harness.md`](../intent/personal-harness.md):134–142) |
| B11 | Output style | Persona/format shaping of responses | ✅ | `config/claude/output-styles/co-builder.md` (g) |
| B12 | Keybindings | Terminal shortcut customization | ⚪ | Native config; not nxtlvl-managed |
| B13 | Statusline | Live session readout line | ✅ | `config/claude/statusline-command.sh` (g) |

---

## C · Components — the authored surface

*The five-plus component types every harness assembles from. The decisive tells live in
[`ecc-agent-vs-skill-scoping.md`](ecc-agent-vs-skill-scoping.md) and
[ADR-012](../decisions/ADR-012-agents-execute-skills-hold-knowledge.md).*

| ID | Atom | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| C1 | Command | Thin user-typed `/entry`; delegates, holds no durable logic | ✅ | 13 shipped (`commands/`) |
| C2 | Agent | Isolated, tool-scoped executor with own context | ✅ | 8 shipped (`agents/`) ([ADR-017](../decisions/ADR-017-agent-design-contract.md)) |
| C3 | Skill | Caller-agnostic methodology/knowledge loaded into context | ✅ | 8 shipped (`skills/`) ([ADR-012](../decisions/ADR-012-agents-execute-skills-hold-knowledge.md)) |
| C4 | Rule | Always-on behavioral shaping (no trigger) | ✅ | `config/claude/rules/decisions.md` (g) |
| C5 | Hook | Fires unasked on a lifecycle event | ✅ | Family F |
| C6 | Custom tool | A harness-defined tool beyond the built-ins | ◻ | No bespoke tools yet; MCP (B7) covers current need |
| C7 | MCP tool | A tool surfaced by an MCP server | ✅ | via context7 / deepwiki servers |
| C8 | Typed output contract | A JSON schema an agent must emit | ✅ | `skills/doubt-driven-development/reviewer-output.schema.json` |
| C9 | Alias / router entry | Thin entry resolving through router precedence to an upstream skill | ✅ | `/interview-me`, `/grill-me`, `/idea-refine` ([ADR-027](../decisions/ADR-027-router-endorses-only-established-items.md)) |
| C10 | Progressive-disclosure reference | A skill's `references/` loaded on demand, not up front | ✅ | `skills/harness-review/references/**` |
| C11 | Bundled script | Executable shipped inside a component | ✅ | `skills/crop/scripts/`, `lib/*.js` |
| C12 | Shared library | Cross-component helper code | ✅ | `plugins/nxtlvl/lib/` (atomic, paths, scrub, recall…) |
| C13 | Sub-agent of an agent | An agent that itself spawns agents | ⬛ | Mechanism native; composition is G |

---

## D · Context assembly & injection

*The harness's defining daily job: what earns a slot in the model's attention. The learning
artifact is the **policy**, not the plumbing ([ADR-007](../decisions/ADR-007-context-budgeted-injection.md)).*

| ID | Atom | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| D1 | Global memory file | Durable cross-project conventions | ✅ | `config/claude/CLAUDE.md` (g) |
| D2 | Project memory file | Repo-scoped durable facts | ✅ | `./CLAUDE.md` |
| D3 | SessionStart injection | Per-session dynamic "where you left off" brief | ✅ | `hooks/briefing.js` |
| D4 | Skill description surface | The text that drives per-prompt routing (A1) | ✅ | Every `SKILL.md` frontmatter |
| D5 | Context budget / token accounting | Every injected block justifies its tokens | ✅ | [ADR-007](../decisions/ADR-007-context-budgeted-injection.md); enforced as policy |
| D6 | Pointers-over-content | Inject a pointer ("read docs/…"), not the payload | ✅ | [ADR-007](../decisions/ADR-007-context-budgeted-injection.md) hard rule |
| D7 | Compaction steering | Steer the summary so the task thread survives `/compact` | ✅ | `hooks/precompact.js` |
| D8 | Per-prompt relevance routing | The router skill biasing skill selection | ✅ | `skills/nxtlvl-router/` |
| D9 | Imported / `@`-referenced files | CLAUDE.md transclusion of other files | ⬛ | Native CLAUDE.md feature; available, used sparingly |
| D10 | Context-pressure awareness | Alert as the live window fills | ✅ | `hooks/context-alert.js` (two-stage) |
| D11 | Session bookmark recall | Surface the newest "left-off" bookmark at start | ✅ | `lib/bookmarks.js` + `briefing.js` |
| D12 | Retriever / RAG over a corpus | Embed-and-fetch external knowledge into context | ⛔ | Hand-built retriever = the orchestration anti-goal ([`personal-harness.md`](../intent/personal-harness.md):182) |

---

## E · Memory & learning

*Extend native file-memory; **never** a fourth store
([ADR-004](../decisions/ADR-004-extend-native-memory.md)). The instinct lifecycle is nxtlvl's
own learning loop.*

| ID | Atom | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| E1 | Native file memory | `MEMORY.md` + `memory/*.md` durable store | ✅ | `config/claude/memory/` (g) |
| E2 | Observation capture | Record tool-call start/end to an observation log | ✅ | `hooks/capture.js` + `lib/obs-log.js` |
| E3 | Instinct distillation | Background agent distills observations → instincts | ✅ | `hooks/observe.js` + `lib/observer-runner.js` |
| E4 | Instinct lifecycle | pending → promote → evolve → prune | ✅ | `/instinct-status` `/promote` `/evolve` `/prune` + `lib/instincts.js`,`evolve.js` |
| E5 | Recall / retrieval | Quality-gated recall of strong instincts at brief time | ✅ | `lib/recall.js` |
| E6 | Memory scoping (project identity) | Bind learned facts to the right project | ✅ | `lib/project-identity.js` ([ADR-025](../decisions/ADR-025-project-identity-observer-concurrency.md)) |
| E7 | Secret scrubbing on write | Fail-closed redaction before anything persists | ✅ | `lib/scrub.js` |
| E8 | Write discipline / honesty | No "degraded mode that lies" (the ruflo anti-pattern) | ✅ | [`ruflo-distillation.md`](ruflo-distillation.md) learn-against |
| E9 | Concurrency guard | Single-flight so parallel sessions don't corrupt memory | ✅ | [ADR-025](../decisions/ADR-025-project-identity-observer-concurrency.md); `observe.js` guard |
| E10 | Role/agent-scoped memory | Per-role evolving memory (hive pattern) | ⚪ | Architectural contrast only ([`hive-analysis.md`](hive-analysis.md)) |
| E11 | Cross-session episodic store | Long-term assistant-style memory | ⛔ | "A fourth memory system" — explicitly out ([`personal-harness.md`](../intent/personal-harness.md):235) |

---

## F · Lifecycle hooks (the event surface)

*Lean, flat (one per event+matcher lane), fail-open on error
([ADR-006](../decisions/ADR-006-hook-fail-open-gated-blocking.md)). The event column is the
**full native surface**; nxtlvl occupies a subset.*

| ID | Atom (event) | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| F1 | SessionStart | Fire at session open | ✅ | `briefing.js` (session:cm-briefing) |
| F2 | UserPromptSubmit | Fire on each prompt | ✅ | `session-title.js` |
| F3 | PreToolUse | Fire before a tool runs (can block) | ✅ | `fallback-log.sh`, `dangerous-bash.js`, `capture.js` |
| F4 | PostToolUse | Fire after a tool runs | ✅ | `context-alert.js`, `capture.js`, `observe.js` |
| F5 | PreCompact | Fire before compaction | ✅ | `precompact.js` |
| F6 | SessionEnd | Fire at session close | ✅ | `close.js` (bookmark + metrics) |
| F7 | Stop | Fire when the main agent finishes a turn | ◻ | No Stop hook; candidate for a stop-slop gate (§17) |
| F8 | SubagentStop | Fire when a subagent finishes | ◻ | Uncovered |
| F9 | Notification | Fire on a notification event | ◻ | Uncovered |
| F10 | Exit-code contract | 0 = pass/warn (stderr = nudge), 2 = block | ✅ | [ADR-006](../decisions/ADR-006-hook-fail-open-gated-blocking.md) |
| F11 | Fail-open-on-error | Any crash → swallow, exit 0, never halt | ✅ | Absolute, gates included ([ADR-006](../decisions/ADR-006-hook-fail-open-gated-blocking.md)) |
| F12 | Blocking gate (whitelisted) | A *clean* exit-2 decision, intake-gated | ✅ | `dangerous-bash.js` (the one shipped gate) |
| F13 | Kill switch | Per-gate env-var disable, no reinstall | ✅ | `NXTLVL_*=off` on every hook |
| F14 | Flat registration / dispatcher | One hook per lane until a lane earns a multiplexer | ✅ | [ADR-008 hook corollary](../decisions/ADR-008-reactive-growth-intake-gate.md) |
| F15 | Detached background spawn | A hook launching non-blocking async work | ✅ | `observe.js` spawns detached observer |

---

## G · Composition & orchestration (the authored layer above native)

*Native gives dispatch (A); nxtlvl owns the **composition** — who delegates to whom, when, and
how outputs merge ([ADR-021](../decisions/ADR-021-agent-orchestration-model.md)).*

| ID | Atom | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| G1 | Orchestrator/specialist model | Lean main session delegates to scoped specialists | ✅ | [`personal-harness.md`](../intent/personal-harness.md):63–73 |
| G2 | Delegation policy | When to spawn vs. do inline | ✅ | [ADR-022](../decisions/ADR-022-agent-operation-model.md) |
| G3 | Agent chaining | One agent's output feeds the next | ✅ | Ideation pipeline ([ADR-026](../decisions/ADR-026-ideation-domain-orchestrator-skill-isolated-agents.md)) |
| G4 | Parallel fan-out | Multiple read-only agents at once | ✅ | `harness-review` fan-out |
| G5 | Output composition | How subagent results merge back | ✅ | Pointers-over-content briefs (context-scout) |
| G6 | Native-agent-+-injected-skill vs custom agent | Default to injected skill; custom only if sandbox/model/isolation demands | ✅ | [ADR-015](../decisions/ADR-015-agent-skill-load-rule-methodology-vs-spawn-target.md) |
| G7 | Context preservation via delegation | Heavy work in isolated context keeps orchestrator lean | ✅ | [`personal-harness.md`](../intent/personal-harness.md):72 |
| G8 | Workflow DAG authoring | A declared fixed multi-step topology | 🟡 | Rides native `Workflow` (A3); authored per domain as earned |
| G9 | Self-evolving topology | Agents that rewrite their own graph | ⛔ | CowAgent/autonomous-loop shape — out ([`reference-domain-map.md`](reference-domain-map.md)) |
| G10 | Capability domain (subject-matter) | A language/app-build/knowledge bucket components file under | 🟡 | Confident-core committed, unbuilt ([ADR-016](../decisions/ADR-016-confident-core-capability-domains.md)) |
| G11 | Workflow domain (verb/entry) | review · dev · research entry points | 🟡 | Phase-0 scaffolds ([nxtlvl-domain-map](nxtlvl-domain-map.md) §3) |

---

## H · Tooling & external capability

*The action surface — built-ins, MCP, and how tools are scoped per executor.*

| ID | Atom | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| H1 | Built-in tools | Read/Edit/Write/Bash/Glob/Grep/etc. | ⬛ | Platform |
| H2 | Per-agent tool scoping | Restricting an agent's tool set | ✅ | e.g. read-only reviewers ([ADR-017](../decisions/ADR-017-agent-design-contract.md)) |
| H3 | Read-only sandbox | An executor that cannot Write/Edit | ✅ | `doubt-reviewer`, `context-scout` |
| H4 | MCP server integration | Wiring an external tool server | ✅ | context7, deepwiki (`.mcp.json`) |
| H5 | Docs grounding (primary-source) | Version-pinned library docs into context | ✅ | `/context7` + `context7-scout` ([ADR-030](../decisions/ADR-030-context7-testifies-primary-sources-version-pinned.md)) |
| H6 | Repo orientation (non-evidence) | DeepWiki orientation, treated as a lead not proof | ✅ | `deepwiki-scout` ([ADR-029](../decisions/ADR-029-deepwiki-orientation-not-evidence.md)) |
| H7 | Deferred / lazy tool loading | Load tool schemas on demand to save context | ⬛ | Platform `ToolSearch` |
| H8 | GitHub operations | PR/issue/CI mechanics | ✅ | `git-workflow-runner` + `github-workflow` ([ADR-023](../decisions/ADR-023-github-workflow-skill-and-conventions.md)) |
| H9 | Browser / computer-use tool | Drive a browser or GUI | ⚪ | Dormant-ecc backstop |
| H10 | Image/screenshot handling | Crop/process visual inputs | ✅ | `/crop` + `skills/crop/` |

---

## I · Quality, audit & governance

*The gates that decide what stands — adversarial review, an objective promotion audit, and the
no-secrets floor.*

| ID | Atom | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| I1 | Five-axis review | correctness · readability · architecture · security · performance | ✅ | `skills/review/` |
| I2 | Doubt-driven adversarial review | Fresh-context reviewer biased to disprove | ✅ | `skills/doubt-driven-development/` + `doubt-reviewer` |
| I3 | Objective audit gate | Binary, scope-independent, **invoked** promotion gate | 🟡 | [ADR-009](../decisions/ADR-009-objective-invoked-audit-gate.md); `nxtlvl:audit` not yet on disk |
| I4 | Versioned audit rubric | Rubric items, deltas intra-version only | 🟡 | [ADR-009](../decisions/ADR-009-objective-invoked-audit-gate.md) |
| I5 | Secrets / no-leak gate | No secrets may land | ✅ | `lib/scrub.js` (fail-closed) |
| I6 | Dangerous-command guard | Block catastrophic shell commands | ✅ | `hooks/dangerous-bash.js` |
| I7 | Frontmatter / dead-ref validation | No dead skill/agent refs; valid frontmatter | 🟡 | Audit sub-check ([ADR-009](../decisions/ADR-009-objective-invoked-audit-gate.md)) |
| I8 | Prose-quality / stop-slop | Guard against LLM slop in shipped prose | 🟡 | [ADR-011](../decisions/ADR-011-prose-quality-stop-slop.md) + `docs/spec/nxtlvl-stop-slop-pipeline.md` |
| I9 | Quality-first-over-leanness | Tie-break favors quality, not minimalism | ✅ | [ADR-014](../decisions/ADR-014-quality-first-over-leanness.md) |
| I10 | Global decision rule | The adopt/adapt/reject decision discipline | ✅ | [ADR-010](../decisions/ADR-010-global-decision-rule.md) |
| I11 | Agent evaluation model | How an authored agent is judged good | 🟡 | [ADR-019](../decisions/ADR-019-agent-evaluation-model.md) |
| I12 | Agent debugging model | How a misbehaving agent is diagnosed | 🟡 | [ADR-020](../decisions/ADR-020-agent-debugging-model.md) |

---

## J · Observability & metrics

*The north-star substrate. You cannot improve a harness you cannot measure
([ADR-005](../decisions/ADR-005-fallback-log-dual-metric.md)).*

| ID | Atom | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| J1 | Fallback log | Hook-written record of every `ecc:` reach | ✅ | `hooks/fallback-log.sh` ([ADR-005](../decisions/ADR-005-fallback-log-dual-metric.md)) |
| J2 | North-star metric | Fallback-rate by session, trending down | ✅ | `lib/metrics.js` |
| J3 | Dual quality metric | Pair fallback-rate with a session quality check (anti-gaming) | ✅ | `lib/metrics.js` ([ADR-005](../decisions/ADR-005-fallback-log-dual-metric.md)) |
| J4 | Session metrics row | One row per session at close | ✅ | `hooks/close.js` |
| J5 | Statusline readout | Live band-colored metric/identity line | ✅ | `config/claude/statusline-command.sh` (g) |
| J6 | Session titling | Auto-name sessions for findability | ✅ | `hooks/session-title.js` |
| J7 | Structured telemetry export | Emit metrics to an external sink | ◻ | Local JSONL only today; export uncovered |
| J8 | Audit-delta tracking | Trend an audit score over time | ⛔ | North-star is fallback-rate, **not** audit-delta ([`personal-harness.md`](../intent/personal-harness.md):116) |

---

## K · Growth, evolution & meta-engineering

*How the harness decides what to become — the discipline that keeps it from re-exploding to
ecc scale.*

| ID | Atom | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| K1 | Written intake gate | One-line entry naming the task that required it + what failed | ✅ | [ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md); `docs/plan/nxtlvl-harness-adopt-backlog.md` |
| K2 | Membership test | "Want it regardless of this week's work?" → build-now vs reactive | ✅ | [`personal-harness.md`](../intent/personal-harness.md):164 |
| K3 | Harden trigger | Same logged miss N≈2–3× → revision ticket | ✅ | [ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md) |
| K4 | Harness-review method | adopt/adapt/reject review of external harnesses | ✅ | `skills/harness-review/` ([CLAUDE.md](../../CLAUDE.md)) |
| K5 | Distillation artifact | The `docs/reference/*-distillation.md` output of a review | ✅ | 15+ in `docs/reference/` |
| K6 | ADR (decision record) | The recorded *why* behind a decision | ✅ | `skills/documentation-and-adrs/` + `doc-keeper`; 30 ADRs |
| K7 | Confident-core domains | Pre-built capability domains as the brake | 🟡 | [ADR-016](../decisions/ADR-016-confident-core-capability-domains.md) (5 committed, unbuilt) |
| K8 | Dormant reference backstop | ecc as a book on the shelf, reached deliberately | ✅ | [ADR-002](../decisions/ADR-002-ecc-dormant-reference-backstop.md); `reference/ECC-main/` |
| K9 | Floor / on-demand backbone | Always-loaded floor vs. on-demand library split | ✅ | [ADR-013](../decisions/ADR-013-floor-on-demand-backbone.md) |
| K10 | Agent design contract | The house contract every agent honors | ✅ | [ADR-017](../decisions/ADR-017-agent-design-contract.md) |
| K11 | Agent authoring method | How a new agent is built | ✅ | [ADR-018](../decisions/ADR-018-agent-authoring-method.md) |
| K12 | Sandbox staging | `sandbox/` off-discovery staging; `git mv` = activation | ✅ | `sandbox/README.md` |
| K13 | In-tool authoring suite | skill-creator / plugin-creator / mcp-builder | ⚪ | CodeWhale contrast; reactive ([`reference-domain-map.md`](reference-domain-map.md)) |
| K14 | Continuous-learning optimizer loop | Auto-tuning the harness from its own telemetry | ⛔ | Deferred up-front machinery ([`personal-harness.md`](../intent/personal-harness.md):90–92) |

---

## L · Capability / subject-matter domains (the L1 axis)

*The subject buckets components file under — enumerated here only at the **family** grain;
the full taxonomy + scoping is [`nxtlvl-domain-map.md`](nxtlvl-domain-map.md) §2.*

| ID | Atom | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| L1 | Languages | per-language idioms/review (TS/JS, Python, Rust …) | 🟡 | Confident-core ([ADR-016](../decisions/ADR-016-confident-core-capability-domains.md)) |
| L2 | App-build | frontend, backend/arch, integrations, devops | 🟡 | Frontend+Backend build-now; rest reactive |
| L3 | Knowledge & research | knowledge-base / LLM-wiki construction | 🟡 | `research` is the one fresh-built workflow |
| L4 | Agentic / meta | building agents *with* the harness (dogfooded) | ✅ | This whole repo; ADRs 017–022 |
| L5 | Quality (cross-cutting) | review · testing · security across all of A–D | ✅ | Family I |
| L6 | Out-of-scope domains | content/finance/healthcare/data-ML/… | ⚪ | Dormant-ecc ([nxtlvl-domain-map](nxtlvl-domain-map.md) §2b) |

---

## M · Safety, isolation & recovery

*Restraint by construction — the harness can block, but stays "a book on the shelf, not a
coworker" by enabling few gates.*

| ID | Atom | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| M1 | Execution sandbox | OS-level command sandboxing | ⬛ | Platform sandbox; nxtlvl works within it |
| M2 | Isolation boundary | Subagent / read-only boundaries | ✅ | H2/H3 |
| M3 | Permission prompts | Ask-before-acting friction | ⬛ | Platform; nxtlvl tunes via B5 |
| M4 | Rollback | git-tag + reinstall = sub-minute recovery | 🟡 | [`personal-harness.md`](../intent/personal-harness.md):141; rides B9 |
| M5 | Fail-open philosophy | Errors never halt; blocks are clean decisions only | ✅ | [ADR-006](../decisions/ADR-006-hook-fail-open-gated-blocking.md) |
| M6 | Injection-safety | Treat tool/log/PR text as untrusted | ✅ | `fallback-log.sh` jq-safe; scrub fail-closed |
| M7 | Ask-vs-proceed posture | When to confirm vs. act autonomously | ✅ | `config/claude/rules/decisions.md` (g) |

---

## N · Model & inference layer

*The knobs on the engine the harness sits on. Mostly native; the harness *chooses*, it doesn't
build.*

| ID | Atom | One-line | nxtlvl | Pointer / note |
|--|--|--|:--:|--|
| N1 | Model selection | Which model per agent/task | ✅ | e.g. observer pinned to `claude-sonnet-4-6` (`observe.js`) |
| N2 | Reasoning / thinking budget | Extended-thinking depth | ⬛ | Platform knob |
| N3 | Prompt caching | Reuse of cached context across calls | ⬛ | Platform |
| N4 | Token / context-window budget | The window size being managed | ⬛ | Managed via family D |
| N5 | Fast mode | Faster Opus output toggle | ⬛ | Platform (`/fast`) |
| N6 | Per-task model routing policy | A rule choosing cheap vs. capable models | ◻ | Ad-hoc today; no codified policy |

---

## 16. How this reconciles with the three-layer domain map

The two maps are **orthogonal** and multiply rather than overlap:

```
                 ATOMIC TAXONOMY (this doc)  →  the building blocks (families A–N)
                                ×
THREE-LAYER MAP (nxtlvl-domain-map)  →  how nxtlvl scopes & arranges them
   L1 capability · L2 workflow · L3 architectural · NATIVE floor
```

- The domain map's **NATIVE floor** = family **A** (every atom marked ⬛) plus the ⬛ atoms in
  H/M/N. Same boundary, named at the atom grain.
- The domain map's **L3 architectural subsystems** are each *composed of* atoms here: *Context
  assembly* = family **D**; *Memory* = **E**; *Hooks* = **F**; *Composition* = **G**;
  *Audit* = **I3–I7**; *Fallback-log+metric* = **J**; *Config/packaging* = **B**.
- The domain map's **L2 workflows** (review/dev/research) are **G10/G11** here — assemblies of
  capability atoms over the subsystem atoms.
- The domain map's **L1 capability domains** are family **L** at family-grain (the domain map
  holds the full taxonomy).

So: **a subsystem (L3) is a named cluster of atoms; a workflow (L2) is a path through atoms; a
capability (L1) is a filing bucket over them.** This doc enumerates the parts; the domain map
arranges them.

---

## 17. OPEN atoms → intake-gate candidates

The backlog-feeder payload. These are atoms with **no current nxtlvl position** (◻ OPEN) — real
design-space that exists but the harness hasn't engaged. **Listing is not committing**: each
enters only via the written intake gate ([ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md)),
when a real task names it and an existing thing fails. Surfaced here so the *non*-decision is
visible.

| Atom | Why it's open | Cheapest first move if a task earns it |
|--|--|--|
| **F7 · Stop hook** | No turn-end hook; the stop-slop gate ([ADR-011](../decisions/ADR-011-prose-quality-stop-slop.md)) is the obvious tenant | Wire `Stop` to the stop-slop check once I8 ships |
| **F8 · SubagentStop hook** | No subagent-completion hook; could compose G5 output-merging | Defer until a delegation pattern needs post-processing |
| **F9 · Notification hook** | Unused native event | Defer; no driving task |
| **C6 · Custom (non-MCP) tool** | All external capability is MCP today (H4); no bespoke tool | Only if a need resists both built-ins and MCP |
| **J7 · Telemetry export** | Metrics are local JSONL; no external sink | Defer until cross-machine metric aggregation is real |
| **N6 · Per-task model-routing policy** | Model choice is ad-hoc (N1 is per-component) | Codify a cheap-vs-capable rule once cost/latency bites |

> **Confirmed *no*s are not OPEN.** D12 (RAG retriever), E11 (4th memory), G9 (self-evolving
> topology), J8 (audit-delta), K14 (optimizer loop) are ⛔ **REJECTED** — recorded decisions, not
> gaps. Reopening one is itself an ADR.

---

## Maintenance

- **Regenerate the status column** from `plugins/nxtlvl/{commands,agents,skills,hooks,lib}` +
  `config/claude/` whenever the surface changes; the filesystem and the
  [catalog](nxtlvl-domain-catalog.md) win over this doc on any disagreement.
- **Families A–N are stable**; atoms grow as harness review surfaces more of the design space.
  A new atom is a one-row add with a status; a status flip (◻→✅, or ⛔ reopened) should cite the
  ADR/commit that moved it.
- **This doc maps the space; the [fallback log](../decisions/ADR-005-fallback-log-dual-metric.md)
  decides what grows into it** — the same through-line as the domain map.
</content>
</invoke>
