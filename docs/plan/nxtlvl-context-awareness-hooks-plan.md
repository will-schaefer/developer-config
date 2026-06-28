# Plan: `nxtlvl` Context-Awareness Hooks

> Build plan consuming [`docs/spec/context-awareness-hooks.md`](../spec/context-awareness-hooks.md)
> (idea-refine + doubt-review artifact, 2026-06-17). Anchored on
> [`docs/intent/personal-harness.md`](../intent/personal-harness.md). Governs the rebuild of
> [`plugins/nxtlvl/hooks/context-alert.js`](../../plugins/nxtlvl/hooks/context-alert.js) (Hook 1)
> and a new PreCompact pointer-preserver (Hook 2).
>
> **Status: DRAFT for human review.** Companion checklist:
> [`nxtlvl-context-awareness-hooks-todo.md`](nxtlvl-context-awareness-hooks-todo.md).
>
> **Location note:** the `/plan` command defaults to `tasks/plan.md`; written here instead to match
> the project's locked convention (Phase-0 handoff decision #5: plans live under `docs/plan/`).

---

## 1. Framing

The spec is a sharpened one-pager, not yet a build plan. It carries **three unresolved open
questions** and **seven assumptions to validate** — several of which *gate* code shape. This plan's
job is to order the work so the blocking unknowns are killed *before* the rebuild they would
otherwise force a redo of, and to split every task into the part the agent can verify and the part
that needs a real interactive session.

Two hard project constraints shape every task below:

- **Manual gates exist.** The agent cannot run `/plugin`, `/compact`, or `/nxtlvl:*`, and cannot
  observe a live model turn. Anything requiring install or real-session observation is a **manual
  gate** the user runs in interactive `claude`. The agent does all *scriptable* verification
  (unit tests, fail-open smoke, 4-site grep) and stops at the gate.
- **Fail-open is absolute for these hooks.** Both are observation-only (not exit-2 gates), so they
  inherit the [ADR-006](../decisions/ADR-006-hook-fail-open-gated-blocking.md) contract: every path
  exits 0, errors emit nothing, never block or alter a tool call. The `osascript` notification and
  the PreCompact emit must both fail open by *design*, not assertion.

---

## 2. Dependency graph

```
                        ┌─────────────────────────────────────────────┐
                        │ P0  DE-RISK + LOCK BLOCKING DECISIONS         │
                        │                                               │
   (highest risk) ──►   │  T1  Spike: does additionalContext reach the  │
                        │      next assistant turn? (PostToolUse path)  │ ── informs ──► event choice
                        │                                               │
                        │  D-event     PostToolUse (keep) vs Stop       │
                        │  D-backstop  325K: notify+line vs notify-only │
                        │  D-portable  osascript darwin-only vs fallback│
                        └───────────────┬───────────────────────────────┘
                                        │ (decisions locked at Checkpoint A-pre)
                                        ▼
        ┌───────────────────────────────────────────────┐     ┌──────────────────────────────┐
        │ P1  HOOK 1 REBUILD  (ships first — daily win)  │     │ P2  HOOK 2  (PreCompact)     │
        │                                                │     │                              │
        │  T2  default → 200K across all 4 sites         │     │  D-docsel  active-doc rule   │
        │      (constant + hooks.json desc)              │     │      (MUST resolve first)    │
        │            │                                   │     │            │                 │
        │            ▼                                   │     │            ▼                 │
        │  T3  two-stage state machine + new message(s)  │     │  T5  PreCompact hook: select │
        │      + node --test unit tests   ◄── D-event    │     │      active docs/plan/ doc,  │
        │            │                                   │     │      emit pointer + next task│
        │            ▼                                   │     │      ◄── D-docsel            │
        │  T4  osascript notify (fire-and-forget)        │     │            │                 │
        │      ◄── D-backstop, D-portable                │     │            ▼                 │
        │            │                                   │     │  Checkpoint B (manual):      │
        │  Checkpoint A (manual): install, observe       │     │  compact real session,       │
        │  one-line FYI once + notification              │     │  confirm pointer survives    │
        └───────────────────────────────────────────────┘     └──────────────────────────────┘
                                        │
                                        ▼
                        ┌─────────────────────────────────────────┐
                        │ P3  PROMOTE + DEFERRED VALIDATION          │
                        │  T6  spec status update + /plugin promote  │
                        │  Deferred backlog: degradation A/B,        │
                        │  native ~900K confirm (non-blocking)       │
                        └─────────────────────────────────────────┘
```

