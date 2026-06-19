# Claude Code Hooks Mastery — Distillation (Adopt / Adapt / Reject)

> Distilled 2026-06-19 from `reference/claude-code-hooks-mastery-main`
> (`disler/claude-code-hooks-mastery`, shallow clone of `main`, `.git` stripped, gitignored).
> A **teaching/demo** harness for Claude Code's hook lifecycle, subagents, the meta-agent, and
> team-based validation. Analyzed read-only across three subsystems — hooks, agents/orchestration,
> philosophy/periphery — with each finding cited to `file:line`. **Purpose:** record an
> adopt/adapt/reject judgment so the vendored clone can stay a disposable "book on the shelf"
> (per the vendoring doctrine — only the analysis is tracked). Companion to
> [ecc-agent-vs-skill-scoping.md](ecc-agent-vs-skill-scoping.md).

---

## 1. What it is, and the thesis

`disler/claude-code-hooks-mastery` is a **demonstration harness** — its job is to *teach* Claude
Code's control surfaces by exercising every one of them, not to be a production toolset. That
framing is the lens for everything below: the repo is **high signal mixed with deliberate demo
filler**, and the distillation's first job is to separate the two.

**Structure at a glance** (`.claude/` unless noted):

| Subsystem | What's there | Signal vs demo |
|-----------|--------------|----------------|
| **Hooks** | 13 lifecycle scripts (`hooks/*.py`) + 4 `validators/` + `utils/{llm,tts}` | **High signal** — the core of the repo |
| **Agents** | `meta-agent`, `team/{builder,validator}`, `work-completion-summary`, `crypto/*` (×12), `hello-world`, `llm-ai-agents-and-eng-research` | Mixed — patterns signal, crypto/hello-world demo |
| **Commands** | `prime`/`prime_tts`, `plan_w_team`, `build`, `all_tools`, `question`, `git_status` + `cook`/`sentient`/`crypto_research*` | Mixed — `prime`/`plan_w_team` signal, rest demo |
| **Output styles** | 8 (`output-styles/*.md`) | Mostly confirmation — you already run one |
| **Status lines** | 9 versions (`status_lines/status_line*.py`) | v6/v9 signal (context-window HUD) |
| **Docs/specs** | `ai_docs/*` (verbatim upstream-doc scrapes + `legacy/`), `specs/*`, `apps/*` | `ai_docs`/`specs` patterns; `apps/` is demo |

**The thesis — deterministic vs non-deterministic control.** The repo's entire worldview is one
axis, stated in the README's opening and restated as its closing claim:

> "add **deterministic (or non-deterministic) control over Claude Code's behavior**" (`README.md:3`)
>
> "Hooks provide **deterministic control over Claude Code behavior without relying on LLM
> decisions**." (`README.md:277`)

Hooks are *code that runs regardless of what the model decides*. The model is non-deterministic;
hooks are the deterministic backstop wired into the lifecycle — what the model can be *prevented*
from doing (PreToolUse block), *forced* to do (Stop-hook continuation), *fed* (SessionStart /
UserPromptSubmit injection), and what's *observed* regardless of cooperation (every event logged
to `logs/*.json`).

A second, more transferable claim appears in the team-validation section:

> "the difference between **agentic engineering and 'vibe coding'—you know the outcome your agent
> will generate because you've templated the format**." (`README.md:773`)

That is the repo's best idea: **predictability of agent output is engineered, not hoped for** —
via templated meta-prompts, self-validating hooks, and deterministic gates.

**Why this matters for nxtlvl up front:** this thesis sits in direct tension with nxtlvl's
settled doctrine that *hooks inform, they don't force* (memory: `harness-hooks-inform-not-force`). The
repo *celebrates* forcing the agent; nxtlvl deliberately rejected that. The most valuable thing
here is therefore not a feature to copy but a **worked counter-position** — and, paradoxically,
strong evidence *for* nxtlvl's call (see §2). The reusable craft (flow-control reference, the
read-only validator, the `prime` ritual, the context-window HUD) is real and is catalogued in
§3–§5; the adopt/adapt/reject ledger is §6.

---

## 2. Headline — "deterministic control" vs "inform, don't force"

This is where the harness and nxtlvl most visibly disagree — and where the disagreement turns
out to *support* nxtlvl.

**Two stances.**

