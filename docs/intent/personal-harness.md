# Intent: `nxtlvl` — A Personal Agent Harness for Building Next-Level Agents

> Confirmed statement of intent. Produced via `interview-me` (2026-06-16) and hardened
> through a 20-question `grill-me` pass (2026-06-16). This is the anchor the build is
> measured against. Downstream specs/plans consume it.

## One-line stack

**agent-skills = foundation I vendor-and-refine · ecc = dormant reference + backstop · native Claude Code = the platform I compose on, never reconstruct · `nxtlvl` = the tailored plugin I build, own, and run daily.**

## Name

- **`nxtlvl`** — namespace `nxtlvl:<skill>` / `nxtlvl:<agent>`. Theme: a harness for building
  *next-level agents*. Chosen to scan cleanly against `ecc:` and `agent-skills:` and to
  avoid colliding with `next` (Next.js is in the workload).

## Confirmed intent

- **Outcome:** My own production-quality Claude Code **plugin** (`nxtlvl`) that reproduces
  ecc's *architecture* — layered global/project, skills, agents, hooks, an audit, memory,
  context assembly — **scoped to my needs, not ecc's breadth.** It is not a plugin yet;
  becoming one is the work.
- **The learning target is agent-harness architecture itself** — the plumbing, packaging,
  context assembly, memory, and composition layer — **not** the substance of how-to-review
  or how-to-develop. "Learn by reconstruction" applies to the *harness*, not the SDLC content.
- **Foundation & method:** Built **on and with agent-skills.** Its SDLC workflow
  (`/spec → /plan → /build → /test → /review`) is how I drive construction; its skills are
  the base I **vendor into the repo and refine for fit** (not call untouched, not rebuild
  from scratch).
- **User:** Me — run daily across my real work, local machine.
- **Why now:** Deliberate rebuild after wiping `~/.claude`. I want a harness I own and
  understand to the metal, not one I merely configure.

## Method: review harnesses to shape nxtlvl

Part of how nxtlvl is built is by **systematically reviewing existing agent harnesses** and
deciding, area by area, what to **adopt / adapt / reject** — primarily the **ecc** plugin
(vendored at `reference/ECC-main/`, kept installed-but-dormant per
[ADR-002](../decisions/ADR-002-ecc-dormant-reference-backstop.md)), with **other harnesses
brought in as references over time**. This is deliberate and ongoing — reviewing ecc is the
intended method, not a dependency to hide. Each review produces an ADR-recorded decision plus a
distillation under [`../reference/`](../reference/). The gated agent-lifecycle review is the
current instance, and agents working the build should expect it.

## The build, in two layers with opposite strategies

**Plumbing layer → reconstruct (this is where the learning lives).** The machinery
agent-skills/native CC don't hand me: plugin packaging + layered config, **context
assembly**, **memory** (extending native CC), a lean **hook** layer, and the **audit**.
Reconstructing these is both the learning payoff and necessary.

**Workflow layer → compose, don't reconstruct.** Dev and review wrap/refine agent-skills'
existing skills + agents + my conventions. Research is the one workflow I build (agent-skills
lacks it; ecc/`deep-research` as reference). The point here is *fit and leverage*, not
understanding-by-rebuilding.

**Orchestration → native, always.** Skill routing, agent dispatch, the tool-use loop, and
context-window assembly live below the plugin boundary and **must not be reconstructed** —
a hand-built router is structurally a slower, capped shim around the real dispatcher (ecc
itself reimplements none of this). I learn orchestration by *reading* CC/ecc and *designing
the composition layer*; deterministic multi-agent control uses the native `Workflow` tool.

**Operating model → orchestrator + specialists.** The main session is a *lean orchestrator*:
it holds the task and the context budget and delegates specialized work to subagents chosen by
the present task, instead of doing everything inline. This is the composition layer's defining
shape — and it rides on the **native** dispatch primitive (description-triggered routing, the
`Task`/`Workflow` tools), never a hand-built router: I own *which* specialists exist and *when*
to delegate; the dispatch underneath stays native. Specialists are **scoped** to my actual
stacks (Next.js/TS, Python, Rust + cross-cutting general agents + agent-building) and **grow
reactively** through the intake gate — realized as native agents with injected skills by
default, as custom agents only where the sandbox/isolation/model test justifies one, with
dormant ecc as the on-demand fallback library. Delegation is also context preservation: heavy
work runs in an isolated subagent context, keeping the orchestrator lean.

### Reconstruction backlog (ordered — feeds `/plan`)

1. **Layered config + plugin packaging** — can't run without it; teaches the skeleton.
2. **Context assembly/injection** — highest daily leverage; *is* the harness's job.
3. **Memory** — extend native CC file-memory (not a fourth system).
4. **Composition layer** — when skills fire, how agents chain into workflows, how outputs
   compose. (Orchestration *primitive* stays native; the *composition* is mine.)
