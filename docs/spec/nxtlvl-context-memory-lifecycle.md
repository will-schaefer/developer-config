# Spec: nxtlvl Context & Memory + Session Lifecycle

> **Status: FINAL (design).** Ready for `/plan`.
> **Supersedes** `docs/spec/nxtlvl-context-memory-subsystem.md` and
> `docs/spec/context-awareness-hooks.md` (both retired by this document).
> Produced via `/brainstorming` (2026-06-18 → 2026-06-19). The end-to-end design is in §1–§9;
> the full decision log (every choice, its rationale, and the rejected alternatives) is preserved in
> **Appendix A**. ADR amendments are listed in §10.
> Anchor (not relitigated): `docs/intent/personal-harness.md`.

---

## 1. Summary

A **session-lifecycle subsystem** for the `nxtlvl` personal harness. Its shape is an **always-on
automatic floor plus a few on-demand commands** — there is **no close ritual** ("ceiling").

Every session, the floor automatically:
1. **briefs** you at start (git state + where you left off + your strong learned habits),
2. **captures** what happens while you work (raw, cheap, fail-open),
3. **distills** that capture into *instincts* in the background (a one-shot model pass), and
4. **saves your spot** at close.

Separately, when the floor *nudges* you, you run **on-demand commands** to graduate accumulated
learnings into denser forms (`/evolve`, `/promote`).

It **extends Claude Code's native memory** (`CLAUDE.md` + `MEMORY.md`, auto-loaded) rather than
replacing it, and **adopts ecc's continuous-learning model** (live capture → background observer →
confidence-scored instincts) with one deliberate change: a **separate `nxtlvl` instinct store**
living **outside `~/.claude`**.

---

## 2. The loop

```
                        ┌─────────────────────────────────────────────────────┐
                        │                                                     │
                        ▼                                                     │
  ╔═══════════════════════════════════╗                                      │
  ║  SESSION START — briefing (floor)  ║   SessionStart hook, on top of        │
  ║  • git line (branch + dirty, fresh)║   CC's auto-loaded CLAUDE.md+MEMORY.md │
  ║  • newest bookmark (actual words)  ║   + staleness flag if log > bookmark   │
  ║  • strong instincts (≥0.7, best-   ║   → "N more, /evolve" nudge if over    │
  ║    first, soft ceiling = nudge)    ║                                        │
  ╚═══════════════════╤═══════════════╝                                        │
                      ▼                                                         │
  ╔═══════════════════════════════════╗                                        │
  ║  DURING — capture (floor)          ║   append → observation log             │
  ║  • live hook: every tool call,     ║   (durable, crash-safe substrate;      │
  ║    async, fail-open, scrub secrets ║    auto-purge >30d / 10MB)             │
  ║  • observer: one-shot Haiku /20obs ║   → instincts (4 patterns, conf+decay) │
  ║    skip subagents / automated      ║   separate store, outside ~/.claude    │
  ╚═══════════════════╤═══════════════╝                                        │
                      ▼                                                         │
  ╔═══════════════════════════════════╗                                        │
  ║  CONTEXT FILLS                     ║   • context-alert (200K + ~325K), as-is │
  ║  • PreCompact: steer the summary   ║   • survives compaction: log is durable │
  ║    (task/bookmark ptr + next step) ║                                        │
  ╚═══════════════════╤═══════════════╝                                        │
                      ▼                                                         │
  ╔═══════════════════════════════════╗                                        │
  ║  SESSION END — close (floor)       ║   SessionEnd hook                      │
  ║  • if non-trivial (size gate):     ║   hard-kill? → next briefing's         │
  ║    write dated bookmark (best-eff) ║   staleness flag covers it             │
  ║  • telemetry: fallback-rate        ║                                        │
  ╚═══════════════════╤═══════════════╝                                        │
                      │                                                         │
                      └──── loops back ────────────────────────────────────────┘

  ON-DEMAND (no ceiling ritual — run when the floor nudges you):
    /evolve   strong instincts → skill / command / agent
    /promote  project instinct → global
    /prune    drop stale pending instincts
    /instinct-status   review what's been learned
    /digest <work>     (future, reactive) synthesize one long trail
```

---

## 3. Components

