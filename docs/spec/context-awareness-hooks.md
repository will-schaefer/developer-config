# Spec: `nxtlvl` Context-Awareness Hooks

> `idea-refine` artifact (divergent/convergent stress-test, 2026-06-17). Consumes the confirmed
> intent [`docs/intent/personal-harness.md`](../intent/personal-harness.md) and pressure-tests the
> already-built [`plugins/nxtlvl/hooks/context-alert.js`](../../plugins/nxtlvl/hooks/context-alert.js).
> Status: **DRAFT one-pager — sharpened direction agreed; not yet a build plan.**
> Note: the design got *smaller* than where it started — the redirect (don't interrupt; scope tasks
> instead) collapsed the wind-down / checkpoint / handoff machinery into a lightweight awareness signal.
> Smaller because that machinery became **irrelevant/unproven once compaction lands at user-chosen task
> boundaries**, not because small is the goal — quality/relevance drove the cut
> ([ADR-014](../decisions/ADR-014-quality-first-over-leanness.md)).
> Revised 2026-06-17 after a doubt-driven adversarial review (single-model; cross-model skipped):
> scoping made honest (the *code* change is a small rebuild — message + state machine — not a tune),
> and three gaps closed: two-stage state, Hook-2 active-doc selection, delivery/native-trigger assumptions.

## Problem Statement

**How might we** give a 1M-token session a lightweight, non-intrusive signal that context has climbed
into the quality-degradation zone — so the user can choose to `/compact` at a natural task boundary —
without the agent ever stopping mid-task, and without rebuilding anything native Claude Code does?

## Recommended Direction

The session reframed this from a *graceful-compaction-forcing* system into a *lightweight awareness*
one — and that's the real win. Two facts drove the collapse. First, **the window is 1M**, so native
auto-compaction (~900K) fires ~700K past the observed quality cliff (150–200K) — it's a distant
catastrophe backstop, not a competitor. This system is the *only* thing operating in the quality zone,
which fully validates building it. Second, **the agent must not interrupt work**, and task-sizing
belongs in future workflow rules, not this hook. Those two together dissolved the wind-down /
checkpoint / commit / handoff-file machinery originally speced — none of it earns its place once
compaction lands at *task boundaries* the user chooses.

What survives is lean. **Hook 1** fires one awareness ping at **200K**: the agent doesn't stop, doesn't
change course — it finishes the current step and appends **one plain line** to its next report
(`Context ~200K — good to /compact at the next break`), and a **macOS notification** fires so the user
catches it even AFK. If the user rides past, a single **blunter backstop ping at ~325K**, then silence.
Per-crossing arming with hysteresis re-arms after a compaction. **Hook 2** shrinks to its smallest
useful form: a PreCompact instruction that preserves a **pointer to the active `docs/plan/` doc + next
task** through the summary (a brief next-step only when no plan doc exists) — no separate handoff file,
because the plan doc *is* the durable artifact.

Bonus: the default is currently inconsistent across **four** sites — the header comment and the JSDoc
env block both say `200000`, but `DEFAULT_THRESHOLD` is `180000` and `hooks.json` describes it as
"default 180k". Lifting the default to 200K means editing **both** the constant *and* the `hooks.json`
description (the two comment sites already say 200K). Only after both edits do all four agree — a fix
that touches only the constant still leaves `hooks.json` wrong.

## Decisions Locked (this session)

| # | Question | Decision |
|---|----------|----------|
| 1 | Primary win | Compaction *sooner* than native — quality degrades with fill (observed 150–200K) |
| 2 | Window / redundancy | 1M window; native (~900K) is a distant backstop, **not** redundant with this system |
| 3 | Delivery | Agent surfaces in-context **+** macOS notification |
| 4 | Signal shape | Single ping (200K) + one far escalation backstop (~325K), then silent |
| 5 | Surfacing behavior | Agent does **not** stop; appends **one plain line at next report** |
| 6 | Continuity locus | Hook 2 **pointer-first** — preserve pointer to `docs/plan/` + next task; **no** handoff file |
| 7 | Checkpoint semantics | Retired — committing is normal task-boundary workflow, **not** hook-triggered |

> Note: rows 4–5 fix the signal's *shape and surfacing*, which are event-independent. The **arming
> cadence** that delivers them (per-crossing, hysteresis, the two-stage backstop) is **provisional on
> the event choice** still open below (PostToolUse vs Stop) — resolve that before finalizing the state
> machine.

## Key Assumptions to Validate

- [ ] **Task-sizing actually materializes** (load-bearing). The "just inform, don't stop" stance *bets*
  that future workflow rules keep tasks under budget. If they never get built, context can balloon with
  only an FYI to slow it. → Don't treat this hook as a safety net until that rule exists; revisit the
  backstop if runaway sessions appear.
