---
description: Answer a question from the wiki — cited prose answer + see-also pointers (read-only)
argument-hint: <question>
---

Answer the user's question **from this wiki**, in the wiki's own voice: a cited prose answer
plus a "See also" pointer list. **Read-only** — never write, commit, or trigger a graph
rebuild. The live markdown in `wiki/` and `raw/` is the source of truth; the knowledge graph
is an optional accelerator, never a citation.

The question is `$ARGUMENTS`. If it is empty, ask the user what they want to know and stop.

## Two retrieval paths

**1. Content (primary — always live, always runs).**
- Grep/glob `wiki/` **first** (the synthesized Layer-2 pages), then `raw/` for source depth.
  Use the topic taxonomy (`harness-internals`, `harness-engineering`, `frameworks-platforms`,
  `research-foundations`) to aim the search.
- Read the top-matching pages. Follow `[[wikilinks]]` **one hop** to gather adjacent context.
- This path is authoritative. On any conflict with the graph, the live page wins.

**2. Structure (optional accelerator — enrich, don't depend).**
- Consult `.understand-anything/knowledge-graph.json` only to (a) answer structural questions
  ("what links to X", "what's in cluster Y", "what's most connected") and (b) widen the
  "See also" list with related pages grep alone might miss.
- **Fail-open and subordinate:**
  - If the file is missing or unreadable → skip it silently, lean on path 1.
  - If its `gitCommitHash` (in `.understand-anything/meta.json`) ≠ current `HEAD` → the graph
    is **stale**; you may still use it for leads but add a one-line caveat
    (`graph snapshot is stale — structural hints may lag the live wiki`) and never let a stale
    hint override a live page.
  - Never run `/understand-knowledge` or rebuild the graph from here. Staleness is reported,
    not fixed.

## The non-negotiable: the graph is never a citation

Same status as DeepWiki in `CLAUDE.md` — a **lead only**. Every `[^n]` must resolve to a real
`wiki/` page (with section/line) or `raw/` note. A graph hint points you at a page you then
read and cite; it is never itself the cited source.

## Output (both)

1. **Cited prose answer.** Synthesize an answer to `$ARGUMENTS` from the pages you read.
   **Every fact-bearing statement carries a `[^n]` citation — no exceptions.** This is a hard
   gate, not a "substantive claims" guideline: if a sentence asserts anything drawn from the
   wiki (a fact, a definition, a comparison, an attribution), it gets a footnote citing the
   **wiki page + section** it came from (the page carries the deeper `raw/`/permalink
   citations — cite at page grain, don't re-derive them). End with a `## Sources` block
   resolving every `[^n]`.
   - **The only uncited sentences allowed** are non-factual connective tissue — the question
     restatement, navigational framing ("the wiki covers this across two pages"), and content
     explicitly labeled **not from the wiki** (see the last section). If a sentence states a
     fact and you cannot attach a citation, you do not yet have a source for it: either find
     the page that backs it, or cut the sentence. Never assert an uncited fact.
   - **Self-check before emitting:** re-read your answer one sentence at a time. For each
     sentence ask "is this a factual claim?" — if yes and it has no `[^n]`, fix it (cite or
     cut) before sending. State that you ran this pass.
2. **See also.** A short pointer list of related pages — `path` + a one-line *why* each
   (pointers over pasted content). Include `raw/` source notes where they add depth.
3. **Content gaps.** Any `[[wikilink]]` you hit that targets a **not-yet-existing** page is a
   research lead, not an error — surface it under a `Gaps` line as a candidate to ingest next
   (this is how the wiki says what to write next). Exclude off-scope/non-goal topics.

## When the wiki doesn't cover it

If grep finds nothing substantive, say so plainly — don't pad. Offer the closest adjacent
pages (if any) and name it as a content gap worth an `/ingest` or `/ingest-repo`. Do not
answer from general knowledge as if it were wiki content; if you add outside context, label it
clearly as **not from the wiki** and uncited.
