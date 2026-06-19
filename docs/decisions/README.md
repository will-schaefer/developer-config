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
| [004](ADR-004-extend-native-memory.md) | Extend native CC file-memory; build no new memory system — amended (1) separate instinct store outside `~/.claude` for observer-learned instincts; (2) provenance is the ownership boundary: "remember this" → native memory directly, observer never writes there | Accepted (amended 2026-06-19) |
| [005](ADR-005-fallback-log-dual-metric.md) | Hook-written fallback log + dual fallback-rate × quality north-star metric — amended: dual metric is now two automatic readouts (fallback-rate + instinct-confidence distribution); no session quality score | Accepted (amended 2026-06-19) |
| [006](ADR-006-hook-fail-open-gated-blocking.md) | Hooks fail-open on error (absolute); blocking only via the intake gate + kill switches — clarified (2026-06-19): "fail open" = never HALT; liveness record, write-atomicity, and fail-closed-secret invariants hold even on error path | Accepted (clarified 2026-06-19) |
| [007](ADR-007-context-budgeted-injection.md) | Context assembly as a budgeted injection policy — pointers over content, by lifetime; recall quality-gated (≥0.7, best-first, soft ceiling = nudge), bookmark injected as actual words | Accepted · amended by [013](ADR-013-floor-on-demand-backbone.md) + [014](ADR-014-quality-first-over-leanness.md) |
| [008](ADR-008-reactive-growth-intake-gate.md) | Reactive growth governed by a written membership/intake gate | Superseded by [013](ADR-013-floor-on-demand-backbone.md) · amended by [016](ADR-016-confident-core-capability-domains.md) + [014](ADR-014-quality-first-over-leanness.md) |
| [009](ADR-009-objective-invoked-audit-gate.md) | Promotion gated by an objective, binary, *invoked* audit | Accepted (impl. deferred to Phase ≥1) |
| [010](ADR-010-global-decision-rule.md) | A global decision rule governs how decisions are made + recorded; ADR-worthy tier first | Accepted |
| [011](ADR-011-prose-quality-stop-slop.md) | Prose quality governed harness-wide by a vendored stop-slop skill + a condensed always-on chat convention | Accepted |
| [012](ADR-012-agents-execute-skills-hold-knowledge.md) | Agents execute, skills hold knowledge; agent definitions point to a skill as single source of truth (don't restate it) | Accepted |
| [013](ADR-013-floor-on-demand-backbone.md) | Session-lifecycle backbone — always-on automatic floor plus on-demand commands; no close ritual; continuous-learning un-deferred — amended (2026-06-19): recall nudge names truncated instincts; ecc cites separated (floor-relocation vs graduation-trigger); ADR-006 "unchanged" corrected to "clarified" | Accepted (amended 2026-06-19) |
| [014](ADR-014-quality-first-over-leanness.md) | Quality first — size and leanness are backstops, never the objective; amends 007 + 008 | Accepted |
| [015](ADR-015-agent-skill-load-rule-methodology-vs-spawn-target.md) | Agents that front a skill load it only when they run the skill to completion; spawn-target agents must not | Accepted |
| [016](ADR-016-confident-core-capability-domains.md) | Pre-build a bounded confident-core of capability domains (Python, TS/JS, Rust, Frontend, Backend); intake gate governs the rest — amends ADR-008 | Accepted |
| [017](ADR-017-agent-design-contract.md) | Main session orchestrates; agents are scoped specialists on a lean ECC-style contract, realized by the sandbox test | Accepted |
| [018](ADR-018-agent-authoring-method.md) | Authoring = caller-agnostic skill loaded by a lean executor; eval-first disciplines, scoped and reactive | Accepted |
| [019](ADR-019-agent-evaluation-model.md) | Evaluation = advisory per-task self-evaluation that defers to review/stop-slop; formal eval suites stay reactive; gates unchanged | Accepted |
| [020](ADR-020-agent-debugging-model.md) | Debugging = adopt the introspection self-debug loop; scope the architecture audit to owned layers; diagnostic, never a gate | Accepted |
| [021](ADR-021-agent-orchestration-model.md) | Orchestration = adopt the gated delegate-don't-inline pipeline; own the composition, never the dispatch runtime; scoped roster | Accepted |
| [022](ADR-022-agent-operation-model.md) | Operation = gated, interactive, single-operator sessions with an automatic observation floor but no autonomous self-direction; reuse the existing metric, gate, and kill switches | Accepted |
| [023](ADR-023-github-workflow-skill-and-conventions.md) | GitHub workflow standardized — a vendored skill composing `nxtlvl:review`; Conventional Commits, no attribution | Superseded by ADR-024 |
| [024](ADR-024-git-workflows-domain-command-agent-skill.md) | git-workflows shipped as a three-layer `command → agent → skill` domain with an isolated, edit-less executor (`git-workflow-runner`) | Accepted |

| [025](ADR-025-project-identity-observer-concurrency.md) | Project identity = git common directory; atomic writes (tmp + rename) + per-session single-flight observer guard | Accepted (impl. deferred) |

> **Numbering note:** the git-workflows decisions are recorded as ADR-023 (skill + conventions,
> superseded) and ADR-024 (the three-layer domain). They were originally drafted as ADR-012 →
> 015 → 016 on a feature branch; each number was already taken by an unrelated decision accepted
> on `main` first, so they were renumbered to 023–024 on merge to avoid collisions.
