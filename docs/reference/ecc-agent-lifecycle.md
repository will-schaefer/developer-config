# ECC's Agent-Development Lifecycle — distilled, phase by phase

> Built incrementally through a gated review of ecc's agent-development lifecycle. Each phase
> distills what ecc *actually* does, then links to the `nxtlvl` decision (ADR) it produced.
> Companion to [`ecc-agent-vs-skill-scoping.md`](ecc-agent-vs-skill-scoping.md). The decisions
> live in [`../decisions/`](../decisions/); this doc is the *source distillation* behind them.
> This review covers ecc; the same adopt/adapt/reject method is the template for reviewing other
> harnesses later (see the build method in [`../intent/personal-harness.md`](../intent/personal-harness.md)).

The six phases: **Design → Author → Evaluate → Debug → Orchestrate → Operate.**

| # | Phase | Status | Decision |
|---|-------|--------|----------|
| 1 | Design | ✅ reviewed | [ADR-012](../decisions/ADR-012-agent-design-contract.md) |
| 2 | Author | ✅ reviewed | [ADR-013](../decisions/ADR-013-agent-authoring-method.md) |
| 3 | Evaluate | ✅ reviewed | [ADR-014](../decisions/ADR-014-agent-evaluation-model.md) |
| 4 | Debug | ✅ reviewed | [ADR-015](../decisions/ADR-015-agent-debugging-model.md) |
| 5 | Orchestrate | ✅ reviewed | [ADR-016](../decisions/ADR-016-agent-orchestration-model.md) |
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

---

## Phase 2 — Author

**What "author" means in ecc:** the method for writing an executor (command/agent) and the skill
it leans on — eval-first, model-routed, with knowledge injected from a caller-agnostic skill.

**Sources read:**
- `reference/ECC-main/skills/agentic-engineering/SKILL.md:12-64`
- `reference/ECC-main/commands/code-review.md`, `reference/ECC-main/commands/build-fix.md`
- `reference/ECC-main/CLAUDE.md` (the skill-injection convention)

### ecc's doctrine
1. **Injection contract.** Knowledge lives in the skill; the executor is lean and receives the
   skill's conventions at spawn ("pass conventions from the skill into the agent's prompt").
   One-way: skill → executor.
2. **agentic-engineering disciplines.** Done-condition first (eval-first); independently-
   verifiable units (the 15-min rule); model routing (haiku=narrow, sonnet=implement,
   opus=architecture/root-cause); escalate a tier only on a clear reasoning-gap failure; compact
   at milestones, not mid-debug; review AI code for invariants/edges/security, not lint-enforced
   style.
3. **Command shape.** Explicit phases → severity table → binary decision rule → deterministic
   output schema, plus stop-and-ask guardrails.

### nxtlvl decision → [ADR-013](../decisions/ADR-013-agent-authoring-method.md)
- **Adopt:** one-way skill→lean-executor injection (the orchestrator injects the skill at
  delegation); done-condition-first; explicit stop-and-ask guardrails; phased structure +
  deterministic output + a binary decision rule.
- **Adapt:** model-routing heuristic (tiers per ADR-012, escalate only on a reasoning-gap); the
  "15-min unit" → agent-sized / independently-verifiable / one-dominant-risk / clear-done-
  condition; compact at phase boundaries + delegate to isolate context.
- **Reject:** ecc's per-task cost ledger (our metric is fallback × quality, ADR-005);
  re-deriving review/dev substance + gh-coupled command internals.
- Formal eval suites deferred to Phase 3.

---

## Phase 3 — Evaluate

**What "evaluate" means in ecc:** how output quality is measured — a per-task self-rating, a
formal eval-suite discipline, and a tool to compare agent products head-to-head.

**Sources read:**
- `reference/ECC-main/skills/agent-self-evaluation/SKILL.md`
- `reference/ECC-main/skills/eval-harness/SKILL.md`
- `reference/ECC-main/skills/agent-eval/SKILL.md`

