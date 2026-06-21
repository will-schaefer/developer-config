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
  agent (only the 3 `mcp__deepwiki__*` tools + WebFetch, read-only-by-withheld-tools) is spawned at
  Phase 2 on **public GitHub repos only** to accelerate the structural map & partition.

**Governing principle — ADR-029 (orientation-not-evidence):** *a secondary source may orient a
primary-source process but never testify in it.* DeepWiki gives **leads, not evidence** — every claim
stamped `LEAD — verify at source`, **zero** DeepWiki citations in any artifact; the local clone +
Phase-3 fan-out stay the sole source of every `file:line`. Local/private `REPO` degrades silently to
the pre-existing manual map; DeepWiki is never a hard dependency.

**Live-verification caveat** (see [[nxtlvl-install-promotion]]): the live `mcp__deepwiki__*` smoke
test + full dogfood run are gated on a `/plugin` promote (installed plugin is a SHA-pinned cache
snapshot); structural validation + WebFetch reachability are confirmed at build time. Contract +
caveats: `plugins/nxtlvl/skills/harness-review/references/deepwiki-orientation.md`.
