---
id: ADR-025
title: "Secondary sources orient but never testify — DeepWiki gives leads, not evidence"
status: Draft
date: 2026-06-28
---

# ADR-025: DeepWiki orients `harness-review` but never testifies — leads, not evidence

## Context

The `harness-review` skill's Phase 2 (structural map & partition) is today a manual `find` +
README read before the parallel fan-out. DeepWiki (Cognition/Devin) auto-generates a wiki — a
component map plus grounded Q&A — for any **public** GitHub repo, reachable via a free no-auth MCP
server (`https://mcp.deepwiki.com/mcp`, tools `read_wiki_structure` / `read_wiki_contents` /
`ask_question`). Wiring it into Phase 2 makes orientation faster and richer.

But `harness-review`'s entire value rests on **primary-source evidence**: every score, every
adopt/adapt/reject verdict, every `file:line` in a finished artifact comes from the local clone and
the Phase-3 fan-out reading the actual shipped code. A reviewed harness's *own* docs are explicitly
distrusted ("judge the wiring, not the README" — the skill's standing gotcha). DeepWiki is a
**secondary source**: auto-generated prose that can be **stale** (it indexes upstream HEAD, which may
differ from the vendored SHA) and can **hallucinate**. Letting a DeepWiki claim become a citation
would import exactly the unverified-secondary-source risk the method exists to exclude — and it would
do so invisibly, under an authoritative-looking wiki veneer.

So the load-bearing question is not *whether* to use DeepWiki, but *in what role*: an accelerator
that shapes where to look, or a source that can be cited. This is a trust boundary, architectural and
expensive to reverse (a leaked citation pattern would propagate across every future review), so it is
recorded here.

## Decision

**A secondary source may *orient* a primary-source process but never *testify* in it.** DeepWiki
produces **leads, not evidence.**

- **Orientation only.** DeepWiki output informs the Phase-2 partition and seeds the Phase-3 fan-out
  questions. That is its whole job. The local clone + fan-out remain the **sole** source of every
  `file:line`; **zero** DeepWiki claims reach any artifact.
- **Every claim is a stamped lead.** The `deepwiki-scout` brief stamps each claim
  `LEAD — verify at source` with a where-to-verify pointer into the clone. An unstamped claim is a bug.
- **Read-only by withheld tools** (per [ADR-018](ADR-018-ideation-domain.md)'s isolated-agent pattern). `deepwiki-scout` holds *only* the three
  `mcp__plugin_nxtlvl_deepwiki__*` tools + `WebFetch` — no Read/Write/Edit/Bash/Glob/Grep. A leaked
  DeepWiki citation is made **structurally impossible**: the scout cannot write the tree or the artifact.
- **Graceful degradation, never a hard dependency.** Public GitHub `REPO` → DeepWiki on; local path
  or private `REPO` → skipped silently, Phase 2 behaves exactly as before. Unreachable/un-indexed →
  `WebFetch` fallback, then silent skip.
- **Bounded spend.** One `read_wiki_structure` + **3–5** mode-seeded `ask_question` calls per run.

Realized as: the plugin's first `.mcp.json` (registers `deepwiki`), the `deepwiki-scout` agent + a
`references/deepwiki-orientation.md` contract, a Phase-0/1 availability gate and Phase-2 sub-step in
`SKILL.md`, and a `/harness-review` command. Modes A/B/C semantics, rubrics, scoring, and artifact
formats are untouched.

## Alternatives Considered

### Let DeepWiki citations into the artifact (treat it as a source)
- Pros: richer artifacts with less clone-reading; faster.
- Cons: imports stale/hallucinated secondary-source claims as evidence under an authoritative veneer —
  the exact failure "judge the wiring, not the README" exists to prevent. Corrodes the method's core.
- Rejected: the evidence boundary is the whole point of the skill.

### Trust the scout's discipline by prompt alone (give it normal tools)
- Pros: simpler; one fewer constraint.
- Cons: makes a leaked citation a *prompt-adherence* matter, not a structural impossibility. The
  cheap, durable guarantee is withholding the write tools.
- Rejected: read-only-by-withheld-tools costs nothing and removes the failure mode entirely.

### Make DeepWiki a required step (no degradation path)
- Pros: uniform pipeline; one code path.
- Cons: breaks every local-path/private review and any offline session; turns a free accelerator into
  a brittle dependency.
- Rejected: DeepWiki must be a silent, optional accelerator.

### Don't use DeepWiki at all (status quo manual map)
- Pros: zero new surface; no trust question to manage.
- Cons: leaves a real, free orientation speedup on the table for the common public-repo case.
- Rejected: the speedup is worth capturing — once the evidence boundary is guaranteed.

## Consequences

- **The evidence boundary is now explicit and enforced**, not just conventional: withheld tools make
  the boundary structural, the lead-stamp makes it visible, and the dogfood check (zero DeepWiki
  citations in the produced artifact) makes it testable.
- **Public-repo reviews orient faster**; local/private reviews are unchanged. The accelerator is
  free where available and invisible where not.
- **The plugin gains its first `.mcp.json`** — a new dependency surface (a remote server). It is
  no-auth, public-repo-only, and non-load-bearing: if it vanishes, reviews degrade to today's
  behavior. The wiki-staleness-vs-vendored-SHA gap is covered by the staleness note + the fact that
  Phase-3 verifies the partition regardless.
- **A reusable doctrine.** "Secondary sources orient, primary sources testify" generalizes beyond
  DeepWiki to any future auto-generated or third-party knowledge source the harness might consult.
- **Verification outcome (2026-06-21, post-promote):** the live MCP smoke test passed
  (`read_wiki_structure` returned a full wiki for a public repo). The first dogfood spawn surfaced a
  real defect — the scout's `tools:` grant used the bare `mcp__deepwiki__*` form, but a
  plugin-bundled MCP server is namespaced `mcp__plugin_nxtlvl_deepwiki__*`, so the grant resolved to
  nothing and the scout fell back to `WebFetch`. This *validated graceful degradation* (the fallback
  produced a correct lead-stamped brief with zero artifact citations) and was fixed by granting the
  namespaced tool ids. **Re-verified post-fix:** after a fresh promote, the scout reported all three
  `mcp__plugin_nxtlvl_deepwiki__*` tools available and used the native MCP path end-to-end (one
  `read_wiki_structure` + four `ask_question`, no WebFetch fallback), every claim `LEAD`-stamped with
  a clone pointer. The native path is now confirmed working.
- Recorded per the global decision rule (`~/.claude/rules/decisions.md`). Reuses the
  isolated read-only-agent pattern of [ADR-018](ADR-018-ideation-domain.md)
  ([`context-scout`](../../plugins/nxtlvl/agents/context-scout.md) is the sibling).
