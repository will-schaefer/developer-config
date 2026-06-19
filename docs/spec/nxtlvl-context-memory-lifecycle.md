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
| **Live capture** | PreToolUse + PostToolUse hook | every tool call | truncate, scrub secrets (input+output, fail-closed), append raw observation | fail-open (exit 0); scrub failure drops the observation |
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
  **scrubs secrets — best-effort but fail-closed**, appends raw observations to the durable log.
  Scrubbing covers **both tool input and tool output** (a `.env` echoed in command *output* is as
  dangerous as one on a command line), runs **named-format regexes** (tokens, API keys, `.env`-style
  assignments) **plus an entropy-based redactor** for high-entropy strings the named patterns miss,
  and is **fail-closed**: if a scrub throws or cannot complete, the observation is **dropped**, never
  persisted raw (§7). "Best-effort" is the honest claim — no scrubber is omniscient; the *guarantee*
  is fail-closed, not zero-leakage.
- **Distillation = one-shot, not a daemon.** When the observation count hits **20**, spawn a fresh
  **Haiku** pass that reads new entries, updates instincts, and exits. (Deliberately avoids ecc's
  PID/lock/runaway-process machinery and macOS lock juggling.)
- Observer detects ecc's **four patterns**: corrections, error→fix, repeated workflows, tool prefs.
- **Skip guards:** never observe subagents, automated/non-interactive sessions, or the observer's
  own runs (prevents a self-watching loop).
- **Explicit "remember this"** writes **directly to native file-memory** (`MEMORY.md` + per-fact
  file), **bypassing the observer/instinct path entirely** — it is a human-authored lesson, not an
  inferred instinct. **Provenance is the ownership boundary** (§5): human-typed → native memory (no
  decay, no ≥0.7 gate, surfaced by native recall); observer-inferred → instinct store.

### 4.3 Context fills
- **`context-alert` nudge** — kept **exactly as-is** (PostToolUse, 200K + ~325K backstop).
- **PreCompact** — one hook whose **only** job is to **steer the summary**: preserve the current
  task/bookmark pointer + next step + key open files so the task thread survives compaction. It does
  **not** write a bookmark (the observation log is already durable on disk and needs no compaction-
  time action).

### 4.4 Close — SessionEnd (floor)
- Write a **dated bookmark note** for the current piece of work when the session is **non-trivial —
  (tool-calls ≥ threshold) OR (a commit or file mutation occurred this session)** (size gate; see X1).
  A short-but-pivotal session (e.g. three tool calls and one commit) **bookmarks**; a "glanced and
  left" session writes nothing and the previous note stays current.
