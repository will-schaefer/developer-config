---
name: nxtlvl-codewhale-analysis
description: "CodeWhale (Rust terminal coding agent, ~3.6/5) — Mode-A review (reference-grade engine on mid-migration drift) + Mode-B adopt/adapt/reject ledger for nxtlvl."
metadata: 
  node_type: memory
  type: reference
  originSessionId: c2198575-74c0-4b7a-866c-afdc0ea94f5c
---

3rd landed whole-harness **Mode-A** harness-review (after [[nxtlvl-deepagents-analysis]] and
[[nxtlvl-hive-analysis]]): **CodeWhale** (Hmbown/CodeWhale, MIT Rust terminal coding agent — TUI+CLI,
model-agnostic across ~25 providers), at `docs/reference/codewhale-analysis.md`. ~**3.6/5**.

**Spine (all 5 fan-out agents converged):** reference-grade *engine craft* on **mid-migration
structural drift**. Robustness is real and excellent — transparent stream-retry vs sleep-resume
disambiguation, corruption-safe auto-compaction, LoopGuard anti-spin, hardened MCP transports,
fail-loud secrets, race-safe SQLite + atomic permissions, untrusted-project-config (tighten-only).
BUT the crate names lie: the real agent loop/runtime/tools/sandbox/MCP all live in a 320K-LOC god-crate
`crates/tui` — NOT in `agent`/`core`/`whaleflow`. Nearly everything load-bearing ships **twice** (two
runtimes, two provider registries, two MCP clients) + a beautifully-typed `whaleflow` workflow DSL that
**nothing executes** (orphan). Same "encoded N×, sourced 0× from a single truth" shape as ruflo/SC —
but here in a *good* harness as built-but-unwired/coexisting-during-migration → the strongest
**counter-example validation** yet of nxtlvl's single-source-the-contract position (it needs a 363-line
CI drift-checker to survive). The 320K tui LOC is a measurement artifact (god-crate + ~half inline
tests, ~97K real ratatui), not UI craft.

**Verified critical finding:** execpolicy tokenizes via bare `split_whitespace()` (`bash_arity.rs:352`)
and never parses shell metacharacters — `git status && rm -rf /` classifies on the trusted first
segment only. The arity dict is safe ONLY on already-split single commands; it is not a shell parser.

**Mining → backlog CW-02…CW-06** (joining CW-01 arity table): CW-02 shell-splitter-before-arity (the
caveat CodeWhale itself fails), CW-03 uniform atomic-write + fail-loud-no-default-on-read, CW-04 memory
prefix-cache-stable placement + "stays OUT" contract, CW-05 profile-built sub-agent toolsets +
non-barriering summary handoff (validates read-only-by-withheld-tools at 20-way scale), CW-06 LoopGuard
anti-spin (inform-don't-force fit). Memory model **confirms nxtlvl's curated-file bet** (curated
markdown, no vector DB, not transcript) — write-heavy by design, the inverse of recall-over-volume.
CC-plugin-compat consumes only the portable `SKILL.md` prose, drops plugin.json/commands/agents/hooks —
nxtlvl's router/gates/hooks are CC-locked by design. NO ADR (all confirm LOCKED positions). Reader-test
passed clean (12 load-bearing citations verified, 0 substantive errors). See [[nxtlvl-harness-adopt-backlog]],
[[nxtlvl-reference-repo-map]], [[nxtlvl-scripts-review-sweep]].

**Mode-B follow-on (same day, `docs/reference/codewhale-distillation.md`)** — adopt/adapt/reject ledger
for nxtlvl across the broad LENS (bash gate · audit/drift · inform-don't-force · no-lying-state · C&M ·
scoped agents · MCP scouts · portability). **Spine: CodeWhale validates nxtlvl by convergence AND
counter-example at once** — almost nothing is a clean Adopt; it's mostly corroboration of LOCKED positions
+ 2 real gap-fillers, both Adapt-not-copy. Highest-value finding = **within-one-repo proof the no-lying-state
rule must be UNIFORM** (same team fixed a secret-wipe LOUD `secrets.rs:515` yet shipped non-atomic config
save `config:2877` + silent-null checkpoint `state:1278`). Refined backlog: **CW-02 sharpened from caveat →
hard ordering dependency (CW-02 *before* CW-01)**; **CW-06 reframed ADOPT→ADAPT** (typed `Block`/`Halt`, not
"error into context"). New rows **CW-07** (binary drift-checker = the shape for §5 objective audit), **CW-08**
(adversarial-stale-input test discipline for C&M counters), **CW-09** (actionable scout degradation:
stderr-tail-in-caveat + retry-once), **CW-10** (only SKILL.md prose is the portable CC-plugin unit). 3
Mode-A citation corrections carried (LoopGuard typed-not-freetext; checkpoint null is state-crate not config;
"MCP elicitation half-wired" UNCONFIRMED — zero `elicit` in tui clone). Still NO ADR. Reader-test clean
(2 phrasing fixes applied: whaleflow grep loose-wording, CW-04 documented-contract caveat).
