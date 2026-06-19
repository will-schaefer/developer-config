# Domain Review — Hooks / automation (Mode C rubric)

> Per-domain specialist rubric for the **`harness-review` skill**, Mode C. `SKILL.md` is the spine;
> [`../domain-review.md`](../domain-review.md) is the framework; this file owns the **hooks** rubric.
> Neutral: judges a harness's hook system on **general best practice for event-driven automation** —
> nxtlvl's own lessons (inform-don't-force, single-objective-gate, fail-open) are cited as *rationale
> for why a checkpoint matters*, never as the bar the reviewed harness is scored against.

---

## 1. What this domain is — where to look

A harness's **hooks** are the shell/Node/Python programs the runtime invokes on lifecycle events —
the only place a harness executes deterministic code *around* the agent rather than asking the model
to behave. They gate tool calls, inject context, enforce conventions, and react to session
lifecycle. Read, in order:

- **The registration** — `hooks/hooks.json`, `settings.json` / `settings.local.json` `hooks` blocks,
  or a plugin manifest. This is ground truth for *what fires when*; the scripts are downstream.
- **Each hook script** — the actual executable (`hooks/*.js|*.sh|*.py`). Trust the wiring here over
  any philosophy doc.
- **The events used** — Claude Code's lifecycle events: `PreToolUse`, `PostToolUse`,
  `UserPromptSubmit`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd`, `PreCompact`,
  `Notification`. Note which the harness uses and whether the matchers are right. *(Cross-check the
  event list against current upstream docs — repo tables go stale.)*

---

## 2. The specialist rubric  (score each 1–5, justify with `file:line`)

**Dominant dimensions: D2 (failure posture) and D7 (intervention discipline)** — a hook system that
fails closed with no escape, or that hijacks the agent mid-task, is broken no matter how clean the
rest is. A fatal flaw in either caps the overall; don't flat-average it away.

| # | Dimension | The question it answers | What a 5 looks like | The failure mode (a 1) |
|---|-----------|-------------------------|---------------------|------------------------|
| 1 | **Event coverage & wiring** | Are hooks registered to the right events with correct matchers, and do they actually fire? | Every hook is wired to the event that carries the data it needs; matchers are precise; nothing dead-on-arrival. | Hook reads `tool_input.x` on an event that never carries it; broad matcher fires on everything; registered but never triggers. |
| 2 | **Failure posture** ⭐ | Is fail-open vs fail-closed chosen *deliberately* per hook, with an escape hatch? | Gates fail **closed** only where the risk warrants and ship a **kill switch**; everything else fails **open / toward silence** so a buggy hook never bricks the session. | A crash in any hook blocks the agent with no override; a session hook that can lock you out of your own driver. |
| 3 | **Exit-code & output contract** | Are exit codes and structured output used correctly for the event? | `exit 2` blocks only on `PreToolUse` where intended; JSON `hookSpecificOutput` is well-formed; `additionalContext` used where supported. | `exit 1`/`2` confusion; malformed JSON silently dropped; blocking attempted on an event that can't block. |
| 4 | **Idempotence & state safety** | Is re-firing safe, and are state writes guarded? | Re-running produces the same result; state files written atomically with a migration/fallback guard; no duplicate side effects. | Appends on every fire; corrupts state on concurrent runs; write to a guarded path fails silently and loses data. |
| 5 | **Performance budget** | Do synchronous hooks stay cheap enough not to drag every turn? | Hooks return in milliseconds; heavy work is bounded or backgrounded; no network/IO on the hot path. | A multi-second hook on `PostToolUse` taxing every tool call; unbounded scan on `UserPromptSubmit`. |
| 6 | **Script security** | Is the hook itself safe — injection, env, secrets? | Untrusted input is quoted / passed via `jq`/`xargs -0`, never interpolated into a shell string; env handled explicitly; no secret leakage to logs. | Tool input string-interpolated into `bash -c`; secrets echoed; relies on inherited env that may be sanitized away. |
| 7 | **Intervention discipline** ⭐ | Does the hook *inform* the agent or *force* it? | Hooks surface signals (context, warnings, notifications) and leave control with the agent; behavior-shaping lives in rules, not interrupts. | Hook silently rewrites the agent's plan, hard-stops mid-task on a heuristic, or steers via injected instructions the user never sees. |
| 8 | **Clarity & maintainability** | One clear job per hook, readable and documented? | Each hook does one thing; the registration is legible; a newcomer can trace event → script → effect. | One mega-hook switching on event type; opaque flags; registration and scripts drifted apart. |

---

## 3. What to hunt — the concrete checks

- **Wiring vs code mismatch** — for each registered hook, open the script and confirm it reads fields
  the event actually carries (the classic: `Skill` → `tool_input.skill`, `Agent` →
  `tool_input.subagent_type`). A registered-but-wrong hook scores D1 = 1.
- **The fail-closed audit** — for every hook that can block (`exit 2` / deny), ask: *what happens
  when this script throws?* No `try/catch` → no fallback → it fails **closed**. A blocking gate with
  no kill switch is the single most dangerous pattern in a hook system (D2). *(Why it matters:
  nxtlvl's dangerous-bash gate ships a kill switch precisely so a false positive can't lock the
  driver.)*
- **The intervention test** — does any hook change what the agent *does* (rewrites input, injects
  steering, hard-stops) versus what the agent *knows* (adds context, warns, notifies)? Forcing
  behavior from a hook is a D7 cap. *(Why: a hook firing on a heuristic mid-task can derail correct
  work the model was doing.)*
- **Exit-code correctness** — grep for `exit 2` / `process.exit`; confirm each is on an event where
  blocking is supported and intended, and that non-blocking hooks never exit non-zero by accident.
- **Injection surface** — grep for tool/user input flowing into `bash -c`, `eval`, `sh -c`, or
  unquoted `$(...)`. Safe systems route untrusted bytes through `jq`/`xargs -0`.
- **State-write guards** — find every file write; check for atomicity, a legacy-state migration path,
  and fail-toward-silence on write error (a background log that throws shouldn't surface as a crash).
- **Dead hooks** — registered hooks whose matcher can never match, or whose script is a no-op.

---

## 4. Partition & signal-vs-demo

- **Partition:** ≲ 4 hook scripts → one deep agent over the whole `hooks/` tree. More → one agent per
  script (or per event group), each scoring §2 and reporting the wiring it owns; synthesis rolls up.
  Always read the registration first and pass it to every agent as shared context.
- **Signal vs demo:** tutorial/teaching harnesses ship deliberately-trivial example hooks ("block
  `rm -rf`", "print on Stop") to demonstrate the API. Don't score those as craft — note them as demo
  and judge the *real* hooks.

---

## 5. Lessons & gotchas

- **A confident "hooks force discipline" philosophy doc is not a robust hook.** Score the registered
  script's actual failure path, not the rhetoric. The gap between claimed force and shipped fail-open
  is itself a finding (and usually the most interesting one).
- **Fail-open is the default-correct posture; fail-closed must earn it.** Most hooks should degrade to
  silence on internal error. Reserve fail-closed for a small set of genuinely dangerous operations,
  and only with a kill switch.
- **Block on objective facts, never on taste.** A gate that blocks on a binary, checkable condition
  (a destructive command, malformed frontmatter) is sound; one that blocks on a judgment call will
  misfire and erode trust — downgrade D2/D7.
- **Env reaching hooks is subtle** — `settings.json` `env` propagates and hot-reloads; an inline
  `VAR=x claude` may not; command hooks get a denylist-sanitized env. A hook that depends on an env
  var that won't arrive is a latent D2/D6 bug.
- **Cross-check the event table** against current upstream docs before trusting a repo's own list of
  hook events or their payload fields — they are a common source of stale reference material.