5. **Hooks** — lifecycle interception; lean. Fail-open on *error* (absolute, gates included);
   deliberate blocking gates allowed but gated by the intake test (ecc model).
6. **Audit** — measures the rest; built last because it needs something to measure.

## Machinery: a whitelist, not "full"

- **In:** layered global/project config, skills/agents/commands structure, a *lean*
  fail-open hook layer, the audit, memory, context-injection.
- **Deferred / backstop-only until the fallback log proves repeat-need:** continuous-learning
  observation capture, governance/secrets capture, the optimizer loop, the heavyweight
  multi-check Bash dispatcher. ("Core machinery first; scale machinery reactively.")

## ecc: dormant reference + backstop, not the engine

- ecc flips from **all-on → installed-but-dormant.** Not loaded by default (keeps its 271
  skills / 67 agents out of my namespace and context). Re-enabled only as a **deliberate
  act** — that friction is what makes reaching for it a real signal, not an ambient crutch.
- During development, ecc's **active hooks are off** (GateGuard, `pre:observe`, etc.) so
  build sessions are clean. ecc is a *book on the shelf*, not a coworker editing over my
  shoulder.
- **`nxtlvl` is primary from the first MVH install.** ecc covers only what I consciously
  reach for — and every reach is logged.

## The fallback log (load-bearing — it powers the metric, the backlog, and un-deferral)

- **Hook-written, not manual** (manual rots in a week). A small PreToolUse hook on
  `Skill`/`Task` appends `{timestamp, ecc-thing-invoked, current-task}` whenever an
  `ecc:`-prefixed thing fires. This is the **first piece of self-built machinery.**
- The log *is* the reactive catalog backlog and the un-defer trigger.

## Success metric

- **North star = fallback-rate, by session.** Share of sessions where I reached for ecc;
  trending **down and plateauing low** = `nxtlvl` covering my work. **Not** "audit-delta."
- **Dual metric (anti-gaming):** pair fallback-rate with a lightweight session-end quality
  check (e.g. 1–5, or "did I have to redo this"). Fallback-rate falling *while quality holds*
  = real progress; quality dropping = white-knuckling a real gap.
- **Target a low plateau, not 0%.** Zero would mean either reconstructing all of ecc (a
  non-goal) or avoiding hard work. A small steady fallback-rate means ecc still earns its
  shelf space for genuine edge cases.

## The audit

