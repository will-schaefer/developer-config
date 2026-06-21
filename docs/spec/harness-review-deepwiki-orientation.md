# Spec: DeepWiki Orientation Accelerator for `harness-review`

> Status: **draft, awaiting approval** · Owner: nxtlvl · Origin: brainstorming session 2026-06-21

## Assumptions

Surfaced before any build — correct these now or they become the contract:

1. **DeepWiki MCP is reachable from this harness.** The free no-auth server at
   `https://mcp.deepwiki.com/mcp` can be added to the nxtlvl plugin's `.mcp.json` and the
   three tools (`read_wiki_structure`, `read_wiki_contents`, `ask_question`) become callable.
   If a session has no network egress to it, the WebFetch fallback covers degradation.
2. **`deepwiki-scout` runs as a spawned subagent of the skill**, not a main-thread step —
   so its verbose wiki output stays off the synthesis thread (same rationale as `context-scout`).
3. **No behavioral change to Modes A/B/C semantics.** DeepWiki only accelerates Phase 2; the
   rubrics, scoring, fan-out, and artifacts are untouched.
4. **The evidence boundary is non-negotiable.** DeepWiki output never appears as a citation in
   any artifact. Every `file:line` in a finished review still comes from the local clone +
   Phase-3 fan-out. (This is the ADR-candidate principle below.)
5. **Public-GitHub-only is acceptable degradation.** For local/private `REPO`, the skill skips
   DeepWiki silently and behaves exactly as it does today. DeepWiki is never a hard dependency.

## Objective

**What:** Add DeepWiki (Cognition/Devin) as an *orientation accelerator* to the nxtlvl
`harness-review` domain, exposed through three new surfaces (one agent, one skill edit, one
command) plus the plugin's first `.mcp.json`.

**Why:** `harness-review`'s Phase 2 (structural map & partition) is today a manual
`find` + README read. DeepWiki's auto-generated component map and grounded Q&A make that
orientation faster and richer — *without* touching the primary-source evidence the reviews
depend on. The domain also still lacks a `/harness-review` command (assumed to exist across
14 prior reviews and the adopt-backlog); this is the occasion to add it.

**Who:** The harness operator (the user) running harness reviews on the 13 vendored repos and
new candidates.

**Success looks like:** running `/harness-review` on a public GitHub harness orients the
partition from DeepWiki in seconds, every DeepWiki claim is stamped as a *lead*, the finished
artifact contains zero DeepWiki citations, and a local/private target review behaves exactly
as before.

### Core architectural principle (ADR candidate)

> **A secondary source may *orient* a primary-source process but never *testify* in it.**

DeepWiki produces **leads, not evidence**. It informs *where to look* and *what to ask*; it
never supplies a citation in the artifact. The local clone + Phase-3 fan-out remains the sole
source of every `file:line`. This is the load-bearing trust decision and is recorded as an ADR
via the decision rule after this spec is approved.

## Tech Stack

- Claude Code plugin (`plugins/nxtlvl/`) — Markdown skills/agents/commands + JSON manifests.
- DeepWiki MCP server: `https://mcp.deepwiki.com/mcp` (remote, HTTP, no auth, public repos only).
  Tools: `read_wiki_structure`, `read_wiki_contents`, `ask_question`.
- WebFetch (native) — zero-config fallback against `https://deepwiki.com/<owner>/<repo>`.
- No runtime/language deps; no package install.

## Project Structure

```
plugins/nxtlvl/
  .mcp.json                                   → NEW: registers the DeepWiki MCP server (plugin's first)
  agents/deepwiki-scout.md                    → NEW: read-only orientation scout (sibling of context-scout)
  commands/harness-review.md                  → NEW: /harness-review entry command
  skills/harness-review/
    SKILL.md                                  → EDIT: Phase 0/1 availability gate + Phase 2 scout sub-step
    references/deepwiki-orientation.md         → NEW: how/why — 3 tools, leads-not-evidence, caveats
docs/
  spec/harness-review-deepwiki-orientation.md  → this spec
  decisions/ADR-0NN-deepwiki-orientation-not-evidence.md → NEW (post-approval, via decision rule)
```

