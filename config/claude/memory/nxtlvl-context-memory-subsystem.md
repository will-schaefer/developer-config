---
name: nxtlvl-context-memory-subsystem
description: "The C&M domain: design FINAL + build COMPLETE + PROMOTED & LIVE-CONFIRMED (2026-06-22). Installed snapshot == repo HEAD (byte-identical); all 6 hook events wired & firing; Checkpoints A–D all empirically verified against the live store. Only deferred follow-ups C2/C3 + a future /evolve --generate dispatch (waits for a cluster) remain."
metadata: 
  node_type: memory
  type: project
  originSessionId: 32bba156-ec43-463c-a7a0-bbf1eed729b6
---

The harness's **Context & Memory (C&M) domain** — the umbrella over context-injection,
fallback/observe, and lifecycle-persist. Model: **two paths (read/inject + write/capture)
over three stores in two planes**, joined by a **SessionEnd cheap-model analyze pass** that
distills scoped obs → instincts (no 4th store). Through-line: restraint both ways. The user
**un-deferred the whole subsystem** as the deliberate exception to reactive growth (now ADR-015,
scope determination & extension gate) — it *is* the harness's core job.

**Design = FINAL.** Spec: `docs/spec/nxtlvl-context-memory-lifecycle.md` (status flipped FINAL→**BUILT**
in T6.2; supersedes the old `nxtlvl-context-memory-subsystem.md` + `context-awareness-hooks.md`).
Subsystem design (floor-on-demand backbone, quality-first) is recorded in that spec; its dedicated ADRs
used the old pre-reorg numbering and were **superseded by the 2026-06-28 ADR reorg** — the current
architecture homes are ADR-007 (memory architecture), ADR-008 (context assembly), ADR-009 (session
lifecycle), ADR-011 (observability), all Draft. The 5 `◇` build decisions remain LOCKED (2026-06-19):
D1 storage root `${XDG_STATE_HOME:-~/.local/state}/nxtlvl` (OUTSIDE ~/.claude + outside any sync root);
D2 bookmark gate ≥10 tool-calls OR mutation; D3 `/evolve` = thin cmd + deterministic `lib/evolve` +
`evolver` agent; D4 metrics in `/instinct-status` only; D5 observer = `claude-sonnet-4-6`.

**Build = COMPLETE (agent side).** All 🤖 tasks across Phases 1–6 built via the SDD loop
(implementer→review→fix→commit), on `main` (the feat branch was epitaxy-merged). **396 lib+hooks tests
green.** Shape: pure `lib/` (paths/project-identity/atomic/obs-log/instincts/recall/evolve/metrics/scrub/
bookmarks/observer-runner) under CC hooks (capture, observe=detached one-shot Sonnet, briefing=SessionStart,
close=SessionEnd, precompact=PreCompact steer, fallback-log.sh) + commands (/instinct-status /prune /promote
/evolve) + the isolated `evolver` authoring agent. **Invariants verified by the final whole-branch review
(opus) to hold ACROSS modules:** hooks fail-OPEN / scrubber fail-CLOSED / path-safety trust boundary
(assertSafeId internal) / effective-decayed confidence everywhere (recall 0.7, promote 0.8) / guarded
storage root / determinism (evolve+metrics). Final review fixed C1 (all 5 Node hooks lacked a stdin
`'error'` listener — the one fail-open escape) + C4 (git timeouts); deferred C2 (non-interactive-skip
asymmetry) + C3 (lock-TTL not code-enforced, defaults safe). All carried Minors triaged, zero blockers.

**PROMOTED & LIVE-CONFIRMED (2026-06-22).** Task 6.3 done: the installed cache snapshot is pinned to
`40c1b01` = repo HEAD and is **byte-identical** to HEAD for close.js/recall.js/hooks.json; all 6 hook
events wired (PreToolUse fallback-log+capture, PostToolUse capture+observe, SessionStart briefing,
SessionEnd close, PreCompact precompact). The floor has been running for days — no separate manual
promote was needed (epitaxy/auto-update already advanced the snapshot to HEAD). **All Checkpoints
empirically verified against the live store** (project key `24c59a845f421f40`, root
`~/.local/state/nxtlvl/projects/`): A (write path) — 2309 observations.jsonl lines + 63 distilled
instincts; B (briefing) — THIS session's SessionStart "Instincts loaded" block is the briefing+recall
reading that store; C (bookmark) — `bookmarks/main.jsonl`, latest the SessionEnd close hook; D (commands)
— `/instinct-status` (63 proj, dist mean 84%, 47/63 in top band), `/prune` (correctly nothing stale),
`/promote` (lists 19+ above the 0.8 bar), `/evolve` (considered 49/65, 0 clusters). North-star
**fallback rate = 0/137 sessions, 0 ecc invocations** — the floor has fully displaced the ecc backstop.
ONLY remaining: `/evolve --generate` live agent dispatch (legitimately waits — 0 candidate clusters meet
the strong-bar clustering threshold yet) + the deferred-follow-up list in the SDD ledger
`.superpowers/sdd/progress.md` (C2 non-interactive-skip asymmetry + C3 lock-TTL-not-code-enforced; both
behavior-touching, defaults safe). See [[nxtlvl-install-promotion]].

Related: [[nxtlvl-harness]], [[nxtlvl-install-promotion]], [[adr-numbering-collision-hazard]],
[[nxtlvl-context-alert-hook]], [[decision-recording-conventions]].
