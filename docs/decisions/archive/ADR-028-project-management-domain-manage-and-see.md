---
id: ADR-028
title: "Ship a Project Management workflow domain as a manage-and-see layer with a standalone interactive dashboard over a single-writer state library"
status: Accepted
date: 2026-06-20
implementation: "Build deferred and phased (Phase 1 = state library + status schema + Status; Phase 2 = dashboard; Phase 3 = Backlog); tracked in a follow-on spec + plan."
---

# ADR-028: Ship a Project Management workflow domain as a manage-and-see layer with a standalone interactive dashboard over a single-writer state library

## Context

nxtlvl's front-door spine is `brainstorm → spec → plan` (the planning-and-task-breakdown workflow). That spine is **terminal at "plan"**: nothing in the harness lets the user see a plan's live state, track progress across plans, or triage new work into an existing plan. The user runs a multi-month harness build with multiple `docs/plan/*` files and several backlog documents (`harness-adopt-backlog`, `hook-gate-backlog`, `skill-intake-backlog`). The proliferation makes the "where are we?" question increasingly hard to answer without opening every file.

Three forces shaped the design space:

1. **Governance constraint:** ADR-016 bounds capability domains at five (Python, TS/JS, Rust, Frontend, Backend) as a deliberate anti-bloat brake. Any new domain must either fit inside that cap or be a workflow/process domain, which are not bounded.

2. **Composition constraint:** ADR-003 (compose-not-reconstruct) and ADR-012 (agents execute, skills hold knowledge) require that PM not re-implement execution. Domain agents (built in the five capability domains and shipped via the git-workflows domain) perform the actual work; PM tracks and visualizes it.

3. **Reference harness contrast:** ecc ships ~15 PM-related commands (`epic-*`, `projects`, `pm2`, etc.); SuperClaude ships a `pm` command + PDCA/reflexion prose split across files; Trellis has native spec+plan+memory integration. All are either over-weight for this harness's size or require external dependencies (GitHub issues backend). The explicit anti-ecc-bloat goal (curated over comprehensive) rules out direct adoption of any of them.

The user asked for a "project management suite" with an interactive visual tool to "see the needed tasks, where we are" — a persistent, writable board rather than a one-shot report.

## Decision

**1. Add a "Project Management" workflow/process domain.** It is explicitly NOT a sixth capability domain; it belongs to the workflow/process tier alongside Ideation (ADR-026) and git-workflows (ADR-024). ADR-016's bounded-five brake does not apply. This classification is the key governance point: if it were filed as a capability domain it would either bump an existing one or require amending ADR-016.

**2. The suite is the manage-and-see layer, not an execution engine.** It tracks, visualizes, and coordinates work. It does NOT drive task execution. Execution responsibility belongs to the domain-specific agents the user builds in the five capability domains; those agents perform the work and ship via the git-workflows domain. PM is a coordination and visibility surface, not a build-driver. An earlier design included an "Execute" capability and a `pm-runner` executor agent; both were removed (see Alternatives Considered).

**3. Scope: three capabilities.**
- **Status** — single-plan board (tasks, owners, states, blockers).
- **Portfolio** — cross-plan overview (how multiple active plans relate).
- **Backlog** — capture → triage → prioritize → promote items into `/plan`.

