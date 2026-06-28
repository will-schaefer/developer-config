---
id: ADR-001
title: "Establish the nxtlvl plugin family: three independent plugins, three repos, one shared marketplace"
status: Accepted
date: 2026-06-27
---

# ADR-001: Establish the nxtlvl plugin family — three independent plugins, three repos, one shared marketplace

## Context

`nxtlvl` spans three distinct, complementary concerns that have different identities,
different churn rates, and different reasons to be installed:

1. **The harness** — `nxtlvl-harness`: the main daily-driver plugin. Context assembly,
   memory, hooks, skills, agents, commands, the audit. Lives in this repo
   (`~/Developer/nxtlvl/`).

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

| Plugin | Repo | Concern |
|---|---|---|
| `nxtlvl-harness` | `will-schaefer/nxtlvl-harness` | the daily-driver harness |
| `nxtlvl-labs` | `will-schaefer/nxtlvl-labs` | the multi-agent team engine |
| `nxtlvl-wiki` | `will-schaefer/nxtlvl-wiki` | the reference corpus + MCP server |

Each plugin repo:
- Carries its own `.claude-plugin/` manifest (or equivalent plugin entry point).
- Manages its own dev/prod separation: sandbox → promote → git-tag-per-promotion,
  independently of the other two.
- Is the single source of truth for its plugin's contents and version history.

### Promotion and rollback mechanics

Each plugin is a Claude Code plugin installed via the marketplace. Promotion **is**
install (`/plugin install`); rollback is `git checkout <previous tag>` + reinstall, with
one git tag per promotion. The plugin is never installed by hand-editing `~/.claude`.
These mechanics apply per repo, independently.

### Shared marketplace repo

A dedicated repo — `will-schaefer/nxtlvl-config` — hosts:
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

## Alternatives Considered

### Keep all three in one repo
- Pros: no new repos; shared history; graduation stays an in-repo `git mv`.
- Cons: labs churn (high-frequency, deliberately noisy) contaminates harness release
  cadence; wiki corpus growth couples to harness tags; three concerns with divergent
  identities are forced into one release unit.
- Rejected: independent lifecycle is the core requirement; a single repo cannot satisfy it.

### Three repos, three separate marketplaces (no config repo)
- Pros: no fourth repo; simplest structure.
- Cons: installing the family requires three separate `/plugin marketplace add` commands;
  adding a fourth plugin later requires the user to know about a new marketplace; the
  family has no single discovery surface.
- Rejected: a shared install surface is a real usability requirement, not a nice-to-have.

### `nxtlvl-harness` hosts the marketplace
- Pros: one fewer repo; marketplace lives next to the primary plugin source.
- Cons: conflates "I am a plugin" with "I publish the family marketplace" in one repo;
  the harness's release cadence would gate marketplace updates (adding a new family
  member requires a harness release).
- Rejected: the marketplace is a separate concern and earns its own repo.

### `dotfiles` repo hosts the marketplace
- Pros: reuses an existing repo; one fewer new repo.
- Cons: `dotfiles` is a general terminal/editor config repo; coupling a Claude plugin
  marketplace into it imports a Claude-specific concern into a general-purpose repo and
  blurs both identities.
- Rejected: a plugin family marketplace is not a dotfile.

### Keep `nxtlvl-labs` as tracked subdirs of the harness repo
- Pros: graduation stays an in-repo `git mv`; one sandbox write-allowlist and a shared
  version history.
- Cons: labs and harness would share a release lifecycle; the labs' independent, high
  churn rate justifies a real repo boundary, and the cross-repo graduation cost is the
  correct reflection of that boundary.
- Rejected: independent repos match the real lifecycle boundary.

## Consequences

- **Graduation mechanics for nxtlvl-labs.** The incubation pipeline
  (develop → review → pressure-test → refine → graduation-ready → graduated) is the
  internal mechanism for building and validating team components; the three-part graduation
  gate (integrity + declared evals pass + intake justification present) enforces the
  production-quality bar. The final promotion step is a cross-repo publish/vendor into
  `nxtlvl-harness` — the clean cross-repo boundary is the correct reflection of
  independent lifecycles. The team creation lifecycle
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