- **My own, tailored to the codebase** (not ecc's `harness-audit`).
- **Objective, binary, scope-independent gate:** config parses, no dead skill/agent refs,
  valid frontmatter, hooks exit 0 on a smoke test, no secrets. **All must pass to promote.**
  Taste/quality items are *warnings*, never blockers, so the gate can never encode "not
  enough skills." Not a single self-tunable score. Rubric is **versioned**; deltas are
  intra-version only.
- **Runs at promotion only, as an invoked skill (`nxtlvl:audit`)** — not continuous, not a
  session hook (a buggy gate-hook would lock me out of my own daily driver).

## Dev/prod separation (resolves stable-driver vs. learning-churn)

- **This repo = the workbench.** Where I reconstruct, experiment, break the plumbing, run
  the audit. Churn lives here and never touches live sessions until I promote.
- **Installed `~/.claude` = the daily driver.** Stable. Only proven changes land here.
- **Promotion = install = the gate** the audit guards. Mechanics: **local-marketplace
  install** (never hand-edit `~/.claude`); test in repo / scratch profile *before*
  promoting; **git-tag per promotion** so rollback = checkout previous tag + reinstall.
  ecc-dormant is the safety net during any rollback (sub-minute recovery).

## Phase 0 — the minimum viable harness (walking-skeleton first)

Build the **thinnest end-to-end slice that runs one real session on `nxtlvl`** first
(minimal plugin manifest + one workflow composing one agent-skills skill + the fallback-log
hook; prove it installs and runs), *then* thicken. Phase-0 target contents:

1. Layered config skeleton — global `~/.claude` + this project's `.claude/`, valid and coordinating.
2. The build loop — agent-skills' `/spec → /plan → /build → /test → /review`, refined for fit.
3. Memory — extending native CC file-memory.
4. Context-injection — a budgeted policy (see below).
5. Three workflow scaffolds — review · dev · research — as **v1 skeletons, not ecc-parity
   polish**; deliberately reshaped by the first few real tasks.
6. Lean **fail-open** hook layer + the fallback-log hook.
7. The fallback log itself (so Phase 0 can baseline the metric).

Everything else stays empty and grows by the reactive loop. The "Phase-0 baseline" for the
metric starts ticking at first MVH install — not today (today is the pre-Phase-0 ground
state: ecc + agent-skills + native CC).

## Reactive growth: the membership gate

- **Membership test:** *Would I want this no matter what I'm working on this week?* → build
  now (task-independent machinery/workflow shape). *Only matters once a specific task names
  it?* → reactive (a `react-reviewer`, a `postgres-migration` skill, etc.).
- **Written intake gate (not a vibe):** a new skill/workflow joins only via a one-line
  backlog entry naming *the task that required it* and *the existing thing that failed*.
  Falsifiable, fed by the fallback log.
- **Harden trigger:** when the log shows the same recurring miss **N≈2–3 times** for a
  specific workflow, that becomes a revision ticket. Workflows are revised on logged
  repeat-need, never on inspiration.

## Context assembly = a budgeted injection policy (not a firehose)

- The *learning artifact is the policy* — what earns a slot in the model's attention — not
  the plumbing. Over-injection (e.g. dumping a stale prior-session summary) degrades quality.
- **By lifetime:** durable facts/conventions → `CLAUDE.md` (global vs project); learned/
  evolving facts → native memory; per-session dynamic context (git state, current task,
  recent fallback entries) → a lean `SessionStart` hook; per-prompt relevance → native skill
  routing (no hand-built retriever — that's the orchestration anti-goal).
- **Hard rule:** every auto-injected block justifies its tokens or it's cut; prefer
  *pointers* ("task X in progress; read docs/intent/…") over dumping content.

## Hook safety (highest-severity failure mode)

Optimized to ecc's model: **separate a hook *erroring* from a hook *deciding to block*** —
two different code paths with two different rules.

- **Errors always fail open — absolutely, gates included.** Any *unexpected* failure
  (exception, bad parse, missing dep, timeout) → swallow, exit 0, inject/do nothing. A
  broken hook must never halt a session. A block is only ever a decision a hook reached
  *cleanly*; it is never the byproduct of a crash.
- **Deliberate blocking (exit 2) is now permitted — but gated.** A session hook may block,
  but only as a *named, whitelisted gate* that earned its slot through the reactive
  membership/intake gate. The exit-code contract is uniform: exit 0 = pass/warn (stderr
  surfaced as a non-blocking nudge), exit 2 = block.
- **Every blocking gate ships an env-var kill switch** (ecc pattern: `ECC_GATEGUARD=off`).
  One variable disables it with no reinstall — the in-session escape hatch *before* rollback
  is even needed.
- **The invoked audit still blocks unconditionally** — it is the one gate *meant* to stop
  promotion. Session gates are advisory-by-construction: killable, and fail-open on error.
- **Restraint is a policy choice, not a missing capability.** The harness now *can* block;
  which gates turn on is governed by the intake gate, not a blanket ban. nxtlvl stays "a book
  on the shelf, not a coworker" by enabling *few* gates — not by being unable to.
- Hooks are smoke-tested at promotion; rollback (git tag + reinstall) + ecc-dormant is the
  deeper escape hatch.

## Workload (the fuel for reactive growth)

Real monthly stream, named so the engine has known fuel and the first scaffolds aren't guesses:

- **Web/desktop apps, multiple languages** — Next.js full-stack, Python, Rust.
- **Knowledge-base construction.**
- **LLM-wiki construction.**
- **Agentic engineering / AI-agent building** — my differentiated work, and *meta*: I build
  agents *with* the agent harness, so dogfooding is automatic.

Implications: dev/review are **language-plural from day one** (ecc's `rust-reviewer`/
`python-reviewer`/`react-reviewer` + agent-skills' language-agnostic skills are the fallback
library I pull from on demand). **Agent-building is a likely fourth workflow** but stays
**reactive** (not pre-built). With this much variety the risk inverts — the reactive engine
could pull things in *fast*; the written intake gate + dormant-ecc fallback are what keep
`nxtlvl` from re-exploding to ecc scale.

## Out of scope

- ecc's 250+-skill breadth; old SwarmLab (lifecycle / personas / gates).
- The "lean 3-rule veneer" framing — **dropped.**
- Reconstructing orchestration primitives (skill router / dispatch / tool-loop) — **native.**
- Rewriting the *substance* of review/dev (how-to-review) — refine agent-skills for *fit*,
  not to re-derive the basis. (Re-deriving it would re-expand the learning target beyond
  "harness architecture.")
- A fourth memory system; continuous-learning/governance/optimizer machinery up front.

## Still open (resolve during planning, not blocking)

- Exact local-marketplace install command + plugin-manifest shape — confirm against current
  CC plugin docs at build time, not from memory.
- The audit's concrete rubric items — tailored once the harness exists (objective-gate
  guardrail holds regardless).
- Which agent-skills skills get vendored first — driven by the usage/fallback signal.
