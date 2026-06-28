---
id: ADR-001
title: "Establish the nxtlvl plugin family: three independent plugins, three repos, one shared marketplace"
status: Accepted
date: 2026-06-27
replaces: "ADR-001 (2026-06-16) — Package nxtlvl as a Claude Code plugin installed via a local marketplace"
---

# ADR-001: Establish the nxtlvl plugin family — three independent plugins, three repos, one shared marketplace

> **Replaces** the original ADR-001 (2026-06-16), which recorded the single-plugin,
> single-repo, local-marketplace-packaging decision. That decision is kept below as history.
> This ADR also **supersedes [ADR-031](ADR-031-labs-in-sandbox-topology.md)**, which placed
> both labs as tracked subdirs inside this repo; the labs now extract to their own repo.
> The "one published plugin" constraint of
> [ADR-036](ADR-036-repo-identity-nxtlvl-harness-only.md) is likewise superseded — this
> repo now publishes one plugin of three in the family.

## Context

`nxtlvl` began as a single Claude Code plugin in a single repo with a single local
marketplace. That was the right shape for a walking skeleton. The build has now expanded
to three distinct, complementary concerns that have different identities, different churn
rates, and different reasons to be installed:

1. **The harness** — `nxtlvl-harness`: the main daily-driver plugin. Context assembly,
   memory, hooks, skills, agents, commands, the audit. This repo
   (`~/Developer/nxtlvl/`). The original ADR-001 subject.

2. **The labs** — `nxtlvl-labs`: a domain-agnostic multi-agent team engine. Collaborates
   with the user through a full production lifecycle — ideation, drafting, testing,
   evaluating — to design and deliver production-quality agent teams against a given
   request. The user brings the domain, the goal, and the request; labs brings the
   architecture, the components, and the production-quality bar.

   Two decoupled Node/TS subprojects power the engine:
   - `harness-lab` — the capability incubation pipeline. Cells (individual capabilities:
     skills, agents, commands, hooks) move through six stages (`develop → review →
     pressure-test → refine → graduation-ready → graduated`) tracked as a manifest
     field, never as a directory location — stage is data, not position. Each cell
     carries pre-declared graduation criteria before building begins (eval-first). Cells
     are dogfooded as project-scoped skills via a `.claude/skills → ../cells` symlink —
     discovered in-session during lab work without touching the daily-driver profile. A
     three-part objective graduation gate (integrity + declared evals pass + intake
     justification present) enforces the production-quality bar; taste never blocks,
     crashes fail open.
   - `evals-lab` — the measurement engine. `{ eval spec } → engine → { scorecard }`,
     fail-closed so a bug can never fake a green light. Serves both the cell graduation
     gate and team-level quality evaluation.

   Lives today at `sandbox/nxtlvl-labs/` in this repo; extracting to its own repo is
   the decision recorded here.

3. **The wiki** — `nxtlvl-wiki`: the agents-wiki MCP server bundled with its knowledge
   corpus. A read-only query interface (MCP server) over the Karpathy-style `llm-wiki`
   knowledge corpus — both corpus and server live together as one plugin. Provides
   queryable, synthesized guidance over reviewed reference harnesses.

These three concerns share a family identity and a common install surface, but they are
**independently installable, independently versioned, and independently evolvable**. Each
has its own churn rate: the harness is the daily driver (stable); the labs are high-churn
by design (active team creation + component incubation pipeline); the wiki is
corpus-growth-driven (append-mostly). Tying them to a single repo and a single release unit
would let labs churn contaminate harness stability and make the wiki a dependent of harness
release cadence — both unacceptable.

The install surface question — how a user (me) discovers and installs any member of the
family — needs a single answer that doesn't require adding a separate marketplace entry
for each repo.

## Decision

**Three plugins. Three repos. One shared marketplace repo.**

### Plugin repos

