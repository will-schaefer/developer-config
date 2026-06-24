# `agents-lab` intake queue

> The lab-local queue of capability candidates. Seeded once (2026-06-22) from the Developer
> backlogs as **pointers, not copies** — the backlogs remain the source of truth; this file is
> the lab's working shortlist. A candidate becomes a cell via `node bin/new-cell.js`.

## Sources (pointers — read these, don't duplicate them here)

- **Skill intake backlog** → [`docs/plan/nxtlvl-skill-intake-backlog.md`](../../../docs/plan/nxtlvl-skill-intake-backlog.md)
  — the ADR-008 reactive-growth queue: capabilities that earned their way in by a task that
  needed them and an existing thing that fell short.
- **Harness adopt/adapt backlog** → [`docs/plan/nxtlvl-harness-adopt-backlog.md`](../../../docs/plan/nxtlvl-harness-adopt-backlog.md)
  — the cross-harness staging ledger: ADOPT/ADAPT rows from every `/harness-review`, grouped by
  target surface, each with a stable ID. Architectural+expensive adopts graduate to ADRs.

## How a candidate enters the lab

1. Pick a row from a source above (or a fresh need that meets the ADR-008 intake bar).
2. `node bin/new-cell.js <name> --type=skill|agent|command|hook`.
3. Fill the cell's `manifest.yaml` `intake:` (task + what fell short) and declare its
   `graduation_criteria` **eval-first** (before building).
4. Build, advance `stage:`, regenerate `ledger.md`, and gate with `npm run graduate`.

## Lab shortlist (working — add candidates here as they're pulled forward)

_(none yet — seed entries as cells are conceived)_
