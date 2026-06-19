---
id: ADR-013
title: "Session-lifecycle backbone — always-on automatic floor plus on-demand commands; no close ritual"
status: Accepted
date: 2026-06-19
amended: 2026-06-19
---

# ADR-013: Session-lifecycle backbone — always-on automatic floor plus on-demand commands; no close ritual

## Context
The context-and-memory spec (2026-06-19) finalizes a session-lifecycle subsystem for `nxtlvl`.
Three earlier ADRs each committed to one piece of the subsystem: ADR-004 to native-only memory,
ADR-007 to a size-budgeted injection policy, and ADR-008 to deferring continuous-learning. The
spec makes decisions that amend or reverse all three; a new integrating ADR is needed to record
the organizing decision that ties them together and to give ADR-008's supersession a home.

The subsystem's central design question is: **what is automatic vs human-invoked, and where does
"closing" a session sit?** An early draft had a floor (automatic, always-on) and a ceiling
(a ritual at session end for distillation and graduation). The ceiling shrank as each of its
jobs moved elsewhere, and then dissolved entirely.

**Grounding in ecc.** The design is deliberately ecc-aligned. Reading `reference/ECC-main`
confirmed:
- ecc has **no ceiling ritual**. Nothing in `hooks.json` or `scripts/hooks/*` auto-fires
  evolution. The only invocations of `evolve` and `promote` are the `/evolve` slash command
  and the `instinct-cli.py evolve`/`promote` subcommands — always human-invoked.
- ecc's automatic loop stops at the observer. Graduating instincts into denser forms (skills,
  commands, agents) is kept human-invoked because it clusters with a model and writes files —
  something you eyeball before it lands.
- ecc has **no session quality rating**. The `Stop`-hook `evaluate-session.js` counts user
  messages (a size gate, default ≥10), never a score. Per-artifact quality attaches at save time
  via per-instinct confidence.

The ceiling's last remaining job was a session-quality score. Once that score was dropped (ecc
has none; the spec adopts the ecc model), nothing irreducible remained for the ceiling. It
dissolved.

**Two ecc cites, kept separate.** ecc-faithfulness soundly justifies *relocating distillation
into the floor* — ecc's observer does exactly this, running automatically in the background
during a session. It does **not** by itself justify the *graduation-trigger* decision. "ecc has
no ceiling → a ceiling has no value" is an appeal-to-reference, not an argument. The real
argument is that strong instincts can accumulate with no automatic graduation ritual, and that
gap is **accepted and mitigated** by the recall nudge that names the truncated instincts (see
Consequences), not by ecc precedent. The two rationales are kept separate to avoid conflating a
sound precedent with an unsound one.

## Decision
The `nxtlvl` session-lifecycle backbone is an **always-on automatic floor plus on-demand
commands. There is no close ritual ("ceiling").**

**Floor** — automatic, every session, cheap, fail-open:
1. **Briefing in** (`SessionStart` hook) — inject git line + newest bookmark (actual words) +
   quality-gated instincts (≥0.7 confidence, best-first, soft ceiling = nudge).
2. **Live capture during** (`PreToolUse` + `PostToolUse` hooks) — dumb, async, fail-open,
   env-var kill switch; truncates and scrubs secrets; appends raw observations to the durable
   log. Every 20 observations, spawn a one-shot background Haiku pass that reads new entries,
   updates instincts (confidence + decay), and exits.
3. **Telemetry + bookmark out** (`SessionEnd` hook) — if non-trivial (size gate): write dated
   bookmark; record fallback-rate. Trivial sessions write nothing; the previous bookmark stays
   current.

**On-demand commands** — run when the floor's recall nudge surfaces the need, always
human-invoked:
- `/evolve` — cluster strong instincts into a denser skill / command / agent.
- `/promote` — promote a project-scoped instinct to global.
- `/prune` — drop stale pending instincts.
- `/instinct-status` — review what has been learned (confidence, scope).

**Continuous-learning is un-deferred** (reverses ADR-008). The observer model: live capture →
one-shot Haiku background pass every ~20 observations → confidence-scored instinct files in a
separate store outside `~/.claude`. This is the floor's distillation mechanism.

**No session quality score anywhere.** Quality attaches per-artifact (per-instinct confidence,
at save time), not per-session. The two automatic readouts are fallback-rate and
instinct-confidence distribution (amends ADR-005).

## Alternatives Considered

### Floor + ceiling (the original two-layer design)
- Pros: explicit graduation checkpoint; a natural "did anything interesting happen this session?"
  moment.
