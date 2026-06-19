# Spec: `nxtlvl` Context & Memory Subsystem

> Design spec produced via `/brainstorming` (2026-06-17). It defines the **integrating
> architecture** for the harness's memory and context-management layer — the umbrella the
> context-injection, fallback/observe, and lifecycle-persist hooks all fall under. It composes
> and, in two places, **reverses** prior accepted ADRs; the reversal is deliberate and is
> recorded (see §10). Downstream `/plan` consumes this; the affected ADRs are amended there.
>
> Anchor intent: [`docs/intent/personal-harness.md`](../intent/personal-harness.md).
> Builds on: ADR-004 (memory), ADR-005 (fallback log/metric), ADR-006 (hook safety),
> ADR-007 (context injection), ADR-008 (reactive growth).

## 1. Objective

Give the harness one coherent **Context & Memory (C&M) subsystem** instead of four loosely
related hooks. The subsystem decides **what the agent recalls to do work** (read path) and
**what the harness captures to measure, grow, and resume itself** (write path), over a small
fixed set of stores. It is named in the intent as the harness's *highest daily leverage* work
— "*is* the harness's job."

The subsystem is built **in full now**. It is the deliberate **exception** to the harness's
reactive-growth rule (ADR-008): because it is the harness's core job and highest leverage,
its machinery is built up front rather than un-deferred reactively on logged repeat-need.
Reactive growth continues to govern *all other* growth.

## 2. The model — two paths over three stores

The spine is a **read/inject path** and a **write/capture path**, both operating over **three
stores** grouped into **two planes**, joined by one cross-plane **analyze pass**. (An
interactive map was rendered during brainstorming; the ASCII below is the durable copy.)

```
        KNOWLEDGE plane (recall to do work)              LIVE SESSION
        ┌───────────────┬───────────────────┐          (working window)
        │  CLAUDE.md     │  Native memory     │ ──READ·inject──▶ ┌──────────┐
        │  (durable)     │  (evolving +       │   SessionStart   │          │
        │                │   instincts)       │   5 budgeted     │ context  │
        └───────▲────────┴───────────────────┘   pointers       │  window  │
                │ analyze → instincts                            │          │
                │ (SessionEnd · cheap model)   ◀──WRITE·capture── │          │
        ┌───────┴────────┬───────────────────┐   PreToolUse /    └──────────┘
        │  Telemetry      │  Resume            │   SessionEnd /
        │  (fallback ·    │  (prior-context)   │   PreCompact
        │   obs · sessions)│                   │   narrow signal
        └───────────────┴───────────────────┘
        OPERATIONAL plane (measure, grow, resume)
```

**The through-line is restraint in both directions.** The read path won't **over-inject**
(budgeted, pointers-over-content — ADR-007). The write path won't **over-capture** (scoped
signal, never ecc's firehose). One philosophy, two directions; it is the design's spine, not
a footnote.

### Stores: three, two roles

| Store | Plane | Lifetime | Role | Mechanism |
|---|---|---|---|---|
| `CLAUDE.md` (global + project) | Knowledge | durable | conventions the agent always honors | native CC, layered |
| Native file-memory (global + project) | Knowledge | evolving | learned facts **+ instincts** | native CC (`MEMORY.md` + per-fact files), extended |
| Telemetry JSONL (`fallback-log` · `obs` · `sessions`) | Operational | operational | measure & grow the harness; raw material for instincts | hook-written |
| Resume (`prior-context`) | Operational | per-session-transient | cross-session checkpoint to resume | hook-written |

**No fourth store.** Instincts are *not* a new store — they extend native-memory frontmatter
(ADR-004 holds and is reinforced). Resume lives on the operational plane (transient,
harness-internal), **not** the knowledge plane, so durable recall is never polluted with
session transients.

## 3. Read path (inject)

A single fail-open hook, `session-context`, on **SessionStart**. It assembles a bounded block
of **pointers, not content** and injects it. Five blocks, highest-leverage first:

1. **`git`** — branch + dirty flag.
2. **`task-pointer`** — current task as a pointer (`"task X in progress → read docs/…"`),
   never the file's contents.
