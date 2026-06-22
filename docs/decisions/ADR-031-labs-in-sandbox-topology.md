---
id: ADR-031
title: "Labs live as tracked subdirs under Developer/sandbox/nxtlvl-labs/, not as separate repos"
status: Accepted
date: 2026-06-22
implementation: "Build in-progress — agents-lab scaffold is Phase 1 of the plan at docs/plan/nxtlvl-agents-lab-plan.md"
---

# ADR-031: Labs live as tracked subdirs under Developer/sandbox/nxtlvl-labs/, not as separate repos

## Context

`nxtlvl` needed an upstream incubation space — a place where capabilities are built at high
churn under low promotion pressure, pressure-tested to a pre-declared bar, and then graduated
into the `nxtlvl` plugin. The spec at `docs/spec/nxtlvl-agents-lab.md` defines two labs:

- **`agents-lab`** — the incubation lab; capability cells develop here and graduate into
  `plugins/nxtlvl/`.
- **`evals-lab`** — the standing measurement instrument; out of scope for this ADR except
  the topology (designed in a later cycle).

The original design assumed `~/agent-lab` as a **separate git repository**, fully decoupled
from the `Developer` repo. That design surfaced three concrete problems before any build
started:

1. **Write-allowlist gap.** The CC sandbox's write-allowlist covers `Developer/sandbox/` but
   not an external `~/agent-lab`. Every build step that writes to the lab would require
   `dangerouslyDisableSandbox`, defeating safe agentic builds.
2. **Cross-repo graduation hand-off.** Promoting a graduated cell from `~/agent-lab` into
   `Developer/plugins/nxtlvl/` requires a cross-repo copy or submodule dance — fragile,
   version-history-splitting, and easy to get wrong under automation.
3. **Fragmented version history.** Lab cells and the plugin they graduate into would live in
   disconnected git histories, making audit trails and rollbacks harder.

The `Developer` repo already has a `sandbox/` staging tree that is deliberately off the
plugin's discovery path (per `CLAUDE.md`): files there are never auto-loaded, routed to, or
warned about by the live plugin. This same tree is already tracked by `Developer` and inside
the write-allowlist.

The relocation was decided on 2026-06-22, before any lab build began. Both the spec and plan
(plan ◇ D1) carry the re-locked note. The `Developer/nxtlvl-lab` placeholder was already
removed; the empty `sandbox/nxtlvl-labs/{agents-lab,evals-lab}/` directories already exist.

## Decision

Both labs (`agents-lab` and `evals-lab`) are **tracked subdirectories** of the `Developer`
repo, located at:

```
Developer/sandbox/nxtlvl-labs/
  agents-lab/   ← incubation lab
  evals-lab/    ← measurement instrument (designed later)
```

- **No separate `git init`** — both labs share `Developer`'s git history.
- **Not gitignored scratch** — every cell, test, and machinery file is version-controlled.
- **Off the plugin's discovery path** — `sandbox/` is already excluded; in-flight cells are
  never loaded or routed to by the live plugin.
- **In-repo graduation** — a cell promotes by an in-repo `git mv` from
  `sandbox/nxtlvl-labs/agents-lab/cells/<cell>/` to its `target:` under `plugins/nxtlvl/`,
  carrying its `evals/`. No cross-repo hand-off, no history split.
- **Every build step is sandboxed** — the path is inside the CC sandbox write-allowlist, so
  no `dangerouslyDisableSandbox` is needed during the build.

## Alternatives Considered

### Separate repo at `~/agent-lab` (the original design)

- Pros: fully decoupled; could be independently published or archived.
- Cons: outside the sandbox write-allowlist (requires `dangerouslyDisableSandbox` for every
  build step); graduation is a cross-repo copy, splitting version history; separate `git init`
  means lab cells and the plugin they graduate into have disconnected histories.
- Rejected: all three cons are concrete problems that activate immediately at build time; none
  of the pros matter for a solo personal harness.

### Gitignored scratch directory inside `Developer`

- Pros: zero tracking overhead for throwaway experiments.
- Cons: cells, tests, and eval fixtures are lost on clean/reset; graduation to `plugins/nxtlvl/`
  would promote untracked content into a tracked target (version history gap); no audit trail
  for the incubation pipeline.
- Rejected: the lab is not throwaway — cells carry eval cases that must travel on graduation
  and remain regression-guarded in the plugin. Gitignored scratch is the right tool for
  true throwaway experiments (the existing `*-workspace/` convention already serves this).

### Submodule linking `~/agent-lab` into `Developer`

- Pros: both repos visible from `Developer`; some version tracking.
- Cons: submodule mechanics add friction (init, update, detached HEAD); graduation still
  requires a cross-repo copy; write-allowlist problem is unchanged; adds a hard external
  dependency.
- Rejected: adds complexity with no benefit over the plain tracked-subdir approach.

## Consequences

- **Positive:** every build step runs sandboxed; graduation is a single `git mv`; both labs
  share `Developer`'s history and appear in `git log`; cross-lab references (e.g. the
  `agents-lab`↔`evals-lab` seam) are in-repo paths.
- **Constraint:** the `sandbox/` tree must remain off the plugin's discovery path — this is
  already enforced by `CLAUDE.md` and must be maintained if `sandbox/` is ever restructured.
- **Constraint:** adding a third lab follows this same pattern (tracked subdir under
  `sandbox/nxtlvl-labs/`); a deliberate exception requires amending this ADR.
- **Cross-links:** capability cells entering the incubation pipeline carry an intake
  justification per [ADR-008](ADR-008-reactive-growth-intake-gate.md)'s membership rule.
  Graduation uses the objective gate recorded in [ADR-033](ADR-033-three-part-objective-graduation-contract.md).
  The cell architecture is in [ADR-032](ADR-032-cells-installable-as-plugin-architecture.md).
