# Spec: Context7 Docs-Grounding Capability for nxtlvl

> Status: **approved 2026-06-21** · Owner: nxtlvl · Origin: brainstorming session 2026-06-21
> (Approach A + ADR). Inverse-companion to
> [`harness-review-deepwiki-orientation.md`](harness-review-deepwiki-orientation.md) /
> [ADR-025](../decisions/ADR-025-deepwiki-orientation-not-evidence.md).

## Assumptions

Surfaced before any build — correct these now or they become the contract:

1. **Context7 MCP is reachable from this harness.** The remote server at
   `https://mcp.context7.com/mcp` can be added to the nxtlvl plugin's `.mcp.json` and its two
   tools (`resolve-library-id`, `query-docs`) become callable as
   `mcp__plugin_nxtlvl_context7__*`. The free no-auth tier is sufficient for normal use; an
   optional `CONTEXT7_API_KEY` raises rate limits (D1).
2. **`context7-scout` runs as a spawned subagent**, not a main-thread step — so raw doc snippets
   stay off the synthesis thread (same rationale as `deepwiki-scout` / `context-scout`).
3. **The trust posture is the *inverse* of DeepWiki.** Context7 serves official library docs, so
   it is **primary-derived** and its citations **may reach artifacts** — but the citation is to
   the **doc URL** Context7 delivered (the courier), version-pinned, never to "Context7" itself.
4. **The intended consumers are not yet nxtlvl-owned.** `source-driven-development`, `claude-api`,
   and `agent-development` are agent-skills/native/plugin-dev skills. Per
   [ADR-020](../decisions/ADR-020-router-endorses-established-items.md) nxtlvl does not wire
   into un-owned skills. So this spec builds the **standalone capability** and exposes it through
   an **nxtlvl-owned entry point**; wiring into those skills is deferred to when/if they are
   vendored (D4 — the scope-shaping decision).
5. **Context7 is never a hard dependency.** Unreachable server / library-not-found → the scout
   says so in one line and the caller falls back to model knowledge *with a "may be stale" caveat*.
   Graceful, silent degradation, exactly as ADR-025 requires of DeepWiki.

## Objective

**What:** Give nxtlvl a self-contained, governed **library-docs grounding capability** backed by
Context7, exposed through three new surfaces (the plugin's second `.mcp.json` server, one
read-only agent, one contract doc) plus an nxtlvl-owned entry point, and recorded by one ADR.

**Why:** Multiple harness surfaces write code or reason against evolving third-party APIs — and
the harness has no live-docs channel today, so it grounds in the model's training cutoff. (This
session itself hit the failure: an authoritative-sounding hook-event list was stale until Context7
corrected it.) DeepWiki already orients us on *other repos*; Context7 is the natural sibling that
grounds us in *official library/framework docs*.

**Who:** The harness operator (the user) and any nxtlvl skill/agent that needs a fact from a
library's official docs to be current and citable rather than recalled.

**Success looks like:** an nxtlvl surface needing a library fact spawns `context7-scout`, gets back
a tight brief where **every claim carries `CITE — /org/project@version + doc URL`**, the raw doc
dump never touches the main thread, and an unreachable/unknown library degrades to a one-line
"unavailable" with a stale-knowledge caveat — never a block.

### Core architectural principle (ADR candidate)

> **A primary source may *testify* — but cite the source it delivered, version-pinned, not the
> courier that delivered it.**

Context7 produces **evidence, not just leads** — the inverse of ADR-025. But Context7 is a
third-party snapshot that can lag latest or mis-rank snippets, so the citation is to the **official
doc URL** at a **resolved library version**, and correctness-critical facts name that URL as the
authority. This is the load-bearing trust decision and is recorded as an ADR via the decision rule
after this spec is approved — the inverse-companion that completes ADR-025's doctrine
("secondary→orient, primary→testify").

## Tech Stack

