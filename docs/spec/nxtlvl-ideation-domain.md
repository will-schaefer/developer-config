# Spec: `nxtlvl` ideation domain (intent → direction front door)

> Design spec for the harness's **ideation domain** — the front door that turns a raw idea
> into a confirmed intent and an approved direction, then hands off to the spec/plan pipeline. It
> ships as a three-layer `command → executor → knowledge` domain in ECC's shape
> ([`../reference/ecc-agent-vs-skill-scoping.md`](../reference/ecc-agent-vs-skill-scoping.md) §3),
> but with the executor **inverted** onto the main thread because the work is an interactive
> dialogue (see §2). Recorded as [ADR-026](../decisions/ADR-026-ideation-domain-orchestrator-skill-isolated-agents.md).
>
> Anchor intent: [`../intent/personal-harness.md`](../intent/personal-harness.md).
> Domain precedent: [ADR-024](../decisions/ADR-024-git-workflows-domain-command-agent-skill.md)
> (git-workflows, the inverse shape). Builds on: ADR-003 (compose, don't reconstruct),
> ADR-012 (agents execute, skills hold knowledge), ADR-010 (decision rule).
>
> **Scope boundary:** this spec pins the **architecture** — the component inventory, the
> executor inversion, the composition seams, and the router placement. It does **not** pin the
> *internals* of the four refined skills; those are authored and iterated via `/skill-creator`,
> owned by the user. The contract here stays stable while skill content evolves freely.

## 1. Objective

Give the harness one coherent **ideation domain** that owns a `brainstorming` orchestrator
composing nxtlvl's intent skills (`interview-me` / `grill-me` / `idea-refine`) across the arc
*raw idea* → *confirmed intent* → *approved direction*, ending by feeding the existing
`spec-driven-development → planning-and-task-breakdown` pipeline. **How that front door
adopts/adapts from the reference harnesses is a pending decision** — a harness-review across the
reference set, resolved per the project's decision method, not concluded here.
(`superpowers:brainstorming` is the most relevant prior art — the only reference shipping a
brainstorming front door — but no reference is a default or fallback.) It is a
**user-directed, proactive domain build** (the user asked for the whole ideation phase), in the
same category as the confident-core ([ADR-016](../decisions/ADR-016-confident-core-capability-domains.md))
and the C&M subsystem — not a reactive un-deferral under the intake gate
([ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md)), which still governs all
*other* growth.

## 2. The model — a three-layer domain with an inverted executor

ECC's domain shape is `COMMAND (entry) → AGENT (executor) → SKILL (knowledge)` — the agent does
the work in an isolated, tool-scoped context, and only a result crosses back. That is exactly
what [ADR-024](../decisions/ADR-024-git-workflows-domain-command-agent-skill.md) shipped for
git-workflows.

**This domain inverts the middle layer.** Its core work is an **interview** — a live,
one-question-at-a-time dialogue with the user. Agents run in their own context and **cannot
talk to the user**; an interview run as an agent would be deaf. So the executor *must* be a
**main-thread skill**, and the agent layer is repurposed: agents become **isolated, read-only
support** the skill spawns at specific seams to keep noisy work (context sweeps, adversarial
critique, parallel approach-exploration) off the conversation. The durable architecture:

```
            /brainstorm   (+ /interview-me · /grill-me · /idea-refine)
                   │   COMMAND layer — thin entries, just delegate
                   ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │  MAIN THREAD · interactive    — the EXECUTOR is a SKILL, not an   │
   │                                 agent (the interview is a dialogue)│
   │                                                                   │
   │   brainstorming ◆  — front-door orchestrator                      │
   │     phase 1 · discover intent  ──composes──▶  interview-me ◆      │
   │                                               grill-me ◆ (deep)    │
   │                                               idea-refine ◆ (vary) │
   │     phase 2 · shape direction  (approaches → in sections → gate)  │
   └───────────────┬───────────────────────────────────────────────────┘
                   │  spawns at the seams — ISOLATED · READ-ONLY
                   ▼
        AGENTS:   context-scout      idea-critic     approach-explorer
                  (Read/Grep/Glob — no Write/Edit; return a brief/verdict)
                   │
                   ▼  direction approved
        NATIVE SEAMS:  spec-driven-development → planning-and-task-breakdown
                       + the decision rule (ADR) when a choice is ADR-worthy
```

**The through-line is the executor inversion.** Everything else follows from "the interview is
a conversation, so its engine lives where the conversation is."

## 3. Skills — the knowledge layer (◆ refined, caller-agnostic)

Four refined skills. Per [ADR-012](../decisions/ADR-012-agents-execute-skills-hold-knowledge.md)
and the scoping doctrine, knowledge is **factored out and caller-agnostic** — `interview-me`,
`grill-me`, and `idea-refine` know nothing about `brainstorming`; the orchestrator depends on
*them*, one-way.

| Skill | Owns | Composed by |
|---|---|---|
| `interview-me` ◆ | intent-extraction engine: hypothesis+confidence, Q+GUESS, want-vs-should probe, structured restate, explicit-yes / 95% stop | brainstorming (phase 1) |
| `grill-me` ◆ | relentless branch-by-branch interrogation — the deep / high-stakes intensity tier | brainstorming (phase 1, escalation) |
| `idea-refine` ◆ | divergent variant generation from an unfixed concept | brainstorming (when the concept is unfixed) |
| `brainstorming` ◆ | the front-door **orchestrator**: runs the two-phase arc, composes the three above for the intent half, owns the direction half (2–3 approaches → in sections → approval gate), spawns the support agents, hands to spec | — (front door) |

The **synthesis-vs-fork tension is resolved by ownership.** Because `interview-me` is now an
nxtlvl-owned refined skill, `brainstorming` *composes* it rather than inlining a fork — one
copy of the intent engine, consulted, not duplicated. The drift risk that made full-inlining
unattractive only existed while `interview-me` was upstream; owning it dissolves it.

**The `brainstorming` front-door design is pending a harness-review decision** — comprehensively
analyzing how each reference harness handles the ideation/front-door phase, then adopt / adapt /
reject. `agent-skills` is one reference, not a baseline; `superpowers:brainstorming` is the most
relevant prior art (the only reference shipping a brainstorming front door). The current
`SKILL.md` is a **provisional draft** — what it composes and how is settled by that review, not
here.

**Internals are out of scope here** — each skill's body is authored via `/skill-creator`
(user-owned). This spec fixes only their *roles and boundaries*.

## 4. Agents — isolated read-only support (the seam workers)

Three agents, each justified on the scoping axis (§5 of the doctrine: *isolation / restricted
tool sandbox / autonomy / model tier*). All are **read-only** (`Read, Grep, Glob` — no
`Write`/`Edit`): they inform the dialogue, they never mutate the tree. Each returns a tight
brief/verdict; the noisy work stays in the subagent (the `/go-review` payoff).

| Agent | Seam it serves | Why an agent | Tools | Returns |
|---|---|---|---|---|
| `context-scout` | phase-1 "explore project context" | context sweep is noisy; keep file-dumps off the thread | `Read, Grep, Glob` | a pointers-over-content context brief |
| `idea-critic` | before the approval gate | fresh-context adversarial review needs an unbiased window | `Read, Grep, Glob` | holes/risks verdict on the draft |
| `approach-explorer` | phase-2 "propose 2–3 approaches" | fan out one isolated worker per candidate approach, in parallel | `Read, Grep, Glob` | per-approach trade-off brief |

`idea-critic` is the **pre-decision** sibling of the existing post-decision
`doubt-reviewer` — same read-only adversarial shape, different moment on the timeline.

**Pass-1 build scope (resolved 2026-06-19):** `context-scout` and `idea-critic` ship in the
first pass; `approach-explorer` is **deferred** until the 2–3-approaches step proves it wants
parallelism in practice (§13). All three remain part of the domain shape (ADR-026).

## 5. Commands — the entry layer (thin)

- **`/brainstorm`** — front-door entry; starts the `brainstorming` orchestrator on the main
  thread. *(Chosen 2026-06-19 over `/ideate` and `/shape`; 1:1 with the skill and sidesteps the
  `shaping-skills` plugin collision — see §13.)*
- **`/interview-me` · `/grill-me` · `/idea-refine`** — thin aliases for direct entry into a
  single sub-skill when the user doesn't want the full arc.

Commands hold no durable logic (scoping doctrine §6 smell: "durable logic in a command"); they
detect context and delegate.

## 6. Native seams — composed, not rebuilt (ADR-003)

The domain ends where the pipeline already exists; it composes, never reconstructs:

- **`spec-driven-development`** — the approved direction is its input; it writes the contract to
  `docs/spec/`. This is the ideation→contract boundary and stays **native** (not refined now).
- **`planning-and-task-breakdown`** — two hops downstream; the terminal handoff.
- **the decision rule** — when the direction settles an ADR-worthy choice, record it via
  `◆ documentation-and-adrs` ([the rule](../decisions/ADR-010-global-decision-rule.md)).

## 7. The flow — front door, end to end

1. **`/brainstorm`** (or a sharp idea arriving inline) starts `brainstorming` on the main thread.
2. **Explore context:** spawn `context-scout`; fold its brief in (pointers, not dumps).
3. **Phase 1 · discover intent:** apply `interview-me`'s engine; escalate to `grill-me` when
   underspecified / high-stakes; reach for `idea-refine` when the concept is unfixed. Stop at
   the 95%-confidence / explicit-yes intent gate. Skip fast when the ask already arrives sharp.
4. **Phase 2 · shape the direction:** optionally fan out `approach-explorer` for 2–3 approaches;
   present the direction in sections; spawn `idea-critic` before the gate; get explicit approval.
5. **Hand off:** record any ADR-worthy decision, then invoke `spec-driven-development` →
   `planning-and-task-breakdown`. Do **not** enter implementation from here.

## 8. Invariants (the contracts)

- **Executor is a main-thread skill** — the interview is interactive; it is never run as an
  agent. (The defining constraint.)
- **Agents are read-only** — `Read/Grep/Glob`, no `Write`/`Edit`; they inform, never mutate.
  Only a brief/verdict crosses back.
- **Knowledge is caller-agnostic** — `interview-me`/`grill-me`/`idea-refine` name no caller;
  the dependency runs one-way (orchestrator → knowledge). (ADR-012, scoping §3.)
- **Compose the seams, don't rebuild** — spec/plan/ADR are native and composed. (ADR-003.)
- **Gate before implementation** — direction approved (or an informed override recorded) before
  any build action.

## 9. Router wiring

The `nxtlvl-router` ideation section gains the front door and marks the refined skills ◆:

```
├── About to build / change anything? ──→ ◆ brainstorming   (direction-before-build front door)
├── Don't know what you want yet? ──────→ ◆ interview-me
├── Need to stress-test hard? ──────────→ ◆ grill-me
├── Rough concept, need variants? ──────→ ◆ idea-refine
├── New project/feature/change? ────────→ spec-driven-development   (native boundary)
```

Per the floor-brief discoverability finding, the front door must be wired into the router map
(process skills don't fire from their frontmatter description alone).

## 10. Decision-record implications

Recorded as **[ADR-026](../decisions/ADR-026-ideation-domain-orchestrator-skill-isolated-agents.md)** —
"ideation domain: a three-layer domain with a main-thread orchestrator skill and isolated
read-only agents." It cross-links ADR-024 (the inverse-shape precedent), ADR-012, ADR-003, and
the scoping doctrine. No existing ADR is superseded; ADR-016's proactive-domain category is the
nearest relative.

## 11. Build sequence (for the build; not all decided here)

1. **Knowledge skills first** (`/skill-creator`, user-owned): `interview-me` → `grill-me` →
   `idea-refine`. Brainstorming composes them, so they precede it.
2. **`brainstorming`** (`/skill-creator`): the orchestrator, last — **first run the harness-review
   across the references to settle the front-door design**, then refine the provisional draft at
   `plugins/nxtlvl/skills/brainstorming/SKILL.md` to *compose* the three intent skills rather
   than inline.
3. **Agents** (`context-scout`, `idea-critic`, `approach-explorer`) — lean executors, each
   pointing at the relevant skill as its source of truth (don't restate it; ADR-012/ADR-013).
4. **Commands** (`/brainstorm` + aliases) — thin entries.
5. **Router wiring** (§9) — last, once the pieces exist.

## 12. Out of scope

- **Skill internals** — authored via `/skill-creator`, not pinned here.
- **Refining `spec-driven-development`** — kept native as the ideation→contract boundary; a
  later, separately-decided effort.
- **Any agent that writes** — the support agents are read-only by contract.
- **Reconstructing native orchestration** — routing/planning stay native.

## 13. Decisions resolved + still open

**Resolved 2026-06-19** (build decisions that fold into this spec — not new ADRs; all stay
within ADR-026's recorded shape):

- **Front-door command name → `/brainstorm`.** 1:1 with the skill; avoids the `shaping-skills`
  plugin collision. (`/ideate` and `/shape` declined.)
- **`approach-explorer` → deferred to a later pass.** Pass 1 ships `context-scout` +
  `idea-critic` only; add the parallel approach fan-out once the 2–3-approaches step proves it
  wants parallelism in practice. It remains part of the domain shape (ADR-026).
- **`idea-critic` → its own agent**, not a composition of `doubt-driven-development`. It needs
  a distinct *pre-decision, idea-level* rubric (holes/risks on an idea draft) and a verdict
  folded back into the interview dialogue — a different input, rubric, output, and moment than
  the post-decision `doubt-reviewer`. Matches ADR-026's agent list; no ADR amendment needed.
- **`context-scout` brief format → pinned in the agent**: pointers-over-content (each finding is
  a `file:line` + one-line *why*, grouped by kind), aligned with the C&M read-path style. No
  pasted blocks cross back.

**Still open (non-blocking):**

- **Brainstorming front-door design** — pending a **harness-review** across the reference harnesses
  (how each handles the ideation/front-door phase → adopt / adapt / reject). `superpowers:brainstorming`
  is the relevant prior art; **no adoption is concluded**. The `SKILL.md` is a provisional draft.
- Once `approach-explorer` is built: one agent per candidate approach (parallel fan-out) vs. one
  agent returning all candidates. Revisit when the parallelism need is real.
- Brainstorming's **visual seam**: native `visualize` MCP vs. vendoring superpowers' local-server
  companion. Skill-internals, settled during step-2 authoring — leaning native (the skill stays
  `SKILL.md`-only until then).
