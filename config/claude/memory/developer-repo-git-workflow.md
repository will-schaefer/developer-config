---
name: developer-repo-git-workflow
description: "Git workflow for the nxtlvl harness repo (at ~/Developer/nxtlvl since the 2026-06-27 relocation) — solo, commit directly to main, don't branch for routine work, don't push unless asked. (The 'epitaxy' parallel-committer was retired 2026-06-25 — see note below.)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d04f38f2-2d92-4957-b1c6-f8379cee9434
---

In the nxtlvl harness repo (`~/Developer/nxtlvl` since the 2026-06-27 relocation) the user commits **directly to `main`** (single-author repo; `origin/main` tracked but pushed only when asked). Do **not** branch for routine commits here — that overrides the generic "branch off the default branch first" default.

**Why:** solo personal workbench; history is linear on `main`, and the user expects a bare "commit" to land on `main`.

**How to apply:**
- Commit to `main`; don't branch unless asked; don't push unless asked.
- `.claude/settings.local.json` is tracked but accumulates session-generated permission grants; leave its working-tree changes **uncommitted** unless the user asks to include them.

**"Epitaxy" — RETIRED (2026-06-25).** For a stretch in 2026-06 a parallel actor (codename *epitaxy*) made `WIP: epitaxy pre-switch from <branch>` commits and switched branches under the active session, which spawned a defensive doctrine (verify-by-content, never-amend/rebase/force, safepoint tags). A 2026-06-25 investigation found **no standing mechanism** — no binary, launchd/cron job, git hook, alias, or script; the only `pre-switch` traces live in session transcripts/logs. It was a **transient Claude Code session behavior** confined to 06-18 → 06-19 (3 WIP commits total: `44a2f6c`, `cddceef`, `95a5aaf`), **not a background daemon**, and has been silent since. Treat the repo as ordinary linear-on-main again; the old "epitaxy is active, take defensive measures" doctrine no longer applies. If `WIP: ... pre-switch ...` commits ever reappear, a session is doing it — stop and investigate that session rather than reinstating blanket caution.

Relates to [[terse-confirms-momentum]].
