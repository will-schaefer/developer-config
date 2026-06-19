---
name: agent-skills-vs-superpowers-domain-map
description: "Comparative domain map of the agent-skills and superpowers plugins — unique vs overlapping skills + quality verdicts; mine instead of re-scanning."
metadata:
  node_type: memory
  type: reference
  originSessionId: 376ddea6-7bab-4576-bf14-6d5ff8e9260d
---

Full comparative map at `docs/reference/agent-skills-vs-superpowers-domain-map.md` (written 2026-06-19 from a two-phase parallel-subagent scan of all 38 skills; agent-skills v1.0.0 / 24 skills, superpowers v6.0.3 / 14 skills).

Thesis: **agent-skills = horizontal SDLC library** (one broad skill per engineering discipline — API, security, perf, observability, frontend, CI/CD, docs, migration), **superpowers = vertical agent-orchestration spine** (subagent dispatch, worktrees, branch-finishing, plan execution, skill-authoring). ~9 workflows overlap; the rest is each plugin's unique territory, so they are **complementary, adopt-both**. Recurring quality pattern on overlaps: **agent-skills wins completeness/content depth; superpowers wins enforcement + battle-testing** → default merge is "agent-skills brain + superpowers enforcement spine." Doc has the 9 per-workflow verdicts + adopt/adapt/reject backlog + agent-skills' dangling-`references/` defects.

One of the three reference harnesses to triangulate per [[triangulate-three-harnesses-build-decisions]]; companion to [[ecc-component-map]]. Extends [[nxtlvl-harness]].
