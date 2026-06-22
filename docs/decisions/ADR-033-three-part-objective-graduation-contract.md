---
id: ADR-033
title: "Graduation requires all three objective criteria: integrity, declared-evals pass, and intake justification present"
status: Accepted
date: 2026-06-22
implementation: "Build in-progress — the graduation gate (graduate.js) is Phase 2 keystone task T8 in the plan at docs/plan/nxtlvl-agents-lab-plan.md"
---

# ADR-033: Graduation requires all three objective criteria: integrity, declared-evals pass, and intake justification present

## Context

`agents-lab` (topology: [ADR-031](ADR-031-labs-in-sandbox-topology.md); cell architecture:
[ADR-032](ADR-032-cells-installable-as-plugin-architecture.md)) is the incubation lab for new
`nxtlvl` capabilities. The lab needs a graduation gate — a binary check that determines
whether a cell may promote via `git mv` into `plugins/nxtlvl/`.

The general shape of a promotion gate for `nxtlvl` was decided in
[ADR-009](ADR-009-objective-invoked-audit-gate.md): **objective, binary, invoked** (not a
continuous hook, not a taste score). ADR-009 deferred the concrete rubric because the harness
didn't yet exist to be measured. `agents-lab` is where the first concrete gate is built, and
the three criteria it must enforce need to be decided up front — before the gate is coded —
because they shape the cell manifest schema, the eval-first discipline, and the lab's entire
pressure-test pipeline.

