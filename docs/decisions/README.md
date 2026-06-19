# Architecture Decision Records

Significant, expensive-to-reverse decisions behind `nxtlvl` — the *why* the code and the
intent/spec/plan docs don't capture on their own. New decisions get the next sequential
number; superseded ones are kept (never deleted) and marked `Superseded by ADR-XXX`.

Anchors these consume: [`../intent/personal-harness.md`](../intent/personal-harness.md) →
[`../spec/nxtlvl-phase-0-mvh.md`](../spec/nxtlvl-phase-0-mvh.md) →
[`../plan/nxtlvl-phase-0-plan.md`](../plan/nxtlvl-phase-0-plan.md).

| ADR | Decision | Status |
|---|---|---|
| [001](ADR-001-plugin-local-marketplace-packaging.md) | Package as a CC plugin installed via a local marketplace; promotion = install, git-tag = rollback | Accepted |
| [002](ADR-002-ecc-dormant-reference-backstop.md) | Keep `ecc` installed-but-dormant as reference + backstop | Accepted |
| [003](ADR-003-compose-not-reconstruct.md) | Compose on native + agent-skills; reconstruct only the plumbing; never reconstruct orchestration | Accepted |
| [004](ADR-004-extend-native-memory.md) | Extend native CC file-memory; build no new memory system | Accepted |
| [005](ADR-005-fallback-log-dual-metric.md) | Hook-written fallback log + dual fallback-rate × quality north-star metric | Accepted |
| [006](ADR-006-hook-fail-open-gated-blocking.md) | Hooks fail-open on error (absolute); blocking only via the intake gate + kill switches | Accepted |
| [007](ADR-007-context-budgeted-injection.md) | Context assembly as a budgeted injection policy — pointers over content, by lifetime | Accepted · amended by [014](ADR-014-quality-first-over-leanness.md) |
| [008](ADR-008-reactive-growth-intake-gate.md) | Reactive growth governed by a written membership/intake gate | Accepted · amended by [013](ADR-013-confident-core-capability-domains.md) + [014](ADR-014-quality-first-over-leanness.md) |
| [009](ADR-009-objective-invoked-audit-gate.md) | Promotion gated by an objective, binary, *invoked* audit | Accepted (impl. deferred to Phase ≥1) |
| [010](ADR-010-global-decision-rule.md) | A global decision rule governs how decisions are made + recorded; ADR-worthy tier first | Accepted |
| [011](ADR-011-prose-quality-stop-slop.md) | Prose quality governed harness-wide by a vendored stop-slop skill + a condensed always-on chat convention | Accepted |
| [012](ADR-012-agents-execute-skills-hold-knowledge.md) | Agents execute, skills hold knowledge; agent definitions point to a skill as single source of truth (don't restate it) | Accepted |
| [013](ADR-013-confident-core-capability-domains.md) | Pre-build a bounded confident-core of capability domains (Python, TS/JS, Rust, Frontend, Backend); intake gate governs the rest — amends ADR-008 | Accepted |
| [014](ADR-014-quality-first-over-leanness.md) | Quality first — size and leanness are backstops, never the objective; amends 007 + 008 | Accepted |
