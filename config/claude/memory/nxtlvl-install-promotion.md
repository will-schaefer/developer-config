---
name: nxtlvl-install-promotion
description: "How nxtlvl gets promoted from repo to daily-driver — installed copy is a SHA-pinned cache snapshot, not a live read of the repo."
metadata: 
  node_type: memory
  type: project
  originSessionId: fec6bb5c-ac29-4fc1-8b83-4c5cc07dbc3f
---

The installed `nxtlvl@nxtlvl-dev` is a **cache copy pinned to a git commit SHA** at `~/.claude/plugins/cache/nxtlvl-dev/nxtlvl/<version>/`. The `nxtlvl-dev` marketplace `source` is `directory` → `/Users/willschaefer/Developer/nxtlvl` (the repo, relocated there 2026-06-27), but it is **NOT read live** — committed repo changes do not appear in the running harness until a manual promotion re-pins the install to current `HEAD`.

So **repo HEAD routinely runs ahead of the daily-driver.** Verified 2026-06-17: install pinned to the *initial* commit `f5a7e56` (only the `review` skill) while repo HEAD was 6 commits ahead — all M1+ work (hooks, vendored skills, ADRs) lived in the repo but was never loaded.

**Why:** repo = workbench, installed `~/.claude` = daily driver; per ADR-001 **promotion = install** (git-tag = rollback). The SHA pin is the snapshot boundary — uncommitted working-tree changes are never promoted, only committed state at update time.

**Root cause of the stuck pin (verified 2026-06-17 via claude-code-guide):** `plugin.json` has a **static `"version": "0.0.1"`**. CC keys the cache/update on the version field, so `/plugin update` sees `0.0.1 == 0.0.1` → "already at latest" → **no-op**, even though the commit SHA advanced. A marketplace refresh alone never re-pins. Fix options: (a) **remove the `version` field from plugin.json** → CC falls back to git-SHA versioning, so every commit auto-detects as an update (recommended for this dev-stage workbench; fits ADR-001 git-tag-rollback); or (b) bump the version each promotion; or (c) force-fresh via uninstall + reinstall (ignores version).

**DONE 2026-06-17 (commit 2a5b5e7):** version field removed from plugin.json → versioning is now **git-SHA based**. Consequence: the cache dir is no longer `.../0.0.1/` but keyed by SHA, so verify with a glob.

**How to apply:** in interactive `claude` (agent cannot run `/plugin`): `/plugin marketplace update nxtlvl-dev` → `/plugin update nxtlvl@nxtlvl-dev`. For the first promotion after the version-scheme change (or if update no-ops), use `/plugin uninstall nxtlvl@nxtlvl-dev` + `/plugin install nxtlvl@nxtlvl-dev`. `/reload-plugins` activates in-session — but it's **unavailable in the SDK/non-interactive environment** (confirmed 2026-06-17), so there **restart Claude Code** to load the promoted plugin. Verify: `ls ~/.claude/plugins/cache/nxtlvl-dev/nxtlvl/*/skills/` (cache mirrors the *plugin* dir, so skills/ is at the cache root — confirmed empirically). Relates to [[nxtlvl-harness]] and [[nxtlvl-m0-status]].
