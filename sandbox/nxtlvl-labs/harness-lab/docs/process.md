# `agents-lab` process

Lab-local conventions for incubating a capability cell from conception to graduation.

## Lifecycle

```
develop → review → pressure-test → refine (loop) → graduation-ready → graduated
```

`stage:` is a manifest field, not a directory (ADR-032 stage-as-data). Advance a cell by editing
`manifest.yaml stage:` and regenerating `ledger.md` (`npm run ledger`).

### The stages

1. **develop** — author the capability. Its `graduation_criteria` were declared **eval-first**
   (before building), so the bar is falsifiable and pre-committed.
2. **review** — self/`nxtlvl:review` pass over the cell.
3. **pressure-test** — the emphasized pillar. Stack independent lenses; the cell only advances
   when it survives the stack **against its pre-declared bar**:
   1. the cell's own declared evals (trigger accuracy, behavioral);
   2. `evals-lab`'s general battery (via the seam — stubbed until evals-lab exists);
   3. an adversarial / GAN loop;
   4. a `nxtlvl:doubt-driven-development` adversarial review;
   5. real-task dogfooding in the installed runtime.
4. **refine** — loops back to **pressure-test** until the bar is met (never a subjective "looks
   good enough").
5. **graduation-ready** — passes `npm run graduate` locally; awaiting promotion.
6. **graduated** — promoted by in-repo `git mv` to `target:` under `plugins/nxtlvl/`, evals in tow.

## The graduation gate

See [`../README.md`](../README.md#the-graduation-gate-bingraduatejs) and ADR-033. Three objective
blockers; taste warns only; exit 2 = block, exit 0 = pass, a crash fails open.

## Boundaries (from the spec)

- **Always:** declare `graduation_criteria` before building (eval-first); keep `stage` as manifest
  data; treat `vendor/` as read-only; ensure a cell's `evals/` travel with it on graduation; keep
  gate criteria objective.
- **Ask first:** changing the three gate criteria; changing the lab↔evals-lab seam contract;
  adding a new cell `type`; re-syncing `vendor/`; retiring `sandbox/`'s staging role.
- **Never:** hand-edit `vendor/`; graduate a cell failing any gate criterion; commit secrets;
  encode taste as a *blocking* criterion; let a crash masquerade as a deliberate block.
