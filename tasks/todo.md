# TODO: nxtlvl Context-&-Memory spec amendments

Branch `fix/adr-007-amended-by-graph`. Full detail + acceptance criteria in [plan.md](plan.md).
No code — spec + ADR edits only. `[ ]` = open, `[~]` = decision pending.

## Phase A — foundational invariant
- [ ] **T1** §7 fail-open carve-out (liveness + write-atomicity + secret-invariant fail-closed); clarifying note on ADR-006
- [ ] **CHECKPOINT 1** — review invariant wording before dependents

## Phase B — memory model + capture (§4.2)
- [ ] **T2** "remember this" → native memory (provenance ownership); amend ADR-004 (replace "tracked, not built")
- [ ] **T3** secret-scrubbing honest scope: best-effort + scrub output + entropy redactor + fail-closed *(after T1)*

## Phase C — storage + observer concurrency (§5)
- [ ] **T4** define project identity = git common-dir; atomic write (tmp+rename); per-session single-flight; X4 reopened *(after T1)*
- [~] **D1** new ADR vs amend ADR-013 for identity/concurrency — *recommend new ADR*
- [ ] **T5** store "outside any sync/backup root; recommend $XDG_STATE_HOME/nxtlvl" (§5/X6)
- [ ] **CHECKPOINT 2** — review the (irreversible) identity key + D1

## Phase D — lifecycle refinements
- [ ] **T6** size gate (X1) → count OR effect (commit/file-mutation)
- [ ] **T7** §4.4 staleness honesty (soften claim); §9 record heal-on-close
- [~] **D2** soften-only vs build heal-on-close — *recommend soften now, defer heal-on-close*
- [ ] **T8** recall nudge names truncated instincts (§6/§4.1); refine ADR-013

## Phase E — rationale + trade-off records
- [ ] **T9** ADR-013: strike ecc-faithfulness for the graduation-trigger decision *(after T8)*
- [ ] **T10** record the no-pre-steer-eyeball trade-off (X2/ADR-013); probation flag deferred
- [~] **D3** build probation flag vs document trade-off only — *recommend document-only*

## Final
- [ ] **DOC** doc-keeper: record all ADR amendments in house format + update README index
- [ ] **CHECKPOINT 3** — human review of full amended spec + ADR set before merge to `main`

## Verification gates (run before final review)
- [ ] `grep -rn '<<<<<<<\|>>>>>>>' docs/` returns 0
- [ ] no duplicate ADR ids; every id maps to one file
- [ ] each amended ADR is dated + cross-referenced; README index matches
- [ ] every "Verify" step in plan.md traced and passing
