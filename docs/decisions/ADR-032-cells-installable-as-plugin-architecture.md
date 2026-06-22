---
id: ADR-032
title: "Capability cells use stage-as-data manifests; in-flight cells are dogfooded as project skills"
status: Accepted
date: 2026-06-22
implementation: "Built 2026-06-22 (T4/T6 cell architecture + manifest). The dogfood half was AMENDED the same day — see the Amendment section: the lab is NOT a standalone plugin; cells dogfood as project-scoped skills via .claude/skills → ../cells."
---

# ADR-032: Capability cells use stage-as-data manifests; in-flight cells are dogfooded as project skills

> **Amendment (2026-06-22) — dogfooding is via project skills, NOT a standalone lab plugin.**
> The original decision (recorded below, retained as history) made `agents-lab` installable as its
> own CC plugin via a lab-local `.claude-plugin/` + a local marketplace. **This half is reversed.**
> `agents-lab` is a development workspace inside the nxtlvl repo, not a distributable plugin; a
> separate `nxtlvl-agents-lab` plugin identity competes with the one plugin we are building.
> **Replacement:** the lab is a live CC **project**, and `.claude/skills` is a **symlink to
> `../cells`**, so each skill-type cell (`cells/<name>/SKILL.md`) is auto-discovered as the
> project skill `/<name>` when the lab is the working directory — no install, no marketplace, no
> second plugin identity, zero file duplication. Project-skill discovery walks *upward* from the
> cwd, so cells never leak into the main Developer session. The verified CC mechanics (project
> skills live at `.claude/skills/<name>/SKILL.md`; no settings override for the path; symlinks are
> followed) are recorded in the lab's `docs/` / `.claude/README.md`. The **stage-as-data** half of
> this ADR is unchanged. Files removed: `agents-lab/.claude-plugin/plugin.json` and the
> `sandbox/nxtlvl-labs/.claude-plugin/marketplace.json` local marketplace.
>
> *Why the change is safe:* the dogfood *goal* (validate a cell's runtime discovery/routing before
> graduation) is still met — project-skill discovery is the same routing path the graduated skill
> uses inside the nxtlvl plugin, minus the redundant separate-plugin install. The "No dogfood
> install" alternative below is NOT what we adopted; project-skills is a third option that gives
> real in-session discovery without a second plugin.

## Context

`agents-lab` (see [ADR-031](ADR-031-labs-in-sandbox-topology.md) for topology) incubates
one capability at a time. Two design questions had to be settled before any scaffolding:

**1. How does a cell track its progress through the pipeline?**

Capabilities move through six stages: `develop → review → pressure-test → refine →
graduation-ready → graduated`. The obvious structural approach is to use the filesystem as
state — move the cell into a directory named after its current stage (e.g. `develop/`,
`review/`, etc.). This is a pattern seen in many pipelines.

The problem is that **files-as-state** ties the cell's logical position to its physical
location. Every advancement requires a rename/move, invalidating relative paths, breaking
any tooling that references the cell by path, and complicating `git log` (renames are harder
to follow than in-place edits). It also makes the ledger — the single-glance view of all
cells — dependent on the directory structure rather than on a stable, parseable contract.

**2. How is dogfooding achieved before a cell graduates?**

High-fidelity dogfooding (exercising the cell on a real task inside the live CC runtime)
requires the capability to be discoverable in-session. A cell under `sandbox/` is explicitly
off the plugin's discovery path (per `CLAUDE.md` and [ADR-031](ADR-031-labs-in-sandbox-topology.md)).
Simply dropping a capability file there is not enough to dogfood it.

The CC plugin system allows a local directory to be installed as a plugin via the local
marketplace. A lab-local `.claude-plugin/` manifest would make the whole lab installable into
a separate scratch profile, where cells are discoverable and invocable — without touching the
daily-driver profile.

## Decision

**Stage is data, never location.** Every cell is a single stable directory at
`cells/<capability>/` for its entire lifecycle. Its `manifest.yaml` carries a `stage:` field
that is the only thing that changes as the cell advances:

