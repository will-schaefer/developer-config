---
name: github-workflow
description: nxtlvl GitHub workflow — the standardized branch → commit → PR → review → CI → merge loop for agents. Vendored from agent-skills/ECC `git-workflow` + `github-ops` and refined for fit (Conventional Commits, draft-PR-first, no attribution, pointers-over-dumps). Use when starting work that will land on GitHub, committing, opening or updating a PR, or driving a change to merge. Runs in-context and spawns the `nxtlvl:review` agent at the review stage.
---

# GitHub Workflow (nxtlvl)

Vendored from `git-workflow` + `github-ops` and refined for fit (compose-not-reconstruct, ADR-003); the seed knowledge layer of the `git-workflows` workflow domain — see the plan in `docs/plan/nxtlvl-git-workflows-domain-handoff.md`. **Self-contained** for the everyday loop — it does *not* call the upstream skills. The exhaustive long-tail (GitFlow, mergetool, stash recipes, release tooling) stays a pointer into `reference/ECC-main/skills/git-workflow/SKILL.md`; this skill carries only the path agents actually walk.

One coherent thing — the spine of every change that reaches GitHub:

```
branch → commit → PR (draft) → review → CI → merge
```

**Use when:** beginning work that will land on GitHub; committing; opening, updating, or driving a PR; or taking a working tree to merged. **Don't** use it to reconstruct review (that's `nxtlvl:review`) or to re-decide branching strategy per project (the default below is GitHub Flow; a project's `./CLAUDE.md` may rebind it).

## 1. Branch

- Branch off an up-to-date `main`: `git fetch origin` → `git switch -c <type>/<slug> origin/main`.
- **Never commit directly to `main`.** Name the branch with the same vocabulary as commits: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `perf/` + a short slug (`feat/oauth-login`). Keep branches short-lived; rebase onto `origin/main` rather than letting them age.

## 2. Commit — Conventional Commits

The nxtlvl standard is **Conventional Commits** (chosen over this repo's historical sentence-case):

```
<type>(<scope>): <subject>

<optional body — explain *why*, not *what*>

<optional footer — Closes #123, BREAKING CHANGE: …>
```

| Type | For | Example |
|------|-----|---------|
| `feat` | New capability | `feat(auth): add OAuth2 login` |
| `fix` | Bug fix | `fix(api): handle null user response` |
| `docs` | Docs only | `docs(readme): document setup` |
| `refactor` | No behavior change | `refactor(db): extract pool module` |
| `test` | Tests | `test(auth): cover token expiry` |
| `chore` | Maintenance | `chore(deps): bump eslint` |
| `perf` | Performance | `perf(query): index users.email` |
| `ci` | CI/CD | `ci: add postgres service` |

- Subject: imperative, no trailing period, ≤50 chars. Scope optional, lowercase.
- **No attribution trailers.** Commits are clean — no `Co-Authored-By`, no agent signature (nxtlvl default).
- One logical change per commit; link issues with `Closes #N` in the footer.

## 3. Pull request — draft first

- **Open as a draft** (`--draft`); mark ready only after self-review and CI are green.
- Push the branch with upstream tracking: `git push -u origin <branch>`.
- Build the description from the **whole branch**, not the last commit: read `git diff origin/main...HEAD` and `git log origin/main..HEAD`.
- Title in Conventional-Commit form. Body — keep it skimmable, **pointers over pasted diffs**:

```markdown
## What
One or two lines.

## Why
Motivation / context (link the issue or ADR).

## How
Notable implementation choices worth a reviewer's attention.

## Testing
- [ ] Tests added/updated · [ ] Ran locally · [ ] Manual check
```

- Keep PRs focused and reasonably small (a single feature/fix); large diffs hide regressions.

## 4. Review — compose `nxtlvl:review`

**Don't reconstruct review here.** Spawn the `nxtlvl:review` agent for the five-axis pass (correctness, readability, architecture, security, performance), pulling the **language-appropriate** reviewer for the changed files (Next.js / Python / Rust) rather than one generic pass — isolation lives in that read-only agent, not here. Self-review and resolve findings *before* requesting a human review. Surface any assumption you made about intent or environment so a wrong one is visible.

## 5. CI — investigate, don't just re-run

- On red CI, read the failing job and find the **root cause**; distinguish a flaky test from a real failure. Re-running without diagnosing is not a fix.
- Fix forward on the branch; push updates (no force-push needed for fast-forward additions).

## 6. Merge

- Merge only when CI is green, review is `APPROVE`, and the title is Conventional-Commit clean. If review is non-`APPROVE` or CI is red, **stop and surface it** — don't merge through.
- Prefer **squash** for a linear history; the squash subject stays Conventional-Commit form. Delete the branch after merge.

## Safety

- Respects the `dangerous-bash` gate: force-push to `main` is **blocked**; `git reset --hard` / `git clean -f` warn.
- Never force-push a shared or protected branch. On your **own** feature branch, prefer `git push --force-with-lease` (never bare `--force`) after a rebase.
- Never commit secrets; never add generated artifacts the `.gitignore` should cover.

## nxtlvl conventions

- **Pointers over dumped content** — reference `file:line` and link the PR/issue; don't paste large diffs back.
- **Surface assumptions** — state what you assumed about intent, target branch, or environment.
- **Language-plural** — match the reviewer and the checks to the changed files, not a single generic pass.

## Verification

- [ ] Work is on a `<type>/<slug>` branch off current `origin/main`, never committed to `main`.
- [ ] Every commit is Conventional-Commit form, imperative ≤50-char subject, **no attribution trailer**.
- [ ] PR opened as a draft, pushed with `-u`, described from the full branch diff, title in Conventional form.
- [ ] `nxtlvl:review` ran with the language-appropriate axis; findings resolved before ready-for-review.
- [ ] CI green (failures diagnosed, not just re-run); merged only on `APPROVE`; branch deleted; no force-push to a shared branch.

$ARGUMENTS
