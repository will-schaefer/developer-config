# Plan: nxtlvl Context-&-Memory spec amendments (from design doubt-test)

> **Scope:** edit `docs/spec/nxtlvl-context-memory-lifecycle.md` + the ADRs it touches.
> **No code.** This is a documentation/design amendment pass. ADRs are advisory →
> record amending/superseding ADRs via `nxtlvl:doc-keeper`, don't treat them as binding.
> Anchor (not relitigated): `docs/intent/personal-harness.md`.
> Branch: `fix/adr-007-amended-by-graph` (baseline ADR-integrity already fixed + committed `41681f3`).
> Numbering: floor-on-demand backbone = **ADR-013**, confident-core = **ADR-016**.

## Source
Ten findings from a doubt-driven review of the spec (3 must-fix live contradictions,
5 cheap refinements, 2 trade-offs to record). Each finding already carries its minimal fix
and the ADR it touches; this plan only *sequences* them.

## Dependency graph

```
T1 (§7 fail-open carve-out: liveness + atomicity + secret-invariant)   ← FOUNDATION
   ├── T3 (scrubber fail-closed)        depends on T1's secret-invariant clause
   └── T4 (atomic write)                depends on T1's write-atomicity clause
T2 (§4.2 remember-this → native; amend ADR-004)          ─┐ both touch §4.2 capture;
T3 (§4.2/§7 scrubbing honest scope)                       ─┘ land T2 then T3 to avoid churn
T4 (§5/X4 identity + observer concurrency; NEW ADR?)     ─┐ both touch §5 storage;
T5 (§5/X6 store outside sync roots)                       ─┘ land together
T6 (X1 size gate: count OR effect)        independent (small)
T7 (§4.4/§9 staleness honesty)            independent (small; decision point)
T8 (§6/§4.1 nudge names truncated insts; refine ADR-013) independent
T9 (ADR-013 rationale: strike ecc-faithful for graduation-trigger)  depends on T8 (mitigation ref)
T10 (X2 trade-off recorded; probation flag deferred)     independent
DOC (doc-keeper: record all ADR amendments in house format, update index, re-verify)  ← LAST
```

**Vertical slices, not horizontal layers:** each task lands its spec edit *and* its ADR
amendment *and* any cross-reference/index update together, so every task leaves the doc set
internally consistent and independently reviewable.

## Decision points (resolve at the marked checkpoints, not now)
- **D1 (T4):** is identity+concurrency a **new ADR** or a consequence-amendment to ADR-013(floor)?
  *Recommend a new ADR* — it's an expensive-to-reverse correctness decision (identity key is
  irreversible once instincts persist). ADR-worthy by the project's own threshold.
- **D2 (T7):** **soften the §4.4 claim only**, or also **build heal-on-close**?
  *Recommend soften-now + record heal-on-close as the preferred deferred option* (YAGNI: no
  evidence of repeat pain yet; the cheap honesty fix removes the overstatement immediately).
- **D3 (T10):** build the **probation flag**, or **document the trade-off only**?
  *Recommend document-only* (the ≥0.7 reinforcement bar + decay already bound the blast radius;
  the flag is reactive-growth material — build it if/when a wrong-confident instinct actually burns a session).

## Phases, tasks, acceptance criteria

### Phase A — Foundational invariant
**T1 — §7 fail-open carve-out.** Add a clause: *"fail-open means never HALT the session; it does
NOT waive (a) a one-line liveness/heartbeat record, (b) write-atomicity on shared stores, (c) the
secret invariant — a scrub failure DROPS the observation, never persists it raw."* Add a clarifying
note to **ADR-006** (carve-out, not reversal) + cross-ref.
- *Acceptance:* §7 no longer lets "error → do nothing" persist an unscrubbed observation; the silent-
  observer-death path now has a liveness record; ADR-006 note present and dated.
- *Verify:* re-read §7 end-to-end — the fail-open rule and the secret invariant no longer contradict;
  trace a scrubber exception → observation dropped, session not halted.

**→ CHECKPOINT 1:** review the invariant wording before building dependents (T3, T4 lean on it).

### Phase B — Memory model + capture (§4.2)
**T2 — remember-this provenance routing.** §4.2: *"remember this" writes directly to native file-memory,
bypassing the observer/instinct path*; provenance (human-typed vs observer-inferred) is the ownership
boundary. Update the §5 "two homes" note. **Amend ADR-004** (replace "tracked, not built" with the
provenance rule). *Do not collapse the two physical stores* (the separate store is forced by CC's
sensitive-path guard).
- *Acceptance:* a "remember this" lesson lands in native memory (no decay, no ≥0.7 gate); ADR-004
  amended + dated; §5 note reflects provenance ownership.
