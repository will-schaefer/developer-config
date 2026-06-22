---
name: nxtlvl-dangerous-bash-gate
description: "dangerous-bash gate BUILT & LIVE; blocks force-push to main/master, root rm, curl|sh, dd/mkfs, chmod-777, fork bomb. The old `git branch -f main` false-positive is FIXED (gate now requires `git push`) and regression-locked by dangerous-bash.test.js (53 node:test cases — the gate's first test)."
metadata: 
  node_type: memory
  type: project
  originSessionId: f01862cc-005f-4a53-9577-f8f3179c3f8f
---

The harness's **first blocking gate** is built: `plugins/nxtlvl/hooks/dangerous-bash.js` +
a new `Bash`-matcher block in `hooks.json` (id `pre:dangerous-bash`). Blocks (`exit 2`) a
narrow high-confidence catastrophic set (root-ish `rm -rf`, force-push to main/master,
`curl|sh`, `dd`/`mkfs`/`>` to a block device, `chmod -R 777` broad, fork bomb); **warns**
(exit 0 + stderr) on `git reset --hard` / `git clean -f…`. Kill switch `NXTLVL_DANGEROUS_BASH=off`.

Locked build decisions (the gate-backlog's 3 open questions): **Node** parse (not bash+jq —
robust on quoted/escaped commands, reuses [[nxtlvl-context-alert-hook]]'s node precedent, no jq
dep); **warn** on reset/clean; raw-string matching (a known, deliberate trade-off — `echo
'rm -rf /'` also trips it, accepted because stripping quotes would let `bash -c 'rm -rf /'` slip).

**Why:** proves the `exit 2` gate mechanism end-to-end (the precedent for config-protection next)
under [[nxtlvl-harness]]'s ADR-006 fail-open-on-error-absolute contract.
**How to apply:** smoke matrix + fault-injection both PASS (agent-scriptable). Full record in `docs/plan/nxtlvl-hook-gate-backlog.md`.

**LIVE & confirmed firing (2026-06-18):** installed and blocked a real command in a working session.

**Historical false-positive — NOW FIXED:** on 2026-06-18 a harmless local `git branch -f main` was
rejected as "force-push to a protected branch." The gate was since narrowed — `detectForcePush`
(`dangerous-bash.js:91`) now **requires `git push`** before considering force-on-main, so `git
branch -f main` is allowed again and the `git fetch origin <b>:<b>` workaround is no longer needed.

**Regression-locked (2026-06-21):** `plugins/nxtlvl/hooks/dangerous-bash.test.js` — 53 zero-dep
`node:test` cases (block · false-positive-allow · warn · fail-open · kill-switch), the gate's
**first test** (it was the only untested hook; `decide()` + detectors were built testable but never
tested). A mutation check (delete the push-verb guard) reds *exactly* the `git branch -f main` case,
proving the suite bites. Built as approach **A** (flat test) of an evals exploration; the corpus +
grader shapes (C → audit-attached per ADR-019 §4 / ADR-009) remain available and the inline cases
lift straight into a corpus. See [[adrs-advisory-not-canonical]] — ADR-019 deferred standing suites.

**Standing raw-string trade-off:** the gate matches the command *string*, so a command that merely
*describes* a dangerous op (a comment/heredoc mentioning `git push … main`, or `echo 'rm -rf /'`)
trips it — hit live again 2026-06-21 while scripting the mutation check. The kill switch
(`NXTLVL_DANGEROUS_BASH=off`, in the hook's env — not inline) is the escape hatch.