| Plugin | Repo | Source today | Direction |
|---|---|---|---|
| `nxtlvl-harness` | `will-schaefer/nxtlvl-harness` | `~/Developer/nxtlvl/` | stays here |
| `nxtlvl-labs` | `will-schaefer/nxtlvl-labs` | `sandbox/nxtlvl-labs/` in this repo | extract (git subtree/filter-branch, full history) |
| `nxtlvl-wiki` | `will-schaefer/nxtlvl-wiki` | `~/Developer/llm-wiki/` + planned MCP server | new repo, corpus migrated |

Each plugin repo:
- Carries its own `.claude-plugin/` manifest (or equivalent plugin entry point).
- Manages its own dev/prod separation: sandbox → promote → git-tag-per-promotion,
  independently of the other two.
- Is the single source of truth for its plugin's contents and version history.

### Shared marketplace repo

A new dedicated repo — `will-schaefer/nxtlvl-config` — hosts:
- The `marketplace.json` (or equivalent) listing all three plugin repos as installable
  entries.
- Any shared Claude Code configuration that is family-wide rather than harness-specific.

This is the **single install surface**: `/plugin marketplace add <nxtlvl-config>` and
all three plugins become discoverable and installable from one place. Adding a fourth
family member later is a single line in `nxtlvl-config`'s marketplace file — no new
marketplace add required.

`nxtlvl-config` does **not** carry plugin source. It is a manifest + config repo only.

### Precedence and discovery at runtime

At runtime the three plugins are independent. There is no runtime dependency between
them. `nxtlvl-harness` does not load or depend on `nxtlvl-labs` or `nxtlvl-wiki`;
each operates in its own namespace (`nxtlvl-harness:`, `nxtlvl-labs:`,
`nxtlvl-wiki:`). A user may install any subset.

### nxtlvl-labs extraction

`sandbox/nxtlvl-labs/` is extracted from this repo into `will-schaefer/nxtlvl-labs`
with full git history preserved (git subtree split or filter-repo). After extraction:
- `sandbox/nxtlvl-labs/` is removed from this repo's tracked tree.
- The tracked-subdir topology is superseded by the independent-repo topology.
- The graduation path changes: cells still graduate via `git mv` within `nxtlvl-labs`,
  then the graduated artifact is published/vendored into `nxtlvl-harness` as a
  cross-repo promotion — the clean cross-repo boundary is the correct reflection of
  independent lifecycles.

## Alternatives Considered

### Keep all three in this repo (extend ADR-036's single-plugin constraint)
- Pros: no new repos; shared history; graduation stays an in-repo `git mv` (ADR-031
  preserved).
- Cons: labs churn (high-frequency, deliberately noisy) contaminates harness release
  cadence; wiki corpus growth couples to harness tags; three concerns with divergent
  identities are forced into one release unit; the repo's strict single-purpose identity
  (ADR-036) is violated.
- Rejected: independent lifecycle is the core requirement; a single repo cannot satisfy it.

### Three repos, three separate marketplaces (no config repo)
- Pros: no fourth repo; simplest structure.
- Cons: installing the family requires three separate `/plugin marketplace add` commands;
  adding a fourth plugin later requires the user to know about a new marketplace; the
  family has no single discovery surface.
- Rejected: a shared install surface is a real usability requirement, not a nice-to-have.

### `nxtlvl-harness` hosts the marketplace (extends this repo)
- Pros: one fewer repo; marketplace lives next to the primary plugin source.
- Cons: conflates "I am a plugin" with "I publish the family marketplace" in one repo;
  the harness's release cadence would gate marketplace updates (adding a new family
  member requires a harness release); violates the single-concern identity that ADR-036
  established.
- Rejected: the marketplace is a separate concern and earns its own repo.

### `dotfiles` repo hosts the marketplace
- Pros: reuses an existing repo; one fewer new repo.
- Cons: `dotfiles` is a general terminal/editor config repo; coupling a Claude plugin
  marketplace into it imports a Claude-specific concern into a general-purpose repo and
  blurs both identities.