### ecc's doctrine — three surfaces wearing one word
1. **`agent-self-evaluation`** — a per-task reflection step. After non-trivial work the agent
   scores its output 1-5 on *accuracy / completeness / clarity / actionability / conciseness*,
   under an **evidence rule** ("show the gap, don't just name it") and sharp anti-patterns
   (everything-is-5, penalizing un-requested scope, re-litigating settled design,
   preference-as-evidence). Explicitly **not a pass/fail gate**.
2. **`eval-harness`** — formal eval-driven development: capability + regression evals,
   code/model/human graders, pass@k ≥ 0.90 / pass^3 = 1.00 thresholds, a `.claude/evals/`
   artifact layout. Standing test-suite machinery for a product.
3. **`agent-eval`** — a benchmark CLI comparing coding-agent *products* (Claude Code vs Aider vs
   Codex) on pass-rate / cost / time / consistency in git worktrees.

### nxtlvl decision → [ADR-014](../decisions/ADR-014-agent-evaluation-model.md)
- **Adapt:** `agent-self-evaluation` as an *advisory* per-task done-condition check, scoped to
  non-trivial work, evidence rule + anti-patterns adopted wholesale. It **defers** to `review`
  (code) and stop-slop (prose) rather than introduce a third rubric, and is **never a gate** —
  because ADR-009 already rejected a self-tunable score as a blocker, so using it as a gate would
  be that rejected thing. This resolves the open question left by ADR-013.
- **Defer (reactive):** `eval-harness` — the eval-first *principle* is already in ADR-013;
  standing pass@k/regression suites are intake-gated machinery (ADR-008) bound to the promotion
  audit (ADR-009), not built now.
- **Reject:** `agent-eval` — a product bake-off, out of scope for one operator on Claude Code;
  its consistency-across-runs nugget is covered by pass^k if ever needed.
- **Result — a layered, non-overlapping quality model:** per-task self-check (advisory) → code
  via `review`, prose via stop-slop → promotion audit (the only block, ADR-009) → fallback ×
  quality north-star (ADR-005).

---

## Phase 4 — Debug

**What "debug" means in ecc:** how a misbehaving agent is diagnosed and recovered — a
runtime-agnostic self-debug workflow, and a full-stack architecture audit for built agent
applications.

**Sources read:**
- `reference/ECC-main/skills/agent-introspection-debugging/SKILL.md` (origin: ecc)
- `reference/ECC-main/skills/agent-architecture-audit/SKILL.md` (origin: oh-my-agent-check)

### ecc's doctrine
1. **`agent-introspection-debugging` — a self-debug workflow, not a hidden runtime.** Four
   phases: Capture (record the failure precisely) → Diagnose (match to a known pattern: loop /
   max-calls, context overflow, ECONNREFUSED, 429, stale file, tests-still-failing) → Contained
   Recovery (the smallest discriminating action) → Introspection Report. Recovery heuristics:
   restate the objective, verify world state, shrink scope, run one discriminating check, *then*
   retry. Honesty rule: never claim auto-healing actions not actually performed through real
   tools.
2. **`agent-architecture-audit` — the 12-layer stack.** System prompt, session history, memory,
   distillation, recall, tool selection/execution/interpretation, answer shaping, platform
   rendering, hidden repair loops, persistence. Failure patterns: wrapper regression, memory
   contamination, tool-discipline failure, rendering/transport corruption, hidden agent layers.
   Output: severity-ranked findings + a typed JSON report; code-first (not prompt-first) fixes.
   Built for a standalone agent *application* with its own wrapper/router/memory/transport.

### Two things wear "audit"
ecc's architecture audit is a **runtime, judgment-based diagnostic**; nxtlvl's promotion gate
(ADR-009) is a **static, objective, binary, build-time gate**. They are different surfaces — the
static-overlap items (dead refs, invalid frontmatter) belong to the gate; the behavioral items
(memory contamination, hidden loops, tool discipline) are debugging. The "hidden repair loop"
layer is already answered by nxtlvl's design: ADR-005 makes fallback logged and explicit, ADR-006
keeps hooks fail-open.

### nxtlvl decision → [ADR-015](../decisions/ADR-015-agent-debugging-model.md)
- **Adopt:** `agent-introspection-debugging` as the in-session self-debug loop (the 4 phases,
  pattern table, recovery heuristics, and no-fake-healing honesty rule); a caller-agnostic skill
  (ADR-013) the orchestrator or a stuck executor invokes, pairing with ADR-013 stop-and-ask and
  ADR-014 self-eval.