- [ ] **Degradation really bites at 150–200K on Opus 4.8 (1M)** — observed, but watch for confirmation
  bias. → Occasionally A/B the same task type at low vs. high context; if quality holds to 300K, raise
  the line.
- [ ] **PreCompact instructions actually steer the native summary** (the plan pointer survives). →
  Compact a real session with and without Hook 2; check whether the `docs/plan/` pointer + next task
  land in the summary.
- [ ] **The agent appends the one-line FYI reliably** — not dropped, not repeated, not dramatized. →
  Observe a few real crossings; once-per-crossing hook logic should prevent repetition.
- [ ] **PostToolUse `additionalContext` actually reaches the model on the *shipping* path** (not just
  the Stop alternative in Open Questions — that one is already flagged, this is the path we ship).
  `additionalContext` is a supported CC field, so this is a *reliability* check, not an existence
  check: inject a sentinel at a crossing and confirm the next assistant turn sees and surfaces it. If
  it's silently dropped, the entire signal is a no-op — the worst failure for an awareness tool.
- [ ] **Native auto-compaction really fires ~900K on the 1M config** (it may be a *fraction* of the
  window, not a fixed 900K). → The 200K-vs-native gap is wide enough that the "not redundant"
  conclusion (Decision #2) survives a large error in this number — but confirm it rather than assert it.
- [ ] **The macOS notification reaches the user** (not eaten by DND/focus). → Trigger it once under the
  normal setup.

## MVP Scope

**In — this is a small rebuild of `context-alert.js`, not a parameter tune** (the "design got smaller"
framing is about *behavior*; the *code* delta is non-trivial):

- **default → 200K** at *both* the constant and `hooks.json` (per Bonus above).
- **Replace `buildMessage` wholesale.** The current text is a *wind-down / checkpoint / stop* directive
  — the exact interruption this spec retires — not a line to soften. The replacement is the one-line
  "surface at next report, don't stop" FYI (`Context ~200K — good to /compact at the next break`).
- **Rework the state machine** from the single `{alerted: bool}` to a **two-stage** model, so the 200K
  ping and the ~325K backstop arm and fire independently. This changes the state *shape* — it is not an
  additive "arm-point."
- **Add the `osascript` notification as fire-and-forget**: spawn detached, swallow all errors, and never
  let it block on or consume the hook's 10s timeout. Fail-open is *designed* here, not just asserted.

Then build **Hook 2** as a minimal PreCompact pointer-preserver — but first resolve how it identifies
the **active** `docs/plan/` doc (see Open Questions); the "pointer survives the summary" assumption is
moot until the hook can pick the right pointer.

**Sequencing:** Hook 1 can ship first (it's the daily-driver win); Hook 2 follows.

## Not Doing (and Why)

- **Triggering `/compact` from the hook/agent** — platform can't; user-initiated only.
- **Agent wind-down / stop / checkpoint / auto-commit at the ping** — interruption is ruled out;
  task-sizing handles bounding. (Retires the earlier "commit only if step done" answer — committing is
  now just normal task-boundary workflow, not hook-triggered.)
- **Agent-written handoff file** — `docs/plan/` already is the durable artifact; a second one is
  redundant.
- **Graded soft-line behavior-steering** — collapsed into the single FYI; steering the agent's
  behavior is exactly what was ruled out.
- **Fat structured compaction template** — dilutes the summary; pointer-first is sharper.
- **Statusline / metrics / cost tracking** — out per harness constraints (Max sub).

## Open Questions

- **Event choice:** PostToolUse-`*` (current; runs every tool call) vs. a **Stop hook** — now that the
  signal is just "mention at next report," Stop fires *exactly* at the report boundary and is far
  cheaper. Worth checking whether `additionalContext`-on-Stop reaches the next turn usefully before
  committing to it.
- **Backstop at ~325K:** notify + agent-line both, or notification-only?
- **Hook 2 active-doc selection (resolve before Hook 2 build):** `docs/plan/` can hold several files
  (today: a plan, a handoff, a backlog) with **no** machine-readable "active" marker. The hook needs a
  deterministic rule to choose the pointer — most-recently-modified, a convention (a single `ACTIVE`
  marker / symlink), or have the agent name it. This is the *harder, unvalidated half* of Hook 2:
  picking the right pointer, not just preserving it through the summary.
- **Hook 2 on auto-compaction (~900K):** PreCompact covers it — and that rare catastrophe compaction is
  *where continuity matters most*. Confirm the pointer instruction is worded to help there too.
- **Notification portability:** `osascript` is darwin-only; decide whether a non-darwin/DND fallback is
  worth it for a single-user harness.
