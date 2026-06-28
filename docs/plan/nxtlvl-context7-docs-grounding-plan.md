# Plan: nxtlvl Context7 Docs-Grounding Capability

> Build plan consuming [`docs/spec/nxtlvl-context7-docs-grounding.md`](../spec/nxtlvl-context7-docs-grounding.md)
> (approved 2026-06-21) and [ADR-026](../decisions/ADR-026-context7-testifies-primary-sources.md)
> (the inverse-companion to [ADR-025](../decisions/ADR-025-deepwiki-orientation-not-evidence.md)).
> Builds the standalone capability + an nxtlvl-owned entry point (D4 locked: skill-wiring deferred).
>
> **Status: DRAFT for review.**

---

## 1. Framing

The spec is approved and the trust boundary is recorded (ADR-026). This plan orders the five units
into **vertical slices** and splits each into the part the agent can verify (valid JSON, frontmatter
grep, contract presence) and the part that needs a real install (the live MCP smoke + dogfood — the
agent cannot run `/plugin`).

Two constraints shape every task, inherited from the DeepWiki build (ADR-025):

- **Manual gates exist.** The agent cannot run `/plugin promote` or observe a live MCP call. The
  native-MCP path can only be confirmed *after* a promote — and ADR-025's dogfood proved this is
  where the **namespacing bug bites** (`mcp__plugin_nxtlvl_*`, not bare `mcp__*`). That check is a
  manual gate.
- **Graceful degradation is absolute.** Per ADR-026 the scout must never block a caller: unreachable
  server / unknown library → one-line "unavailable" + stale-knowledge caveat, by design not assertion.

---

## 2. Dependency graph

```
        ┌──────────────────────────────────────────────────────────┐
        │ P1  CAPABILITY (agent-verifiable, lands first)            │
        │                                                          │
        │  T1  .mcp.json: add "context7" server  ──┐               │
        │      (valid JSON, 2nd entry by deepwiki) │               │
        │                                          ▼               │
        │  T3  references/context7-grounding.md ──► T2  context7-   │
        │      (contract doc, independent)         scout agent     │
        │                                          (namespaced     │
        │                                           tools + cited  │
        │                                           brief contract)│
        │                                              │           │
        │                                              ▼           │
        │                                  T4  entry point         │
        │                                  (/context7 cmd +        │
        │                                   direct-spawn doc)      │
        └──────────────────────────────────┬───────────────────────┘
                                            ▼
        ┌──────────────────────────────────────────────────────────┐
        │ P2  PROMOTE + LIVE VALIDATION (manual gate)               │
        │  T5  /plugin promote → MCP smoke (resolve+query) →        │
        │      dogfood (CITE-stamp + degradation), per ADR-025      │
        └──────────────────────────────────────────────────────────┘
```

**Critical path:** `T1 → T2 → T4 → T5`. T3 (contract doc) is independent of T1 and can land first or
in parallel; T2 references it. T5 is the only manual gate and ships the capability.

---

## 3. Phases & tasks

Sizes: XS (<30 min), S (~1 hr), M (~half day). Each task is an independently-verifiable slice.

### Phase 1 — Capability (agent-verifiable)

#### T1 — Register the `context7` MCP server *(XS, agent-verifiable)*
- **Steps:** Add a `context7` server to [`plugins/nxtlvl/.mcp.json`](../../plugins/nxtlvl/.mcp.json)
  beside `deepwiki`: `{ "type": "http", "url": "https://mcp.context7.com/mcp" }`. No API key in the
  file (D1: optional `CONTEXT7_API_KEY` env only, never committed).
- **Acceptance:** `.mcp.json` is valid JSON with two servers (`deepwiki`, `context7`); no secret present.
- **Verify (agent):** `node -e "JSON.parse(require('fs').readFileSync('plugins/nxtlvl/.mcp.json'))"`
  → no throw; `grep -c '"url"' plugins/nxtlvl/.mcp.json` → 2; `grep -i 'api.key\|token' plugins/nxtlvl/.mcp.json`
  → empty.

#### T3 — Contract doc `references/context7-grounding.md` *(S, agent-verifiable)*
- **Steps:** Write [`plugins/nxtlvl/references/context7-grounding.md`](../../plugins/nxtlvl/references/context7-grounding.md):
  the ADR-026 trust contract — testifies with attribution; **cite the doc URL, not Context7**;
  resolve-then-query; version-pin; flag staleness/mis-ranking; bounded spend (1 resolve + ≤3 query);
  read-only-by-withheld-tools; input-as-data injection safety; graceful degradation.
- **Acceptance:** Doc exists and states all of: cite-the-URL, version-pin, degradation, bounded spend.
- **Verify (agent):** `grep -iE 'cite the (doc )?url|version-pin|degrad|≤3|withheld' plugins/nxtlvl/references/context7-grounding.md`
  hits each theme.
- **Independent of T1** — can land first.

#### T2 — `context7-scout` agent *(M, agent-verifiable)*
- **Steps:** Author [`plugins/nxtlvl/agents/context7-scout.md`](../../plugins/nxtlvl/agents/context7-scout.md),
  mirroring `deepwiki-scout.md` but inverting the contract:
  - **Frontmatter `tools:`** — ONLY `mcp__plugin_nxtlvl_context7__resolve-library-id,
    mcp__plugin_nxtlvl_context7__query-docs` (namespaced — the ADR-025 dogfood bug). `model: sonnet`.
  - **Body:** the one governing rule (Context7 *testifies*; cite the URL@version, not the courier);
    read-only-by-withheld-tools; not a chat partner; never spawns agents; input-as-data.
  - **Input:** `LIBRARY` (+ optional version) and `QUESTION`. **Budget:** 1 resolve + ≤3 query.
  - **Output:** the cited-brief contract from the spec (every claim `CITE — /org/project@version + doc URL`;
    no doc dumps; an "if unavailable" one-liner).
