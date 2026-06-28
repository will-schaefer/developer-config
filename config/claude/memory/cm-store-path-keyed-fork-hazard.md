---
name: cm-store-path-keyed-fork-hazard
description: "nxtlvl C&M store is keyed on sha256(realpath(.git)) → any repo relocation OR fresh clone to a new path silently forks the store (empty new store, stranded learning); must migrate instincts (rewriting project_id) + bookmarks."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2398439d-8286-4432-8d60-983b60337d76
---

The C&M store keys every project on the **absolute path of the repo's git-common-dir**:
`projectId = sha256(realpath(git-common-dir))[:16]` (`plugins/nxtlvl/lib/project-identity.js`),
store at `${XDG_STATE_HOME:-~/.local/state}/nxtlvl/projects/<projectId>/` (`lib/paths.ts`).

**Hazard:** relocating the repo (the 2026-06-27 move `~/Developer` → `~/Developer/nxtlvl`) — or cloning to a
new path — changes `realpath(.git)`, so the key changes and the hooks **silently start a fresh,
empty store** under the new key. No error fires; accumulated instincts/bookmarks/observations/
metrics strand under the old key and the learning goes cold. Confirmed live 2026-06-27: old key
`24c59a845f421f40` (217 instincts, 51 bookmarks, 4627 obs) vs new `e8fb852a554b121b` (~3 instincts).

**Fix / repeat on any future move or new-path clone** (old store is read-only in this; keep it as
backup): copy instinct `.md` files old→new **rewriting the `project_id:` frontmatter line** (else
`writeInstinct` routes future reinforcements back to the old store — `lib/instincts.js:234`); copy
`bookmarks/*.jsonl`; **skip** observations/obs-seq/obs-cursor (already distilled; merging races the
live observer). Global instincts (`…/nxtlvl/instincts/`, not project-keyed) survive untouched.
`list()` reads by directory, not by frontmatter project_id, so reads work pre-rewrite — but
reinforcement writes don't. Runbook step: `docs/plan/nxtlvl-parent-folder-migration.md` Phase 3.5.

Relates to [[nxtlvl-context-memory-subsystem]], [[nxtlvl-install-promotion]],
[[developer-repo-git-workflow]].
