# TODO: `nxtlvl` Context-Awareness Hooks

> Checklist companion to [`nxtlvl-context-awareness-hooks-plan.md`](nxtlvl-context-awareness-hooks-plan.md).
> 🤖 = agent-verifiable · 🧑 = manual gate (interactive `claude`) · ◇ = decision to lock.

## Phase 0 — De-risk + lock decisions
- [x] **T1** 🧑 Spike confirmed (2026-06-17): `additionalContext` reaches & is surfaced by the next
  assistant turn on PostToolUse. Channel live.
- [x] ◇ **D-event** — PostToolUse (Stop deferred as future cost-optimization). Confirmed by T1.
- [x] ◇ **D-backstop** — 325K = notify-only.
- [x] ◇ **D-portable** — osascript darwin-only / silent fail-open.
- [x] ◇ **D-docsel** — most-recently-modified `docs/plan/*.md` (Hook 2; escalate to `ACTIVE` if it misfires).
- [x] **Checkpoint A-pre** — all code-shaping decisions locked.

## Phase 1 — Hook 1 rebuild (ships first)
- [x] **T2** 🤖 Default → 200K at both sites (`DEFAULT_THRESHOLD` + `hooks.json` desc); all four sites
  agree; grep + load + fail-open smoke + JSON all pass.
- [ ] **T3** 🤖 Two-stage state machine (`{primary, backstop}`), independent fire-once + hysteresis
  re-arm; replace `buildMessage` with the one-line FYI (+ backstop line per D-backstop); add
  `context-alert.test.js` (`node --test`). Tests green; fail-open paths covered.
- [ ] **T4** 🤖 `osascript` notification fire-and-forget (detached, `unref`, errors swallowed, never
  blocks 10s timeout); darwin-only per D-portable. Spawn-stub-throws test passes.
- [ ] **Checkpoint A** 🧑 Install; real crossing → FYI once + agent doesn't stop + notification
  visible + backstop per D-backstop + re-arm after `/compact`. **Hook 1 ships.**

## Phase 2 — Hook 2 (PreCompact)
- [ ] ◇ **D-docsel** — lock active-doc rule (default: most-recently-modified `*.md`) **before T5**.
- [ ] **T5** 🤖 New `precompact-pointer.js` + `PreCompact` block in `hooks.json`; select active
  `docs/plan/` doc, emit pointer + next task (brief next-step if no plan doc); worded for ~900K
  auto-compaction too; absolute fail-open. Fixture tests + smoke pass.
- [ ] **Checkpoint B** 🧑 `/compact` real session with/without hook; confirm pointer + next task
  survive the summary. **Hook 2 ships.**

## Phase 3 — Promote + deferred
- [ ] **T6** 🤖🧑 Spec status → built (confirm no new ADR needed); 🧑 `/plugin` promote + confirming
  live crossing.
- [ ] Deferred (non-blocking): A/B degradation at 150–200K · confirm native ~900K · watch for runaway
  sessions vs the task-sizing bet.