```yaml
# cells/example-skill/manifest.yaml
name: example-skill
type: skill         # skill | agent | command | hook
stage: develop      # develop | review | pressure-test | refine | graduation-ready | graduated
intent: >
  One-paragraph statement of purpose and why this capability should exist in nxtlvl.
intake:             # ADR-008 membership: presence is gate-checked, quality is not
  task: "the task that required this capability"
  failed: "the existing thing that fell short"
graduation_criteria:  # eval-FIRST: declared before building; the gate measures against these
  - id: trigger-accuracy
    bar: ">= 0.9 on the declared trigger set"
  - id: behavioral
    bar: "all behavioral eval cases pass"
deps: []
target: plugins/nxtlvl/skills/example-skill  # in-repo destination on graduation
```

`ledger.md` is generated by `bin/ledger.js` from all manifests — it is the single-glance
view and is always regenerated, never hand-edited.

**The lab is installable as a CC plugin.** A `.claude-plugin/` manifest at the lab root
makes the lab installable via the local marketplace into a scratch profile. In that profile,
cells are discoverable and invocable in-session — providing high-fidelity dogfooding before
graduation. This install does not touch the daily-driver profile. The exact plugin manifest
shape and install command are confirmed against current CC docs at build time (T2 in the
plan), not from memory.

## Alternatives Considered

### Directories as stage (files-as-state)

Structure: `develop/<cell>/`, `review/<cell>/`, `pressure-test/<cell>/`, etc. Cell
advances by `git mv` between stage directories.

- Pros: stage is visible from directory listing with no tooling; no YAML required.
- Cons: every advancement invalidates relative paths and breaks tooling references; `git log`
  shows renames rather than in-place edits, making history harder to follow; the ledger can't
  be generated from a stable contract — it must walk the stage directories; the graduation
  `git mv` becomes ambiguous (a second move, inside the lab, on top of the promotion move).
- Rejected: files-as-state is the specific anti-pattern the spec names. Stage is an attribute
  of the cell, not a property of its location.

### No dogfood install (rely on manual invocation only)

Don't ship a `.claude-plugin/` manifest; exercise cells by manually loading them in-session
via explicit paths.

- Pros: simpler lab structure; no plugin wiring to maintain.
- Cons: manual invocation doesn't replicate the production discovery and routing path; bugs
  in how a cell registers as a skill/command/hook are invisible until after graduation, when
  they land in the daily driver. Dogfooding is a first-class test level in the spec precisely
  because the runtime behaviour must be validated before promotion.
- Rejected: the gap between "manually loaded" and "installed and routed by the plugin system"
  is exactly the failure mode that reaches the daily driver. The spec's pressure-test pillar
  requires real-task dogfooding in the installed runtime — a stub for this is not acceptable.

### Per-cell plugin manifests (one plugin per cell)

Each cell ships its own `.claude-plugin/` so it can be installed and uninstalled independently.

- Pros: more granular install/uninstall.
- Cons: a scratch profile would require installing each cell separately; the overhead scales
  with the number of cells; the graduation check (`graduate.js`) still operates at the lab
  level, not per plugin. The point of dogfooding is to exercise the cell's behavior in a real
  session, not to simulate isolated plugin installs.
- Rejected: one lab-level install covers the dogfood use case; per-cell manifests add
  management overhead with no material benefit.

## Consequences

- **Positive:** cell paths are stable across their entire lifecycle; `git log` on a cell shows
  a clean in-place history; `ledger.md` is generated from a single parseable contract
  (manifest) rather than from directory structure; high-fidelity dogfooding is available
  before graduation.
- **Constraint:** the `manifest.yaml` schema is the contract that all three machinery scripts
  (`new-cell.js`, `ledger.js`, `graduate.js`) depend on. Changes to the schema are a breaking
  change to the contract and to all cells that have been scaffolded — treat schema changes as
  an "ask first" boundary.
- **Constraint:** dogfood install uses the CC local-marketplace mechanism; the plugin manifest
  shape must be re-confirmed against live CC docs (not memory) at each significant CC version
  change. The confirmed shape is recorded in the lab's `docs/` at build time.
- **Cross-links:** the intake field in each manifest is the ADR-008 membership record checked
  by the graduation gate ([ADR-033](ADR-033-three-part-objective-graduation-contract.md)).
  The lab topology that makes in-repo `git mv` graduation possible is in
  [ADR-031](ADR-031-labs-in-sandbox-topology.md). The graduation gate that reads the manifest
  fields is in [ADR-033](ADR-033-three-part-objective-graduation-contract.md).
