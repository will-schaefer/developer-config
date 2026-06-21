# DeepWiki orientation — how & why (Phase-2 accelerator)

> Loaded by the `harness-review` skill (Phase 0/1 gate, Phase 2 sub-step) and by the
> [`deepwiki-scout`](../../../agents/deepwiki-scout.md) agent. Keep this lean — it is the contract,
> not a tutorial.

## The principle (load-bearing)

> **A secondary source may *orient* a primary-source process but never *testify* in it.**

DeepWiki (Cognition/Devin) auto-generates a wiki — a component map + grounded Q&A — for public
GitHub repos. `harness-review` uses it to **accelerate Phase 2** (structural map & partition): it
suggests how the harness is shaped and seeds the fan-out's questions, so the run skips part of the
manual `find` + README read.

It produces **leads, not evidence.** It tells you *where to look* and *what to ask*; it never supplies
a citation. The local clone + the Phase-3 fan-out remain the **sole** source of every `file:line` in
any finished artifact. **Zero DeepWiki claims reach the artifact.** This is recorded as an ADR
(ADR-029 — orientation-not-evidence).

## The three tools (server `deepwiki`, registered in `plugins/nxtlvl/.mcp.json`)

- `mcp__deepwiki__read_wiki_structure` — the wiki's page/section map for a repo. The orientation
  skeleton: how DeepWiki thinks the harness partitions.
- `mcp__deepwiki__read_wiki_contents` — the prose of a section. Pull only the one or two that most
  clarify the partition; never dump the whole wiki.
- `mcp__deepwiki__ask_question` — grounded Q&A against the repo. Budget: **3–5** targeted questions
  per run, seeded by the mode (A: components/orchestration; B: the `LENS`; C: the `DOMAIN`).
- Fallback: `WebFetch` on `https://deepwiki.com/<owner>/<repo>` if the MCP tools don't resolve.

## The discipline (non-negotiable)

- **Every claim stamped `LEAD — verify at source`** with a where-to-verify pointer into the clone.
- **Staleness:** DeepWiki indexes upstream HEAD, which may differ from the vendored SHA. Note it; the
  Phase-3 fan-out verifies the partition regardless, so a stale lead costs nothing but a redirect.
- **Hallucination:** DeepWiki can invent. Treat output as a hypothesis; confirm before trusting.
- **Read-only by withheld tools:** `deepwiki-scout` holds only the three `mcp__deepwiki__*` tools +
  `WebFetch` — no Read/Write/Edit/Bash/Glob/Grep. A leaked DeepWiki citation is structurally
  impossible because the scout cannot write the tree or the artifact.

## Graceful degradation (never a hard dependency)

- **Public GitHub `REPO`** → DeepWiki on: spawn `deepwiki-scout` in Phase 2.
- **Local path / private `REPO`** → DeepWiki **skipped silently**; Phase 2 runs exactly as it did
  before this accelerator existed (manual `find` + README read). No error, no behavior change.
- DeepWiki unreachable / wiki not generated → WebFetch fallback, then silent skip.
