# Vendored authoring toolkit — sources & re-sync

> `vendor/` is a **pinned, read-only snapshot** of the authoring toolkit the lab uses to build
> cells. **Never hand-edit** anything under `vendor/` — change it only via the re-sync procedure
> below (an "ask first" boundary per the spec). Re-sync cadence is **on-demand only** (ADR/plan
> D3) — there is no scheduler.

## Pinned items (snapshot 2026-06-22)

| Vendored item | Source | Pinned SHA | Notes |
|---------------|--------|------------|-------|
| `agent-dev/` | plugin `agent-dev@nxtlvl-dev` (CC plugin cache) | `9f27c95775f0` | SHA pinned by the local install (`installed_plugins.json` version field). |
| `skill-creator/` | github `anthropics/claude-plugins-official` → `plugins/skill-creator` | `545162ba19782cb08668a5d1bb51a8e0368872ad` | ⚠ The local install reported version `unknown` (no per-plugin SHA pin); the SHA here is the **upstream `HEAD` resolved at snapshot time** (`git ls-remote`), which is the closest honest pin. Re-sync to confirm. |
| `plugin-dev/` | github `anthropics/claude-plugins-official` → `plugins/plugin-dev` | `545162ba19782cb08668a5d1bb51a8e0368872ad` | Same caveat as `skill-creator` — upstream `HEAD` at snapshot, local install unpinned. |
| `harness-review` | **in-repo**: `plugins/nxtlvl/skills/harness-review` (this Developer repo) | `40c1b01b799ecc6187c677aba5d321f0b60e68e7` | **Pointer, not a copy.** nxtlvl's own skill already lives in this repo; physically vendoring it would duplicate it (the N-plexing anti-pattern the harness reviews flag). Read it in place at the path above; SHA is the Developer `HEAD` at snapshot. |

> Honesty note (house doctrine — never fabricate a clean SHA): `skill-creator`/`plugin-dev` SHAs are
> the upstream-HEAD-at-snapshot, *not* a SHA the local install actually pinned. The local CC plugin
> cache stored them under a `unknown/` version dir. Treat these as approximate until a re-sync pins
> a confirmed SHA.

## Re-sync procedure (on-demand)

Re-syncing is an **"ask first"** action. To refresh a vendored item to a new pinned SHA:

### External toolkits (`agent-dev`, `skill-creator`, `plugin-dev`)

```bash
# From the lab root: sandbox/nxtlvl-labs/agents-lab/
# 1. Pick the upstream repo + the plugin subpath, and resolve the SHA you want to pin:
REPO=https://github.com/anthropics/claude-plugins-official   # (agent-dev: its own marketplace repo)
SHA=$(git ls-remote "$REPO" HEAD | awk '{print $1}')          # or pin a specific SHA deliberately

# 2. Snapshot just the plugin subdir at that SHA into a temp clone, then replace the vendored copy:
TMP=$(mktemp -d)
git clone --depth 1 "$REPO" "$TMP/src"
git -C "$TMP/src" checkout "$SHA"
rm -rf vendor/skill-creator
cp -R "$TMP/src/plugins/skill-creator" vendor/skill-creator
rm -rf "$TMP"

# 3. Update this file's table row with the new SHA + today's date, then commit vendor/ + SOURCES.md.
```

For `agent-dev`, the current snapshot came from the CC plugin cache
(`~/.claude/plugins/cache/nxtlvl-dev/agent-dev/<sha>/`); re-pin from that cache or from the
`nxtlvl-dev` marketplace's upstream repo the same way, recording the new SHA above.

### In-repo pointer (`harness-review`)

No copy to refresh — it tracks `plugins/nxtlvl/skills/harness-review` in this repo. Update the SHA
column to the current Developer `HEAD` (`git rev-parse HEAD`) when you want the pointer re-stamped.

## Boundary

`vendor/` is **read-only by convention**. Do not hand-edit vendored files; re-sync instead. Changing
what is vendored, or the re-sync source, is an "ask first" decision (spec §Boundaries).
