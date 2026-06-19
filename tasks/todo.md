# TODO: nxtlvl Context-&-Memory spec amendments

Branch `docs/cm-spec-amendments` (off `main` @ `c9428ab`; original `fix/adr-007-amended-by-graph`
was merged+deleted without the T1–T10 work). Full detail + acceptance criteria in [plan.md](plan.md).
No code — spec + ADR edits only. `[x]` = done, `[ ]` = open.

## Phase A — foundational invariant
- [x] **T1** §7 fail-open carve-out (liveness + write-atomicity + secret-invariant fail-closed); §10 ADR-006 note
- [x] **CHECKPOINT 1** — folded into final review (single-session pass; spec diff reviewable before merge)

## Phase B — memory model + capture (§4.2)
- [x] **T2** "remember this" → native memory (provenance ownership); §10 ADR-004 second amendment clause
- [x] **T3** secret-scrubbing honest scope: best-effort + scrub output + entropy redactor + fail-closed

## Phase C — storage + observer concurrency (§5)
- [x] **T4** project identity = git common-dir; atomic write (tmp+rename); per-session single-flight; X4 reopened
- [x] **D1** RESOLVED → **new ADR** (ADR-025) for identity/concurrency (plan's recommendation adopted)
- [x] **T5** store "outside any sync/backup root; recommend $XDG_STATE_HOME/nxtlvl" (§5/X6)
- [x] **CHECKPOINT 2** — folded into final review (identity key flagged for scrutiny below)

## Phase D — lifecycle refinements
- [x] **T6** size gate (X1) → count OR effect (commit/file-mutation)
- [x] **T7** §4.4 staleness honesty (softened); §9 records heal-on-close (preferred deferred)
- [x] **D2** RESOLVED → soften now, defer heal-on-close (plan's recommendation adopted)
- [x] **T8** recall nudge names truncated instincts (§6/§4.1); ADR-007/ADR-013 nudge refinement flagged for DOC

## Phase E — rationale + trade-off records
- [x] **T9** ADR-013: strike ecc-faithfulness for the graduation-trigger decision (spec S4-Q4 done; ADR file → DOC)
- [x] **T10** record the silent-write-then-steer trade-off (§7/X2/§9); probation flag deferred
- [x] **D3** RESOLVED → document-only (plan's recommendation adopted)

## Final
- [ ] **DOC** doc-keeper: record ADR amendments in house format (ADR-004 clause 2, ADR-006 note, ADR-013
      refinements, NEW ADR-025 identity+concurrency) + update README index + re-run integrity checks
- [ ] **CHECKPOINT 3** — human review of full amended spec + ADR set before merge to `main`

## Verification gates (run before final review)
- [x] `grep -rn '<<<<<<<\|>>>>>>>' docs/` returns 0
- [ ] no duplicate ADR ids; every id maps to one file (DOC re-verifies)
- [ ] each amended ADR is dated + cross-referenced; README index matches (DOC)
- [x] all T1–T10 markers present in spec (verified post-edit)
