---
name: developer-repo-git-workflow
description: "Git workflow for the ~/Developer workbench repo — historically commit-to-main, but an 'epitaxy' automation now manages feature branches + commits in parallel; verify branch+HEAD by content, never amend/rebase/force while it's active."
metadata:
  node_type: memory
  type: feedback
  originSessionId: d04f38f2-2d92-4957-b1c6-f8379cee9434
---

In the `~/Developer` workbench repo the user commits **directly to `main`** (single-author repo; `origin/main` tracked but pushed only when asked). Do **not** branch for routine commits here — that overrides the generic "branch off the default branch first" default.

**Why:** solo personal workbench; existing history (initial → intent → Phase-0 scaffold) is all linear on `main`, and the user expects a bare "commit" to land on `main`.

**How to apply:**
- Commit to `main`; don't branch unless asked; don't push unless asked.
- **Concurrent commits happen** — during a "commit" turn the user (or tooling) may commit in parallel, so the index/HEAD can shift under you mid-task. **Before `git commit --amend`, re-check `git log` / `git show HEAD`** to confirm HEAD is the commit you mean to reword. (2026-06-17: I amended a stray `.claude/settings.local.json` commit instead of the scaffold commit, then had to `git reset --soft <scaffold> && commit --amend` to repair it.)
- `.claude/settings.local.json` is tracked but accumulates session-generated permission grants; leave its working-tree changes **uncommitted** unless the user asks to include them. (An epitaxy WIP commit may sweep it in anyway — that's epitaxy's doing, not a rule change.)
- **EPITAXY automation (observed 2026-06-18, branch `nxtlvl-context-hooks-and-adr008`):** a background process commits in parallel AND switches branches (`main`↔feature, "epitaxy pre-switch" WIP commits). It can commit *your* working-tree changes under *its own* commit message before your `git commit` runs — yielding a confusing "nothing to commit." **Don't panic and don't redo work:** verify your changes landed by **content** (`git show HEAD:path`, `git diff --stat HEAD -- <paths>` → empty = clean), not by whether your own commit succeeded. **Never amend/rebase/force-push while epitaxy is active** — history is being rewritten under you; surgery risks real loss. The repo is no longer purely linear-on-main; check the current branch first.
- **Protect pushed work from overwrite (safepoint tag):** when you push to `main` while epitaxy may rewrite history, immediately pin an annotated tag at your pushed commit and mirror it to origin — `git tag -a safepoint/main-<date>-<topic> <sha> -m '…'; git push origin refs/tags/safepoint/…`. It's purely additive (doesn't touch `main`, doesn't block epitaxy) but keeps your commits reachable/restorable (`git reset --hard <tag>`) even after a force-push, locally or on origin. (2026-06-19: did this for the C&M refinements push — `safepoint/main-2026-06-19-cm-refinements` → f1ee7a0.) Diverged push? Integrate with a **merge**, never a rebase, and only after confirming the incoming commit's files don't collide with your dirty/untracked paths (`git show --stat <sha>` vs `git status --porcelain`).

Relates to [[terse-confirms-momentum]], [[nxtlvl-context-alert-hook]].