**Critical path:** `T1 → D-event → T3`. The two-stage state machine cannot be finalized until the
event choice is locked (spec rows 4–5 are explicitly *provisional on the event choice*), and the
event choice should be informed by the T1 spike. Everything else hangs off that spine.

**Parallelism:** Hook 2 (P2) is a *different file* and shares no state with Hook 1. Once `D-docsel`
is locked it can be built in parallel with Hook 1's manual-observation window. T2 (default bump) is
independent of D-event and can land immediately as the first safe commit.

---

## 3. Decisions to lock before / during the build

These are the spec's open questions, surfaced as explicit decisions. Recommended defaults are given
so the plan can proceed on review; override any at the noted checkpoint. None rise to ADR-worthy
(small, reversible hook behavior — they fold into the spec per
the decision rule (`~/.claude/rules/decisions.md`) §1, not a new ADR).

| ID | Decision | Recommended default | Why / when |
|----|----------|---------------------|------------|
| **D-event** | PostToolUse (current) vs **Stop** hook | **Keep PostToolUse**, note Stop as a future cost-optimization | It's the shipping path, already wired, and `additionalContext` is documented-supported there. Migrating to Stop is an optimization, not a correctness need — don't block the rebuild on it. Revisit only if per-call cost bites. Confirm with T1. |
| **D-backstop** | 325K backstop: notify + agent-line **both**, or notification-only | **Notify-only** | By 325K the user has already ridden past one in-context ping; a second line risks reading as nagging. A blunter *notification* (AFK-catchable) is the higher-signal channel. Cheap to add the line later if notify-only proves too quiet. |
| **D-portable** | `osascript` darwin-only vs cross-platform fallback | **Darwin-only, fail-open silent** | Single-user macOS harness (spec). A non-darwin branch is speculative generality. Fail-open means a non-darwin host simply gets no notification — the in-context line still fires. |
| **D-docsel** | Hook 2 active-`docs/plan/`-doc rule: most-recently-modified vs `ACTIVE` marker/symlink vs agent-names-it | **Most-recently-modified `*.md` under `docs/plan/`** | Zero-config, deterministic, no new convention to maintain. The handoff/backlog/plan churn means "what I touched last" is a strong proxy for "active." If it misfires in practice, escalate to a single `ACTIVE` marker. **Must be locked before T5.** |

---

## 4. Phases & tasks

Each task is a **vertical slice**: a complete, independently verifiable increment that leaves the
hook working. Sizes: XS (<30 min), S (~1 hr), M (~half day).

### Phase 0 — De-risk the load-bearing assumption + lock decisions

#### T1 — Spike: confirm `additionalContext` reaches the next assistant turn *(S, manual gate)*

The spec names this the worst possible failure: if `additionalContext` is silently dropped on the
shipping (PostToolUse) path, the entire signal is a no-op. Kill this risk first, with **no production
code** — drive the *existing* hook at a tiny threshold.

- **Steps:** In an interactive session with the current hook installed, set
  `NXTLVL_CONTEXT_ALERT_TOKENS` to a value below current live context (e.g. `1000`). Trigger one tool
  call. Observe whether the *next* assistant turn visibly receives and surfaces the injected
  `additionalContext` text.
- **Acceptance:** Documented evidence (yes/no + a transcript excerpt) that the injected context
  reaches and is acted on by the next turn on PostToolUse.
- **Verification:** Manual — user runs it; reports the observation back.
- **Fail-fast:** If it does **not** reach the model, STOP. Re-open D-event toward the Stop hook (run
  the same sentinel test on a throwaway Stop hook) before any rebuild. Do not build T3 on a dead
  channel.
- **Feeds:** D-event.

> **Checkpoint A-pre (decision gate):** lock **D-event**, **D-backstop**, **D-portable** from §3
> using T1's result. These three set the *shape* of T3 and T4 — locking them now prevents a
> mid-rebuild redo. (D-docsel is for Hook 2; lock it before T5.)

---

### Phase 1 — Hook 1 rebuild (ships first — the daily-driver win)

#### T2 — Lift default threshold to 200K across all four sites *(XS, agent-verifiable)*

The cheapest safe win and an independently-checkable correctness criterion. The spec flags four sites
that must agree; today two are wrong (`DEFAULT_THRESHOLD = 180000` and `hooks.json` "default 180k")
and two already say 200K (the header + JSDoc comments).

- **Steps:** Set `DEFAULT_THRESHOLD = 200000` in
  [context-alert.js](../../plugins/nxtlvl/hooks/context-alert.js); update the `hooks.json`
  description "default 180k" → "default 200k".
