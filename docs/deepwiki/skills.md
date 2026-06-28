# Skills

## Purpose

The `skills/` directory contains 8 nxtlvl skills. Skills are the knowledge layer: they define processes, conventions, and contracts. Agents execute them; commands invoke them. The `nxtlvl-router` skill is the meta-skill that decides which skill (if any) applies to a task.

## Files

| Skill | Role | Status |
|---|---|---|
| `brainstorming` | Front-door ideation → approved design → spec/plan handoff. | Established nxtlvl |
| `documentation-and-adrs` | Record ADRs, specs, plans, changelogs, README updates. | Established nxtlvl |
| `doubt-driven-development` | Adversarial review of non-trivial decisions with typed reviewer output. | Established nxtlvl |
| `github-workflow` | Standardized branch → commit → PR → review → CI → merge loop. | Established nxtlvl |
| `harness-review` | Vendor and analyze external agent harnesses (3 modes). | Established nxtlvl |
| `nxtlvl-router` | Meta-skill: route to the right nxtlvl skill or native handling. | Established nxtlvl |
| `pointer-summary` | Pointers-over-content discipline for multi-file reports. | Established nxtlvl |
| `review` | Five-axis code review (correctness, readability, architecture, security, performance). | Thin wrapper |

## Contracts

### `brainstorming`

- The front door for any creative or build work.
- Hard gate: no implementation action until a design is presented and approved.
- Process: explore context → scope triage → clarify intent → propose 2–3 approaches → present design → approval → spec → plan.
- Spawns `context-scout` (read-only context sweep) and `idea-critic` (pre-approval critique).
- Routes to `interview-me`, `grill-me`, `idea-refine`, `spec-driven-development`, `planning-and-task-breakdown`, and the decision rule as needed.
- Uses the `visualize` MCP for visual/structural questions.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/skills/brainstorming/SKILL.md" />

### `documentation-and-adrs`

- Self-contained; does not call the upstream skill.
- ADR-worthy test: architectural AND expensive-to-reverse.
- House format: YAML frontmatter + Context/Decision/Alternatives/Consequences body.
- Routes facts → specs, methodology → plans, resolved open questions → amend existing ADRs.
- Maintains `docs/decisions/README.md` index; superseded ADRs carry `superseded-by:`.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/skills/documentation-and-adrs/SKILL.md" />

### `doubt-driven-development`

- Self-contained; does not call the upstream skill.
- Five-step cycle: CLAIM → EXTRACT → DOUBT → RECONCILE → STOP.
- The `DOUBT` step spawns `nxtlvl:doubt-reviewer`, which returns JSON conforming to `reviewer-output.schema.json`.
- Stop conditions: trivial findings, 3 cycles, user override, or stall (unchanged artifact).
- Offers cross-model second opinion in interactive sessions (Gemini/Codex CLI) with explicit per-call authorization.
- Recovery table for reviewer failure modes (validation, `cannot_assess`, malformed JSON, stall).

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/skills/doubt-driven-development/SKILL.md" />

### `github-workflow`

- Self-contained; does not call the upstream skills.
- Spine: branch → commit → PR (draft) → review → CI → merge.
- Conventional Commits (`<type>(<scope>): <subject>`, imperative ≤50 chars, no attribution trailers).
- Draft-PR-first; build PR body from the whole branch diff/log.
- Composes `nxtlvl:review` at the review step; language-plural reviewer selection.
- Investigate CI failures, don't just re-run.
- Merge only when CI green and review `APPROVE`.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/skills/github-workflow/SKILL.md" />

### `harness-review`

- Vendors a harness, partitions it into independent domains, fans out read-only analysis, synthesizes a citable artifact.
- Three modes:
  - **A** — general quality + architecture report.
  - **B** — adopt/adapt/reject ledger against a target harness.
  - **C** — deep specialist audit of one domain (component/subsystem/cross-cutting concern).