- *Verify:* trace "remember this: X" → native memory, surfaced next briefing regardless of confidence.

**T3 — secret-scrubbing honest scope.** §4.2/§7: call scrubbing **best-effort** (drop "never persist"
absolute), scrub tool **output** too (not just input), add an **entropy redactor** over named-format
regexes, and **fail closed** (per T1).
- *Acceptance:* §4.2/§7 describe best-effort + output coverage + fail-closed; no "non-negotiable…never
  persist" absolute remains.
- *Verify:* trace a `.env` echoed in tool *output* → redacted or observation dropped; scrub-failure path
  drops, doesn't persist. *(depends on T1)*

### Phase C — Storage + observer concurrency (§5)
**T4 — identity + concurrency.** §5/X4: define **project identity = git common-dir** (worktrees share,
clones don't), folder fallback off-git; specify **atomic write (tmp + rename)** for instinct files and a
**per-session single-flight guard** before spawning the observer. X4 stops being "resolved, no new
decision." Record via the D1 decision (new ADR recommended).
- *Acceptance:* §5 defines identity unambiguously; concurrent observers can't tear an instinct file;
  the ADR (new or amended) records the identity choice + atomicity.
- *Verify:* trace two worktrees of one repo, both at obs-20 → no torn frontmatter, lost-update self-heals;
  two clones → separate instinct stores. *(depends on T1's atomicity clause)*

**T5 — store outside sync roots.** §5/X6: add binding sentence — *"and outside any sync/backup root;
recommend `$XDG_STATE_HOME/nxtlvl`."*
- *Acceptance:* §5 carries the constraint; X6 punt now ships the constraint, not just "outside ~/.claude."
- *Verify:* the recommended path is not under a known sync root; append-only JSONL safe.

**→ CHECKPOINT 2:** review the identity key (irreversible once instincts persist) + the D1 new-ADR call.

### Phase D — Lifecycle refinements
**T6 — size gate count OR effect.** X1/§4.4: write a bookmark if (tool-calls ≥ threshold) **OR**
(a commit/file-mutation occurred this session).
- *Acceptance:* X1 updated; terse-pivotal session now bookmarks.
- *Verify:* trace a 3-tool-call one-commit session → bookmark written; "glanced and left" → still skipped.

**T7 — staleness honesty.** §4.4: soften the "real starting point" claim for the crashed long session;
§9: record heal-on-close as the preferred deferred option (per D2).
- *Acceptance:* §4.4 no longer overstates; §9 lists heal-on-close.
- *Verify:* §4.4 text is honest about what the flag does/doesn't reconstruct.

**T8 — concrete recall nudge.** §6/§4.1: the over-ceiling nudge **names the truncated instincts**
("N strong instincts NOT loaded: [x],[y],[z] → /evolve"). Refine ADR-013(floor) consequence.
- *Acceptance:* §6 nudge spec lists names (the best-first list already assembled); ADR-013 updated.
- *Verify:* nudge carries the felt loss, not just a count.

### Phase E — Rationale + trade-off records
**T9 — ecc-faithfulness correction.** ADR-013(floor): strike ecc-faithfulness as the justification for
the *graduation-trigger* decision (keep it for distillation-relocation); state the gap is
accepted-and-mitigated by T8.
- *Acceptance:* ADR-013 rationale separates the sound ecc cite from the appeal-to-reference.
- *Verify:* no remaining "ecc has no ceiling → ceiling has no value" inference for graduation.

**T10 — record the no-pre-steer-eyeball trade-off.** Spec X2 / ADR-013: document the trade-off
explicitly; note the probation flag as optional/deferred (per D3).
- *Acceptance:* X2 trade-off stated; flag recorded as reactive-growth, not built.
- *Verify:* the silent-write-then-steer risk is named, with its ≥0.7+decay mitigation.

### Final — record + verify
**DOC — doc-keeper pass.** Hand all ADR amendments (ADR-004, ADR-006 note, ADR-013, any new
identity/concurrency ADR) to `nxtlvl:doc-keeper` for house-format recording + README index update;
re-run the integrity checks.
- *Acceptance:* every amendment recorded in house format; index consistent.
- *Verify:* `grep -rn '<<<<<<<\|>>>>>>>' docs/` = 0; no duplicate ADR ids; all cross-refs resolve.

**→ CHECKPOINT 3 (final):** human review of the full amended spec + ADR set before merge to `main`.

## Out of scope (recorded, not planned)
- Building heal-on-read auto-distill, the probation flag, or `/digest` — all reactive-growth deferrals.
- Any code/hook implementation — that's a later `/build`, gated by the audit.