- **Acceptance:** All four sites read 200K. A grep proves no `180` survives in either file's
  threshold language.
- **Verification (agent):**
  `grep -rn "180\|200000\|200k\|180k" plugins/nxtlvl/hooks/context-alert.js plugins/nxtlvl/hooks/hooks.json`
  → only 200K language remains; `node -e "require('./plugins/nxtlvl/hooks/context-alert.js')"` loads
  clean; fail-open smoke `printf '{}' | node plugins/nxtlvl/hooks/context-alert.js; echo $?` → `0`.
- **Note:** Leaves the *old* wind-down message in place momentarily — acceptable; the system stays
  working and correct on threshold. T3 replaces the message.

#### T3 — Two-stage state machine + replace `buildMessage` + unit tests *(M, agent-verifiable)*

The core rebuild. This is a **state-shape change**, not an additive tweak: from `{ alerted: bool }`
to two independent stages.

- **Steps:**
  - Replace the single-stage state with a **two-stage** model (e.g. `{ primary: bool, backstop: bool
    }`): the 200K *primary* ping and a ~325K *backstop* ping arm and fire **independently**, each
    once per crossing.
  - **Re-arm with hysteresis:** each stage re-arms when live context drops below its own floor
    (reusing `REARM_FRACTION`), so a `/compact` (context falls sharply) re-arms both for the next
    climb.
  - **Replace `buildMessage` wholesale.** Retire the wind-down / checkpoint / stop directive. Primary
    line: the one-line FYI — `Context ~200K — good to /compact at the next break` — framed as
    *surface at next report, do not stop*. Backstop (~325K): a blunter one-liner (in-context line only
    if D-backstop = both; otherwise the line is notification-only — see T4).
  - **Introduce a co-located unit test** `context-alert.test.js` using `node --test` (built into Node
    v24, no new dep, no package.json needed). The module already exports its internals for exactly
    this. *(This adds a lightweight test convention the project lacks — small, reversible, and the
    two-stage logic is precisely where unit tests earn their place. Flagged for review.)*
- **Acceptance:**
  - Climb to 200K fires the primary FYI exactly once; staying above does not re-fire.
  - Continuing to ~325K fires the backstop exactly once, independent of the primary.
  - A drop below the floors (simulated compaction) re-arms both; the next climb re-fires.
  - New message contains no "wind down / stop / checkpoint" language; primary asserts "don't stop".
  - Fail-open preserved: malformed stdin, missing transcript, unwritable state dir → emits nothing,
    exits 0.
- **Verification (agent):** `node --test plugins/nxtlvl/hooks/` green, covering: primary fire-once,
  backstop fire-once, independence, re-arm, and each fail-open path (bad JSON, null transcript). Plus
  the `printf '{}' | node ...; echo $?` → `0` smoke.
- **Depends on:** D-event (state machine shape), D-backstop (whether backstop emits a line).

#### T4 — `osascript` notification, fire-and-forget *(S, agent-verifiable)*

The one piece that touches the OS; separable because it carries its own fail-open contract.

- **Steps:** On a fire (primary always; backstop per D-backstop), spawn `osascript -e 'display
  notification ...'` **detached** (`spawn` with `stdio: 'ignore'`, `unref()`), swallow every error,
  and never `await`/block — it must not consume or stall the hook's 10s timeout. Darwin-only per
  D-portable; non-darwin is a silent no-op.
- **Acceptance:** Hook returns its `additionalContext` immediately regardless of notification
  success/failure; a thrown/missing `osascript` cannot reject the hook or delay exit.
- **Verification (agent):** Unit test injecting a spawn stub that throws → hook still returns the
  message and exits 0; assert the spawn call is non-blocking (mock receives `unref`/detached options).
  Manual confirmation that the banner *visibly appears* is folded into Checkpoint A.
- **Depends on:** D-portable, D-backstop.

> **Checkpoint A (manual gate — Hook 1 complete):** Reinstall via
> `/plugin marketplace update nxtlvl-dev`. In a real session, drive context past 200K (or lower the
> threshold) and confirm: (1) the one-line FYI appears in the *next report*, exactly once, agent does
> **not** stop; (2) the macOS notification fires and is **visible** (not eaten by DND/focus); (3) past
> ~325K the backstop behaves per D-backstop; (4) after `/compact`, a later climb re-arms and re-fires.
> Validates spec assumptions: *FYI appended reliably*, *notification reaches user*. **Hook 1 ships
> here.**

---

### Phase 2 — Hook 2: PreCompact pointer-preserver

> Lock **D-docsel** (§3) *before* starting T5 — the spec calls active-doc selection "the harder,
> unvalidated half" of Hook 2; picking the wrong pointer makes the rest moot.

