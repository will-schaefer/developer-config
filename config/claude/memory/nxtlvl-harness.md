---
name: nxtlvl-harness
description: "nxtlvl — the user's personal Claude Code agent-harness plugin; what it is and where the anchor doc lives."
metadata: 
  node_type: memory
  type: project
  originSessionId: 794f06a2-18d8-40ab-b498-49d6500c44eb
---

`nxtlvl` (namespace `nxtlvl:<skill>`, theme "next-level agents") is the user's personal, production-quality **Claude Code plugin** — an agent harness reproducing ecc's *architecture* (layered config, skills, agents, hooks, audit, memory, context assembly) scoped to their needs, not ecc's breadth. It does not exist as a plugin yet; building it is the work. Deliberate rebuild after wiping `~/.claude`; the goal is a harness owned and understood "to the metal."

**Anchor doc (source of truth, read before any nxtlvl work):** `docs/intent/personal-harness.md` — produced via `interview-me`, hardened by a 20-question `grill-me` pass (2026-06-16). Downstream specs/plans consume it.

**ADRs (the load-bearing decisions, recorded 2026-06-17):** `docs/decisions/` (index `README.md`, ADR-001…011) — packaging, ecc-dormant, compose-not-reconstruct, native-memory, fallback-metric, hook fail-open, context policy, intake gate, invoked audit, global-decision-rule, prose-quality. Read these for the *why* behind any decision before re-litigating it.

**Dissecting agent-skills ("dissect as we go"):** migrate a skill from `agent-skills` into `nxtlvl` by **reactive vendoring**, never deletion — copy + refine-for-fit into `plugins/nxtlvl/skills/<name>/SKILL.md` (drop the live `agent-skills:` call), gated by an ADR-008 intake entry logged at `docs/plan/nxtlvl-skill-intake-backlog.md` (interim until M7's `fallback-log.jsonl`). agent-skills stays installed + untouched → **dormant-not-deleted** endpoint (ADR-002, generalized 2026-06-17). First vendored: `documentation-and-adrs` → `nxtlvl:documentation-and-adrs` (house ADR format baked in; canonical name repointed in `~/.claude/CLAUDE.md` + `rules/decisions.md`). `review` is still a thin overlay wrapper — overlay is the default; vendor only when a skill earns refinement.

**Core decisions (full detail in the doc, don't duplicate):** reconstruct the *plumbing* (packaging, context assembly, memory extending native CC, lean hooks, audit) — that's the learning target; *compose* the SDLC workflows on agent-skills (vendor-and-refine); keep *orchestration native* (never rebuild routing/dispatch). ecc demoted to **dormant** opt-in fallback. Success metric = **fallback-rate by session** (not audit-delta). Repo = workbench, installed `~/.claude` = daily driver; promotion = local-marketplace install gated by an invoked `nxtlvl:audit`.

**Hook stdin field shapes (M0 spike, verified 2026-06-17):** in PreToolUse payloads the invoked-name
field is tool-specific — `Skill` tool → `tool_input.skill`; the subagent tool is named **`Agent`** (not
`Task` as specs often assume) → `tool_input.subagent_type`; both carry the `ecc:`-style namespaced name.
Branch on which field is present, not on `tool_name`.

**Why:** The learning target is *agent-harness architecture itself*, not the substance of how-to-review/develop — a boundary that keeps scope from re-expanding to ecc size.

**How to apply:** Before nxtlvl work, read the anchor doc. Relates to [[disable-ecc-active-hooks-dev]] and [[compose-on-native-quality-first]]; the user's domain is [[user-builder-domain]].
