---
name: nxtlvl-agentic-os-distillation
description: adopt/adapt/reject of the agent-dev:agentic-os skill for nxtlvl; scaffold-vs-plugin is the spine; top adopt = Memory Scope per-agent read-contract.
metadata: 
  node_type: memory
  type: reference
  originSessionId: 093eab67-307b-4094-8177-041388303fdd
---

Harness-review distillation of the `agent-dev:agentic-os` skill (a prescriptive "Claude Code as
persistent OS" architecture) at `docs/reference/agentic-os-distillation.md`. Source is an *installed*
skill, not a vendored repo — re-readable at `plugins/agent-dev/skills/agentic-os/SKILL.md` (388
lines), so the [[nxtlvl-harness-review]]-style clone/fan-out was correctly skipped (single-file =
poor fan-out target); ran a proportionate skim-to-distill.

**Spine (contrast, not feature):** agentic-os is a *per-project scaffold* (`CLAUDE.md` as kernel;
"one project = one Agentic OS") — the architectural opposite of nxtlvl as a *portable cross-project
plugin*. So most of its layers govern project-local state a plugin doesn't own → "right idea, wrong
owner."

**Two doctrine collisions:** (1) "routing lives in markdown tables, not code" vs nxtlvl's
[[meta-skill-discoverability-in-plumbing]] (table-routing degrades past ~5 agents; keep router-as-skill
+ floor-brief wiring) — REJECT as counter-position. (2) session-end prose reflections vs
continuous-learning-v2 instincts — REJECT as replacement, keep only the end-of-session *ritual*.

**Top adopt:** the `Memory Scope` per-agent read-contract (every agent declares which files it reads)
— cheap legibility win, composes with the read-only-by-withheld-tools pattern from
[[nxtlvl-hooks-mastery-distillation]]; the two are the same idea (explicit agent I/O surface) from
read + write sides → record together as a scoping-doctrine amendment (triangulate first per
[[triangulate-three-harnesses-build-decisions]]). **Adapt:** no-migration schema rule (never rename,
add+deprecate) → C&M lifecycle plan; LaunchAgent cron recipe for durable scheduled jobs. Reader-test
passed (citations valid). Mine the doc instead of re-reading the skill.