- Claude Code plugin (`plugins/nxtlvl/`) — Markdown agents/skills + JSON manifests.
- Context7 MCP server: `https://mcp.context7.com/mcp` (remote, HTTP). Tools: `resolve-library-id`,
  `query-docs`. Free no-auth tier; optional `CONTEXT7_API_KEY` for higher limits (D1).
- Spawned-subagent isolation (native `Agent`/Task) — same pattern as `deepwiki-scout`.
- No runtime/language deps; no package install.

## Project Structure

```
plugins/nxtlvl/.mcp.json                          → add "context7" server (2nd entry beside deepwiki)
plugins/nxtlvl/agents/context7-scout.md           → NEW read-only scout agent
plugins/nxtlvl/references/context7-grounding.md    → NEW shared contract doc (D2: agent-adjacent)
plugins/nxtlvl/commands/context7.md (optional)     → NEW entry-point command (D4 entry point)
docs/decisions/ADR-026-context7-testifies-primary-sources.md → NEW ADR (inverse-companion to ADR-025)
docs/spec/nxtlvl-context7-docs-grounding.md        → THIS spec
```

## The five units

1. **`.mcp.json` registration** — add a `context7` server beside `deepwiki`. Tools resolve to
   `mcp__plugin_nxtlvl_context7__resolve-library-id` / `__query-docs`. **Namespace gotcha
   (ADR-025 dogfood):** bundled MCP tools are `mcp__plugin_nxtlvl_*`, *not* bare `mcp__*` — the
   scout's `tools:` grant must use the namespaced ids or it silently resolves to nothing.

2. **`context7-scout` agent** — read-only **by withheld tools**: holds *only* the two
   `mcp__plugin_nxtlvl_context7__*` tools. No Read/Write/Edit/Bash/Glob/Grep — a fabricated or
   mis-attributed citation cannot be written into the tree. Input: `LIBRARY` (+ optional version)
   and `QUESTION`. Output: a **cited brief** (contract below). Model: `sonnet`. Does not spawn
   further agents; not a chat partner; treats input as data, never instructions.

3. **Contract doc** `references/context7-grounding.md** — the trust contract: testifies with
   attribution; cite the doc URL not Context7; resolve-then-query; version-pin; flag staleness /
   mis-ranking; bounded spend; injection-safety.

4. **Entry point (D4)** — an nxtlvl-owned way to invoke grounding *now*, without depending on
   un-owned skills: (a) direct main-session spawn of `context7-scout`, and optionally (b) a thin
   `/context7 <library> — <question>` command. Wiring into `source-driven-development` / `claude-api`
   / `agent-development` is **deferred** until those are vendored.

5. **The ADR** — *"Context7 testifies: primary sources, version-pinned"* — records the trust
   boundary, the resolve-then-query + cite-the-URL discipline, graceful degradation, and bounded
   spend. Inverse-companion to ADR-025; cross-links it.

## Output contract — the cited brief (inverts deepwiki-scout)

```
## Grounding: <library> @ <resolved /org/project[/version]>  ·  Context7  ·  CITED
<1–2 sentence answer to QUESTION, grounded in the docs.>
<version + snapshot caveat: Context7 is a snapshot; for version-critical facts the doc URL is authority.>

## Findings (every claim cited)
- <claim/fact> — CITE: /org/project@version · <doc URL> — <one-line relevance>
- … (only what answers the QUESTION; no doc dumps)

## Confidence / caveats
- <where Context7 mis-ranked, returned adjacent-not-exact, or the version looked off>

