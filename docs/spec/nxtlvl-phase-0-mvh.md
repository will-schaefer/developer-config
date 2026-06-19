# Spec: `nxtlvl` Phase 0 — Minimum Viable Harness (MVH)

> Spec-driven-development artifact (Phase 1: Specify). Consumes the confirmed intent
> [`docs/intent/personal-harness.md`](../intent/personal-harness.md) (interview-me + grill-me, 2026-06-16).
> Scope is **strictly Phase 0 / the walking skeleton**, not the full reconstruction backlog.
> Plugin/marketplace/hook facts below were verified against current Claude Code docs
> (code.claude.com/docs/en/plugins, /plugins-reference, /plugin-marketplaces, /hooks) on 2026-06-16.
> **One fact is *not* yet runtime-verified** — the exact PreToolUse `Skill`/`Task` stdin field that
> carries the invoked (`ecc:`-prefixed) name — and is gated behind the **M0 spike** (see Milestones).
> Status: **DRAFT, revised after a doubt-driven review pass (2026-06-16); awaiting human review.**

## Objective

Build the **thinnest end-to-end slice that runs one real session on `nxtlvl`** — a Claude Code
plugin installed via a local marketplace — then thicken to the seven Phase-0 target contents.
Success = `nxtlvl` is the primary harness from first install, ecc is dormant-but-present, and the
fallback log is ticking so the north-star metric can baseline.

**User:** me, daily, on my real multi-language workload. **Why now:** deliberate rebuild after wiping
`~/.claude`; I want a harness I own to the metal.

**Learning target:** the *harness architecture* (packaging, context assembly, memory, composition,
hooks) — **not** the SDLC substance. The workflow layer composes agent-skills; it is not rebuilt.

### Emphasis: the plugin is the envelope, not the product

The plugin packaging (`plugin.json`, `marketplace.json`, install dance, namespacing) is a
**delivery boundary, not the deliverable.** It earns its place only because it is the *cheapest
native way* to get what the intent already requires — dev/prod separation, promotion-as-install,
git-tag rollback, and ecc-dormant coexistence without namespace collision. Dropping it would mean
either losing dev/prod separation or hand-rolling a worse installer (reconstructing what's native —
a stated anti-goal). So it stays, but as **one-time table-stakes**: stand it up once (Milestone 0,
~an hour), prove it installs, then freeze it.

