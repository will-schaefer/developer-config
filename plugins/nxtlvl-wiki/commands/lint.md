---
description: Health-check the wiki (deterministic + best-effort checks)
---

Audit `wiki/` and `raw/` against `CLAUDE.md`. Report findings grouped by check; do **not**
auto-fix unless the user asks.

**Deterministic checks (be exhaustive):** Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/lint.py"` first — it covers
checks 1–3 below (plus the frontmatter floor) as code, so you don't read the whole wiki into
context to do them by hand, and a regex won't skim past a broken citation. Add `--changed
<gitref>` to scope it to recently-touched pages. Then layer the judgment-only checks (4, 5,
7, 8) on top; check 6 is its own script.
1. **Broken `[[wikilinks]]`** — links whose target page/file does not exist. Intentional
   research-lead links (to not-yet-existing pages) are **not** broken — route them to the
   content-gap list (check 5) instead.
2. **Orphan pages** — wiki pages that no other page links to.
3. **Citation integrity** — every `[^n]` resolves to a real `raw/` note or permalink; and
   every `raw/` note cited in a footnote also appears in that page's `sources:` frontmatter
   (both directions, per the reconciliation rule in `CLAUDE.md`).
4. **Stale repo SHAs (cheap, local heuristic)** — flag any pinned SHA whose capture date is
   older than **6 months**, or whose cited file path no longer exists, for **manual**
   re-ingest. Do NOT diff against GitHub HEAD — `/lint` stays a local check.
5. **Content gaps (scope-filtered)** — collect unresolved `[[links]]` into a ranked
   "research next" list. **EXCLUDE** any link into archived / off-scope topics so the gap
   list never resurfaces the non-goals (Claude Design, M365, Excel).
6. **Repo manifest health** — run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/check_repo_manifest.py"`. It validates
   `repos.jsonl` (valid JSON, required fields, known `status`/`category`, unique `id`,
   `id`↔URL match, status↔date consistency) and that `master-repo-list.md` is in sync with a
   fresh render. Non-zero exit = report its findings. If only the view is stale, the fix is
   `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/render_repo_list.py"` (never hand-edit the generated view).

**Best-effort checks (LLM judgment — flag as non-exhaustive):**
7. **Uncited substantive claims** — sentences asserting a fact with no `[^n]`.
8. **Contradictions** — claims across pages that conflict.

End with a one-line summary: a count per check.