| Component | Type | Trigger | Job | Failure mode |
|---|---|---|---|---|
| **Briefing** | SessionStart hook | session start | inject git line + newest bookmark (+ staleness flag) + quality-gated instincts | fail-open (no briefing) |
| **Live capture** | PreToolUse + PostToolUse hook | every tool call | truncate, scrub secrets, append raw observation | fail-open (exit 0) |
| **Observer** | one-shot subprocess (Haiku) | every 20 observations | read new observations → create/update instincts (confidence + decay) | fail-open (no distill) |
| **context-alert** | PostToolUse hook | ~200K / ~325K tokens | nudge before context pressure (kept **as-is**) | fail-open |
| **PreCompact steer** | PreCompact hook | compaction | preserve task/bookmark pointer + next step + open files in the summary | fail-open |
| **Close** | SessionEnd hook | clean session end | if non-trivial: write dated bookmark; record fallback-rate | fail-open (no bookmark) |
| **Observation log** | store | — | durable raw trail; crash-safe substrate; auto-purged | — |
| **Instinct store** | store | — | learned habits (confidence-scored), **outside `~/.claude`** | — |
| **Bookmark trail** | store | — | one dated note per session, per piece of work | — |
| `/evolve` `/promote` `/prune` `/instinct-status` | on-demand commands | user | graduate / manage instincts | — |

---

## 4. Stage detail

### 4.1 Briefing — SessionStart (floor)
Injects three blocks **on top of** what Claude Code already auto-loads (`CLAUDE.md` + `MEMORY.md`):

1. **git line** — current branch + uncommitted-changes flag, read **fresh** each start.
2. **bookmark** — the **newest** note for the current piece of work, shown as **actual words**
   (it's already a tiny summary; a pointer would be as long as the note). If the observation log has
   activity **newer** than this note, also show a **staleness flag** (see §4.4 crash-safety).
3. **quality-gated instincts** — per the recall rule (§6).

- Picking *which* native-memory lessons to surface is **native's job**, not ours.
- **On-demand roster** ("show my open work") and **backlog** of not-yet-started work are **out of
  scope** here (reactive adds later; see §9).

### 4.2 Capture + distillation (floor; ecc-aligned)
- **Live capture hook** — dumb, fires on **every tool call (pre + post)**, `async`/non-blocking,
  **fail-open** (any error → exit 0), with an **env-var kill switch**. Truncates (~5k chars),
  **scrubs secrets (non-negotiable)**, appends raw observations to the durable log.
- **Distillation = one-shot, not a daemon.** When the observation count hits **20**, spawn a fresh
  **Haiku** pass that reads new entries, updates instincts, and exits. (Deliberately avoids ecc's
  PID/lock/runaway-process machinery and macOS lock juggling.)
- Observer detects ecc's **four patterns**: corrections, error→fix, repeated workflows, tool prefs.
- **Skip guards:** never observe subagents, automated/non-interactive sessions, or the observer's
  own runs (prevents a self-watching loop).
- **Explicit "remember this"** is a clean live-capture trigger, kept regardless of the size gate.

### 4.3 Context fills
- **`context-alert` nudge** — kept **exactly as-is** (PostToolUse, 200K + ~325K backstop).
- **PreCompact** — one hook whose **only** job is to **steer the summary**: preserve the current
  task/bookmark pointer + next step + key open files so the task thread survives compaction. It does
  **not** write a bookmark (the observation log is already durable on disk and needs no compaction-
  time action).

### 4.4 Close — SessionEnd (floor)
- If the session is **non-trivial** (size gate; see X1), write a **dated bookmark note** for the
  current piece of work. Trivial sessions write nothing — the previous note stays current.
- Record **fallback-rate** telemetry.
- **Crash-safety:** `SessionEnd` does **not** reliably fire on a hard kill / crash / closed window.
  That's acceptable because the **continuous observation log is the crash-safe substrate** (appended
  every tool call *during* the session). The bookmark is just a best-effort distillation on top:

  ```
  continuous (every tool call) ──► observation log   ← survives any death
          best-effort (clean exit) ──► bookmark        ← convenience distillation
  ```

  If a hard kill skips the bookmark, the **next briefing's staleness flag** (§4.1) catches it — the
  prior note + fresh git line still give a real starting point.

### 4.5 On-demand commands (no ceiling)
Graduating learnings is **always human-invoked** (these cluster with an LLM and *write files* — you
eyeball them first). The floor's recall nudge tells you *when*.

- **`/evolve`** — cluster strong instincts → a denser **skill / command / agent** (`--generate` to
  write files).
- **`/promote`** — promote a project-scoped instinct to **global**.
- **`/prune`** — drop stale pending instincts.
- **`/instinct-status`** — review what's been learned (confidence, scope).

---

## 5. Data & storage

- **Observation log** — append-only raw trail (ecc `observations.jsonl` shape). **Durable**;
  **auto-purged** (entries >30 days; archive at ~10 MB) so it can't grow forever.