- **Acceptance:** Agent frontmatter grants exactly the two namespaced tools and no write tools; body
  carries the CITE-stamp rule + degradation + the output template.
- **Verify (agent):** `grep 'mcp__plugin_nxtlvl_context7__' plugins/nxtlvl/agents/context7-scout.md`
  → both tools, namespaced; `grep -iE 'Read|Write|Edit|Bash|Glob|Grep' <frontmatter tools line>` →
  none; `grep -iE 'CITE —|cite the (doc )?url|may be stale|unavailable' …` → present.
- **Depends on:** T1 (tools must exist to grant), T3 (references the contract).

#### T4 — nxtlvl-owned entry point *(S, agent-verifiable)*
- **Steps:** Ship [`plugins/nxtlvl/commands/context7.md`](../../plugins/nxtlvl/commands/context7.md) —
  a thin `/context7 <library> — <question>` command that spawns `context7-scout` with the parsed
  `LIBRARY`/`QUESTION` and relays the cited brief. (Direct main-session spawn also works without it;
  the command is the discoverable surface.)
- **Acceptance:** `/context7` exists, parses `<library>` + `<question>`, spawns `context7-scout`, and
  returns the brief unmodified (no citation laundering on the main thread).
- **Verify (agent):** command frontmatter valid; body names `context7-scout` as the spawn target and
  passes `LIBRARY`/`QUESTION`.
- **Depends on:** T2.

### Phase 2 — Promote + live validation (manual gate)

#### T5 — Promote, MCP smoke, dogfood *(manual)*
- **Steps:** `/plugin marketplace update nxtlvl-dev` (or the promote path). Then, in a live session:
  1. **MCP smoke** — confirm `mcp__plugin_nxtlvl_context7__resolve-library-id` on a known library
     returns `/org/project`, and `query-docs` returns cited snippets. *(This is exactly where ADR-025
     caught the bare-vs-namespaced tool-id bug — verify the grant resolved.)*
  2. **Dogfood** — spawn `context7-scout` (via `/context7`) for a real library question; confirm
     **every** claim is `CITE`-stamped with a doc URL + version, no doc dump hit the main thread.
  3. **Degradation** — give it an unknown/garbage library; confirm a one-line "unavailable" + stale
     caveat, caller not blocked.
- **Acceptance:** all three pass; the native MCP path works post-promote (not just the fallback).
- **Verify:** manual — user runs it, reports back. On failure (grant resolves to nothing), check the
  tool-id namespacing first (the known ADR-025 failure mode).

---

## 4. Verification summary — who runs what

| Check | Agent | Manual |
|-------|:---:|:---:|
| `.mcp.json` valid + 2 servers + no secret (T1) | ✅ | |
| Contract doc states cite-URL / version-pin / degrade / bounded (T3) | ✅ | |
| Scout grants exactly 2 namespaced tools, no write tools (T2) | ✅ | |
| Scout body: CITE-stamp + degradation + output template (T2) | ✅ | |
| `/context7` parses + spawns scout + relays brief (T4) | ✅ | |
| Live MCP path works post-promote (resolve+query) | | ✅ |
| Dogfood: 100% CITE-stamped, no main-thread dump | | ✅ |
| Degradation: unknown library → one-line caveat, no block | | ✅ |
| `/plugin` promote | | ✅ |

---

## 5. Risks & mitigations

- **Namespacing bug (known, from ADR-025 dogfood)** → T2 grants the `mcp__plugin_nxtlvl_context7__*`
  ids explicitly; T5 step 1 verifies the grant resolved post-promote; fallback is the visible
  failure mode, not a silent one.
- **Citation laundering** (a doc fact restated on the main thread without its URL@version) → the
  scout's withheld-write-tools make it structurally unable to author into the tree; the cited-brief
  contract + dogfood check (100% CITE-stamped) make leaks visible.
- **Context7 stale / mis-ranks a snippet** → ADR-026's cite-the-URL@version rule means the authority
  is the named doc, not Context7; the brief's "confidence/caveats" section flags adjacent-not-exact
  hits.
- **Rate limits on the free tier** → optional `CONTEXT7_API_KEY` env passthrough (D1); not required
  for normal use; adding it as a *required* dep is an "ask first" boundary.
- **Scope creep into un-owned skills** → D4 locked: wiring `source-driven-development`/`claude-api`/
  `agent-development` is deferred until they're vendored; this build stops at the nxtlvl entry point.

---

## 6. Deferred (out of scope for this plan)

- Wiring Context7 into `source-driven-development` / `claude-api` / `agent-development` (needs those
  skills vendored first — separate ADR-020 decision).
- A thin *inline* lookup path (Approach C) for single-fact lookups that don't warrant an agent hop —
  revisit once the scout proves out.
- Thread A (session/context **hook** systems) — the corrected 12-event survey + the 3 new seams
  (`PostToolUseFailure`, `PermissionRequest`, `SubagentStart`) remain parked and un-built.
