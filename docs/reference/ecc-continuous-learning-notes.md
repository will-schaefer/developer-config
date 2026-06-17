# Reference: ecc continuous-learning-v2 — design lessons for nxtlvl

> **Reference-only distillation** (2026-06-16). ecc's `continuous-learning-v2` was inspected as a
> *book on the shelf*, not adopted. The observer was kept **off**; ecc returned to dormant after this
> pass. Continuous-learning is **deferred** in nxtlvl (intent lines 67–68) — this note exists so that
> when it is un-deferred, the design starts from ecc's hard-won shape instead of a blank page, and so
> two concrete findings feed the Phase-0 spec **now**. Source: the installed skill at
> `~/.claude/plugins/cache/ecc/ecc/2.0.0/skills/continuous-learning-v2` (`SKILL.md`, `hooks/observe.sh`).

## Architecture distilled (the borrowable ideas)

- **Atomic "instinct"** = one trigger → one action, with `confidence` (0.3 tentative → 0.9 core),
  `domain` tag, `scope` (project|global), and **evidence** (what observations created it). YAML
  frontmatter + markdown body — *the same shape as native CC file-memory.*
- **Capture / analyze split.** A cheap, always-on **hook** (`observe.sh`, PreToolUse + PostToolUse)
  appends raw observations 100% reliably; a **separate periodic background agent** (Haiku) turns
  observations → instincts. Capture is deterministic; analysis is probabilistic and cheap. The two
  never share context.
- **Confidence evolution.** Up on repeat / no-correction / corroboration; down on correction /
  staleness / contradiction. Promotion **project → global** when the same instinct appears in 2+
  projects at avg confidence ≥ 0.8.
- **Project scoping by git-remote hash.** Project ID = hash of `git remote get-url origin` (portable
  across machines), falling back to repo path, then global. A registry maps hash → name.
- **Evolution pipeline.** instincts → cluster → skill/command/agent. Atomic learnings compound into
  composite tools only after they prove out.

## What nxtlvl *borrows* (when CL is un-deferred)

| ecc idea | nxtlvl application |
|---|---|
| instinct frontmatter (trigger/confidence/evidence/scope) | **Extend native file-memory frontmatter** with these fields — not a parallel store. Honors "no fourth memory system" (intent line 195) and M3's "extend native, no new store." |
| capture/analyze split | nxtlvl's `fallback-log.sh` already *is* the capture half. The analyze half stays deferred; when built, keep it a separate cheap-model pass, never in main context. |
| confidence + project→global promotion | Maps onto native memory's project-vs-global scope (already directory-scoped + global `CLAUDE.md`). Add confidence only when repeat-need proves it. |
| evolution → skill | This *is* nxtlvl's reactive growth + written-intake gate, by another name. |

## What nxtlvl does **not** adopt

- **The separate `~/.local/share/ecc-homunculus` store** — a fourth memory system; explicitly out of scope.
- **Auto-on observation capture** — `observe.sh` logs *every* tool call the moment ecc is enabled
  (175 obs captured silently this session). nxtlvl captures only the **fallback signal** (ecc reaches),
  not all activity. Narrow beats firehose.
- **The duplicate-project-ID wrinkle** — this repo registered as *two* IDs (`2d2cb0578df2` by path
  before a remote existed, `1dbbbec1907b` by remote after). If nxtlvl ever scopes by project, key on
  **one** stable identifier from the start.
- The full evolution-to-agents pipeline — premature; reactive growth covers it.

## Two concrete findings that feed the Phase-0 spec NOW

1. **⚠️ Background/hook writes to `~/.claude` can be blocked by CC's sensitive-path guard.** ecc's own
   docs state it stores observer data *outside* `~/.claude` (`$XDG_DATA_HOME/ecc-homunculus`)
   **specifically** "so Claude Code's sensitive-path guard does not block background instinct writes."
   The spec currently writes `fallback-log.jsonl` and `sessions.jsonl` to **`~/.claude/nxtlvl/`** (M6/M7).
   **Risk:** the fallback-log hook (a background write to `~/.claude`) may be silently guarded — which
   would break the north-star metric. **Action:** the M0 stdin spike should also verify the hook can
   *write* to `~/.claude/nxtlvl/`; if blocked, relocate the log to `~/.local/share/nxtlvl/` (or set
   `CLV2`-style override). Reconcile the M7 path decision against this.

2. **`observe.sh` is a working template for `fallback-log.sh` + the M0 stdin spike.** Proven patterns
   to copy: `set -e`; `INPUT_JSON=$(cat)`; **`[ -z "$INPUT_JSON" ] && exit 0`** (fail-open on empty);
   extract fields with `python3 -c 'json.load(sys.stdin)…'`; phase from `$1` or
   `CLAUDE_HOOK_EVENT_NAME`. For the spike's open question — *which stdin field carries the invoked
   `ecc:`-prefixed name* — the same `json.load` dump on a real `Skill`/`Task` PreToolUse event answers
   it empirically (expect it under `tool_input`, e.g. the skill name / `subagent_type`).

## Related

- [[nxtlvl-harness]] · [[disable-ecc-active-hooks-dev]] · [[ecc-component-map]]
- Spec: [`docs/spec/nxtlvl-phase-0-mvh.md`](../spec/nxtlvl-phase-0-mvh.md) — M0 spike, M3 memory, M6/M7 hooks+log.
