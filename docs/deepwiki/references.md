# References

## Purpose

The `references/` directory contains bundled reference documents that agents and commands load as their source of truth for trust contracts or per-mode rubrics. These are not user-facing docs; they are the contract layer for the plugin's own tools.

## Files

| File | Role |
|---|---|
| `context7-grounding.md` | Trust contract for Context7 docs-grounding (loaded by `context7-scout` and `/context7`). |

## Contracts

### `context7-grounding.md`

- States the core principle: Context7 serves primary-derived official docs, so its output is **evidence** (not just leads), and every claim must cite the **official doc URL @ version** — never "Context7" itself.
- Documents the two MCP tools: `mcp__plugin_nxtlvl_context7__resolve-library-id` and `mcp__plugin_nxtlvl_context7__query-docs`.
- Discipline: resolve-then-query, cite the doc URL, version-pin, no doc dumps, flag staleness/mis-ranking, read-only by withheld tools, bounded spend (1 resolve + ≤3 queries).
- Graceful degradation: one-line "unavailable" if the server fails or the library doesn't resolve.
- Secrets: optional `CONTEXT7_API_KEY` env var only; never commit in `.mcp.json`.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/references/context7-grounding.md" />

## Configuration / kill switches

- `context7-grounding.md` is a contract document; behavior is controlled by the agents that load it and the `CONTEXT7_API_KEY` env var.

## Tests

- No dedicated tests for reference documents. Their correctness is validated by the quality and trustworthiness of the artifacts produced by the agents/commands that load them.

## Dependencies

- `context7-grounding.md` is loaded by `agents/context7-scout.md` and `commands/context7.md`.

## Relevant ADRs / intent

- [ADR-030](../../../docs/decisions/ADR-030-context7-testifies-primary-sources-version-pinned.md) — Context7 testifies; cite the doc URL, version-pinned.

## Open questions / TODOs

- Only one reference document is bundled with the plugin today. The `harness-review` skill has its own richer reference set under `skills/harness-review/references/`, which is documented in [Skills](skills.md) but is not in the top-level `references/` directory.
