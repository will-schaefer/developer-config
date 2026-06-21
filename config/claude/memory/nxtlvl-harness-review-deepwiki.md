---
name: nxtlvl-harness-review-deepwiki
description: harness-review now has a /harness-review command + a DeepWiki Phase-2 orientation accelerator (deepwiki-scout) governed by orientation-not-evidence (ADR-029).
metadata:
  type: project
---

The `harness-review` domain gained two surfaces (built 2026-06-21, executing
`docs/plan/harness-review-deepwiki-orientation-plan.md` over `docs/spec/harness-review-deepwiki-orientation.md`):

- **`/harness-review` command** — `plugins/nxtlvl/commands/harness-review.md`; the entry surface of
  the existing skill (no new router-table row — it's the command surface of the established skill
  entry per [[nxtlvl-ideation-domain-status]]'s pattern). Takes `mode (A/B/C) + REPO + mode extras`.
- **DeepWiki Phase-2 orientation accelerator** — the plugin's **first `.mcp.json`** registers the
  no-auth `deepwiki` server (`https://mcp.deepwiki.com/mcp`, 3 tools); a read-only `deepwiki-scout`
  agent (only the 3 `mcp__plugin_nxtlvl_deepwiki__*` tools + WebFetch, read-only-by-withheld-tools)
  is spawned at Phase 2 on **public GitHub repos only** to accelerate the structural map & partition.

  ⚠️ **Plugin-MCP namespace gotcha (cost us a round-trip):** a plugin-bundled MCP server's tools are
  namespaced `mcp__plugin_<plugin>_<server>__<tool>` — here `mcp__plugin_nxtlvl_deepwiki__*`. The
  agent `tools:` grant MUST use that full form; the bare `mcp__deepwiki__*` form grants **nothing**
  (only user/project-scoped servers use the bare form). claude-code-guide got this wrong; the
  authoritative source is the official `plugin-dev:mcp-integration` skill. The first post-promote
  dogfood caught this live — scout silently fell back to WebFetch — confirming graceful degradation.

**Governing principle — ADR-029 (orientation-not-evidence):** *a secondary source may orient a
primary-source process but never testify in it.* DeepWiki gives **leads, not evidence** — every claim
stamped `LEAD — verify at source`, **zero** DeepWiki citations in any artifact; the local clone +
Phase-3 fan-out stay the sole source of every `file:line`. Local/private `REPO` degrades silently to
the pre-existing manual map; DeepWiki is never a hard dependency.

**Verification status (2026-06-21):** post-promote, the live MCP smoke test PASSED
(`read_wiki_structure` returned a full public-repo wiki). The first dogfood spawn caught the
namespace bug above (scout fell back to WebFetch, still produced a valid zero-citation brief). Fix
landed and **native MCP path RE-VERIFIED post-promote** — scout reported all three
`mcp__plugin_nxtlvl_deepwiki__*` tools available, ran 1 `read_wiki_structure` + 4 `ask_question`
natively (no WebFetch fallback), every claim LEAD-stamped with a clone pointer. Accelerator is
fully verified end-to-end (see [[nxtlvl-install-promotion]] for the promote-gating mechanics).
Contract + caveats:
`plugins/nxtlvl/skills/harness-review/references/deepwiki-orientation.md`.
