# `agents-lab` — the agent-capability incubation pipeline

> Ships as `nxtlvl:agents-lab`. A self-contained R&D workspace where new agent
> capabilities — skills, agents, commands, hooks — are **incubated to production
> quality and then graduate into the `nxtlvl` plugin.**

Spec: [`docs/spec/nxtlvl-agents-lab.md`](../../../docs/spec/nxtlvl-agents-lab.md) ·
Plan: [`docs/plan/nxtlvl-agents-lab-plan.md`](../../../docs/plan/nxtlvl-agents-lab-plan.md) ·
Decisions: [ADR-031](../../../docs/decisions/ADR-031-labs-in-sandbox-topology.md) ·
[ADR-032](../../../docs/decisions/ADR-032-cells-installable-as-plugin-architecture.md) ·
[ADR-033](../../../docs/decisions/ADR-033-three-part-objective-graduation-contract.md)

## The 3-tier promotion ladder

```
agents-lab                       →   nxtlvl plugin        →   installed ~/.claude
(sandbox/nxtlvl-labs/, highest       (the workbench,           (stable daily driver)
 churn, lowest pressure)              Developer repo)
```

This lab lives **inside** the `Developer` working tree at `sandbox/nxtlvl-labs/agents-lab/`,
under the off-discovery `sandbox/` staging tree — so in-flight cells are never loaded,
routed to, or warned about by the live plugin. It is tracked by the `Developer` repo (not a
separate repo). Graduation is an **in-repo `git mv`** from a cell to its `target:` under
`plugins/nxtlvl/`, carrying the cell's `evals/`.

## The unit of work: a cell

A **cell** is one incubating capability, living at `cells/<capability>/`:

```
cells/<capability>/
  manifest.yaml   # intent · type · stage · deps · graduation_criteria · intake · target
  <capability>    # SKILL.md | agent .md | command .md | hook(s)
  evals/          # the cell's own eval cases — TRAVEL with it on graduation
  run.md          # how to exercise/dogfood this cell
```

**Stage is data, never location.** A cell never moves directories as it matures — its
`stage:` field changes (`develop → review → pressure-test → refine → graduation-ready →
graduated`), and `ledger.md` is regenerated.

## Commands

```
Scaffold a cell:     node bin/new-cell.js <name> --type=skill|agent|command|hook
Run a cell's evals:  npm run eval -- <cell>          # delegates to evals-lab via the seam (stubbed)
Graduation check:    npm run graduate -- <cell>      # the objective gate; exit 2 = block, 0 = pass/warn
Update/view ledger:  npm run ledger                  # regenerates ledger.md from all manifests
Test the machinery:  npm test                        # node --test 'bin/*.test.js'
Dogfood a cell:      work with agents-lab as your project dir → skill cells load as project skills
                     (via .claude/skills -> ../cells). No plugin install; the lab is not a plugin.
```

## The graduation gate (`bin/graduate.js`)

A cell graduates only when **all three** objective criteria pass — each pass/fail or
presence, never a taste judgment (honors ADR-009):

1. **Integrity** — frontmatter valid, files parse, no dead refs, hooks exit 0 on a smoke
   test, no secrets.
2. **Declared evals pass** — the evals-lab scorecard meets the cell's pre-declared
   `graduation_criteria` (eval-first).
3. **Intake justification present** — the ADR-008 membership record exists (presence, not
   quality).

Taste/quality observations are surfaced as **warnings**, never blockers. Exit-code contract:
`exit 0` = pass (warnings allowed on stderr), `exit 2` = deliberate block. A crash/exception
**fails open** (exit 0) — it must never masquerade as a block.

## Layout

```
cells/         the incubating capabilities (one cell each)
vendor/        pinned snapshot of the authoring toolkit (read-only; re-sync only — see vendor/SOURCES.md)
bin/           lab machinery: new-cell · eval · graduate · ledger (+ *.test.js, lib/)
docs/          lab-local process, conventions, seam contract, manifest reference
inbox.md       lab-local intake queue (seeded from Developer backlogs)
ledger.md      generated single-glance view: every cell + its stage
.claude/       makes the lab a live CC project; .claude/skills -> ../cells exposes skill cells
               as project skills for in-session dogfooding (NOT a standalone plugin — see ADR-032)
```