| | hooks-mastery | nxtlvl |
|--|--|--|
| Posture | Hooks *force* — block, redirect, compel continuation | Hooks *inform* — surface signals, never steer mid-task |
| What may block | Anything the lifecycle allows (PreToolUse, UserPromptSubmit, Stop, SubagentStop) | Exactly one narrow **objective** gate (dangerous-bash, `exit 2`) |
| Behavior shaping | Done in hooks (Stop-hook continuation, prompt gating) | Done in **rules**, not hooks (task-sizing, ask-vs-proceed) |
| Rhetoric | "deterministic control… without relying on LLM decisions" (`README.md:277`) | "hooks inform, don't force" (memory: `harness-hooks-inform-not-force`) |

The repo's flow-control reference enumerates the *capability* to force (`README.md:308-361`):
UserPromptSubmit "CAN BLOCK PROMPTS", PreToolUse "CAN BLOCK TOOL EXECUTION", and — the sharpest
case — Stop "CAN BLOCK STOPPING. Exit 2 **forces continuation**… *Can cause infinite loops if not
properly controlled*." Compelling the agent to keep working is the exact move nxtlvl's doctrine
rules out.

**The paradox: the shipped config mostly informs.** Despite the rhetoric, what the repo actually
*wires* in `.claude/settings.json` blocks on **exactly one event** — PreToolUse (`pre_tool_use.py`:
dangerous-`rm` + `.env`-access, `exit(2)` with stderr to Claude, `:96`). Everything else is
log-only or context-injection: PostToolUse logs; SessionStart/Setup *inject* context but cannot
block; Stop/Notification/Subagent hooks only log (+ optional TTS). The two hooks that *could* gate
— UserPromptSubmit and PermissionRequest — are wired `--log-only`; their `--validate` /
`--auto-allow` flags are **not** turned on. So the harness's deployed posture, stripped of its
rhetoric, is: **one objective gate, everything else informs** — which is nxtlvl's doctrine almost
exactly.

**Stronger still: fail-open discipline.** Every hook wraps `main()` in
`try/except json.JSONDecodeError: exit(0)` + bare `except Exception: exit(0)`
(`pre_tool_use.py:131-136`, uniform across all 13). A crashing or buggy hook **never** blocks the
agent; only the *deliberate* `exit(2)` path does. That is precisely nxtlvl's "fail toward silence"
posture (the context-alert hook's fail-silent `writeState`; the dangerous-bash gate's kill switch).
An author who *philosophically embraces* forcing still ships fail-open — independent evidence that
"inform by default, block only on objective facts" is the natural resting point, not a timid
compromise.