- Rejected: a plugin family marketplace is not a dotfile.

### Keep `nxtlvl-labs` as tracked subdirs (preserve ADR-031)
- Pros: graduation stays an in-repo `git mv`; sandbox write-allowlist and version-history
  arguments from ADR-031 still hold.
- Cons: those arguments applied when labs and harness shared a lifecycle; with independent
  repos the cross-repo graduation cost is now the correct reflection of a real boundary.
  The labs' independent churn rate justifies the extraction.
- Rejected: ADR-031's rationale was topology-within-one-repo; the decision to have
  independent repos supersedes it.

## Consequences

- **ADR-031 is superseded.** `sandbox/nxtlvl-labs/` will be extracted; the tracked-subdir
  topology it recorded is replaced by the independent-repo topology here.
- **ADR-036's "one published plugin" clause is superseded.** This repo publishes
  `nxtlvl-harness`, one of three. All other ADR-036 decisions stand.
- **Graduation mechanics for nxtlvl-labs.** The incubation pipeline
  (develop → review → pressure-test → refine → graduation-ready → graduated) is the
  internal mechanism for building and validating team components; the three-part graduation
  gate (integrity + declared evals pass + intake justification present) enforces the
  production-quality bar. The final promotion step is now a cross-repo publish/vendor into
  `nxtlvl-harness` rather than an in-repo `git mv` — the clean cross-repo boundary is the
  correct reflection of independent lifecycles. The team creation lifecycle
  (ideation → drafting → testing → evaluating → delivery) is the user-facing process labs
  exposes, distinct from the internal incubation pipeline.
- **`nxtlvl-config` is a new repo to create.** It is the install surface and the
  marketplace; it has no plugin source of its own.
- **`nxtlvl-wiki` is a new repo to create.** The `llm-wiki` corpus migrates into it
  alongside the MCP server to be built.
- **Each plugin manages its own dev/prod separation independently** — sandbox → promote →
  git-tag-per-promotion per repo. No cross-repo promotion coupling.
- **The install ceremony is one command:** `/plugin marketplace add <nxtlvl-config>`,
  then install whichever family members are wanted. Adding future family members is a
  single `nxtlvl-config` manifest edit.
- **Existing ADRs referencing the single-plugin shape** (ADR-001 original, ADR-036)
  are updated in place with supersession notes; they are kept as history per the house
  lifecycle.

---

## Original ADR-001 (2026-06-16) — kept as history

> **Status: Replaced by this ADR (2026-06-27)**

**Decision (original):** Build `nxtlvl` as a Claude Code plugin and install it via a
repo-root local marketplace. Source of truth: `plugins/nxtlvl/` in this repo. Marketplace:
`.claude-plugin/marketplace.json` (name `nxtlvl-dev`) lists `./plugins/nxtlvl`. Install
dance: `/plugin marketplace add <repo>` → `/plugin install nxtlvl@nxtlvl-dev`; iterate
with `/plugin marketplace update nxtlvl-dev`. Promotion = install. Rollback = `git checkout
<previous tag>` + reinstall, with one git tag per promotion. Never hand-edit `~/.claude`
to install the plugin itself.

**Why it was right then:** The walking skeleton needed the thinnest possible packaging
decision. A single plugin, a single repo, a local marketplace was exactly that. It proved
the install mechanism, established the namespace, and defined the promotion/rollback unit —
all before there was enough build to justify a family structure.

**Why it is superseded now:** Three concerns with divergent identities and churn rates have
emerged. The single-repo, single-plugin shape cannot satisfy the independent-lifecycle
requirement without contaminating harness stability with labs churn. The core mechanics
(CC plugin, marketplace-based install, promotion = install, git-tag-per-promotion,
never hand-edit `~/.claude`) carry forward unchanged into each of the three repos.