**Production quality lives elsewhere.** The harness is judged by context assembly (intent line 56,
"highest daily leverage; *is* the harness's job"), memory, the composition layer, and the hook
layer — backlog items 2–5. **The real task budget is spent on those four, enumerated as Milestones
M1–M7 below, each with a concrete deliverable and binary check.** The plugin is the envelope; M1–M7
are the letter. (Packaging appears early only because it is M0's table-stakes; the *specification
weight* below is deliberately tilted toward the four high-value contents, per this section's rule.)

### In scope (Phase 0)

- **Milestone 0 — walking skeleton:** the thinnest vertical slice — minimal plugin manifest +
  `nxtlvl:review` (composes `agent-skills:review`) + the fallback-log hook + the **stdin spike** —
  **proven to install and run one real session.** M0 ships deliberately *thin* slices of contents
  #1/#5/#6/#7; the later milestones thicken them.
- **Milestones M1–M7 — the seven Phase-0 target contents** (intent lines 126–133), one per
  milestone, fully enumerated in the **Milestones** section below: layered config (#1) · build loop
  (#2) · memory (#3) · context-injection (#4) · three workflow scaffolds (#5) · fail-open hook layer
  + fallback-log hook (#6) · the fallback log + metric baseline (#7).

> **Composition layer note (intent backlog item #4):** "when skills fire, how agents chain into
> workflows, how outputs compose" is **not a separate Phase-0 deliverable** — in Phase 0 it is
> *expressed through* M2 (the build loop) and M5 (the three workflow scaffolds). The v1 skeletons
> **are** the composition layer's first concrete expression. Intentional, not an omission.

### Out of scope (Phase 0 — deferred to later phases per intent)

- **The audit (`nxtlvl:audit`)** — backlog item 6, "built last because it needs something to
  measure." Not a Phase-0 content. Its rubric stays an open question until the harness exists.
- The full reconstruction backlog beyond skeleton-grade scaffolds (deep context-assembly policy,
  composition-layer maturity, hook breadth).
- ecc breadth, continuous-learning/governance/optimizer machinery, a fourth memory system.
- Reconstructing orchestration primitives (router/dispatch/tool-loop) — **native, always.**

## Milestones (one content each; M0 is the vertical slice that thins #1/#5/#6/#7)

Each milestone names its Phase-0 content (intent line), the reconstruction-backlog item it advances,
its deliverable file(s), and a **binary** check. M0 builds *thin* slices of several contents to
prove end-to-end; M1/M5/M6/M7 then thicken those same slices — that thin→thick relationship is the
walking-skeleton method, not double-booking. M0–M7 = eight milestones = walking skeleton + seven
contents; the arithmetic closes.

| Milestone | Phase-0 content (intent) | Backlog | Deliverable | Binary check |
|---|---|---|---|---|
| **M0 — walking skeleton** | thin slices of #1, #5, #6, #7 | 1, 5 | minimal `plugin.json` + `marketplace.json`; `skills/review/SKILL.md`; `hooks/hooks.json` + `fallback-log.sh`; **the stdin spike** | installs with no error; `nxtlvl:review` runs one real session to completion; **spike confirms** a PreToolUse `Skill`/`Task` call delivers the invoked name on stdin and it is extractable |
| **M1 — layered config (#1)** | line 126 | 1 | global `~/.claude/CLAUDE.md` (durable conventions) + project `Developer/.claude/CLAUDE.md` (+ the M0 manifest) | both layers parse; a project-only value **and** a global-only value are both observable in one session (coordination proven, no collision) |
| **M2 — build loop (#2)** | line 127 | (method) | `nxtlvl:dev` composing the agent-skills `/spec → /plan → /build → /test → /review` loop, refined for fit; documented as the construction workflow | each of the five stages is invokable; one trivial change is driven end-to-end through the loop |
| **M3 — memory (#3)** | line 128 | 3 | **extends the existing native file-memory** (`~/.claude/projects/<proj>/memory/` — `MEMORY.md` index + per-fact files). Phase-0 delta = layer it global-vs-project + surface it via the M4 context pointer. **No new store.** | a fact saved to native memory in one session is recalled in a fresh session via the native mechanism; **zero new storage code** added |
| **M4 — context-injection (#4)** | line 129 | 2 | `hooks/session-context.sh` — SessionStart payload: git branch + dirty flag, current-task pointer, last *N* fallback-log entries. **Pointers, not content;** token-budgeted | injects a bounded block (≤ stated token budget); never halts a session, even on error; every block justifies its tokens or is cut |
| **M5 — workflow scaffolds (#5)** | line 130 | 4 | `review` (from M0) + `dev` (the M2 loop) + `research` (built fresh; `deep-research` as structural reference only) — **v1 skeletons, not ecc-parity polish** | all three invokable as `nxtlvl:<name>`; each runs to completion on a real task |
| **M6 — hook layer (#6)** | line 132 | 5 | lean fail-open hook layer: `fallback-log.sh` (thickened from M0) + `session-context.sh` + `session-metrics.sh`, wired in `hooks.json`; fault-injection proof | every hook exits 0 under a deliberately faulted body; the session is never blocked |
| **M7 — fallback log + metric baseline (#7)** | line 133 | (metric) | `~/.claude/nxtlvl/fallback-log.jsonl` (hook-written) + `~/.claude/nxtlvl/sessions.jsonl` (SessionEnd auto-row + manual `quality`); baselines the dual fallback-rate × quality metric | an `ecc:` Skill/Task invocation appends **exactly one** well-formed JSONL line (non-ecc none); session end appends one `sessions.jsonl` row; dual metric is computable |

**Sequencing:** M0 first (proves the envelope + resolves the stdin spike, which de-risks M7). Then
M1→M4 are the high-leverage reconstruction (config, build loop, memory, context). M5 thickens the
workflows, M6 hardens the hooks, M7 turns on the metric.

## Platform facts (verified against docs 2026-06-16; one item gated behind the M0 spike)

| Concern | Resolved value | Status |
|---|---|---|
| Plugin manifest | `plugins/nxtlvl/.claude-plugin/plugin.json`; only `name` required. Components (`skills/`, `agents/`, `commands/`, `hooks/`) live at **plugin root**, never inside `.claude-plugin/`. | verified |
| Namespace | Derived from `plugin.json` `name` → skills/agents prefixed `nxtlvl:<thing>`. A skill at `skills/review/SKILL.md` is **user-invokable** as `/nxtlvl:review` and also model-invokable; the slash form is the smoke-test path. | verified |
| Local marketplace | `.claude-plugin/marketplace.json` at **repo root**; `owner.name` required; plugin entry `source: "./plugins/nxtlvl"` (relative to marketplace root). | verified |
| Install / update / remove | `/plugin marketplace add <abs-path-to-repo>` → `/plugin install nxtlvl@nxtlvl-dev` → `/plugin marketplace update nxtlvl-dev`. The `@nxtlvl-dev` token resolves to `marketplace.json`'s `name` (not the directory). Never hand-edit `~/.claude`. | verified |
| Hook exit codes | Hook reads event JSON on **stdin**, writes stdout. Exit 0 + no JSON = no-op (allow). **Exit 2 blocks only for blocking-capable events** (PreToolUse, UserPromptSubmit, …); **SessionStart / SessionEnd / Notification cannot be blocked** — exit 2 prints stderr and continues. Our session hooks **fail open regardless**: exit 0, no output, on any error. | verified |
| PreToolUse matcher | `"matcher": "Skill\|Task\|Agent"` — PreToolUse matches on **tool name**. **M0 spike (2026-06-17):** skills fire via the `Skill` tool; subagents fire via the **`Agent`** tool in this harness (the spec originally assumed `Task`). The matcher `Skill\|Task` empirically caught the `Agent` call, but use `Skill\|Task\|Agent` so subagent reaches are never missed regardless of the tool label. | verified (spike) |
| **Hook stdin → invoked name** | **RESOLVED by M0 spike (2026-06-17).** PreToolUse stdin exposes the invoked (`ecc:`-prefixed) name in `tool_input`; the field depends on the tool: **`Skill` → `tool_input.skill`** (captured `"ecc:aside"`); **`Agent`/subagent → `tool_input.subagent_type`** (captured `"ecc:code-explorer"`). Append iff the value starts with `ecc:`. Most robust extraction: branch on which field is present, not on `tool_name`. | **verified (spike)** |
| Plugin root var | `${CLAUDE_PLUGIN_ROOT}` resolves to the installed plugin dir — use it in hook `command` paths. | verified |

> **Why the gate matters:** the entire north-star metric rides on the hook reading the invoked name.
> Docs confirm PreToolUse matches tool names and that `Skill`/`Task` are tools, but do **not** pin the
> `tool_input` field that carries the skill/agent name. M0's spike (invoke an `ecc:` skill, dump the
> raw stdin, confirm the name is extractable) resolves this **before** the fallback log is trusted.
> Do not relabel this row "verified" until the spike passes.

## Tech Stack

- **Platform:** Claude Code plugin system (manifest + skills/agents/commands/hooks + local marketplace).
- **Hook scripts:** POSIX shell (`bash`/`sh`) + `python3` for JSON handling (already on the machine).
- **Composition substance:** vendored `agent-skills` skills (refined for fit, not rebuilt).
- **Memory:** the **native Claude Code file-memory already in place** (`MEMORY.md` index + per-fact
  files under `~/.claude/projects/<proj>/memory/`). Phase 0 *extends* it (layering + a context
  pointer); it builds no new store.
- **Reference/backstop:** ecc — installed but **dormant** (not loaded by default; re-enable is a
  deliberate, logged act). ecc's active hooks (GateGuard, `pre:observe`, …) are **off** during build.
- **VCS:** git; **one tag per promotion** (rollback = checkout previous tag + reinstall).

## Commands

```bash
# Install the workbench plugin into the daily driver (run from interactive `claude`)
/plugin marketplace add /Users/willschaefer/Developer      # adds repo-root marketplace "nxtlvl-dev"
/plugin install nxtlvl@nxtlvl-dev                          # installs the plugin, namespace nxtlvl:

# Iterate → re-install after edits
/plugin marketplace update nxtlvl-dev

# Smoke-test the skeleton (manual, before promotion)
/nxtlvl:review                                             # composes agent-skills:review on the current diff

# M0 spike — confirm the PreToolUse stdin exposes the invoked name (run once; gate for M7)
#   temporarily point fallback-log.sh at a debug branch that writes raw stdin to a file,
#   invoke any ecc: skill, then inspect:
cat ~/.claude/nxtlvl/spike-stdin.json                      # must contain the ecc:-prefixed name

# Validate manifests parse (workbench shell)
python3 -c "import json; json.load(open('.claude-plugin/marketplace.json'))"
python3 -c "import json; json.load(open('plugins/nxtlvl/.claude-plugin/plugin.json'))"

# Inspect the metric baselines
cat ~/.claude/nxtlvl/fallback-log.jsonl
cat ~/.claude/nxtlvl/sessions.jsonl

# Promote = git tag
git tag -a nxtlvl-phase0-mvh -m "Phase 0 walking skeleton promoted"
```

## Project Structure

```
Developer/                                  ← the workbench repo (churn lives here)
├── .claude-plugin/
│   └── marketplace.json                    ← M0: marketplace "nxtlvl-dev", lists ./plugins/nxtlvl
├── .claude/                                ← M1: PROJECT config layer (overrides/extends global)
│   ├── settings.local.json                 ←   pre-existing; permissions/env for the workbench
│   └── CLAUDE.md                            ←   M1: project-scoped durable conventions
├── plugins/
│   └── nxtlvl/                             ← THE plugin (source of the install)
│       ├── .claude-plugin/
│       │   └── plugin.json                 ← M0: name "nxtlvl", version, description
│       ├── skills/
│       │   ├── review/SKILL.md             ← M0: composes agent-skills:review
│       │   ├── dev/SKILL.md                ← M2/M5: composes the agent-skills build loop (v1)
│       │   └── research/SKILL.md           ← M5: built fresh; deep-research as structural ref only
│       ├── hooks/
│       │   ├── hooks.json                  ← M0/M6: PreToolUse(Skill|Task) + SessionStart + SessionEnd
│       │   ├── fallback-log.sh             ← M0→M6: append ecc-reach to the log (fail-open)
│       │   ├── session-context.sh          ← M4: budgeted context injection (fail-open)
│       │   └── session-metrics.sh          ← M6/M7: auto-write session row for dual metric (fail-open)
│       └── commands/                        ← (empty until reactive growth needs it)
├── config/                                  ← pre-existing workbench config (NOT the layered-config content; untouched)
└── docs/
    ├── intent/personal-harness.md          ← the anchor
    └── spec/nxtlvl-phase-0-mvh.md          ← this spec

~/.claude/                                   ← the DAILY DRIVER (stable; only proven changes land)
├── CLAUDE.md                                ← M1: GLOBAL durable conventions (base layer)
├── projects/<proj>/memory/                  ← M3: native file-memory (MEMORY.md + per-fact files), extended not replaced
└── nxtlvl/
    ├── fallback-log.jsonl                  ← M7: hook-written; powers the metric, backlog, un-defer
    └── sessions.jsonl                      ← M7: SessionEnd-written rows + one manual quality score each
```

## Code Style / Conventions

**`plugin.json` (minimal, versioned for pinning):**
```json
{
  "name": "nxtlvl",
  "version": "0.0.1",
  "description": "Personal agent harness for building next-level agents."
}
```

**`marketplace.json`:**
```json
{
  "name": "nxtlvl-dev",
  "owner": { "name": "will-schaefer" },
  "plugins": [
    { "name": "nxtlvl", "source": "./plugins/nxtlvl", "description": "Personal agent harness." }
  ]
}
```

**Skill (`skills/review/SKILL.md`) — compose, don't reconstruct:**
```markdown
---
description: nxtlvl review — runs the agent-skills five-axis review, refined for my conventions.
---

Invoke the agent-skills:review workflow on the current diff. Apply nxtlvl conventions:
language-plural (pull the right reviewer for the changed files), surface assumptions,
prefer pointers over dumped content. $ARGUMENTS
```

**Skill (`skills/dev/SKILL.md`) — v1 composes the loop (does not copy), per Resolved Decision 4:**
```markdown
---
description: nxtlvl dev — drives a change through the agent-skills /spec → /plan → /build → /test → /review loop, refined for my conventions.
---

Drive this change through the build loop by composing the agent-skills stages:
spec → plan → build → test → review. Pull the language-appropriate reviewer
(Next/Python/Rust) for the changed files; stop at each gate for confirmation;
pointers over dumped content. (Vendoring individual agent-skills skills stays
reactive — Open Question for Plan.) $ARGUMENTS
```

**Skill (`skills/research/SKILL.md`) — minimal built skeleton, per Resolved Decision 4:**
```markdown
---
description: nxtlvl research — fan-out web search, verify claims, synthesize a cited answer.
---

Research the question: fan-out web search → fetch sources → verify claims → synthesize a
cited report. (v1 skeleton; deep-research is a STRUCTURAL reference only — this does NOT
compose ecc, which is dormant. Deliberately reshaped by the first few real research tasks.)
$ARGUMENTS
```

**Hook (`hooks/hooks.json`) — fail-open is absolute:**
```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Skill|Task",
        "hooks": [ { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/fallback-log.sh" } ] }
    ],
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/session-context.sh" } ] }
    ],
    "SessionEnd": [
      { "hooks": [ { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/session-metrics.sh" } ] }
    ]
  }
}
```

**`fallback-log.sh` contract:** read event JSON on stdin → extract the invoked name —
**`Skill` → `tool_input.skill`**, **`Agent`/subagent → `tool_input.subagent_type`** (confirmed by
the M0 spike, 2026-06-17; branch on which field is present, not on `tool_name`) → if it is
`ecc:`-prefixed, append one JSONL line `{timestamp, ecc_thing, task}` to
`~/.claude/nxtlvl/fallback-log.jsonl` → **always `exit 0`, never emit a decision.** Any internal
error is swallowed. Non-ecc invocations append nothing.

**`session-context.sh` contract (M4):** read the SessionStart event on stdin → assemble a
**bounded** pointer block, emit it as the hook's `additionalContext` → **always `exit 0`**, even on
error. Payload, in priority order, **token-budgeted** — the budget is a *soft backstop* (densify
first; shed only non-earning blocks, never proven value to hit a number;
[ADR-012](../decisions/ADR-012-quality-first-over-leanness.md)); cut the lowest-value block first if
still over:
1. git: current branch + dirty/clean flag (one line).
2. current-task pointer: e.g. `task in progress → read docs/spec/nxtlvl-phase-0-mvh.md` (a *pointer*,
   never the file's content).
3. last *N* (default 3) `fallback-log.jsonl` entries as a one-line digest — what ecc was reached for
   recently, so the reactive backlog stays visible.

**`session-metrics.sh` contract (M6/M7):** on SessionEnd, append one row
`{timestamp, session_id, ecc_fallback_count}` to `~/.claude/nxtlvl/sessions.jsonl` (count derived
from this session's `fallback-log.jsonl` entries) → **always `exit 0`** (cannot block; fail-open for
hygiene). The single `quality` field (1–5 / "did I redo this") is appended **by hand** — so only one
number is manual and the dual (fallback-rate × quality) metric is computable from the first session.

**Conventions:** kebab-case skill/hook names; `${CLAUDE_PLUGIN_ROOT}` for all in-plugin paths;
every auto-injected context block justifies its tokens or is cut (**pointers > content**) — the cut
sheds non-earners, never proven value to hit the budget
([ADR-012](../decisions/ADR-012-quality-first-over-leanness.md)).

## Testing / Verification Strategy

No code framework — verification is **install + smoke-test + fault-injection**, gated manually until
the audit exists (Phase ≥1). Each milestone's binary check (see the Milestones table) is the gate;
the cross-cutting checks below back the Success Criteria:

- **Manifests parse** (`python3 -c json.load …`) — marketplace + plugin; all `SKILL.md` frontmatter valid.
- **Install works**: `/plugin install nxtlvl@nxtlvl-dev` succeeds; `nxtlvl:review` is listed and runs.
- **Spike (M0)**: a PreToolUse `Skill`/`Task` call's raw stdin is captured and the invoked name is
  shown to be extractable — the precondition for the fallback log.
- **Layered config (M1)**: a project-only value and a global-only value are both observable in one
  session — proves the two layers coordinate without collision.
- **Build loop (M2)**: the five stages are individually invokable; one trivial change runs end-to-end.
- **Memory (M3)**: a fact saved in one session is recalled in a fresh session via the native
  mechanism, with no new storage system introduced.
- **Context hook bound (M4)**: `session-context.sh` injects a bounded pointer block (≤ budget) and
  never halts a session, even on error.
- **Fallback log correctness (M7)**: an `ecc:`-prefixed Skill/Task appends exactly one well-formed
  JSONL line; a non-ecc invocation appends none.
- **Session metric (M7)**: on session end, `session-metrics.sh` appends one `sessions.jsonl` row
  (fail-open); the `quality` field is hand-appendable.
- **Fail-open proof / fault injection (M6)**: deliberately break a hook's body (e.g. point it at a
  missing file) and confirm the session is **not** blocked and the hook still exits 0.
- **End-to-end**: one full real work session runs on `nxtlvl` with **ecc not loaded by default**.

## Boundaries

**Always**
- Install only via local-marketplace (`/plugin …`); **never hand-edit `~/.claude`**.
- Session hooks **fail open** — exit 0, do nothing on any internal error.
- Smoke-test in the workbench/scratch profile **before** promoting.
- **git-tag every promotion** (rollback = checkout previous tag + reinstall; ecc-dormant is the net).

**Ask first**
- Re-enabling ecc (a deliberate act — every reach is logged).
- Adding any new skill/workflow — must pass the **written intake gate** (one-line backlog entry
  naming the task that required it + the existing thing that failed).
- Adding dependencies or new hook events.

**Never**
- Reconstruct orchestration primitives (skill router / agent dispatch / tool-loop) — native.
- Build a fourth memory system — extend native CC file-memory only.
- Ship a session hook that can block a session (only the *invoked* audit may block, later).
- Commit secrets; promote with a failing audit (once the audit exists).

## Success Criteria (testable, binary, mapped to milestones)

1. **(packaging, M0)** `/plugin marketplace add <repo>` + `/plugin install nxtlvl@nxtlvl-dev` succeed with no error.
2. **(spike, M0)** A PreToolUse `Skill`/`Task` invocation's stdin is captured and the invoked name is
   shown to be extractable — the fallback log's precondition is met before M7 is built.
3. **(parse, M0)** `marketplace.json`, `plugin.json`, and every `SKILL.md` frontmatter parse.
4. **(#5 review, M0/M5)** `nxtlvl:review` is invokable and **produces a report addressing all five
   named axes** on a real diff (binary: five axes present + runs to completion, not a stub/error).
5. **(#1 layered config, M1)** Global `~/.claude/CLAUDE.md` and project `.claude/CLAUDE.md` both load;
   a project-only value **and** a global-only value are both observable in one session.
6. **(#2 build loop, M2)** The five stages are each invokable; one trivial change is driven end-to-end
   through `/spec → /plan → /build → /test → /review`.
7. **(#3 memory, M3)** A fact saved to native memory in one session is recalled in a fresh session via
   the native mechanism; **no new storage system** is introduced.
8. **(#4 context-injection, M4)** The SessionStart hook injects a bounded pointer block (≤ the stated
   token budget) and never halts a session, even on error.
9. **(#7 fallback log, M7)** An `ecc:`-prefixed Skill/Task invocation appends **exactly one** well-formed
   JSONL line to `~/.claude/nxtlvl/fallback-log.jsonl`; non-ecc invocations append nothing.
10. **(#7 dual metric, M7)** On session end, `session-metrics.sh` appends one row
    `{timestamp, session_id, ecc_fallback_count}` to `~/.claude/nxtlvl/sessions.jsonl` (fail-open); the
    `quality` field is hand-appendable — making the dual (fallback-rate × quality) metric computable.
11. **(#6 fail-open, M6)** The fallback-log hook returns exit 0 **even with its body faulted** (proven
    by injection); the session is not blocked.
12. **(integration)** One full real session runs end-to-end on `nxtlvl` with ecc **dormant** (not loaded
    by default).
13. **(promotion)** A git tag marks the first promotable state; the rollback path is exercised once.

## Resolved Decisions (were Open Questions — settled 2026-06-16)

1. **Marketplace name** → `nxtlvl-dev`. Install string: `/plugin install nxtlvl@nxtlvl-dev`.
2. **Fallback-log path** → **global** `~/.claude/nxtlvl/fallback-log.jsonl`. The north-star is
   per-session across *all* work; a global log captures every session and survives reinstall.
   (Rejected project-local: fragments the signal, misses non-repo sessions.)
3. **Dual quality metric** → **auto row + one manual score.** A fail-open `SessionEnd` hook
   (`session-metrics.sh`) auto-writes the rot-prone fields — `{timestamp, session_id,
   ecc_fallback_count}` — to `~/.claude/nxtlvl/sessions.jsonl`; I append the single `quality` field
   (1–5 / "did I redo this") by hand. Keeps the anti-gaming dual metric measurable from day one while
   honoring "manual logs rot" (only one number is manual).
4. **dev/research scaffolds** → `nxtlvl:dev` v1 **composes** (does not copy) the agent-skills
   `/spec→/plan→/build→/test→/review` loop; vendoring individual skills stays reactive. `nxtlvl:research`
   v1 is a **minimal built skeleton** (web-search fan-out → synthesize) using `deep-research` as a
   *structural reference only* — it does **not** compose ecc (dormant).
5. **ecc hook disablement** → **ecc made dormant** via `~/.claude/settings.json`
   `enabledPlugins."ecc@ecc": false` (done 2026-06-16; effective next CC restart). The env-var
   band-aid `ECC_GATEGUARD=off` was *already present in settings and proved ineffective* — full
   dormancy is the reliable fix and matches the intent end-state. Re-enable = flip to `true` (a
   deliberate, logged act). The `ecc` marketplace stays in `extraKnownMarketplaces` (still installed).

### Still genuinely open (out of Phase-0 scope)

6. **Audit rubric** — deferred until the harness exists (intent line 202); the audit is backlog item 6,
   built last. Not a Phase-0 content.

> **Resolved by M0 (no longer open):** the PreToolUse `Skill`/`Task` stdin field that carries the
> invoked name — the M0 spike gates it before M7 builds on it.