#### T5 — PreCompact hook: select active plan doc, preserve pointer + next task *(M, mixed)*

- **Steps:**
  - New hook file (e.g. `hooks/precompact-pointer.js`); register a `PreCompact` block in
    [hooks.json](../../plugins/nxtlvl/hooks/hooks.json).
  - Select the active `docs/plan/` doc per D-docsel (default: most-recently-modified `*.md`).
  - Emit a PreCompact instruction that preserves **a pointer to that doc + the next task** through the
    native summary; emit a brief next-step only when **no** plan doc exists. Word it to also help the
    rare auto-compaction (~900K) case, where continuity matters most (spec open question).
  - Absolute fail-open: no plan dir, unreadable dir, no match → emit nothing, exit 0.
- **Acceptance:**
  - Given a `docs/plan/` with several files, the hook deterministically picks the most-recently-
    modified and emits a well-formed instruction naming that path + next task.
  - Empty/missing `docs/plan/` → graceful no-op (exit 0, nothing emitted).
- **Verification (agent):** `node --test` over a temp fixture dir — asserts correct file selection,
  payload shape (pointer + next-task), and the no-doc / unreadable fail-open paths. Fail-open smoke
  `printf '{}' | node hooks/precompact-pointer.js; echo $?` → `0`.
- **Depends on:** D-docsel.

> **Checkpoint B (manual gate — Hook 2 complete):** Reinstall. `/compact` a real session **with** the
> hook and confirm the `docs/plan/` pointer + next task **survive into the summary**; compare against
> a without-hook run. Validates spec assumption: *PreCompact instructions actually steer the native
> summary.* **Hook 2 ships here.**

---

### Phase 3 — Promote + deferred validation

#### T6 — Spec status update + promotion *(S, mixed)*

- **Steps:** Flip the spec status from DRAFT to built; note shipped behavior. Per the
  decision rule, confirm the awareness-only reframe folds into the spec and does **not** warrant a
  new ADR (it's small/reversible). Then the **manual** `/plugin` promote so the installed
  SHA-pinned snapshot picks up the committed hooks (per memory `nxtlvl-install-promotion`).
- **Acceptance:** Spec marked built; installed harness runs the new hooks (verified by a live
  crossing post-promote).
- **Verification:** Agent updates the doc; user runs promote + a confirming live crossing.

#### Deferred validation backlog *(non-blocking — monitor, do not gate shipping)*

These spec assumptions don't block the build; they're ongoing checks:

- **Degradation really bites at 150–200K** — occasionally A/B the same task type at low vs. high
  context; if quality holds to ~300K, raise the line.
- **Native auto-compaction fires ~900K on the 1M config** — confirm rather than assert (the
  "not redundant" conclusion survives a large error here, so low urgency).
- **Task-sizing materializes** (load-bearing bet) — this hook is *not* a safety net; if runaway
  sessions appear before workflow task-sizing rules exist, revisit the backstop.

---

## 5. Verification summary — who runs what

| Check | Agent-runnable | Manual gate |
|-------|:---:|:---:|
| 4-site threshold consistency (grep) | ✅ | |
| Module loads / fail-open smoke (`printf '{}' \| node …`) | ✅ | |
| Two-stage state machine unit tests (`node --test`) | ✅ | |
| Notification fail-open (spawn-stub throws) | ✅ | |
| Hook 2 doc-selection + payload + no-op (fixture tests) | ✅ | |
| `additionalContext` reaches the model (T1 spike) | | ✅ |
| FYI appears once, agent doesn't stop, notification visible (Ckpt A) | | ✅ |
| PreCompact pointer survives summary (Ckpt B) | | ✅ |
| Install / `/plugin promote` | | ✅ |

---

## 6. Risks & mitigations

- **`additionalContext` is a no-op on the shipping path** → T1 kills this *before* any rebuild;
  fallback is the Stop hook (D-event re-opens).
- **Mid-rebuild redo from a late decision** → all three code-shaping decisions (D-event, D-backstop,
  D-portable) lock at Checkpoint A-pre, before T3/T4.
- **Notification blocks/crashes the hook** → fire-and-forget contract is unit-tested with a throwing
  spawn stub (T4), not just asserted.
- **Hook 2 picks the wrong pointer** → D-docsel locked before T5; most-recently-modified is
  deterministic and fixture-tested; escalation path (`ACTIVE` marker) noted.
- **New `node --test` convention** → flagged for review in T3; zero-dep, reversible, and isolated to
  the hooks dir.