- Cons: the ceiling's jobs dissolved one by one — distillation moved into the floor (observer),
  then the session quality score was dropped (ecc has none), leaving nothing irreducible. A
  ritual with no irreducible job is friction without value.
- Rejected: keeping a ceiling would be architecture-before-earned — the same failure ADR-008's
  intake gate exists to prevent.

### Thin "wrap up" button (lightweight ceiling)
- Pros: preserves an opt-in graduation moment without requiring it.
- Cons: the floor already nudges toward `/evolve` when the instinct ceiling is breached; a
  separate "wrap up" button duplicates that nudge with no additional value and adds a
  surface to maintain.
- Rejected: the recall nudge is the reactive signal; `/evolve` is already available on demand.

### Keep continuous-learning deferred (preserve ADR-008 as-is)
- Pros: simpler floor; no observer machinery to maintain; consistent with the original reactive
  growth principle.
- Cons: the spec's ecc-alignment pivot rests on direct inspection of `reference/ECC-main`.
  ecc's continuous-learning is not a heavyweight optional add-on — it is the mechanism that
  makes the instinct store self-populating. Without it, the recall block in the briefing
  always injects nothing (no instincts accumulate), gutting the highest-leverage part of the
  context-assembly policy (ADR-007). The "wait for the fallback log to prove repeat need"
  bar is met by design: the floor is always on; every session is a repeat need.
- Rejected: un-deferring is the informed choice after reading ecc's implementation.

### Auto-fire evolution on a schedule (cron or session-count trigger)
- Pros: graduation happens without needing to remember `/evolve`.
- Cons: an LLM that clusters instincts and writes files would rewrite history on a schedule,
  without eyeball review. ecc keeps `/evolve` and `/promote` human-invoked for exactly this
  reason. The briefing's recall nudge provides the reactive signal without auto-firing.
- Rejected: matches ecc; the floor nudges, humans graduate.

## Consequences
- **ADR-008 is superseded** in its core conclusion (continuous-learning deferral). Its
  intake-gate rule (membership test + written backlog entry for all other growth) is a
  sound standing convention that remains in effect — this ADR restates it rather than repealing
  it. Adding any new skill/workflow beyond the session-lifecycle subsystem still requires the
  written intake entry.
- **ADR-004 is amended**: a separate `nxtlvl` instinct store outside `~/.claude` is adopted
  for observer-learned instincts. Native file-memory is still extended for human-saved lessons.
  Two lesson homes coexist (human-saved vs observer-learned); an explicit ownership rule is
  needed only if they begin to overlap.
- **ADR-005 is amended**: the dual metric becomes two separate fully-automatic readouts —
  fallback-rate and instinct-confidence distribution. No whole-session quality score.
- **ADR-007 is amended**: recall is quality-gated (≥0.7, best-first, soft ceiling = nudge),
  not size-first. The bookmark is injected as actual words. Pointers-over-content holds for
  all other content.
- **ADR-006 is clarified, not unchanged** — §7 of the spec adds a carve-out (recorded as a
  clarifying note in ADR-006's Consequences, 2026-06-19): "fail open" means *never HALT the
  session* and does not waive the liveness-record, write-atomicity, or fail-closed-secret
  invariants. Every hook in the floor is still fail-open; each has an env-var kill switch;
  deliberate blocking via exit 2 remains gated.
- The floor is cheap and deterministic (no model calls on the briefing or close paths; the
  observer is a one-shot background process). A session that hard-kills before `SessionEnd`
  loses the bookmark (best-effort) but not the observation log (durable, appended every tool
  call). The next briefing's staleness flag covers the gap.
- Graduating learnings remains human-invoked. The floor's recall nudge names what was left out
  — e.g. *"3 strong instincts NOT loaded: `prefer-ripgrep`, `branch-before-commit`,
  `verify-by-content` → `/evolve` to consolidate"* — rather than reporting a bare count. The
  best-first list is already assembled, so names are free; naming the truncated instincts carries
  the *felt loss*, not just a count. This is the accepted mitigation for the graduation gap
  (strong instincts can accumulate with no automatic graduation ritual).
- The graduation gap itself — strong instincts accumulating with no automatic graduation — is
  **accepted**. The mitigant is the naming recall-nudge above; the precedent is *not* ecc
  (ecc has no ceiling, but that fact alone is not an argument for or against a ceiling here).
  The reactive fix, if the nudge proves insufficient, is a `/digest` command or scheduled
  `/evolve` prompt (recorded in spec §9, not built).
- Hook registration stays flat per event+matcher lane (ADR-008 hook-layer corollary, restated):
  a consolidating dispatcher is earned structure, admitted only once a lane carries ≥2 hooks.