**The one real divergence — and where nxtlvl draws the line.** The repo *does* ship genuine
force-the-agent machinery, just not in the default wiring: the Stop-event validators
(`validators/validate_new_file.py`, `validate_file_contains.py`) return
`{"result":"block","reason":...}` with **prescriptive prompts** ("ACTION REQUIRED: Use the Write
tool… Do not stop until the file has been created") to compel self-correction, and
`plan_w_team.md` attaches such a Stop-hook to force a complete plan. This is behavior-forcing — the
class nxtlvl rejects (forcing continuation = mid-task steering). The split for nxtlvl is clean:
**adopt the flow-control *knowledge*; reject the force-*continuation* applications; keep blocking
reserved for objective facts** (dangerous command, secret access) — never for "the agent didn't do
the thing I wanted."

**Synthesis — predictability without forcing.** The repo's best idea (`README.md:773`: "you know
the outcome… because you've templated the format") is compatible with nxtlvl — but nxtlvl already
buys predictability *upstream*, through house formats (spec → plan → ADR, the review rubric), not
*at runtime* through forcing hooks. Same goal (predictable agent output), opposite mechanism:
**template the inputs, don't compel the outputs.** That reframing is the headline takeaway; §6's ledger is where it gets applied, item by item.

---

## 3. Hook subsystem — lifecycle, flow control, architecture

The hooks are the repo's core and its most reusable knowledge. All wiring is in
`.claude/settings.json:24-167`; every event uses an empty `matcher: ""` (fires on all tools)
except `UserPromptSubmit`.

### 3.1 Lifecycle inventory (13 events; `README.md:169` claims "11/13 validated" — its phrase for "exercised in the demo", unrelated to the §4 *validator* agents)

| Event | Script | Blocks? | Role in the demo |
|-------|--------|---------|------------------|
| **PreToolUse** | `pre_tool_use.py` | **YES** (`exit 2`) | The one live gate: blocks dangerous `rm` + `.env` access; else logs |
| **PostToolUse** | `post_tool_use.py` | no | Logs payload |
| **PostToolUseFailure** | `post_tool_use_failure.py` | no | Logs structured failure (error, tool_use_id) |
| **UserPromptSubmit** | `user_prompt_submit.py` | *capable*, wired log-only | Logs prompt; generates a session "agent name"; `--validate` (block) not wired |
| **PreCompact** | `pre_compact.py` | no | Logs; reads `trigger` (manual/auto); optional transcript `--backup` |
| **SessionStart** | `session_start.py` | no (injects) | `--load-context`: injects git status + `CONTEXT.md`/`TODO.md` + recent issues as `additionalContext` |
| **SessionEnd** | `session_end.py` | no | Logs; `--cleanup` prunes `.tmp` + stale `chat.json` |
| **Stop** | `stop.py` | *capable*, not used | Logs; `--chat` dumps transcript; optional TTS completion |
| **SubagentStart** | `subagent_start.py` | no | Logs subagent spawn |
| **SubagentStop** | `subagent_stop.py` | *capable*, not used | Logs; LLM-summarizes subagent work; TTS with a file-lock queue |
| **Notification** | `notification.py` | no | Logs; TTS "agent needs input" |
| **PermissionRequest** | `permission_request.py` | *capable*, wired log-only | Logs; `--auto-allow` (decide allow/deny + rewrite input) not wired |
| **Setup** | `setup.py` | no (injects) | Detects stack, checks deps, persists `PROJECT_ROOT`; injects `additionalContext` |

Net: **only PreToolUse blocks in the shipped config.** Four hooks are block-*capable* but run
log-only or unused — the gap between capability and deployment that §2 leans on.

### 3.2 Flow-control reference (the keystone — `README.md:290-468`)

The genuinely portable, language-agnostic platform knowledge. Three control channels —
**but read the 8-vs-13 caveat at the foot of this section before copying any table verbatim:**

**(a) Exit codes** (`:298-302`):

| Exit | Behavior |
|------|----------|
| **0** | Success. `stdout` shown to user in transcript mode (Ctrl-R). |
| **2** | **Blocking error.** `stderr` is fed back to *Claude* automatically (hook-specific — see below). |
| other | Non-blocking. `stderr` shown to *user*; execution continues. |

**(b) Which events `exit 2` actually blocks** (`:308-361`):
- **UserPromptSubmit** — blocks the prompt (error → user); `stdout` is injected as context.
- **PreToolUse** — blocks the tool call (error → Claude).
- **PostToolUse** — *cannot* undo (tool already ran); error → Claude only.
- **Stop / SubagentStop** — blocks stopping, i.e. **forces continuation** (error → Claude).
  *"Can cause infinite loops"* — guard with the `stop_hook_active` flag.
- **Notification / PreCompact / SessionStart** — cannot block; informational only.

**(c) JSON output control** (`:363-408`) — richer than exit codes. Common fields:
`{"continue": bool, "stopReason": str, "suppressOutput": bool}`. Decision fields: PreToolUse
`"approve"|"block"`, PostToolUse `"block"`, Stop `"block"`. **Priority order** (`:410-417`):
`continue:false` ▶ `decision:block` ▶ `exit 2` ▶ other. (Note a second, uncatalogued schema: the
Stop-event *artifact* validators in §3.4 emit a sibling `{"result":"block"}` key, **not**
`decision` — this README documents only the `decision` family, so verify against source before
relying on either spelling.)

> ⚠️ **Caveat (the "8-vs-13 gap", referenced elsewhere by that name):** this table is the older
> **8-event** model. The lifecycle list claims **13**
> events (adds SessionEnd, PermissionRequest, PostToolUseFailure, SubagentStart, Setup) but the
> flow-control table was never updated for the 5 newer ones. Treat the table as authoritative for
> the classic 8; cross-check the newer events against the vendored
> `ai_docs/claude_code_hooks_docs.md` or the live upstream docs, not this README.

### 3.3 Architecture — UV single-file scripts (and why nxtlvl can't lift it verbatim)

Every hook (and status line) is a self-contained **uv PEP-723 script**: shebang
`#!/usr/bin/env -S uv run --script`, an inline `# /// script` dependency block (most declare only
`python-dotenv`, wrapped in try/except so it's optional), and `argparse` flags. `settings.json`
invokes them uniformly as `uv run $CLAUDE_PROJECT_DIR/.claude/hooks/<name>.py [flags]`. Two
properties are worth stealing conceptually:
- **Zero install step** — `uv` provisions an ephemeral venv per invocation; dependency isolation
  is per-script.
- **One script, behavior via flags** — the same physical file changes behavior purely through the
  `command` string in `settings.json` (`--chat`, `--notify`, `--load-context`).

**The mismatch:** nxtlvl's hooks are **Node.js**. The hook *contracts* (stdin JSON, `exit 2`
blocks, `decision`/`additionalContext` JSON, fail-open) are platform facts and fully portable; the
*uv/PEP-723 packaging* is Python-specific. Port the patterns, re-express the packaging as a Node
`process.argv` flag dispatch (the "one script, many wirings" idiom maps cleanly).

### 3.4 Validators — two patterns, neither wired by default

`hooks/validators/` holds **library-style hook bodies** meant to be attached per-agent/command via
frontmatter (e.g. `plan_w_team.md`'s Stop-hook), *not* wired in the default `settings.json`:
- **PostToolUse linters** (`ruff_validator.py`, `ty_validator.py`): run `uvx ruff/ty check <file>`;
  on failure emit `{"decision":"block","reason":"<first 500 chars>"}` (the "block-and-retry"
  contract that feeds the error back to Claude); **fail-open** if the tool isn't installed.
- **Stop-event artifact gates** (`validate_new_file.py`, `validate_file_contains.py`): detect a
  freshly-produced file via `git status --porcelain` + mtime window, optionally check required
  substrings, and emit `{"result":"block","reason":...}` with prescriptive prompts to force
  self-correction. (This is the force-continuation class §2 flagged.)

### 3.5 What to reject in the mechanics

- **Unbounded logging.** Every hook does read-modify-rewrite of `logs/<event>.json` — **not
  concurrency-safe** and grows forever (only `session_end --cleanup` prunes, and only `chat.json`).
  Reject this storage mechanism; nxtlvl's fallback-log design already handles rotation/locking
  better.
- The validators' cleaner **per-script `logging.FileHandler` sidecar log** is the better debug-
  telemetry idiom if one is wanted.

(Per-surface adopt/adapt/reject calls are consolidated in §6; this section is the *what-it-is*.)

---

## 4. Agents & orchestration — the read-only validator, meta-agent, model tiers

### 4.1 The read-only validator (the single highest-value pattern here)

The team uses a **builder ↔ validator** pair, differentiated *purely by capability surface*:

| | `team/builder.md` | `team/validator.md` |
|--|--|--|
| model | opus | opus |
| tools | full default set | **`disallowedTools: Write, Edit, NotebookEdit`** (`:5`) |
| extra | PostToolUse hook runs `ruff`+`ty` on every `Write\|Edit` (`:6-15`) | none |
| mandate | "You build… do not plan or coordinate" | "You inspect, analyze, report — you do NOT modify anything" |

**The load-bearing insight:** the validator is read-only because **write tools are withheld at the
harness level, not because it's *told* to be advisory.** A critic that *can* edit will drift into
"just fixing it" mid-review, collapsing the separation between doing and judging and destroying the
independent check. Removing the capability makes "report pass/fail" the only available move. Note
the two distinct enforcement layers in play: **capability-withholding** (validator) and
**post-mutation hooks** (builder's lint gate) — they compose.

This maps directly onto nxtlvl's ideation agents: **`idea-critic` and `context-scout` should be
capability-constrained read-only** (a Read/Grep/Glob allowlist, or `disallowedTools` on write
tools), not merely instructed to be advisory. It also sharpens the scoping doctrine
([ecc-agent-vs-skill-scoping.md](ecc-agent-vs-skill-scoping.md)): read-only-ness is a *first-class
scoping decision* — one opus-over-the-codebase role, split into doer vs. judge by tool surface
alone. (Schema nit: `validator.md` uses `disallowedTools`; `plan_w_team.md` uses
`disallowed-tools` — verify the current CC spelling before copying either.)

### 4.2 The meta-agent — "the agent that writes agents"

`meta-agent.md` (`model: opus`) is a generator whose *output artifact is another agent's config
file*. Two ideas worth borrowing: (a) it **infers the minimal tool set from task shape** ("a code
reviewer needs Read, Grep, Glob… if it writes files it needs Write", `:22`) — least-privilege as
the author's job, the same axis the scoping doctrine turns on; (b) **Step 0 scrapes the live
Anthropic docs** before generating (`:15-17`), so the format it emits tracks upstream rather than a
frozen snapshot. (Minor internal bug: step 3 says set a `color`, but the output template omits it,
`:31-59`.)

### 4.3 Model-tier rig — reframed for Max (latency/quality, not cost)

The `crypto/*` agents come in `-haiku`/`-sonnet`/`-opus` triplets that are **~9-line stubs**
differing *only* in `model:`; the whole behavioral spec lives in a single prompt file *per
agent-name* — shared across that name's three tier-stubs — which each stub points at
(`Read and Execute: …agent_prompts/<name>.md`). `/crypto_research` fans out all 12 and
writes each output to a tier-segregated dir — a **side-by-side quality diff for an identical task**.
Two transferable kernels:
- **Body-as-pointer** — behavior defined once, the agent file is a thin binding of (model, tools,
  color) onto a shared prompt. Cheap way to keep variants/aliases in sync.
- **The eval rig** — same prompt at three tiers, outputs read adjacently. For nxtlvl (on Max, so
  **cost is irrelevant**) this is a *one-off calibration* — "which tier does this agent actually
  need?" — not a standing 3× fan-out (which wastes latency/context with no cost upside). The
  surviving routing heuristic: haiku for latency-sensitive low-stakes scouting, opus for
  judgment-heavy roles (critic, planner), sonnet as the middle default.

### 4.4 Planner-lead + shared-task-list + validator-gate loop

`plan_w_team.md` is an **orchestrator that never writes code** (`:60`, `:276-285`): during planning
it even sets `disallowed-tools: Task, EnterPlanMode` so it can't deploy agents while still planning.
It coordinates via a shared `TaskCreate/Update/List/Get` task list with `addBlockedBy` dependency
DAGs (`:96-119`) and deploys workers via `Task({subagent_type, model, run_in_background})`
(`:136-211`); the plan's **final task is always a read-only validation** assigned to `validator`,
`Depends On: <all>` (`:324-331`). `/build` is the dumb executor ("read and execute the plan") — the
plan *is* the program. A **deterministic plan-completeness Stop-hook** (`validate_file_contains.py`)
fails the lead unless its plan file contains the required section headers — a clean "block on
objective facts" gate. The shape (orchestrator-never-writes → DAG → terminal independent validate)
is sound; the heavy `TaskCreate` machinery is more than nxtlvl needs — adapt the separation, trim
the bookkeeping.

### 4.5 Completion-signal agent

`work-completion-summary.md` is a **context-blind, tool-locked notification sink** (`:3`: "no
context about previous conversations"; `:37`: "Run only bash 'pwd' and the ElevenLabs tools") that
converts "done" into an out-of-band ping. Reject the ElevenLabs/TTS specifics; the keeper is the
*discipline* — a decoupled sink with one sentence, no filler, a locked toolset — if nxtlvl ever
wants ambient "done" signals.

(Adopt/adapt/reject consolidated in §6.)

---

## 5. Context engineering & periphery — prime, status lines, output styles, ai_docs

**The `prime` ritual (relevant to the Context & Memory subsystem — "C&M" hereafter).** Priming is treated as a *first-class, repeatable*
context-load. `prime.md` is Execute→Read→Report (run `git ls-files`, read README + curated
`ai_docs/*`, summarize). `prime_tts.md` is the sharper version — it uses CC's eager command/file
injection (`` !`git ls-files` ``, `@README.md`, `@ai_docs/...`) so context is materialized *at
prompt-expansion time*, not via agent tool-call roundtrips. `all_tools.md` is a self-introspection
("list every tool in TS-signature format") capability audit; `question.md` fences a read-only Q&A
mode by prompt alone. **Takeaway for nxtlvl's C&M subsystem:** a named "prime/rehydrate" command
using `@`/`` ! `` eager injection is a clean fit — deterministic, roundtrip-free context loading.

**Status lines — a context-window HUD (relevant to the degradation band).** Nine versions form a
feature-accretion tutorial over the status-line JSON. The standouts: **v6** renders a
**context-window usage bar** with color thresholds (green <50 / yellow <75 / red <90 / bright-red
≥90) + `~Nk left`; **v9** a powerline style. The real asset is the JSON field
`context_window.used_percentage`. Every version uses a **graceful-degradation idiom** — guard the
stdin parse, always `exit 0` with a fallback line, never crash the HUD. For nxtlvl this is a
*passive* complement to the *active* context-alert hook: render the bar against the **150–200K
degradation band**, not a generic 0–100%.

**Output styles (8) — mostly confirmation.** Each is a thin system-prompt rewrite changing *format
only* (tables, bullets, ultra-concise, etc.). nxtlvl already runs an explanatory style, so this is
confirmation, not new capability — the one genuinely interesting member is **`yaml-structured`**
(machine-parseable agent output) if a future agent needs structured stdout.

**`ai_docs` vendoring vs `docs/reference/`.** `ai_docs/` is **verbatim upstream-doc scrapes** (they
retain "Skip to main content" UI chrome) + a URL manifest + a `legacy/` folder of versioned
snapshots — a "local doc cache as ground truth for the agent." It's *adjacent* to nxtlvl's
`docs/reference/` but cruder: raw scrape vs synthesized distillation. Keep the **versioning
discipline** (`legacy/` ≈ superseded-but-kept, like superseded ADRs); **don't** regress to raw
scrapes — nxtlvl's curated-distillation model is strictly better.

**`specs/` — templated, self-validatable plans.** Three specs share one rigid template
(Task Description → Objective → … → Team Orchestration); they're the *output* of `plan_w_team` and
are self-checkable by `validate_file_contains.py`. `hooks-update-with-team.md` is self-referential
— the spec that built the repo's own 13-hook expansion. This is the "templated format = predictable
output" thesis (§2) made concrete; nxtlvl achieves the same via its spec/plan/ADR house formats.

---

## 6. Adopt / Adapt / Reject ledger (mapped to nxtlvl surfaces)

| From hooks-mastery | Verdict | nxtlvl surface → action |
|--------------------|---------|--------------------------|
| Hook flow-control reference (§3.2) | **Adopt** | This doc *is* the adoption — citable reference for hook work; prefer it over re-reading upstream, but heed the 8-vs-13 caveat. |
| Read-only-by-withheld-tools (validator) | **Adopt** | Make `idea-critic` + `context-scout` capability-constrained read-only (not instructed). Highest-value takeaway. **Verify the `disallowedTools` vs `disallowed-tools` spelling first (§4.1) or the constraint silently won't bind.** |
| Fail-open `exit 0` discipline | **Adopt (confirm)** | Confirms context-alert fail-toward-silence + dangerous-bash kill-switch posture. Keep. |
| `additionalContext` injection channel (SessionStart/Setup) | **Adopt (pattern)** | The non-blocking "inform" channel if the context-alert FYI ever needs to *inject* a note, not just notify. |
| `@`/`` ! `` eager-injection `prime` ritual | **Adapt** | C&M: a named "rehydrate" command; drop the TTS tail. |
| Context-window status line (v6/v9) | **Adapt** | Render usage against the 150–200K **degradation band**, not 0–100%; passive HUD beside the active hook. |
| PreCompact `trigger` branch + backup-before-compaction | **Adapt** | C&M **Hook 2**: keep the timing + manual/auto branch; write a **pointer/digest, not a full transcript** (ADR-007). |
| `.env`-access objective blocker | **Adapt** | Candidate *second* objective PreToolUse gate (block-on-facts) if secret protection is wanted. |
| Dangerous-`rm` regex set | **Adapt (diff)** | Diff against nxtlvl's gate to close gaps, but trim their over-broad `*`/`.` paths (the false-positive class nxtlvl already hit on `git branch -f main`). |
| Body-as-pointer agent authoring | **Adapt** | Keep ideation aliases/variants in sync via one shared prompt. |
| Model-tier eval rig | **Adapt (one-off)** | Calibrate which tier an agent needs (Max → cost irrelevant); not a standing 3× fan-out. |
| Planner-lead → DAG → terminal validate loop | **Adapt (trim)** | Orchestration shape is sound; trim heavy `TaskCreate` bookkeeping to what's needed. |
| Completion-signal sink discipline | **Adapt (maybe)** | Only if ambient "done" signals wanted; keep "1 sentence, locked toolset", drop TTS. |
| `ai_docs/legacy/` versioning | **Adapt** | Mirror keep-don't-overwrite (already have it via superseded ADRs). |
| `yaml-structured` output style (§5) | **Adapt (maybe)** | Only if a future agent needs machine-parseable stdout; the other 7 styles are confirmation, not new capability. |
| Self-validatable `specs/` template + `all_tools`/`question` command idioms (§5) | **Adapt** | "Templated format = predictable output" (§2) made concrete; nxtlvl already gets this upstream via spec/plan/ADR house formats + the review rubric. Borrow the *self-checkable template* discipline, not the files. |
| uv / PEP-723 packaging | **Reject** | nxtlvl is Node; port contracts, re-express packaging as `process.argv` dispatch. |
| Force-continuation hook apps (Stop-block, prescriptive self-correction) | **Reject (doctrine)** | Conflicts with "hooks inform, don't force"; already settled. |
| Unbounded `logs/<event>.json` store | **Reject** | Race-prone, no rotation; nxtlvl fallback-log is better. |
| Raw verbatim doc-scraping | **Reject** | Synthesized `docs/reference/` distillation is strictly better. |
| TTS / multi-provider LLM machinery | **Reject** | Out of scope; unwanted dependency surface. |
| Cost machinery (status_line_v5, cost fields) | **Reject** | Irrelevant on Max. |
| crypto / sentient / hello-world / `apps/` demos | **Reject** | Demo filler; the reusable mechanism is already abstracted above. |

**Confirmations (not actions, but worth recording):** the shipped one-gate posture and the uniform
fail-open both independently corroborate nxtlvl's "inform by default, block only on objective facts"
doctrine (§2).

---

## 7. ADR candidates & next actions

Per the decision rule's ADR-worthy test (architectural *and* expensive to reverse), most findings
here are **applications of decisions nxtlvl already made** — they route to spec/plan/amendment, not
new ADRs (curation beats dilution).

**Genuine decision points** — decision-*shaped* findings. Note the routing: of the three, #1 lands
as an **amendment** to an existing doctrine, #2 as a **deferred** ADR (write it when the design
locks), #3 only **if/when built**. None is a fresh standalone ADR to write today.
1. **Independent-check agents must be capability-constrained read-only.** If adopted as a
   cross-cutting convention (every critic/scout/validator gets write tools *withheld*, not just
   instructed), record it — most naturally as an **amendment to the scoping doctrine**
   ([ecc-agent-vs-skill-scoping.md](ecc-agent-vs-skill-scoping.md): "read-only-ness is a first-class
   scoping decision") applied in the **ideation domain spec** for `idea-critic`/`context-scout`.
2. **PreCompact Hook 2 design** — backup-before-compaction *timing* + `trigger` manual/auto branch,
   but emitting a **pointer/digest** rather than a transcript copy. Design for an unbuilt C&M
   component → feed into the **C&M lifecycle plan** (`docs/plan/nxtlvl-context-memory-lifecycle-plan.md`);
   the ADR lands when the design is locked, citing ADR-007.
3. **A second objective PreToolUse gate (`.env`/secret access)** — small but a real block-on-facts
   decision; record only if/when built.

**Concrete next actions:**
- [ ] Apply read-only tool constraints to `idea-critic` + `context-scout` (sandbox/ or plugin) —
  confirm the current CC `disallowedTools`/`disallowed-tools` spelling first (§4.1), or the
  constraint silently won't bind.
- [ ] Fold the PreCompact findings into the C&M lifecycle plan (Hook 2 / Phase 2).
- [ ] Diff the dangerous-`rm` regex set against nxtlvl's gate for gaps (trim over-broad paths).
- [ ] Stage-3 reader-test this distillation with a fresh sub-agent, then it's done.

**Vendoring note:** the clone at `reference/claude-code-hooks-mastery-main` stays gitignored
(machine-local "book on the shelf"); *this doc* is the durable tracked artifact. Re-fetch the clone
any time — it carries no decisions.