Two failure modes were identified that the gate must avoid (mirroring ADR-009's analysis):

1. **Encoding taste as a blocker.** A gate that blocks on "not high enough quality" or "not
   idiomatic enough" effectively encodes a style preference as a hard stop, which is
   arbitrary and creates chilling effects on experimentation. The gate is for the incubation
   lab, the highest-churn tier — taste should never be the thing that blocks a graduation.
2. **A crash masquerading as a block.** If the gate script throws an unhandled exception and
   exits non-zero, a valid cell gets falsely blocked. The two-failure-paths doctrine (the
   house hook-safety rule from ADR-006) applies: a script *erroring* must always fail open
   (exit 0, do nothing); a script *deciding to block* must be a clean, deliberate exit 2. A
   crash must never reach the caller as a block.

The gate is the lab's analog of the still-unbuilt `nxtlvl:audit` from ADR-009 — the first
concrete instantiation of the objective-gate doctrine at the lab tier.

## Decision

A cell graduates only when **all three** objective criteria pass. The gate (`bin/graduate.js`)
enforces exactly these three, each binary (pass/fail or presence), and nothing else:

**1. Integrity.** Frontmatter parses, all files are well-formed, no dead references, hooks
exit 0 on a smoke test, no secrets. This is a mechanical checklist with no taste component.

**2. Declared evals pass.** The `evals-lab` scorecard meets the `graduation_criteria` the
cell declared in its `manifest.yaml` **before building** (eval-first). Because the criteria
are pre-committed, the bar is falsifiable and fixed — the gate is comparing a result against
a contract, not making a judgment.

**3. Intake justification present.** The manifest's `intake:` block exists and is non-empty —
presence is checked, quality is not judged. This is the ADR-008 membership record: a written
note of what task required the capability and what existing thing fell short.

Taste and quality observations are collected and emitted as **warnings on stderr** but never
contribute to a block. The exit-code contract is strict:

```
exit 0  — all three criteria pass (warnings allowed on stderr)
exit 2  — at least one criterion failed (the specific blocker(s) named on stderr)
```

Any unhandled exception is caught and forces **exit 0** (fail-open, never a fake block). This
gives two clean, distinguishable failure paths:
- A script *erroring* → exit 0 (fail-open).
- A script *deciding to block* → exit 2 (deliberate, named).

The gate is **regression-locked** by `bin/graduate.test.js`: one block-bad + pass-clean pair
per criterion (three pairs), a taste-only-warns test, and a crash-fails-open test — the same
discipline used to lock the `dangerous-bash` gate.

## Alternatives Considered

### A quality/taste score as an additional blocker

Add a fourth criterion: a score (e.g. from a model-graded review or a rubric) above some
threshold.

- Pros: catches low-quality cells that pass all three mechanical criteria.
- Cons: taste encoded as a hard blocker is the exact failure mode ADR-009 identified and
  rejected. A score that varies by reviewer or model version makes the gate non-objective and
  non-reproducible. The lab's `review` and `pressure-test` stages already surface quality
  concerns — by the time a cell reaches the gate, taste issues have had multiple chances to
  be addressed.
- Rejected: violates the objective-gate doctrine (ADR-009). Taste observations belong in
  warnings, never in blockers.

### Fewer criteria — integrity check only

Gate on integrity alone; skip eval and intake checks.

- Pros: simpler gate; fewer scaffolding requirements on each cell.
- Cons: removes the eval-first discipline that is the lab's core pressure-test mechanism. A
  cell with no declared evals, or one that fails its own declared bar, can graduate silently.
  Also removes the membership check, allowing cells with no justification to enter `plugins/nxtlvl/`
  without any written rationale — contradicting the reactive-growth discipline (ADR-008).
- Rejected: eval-first and intake justification are load-bearing constraints that keep the lab
  from becoming an uncontrolled accumulation point.

### More criteria — require a human sign-off flag in the manifest

Add a fourth criterion: a `human_approved: true` flag that must be hand-set.

- Pros: explicit human checkpoint.
- Cons: the flag is trivially satisfied (just set it to `true`), so it provides no real
  constraint; it turns a binary gate into a social convention with no enforcement. The plan
  already marks T12 (install + dogfood) and T13 (graduate) as `🧑` manual gates — the human
  checkpoint is in the *process*, not in the gate's exit-code contract.
- Rejected: a flag that can be trivially set without evidence is security theater, not a gate.

### Crash → exit 2 (strict: any error is a block)

Treat an exception as a deliberate block rather than failing open.

- Pros: no capability graduates if the gate itself is broken.
- Cons: a gate script bug would silently block every cell in the lab, including clean ones.
  The resulting false blocks would erode trust in the gate — the team (of one) would learn to
  ignore it or bypass it. The two-failure-paths rule is clear: crashes are not blocks.
- Rejected: the goal is a trustworthy gate, not a strict one. A gate that lies is worse than
  no gate. Fail-open on error preserves the distinction between "the gate says no" and "the
  gate broke."

## Consequences

- **Positive:** the graduation bar is objective, reproducible, and stated before the cell is
  built — it cannot be inflated retroactively to block a cell the gate-runner dislikes, nor
  deflated to let a weak cell through.
- **Positive:** the crash-fails-open contract means a gate bug never silently traps valid
  cells; the regression tests mean a gate regression is caught before it affects real cells.
- **Constraint:** `graduation_criteria` must be written in the manifest **before** building the
  cell (`eval-first` discipline). The gate reads the criteria the cell declared; it does not
  accept criteria added after the fact. This is an "always" boundary in the spec.
- **Constraint:** changing any of the three gate criteria (adding, removing, or redefining one)
  is an "ask first" boundary in the spec — and would require amending this ADR — because it
  changes the contract every existing cell was scaffolded against.
- **Cross-links:** honors the objective-gate doctrine of [ADR-009](ADR-009-objective-invoked-audit-gate.md)
  (objective, binary, invoked; taste never blocks). The intake-justification criterion is the
  ADR-008 membership record ([ADR-008](ADR-008-reactive-growth-intake-gate.md) — the intake-gate
  rule survives ADR-008's supersession by ADR-013 and is restated there). The fail-open
  exit-code contract follows the hook-safety doctrine of
  [ADR-006](ADR-006-hook-fail-open-gated-blocking.md). The cell manifest that carries the three
  checkable fields is defined in [ADR-032](ADR-032-cells-installable-as-plugin-architecture.md).
  The lab topology that makes graduation an in-repo `git mv` is in
  [ADR-031](ADR-031-labs-in-sandbox-topology.md).
