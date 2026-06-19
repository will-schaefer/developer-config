# Session Handoff: `nxtlvl` Phase 0 — resume at M1

> Continuity doc for a fresh session. Read this first, then the anchors below.
> Written 2026-06-17, after Checkpoint A (M0) completed.

## Read these, in order
1. **Intent (anchor):** `docs/intent/personal-harness.md`
2. **Spec:** `docs/spec/nxtlvl-phase-0-mvh.md` (platform-facts rows are now spike-verified)
3. **Plan (16 tasks, M0–M7 + promotion):** `docs/plan/nxtlvl-phase-0-plan.md`
4. **Memory:** `nxtlvl-m0-status.md` (+ index `MEMORY.md`) — durable build state

## Where we are
**Checkpoint A (M0 walking skeleton) is COMPLETE and installed.** Tasks T1–T5 done. Next up is
**M1 / Task 6** (layered config). The build is being done **collaboratively** — show each file's
content and surface decisions *before/as* writing; pause at checkpoints; terse confirms = momentum
(see memory `terse-confirms-momentum`, `grill-branch-by-branch`).

## What exists (created this build, all verified)
```
.claude-plugin/marketplace.json                 name "nxtlvl-dev"; lists ./plugins/nxtlvl
plugins/nxtlvl/.claude-plugin/plugin.json        name "nxtlvl", v0.0.1
plugins/nxtlvl/skills/review/SKILL.md            composes agent-skills:review (frontmatter: name+description)
plugins/nxtlvl/hooks/hooks.json                  PreToolUse "Skill|Task" -> fallback-log.sh  (ONLY PreToolUse so far)
plugins/nxtlvl/hooks/fallback-log.sh             fail-open (exit 0 always); spike-capture branch
docs/plan/nxtlvl-phase-0-plan.md                 the task breakdown
```
Installed via `/plugin install nxtlvl@nxtlvl-dev`; `nxtlvl:review` is registered.
Verification used: `python3 -c "import json; json.load(open(...))"` for manifests/hooks;
`echo '{}' | bash plugins/nxtlvl/hooks/fallback-log.sh; echo $?` → 0 for fail-open.

## The spike result (LOAD-BEARING — the whole metric rides on it)
Captured real PreToolUse payloads (evidence at `~/.claude/nxtlvl/spike-stdin.json`):
- **`Skill` tool** → invoked name at **`tool_input.skill`** (captured `"ecc:aside"`).
- **subagent tool is `Agent`** (NOT `Task` — spec corrected) → name at **`tool_input.subagent_type`**
  (captured `"ecc:code-explorer"`). `ecc:` prefix present in both.
- **T12 fallback-log build:** branch on which field is present (not on `tool_name`); append one JSONL
  line iff the value starts with `ecc:`. **Set matcher to `Skill|Task|Agent`.**
- Spike toggle in `fallback-log.sh`: env `NXTLVL_SPIKE=1` OR sentinel file `~/.claude/nxtlvl/.spike-on`.
  Sentinel is currently OFF (removed). Writes to `~/.claude/nxtlvl/` from the hook WORK (risk in
  memory `nxtlvl-fallback-log-write-guard-risk` did not bite).

## ecc dormancy
Persisted `~/.claude/settings.json` → `enabledPlugins."ecc@ecc": false` (dormant — desired; do NOT
edit). As of this handoff ecc's agents/MCP have disconnected, i.e. **ecc now appears dormant in the
runtime** (a restart took effect). Re-enabling ecc is an ask-first act. `ECC_GATEGUARD=off` is known
ineffective; full dormancy is the fix (memory `disable-ecc-active-hooks-dev`).

## Locked decisions (the plan's 5 open questions — all defaults accepted)
1. Context-injection token budget (M4) = **≤ ~300 tokens (~20 lines)** — a *soft backstop*, not a hard cap; densify first, shed only non-earning blocks ([ADR-012](../decisions/ADR-012-quality-first-over-leanness.md)). Cut order: fallback-digest → task-pointer → git-line.
2. Hook wiring = **incremental** (PreToolUse@M0 ✓, SessionStart@M4, SessionEnd@M6).
3. Spike ecc-prefix confirmation = done live (both paths confirmed with real `ecc:` payloads). No further ecc re-enable needed.
4. `nxtlvl:dev` = **composes** the agent-skills loop, vendors nothing.
5. Plan/docs live under `docs/plan/`, `docs/spec/`, `docs/intent/`.

## Remaining tasks (from the plan)
- **M1 / T6 (NEXT):** global `~/.claude/CLAUDE.md` + project `Developer/.claude/CLAUDE.md`, each with a
  distinct probe value; prove both observable in one session. (Note: authoring `~/.claude/CLAUDE.md` is
  config, allowed — the "never hand-edit ~/.claude" rule is about not bypassing the marketplace plugin install.)
- **M2 / T7:** `nxtlvl:dev` skill composing `/spec→/plan→/build→/test→/review`.
- **M3 / T8:** layer native memory global-vs-project + recall proof — NO new store.
- **M4 / T9:** `session-context.sh` (budgeted pointer block) + wire SessionStart.
- **M5 / T10–T11:** `nxtlvl:research` skill (fresh; not ecc) + 3-workflow integration check.
- **M6 / T12:** thicken `fallback-log.sh` (real append, matcher `Skill|Task|Agent`, spike branch off
  by default) + add `session-metrics.sh` + wire SessionEnd + fault-injection proof.
- **M7 / T13–T14:** fallback-log exactly-one-line correctness + `sessions.jsonl` row + dual metric.
- **Promotion / T15–T16:** full real session ecc-dormant + git tag + rollback rehearsal.

## Operating rules / gotchas
- **Fail-open on *error* is absolute** for all hooks (gates included): no `set -e`, explicit `exit 0`
  on every error path, swallow all errors. A crash must never block. **Deliberate blocking (`exit 2`)
  is now permitted for named, gated gates** ([ADR-006](../decisions/ADR-006-hook-fail-open-gated-blocking.md));
  see the gate backlog (`docs/plan/nxtlvl-hook-gate-backlog.md`). All Phase-0 *session* hooks
  (fallback-log, session-context, session-metrics) remain observation-only → absolute fail-open.
  First gates: `dangerous-bash` (building, own session) + `config-protection` (committed future).
- **Install/iterate:** after editing the plugin, reinstall with `/plugin marketplace update nxtlvl-dev`
  (interactive `claude` only — the agent cannot run `/plugin` or `/nxtlvl:*`; those are manual steps).
- **Sandbox:** writes to `~/.claude/**` (outside the allowlist) need `dangerouslyDisableSandbox: true`;
  reads are fine. Repo writes under `Developer/` are sandboxed-OK.
- **Manual-gate tasks** (need interactive `claude`): T4, T5 (done), T11, T13–T15. Agent runs the
  scriptable checks (json parse, fail-open smoke, fault-injection); user runs install/invoke/observe.
- **Ask-first:** re-enabling ecc; adding any new skill/workflow (needs the written intake gate);
  new deps or hook events.