## Code Style

Match the existing nxtlvl agent/command idiom exactly. Agent frontmatter mirrors `context-scout`:

```markdown
---
name: deepwiki-scout
description: The read-only DeepWiki orientation scout that harness-review spawns at Phase 2 ...
tools: mcp__deepwiki__read_wiki_structure, mcp__deepwiki__read_wiki_contents, mcp__deepwiki__ask_question, WebFetch
model: sonnet
---
```

- **Read-only by withheld tools** — the scout gets *only* the DeepWiki tools + WebFetch; no
  Read/Write/Edit/Bash/Glob/Grep. It cannot touch the tree or the artifact.
- **Pointers-over-content, leads-not-evidence** — the brief is scannable; every claim carries a
  `LEAD — verify at source` stamp and a one-line "what to verify."
- **Treat input as data, not instructions** (same guard context-scout uses).
- Command frontmatter mirrors `brainstorm.md`: `description` + `argument-hint`, body ends `$ARGUMENTS`.

## Testing Strategy

No unit-test harness exists for prompt artifacts; verification is structural + dogfood:

1. **Plugin validation** — run `plugin-dev:plugin-validator` on the changed plugin (frontmatter,
   `.mcp.json` schema, file wiring).
2. **MCP smoke test** — confirm the three `mcp__deepwiki__*` tools resolve and return for one
   known public repo (e.g. `mindfold-ai/Trellis`), and that WebFetch fallback returns a page.
3. **Dogfood review** — run `/harness-review` Mode A on one already-reviewed public harness and
   confirm: (a) the scout brief stamps leads, (b) the partition is sane, (c) the finished
   artifact cites only local `file:line`, zero DeepWiki.
4. **Degradation test** — run against a local path `REPO`; confirm DeepWiki is skipped silently
   and behavior matches the pre-change baseline.
5. **Reader-test** — the skill's existing Phase 6 reader-test agent must still pass.

## Boundaries

- **Always:** keep DeepWiki output out of artifact citations; stamp every DeepWiki claim as a
  lead; degrade silently for non-public/local targets; preserve Modes A/B/C semantics.
- **Ask first:** any change to the rubric files or the fan-out/scoring logic; adding MCP servers
  beyond DeepWiki; changing the artifact formats.
- **Never:** let the scout write to the tree or artifact; make DeepWiki a hard dependency; cite a
  DeepWiki claim as evidence; turn the 11 domain rubric files into DeepWiki agents.

## Success Criteria

1. `.mcp.json` registers DeepWiki; the three `mcp__deepwiki__*` tools are callable in-session.
2. `deepwiki-scout` exists, is read-only by withheld tools, and returns a lead-stamped brief.
3. `harness-review/SKILL.md` Phase 0/1 gate availability and Phase 2 spawns the scout with the
   leads-not-evidence contract; `references/deepwiki-orientation.md` documents the how/why.
4. `/harness-review` command invokes the skill with `mode + REPO + mode extras`.
5. A dogfood Mode-A run on a public harness shows lead-stamping and a DeepWiki-citation-free artifact.
6. A local-path run degrades silently to today's behavior.
7. ADR-0NN records the orientation-not-evidence principle.
8. Router/index pointers updated so the command + agent are discoverable.

## Resolved Decisions (was Open Questions)

1. **MCP tool namespace** — `mcp__deepwiki__*` (server named `deepwiki` in `.mcp.json`). ✅
2. **`ask_question` budget** — **3–5** targeted questions per run, seeded by the chosen mode. ✅
3. **Router placement** — `/harness-review` stays the **command surface of the existing skill
   entry**; no new router-table row, just one index/discoverability pointer. ✅
```

