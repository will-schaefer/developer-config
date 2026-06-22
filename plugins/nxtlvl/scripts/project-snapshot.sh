#!/usr/bin/env bash
# project-snapshot.sh — deterministic phase-1 signal gatherer for context-scout.
#
# The brainstorming orchestrator runs this in the CWD of the project being
# brainstormed, captures stdout, and inlines it into the context-scout spawn
# under a "## Pre-gathered snapshot" heading. The scout DIGESTS the snapshot
# into pointers; it never relays it wholesale, and never re-derives these
# mechanical signals itself.
#
# Contract (see docs/spec/ideation-project-snapshot.md):
#   - Read-only: never writes the tree. Takes NO free-text argument (zero
#     shell-injection surface by construction). No `eval`.
#   - Fail-open: an accelerator, never a dependency. Each probe degrades
#     INDEPENDENTLY to a "— none —" line so one failure never aborts the rest.
#   - Tree-shape conditional (NOT idea-type — the script can't see the idea, only
#     the tree): a CODE tree gets the full snapshot; a non-code tree that still has
#     content (notes, prose, a git repo of markdown) gets a NEUTRAL snapshot — the
#     same deterministic signals minus the pure-code probes (test harness, code
#     markers) and with domain-neutral labels, so it never narrows context-scout's
#     domain-agnostic mandate; only a truly empty tree emits one line and exits 0.
#   - Honest: prints what it actually found; no partial snapshot dressed up as
#     complete, no lying clean-exit.
#
# DELIBERATELY `set -uo pipefail` and NOT `set -e`: blanket errexit would turn a
# benign non-zero exit (e.g. a grep that matched nothing) into a whole-script
# abort — the opposite of fail-open. Do not "fix" this to `-e`.
set -uo pipefail

TOP_N=10        # length of largest-files / top-TODO-files lists
COMMIT_DEPTH=15 # how many recent commits to surface

# Vendored / generated dirs that are noise for a project snapshot. `reference/`
# is nxtlvl's vendored-harness tree (hundreds of MB, tracked) — same class as
# vendor/ and node_modules/: excluded for relevance AND to keep the walk cheap.
EXCLUDE_RE='^(reference|vendor|node_modules|dist|build|\.next|target|\.venv|\.git)/'

# --- small helpers -----------------------------------------------------------

section() { printf '\n## %s\n' "$1"; }
none()    { printf -- '— none —\n'; }

is_git_repo() { git rev-parse --is-inside-work-tree >/dev/null 2>&1; }

# Single source of the file list. Git-index-first (fast, respects .gitignore,
# excludes vendored dirs via pathspec); raw find is the non-git fallback, which
# prunes the same noise dirs so it never descends a vendored clone.
list_files() {
  if is_git_repo; then
    git ls-files 2>/dev/null | grep -vE "$EXCLUDE_RE"
  else
    find . \( -name .git -o -name reference -o -name vendor -o -name node_modules \
            -o -name dist -o -name build -o -name .next -o -name target -o -name .venv \) -prune -o \
            -type f -print 2>/dev/null | sed 's|^\./||'
  fi
}

# A "code repo" is a git work tree OR a dir with recognizable source files.
# Pure-notes / empty dirs are not — they get the one-line non-code path.
has_source() {
  find . \( -name .git -o -name reference -o -name vendor -o -name node_modules \) -prune -o -type f \
      \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \
       -o -name '*.py' -o -name '*.rs' -o -name '*.go' -o -name '*.rb' \
       -o -name '*.java' -o -name '*.kt' -o -name '*.c' -o -name '*.cc' \
       -o -name '*.cpp' -o -name '*.h' -o -name '*.swift' -o -name '*.sh' \) \
      -print 2>/dev/null | head -1 | grep -q .
}

# Any content at all — a tracked file (git) or a regular file (non-git). This is
# what separates a notes/prose tree (→ NEUTRAL snapshot) from a truly empty dir
# (→ the one-line bail). Reuses list_files so the same exclude/prune rules apply.
has_content() {
  list_files | head -1 | grep -q .
}

# --- probes (each degrades independently) ------------------------------------

