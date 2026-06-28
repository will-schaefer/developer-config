---
description: Ingest an open-source harness repo (orient → verify → cite)
argument-hint: <github-url>
---

Ingest the GitHub repo: $ARGUMENTS

The **orient → verify → cite** firewall is mandatory: a DeepWiki summary must never become
an uncited "fact." Refuse if the repo is off-scope (non-agent-harness).

1. **Orient (DeepWiki).** Query DeepWiki for the repo's structure and ask targeted questions
   to locate the interesting harness mechanics. Treat everything DeepWiki returns as
   **leads, not citations.**

2. **Verify (real source).** Resolve the repo's current commit **SHA**. Fetch the actual
   files DeepWiki pointed at, **at that pinned SHA**, and read them. Only what you read here
   may be cited.

3. **Capture.** Write an immutable `raw/<cluster>/<YYYY-MM-DD>-<repo>-reading.md`: URL,
   pinned SHA, the list of files actually read, and the distilled findings. **No vendored code** — describe and cite, do not paste source files.

4. **Compile.** Synthesize into `wiki/<cluster>/` pages with **two citation lanes** that the
   reconciliation rule ties together:
   - **Code claims → SHA-pinned permalinks** `owner/repo@<SHA>/path#Lx-Ly`, in footnotes
     **only** — they have no `raw/` node, so they never appear in `sources:`.
   - **Orientation/synthesis claims → the reading note.** A repo page's framing, distilled
     takeaways, and inventory facts come from the step-3 reading note, not from any single
     line of code, so they carry a `[^n]` citing `[[raw/<cluster>/<…>-reading]]`. That note
     is the page's `sources:` entry — and since `sources:` must equal the union of
     raw-targeting footnotes, **every page that lists the reading note in `sources:` must
     cite it at least once.** A page whose every claim is a permalink and that never cites its
     reading note fails the citation-reconciliation gate: give its orientation claim the
     `[^n]` it's owed (don't drop the reading note from `sources:` — the page genuinely
     derives from it).

   Append a `log.md` entry.

5. **Lint + commit (always, in this order).**
   - **Lint gate (mandatory).** Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/lint.py" --changed HEAD` — it
     deterministically checks the pages this ingest touched (wikilink resolution, orphans,
     citation reconciliation both directions, frontmatter floor) and exits non-zero on a HARD
     break. **Fix any HARD failure before committing** — for repo pages the usual culprit is a
     reading note in `sources:` that no footnote cites (see step 4). Unresolved research-lead
     links and orphans are WARN, not failures.
   - **Commit (always).** Once lint is clean, stage the ingest's files and commit directly to
     the working branch (the repo convention is one commit per ingest). Use a Conventional
     Commit (`feat: ingest <repo> …`) summarizing pages touched and any flagged caveats. Do
     **not** ask first — invoking `/ingest-repo` is the authorization.