- **Instinct store** — one file per instinct, ecc frontmatter:
  `id / trigger / confidence / domain / scope (+ project_id) / source` + `## Action` + `## Evidence`.
  Frequency-based confidence with **decay**. **Project-scoped + global.** Keyed by **project
  identity** (shared across worktrees of the same repo). **Lives outside `~/.claude`** (so the
  background writer clears Claude Code's sensitive-path guard).
- **Bookmark trail** — one **dated note per session**, grouped by **branch** (fall back to **folder**
  when not in git). Kept as a **trail**; the briefing reads the **newest**. Stored **privately,
  outside shared git history**.
- **Exact paths** are a `/plan` detail; the only binding constraint is *outside `~/.claude`* for
  anything a background process writes.

> **Two "lesson" homes coexist** — native memory (things *you* save) and the instinct store (things
> the observer *learns*). Coherent for now; an explicit ownership rule is needed only if they begin
> to overlap (tracked, not built).

---

## 6. Recall rule (quality-gated, not size-gated)

- Inject **every** instinct that is (a) **relevant** (this project's + global) **and** (b) at/above a
  **confidence bar** (default **≥0.7 "strong"**, tunable; distinct from the ≥0.8 global-promotion
  bar), ordered **best-first**.
- Cut low-confidence / off-project / **stale** as noise — staleness is handled automatically by
  confidence **decay** drifting below the bar.
- **Soft ceiling = backstop only, never silent truncation.** If strong instincts exceed it, inject
  best-first up to the ceiling **and** emit a visible nudge: *"N more above the bar → `/evolve` to
  consolidate."* Repeated breaches are the signal to consolidate into a skill.

---

## 7. Safety & invariants

- **Errors always fail open.** Any crash / bad-parse / timeout in any hook → **exit 0, do nothing**.
- **Deliberate blocking (exit 2) is permitted only** as a **named, intake-gated, kill-switched
  gate** — never as a side effect of an error.
- **Every hook has an env-var kill switch**; capture additionally honors a skip flag.
- **Secret-scrubbing on capture is non-negotiable — secrets never persist.**
- **Never observe** subagents, automated/non-interactive sessions, or the observer's own runs.
- **Trust model = transparency + cheap undo, not gating.** Auto-saves land as **plain files you
  own**; *see* = open the file / `/instinct-status`; *undo* = edit/delete / `/prune`. No
  approve-before-write step (it would gut the automatic floor; can be added later if silent writes
  ever burn us).

---

## 8. Metrics

Two **separate, fully-automatic** readouts — **no whole-session quality score anywhere**:

- **fallback-rate** — reliability (how often the harness fell back), counted from the fallback log.
- **instinct-confidence distribution** — learning-quality, already carried on each instinct.

(The original "fallback-rate × quality" product is retired: quality attaches to **saved artifacts**,
ecc-style, not to sessions. Amends ADR-005.)

---

## 9. Explicitly deferred (YAGNI / reactive growth)

Built **only when a real pain appears**; recorded so the option isn't lost:

- **On-demand roster** ("show my open work") and **backlog** of not-yet-started work.
- **Heal-on-read auto-distill** — regenerating a missing bookmark from the log tail at briefing time
  (puts a model call on the latency-sensitive briefing path; the staleness flag is the cheap stand-in).
- **Bookmark trail trimming** — notes are tiny and only the newest is read; the big store (raw log)
  already self-bounds.
- **`/digest <work>`** — on-demand synthesis of one long trail (the *right* shape for "compress as it
  ages" — **not** a daily cron, which would auto-fire an LLM that rewrites history).
- **Approve-before-write** trust gate.

---

## 10. ADR implications

Per the meta-decision *ADRs are advisory, not canonical* — surface each conflict once, then proceed
and record a superseding/amending ADR. Hand these to **`nxtlvl:doc-keeper`** (owns ADR house format):

- **ADR-004** (extend native memory, no separate store) — **amend**: a **separate `nxtlvl` instinct
  store outside `~/.claude`** is adopted (native memory still extended for human-saved lessons).
- **ADR-005** (fallback log + dual metric) — **amend**: dual metric → **two automatic readouts**
  (fallback-rate + instinct-confidence); **no session quality score**.
- **ADR-006** (fail-open + gated blocking + kill switches) — **carry forward** verbatim (§7).
- **ADR-007** (budgeted injection, pointers-over-content) — **amend**: recall is **quality-gated**
  (≥0.7, best-first, soft-ceiling-as-nudge), not size-first; bookmark shown as **actual words**.
- **ADR-008** (continuous-learning deferred) — **supersede**: continuous-learning is **un-deferred**
  and adopted as the floor's distillation mechanism.
- **New integrating ADR** — record the **always-on floor + on-demand commands** backbone (the
  dissolved ceiling) as the subsystem's organizing decision.

---
---

# Appendix A — Decision log (rationale & rejected options)

> The staged brainstorm record. Each entry is a single atomic decision with its rationale and the
> alternatives rejected. Section §1–§10 above is the normative spec; this appendix is the *why*.

## Meta-decisions

- **ADRs are advisory, not canonical.** Cite them for rationale; mark departures explicitly and
  record each as a superseding/amending ADR. (Saved to memory: `adrs-advisory-not-canonical`.)
- **Backbone: always-on floor + on-demand commands** (the "ceiling" dissolved — see S4-Q4).
  - **Floor** = automatic, every session, cheap, fail-open. Briefing in → live capture + one-shot
    observer during → telemetry + bookmark out. The observer does all distillation.
  - **No ceiling ritual.** Graduating learnings is left to on-demand commands (`/evolve`,
    `/promote`), surfaced reactively by the floor's recall nudge. Matches ecc.
  - *History: the design began as "floor + ceiling"; the ceiling shrank as distillation moved into
    the floor (ecc pivot), then the session rating was dropped (S4-Q3, superseding the earlier
    inferred-rating lock), until nothing irreducible was left for it (S4-Q4).*
- **ecc-alignment pivot:** un-defer continuous-learning; adopt ecc's live-capture + background
  observer model (overrides the earlier "keep the floor dumb, judge only at the ceiling" lean, and
  ADR-004 / ADR-008). Informed choice after reading `reference/ECC-main`.

## Stage 1 — the briefing (floor; SessionStart hook)

Three injected blocks on top of `CLAUDE.md` + `MEMORY.md`: **git line**, **bookmark** (newest, actual
words), **quality-gated instincts**. Picking which native lessons to surface is native's job.
On-demand roster and backlog are reactive adds, out of scope.

**Bookmark mechanics:** one pile of notes per piece of work, grouped by **branch** (folder fallback);
kept as a **trail** (each session a dated note; briefing shows newest); stored **privately, outside
shared git history** and **outside `~/.claude`** for the background writer.

**Recall rule (locked) — quality-gated, NOT size-gated** *(supersedes ADR-007 size-first framing)*:
inject every instinct that is relevant (project + global) and ≥ the confidence bar (default ≥0.7,
tunable), best-first; cut low-confidence/off-project/stale as noise (staleness via decay); soft
ceiling = backstop only, never silent truncation — over it, inject up to the ceiling **and** nudge
"N more above the bar → `/evolve`."

## Stage 2 — capture (floor; ecc-aligned)

- **Live capture hook:** dumb, every tool call (pre + post), `async`/non-blocking, fail-open,
  env-var kill switch. Truncates (~5k), scrubs secrets (non-negotiable), appends to durable log.
- **Distillation = one-shot, not a daemon.** At 20 observations, spawn a fresh Haiku pass that
  updates instincts and exits. Avoids ecc's PID/lock/runaway machinery.
- Observer detects ecc's four patterns: corrections, error→fix, repeated workflows, tool prefs.
- **Instinct format** (ecc shape): `id / trigger / confidence / domain / scope / evidence`
  (+ Action, Evidence); frequency-based confidence with decay. **Scope:** project + global.
- **Storage:** separate `nxtlvl` instinct store (departure from ADR-004), outside `~/.claude`.
- **Skip guards:** never observe subagents, automated sessions, or the observer's own runs.
- **Auto-purge** old observations (size/age). **Explicit "remember this"** kept regardless.
- **Consequence flagged:** two lesson homes (native memory = you save; instinct store = observer
  learns) — coherent now; needs an ownership rule if they overlap.

## Stage 3 — context fills

- **Keep `context-alert` as-is** (PostToolUse, 200K + ~325K backstop).
- **S1 (PreCompact ownership) — LOCKED = A.** One PreCompact hook, job = **steer the summary**
  (preserve task/bookmark pointer + next step + key open files). The observation log is already
  durable, so it survives compaction with no action; the bookmark file is written at close, not
  here. (Rejected: B = also write a crash-insurance bookmark here; C = two separate hooks.)

## Stage 4 — close

- **S4-Q1 (bookmark trigger) — LOCKED = A.** Written **automatically on every session end** via a
  `SessionEnd` hook (floor's job; no remembering). (Rejected: B = only on a ceiling ritual; C = both.)
- **S4-Q2 (crash-safety) — LOCKED = A + staleness-flag, auto-distill deferred.** `SessionEnd` doesn't
  reliably fire on hard kill/crash; acceptable because the **continuous log is the crash-safe
  substrate** and the bookmark is a best-effort distillation on top. The briefing does a cheap
  timestamp compare (log newer than bookmark? → **staleness flag**, no model). Deferred: heal-on-read
  auto-distill. Rejected outright: PreCompact as the crash fallback (only fires on compaction, so it
  does nothing for a short session killed before the first compaction).
- **S4-Q3 (quality-rating seam) — LOCKED = drop session-level quality (ecc-aligned).** *(Supersedes
  the earlier S4-Q3 = C "auto-infer a session score" lock.)* Grounding: ecc has **no session quality
  rating and no dual metric** — its `Stop`-hook `evaluate-session.js` only **counts user messages**
  (size gate, default ≥10), never a score; where ecc judges quality it's per-artifact, at save time
  (per-instinct confidence; `agent-evaluator` / `agent-self-evaluation`; `learn-eval`). Decision:
  no whole-session number (not human-rated, not inferred); quality attaches to saved instincts.
  Ripple → dual metric splits into two automatic readouts (amends ADR-005). Ripple → the ceiling
  loses its last job. (Rejected: A = human rates at ceiling; B = prompt every session-end; C =
  auto-infer a session score — prior lock, now superseded.)
- **S4-Q4 (what remains of the ceiling) — LOCKED = A, the ceiling dissolves.** Grounding: ecc has
  **no ceiling** — verified by grep, nothing in `hooks.json` or `scripts/hooks/*` auto-fires
  evolution; the only invocations of `evolve` are the `/evolve` slash command and the
  `instinct-cli.py evolve` CLI subcommand (same for `/promote`). ecc's automatic loop stops at the
  observer; graduating is always human-invoked (it clusters with an LLM and writes files). Decision:
  no close ritual at all — backbone = always-on floor + on-demand commands; the floor's recall nudge
  surfaces *when* to run `/evolve`. More ecc-faithful than keeping a ceiling, not a departure.
  (Rejected: B = thin "wrap up" button; C = richer review ritual.)

## Cross-cutting decisions

- **X1 (skip trivial sessions?) — LOCKED = A, skip by size (ecc-style).** *(Supersedes the earlier
  X1 = C "never skip" lock.)* A `SessionEnd` below a small threshold writes **no** bookmark; the
  previous note stays current (dumb deterministic count; mirrors ecc's `evaluate-session` gate).
  Gates only the bookmark write — the observer already self-gates distillation by volume. A beats C
  because skipping leaves the prior substantive note as the newest (C surfaced low-value "glanced and
  left" notes). Threshold value = `/plan` detail. (Rejected: B = skip unless a file/commit changed;
  C = never skip.)
- **X2 (trust: see/undo auto-saves) — LOCKED = A, write silently + review on demand (ecc-style).**
  Auto-saves (bookmark, instincts) land as plain files the user owns; see = open / `/instinct-status`,
  undo = edit/delete / `/prune`. Not blind — the briefing surfaces them next session. Trust =
  transparency + cheap undo, not gating. Secret-scrubbing non-negotiable. (Rejected: B =
  approve-before-write — friction that contradicts the automatic floor.)
- **X3 (bookmark trail trimming) — LOCKED = A, defer (YAGNI).** Notes are tiny; briefing reads only
  the newest; the raw log already self-bounds. (Rejected: B = trim now.) **Considered & deferred — a
  daily routine that consolidates old session notes:** the "compress as it ages" instinct is sound,
  but a scheduled cron is the wrong shape (it would auto-fire an LLM that rewrites history — the
  pattern S4-Q4 kept human-invoked; the briefing reads only the newest note anyway; a standing
  routine adds its own failure surface for a problem we have no evidence of). Preferred future shape:
  an on-demand `/digest <work>` command. Not built now; recorded.
- **X4 (multi-worktree) — RESOLVED, no new decision.** Bookmarks keyed by branch → different
  worktrees on different branches separate; same-branch appends. Instincts keyed by project identity,
  shared across worktrees. One-shot observer avoids lock/PID contention.
- **X5 (keep hands-on fast) — RESOLVED, already satisfied.** Capture async/non-blocking, observer
  one-shot background, briefing cheap/deterministic.
- **X6 (exact storage paths) — PUNT to `/plan`.** Only binding constraint: instinct store outside
  `~/.claude` (sensitive-path guard).