repo_identity() {
  section "Repo identity"
  if ! is_git_repo; then none; return; fi
  local branch porcelain dirty untracked
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '(unknown)')
  # One working-tree scan, reused for both dirty-state and untracked count
  # (`git status` is the script's single most expensive call on a large repo).
  porcelain=$(git status --porcelain 2>/dev/null)
  if [ -n "$porcelain" ]; then dirty="dirty"; else dirty="clean"; fi
  untracked=$(printf '%s\n' "$porcelain" | grep -c '^??')
  printf -- '- branch: %s (%s)\n' "$branch" "$dirty"
  printf -- '- untracked files: %s\n' "${untracked:-0}"
  if git rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1; then
    local lr ahead behind
    lr=$(git rev-list --left-right --count '@{upstream}...HEAD' 2>/dev/null)
    behind=$(printf '%s' "$lr" | awk '{print $1}')
    ahead=$(printf '%s' "$lr" | awk '{print $2}')
    printf -- '- vs upstream: %s ahead, %s behind\n' "${ahead:-0}" "${behind:-0}"
  else
    printf -- '- vs upstream: (no upstream tracking branch)\n'
  fi
}

recent_activity() {
  section "Recent commits (last $COMMIT_DEPTH)"
  if ! is_git_repo; then none; return; fi
  local log stat
  log=$(git log --oneline -"$COMMIT_DEPTH" 2>/dev/null)
  if [ -n "$log" ]; then printf '%s\n' "$log"; else none; fi
  section "Working-tree diff --stat"
  stat=$(git diff --stat 2>/dev/null)
  if [ -n "$stat" ]; then printf '%s\n' "$stat"; else printf -- '— clean working tree —\n'; fi
}

docs_inventory() {
  section "Docs inventory — docs/spec/ + docs/decisions/"
  local found=0 d f title
  for d in docs/spec docs/decisions; do
    [ -d "$d" ] || continue
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      found=1
      title=$(grep -m1 '^# ' "$f" 2>/dev/null | sed 's/^# //')
      printf -- '- %s — %s\n' "$f" "${title:-(no H1 title)}"
    done <<EOF
$(find "$d" -maxdepth 1 -type f -name '*.md' 2>/dev/null | sort)
EOF
  done
  [ "$found" -eq 1 ] || none
}

largest_files() {
  # noun defaults to "source files" so a no-arg call (code mode) is byte-identical
  # to before; the neutral branch passes "files" so prose isn't mislabeled "source".
  local noun="${1:-source files}"
  section "Largest ${noun} (by lines, top $TOP_N)"
  local files list
  # Drop lockfiles, sourcemaps, minified bundles, and common binaries by
  # extension (cheap) instead of a per-file binary probe (684 sandboxed
  # subprocess spawns on this repo — the original bottleneck).
  files=$(list_files | grep -vE \
    '\.(lock|map|png|jpe?g|gif|ico|svg|pdf|zip|gz|tgz|woff2?|ttf|eot|mp4|mov|wasm|jar)$|\.min\.(js|css)$|(^|/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock)$')
  if [ -z "$files" ]; then none; return; fi
  # One batched `xargs wc -l` over the whole list (NUL-delimited = safe for
  # paths with spaces); awk drops xargs's per-batch "total" lines.
  list=$(printf '%s\n' "$files" | tr '\n' '\0' | xargs -0 wc -l 2>/dev/null \
    | awk '$2 != "total"' | sort -rn | head -"$TOP_N")
  if [ -n "$list" ]; then
    printf '%s\n' "$list" | while read -r n f; do
      printf -- '- %s lines — %s\n' "$n" "$f"
    done
  else
    none
  fi
}

todo_markers() {
  section "TODO / FIXME / HACK markers"
  local matches total
  if is_git_repo; then
    matches=$(git grep -nIE 'TODO|FIXME|HACK' -- . ':(exclude)reference' ':(exclude)vendor' ':(exclude)node_modules' 2>/dev/null)
  else
    matches=$(grep -rnIE 'TODO|FIXME|HACK' . \
      --exclude-dir=.git --exclude-dir=reference --exclude-dir=vendor \
      --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build 2>/dev/null)
  fi
  if [ -z "$matches" ]; then none; return; fi
  total=$(printf '%s\n' "$matches" | grep -c .)
  printf -- '- total markers: %s\n' "$total"
  printf -- '- top files:\n'
  printf '%s\n' "$matches" | cut -d: -f1 | sort | uniq -c | sort -rn | head -"$TOP_N" \
    | while read -r c f; do printf -- '  - %s — %s\n' "$c" "$f"; done
}

