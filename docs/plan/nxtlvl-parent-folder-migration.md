# Migration runbook: `~/Developer` → parent folder, repo at `~/Developer/nxtlvl/`

> **Status: planned, execution deferred** until the in-flight work is pushed (user's call).
> Reframes `~/Developer` from *being* the git repo into a plain **parent workspace folder**
> that holds the harness repo at `~/Developer/nxtlvl/` plus sibling repos (`llm-wiki/`).
> This amends the "local dir stays `~/Developer`" clause of
> [ADR-036](../decisions/ADR-036-repo-identity-nxtlvl-harness-only.md) — see the superseding ADR.

## Why this is delicate
`~/.claude/*` symlinks point **into** `~/Developer/config/claude/*`, and the project-memory +
plugin-marketplace registration key off the absolute path `~/Developer`. Moving the repo down a
level breaks all three unless re-pointed. This runbook re-points them.

## Decisions (locked)
- Child repo dir name: **`nxtlvl`** → `~/Developer/nxtlvl/`.
- **Move the whole repo as one unit** (plugin + workbench together); preserves all git history
  and working-tree state. No split.
- **`llm-wiki/`** (already its own repo) **stays** as `~/Developer/llm-wiki/` sibling — it just
  stops being accidentally nested.
- **Delete during move:** `projects/` (empty), `.smart-env/` (204M, regenerable index),
  `cm-phase0-workspace/`, `harness-review-workspace/`, `ai-engineering-from-scratch/`, `.DS_Store`.
- **Keep + move with repo:** all tracked content, `.git`, `node_modules/`, `.envrc`, `.grok/`,
  `.superpowers/`.

---

## Phase 0 — precondition (do first)
```sh
cd ~/Developer
git push origin main          # get the 9 commits onto the renamed remote (safety net)
git status                    # decide what to do with remaining uncommitted in-flight work
```
The move preserves a dirty tree, so uncommitted work survives — but pushing first means the
remote has a recoverable copy before any relocation.

## Phase 1 — relocate the repo into `~/Developer/nxtlvl/`
Run in **zsh** (the login shell). Uses an external temp to avoid moving a dir into its own child.
```sh
cd ~/Developer
rm -rf projects .smart-env cm-phase0-workspace harness-review-workspace ai-engineering-from-scratch .DS_Store

mkdir -p ~/.nxtlvl-relocate
setopt local_options dotglob          # include dotfiles in the glob
for e in ~/Developer/*; do
  [[ "${e:t}" == "llm-wiki" ]] && continue   # keep llm-wiki as a sibling
  mv -- "$e" ~/.nxtlvl-relocate/
done

mv ~/.nxtlvl-relocate ~/Developer/nxtlvl
ls -A ~/Developer                     # expect: nxtlvl  llm-wiki
git -C ~/Developer/nxtlvl status      # repo intact, working tree preserved
```

## Phase 2 — re-point the `~/.claude` symlink chain + memory
`link.sh` resolves its dest relative to its own location, so re-running it from the new path fixes
the file/dir symlinks. The **memory** line needs its project slug updated first (old slug
`-Users-willschaefer-Developer` → new canonical cwd slug `-Users-willschaefer-Developer-nxtlvl`).
```sh
# edit config/claude/link.sh: update the memory line + mkdir the new project dir
#   OLD: ln -sfn "$DEST/memory" "$CLAUDE/projects/-Users-willschaefer-Developer/memory"
#   NEW: mkdir -p "$CLAUDE/projects/-Users-willschaefer-Developer-nxtlvl"
#        ln -sfn "$DEST/memory" "$CLAUDE/projects/-Users-willschaefer-Developer-nxtlvl/memory"

bash ~/Developer/nxtlvl/config/claude/link.sh    # recreate all ~/.claude symlinks at new path
rm -f ~/.claude/projects/-Users-willschaefer-Developer/memory   # remove now-dangling old symlink
```
Memory **content** is preserved (it lives in `config/claude/memory/`, which moved with the repo).
Old transcripts under the old slug stay; new sessions key to the new slug.

## Phase 3 — fix the absolute-path references
```sh
NEW=/Users/willschaefer/Developer/nxtlvl
# 1. tracked source-of-truth: nxtlvl-dev marketplace path (config/claude/settings.json:44)
#    "/Users/willschaefer/Developer" -> "$NEW"
# 2. plugin runtime registration (re-point marketplace + installed sandbox source)
sed -i '' 's#/Users/willschaefer/Developer/sandbox#'"$NEW"'/sandbox#g; s#/Users/willschaefer/Developer"#'"$NEW"'"#g' \
  ~/.claude/plugins/known_marketplaces.json ~/.claude/plugins/installed_plugins.json
# 3. direnv re-allow at the new location
direnv allow ~/Developer/nxtlvl
```
Opportunistic (non-breaking): update the comment in `plugins/nxtlvl/lib/scrub.test.js:12`, and the
path mentions in `config/claude/memory/{claude-config-repo,developer-repo-git-workflow,nxtlvl-install-promotion}.md`
and any `docs/` references, to `~/Developer/nxtlvl`.

## Phase 3.5 — migrate the C&M project store (THE easily-missed step)
> Added 2026-06-27 after the move silently forked the store. **This was not in the original
> runbook** and cost a full session of re-learning before it was caught.

The Context & Memory subsystem keys every project's store on the **absolute path of the repo's
git-common-dir**: `projectId = sha256(realpath(git-common-dir))[:16]` (`plugins/nxtlvl/lib/project-identity.js`),
and the store lives at `${XDG_STATE_HOME:-~/.local/state}/nxtlvl/projects/<projectId>/`
(`lib/paths.ts`). Relocating the repo changes `realpath(.git)`, so the key changes — and the hooks
**silently start a fresh, empty store** under the new key while all accumulated instincts,
bookmarks, observations, and metrics strand under the old key. Nothing errors; the learning just
goes cold.

Migrate the durable data old→new (the old store is only read from):
```sh
OLD=$(node -e 'console.log(require("crypto").createHash("sha256").update("/Users/willschaefer/Developer/.git").digest("hex").slice(0,16))')
NEW=$(node -e 'console.log(require("crypto").createHash("sha256").update("/Users/willschaefer/Developer/nxtlvl/.git").digest("hex").slice(0,16))')
S=~/.local/state/nxtlvl/projects
tar -cf ~/cm-store-backup.tar -C "$S" "$NEW"                      # back up the new (live) store first
# instincts: copy + REWRITE project_id (else future reinforcements misroute back to the old store)
for f in "$S/$OLD"/instincts/*.md; do b=$(basename "$f"); [ -e "$S/$NEW/instincts/$b" ] || \
  sed "s/^project_id: $OLD\$/project_id: $NEW/" "$f" > "$S/$NEW/instincts/$b"; done
cp -n "$S/$OLD"/bookmarks/*.jsonl "$S/$NEW"/bookmarks/ 2>/dev/null  # session continuity
# observations/obs-seq/obs-cursor: leave them — already distilled; merging races the live observer
```
Global instincts (`…/nxtlvl/instincts/`, not project-keyed) survive the move untouched.
**This same fork happens on any future relocation OR fresh clone to a new path** — re-run this step.

## Phase 4 — verification checklist
```sh
git -C ~/Developer/nxtlvl rev-parse --show-toplevel   # = ~/Developer/nxtlvl
git -C ~/Developer/nxtlvl log --oneline -1            # restructure commit present
git -C ~/Developer/nxtlvl remote get-url origin       # nxtlvl-harness.git
readlink ~/.claude/rules                              # -> ~/Developer/nxtlvl/config/claude/rules
readlink ~/.claude/projects/-Users-willschaefer-Developer-nxtlvl/memory  # -> .../nxtlvl/config/claude/memory
grep Developer ~/.claude/plugins/known_marketplaces.json   # path now ends /Developer/nxtlvl
find ~/.claude -maxdepth 2 -type l ! -exec test -e {} \; -print   # broken symlinks (expect none)
ls ~/Developer/llm-wiki/.git >/dev/null && echo "llm-wiki sibling intact"
NEW=$(node -e 'console.log(require("crypto").createHash("sha256").update("/Users/willschaefer/Developer/nxtlvl/.git").digest("hex").slice(0,16))')
ls ~/.local/state/nxtlvl/projects/$NEW/instincts | wc -l   # C&M store migrated (expect the full count, not ~3)
```
Then restart Claude Code from `~/Developer/nxtlvl` and confirm the nxtlvl plugin + skills load and
memory/briefing resolve.

## Rollback
The move is a relocation, not a history rewrite. To revert: `mv ~/Developer/nxtlvl/* ~/Developer/`
(with dotglob), restore the old `link.sh` memory slug, re-run it, and revert the Phase-3 sed.

## Post-move follow-ups
- Update the three memory files above to describe the new path as reality.
- Flip the superseding ADR's `implementation:` note to done.
