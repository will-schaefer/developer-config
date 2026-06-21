# Domain Review — Marketplace / multi-plugin structure (Mode C rubric)

> Per-domain specialist rubric for the **`harness-review` skill**, Mode C. `SKILL.md` is the spine;
> [`../domain-review.md`](../domain-review.md) is the framework; this file owns the **marketplace**
> rubric. Neutral: judges a multi-plugin harness on **general best practice for a plugin
> marketplace** — nxtlvl's own lessons (single source of truth, count honesty, promote-by-`git mv`)
> are cited as *rationale for why a dimension matters*, never as the bar the reviewed harness is
> scored against.
>
> **Subsystem, not component type.** A marketplace is the *structure across* plugins, not any one
> plugin's internals. Use this rubric when the ask is "how good is this multi-plugin harness as a
> marketplace" (manifest integrity, count honesty, archetype split). To audit one plugin's hooks or
> agents, use the component-type rubric instead.

---

## 1. What this domain is — where to look

A **marketplace** is a harness that ships many plugins behind a manifest — a catalog the runtime
reads to know what exists. The audit is about the *catalog and the relationships between its
entries*, not the craft inside any single plugin: does the manifest match disk, do the counts agree,
are the entries genuinely distinct or boilerplate wrappers over a shared backend?

Read, in order:
- **The manifest** — `.claude-plugin/marketplace.json` (or equivalent). This is the claimed
  inventory; treat it as ground truth for *what is advertised*, then check it against disk.
- **The disk** — the `plugins/` tree: one directory per plugin, each with its own
  `commands/`/`agents/`/`skills/`/`scripts/` and (if MCP-enabled) `.mcp.json`/`hooks.json`.
- **The count claims** — every place a count appears: the manifest length, the README/CLAUDE.md prose
  ("21 native plugins"), any CLI `list` output. Reconcile all of them against the disk count.
- **The shared backend** — where the real work lives (a `v3/`/`packages/` engine, a `npx <cli>`).
  Most "plugins" may be thin wrappers over it; find the engine to judge the wrapper-vs-substantive
  split.

---

## 2. The specialist rubric  (score each 1–5, justify with `file:line`)

**Dominant dimensions: D1 (count honesty) and D2 (manifest-vs-disk integrity)** — a marketplace that
can't accurately state its own size or contents fails at its one job (telling a user what they're
getting), no matter how good individual plugins are. A fatal flaw in either caps the overall.

| # | Dimension | The question it answers | What a 5 looks like | The failure mode (a 1) |
|---|-----------|-------------------------|---------------------|------------------------|
| 1 | **Count honesty** ⭐ | Do all stated counts (manifest, docs, CLI) agree with disk? | Single source of truth; manifest = disk = README = CLI; drift caught in CI. | Three disagreeing numbers (manifest 35 / docs "21 native" / CLI "20 available"); a user can't know the true inventory. |
| 2 | **Manifest-vs-disk integrity** ⭐ | Does the manifest describe what's actually deployed? | Every manifest entry exists on disk with the declared shape; every disk plugin is registered; validated in CI. | Manifest lists plugins absent from disk, or disk has unregistered plugins; the catalog is fiction. |
| 3 | **Archetype coherence** | Is the wrapper-vs-substantive split intentional and documented? | The wrapper archetype is named (shared backend linked); substantive/code-runtime plugins are clearly marked; users grasp the architecture. | 24 of 35 are identical boilerplate (uniform version, 1 cmd/1 agent/2 skills) masquerading as distinct capabilities, undocumented. |
| 4 | **Single-source vs. duplication** | Is shared logic in one place, or copied per plugin? | One canonical backend; plugins route to it; no prose/agent duplicated across plugin dirs. | The same agent/skill byte-copied across plugins; "encoded N×, routed 0×" at plugin granularity. |
| 5 | **Activation wiring** | Where are MCP/hooks actually wired — per plugin or hidden in one? | Each plugin that claims MCP/hooks ships its own `.mcp.json`/`hooks.json`; wiring is decentralized and discoverable, or the sharing is explicit. | `.mcp.json` ships in one plugin while 34 advertise MCP tools through it; wiring is monolithic and undiscoverable. |
| 6 | **Namespacing & collision** | Can a user tell which plugin owns which command/agent? | Names are scoped (`plugin:command`) or grouped; no collisions across the catalog. | Bare command/agent names across many plugins; duplicate names with divergent behavior. |
| 7 | **Self-containment** | Does a plugin bundle what it needs, or silently depend on a monorepo? | Self-contained plugins carry their own runtime; dependence on a shared engine is declared. | Most plugins ship zero runtime and are 100% dependent on an undeclared shared backend — "empty" to a per-plugin scan. |