adr_next() {
  section "Next collision-safe ADR number"
  # Scan ADR files across the committed HEAD tree + every locally-known
  # remote-tracking ref (refs/remotes/*, i.e. the last fetch) + the working
  # tree. All LOCAL — deliberately NOT a live `git ls-remote`, which adds a
  # ~30s network-timeout hang under a sandbox and never authenticates there
  # anyway. Last-fetched remote state is plenty to dodge a numbering collision.
  local scope max remote_refs r
  remote_refs=$(git for-each-ref --format='%(refname)' refs/remotes 2>/dev/null)
  if [ -n "$remote_refs" ]; then
    scope="committed+remote-tracking+working"
  else
    scope="committed+working (no remote-tracking refs)"
  fi
  # Scope every tree read to docs/decisions/ via pathspec — listing the whole
  # tree just to grep ADR numbers cost ~7s on this repo; scoped is ~0.2s.
  max=$( { git ls-tree -r --name-only HEAD -- docs/decisions 2>/dev/null
           for r in $remote_refs; do git ls-tree -r --name-only "$r" -- docs/decisions 2>/dev/null; done
           ls docs/decisions/ 2>/dev/null
         } | grep -oE 'ADR-[0-9]{3}' | grep -oE '[0-9]{3}' | sort -n | tail -1 )
  printf -- '- next: ADR-%03d (computed over %s)\n' "$(( 10#${max:-000} + 1 ))" "$scope"
}

language_shape() {
  # noun + heading default to the code-mode wording so a no-arg call is
  # byte-identical; the neutral branch passes domain-neutral labels.
  local noun="${1:-source files}" heading="${2:-Language / size shape}"
  section "$heading"
  local files count
  files=$(list_files)
  if [ -z "$files" ]; then none; return; fi
  count=$(printf '%s\n' "$files" | grep -c .)
  printf -- '- %s (excl. vendored): %s\n' "$noun" "$count"
  printf -- '- top dirs:\n'
  printf '%s\n' "$files" | grep '/' | sed 's|/.*||' | sort | uniq -c | sort -rn | head -5 \
    | while read -r c d; do printf -- '  - %s (%s files)\n' "$d" "$c"; done
  printf -- '- primary extensions:\n'
  printf '%s\n' "$files" | grep -oE '\.[A-Za-z0-9]+$' | sort | uniq -c | sort -rn | head -8 \
    | while read -r c e; do printf -- '  - %s (%s)\n' "$e" "$c"; done
}

test_harness() {
  section "Test-harness presence"
  local found=0 example
  if [ -f package.json ] && grep -q '"test"' package.json 2>/dev/null; then
    printf -- '- package.json has a test script\n'; found=1
  fi
  if ls pytest.ini tox.ini conftest.py >/dev/null 2>&1; then
    printf -- '- pytest config present\n'; found=1
  fi
  if [ -d tests ] || [ -d test ]; then
    printf -- '- tests/ or test/ directory present\n'; found=1
  fi
  example=$(list_files | grep -iE '(\.test\.|\.spec\.|_test\.(go|py|rs|js)|test_[^/]*\.py)' | head -1)
  if [ -n "$example" ]; then
    printf -- '- test files present (e.g. %s)\n' "$example"; found=1
  fi
  [ "$found" -eq 1 ] || printf -- '- none detected\n'
}

# --- main --------------------------------------------------------------------

# A second subtitle line (when given) tells the scout this is a neutral snapshot
# of a non-code tree, so it knows the code-only probes were omitted by design.
header() {
  printf '# Project snapshot — deterministic phase-1 signals\n'
  printf '_Raw signal for context-scout to digest (not relay); generated by project-snapshot.sh._\n'
  [ -n "${1:-}" ] && printf '_%s_\n' "$1"
}

main() {
  if has_source; then
    # CODE tree — full snapshot. Byte-identical to the original (no-arg probes).
    header
    repo_identity
    recent_activity
    docs_inventory
    largest_files
    todo_markers
    adr_next
    language_shape
    test_harness
  elif has_content; then
    # NON-CODE tree with content (notes, prose, a git repo of markdown) — neutral
    # snapshot: the same deterministic signals minus the pure-code probes
    # (test harness, TODO/FIXME/HACK markers), with domain-neutral labels.
    header "Non-code tree: neutral snapshot — code-only probes (test harness, code markers) omitted by design."
    repo_identity
    recent_activity
    docs_inventory
    largest_files "files"
    language_shape "files" "File types & size shape"
    # The next-ADR number is only meaningful where the house ADR convention
    # already lives; emitting "ADR-001" for a tree with no decisions is noise.
    [ -d docs/decisions ] && adr_next
  else
    # Truly empty / contentless tree — nothing to snapshot. Honest, exit 0.
    printf 'empty tree — nothing to snapshot\n'
    exit 0
  fi
}

main "$@"