- **Adapt:** `agent-architecture-audit` down to a scoped harness-debug lens over only the layers
  nxtlvl owns (prompt-assembly conflict/bloat; context/memory injection per ADR-004/007;
  delegation-not-firing per ADR-012; fallback visibility per ADR-005/006), keeping its
  disciplines wholesale (severity, code/config-first fixes, evidence+confidence, falsify the
  harness layer first).
- **Reject:** the full 12-layer / JSON-envelope product audit on scope (ADR-003/004 — infra we
  don't own).
- **Boundary:** diagnostic, never a gate. Recurring failures route to the fallback log (ADR-005)
  + intake gate (ADR-008), not a new standing audit.

---

## Phase 5 — Orchestrate

**What "orchestrate" means in ecc:** how multi-step, multi-agent work is sequenced — a gated
pipeline, a plan-to-chain emitter, a team Kanban runtime, and an interactive agent picker. This
is where nxtlvl's operating model (ADR-012) lands fully, against ADR-003's "never reconstruct
orchestration."

**Sources read:**
- `reference/ECC-main/skills/orch-pipeline/SKILL.md`
- `reference/ECC-main/skills/plan-orchestrate/SKILL.md`
- `reference/ECC-main/skills/team-agent-orchestration/SKILL.md`
- `reference/ECC-main/skills/team-builder/SKILL.md` (origin: community)

### ecc's doctrine
1. **`orch-pipeline`** — a gated Research → Plan → Implement(TDD) → Review → Commit pipeline. A
   **size classifier** (trivial/small/standard/large) selects which phases run; a security-review
   trigger pulls in the security reviewer on sensitive diffs; **two human gates** stand (after
   Plan, before Commit). Cardinal rule: the wrappers are thin — they classify, choose phases, and
   **delegate** each phase to an existing agent/command; they never re-implement work inline.
2. **`plan-orchestrate`** — reads a plan, tags each step, looks up an agent chain from a
   **tag→chain table**, and emits paste-able `/orchestrate custom "a,b,c" "task"` commands (with
   plugin/legacy namespacing). Generative only.
3. **`team-agent-orchestration`** — a multi-agent **team runtime**: work-item cards, agent Kanban
   (Backlog…Merged), a control pane, an integrator role, cross-session board state. Names real
   failure modes: agent soup, invisible work, board theater, overlapping writes.
4. **`team-builder`** — an interactive picker: discover the roster (`claude agents`), present a
   domain menu, pick ≤5, **fan out in parallel on the native Agent tool**, synthesize.

### Composition vs dispatch runtime — the line ADR-003 draws
Each surface splits into **composition** (which specialists, when, in what gated order, how
briefed) and **dispatch runtime** (the chain-runner, the router table, the control pane). ADR-012
makes the composition ours; ADR-003 keeps the runtime native. The orchestrator's "router" is its
own judgment over a small scoped roster + native description-triggered dispatch — not a tag→chain
table, a `/orchestrate` chain-runner, or a Kanban board.

### nxtlvl decision → [ADR-016](../decisions/ADR-016-agent-orchestration-model.md)
- **Adopt:** the gated, size-classified, delegate-don't-inline pipeline + the two human gates +
  security trigger (orch-pipeline), agent map narrowed to the scoped roster (ADR-012).
- **Adapt:** self-contained delegation briefs (plan-orchestrate Ph3); parallel fan-out +
  synthesis + dynamic discovery on the native Agent tool (team-builder); team failure-mode
  guardrails + worktree isolation for parallel writes (team-agent-orchestration). Per-phase
  quality/recovery reuse ADR-014/ADR-015.
- **Reject:** the `/orchestrate` chain-runner + tag→chain code-gen + namespacing
  (plan-orchestrate); the Kanban control-pane/card/integrator runtime (team-agent-orchestration);
  the interactive picker (team-builder) — all on ADR-003 (don't reconstruct orchestration) +
  single-operator scope.