**4. State model: plan files as durable source of truth; native Task tool as live in-session surface; all writes through a single-writer state library.** Plan files carry a defined **status schema** (Phase-1 deliverable). The state library owns parse↔serialize + atomic write (tmp-rename, per ADR-025's pattern) + version check. Every writer — the dashboard, the `pm-reporter` agent, and external domain agents reporting task completion — goes through the state library. Single-writer discipline eliminates an entire class of corruption bugs at one integration seam.

**5. Visual tool: a standalone local dashboard.** A small Node server (matching the harness's existing Node hook tooling) plus an interactive board UI — chosen as the primary surface because the user wants a persistent tool kept open across work sessions. The dashboard is fully interactive: drag cards, mark done, reprioritize, all with write-back. The two-writer hazard (dashboard and domain agents both mutating plan files concurrently) is resolved in the state library via optimistic concurrency (version check → on conflict: surface to user, dashboard re-fetches). This is handled once, in one module, and reused by every writer.

**6. Components (curated — ~6, contrasting with ecc's ~15):**
- `project-management` skill — PM methodology, state schema reference, compose-not-reconstruct discipline.
- `pm-reporter` agent — read-only; serves Status and Portfolio views.
- State library — the shared parse/serialize/atomic-write/version-check module.
- `Status` command — single-plan board.
- `Portfolio` command — cross-plan overview.
- `Backlog` command — grooming: capture, triage, prioritize, promote to `/plan`.
- `/pm-dashboard` command — launches the local Node server + board UI.

Command names are provisional and will be pinned in the Phase-1 spec.

**7. Composition posture (ADR-003).** The suite reads `/plan` output (does not re-plan). `Backlog` promotes items into `/plan` by invoking the planning domain's conventions. The suite does NOT compose `/git-workflow` itself — shipping moved to the domain agents. `doubt`/`review` and `/doc-keeper` remain available at the broader workflow level, unchanged.

**8. Build order.** Phase 1: state library + status schema + Status (read side). Phase 2: standalone dashboard (Status + Portfolio + write-back). Phase 3: Backlog grooming.

## Alternatives Considered

### PM as a sixth capability domain
- Pros: symmetric with the five existing capability domains; no new tier to explain.
- Cons: trips ADR-016's bounded-five brake; PM is not a coding capability — it is a coordination and visibility layer over the harness's own work.
- Rejected: wrong tier. ADR-016's brake exists precisely to prevent scope creep through capability-domain expansion.

### PM as a meta-PM surface only (manage the nxtlvl build, nothing more)
- Pros: smallest possible scope; no risk of generalizing too early.
- Cons: the harness is already being used for other multi-plan work; scoping to a single project would mean rebuilding the same capability later.
- Rejected: in favor of a general manage-and-see layer over any plan, keeping the harness generally applicable.

### Keep an "Execute" capability / `pm-runner` executor agent
- Earlier design included a capability to drive plan-to-done and a dedicated runner agent.
- Pros: end-to-end automation from plan to shipped.
- Cons: forces PM to know how to execute every kind of work (Python builds, Rust compiles, frontend deploys). Conflates coordination with execution. Makes PM a dependency for every domain agent rather than a peer surface.
- Rejected: execution belongs to domain-specific agents built in the capability domains. Separation of concerns is more valuable than automation convenience. PM tracks; domain agents do.

### State backend = GitHub issues (ecc epic-* style)
- Pros: built-in persistence; distributed; sharable.
- Cons: external dependency; re-imports the ecc bloat pattern (complex issue lifecycle machinery); network-gated; overkill for a single-operator personal harness.
- Rejected.

### State backend = plan files only, no live surface
- Pros: simplest possible; no native Task tool integration.
- Cons: forces manually opening files to see state; defeats the "see the needed tasks" goal.
- Rejected as the full solution, but plan files remain the durable source of truth — the native Task tool adds the live in-session surface on top.

### Visual tool = inline native widget (primary surface)
- Pros: no Node server; no browser; fully in-terminal.
- Cons: ephemeral — disappears when the session ends; not persistent across work sessions. The user explicitly wants a tool kept open.
- Rejected as the *primary* surface. Inline export (e.g. a text-mode snapshot) stays a possible reactive add-on.

### View-only dashboard (no write-back)
- Pros: simpler; eliminates two-writer hazard.
- Cons: forces switching to a command for every state change; the "manage" half of manage-and-see is gutted.
- Rejected: full-interactive dashboard with the single-writer state library mitigation is the right trade-off.

## Consequences

- **New load-bearing artifact: the plan-file status schema.** This is the contract shared by `pm-reporter`, the Node server, the dashboard, and all domain agents that report task completion. It must be defined and locked in Phase 1 before any other component is built.
- **Dependency on domain agents for execution.** Until the five capability domains have built agents, marking tasks done is manual (dashboard-driven or command-driven). This is acceptable — PM tracks; it does not require agents to exist in order to function.
- **Single integration seam for all writes.** The state library absorbs concurrency complexity once. Every new writer (future domain agent, future command) reuses it rather than re-implementing atomic write logic.
- **Curated component count.** ~6 components (vs ecc's ~15 PM commands). Curating hard here is a deliberate signal; PM is where harnesses historically bloat first.
- **Phased build.** Three phases; a Phase-1 spec + plan follow this ADR. Nothing in the existing harness is blocked by deferring PM.
- **Not a gate on the main build.** PM is additive; the existing `brainstorm → spec → plan` spine continues to function independently.

Cross-links:
- [ADR-003](ADR-003-compose-not-reconstruct.md) — compose-not-reconstruct; PM reads `/plan`, does not re-plan.
- [ADR-012](ADR-012-agents-execute-skills-hold-knowledge.md) — agents execute, skills hold knowledge; `pm-reporter` is read-only by design.
- [ADR-014](ADR-014-quality-first-over-leanness.md) — quality-first; curated ~6 components is a quality choice, not a leanness compromise.
- [ADR-016](ADR-016-confident-core-capability-domains.md) — why PM is NOT a capability domain; the five-domain brake and why workflow/process domains are the right tier.
- [ADR-024](ADR-024-git-workflows-domain-command-agent-skill.md) — workflow-domain precedent (three-layer command → agent → skill).
- [ADR-025](ADR-025-project-identity-observer-concurrency.md) — atomic write (tmp + rename) pattern reused by the state library.
- [ADR-026](ADR-026-ideation-domain-orchestrator-skill-isolated-agents.md) — workflow-domain precedent (orchestrator skill + isolated agents).
- Global decision rule: `~/.claude/rules/decisions.md`.