- Record **fallback-rate** telemetry.
- **Crash-safety:** `SessionEnd` does **not** reliably fire on a hard kill / crash / closed window.
  That's acceptable because the **continuous observation log is the crash-safe substrate** (appended
  every tool call *during* the session). The bookmark is just a best-effort distillation on top:

  ```
  continuous (every tool call) ──► observation log   ← survives any death
          best-effort (clean exit) ──► bookmark        ← convenience distillation
  ```

  If a hard kill skips the bookmark, the **next briefing's staleness flag** (§4.1) catches it: the
  prior note + fresh git line are a **partial** starting point, not a full one. For a *long* crashed
  session they under-represent what was lost — the flag can say "stale," it cannot reconstruct the
  missing session. The durable observation log still holds the raw trail; turning that tail back into
  a bookmark is **heal-on-close** (§9, deferred — preferred over heal-on-read).

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
  Frequency-based confidence with **decay**. **Project-scoped + global.**
  - **Project identity = the git _common directory_** (`git rev-parse --git-common-dir`):
    **worktrees** of one repo **share** identity (and instincts); separate **clones** get **distinct**
    identities even at the same relative path. **Off-git, identity falls back to the working folder.**
    (The identity key is *irreversible* once instincts persist under it — chosen deliberately, see X4.)
  - **Atomic writes (tmp + `rename`).** Every instinct-file update writes a temp file and renames it
    over the target — concurrent or crashed writers never tear a file or lose an update (§7-b).
  - **Per-session single-flight guard.** Before spawning the one-shot observer, a per-session guard
    admits only one observer at a time for that session — the cheap stand-in for ecc's PID/lock
    machinery, sufficient because writes are atomic and the observer is short-lived.
  - **Lives outside `~/.claude`** (so the background writer clears Claude Code's sensitive-path guard).
- **Bookmark trail** — one **dated note per session**, grouped by **branch** (fall back to **folder**
  when not in git). Kept as a **trail**; the briefing reads the **newest**. Stored **privately,
  outside shared git history**.
- **Exact paths** are a `/plan` detail; the binding constraints are two: *outside `~/.claude`*
  (CC's sensitive-path guard) **and outside any sync/backup root** (Dropbox / iCloud / Time Machine —
  a syncing filesystem racing the writer corrupts append-only JSONL and defeats the atomic
  `tmp`+`rename`). **Recommend `$XDG_STATE_HOME/nxtlvl`** (machine-local *state*, not synced config).

> **Two "lesson" homes, split by provenance.** Native memory holds what *you* explicitly save
> ("remember this"); the instinct store holds what the observer *infers*. **Provenance is the
> ownership rule** — no longer "tracked, not built": a human-authored lesson never enters the
> instinct path, and an observer-inferred instinct never writes to native memory. The two **physical**
> stores stay separate regardless — CC's sensitive-path guard forces the instinct store outside
> `~/.claude` (below), so collapsing them isn't an option even if ownership were ambiguous.

---

## 6. Recall rule (quality-gated, not size-gated)

- Inject **every** instinct that is (a) **relevant** (this project's + global) **and** (b) at/above a
  **confidence bar** (default **≥0.7 "strong"**, tunable; distinct from the ≥0.8 global-promotion
  bar), ordered **best-first**.
- Cut low-confidence / off-project / **stale** as noise — staleness is handled automatically by
  confidence **decay** drifting below the bar.
- **Soft ceiling = backstop only, never silent truncation.** If strong instincts exceed it, inject
  best-first up to the ceiling **and** emit a visible nudge that **names what was left out** — e.g.
  *"3 strong instincts NOT loaded: `prefer-ripgrep`, `branch-before-commit`, `verify-by-content` →
  `/evolve` to consolidate."* The best-first list is already assembled, so the names are free; naming
  the truncated instincts carries the **felt loss**, not just a count. Repeated breaches are the
  signal to consolidate into a skill.

---

## 7. Safety & invariants

- **Errors always fail open — "fail open" means *never HALT the session*, not *silently do
  nothing*.** Any crash / bad-parse / timeout in any hook → the session proceeds uninterrupted
  (`exit 0`, no block). Failing open does **not** waive the three invariants below; each holds
  *even on the error path*.
  - **(a) Liveness.** A hook or the background observer that dies leaves a **one-line
    heartbeat/liveness record** — a silent observer death is a fault to surface at the next
    briefing (§4.1 staleness), never an invisible no-op.
  - **(b) Write-atomicity on shared stores.** Every write to a shared store (instinct files,
    logs) is atomic (tmp + `rename`) — a crashed or concurrent writer can never leave a torn,
    half-written, or lost-update record (§5).
  - **(c) The secret invariant is fail-*closed*.** If scrubbing throws or cannot complete, the
    observation is **DROPPED, never persisted raw** — a scrub failure must not fall through the
    "error → do nothing" path into a raw secret on disk.
- **Deliberate blocking (exit 2) is permitted only** as a **named, intake-gated, kill-switched
  gate** — never as a side effect of an error.
- **Every hook has an env-var kill switch**; capture additionally honors a skip flag.
- **Secret-scrubbing on capture is best-effort but fail-closed.** Best-effort because no scrubber
  catches every secret (see §4.2 for scope — input *and* tool **output**, named-format regexes
  *plus* an entropy redactor); fail-closed because on any scrub failure the observation is dropped,
  not stored. *(Drops the earlier "non-negotiable… never persist" absolute as an over-claim — the
  guarantee is* fail-closed, *not* omniscient.*)*
- **Never observe** subagents, automated/non-interactive sessions, or the observer's own runs.
- **Trust model = transparency + cheap undo, not gating.** Auto-saves land as **plain files you
  own**; *see* = open the file / `/instinct-status`; *undo* = edit/delete / `/prune`. No
  approve-before-write step (it would gut the automatic floor). **Known trade-off:** a
  silently-written instinct can steer the next session before you eyeball it; the **≥0.7 bar + decay**
  bound the blast radius (X2). A **probation flag** (quarantine new instincts from recall until
  confirmed) is recorded as the reactive-growth fix — built only if this ever burns a session (§9).

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
- **Heal-on-close / heal-on-read auto-distill** — regenerating a missing bookmark from the
  observation-log tail. **Preferred shape = heal-on-close** (regenerate at the *next clean
  `SessionEnd`*, off the latency-sensitive briefing path); heal-on-read (regenerate at briefing time)
  is the fallback but puts a model call on the briefing path. **Deferred** — no evidence of repeat
  pain yet (YAGNI); the staleness flag (§4.4) is the cheap stand-in. *(Decision D2: soften the §4.4
  claim now, build neither until a crashed long session actually burns us.)*
- **Bookmark trail trimming** — notes are tiny and only the newest is read; the big store (raw log)
  already self-bounds.
- **`/digest <work>`** — on-demand synthesis of one long trail (the *right* shape for "compress as it
  ages" — **not** a daily cron, which would auto-fire an LLM that rewrites history).
- **Approve-before-write** trust gate, and its lighter cousin the **instinct probation flag** (write
  silently but quarantine from recall until confirmed). Both deferred; the ≥0.7 bar + decay bound the
  silent-write-then-steer risk for now (§7, X2).

---

## 10. ADR implications

Per the meta-decision *ADRs are advisory, not canonical* — surface each conflict once, then proceed
and record a superseding/amending ADR. Hand these to **`nxtlvl:doc-keeper`** (owns ADR house format):

- **ADR-004** (extend native memory, no separate store) — **amend (two clauses)**: (1) a **separate
  `nxtlvl` instinct store outside `~/.claude`** is adopted (native memory still extended for
  human-saved lessons); (2) **provenance is the ownership boundary** — "remember this" routes
  directly to native memory and the observer never writes there, **replacing** ADR-004's
  "tracked, not built" ownership punt with a live rule.
- **ADR-005** (fallback log + dual metric) — **amend**: dual metric → **two automatic readouts**
  (fallback-rate + instinct-confidence); **no session quality score**.
- **ADR-006** (fail-open + gated blocking + kill switches) — **carry forward + clarifying note**:
  §7 adds a carve-out making explicit that "fail open" means *never HALT the session*, and does
  **not** waive (a) a one-line liveness record, (b) write-atomicity on shared stores, or (c) the
  fail-*closed* secret invariant (a scrub failure drops the observation, never persists it raw).
  This is a clarification of the existing rule, **not a reversal**.
- **ADR-007** (budgeted injection, pointers-over-content) — **amend**: recall is **quality-gated**
  (≥0.7, best-first, soft-ceiling-as-nudge that **names the truncated instincts**, not just a count),
  not size-first; bookmark shown as **actual words**. *(The naming refinement also refines
  [ADR-013]'s floor-recall consequence — see DOC.)*
- **ADR-008** (continuous-learning deferred) — **supersede**: continuous-learning is **un-deferred**
  and adopted as the floor's distillation mechanism.
- **Integrating ADR — recorded as [ADR-013]** (always-on floor + on-demand commands; dissolved
  ceiling) — the subsystem's organizing decision.
- **New ADR — project identity + observer concurrency** *(separate decision from ADR-013's
  backbone)*: **identity = git common-dir** (worktrees share, clones don't, folder fallback off-git),
  **atomic `tmp`+`rename` writes**, and a **per-session single-flight observer guard**. ADR-worthy
  because the identity key is **expensive to reverse** once instincts persist under it (D1 → a new
  ADR, not an ADR-013 consequence-amendment; next free number is **ADR-025**).

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
ceiling = backstop only, never silent truncation — over it, inject up to the ceiling **and** nudge by
**naming** the truncated instincts ("N strong instincts NOT loaded: [names] → `/evolve`"), not just a
count (the best-first list is already assembled, so the names cost nothing).

## Stage 2 — capture (floor; ecc-aligned)

- **Live capture hook:** dumb, every tool call (pre + post), `async`/non-blocking, fail-open,
  env-var kill switch. Truncates (~5k), scrubs secrets **best-effort + fail-closed** (input *and*
  output, named-format regexes + entropy redactor; a scrub failure drops the observation rather than
  persisting it raw), appends to durable log.
- **Distillation = one-shot, not a daemon.** At 20 observations, spawn a fresh Haiku pass that
  updates instincts and exits. Avoids ecc's PID/lock/runaway machinery.
- Observer detects ecc's four patterns: corrections, error→fix, repeated workflows, tool prefs.
- **Instinct format** (ecc shape): `id / trigger / confidence / domain / scope / evidence`
  (+ Action, Evidence); frequency-based confidence with decay. **Scope:** project + global.
- **Storage:** separate `nxtlvl` instinct store (departure from ADR-004), outside `~/.claude`.
- **Skip guards:** never observe subagents, automated sessions, or the observer's own runs.
- **Auto-purge** old observations (size/age). **Explicit "remember this"** does not enter the
  observation log at all — it routes **directly to native file-memory** (provenance ownership; §4.2/§5).
- **Ownership rule (now defined, not deferred):** two lesson homes split by **provenance** — native
  memory = you save (human-typed); instinct store = observer learns (inferred). Provenance *is* the
  rule (was "needs a rule if they overlap"); amends ADR-004.

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
  surfaces *when* to run `/evolve`. **Two ecc cites, kept separate (doubt-test correction):**
  ecc-faithfulness soundly justifies **relocating distillation into the floor** (ecc's observer does
  exactly this); it does **not** by itself justify the **graduation-trigger** decision — "ecc has no
  ceiling → a ceiling has no value" is an appeal-to-reference, not an argument. The gap this leaves
  (strong instincts can accumulate with no automatic graduation ritual) is **accepted and mitigated**
  by the recall nudge that *names* the truncated instincts (§6, T8), not by ecc precedent.
  (Rejected: B = thin "wrap up" button; C = richer review ritual.)

## Cross-cutting decisions

- **X1 (skip trivial sessions?) — LOCKED = A′, skip by size *OR* effect (refined).** *(Supersedes
  the earlier X1 = C "never skip"; the doubt-test then folded the once-rejected B back in as an
  OR-clause.)* Write a bookmark when **(tool-calls ≥ threshold) OR (a commit / file-mutation
  occurred)**; otherwise write **no** bookmark and the previous note stays current (dumb
  deterministic check; mirrors ecc's `evaluate-session` size gate, plus an effect signal). Gates
  only the bookmark write — the observer self-gates distillation by volume. A′ keeps A's win
  (skipping a "glanced and left" session leaves the prior substantive note newest) **and** fixes A's
  miss (a terse-but-pivotal one-commit session was being skipped under pure count). Threshold value =
  `/plan` detail. (Rejected: pure-count A — misses pivotal terse sessions; C = never skip — surfaces
  low-value notes.)
- **X2 (trust: see/undo auto-saves) — LOCKED = A, write silently + review on demand (ecc-style).**
  Auto-saves (bookmark, instincts) land as plain files the user owns; see = open / `/instinct-status`,
  undo = edit/delete / `/prune`. Not blind — the briefing surfaces them next session. Trust =
  transparency + cheap undo, not gating. **Secret-scrubbing is best-effort + fail-closed** (§7).
  **Trade-off recorded (doubt-test):** a silently-written instinct can **steer the next session** —
  it gets injected at briefing *before* a human ever eyeballs it (silent-write-then-steer). The blast
  radius is bounded by the **≥0.7 confidence bar + decay**: a wrong instinct needs repeated
  reinforcement to cross the bar and decays if reinforcement stops, so the risk is **accepted, not
  gated**. An **instinct probation flag** (quarantine new instincts from recall until confirmed) is
  the reactive-growth fix — **recorded, not built** (D3): add it only if a wrong-confident instinct
  actually burns a session. (Rejected: B = approve-before-write — friction that contradicts the
  automatic floor.)
- **X3 (bookmark trail trimming) — LOCKED = A, defer (YAGNI).** Notes are tiny; briefing reads only
  the newest; the raw log already self-bounds. (Rejected: B = trim now.) **Considered & deferred — a
  daily routine that consolidates old session notes:** the "compress as it ages" instinct is sound,
  but a scheduled cron is the wrong shape (it would auto-fire an LLM that rewrites history — the
  pattern S4-Q4 kept human-invoked; the briefing reads only the newest note anyway; a standing
  routine adds its own failure surface for a problem we have no evidence of). Preferred future shape:
  an on-demand `/digest <work>` command. Not built now; recorded.
- **X4 (multi-worktree + observer concurrency) — REOPENED, now decided** *(was "resolved, no new
  decision" — the doubt-test found "project identity" undefined and concurrent observers lacking a
  tear-safety story).* Decided: **identity = git common-dir** (`git rev-parse --git-common-dir`) —
  worktrees of one repo share identity/instincts, separate clones stay distinct, folder fallback
  off-git; **atomic `tmp`+`rename` writes** plus a **per-session single-flight guard** make
  concurrent or crashed observers safe **without** ecc's PID/lock daemon. Bookmarks remain
  branch-keyed (different branches separate; same-branch appends). Recorded as a **new ADR** rather
  than an ADR-013 consequence-amendment — the identity key is **expensive to reverse** once instincts
  persist under it (D1). See §5.
- **X5 (keep hands-on fast) — RESOLVED, already satisfied.** Capture async/non-blocking, observer
  one-shot background, briefing cheap/deterministic.
- **X6 (exact storage paths) — PUNT to `/plan`, but the *constraints* ship now.** Two binding
  constraints (no longer deferred): outside `~/.claude` (sensitive-path guard) **and outside any
  sync/backup root** (a syncing filesystem racing atomic renames corrupts append-only JSONL).
  **Recommended location: `$XDG_STATE_HOME/nxtlvl`.** Only the exact path remains a `/plan` detail.
