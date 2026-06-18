# ECC's Agent-Development Lifecycle — distilled, phase by phase

> Built incrementally through a gated review of ecc's agent-development lifecycle. Each phase
> distills what ecc *actually* does, then links to the `nxtlvl` decision (ADR) it produced.
> Companion to [`ecc-agent-vs-skill-scoping.md`](ecc-agent-vs-skill-scoping.md). The decisions
> live in [`../decisions/`](../decisions/); this doc is the *source distillation* behind them.

The six phases: **Design → Author → Evaluate → Debug → Orchestrate → Operate.**

| # | Phase | Status | Decision |
|---|-------|--------|----------|
| 1 | Design | ✅ reviewed | [ADR-012](../decisions/ADR-012-agent-design-contract.md) |
| 2 | Author | ⏳ pending | — |
| 3 | Evaluate | ⏳ pending | — |
| 4 | Debug | ⏳ pending | — |
| 5 | Orchestrate | ⏳ pending | — |
| 6 | Operate | ⏳ pending | — |

---

## Phase 1 — Design

**What "design" means in ecc:** the shape of an agent *before* it is authored — its definition
contract, its action/observation surface, and how the install is scoped to a repo.

**Sources read:**
- `reference/ECC-main/skills/agent-harness-construction/SKILL.md:12-74`
- `reference/ECC-main/skills/agent-sort/SKILL.md:22-49`
- `reference/ECC-main/skills/ecc-guide/SKILL.md:90-95` (surface ordering)
- Agent anatomy across `reference/ECC-main/agents/*.md` (frontmatter + body)

### ecc's doctrine
1. **The agent contract.** Frontmatter `name` / `description` / `tools` / `model` (+ optional
   `color`). Body = prompt-defense baseline → role / "when invoked" loop → rubric / output
   format → a `see skill:` **pointer**, not embedded knowledge. The `tools:` allowlist *is* the
   design: read-only reviewer vs. write-capable resolver is the sandbox.
2. **Harness-construction discipline.** Agent output quality is constrained by action-space,
   observation, recovery, and context-budget quality. Use narrow schema-first tool inputs;
   return a deterministic shape (`status` / `summary` / `next_actions` / `artifacts`); give every
   error path a root-cause hint + safe retry + **stop condition**; budget context by moving
   guidance into on-demand skills and compacting at phase boundaries (not arbitrary token counts).
3. **Evidence-based scoping (`agent-sort`).** Classify every surface as DAILY (load every session,
   matched to the repo's real stack with cited evidence) or LIBRARY (keep reachable, don't load by
   default). LIBRARY ≠ delete. Don't install what the repo can't use.
4. **Surface ordering (`ecc-guide`).** "Prefer skills as the primary workflow surface"; commands
   only as compatibility shims; "mention agents when delegation is useful." Note: ecc is still
   **agent-heavy** (67 agents) — this ordering is skills-over-*commands*, not a discouragement of
   agents.

### Composition of ecc's 67 agents
~35-40 are per-language or per-domain specialists (cpp, csharp, dart, django, fastapi, flutter,
fsharp, go, harmonyos, java, kotlin, php, python, pytorch, react, rust, swift, typescript, vue +
healthcare, marketing, seo, network ×3, homelab, a11y, mle, database). The genuinely cross-cutting
set is smaller (planner, architect, code-reviewer, code-simplifier, security-reviewer,
silent-failure-hunter, tdd-guide, refactor-cleaner, doc-updater, performance-optimizer, …).

### nxtlvl decision → [ADR-012](../decisions/ADR-012-agent-design-contract.md)
- **Operating model:** main session = lean orchestrator delegating to specialist subagents by
  task; specialists are first-class (not a last resort). Dispatch stays native; composition is
  ours.
- **Scope:** roster bounded to the operator's stacks (Next.js/TS, Python, Rust) + cross-cutting
  generals + agent-building; grown reactively via the intake gate; dormant ecc as the fallback
  library. This is `agent-sort`'s evidence logic applied at the *operator* level — but ecc's
  install machinery is **not** adopted (already covered by ADR-002 + ADR-008).
- **Realization test:** native agent + injected skill by default; custom agent only when isolated
  context / restricted tools / a distinct model tier forces it.
- **Adopted wholesale:** the lean agent contract and the harness-construction authoring checklist.