3. **`stack-detect`** — derived per-session from manifest files present
   (`package.json` / `Cargo.toml` / `pyproject.toml` / `go.mod` / …) → a one-line pointer,
   e.g. `stack: Next.js + Rust → language-plural review available`. Derived, not stored.
4. **`fallback-digest`** — last *N* fallback-log entries (the operational digest surfaced
   into context — the one place the operational plane feeds the read path directly).
5. **`prior-context`** — the resume-pointer written by the write path at the end of the prior
   session / before compaction. Cross-session resume.

**Budget:** default **≤ ~400 tokens** (raised from ADR-007's ~300 to fit the 5th block — a
**soft backstop** lifted to keep a *proven* block, not a hard cap;
[ADR-014](../decisions/ADR-014-quality-first-over-leanness.md)), env-tunable. When over budget,
**densify/consolidate first**, then cut **lowest-value-first**:
`fallback-digest → stack → prior-context → task → git`. Every block justifies its tokens or it is
cut — the cut sheds non-earners (noise/stale), never a proven-valuable block to hit the number.

## 4. Write path (capture)

Three hook events, **all narrow, all fail-open** (ADR-006). The write path captures a
**scoped signal** — never general activity.

| Event | Captures | Store written |
|---|---|---|
| **PreToolUse** (`Skill`\|`Task`\|`Agent`) | ecc-reach → `fallback-log` (ADR-005, unchanged) | Telemetry |
| **PreToolUse** (scoped) | **scoped obs**: corrections, repeat patterns, error→fix loops, explicit "remember this" — **not** every tool call | Telemetry (`obs`) |
| **SessionEnd** | metric-row (auto fields) + **resume-pointer** persist + **fires the analyze pass** | Telemetry (`sessions`) + Resume |
| **PreCompact** | **resume-pointer** persist (pre-compaction checkpoint survives) | Resume |

**Capture breadth is scoped by design**, not by deferral. The firehose stays off as a
standing constraint: capture lands in a *log*, never in main context, and a curated event set
keeps chaff out before the analyze pass even runs.

**Resume-pointer contents:** bounded (~5 lines) — last task, next step, key open files /
decisions. Pointers, not transcript.

## 5. Analyze pass (capture → instincts)

`SessionEnd` spawns a **headless cheap model** (Haiku) over the session's scoped obs. It
distills them into **instincts** and writes/updates them in the **evolving** store. It runs
**once per session, bounded, and never enters main context** (capture/analyze split — the
deterministic capture hook and the probabilistic analyze pass never share context).

**Instinct format** — extends native-memory frontmatter (no parallel store):

```yaml
trigger:    <one situation that fires it>
confidence: 0.3 … 0.9      # tentative → core; up on repeat/corroboration, down on correction/staleness
scope:      project | global
evidence:   <which observations created it>
```

