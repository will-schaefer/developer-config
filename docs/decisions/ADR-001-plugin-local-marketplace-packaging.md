---
id: ADR-001
title: "Package nxtlvl as a Claude Code plugin installed via a local marketplace"
status: Accepted
date: 2026-06-16
---

# ADR-001: Package `nxtlvl` as a Claude Code plugin installed via a local marketplace

## Context
`nxtlvl` needs to be both a workbench I freely break and a stable harness I run daily,
without those two states contaminating each other. The intent requires:
- **Dev/prod separation** — churn must never touch live sessions until I choose to promote.
- **Promotion-as-a-gate** — a single, deliberate action moves proven work into daily use.
- **Cheap rollback** — when a promotion regresses, recovery should be sub-minute.
- **Coexistence with dormant `ecc`** without namespace collision.

The decision is *how to deliver the harness* — the envelope around the actual product
(context assembly, memory, composition, hooks). It is expensive to reverse because every
later artifact (skill names, hook paths, install/iterate loop) is shaped by it.

## Decision
Build `nxtlvl` as a **Claude Code plugin** and install it via a **repo-root local
marketplace**:
- Source of truth: `plugins/nxtlvl/` in this repo (the workbench).
- Marketplace: `.claude-plugin/marketplace.json` (name `nxtlvl-dev`) lists `./plugins/nxtlvl`.
- Install dance: `/plugin marketplace add <repo>` → `/plugin install nxtlvl@nxtlvl-dev`;
  iterate with `/plugin marketplace update nxtlvl-dev`.
- **Promotion = install.** **Rollback = `git checkout <previous tag>` + reinstall**, with
  one **git tag per promotion**.
- **Never hand-edit `~/.claude` to install the plugin** (authoring the global `CLAUDE.md`
  config layer and letting hooks write `~/.claude/nxtlvl/*` are *not* violations — the rule
  targets bypassing the marketplace install of the plugin itself).

The plugin packaging is **table-stakes, not the deliverable**: stand it up once (M0), prove
it installs, then freeze it. Production quality lives in the contents it carries.

## Alternatives Considered

### Hand-edit `~/.claude` directly (no plugin)
- Pros: zero packaging overhead; immediate.
- Cons: no dev/prod boundary; every experiment risks the daily driver; no atomic
  promotion or rollback unit.
- Rejected: loses the core requirement (dev/prod separation) the whole approach exists for.

### Hand-rolled installer / sync script
- Pros: full control over the copy step.
- Cons: reconstructs what the plugin system already does natively — a stated anti-goal
  (see [ADR-003](ADR-003-compose-not-reconstruct.md)); a worse, capped installer.
- Rejected: more code to own for strictly less capability.

### Loose collection of skills/agents without plugin packaging
- Pros: simplest file layout.
- Cons: no namespace isolation from `ecc`/`agent-skills`; no versioning/pinning; no clean
  promotion boundary.
- Rejected: namespace collisions and no rollback unit.

## Consequences
- Components are namespaced `nxtlvl:<skill>` / `nxtlvl:<agent>`, scanning cleanly against
  `ecc:` and `agent-skills:`.
- `/plugin …` install and `/nxtlvl:*` invocation only work from an interactive `claude`
  session — the agent cannot run them, so those steps are **manual gates** in the plan.
- The workbench repo carries all churn; only tagged, proven states reach `~/.claude`.
- A tag-per-promotion gives a precise rollback unit; dormant `ecc`
  ([ADR-002](ADR-002-ecc-dormant-reference-backstop.md)) is the deeper safety net during any
  rollback.
- Verified at M0: manifests parse, `/plugin install nxtlvl@nxtlvl-dev` succeeds,
  `nxtlvl:review` registers and runs.
