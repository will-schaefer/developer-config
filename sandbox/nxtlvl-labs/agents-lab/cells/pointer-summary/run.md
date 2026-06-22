# Running `pointer-summary` (skill)

How to exercise and dogfood this cell.

## Exercise

1. Declare `graduation_criteria` in `manifest.yaml` **eval-first** (before building).
2. Add eval cases under `evals/`.
3. Run the evals: `npm run eval -- pointer-summary`
4. Run the gate:  `npm run graduate -- pointer-summary`

## Dogfood

Install the lab as a plugin in a scratch profile (see `docs/plugin-manifest-reference.md`),
then invoke this skill on a real task and record what happened here.
