---
description: Ingest an article/paper/post (or a harvested raw note) into the wiki
argument-hint: <url-or-path>
---

Ingest the source at: $ARGUMENTS

Follow the schema in `CLAUDE.md` exactly. If the source is off-scope (Claude Design, M365,
Excel, or any non-agent topic), refuse and say why — do not ingest.

1. **Source → `raw/`.**
   - **URL or not-yet-captured file:** fetch and extract the source text. Write an immutable
     note `raw/<cluster>/<YYYY-MM-DD>-<slug>.md` with provenance frontmatter
     (`title`, `type: source-note`, source URL, author, published date, `created` collected
     date, `tags`, cluster). If a URL cannot be fetched cleanly (paywall, JS-only, PDF, dead
     link): **STOP**, tell the user, and ask them to paste the text into `inbox/`. **Never invent source text.**
   - **Path that is already a `raw/` note** (e.g. a harvested `archive/agents-wiki`
     capture): **do NOT re-extract** — that note IS the immutable source. Re-file/copy it
     into the correct `raw/<cluster>/`, reconciling its frontmatter to the current floor,
     then continue.

2. **Compile into the wiki.** Identify the concepts and entities the source touches. For
   each, create or update a page under `wiki/<cluster>/` conforming to the frontmatter
   floor. Add `[[wikilinks]]` between related pages (links to not-yet-existing pages are
   encouraged — they are research leads). Attach `[^n]` citations on **every substantive
   claim** back to the raw note, and keep `sources:` equal to the union of raw-targeting
   footnotes. Typically 5–15 pages touched.

3. **Finalize: log → lint → commit (one close-out on a single changeset).**
   Treat these three as one closing action, not three optional follow-ups. The reason they're
   fused: by the time the pages are compiled you've done the interesting work, and a standalone
   "remember to log" step is exactly the kind of bookkeeping that gets dropped. Coupling the
   log line into the same commit makes "did I log it?" answerable by looking at what you're
   about to commit.
   - **Log.** Append one line to `log.md`:
     `YYYY-MM-DD — /ingest <source> — <N> pages touched`. This is the wiki's running ledger —
     gap-analysis and `/ingest-next` read it to see what's already been folded in, so an
     unlogged ingest is invisible to everything downstream.
   - **Lint gate (mandatory).** Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/lint.py" --changed HEAD`. It
     deterministically checks just the pages this ingest touched — wikilink resolution,
     orphans, citation reconciliation (`sources:` ↔ footnotes, both directions), and the
     frontmatter floor — and exits non-zero on a HARD break (a floor or reconciliation
     violation). **Fix any HARD failure before committing.** Unresolved `[[links]]` and
     orphans are reported as WARN, not failures: links to not-yet-written pages are
     intentional research leads. Prefer the script to reading the wiki by hand — it's the
     deterministic core of `/lint`, so it's both cheaper (no whole-wiki read into context)
     and stricter (a regex won't skim past a broken citation). Reserve the LLM `/lint` for
     the judgment-only checks (stale-SHA heuristics, uncited-claim/contradiction sweeps) when
     you want them.
   - **Commit (always).** Once lint is clean, stage the ingest's files and commit directly to
     the working branch (the repo convention is one commit per ingest). Before you commit,
     glance at the staged set: it should hold the raw note, the wiki pages, **and** the
     `log.md` line — if `log.md` isn't in there, you skipped the ledger, so add it before
     committing. Use a Conventional Commit (`feat: ingest <source> …`) summarizing pages
     touched. Do **not** ask first — invoking `/ingest` is the authorization.
