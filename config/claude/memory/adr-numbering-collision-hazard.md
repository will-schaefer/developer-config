---
name: adr-numbering-collision-hazard
description: ADR numbers in the nxtlvl repo collide because doc-keeper assigns the next number by globbing the working tree; verify against the committed tree first.
metadata: 
  node_type: memory
  type: project
  originSessionId: df828bd5-a951-4ac3-ae68-2548ff614ec1
---

When doc-keeper (or anyone) creates a new ADR in `docs/decisions/`, it picks the next number by scanning the working-tree files. This silently collides when a rebase, a stashed change, or a parallel branch has already claimed that number in the committed history but not in the current working view. This actually happened: a stash-pop left two ADR-013 files committed (confident-core + floor-on-demand) and doc-keeper then assigned ADR-014 on top of an already-committed ADR-014 (quality-first). Resolved 2026-06-19 by renumbering confident-core → ADR-016 and the session's load-rule ADR → ADR-015.

**Why:** the next-free-number check reads working-tree state, which diverges from committed/remote state during in-progress merges, stashes, or concurrent branches.

**How to apply:** before finalizing any new ADR number, check the committed tree, not just disk — e.g. `git ls-tree --name-only HEAD docs/decisions/ | grep -oE 'ADR-[0-9]+' | sort | uniq -d` to catch dups, and confirm the chosen number isn't already on origin/main. Also: before `git push`, verify the *committed* blobs are marker-free (`git show HEAD:<file> | grep -nE '^(<<<<<<<|=======|>>>>>>>)'`) — a `git commit --amend` will happily commit conflict markers. Relates to [[adrs-advisory-not-canonical]].