- Public GitHub repos optionally use `deepwiki-scout` for Phase 2 orientation (leads only, not evidence).
- Per-mode references live in `skills/harness-review/references/`.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/skills/harness-review/SKILL.md" />

### `nxtlvl-router`

- Meta-skill: resolves which nxtlvl skill applies to a task.
- Precedence: `◆ nxtlvl` → native. No general `agent-skills` fallthrough.
- Five named interim exceptions (`‡`) point to upstream skills: `interview-me`, `grill-me`, `idea-refine`, `spec-driven-development`, `planning-and-task-breakdown`.
- Discovery map covers ideation, contract, plan, build, review, ship, document, and harness-review.
- Unowned phases (implementation specifics, testing, debugging, security, performance, CI/CD, observability, shipping) are handled natively.
- Core operating behaviors: pointers over dumped content, surface assumptions, ADRs are advisory, manage confusion actively, push back when warranted, enforce simplicity, verify.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/skills/nxtlvl-router/SKILL.md" />

### `pointer-summary`

- Short skill that enforces pointers-over-content for multi-file reports.
- Format: `path/to/file.ext:LINE — one-line why this matters`.
- Does NOT fire when editing a single file or quoting a user-requested snippet.

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/skills/pointer-summary/SKILL.md" />

### `review`

- Thin wrapper around the upstream `agent-skills:review` workflow.
- Applies nxtlvl conventions: language-plural reviewer selection, surface assumptions, pointers over dumped content.
- Produces a five-axis report (correctness, readability, architecture, security, performance).

<ref_file file="/Users/willschaefer/Developer/nxtlvl/plugins/nxtlvl/skills/review/SKILL.md" />

## Configuration / kill switches

- Skill behavior is controlled by the orchestrator and the agents that execute them.
- `doubt-driven-development` has a 3-cycle bound and explicit cross-model authorization rules.
- `harness-review` has mode-specific parameters (`FOCUS`, `TARGET`/`LENS`, `DOMAIN`).

## Tests

- No dedicated skill tests. Each skill is a prompt/process document validated by the quality of artifacts produced in real usage.
- `doubt-driven-development` has a bundled JSON schema (`reviewer-output.schema.json`) used by `doubt-reviewer`.
- `harness-review` has reference docs under `skills/harness-review/references/`.

## Dependencies

- `brainstorming` → `agents/context-scout.md`, `agents/idea-critic.md`, and upstream/interim ideation skills.
- `documentation-and-adrs` → `docs/decisions/`, `docs/spec/`, `docs/plan/`.
- `doubt-driven-development` → `agents/doubt-reviewer.md`, `reviewer-output.schema.json`.
- `github-workflow` → `agents/git-workflow-runner.md`, `skills/review/SKILL.md`.
- `harness-review` → `agents/deepwiki-scout.md` (optional), references under `skills/harness-review/references/`.
- `nxtlvl-router` → all other nxtlvl skills; upstream interim exceptions.
- `review` → upstream `agent-skills:review` workflow.

## Relevant ADRs / intent

- [ADR-003](../../../docs/decisions/ADR-003-compose-not-reconstruct.md) — compose, don't reconstruct.
- [ADR-012](../../../docs/decisions/ADR-012-agents-execute-skills-hold-knowledge.md) — skills hold knowledge; agents execute.
- [ADR-017](../../../docs/decisions/ADR-017-git-workflows-domain.md) — git-workflows domain.
- [ADR-020](../../../docs/decisions/ADR-020-router-endorses-established-items.md) — router endorses only established items.
- [Intent](../../../docs/intent/personal-harness.md) — operating model, reactive growth, composition layer.

## Open questions / TODOs

- `review` is a thin wrapper; a fully nxtlvl-refined review body is not authored yet.
- `interview-me`, `grill-me`, `idea-refine`, `spec-driven-development`, and `planning-and-task-breakdown` are still interim exceptions (upstream skills). Their nxtlvl bodies are pending.
- `pointer-summary` is broadly applicable but relies on the orchestrator to invoke it; no automated enforcement.
