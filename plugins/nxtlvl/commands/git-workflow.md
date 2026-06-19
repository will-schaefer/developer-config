---
description: Drive the current change through the nxtlvl GitHub loop — branch → commit → PR → review → CI → merge. Delegates to the git-workflow-runner agent, which composes nxtlvl:review.
argument-hint: "[what to ship, or a commit/PR focus] (optional)"
---

# /git-workflow

Thin entry to nxtlvl's standardized GitHub loop. This command **delegates** — it spawns the
**`git-workflow-runner`** agent to run the loop in an isolated context and reports back its verdict.
The durable conventions live in the **`github-workflow`** skill; this command does not restate them.

## What it does

1. **Detect context** — current branch, dirty/staged state, whether a PR already exists for the branch.
2. **Spawn `git-workflow-runner`**, passing the `github-workflow` skill's conventions into its prompt
   (subagents don't auto-load skills). The agent walks: branch → commit → PR (draft) → review → CI → merge.
3. **At the review step** the agent composes **`nxtlvl:review`** (language-appropriate, five-axis) —
   review is never reconstructed here.
4. **Present the verdict** — the agent returns a tight status; surface it. The agent has no `Write`/`Edit`,
   so any **code fix it surfaces is applied on the main thread**, not by the agent.

## When to use

- Starting work that will land on GitHub, or taking a working tree to a reviewed, mergeable PR.
- Committing in Conventional-Commit form, opening or updating a draft PR, or driving a change to merge.

Not for: reconstructing review (that's `nxtlvl:review`), or re-deciding branching strategy per project
(the skill's default is GitHub Flow; a project's `./CLAUDE.md` may rebind it).

## Result (what the agent reports back)

| Status | Meaning |
|--------|---------|
| **success** | The change moved through the loop cleanly; branch/PR named, review `APPROVE` where run. |
| **needs-input** | Held — review non-`APPROVE`, CI red, ambiguous target, or a code fix is owed to the caller. |
| **blocked** | Refused — would commit to `main`, force-push a shared branch, or commit a secret. |

$ARGUMENTS