---

## 3. What to hunt — the concrete checks

- **The count reconciliation** (D1) — collect every count: `jq '.plugins | length'` on the manifest,
  `ls -d plugins/*/ | wc -l` on disk, and every prose/CLI number. Any disagreement that goes
  unreconciled is the headline failure — *a marketplace that can't count itself can't sell itself.*
- **The manifest-vs-disk diff** (D2) — for each manifest entry, confirm the directory exists with the
  declared structure; for each disk plugin, confirm it's registered. List orphans (on disk, not in
  manifest) and ghosts (in manifest, not on disk) explicitly.
- **The archetype histogram** (D3) — tally each plugin's `version` and its `cmd/agent/skill`
  cardinality. If > ~80% are uniform, the catalog is mostly wrappers; check whether that's documented
  as an intentional archetype or presented as N distinct capabilities.
- **Duplication scan** (D4) — diff agent/skill prose across `plugins/*/`; cross-reference any matches
  against the shared backend. Count-inflation from copying is a smell, not breadth.
- **Wiring census** (D5) — `find plugins -name .mcp.json` and `-name hooks.json`; compare the count to
  the number of plugins advertising MCP/hooks. A single central `.mcp.json` behind many claims is a
  finding.
- **Collision check** (D6) — list command/agent names across the catalog; flag duplicates.
- **Self-containment probe** (D7) — for a sample of plugins, check for any bundled runtime
  (`src/`/`*.ts`); a plugin with none depends entirely on the shared engine — note whether that
  dependency is declared.

---

## 4. Partition & signal-vs-demo

- **Partition:** the manifest is shared context for every agent — read it first. For a large catalog,
  fan out by **archetype group** (one agent over the wrapper plurality scoring D3/D4/D7, one per
  substantive/code-runtime plugin) rather than one-agent-per-plugin (the wrappers are near-identical).
  Always reconcile counts on the main thread — it's the dominant finding and shouldn't be split.
- **Signal vs demo:** a marketplace may ship example/template plugins to demonstrate the format. Note
  them as scaffolding; don't count them toward (or against) the substantive inventory — but *do* count
  them in the count-honesty reconciliation, because a user sees them in the catalog.

---

## 5. Lessons & gotchas

- **Count honesty is the existential dimension.** Disagreeing self-counts aren't a style nit — they
  mean the catalog misrepresents itself, and nothing downstream can be trusted until they reconcile.
  Audit this first; it usually caps the score on its own.
- **Breadth-as-product is the inverse of curated-depth.** A 35-plugin catalog of near-identical
  wrappers over one CLI is *one* capability wearing 35 hats, not 35 capabilities. Judge what a user
  actually gains, not the directory count.
- **The manifest is ground truth for claims, disk is ground truth for reality** — score the gap
  between them, and let it cap rather than averaging a clean per-plugin score over a fictional catalog.
- **Centralized wiring can be legitimate** — a shared `.mcp.json` is fine *if declared*; it's a
  finding only when 34 plugins advertise tools they don't carry. Distinguish "shared by design" from
  "hidden dependency."
- **A per-plugin scan lies about wrappers.** Self-contained code-runtime plugins read as "full" and
  wrapper plugins read as "empty" to a naive file scan; correct for it before judging the split.
