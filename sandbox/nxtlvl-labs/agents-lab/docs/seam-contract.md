# Lab ↔ evals-lab seam contract

> The single interface that keeps `agents-lab` and the (later) `evals-lab` decoupled. This spec
> fixes only the **shape** — `{ eval spec } → engine → { scorecard }`. The concrete scoring is
> co-designed with the `evals-lab` cycle. Until that engine exists, `bin/eval.js` backs the seam
> with a **deterministic stub** that returns a scorecard in exactly this shape. `bin/graduate.js`
> reads the scorecard and **must not know** whether a stub or the real engine produced it.

```
{ eval spec }  ──→  evals-lab engine (stubbed)  ──→  { scorecard }
```

## Eval spec (input)

Built by `bin/eval.js` from the cell's `manifest.yaml` + `evals/`:

```jsonc
{
  "cell": "example-skill",
  "criteria": [                       // verbatim from manifest.graduation_criteria
    { "id": "trigger-accuracy", "bar": ">= 0.9 on the declared trigger set" },
    { "id": "behavioral",       "bar": "all behavioral eval cases pass" }
  ],
  "cases": {                          // from evals/cases.yaml — keyed by criterion id
    "trigger-accuracy": { "stub_result": "pass", "score": 0.95, "detail": "12/12 matched" },
    "behavioral":       { "stub_result": "pass", "score": 1.0,  "detail": "all cases passed" }
  }
}
```

### `evals/cases.yaml` (authored per cell)

A mapping of **criterion id → case**. The stub engine *echoes* `stub_result`; the real engine
will *compute* it from the case definition. `score` and `detail` are provenance carried through.

```yaml
trigger-accuracy:
  stub_result: pass        # pass | fail  (stub echoes this; real engine computes it)
  score: 0.95
  detail: 12/12 declared trigger cases matched
behavioral:
  stub_result: pass
  score: 1.0
  detail: all behavioral cases passed
```

## Scorecard (output)

```jsonc
{
  "cell": "example-skill",
  "engine": "stub",                   // "stub" now; "evals-lab@<version>" later
  "results": [                        // one per declared criterion, in declaration order
    { "id": "trigger-accuracy", "passed": true, "score": 0.95, "detail": "12/12 matched" },
    { "id": "behavioral",       "passed": true, "score": 1.0,  "detail": "all cases passed" }
  ],
  "summary": { "total": 2, "passed": 2, "failed": 0, "allPassed": true }
}
```

## Rules the seam guarantees

- **Coverage:** the scorecard has exactly one `results[]` entry per declared `graduation_criteria`
  id (declaration order). A criterion with no eval case → `passed: false`, detail
  `"no eval case declared"` (a missing eval is a failure, never a silent pass).
- **Determinism:** `score(spec)` is pure — same spec in, same scorecard out. No timestamps in the
  scorecard, so it is byte-stable and golden-testable.
- **Gate consumption:** `graduate.js` criterion 2 ("Declared evals pass") reads `summary.allPassed`
  *and* re-checks that every declared criterion id appears as a passed result — it does not trust a
  summary alone.
- **Changing this seam is an "ask first" boundary** (spec §Boundaries). The `evals-lab` cycle will
  replace the stub engine while preserving this scorecard shape.