Project→global **promotion** stays **minimal/reactive**: an instinct promotes only when it
recurs across projects (ecc's "2+ projects at avg confidence ≥ 0.8" is the reference shape).
The full instinct→cluster→skill evolution pipeline is **not** built — reactive growth
(ADR-008) covers that frontier.

## 6. Data flow — the loop

1. **SessionStart:** read path assembles 5 pointers (incl. `prior-context` from the prior
   session's resume) → injects bounded block.
2. **During the session:** write path captures the scoped signal (fallback-reach + scoped
   obs) → telemetry.
3. **PreCompact / SessionEnd:** write path persists the resume-pointer → resume store.
4. **SessionEnd:** analyze pass distills obs → instincts → evolving store; metric-row written.
5. **Next SessionStart:** instincts are now durable knowledge; resume-pointer becomes the next
   `prior-context`. The loop closes.

## 7. Invariants (the contracts)

- **No fourth store** — instincts extend native-memory frontmatter; resume lives on the
  operational plane. (ADR-004 reinforced.)
- **Analyze never enters main context** — strict capture/analyze split.
- **Fail-open is absolute** — every hook exits 0 on any error and does nothing; a broken hook
  never blocks or alters a session. None of these hooks is a blocking gate. (ADR-006.)
- **Restraint both ways** — read path budgeted; write path scoped. Each block/event justifies
  its footprint or is cut.
- **Knowledge ≠ telemetry** — durable recall is never polluted with operational/transient
  data; the only sanctioned crossing is the fallback-*digest* surfaced into the read path.

## 8. Lifecycle / hook-event map

| CC event | Hook | Path | Fail-open |
|---|---|---|---|
| SessionStart | `session-context` | read (inject 5 pointers) | yes |
| PreToolUse (`Skill`\|`Task`\|`Agent`) | `fallback-log` (+ scoped obs) | write (capture) | yes |
| PreCompact | resume-persist | write (resume) | yes |
| SessionEnd | metric-row + resume-persist + analyze-pass | write (capture + distill) | yes |

## 9. Defaults & knobs (all tunable; stated so they aren't silent)

- **Read budget:** `~400 tokens` default (soft backstop, not a hard cap — densify before dropping;
  [ADR-014](../decisions/ADR-014-quality-first-over-leanness.md)); env-tunable. Cut order:
  `fallback-digest → stack → prior-context → task → git`.
- **`fallback-digest` N:** last 3 entries (tunable).
- **Capture event set:** corrections, repeat patterns, error→fix loops, explicit "remember",
  ecc-reach. Widening this set is the one **reactive** dimension (membership gate, ADR-008).
- **Analyze model:** Haiku (cheap); SessionEnd-triggered headless run.
- **Instinct promotion threshold:** reference shape 2+ projects, avg confidence ≥ 0.8.
- **Resume-pointer:** ~5 lines, bounded.

## 10. Decision-record implications (handled in `/plan`, per the decision rule)

This subsystem reverses accepted ADRs; the reversal is **deliberate and recorded**, not
silently absorbed.

- **New ADR (recommended — e.g. ADR-011):** "Context & Memory subsystem — two paths over
  three stores, built now." Records the integrating architecture **and** the un-defer pivot
  (the subsystem is the deliberate exception to reactive-growth). Cross-links/amends the four
  below.
- **Amend ADR-004:** the "vendor ecc continuous-learning → deferred to backstop-only"
  alternative is **reversed** (instincts built now). The *core* decision — extend native
  memory, no fourth store — **holds and is reinforced**.
- **Amend ADR-005:** the fallback log's role as the **un-defer trigger** is **retired** (the
  un-defer happened by decision). The log's remaining roles — powering the dual
  fallback-rate × quality metric, and the reactive backlog for *other* growth — stand.
- **Amend ADR-007:** the read-path payload grows from 3 blocks to **5** (`stack-detect` and
  `prior-context` added); budget raised `~300 → ~400`; cut order updated.
- **Amend ADR-008:** carve out the C&M subsystem as the **named exception** — built now, not
  reactively. The gate still governs all other growth verbatim.
- **Update anchor intent** (`personal-harness.md` lines 67–69, 212): continuous-learning
  capture / lifecycle-persist move from *deferred/backstop-only* to *in-scope, built now*,
  scoped to this subsystem.

## 11. Build implications (for `/plan`, not decided here)

This is materially more than the old M3 (near-zero memory) + M4 (context injection). It adds:
a scoped-obs capture hook, the analyze pass, the instinct-format extension, lifecycle-persist
(PreCompact + SessionEnd resume), and the resume store. `/plan` will **re-milestone** it —
likely as its own phase rather than folded into Phase-0 — and will sequence the ADR
amendments above as tasks.

## 12. Out of scope

- The full instinct → cluster → skill/agent **evolution pipeline** (reactive growth covers it).
- A **fourth memory store** of any kind.
- **Broad/firehose** observation capture (scoped is a standing constraint).
- Any **blocking** behaviour — every hook here is advisory and fail-open.
- Reconstructing native **orchestration** (skill routing / context-window assembly).

## 13. Still open (non-blocking; resolve in `/plan` or first use)

- Exact headless-invocation mechanism for the SessionEnd analyze pass (`claude -p` vs a Task)
  — confirm against current CC docs at build time.
- Whether `obs` and `fallback-log` share one JSONL or are split files.
- The precise scoped-capture detectors (how "correction" / "repeat pattern" are recognized
  cheaply in a PreToolUse hook without a model call).
- Whether resume-persist at PreCompact and SessionEnd share one writer or two.
