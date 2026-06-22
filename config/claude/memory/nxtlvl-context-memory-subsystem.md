---
name: nxtlvl-context-memory-subsystem
description: "The C&M domain: design FINAL + build COMPLETE (all 🤖 Phases 2–6 built/reviewed/committed, final whole-branch review done, 396 tests green @ tip on main); only the USER's manual install-observe batch (Checkpoints A–D + /plugin promote) remains."
metadata: 
  node_type: memory
  type: project
  originSessionId: 32bba156-ec43-463c-a7a0-bbf1eed729b6
---

The harness's **Context & Memory (C&M) domain** — the umbrella over context-injection,
fallback/observe, and lifecycle-persist. Model: **two paths (read/inject + write/capture)
over three stores in two planes**, joined by a **SessionEnd cheap-model analyze pass** that
distills scoped obs → instincts (no 4th store). Through-line: restraint both ways. The user
**un-deferred the whole subsystem** as the deliberate exception to reactive-growth (ADR-008) —
it *is* the harness's core job.

**Design = FINAL.** Spec: `docs/spec/nxtlvl-context-memory-lifecycle.md` (status flipped FINAL→**BUILT**
in T6.2; supersedes the old `nxtlvl-context-memory-subsystem.md` + `context-awareness-hooks.md`).
Subsystem decision = **ADR-013** (floor-on-demand backbone) + **ADR-014** (quality-first); ADR-004/005/007
amended, ADR-008 superseded-by-013, ADR-025 = project identity. All 5 `◇` decisions LOCKED (2026-06-19):
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

**REMAINING = USER MANUAL BATCH ONLY (🧑)** — I cannot do these (need a live install + real sessions):
Checkpoint A (write-path live-observe: obs log fills, observer writes instincts), B (briefing shows on
SessionStart), C (bookmark on non-trivial session / survives /compact), D (commands vs a seeded store +
`/evolve --generate` live agent dispatch), and **Task 6.3 = `/plugin` PROMOTE** then whole-floor live
confirmation. NOTE: the installed nxtlvl is a SHA-pinned cache snapshot — committed work needs a manual
promote to go live (see [[nxtlvl-install-promotion]]). Durable recovery map = the git-ignored SDD ledger
`.superpowers/sdd/progress.md` (per-task commit tips + the deferred-follow-up list: C2/C3 + T3.2 ⚠-text +
T4.1 tail-read perf + T2.1/T5.4a test-coverage gaps).

Related: [[nxtlvl-harness]], [[nxtlvl-install-promotion]], [[adr-numbering-collision-hazard]],
[[nxtlvl-context-alert-hook]], [[decision-recording-conventions]].
