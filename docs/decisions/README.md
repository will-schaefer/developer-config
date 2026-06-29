# Architecture Decision Records

Significant, expensive-to-reverse decisions behind `nxtlvl` — the *why* the code and the
intent/spec/plan docs don't capture on their own. New decisions get the next sequential
number. When a decision is superseded it is archived and then deleted once nothing references
it — its replacement is written as a fresh standalone ADR (project lifecycle override — see the
repo `CLAUDE.md`).

Anchors these consume: [`../intent/personal-harness.md`](../intent/personal-harness.md) →
[`../spec/nxtlvl-phase-0-mvh.md`](../spec/nxtlvl-phase-0-mvh.md) →
[`../plan/nxtlvl-phase-0-plan.md`](../plan/nxtlvl-phase-0-plan.md).

| ADR | Decision | Status |
|---|---|---|
| [001](ADR-001-plugin-local-marketplace-packaging.md) | Establish the nxtlvl plugin family: three independent plugins (`nxtlvl-harness`, `nxtlvl-labs`, `nxtlvl-wiki`), three repos, one shared marketplace repo (`nxtlvl-marketplace`); each manages its own dev/prod separation; CC plugin mechanics (promotion = install, git-tag = rollback) carry forward per-repo | Accepted |
| [002](ADR-002-reference-corpus-nxtlvl-wiki.md) | `nxtlvl-wiki` is the sole reference corpus for the harness build — orientation and leads only, never citations; judgment-assisted coverage assessment; no installed fallback plugin | Accepted |
| [003](ADR-003-build-from-scratch.md) | Build nxtlvl from scratch against a production-quality reference standard — plumbing and workflow substance alike built from scratch via source-driven development with `nxtlvl-wiki` as the source (verified at primary source; official docs/Context7 for language-library decisions); orchestrate on native CC through the build, own runtime a deliberate second phase; north star: production-quality, domain-agnostic, revenue-generating capable | Accepted |
| [004](ADR-004-harness-internal-structure.md) | `nxtlvl-harness` internal structure — layers, runtime contracts, and language | Draft |
| [005](ADR-005-labs-internal-structure.md) | `nxtlvl-labs` internal structure — layers, runtime contracts, and language | Draft |
| [006](ADR-006-wiki-internal-structure.md) | `nxtlvl-wiki` internal structure — layers, runtime contracts, and language | Draft |
| [007](ADR-007-memory-architecture.md) | `nxtlvl-harness` memory architecture — stores, ownership, and provenance | Draft |
| [008](ADR-008-context-assembly.md) | `nxtlvl-harness` context assembly — injection policy, organization, and budget | Draft |
| [009](ADR-009-session-lifecycle.md) | `nxtlvl-harness` session lifecycle — automatic actions, human-invoked commands, and the open/close boundary | Draft |
| [010](ADR-010-hook-layer-contract.md) | `nxtlvl-harness` hook layer contract — failure contract, exit codes, kill switches, and event scope | Draft |
| [011](ADR-011-observability-and-metrics.md) | `nxtlvl-harness` observability and metrics — north-star measurement and automatic logging | Draft |
| [012](ADR-012-agent-design-contract.md) | Agent design contract — agents, skills, and the orchestrator/specialist boundary | Draft |
| [013](ADR-013-skill-agent-authoring-model.md) | Skill and agent authoring model — skill files, agent files, and load rules | Draft |
| [014](ADR-014-audit-gate.md) | Audit gate — objective promotion criteria and invocation | Draft |
| [015](ADR-015-scope-determination-and-extension-gate.md) | Scope determination and extension gate — harness domain map, include/defer/exclude frame, and extension gate for additions beyond defined scope | Draft |
| [016](ADR-016-orchestration-model.md) | Orchestration model — composition layer, delegation contract, and human gates | Draft |
| [017](ADR-017-git-workflows-domain.md) | git-workflows domain — three-layer `command → agent → skill` with an isolated executor that runs git/gh but cannot edit source | Draft |
| [018](ADR-018-ideation-domain.md) | Ideation domain — a three-layer domain whose executor is a main-thread orchestrator skill (the interview is interactive) with isolated read-only support agents | Draft |
| [019](ADR-019-project-management-domain.md) | Project-management workflow domain (not a capability domain) — a manage-and-see layer tracking plans over a single-writer state library, with a standalone interactive dashboard | Draft |
| [020](ADR-020-router-endorses-established-items.md) | The skill router endorses only established nxtlvl items; precedence is `nxtlvl → native` (no agent-skills floor) and it goes dark at unowned phases | Draft |
| [021](ADR-021-agent-evaluation-model.md) | Agent evaluation — advisory per-task self-evaluation (five-axis, evidence-bound); formal eval suites stay reactive and intake-gated; never a blocking gate | Draft |
| [022](ADR-022-agent-debugging-model.md) | Agent debugging — an introspection self-debug loop and a scoped architecture-audit lens over owned layers; runtime, diagnostic, never a gate | Draft |
| [023](ADR-023-agent-operation-model.md) | Agent operation — gated, interactive, single-operator sessions; reject autonomous, continuous-loop, and enterprise-fleet runtimes; fold their disciplines into existing gates | Draft |
| [024](ADR-024-deepwiki-orientation-not-evidence.md) | Secondary sources orient but never testify — DeepWiki gives `harness-review` leads, not citable evidence; read-only by withheld tools | Draft |
| [025](ADR-025-context7-testifies-primary-sources.md) | Primary sources testify, version-pinned — Context7 scout claims cite the official doc URL @ version (the witness), not Context7 (the courier) | Draft |