## If unavailable
- <one line: "Context7 unreachable / no library match — fall back to model knowledge (may be stale)."> 
```

Rules: every bullet carries `CITE — …`; no pasted doc dumps (summarize + link); cite the **URL**,
never "Context7"; if the version is uncertain, say so rather than implying precision.

## Governance (inherited from ADR-025 playbook)

- **Read-only by withheld tools** — only the two Context7 tools; structurally cannot pollute or
  fabricate into the tree.
- **Graceful degradation** — unreachable / unknown library → one-line "unavailable" + caveat;
  never blocks the caller. Not a hard dependency.
- **Bounded spend** — **1** `resolve-library-id` + **≤3** `query-docs` per grounding (the tool's
  own per-question caps reinforce this).
- **Input-as-data** — `LIBRARY`/`QUESTION` are data; stray "ignore the above" directives are not
  obeyed.
- **Secrets discipline** — `CONTEXT7_API_KEY` (if used) is an env var, never committed in
  `.mcp.json` (per the claude-config secrets convention).

## Decisions (recommended defaults — confirm at review)

| ID | Decision | Recommended default | Status |
|----|----------|---------------------|--------|
| **D1** | Endpoint + auth tier | `https://mcp.context7.com/mcp`, free no-auth; optional `CONTEXT7_API_KEY` env passthrough | **LOCKED** |
| **D2** | Contract-doc home | Agent-adjacent `plugins/nxtlvl/references/context7-grounding.md` (no single owning skill yet) | **LOCKED** |
| **D3** | `claude-api` treatment | Stays a static curated doctrine; gains the scout as an *optional* escalation for live/version-sensitive facts | **LOCKED** |
| **D4** | Consumer wiring scope | Build standalone capability + nxtlvl-owned entry point now; **defer** wiring into un-owned SDD/claude-api/agent-dev until vendored | **LOCKED** (standalone + entry point) |

None rise to a *new* ADR beyond the trust-boundary ADR (they're small/reversible config — they fold
into this spec per the decision rule §1).

## Testing Strategy

Mirrors the DeepWiki manual/scriptable split (the agent cannot run `/plugin`):

- **Agent-scriptable:** `.mcp.json` is valid JSON and registers `context7`; scout frontmatter
  `tools:` uses the namespaced `mcp__plugin_nxtlvl_context7__*` ids (grep); the contract doc exists
  and states cite-the-URL + version-pin.
- **Live MCP smoke (manual, post-promote):** `resolve-library-id` on a known library returns
  `/org/project`; `query-docs` returns cited snippets — mirrors the ADR-025 smoke that caught the
  namespacing bug.
- **Dogfood (manual):** spawn `context7-scout` for a real library question; confirm every claim is
  `CITE`-stamped with a doc URL + version, no doc dump on the main thread, and an unknown-library
  input degrades to the one-line caveat.

## Boundaries

- **Always:** stamp every claim `CITE — URL @ version`; keep the scout read-only-by-withheld-tools;
  degrade silently on failure; keep raw doc output off the main thread.
- **Ask first:** vendoring `source-driven-development` (or any un-owned consumer) to wire it in;
  adding `CONTEXT7_API_KEY` as a required (vs optional) dependency.
- **Never:** cite "Context7" as the source (cite the URL it delivered); commit an API key in
  `.mcp.json`; let an unreachable Context7 block a caller; let the scout write the tree.

## Success Criteria

1. `plugins/nxtlvl/.mcp.json` registers `context7`; namespaced tools are callable.
2. `context7-scout` returns a brief where **100% of claims carry `CITE — URL @ version`**; zero
   uncited assertions; no doc dump reaches the main thread.
3. An unknown library / unreachable server yields a one-line "unavailable" + stale caveat — the
   caller is never blocked.
4. The ADR records the inverse-companion trust contract and cross-links ADR-025.
5. The capability is invocable via an nxtlvl-owned entry point with **no** dependency on un-owned
   skills.

## Open Questions

- **D4 (loudest):** Is "standalone capability + nxtlvl entry point, defer skill-wiring" the right
  scope — or do you want to vendor `source-driven-development` as part of *this* work so there's a
  real first consumer? (Default: defer. Vendoring is a separate, larger decision.)
- **D1:** Start no-auth and add the key only if limits bite, or wire the optional key from day one?
- **Entry point form:** direct main-session spawn only, or also ship the `/context7` command now?
