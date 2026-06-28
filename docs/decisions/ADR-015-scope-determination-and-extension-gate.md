---
id: ADR-015
title: "nxtlvl-harness scope determination and extension gate"
status: Accepted
date: 2026-06-28
---

# ADR-015: nxtlvl-harness scope determination and extension gate

## Context

The harness is a project with a defined scope, not a capability that accretes from work signal.
A comprehensive agent harness spans multiple well-understood domains — agent loop, context
assembly, memory, hooks, tools, skills, orchestration, multi-agent, observability, and others —
and the goal is to build across all of them deliberately, informed by what production harnesses
do in each. This is scope determination: a one-time exercise that produces the build backlog.

Scope determination is distinct from capability growth. Once the build backlog is set and the
harness is running, new things will surface during the build and after launch that were not in
the original scope. That is where an extension gate applies — but it governs the residual, not
the primary build path.

The two risks this ADR must hold simultaneously are opposite in nature:

- **Under-scoping**: building a harness that omits whole domains because they weren't in the
  original reactive demand signal. Addressed by deliberate, wiki-informed scope determination.
- **Re-explosion**: a running harness pulling in capabilities beyond its defined scope faster
  than they can be evaluated and hardened. Addressed by a written extension gate.

ADR-003 sets the production standard against which all scope and extension decisions are judged.

### The questions

**1. What domains does a comprehensive agent harness cover?**

There is a known domain map — agent loop, context assembly, memory & state, tool design, skills
& hooks, orchestration, multi-agent structure, observability, prompt strategy, and workflow
substance (dev, review, research, documentation). But the boundaries between domains, what a
production harness typically includes versus defers within each domain, and what the right
first-pass include/defer/exclude call is for nxtlvl in each — all of this is open and requires
querying agents-wiki for a principled domain checklist.

**2. What is the right include/defer/exclude frame?**

Not every domain needs to be built in full before the harness is useful. Some domains have a
thin version that delivers most of the value (build now) and a thick version that can be deferred.
Others may be out of scope entirely given nxtlvl's identity as a CC plugin. The frame for making
those calls — and how it is documented so the build backlog is traceable — is open.

**3. What governs extensions beyond the defined scope?**

During the build and after launch, things will surface that were not in the original domain map.
A new capability should require more than a decision to add it. There should be a written record
of the task that required it and the existing thing that failed or was absent. The form of that
record, where it lives, and how it is enforced without becoming bureaucratic overhead is open.

**4. What triggers hardening an existing capability?**

A capability already in scope that keeps failing in the same way should be revised. What the
signal is — a log of repeat failures, a count of fallbacks, a pattern in the observability data
from [ADR-011](ADR-011-observability-and-metrics.md) — and what the threshold is, is open.

**5. What is the relationship between the extension gate and the labs pipeline?**

[ADR-005](ADR-005-labs-internal-structure.md) will define an incubation pipeline for new
capabilities. Whether the extension gate governs entry into the labs pipeline, entry from labs
into the harness, or both, is open.

### What agents-wiki is being queried on

- What domains does a comprehensive agent harness cover, and what does a production harness
  typically include versus defer in each?
- How do production harnesses make deliberate scope decisions — what is the unit of scope (a
  domain, a capability, a feature), and how are include/defer/exclude calls documented?
- How do production harnesses govern additions beyond their defined scope — what intake or
  membership tests exist, and how are they enforced without becoming bureaucratic?
- What signals do production harnesses use to decide when to harden an existing capability —
  fallback logs, observability data, explicit backlogs?
- Anti-patterns: scope that is too broad (harness bloats before it stands), too narrow (whole
  domains are missing), or extension gates that are bypassed in practice.

## Decision

### 1. Domain map — what a comprehensive agent harness covers

A comprehensive agent harness spans seven component domains plus three cross-cutting
properties. The domain map below comes from querying agents-wiki against the production
harnesses in the reference corpus.

**Component domains:**

| # | Domain | Core concerns |
|---|---|---|
| 1 | Agent loop | Call model → run tools → feed results back → repeat. Loop location (model-owned / outer-runner / local) and loop shape (typed-next-step / durable) are first-class design choices. |
| 2 | Context & memory | Effective-context assembly; lazy-loaded rules/memory; cross-session persistence; compaction vs. reset. |
| 3 | Tools & agent-computer interface | Tool set; deterministic restrictions (deny-rules, not advice); interface designed for a model; tool packaging & gating. |
| 4 | Hooks & governance | Lifecycle-event hooks (deterministic code); observe-and-block on the agent's own tool calls; permission classification (pre-execution safety pass). |
| 5 | Orchestration & multi-agent | Planning/execution separation; context isolation; parallelism; topology choices (planner-generator-evaluator / handoff / crew/role-based). |
| 6 | Skills, commands & persistent config | Modular system prompt; skill preloading; artifact types (CLAUDE.md/AGENT.md, JSON feature/progress lists, session-init, task templates, sprint contracts). |
| 7 | Outward connectivity | MCP (external-tool seam); structured outputs (machine-readable returns). |

**Cross-cutting properties (every harness must hold):**

- **Feedback loops** — non-negotiable; a harness without one is just a prompt with extra
  steps.
- **Forced incrementalism** — one thing at a time; agents that attempt too much lose
  coherence or silently drop requirements.
- **Harness decay** — every component encodes a model limitation; design with a kill
  switch, delete when output holds without it.

**Durable core** (outlasts the scaffolding): loop · context · tools · feedback.

### 2. Include / defer / exclude for nxtlvl-harness

The frame is **domain × depth**: for each domain, decide the thinnest build that delivers
most of the value (build now, first-pass depth), versus a thicker version (defer), versus
capability that is out of scope given nxtlvl's identity as a CC plugin (exclude/native).

The deciding constraints for every call:
- nxtlvl is a CC plugin — it composes above the native loop, not below it (ADR-003).
  Anything the native loop already owns (tool-call dispatch, skill routing, model
  round-trips) is not built; it is composed on.
- ADR-003's production standard: include/defer/exclude calls are traceable to the domain
  map, not to reactive demand.
- The intent doc's whitelist: "Core machinery first; scale machinery reactively."

| Domain | First-pass (build) | Deferred (until log shows need) | Excluded / native |
|---|---|---|---|
| **Agent loop** | Loop *shape* decided (typed-next-step for clarity; durable if session-resumption is required); loop *location* is native CC — not reconstructed (ADR-003). | Durable-loop upgrade if session-persistence need surfaces. | Re-implementing the loop runner itself. |
| **Context & memory** | Budgeted injection policy (what earns a slot); lazy-loaded rules via CLAUDE.md; native CC file-memory extended. Hard rule: every auto-injected block justifies its tokens. | Embedding-retrieval / semantic auto-context (over-engineering for a personal daily driver until the log shows the need). | Replacing native CC memory; a fourth standalone memory system. |
| **Tools & ACI** | Declarative tool gating (deny-rules, not advice); interface kept model-legible. | Tool-bundle packaging if the tool set grows complex. | Rebuilding the tool-call dispatcher. |
| **Hooks & governance** | Lean fail-open hook layer: SessionStart context injection; the fallback-log hook (PreToolUse on Skill/Task); deliberate blocking gates only as whitelisted, kill-switch-equipped, intake-gated entries. | Phased policy governance (six-phase engine) if the harness needs multi-seam safety — defer until the log shows where single-gate isn't enough. | Reconstructing a full policy engine up front; always-on gates not passing the intake test. |
| **Orchestration & multi-agent** | Planning/execution separation in every workflow; parallelism via native Task/Workflow tools; aggregation and stopping criteria set before any fan-out. | Durable worktree orchestration / merge-queue if multi-branch parallel work becomes load-bearing. | Hand-built skill router or agent dispatcher (native always, per ADR-003). |
| **Skills, commands & config** | Modular CLAUDE.md (global + project layers); skills structured per ADR-004/ADR-013; three workflow scaffolds (dev / review / research) as v1 skeletons. | Sprint-contract / evaluator loop if quality feedback shows the need; additional workflow verticals. | ecc's 250+-skill breadth; vendoring without the intake gate. |
| **Outward connectivity** | MCP seam available via native CC (no reconstruction needed); structured outputs per ADR-012. | Custom MCP server if coordination needs exceed what native tools provide. | Rebuilding the MCP protocol layer. |
| **Observability** | Fallback log (hook-written, not manual); dual metric (fallback-rate + session quality). Observability ADR-011 governs production detail. | Richer telemetry once ADR-011 is resolved. | Metrics that require willpower to maintain. |

### 3. The extension gate

Extensions to nxtlvl-harness's defined scope require a **written intake record** — a
backlog entry naming:

1. The task that required the new capability.
2. The existing thing that failed or was absent.

This is the **membership test** from the intent doc, formalized: *Would I want this no
matter what I'm working on this week?* → build now (task-independent machinery). *Only
matters once a specific task names it?* → reactive intake entry required.

**Where the record lives:** a one-line backlog entry in the harness's scope backlog
(created alongside this ADR). The fallback log is the evidence feed that surfaces
candidates; the backlog entry is the acceptance act.

**Enforcement without bureaucracy:** the intake record must be written *before* the
capability is built, not after. The record is one line, not a process: `[date] Task:
<what> · Failure: <what the existing harness couldn't do>`. Gate is passed when the
entry exists. There is no approval step — the user writes the entry and proceeds.

**Scope creep anti-patterns to hold against:**
- Adding a capability because it is interesting, not because a task required it.
- Adding a capability because a harness in the reference corpus has it (the wiki is
  orientation, not a build checklist).
- Skipping the entry because "it's obvious" — the entry is what makes re-explosion
  traceable.

### 4. Hardening trigger

A capability already in scope that keeps failing in the same way is a candidate for
revision. The trigger is:

**N ≈ 2–3 logged recurrences of the same miss for a specific workflow** in the fallback
log constitutes a revision ticket. Workflows are revised on logged repeat-need, never on
inspiration.

The fallback log (hook-written PreToolUse entries) is the substrate. The signal is:
same `ecc-thing-invoked` + same `current-task` cluster appearing ≥ N times. This is not
a manual review — the log provides the evidence; the pattern is visible in the log
without an additional dashboard.

**Hardening scope:** a harden ticket is a *revision* of an existing capability, not an
extension of scope. If the revision requires adding net-new capability, that addition
must first pass the extension gate (§3) before the harden ticket proceeds.

### 5. Relationship between the extension gate and the labs pipeline

ADR-005 governs nxtlvl-labs' internal structure and is pending its own decision. The
extension gate applies to nxtlvl-**harness** scope only. The relationship is:

- **Labs → harness graduation** is a distinct step, not an extension-gate case. A
  capability that was developed inside labs and is ready for promotion into the harness
  crosses the extension gate *once* at graduation: the graduation entry is the intake
  record (task: validated in labs; failure: was not yet in harness scope).
- **Extension gate governs entry into the harness**, not entry into labs. Labs is the
  incubation space; the gate applies when something moves from labs into the daily-driver
  harness.
- This means the gate does **not** constrain what can be explored in labs — labs
  incubation is governed by ADR-005's own rules. The gate fires at the boundary where
  harness scope changes.

## Alternatives Considered

### Include the full domain map up front — build all seven domains to full depth before
calling the harness complete.

- Pros: comprehensive from the start; no deferred capability creates gaps.
- Cons: re-explodes scope before the harness has run a single real session; contradicts
  the core principle from the wiki that the simplest construction should be tried first
  ("Can a single agent handle this task effectively? If yes, don't use workflows at all."
  applies to capability domains too). Most deferred items encode model limitations that
  may not materialize.
- Rejected: the include/defer/exclude frame specifically exists to avoid this.

### A looser gate — "intake entry encouraged but optional."

- Pros: lower friction; faster experimentation.
- Cons: a gate that is optional is not a gate. The intent doc is explicit: "a new skill/
  workflow joins only via a one-line backlog entry." The gate's value is precisely that
  it must be passed, not that it is easy to pass.
- Rejected: the written entry is the minimum viable gate — one line, no approval step,
  no bureaucracy. Making it optional removes the only friction.

### Harden on quality signal rather than fallback log count.

- A session-end quality check (1–5 or "did I have to redo this") is the second half of
  the dual metric, not the harden trigger. Quality signal answers "is the harness
  regressing?"; the fallback log answers "what is the harness missing?" They serve
  different functions.
- The quality check is retained as the anti-gaming counterpart to fallback-rate (per the
  intent doc and ADR-011), not as the harden trigger.

## Consequences

- **The build backlog is traceable.** Every item in the harness build backlog maps to a
  domain in the domain map and an include/defer/exclude call with a stated reason. The
  wiki is orientation; the ADR is the decision.
- **Reactive growth is bounded.** The fallback log generates evidence; the intake entry
  is what converts evidence into scope. This is the mechanism that prevents nxtlvl from
  re-expanding to ecc scale.
- **Hardening is automatic, not heroic.** The threshold (N ≈ 2–3 recurrences) is visible
  in the fallback log without a manual audit step. The harden ticket is generated by the
  signal, not by a periodic review.
- **Labs and harness scope are separate.** ADR-005's graduation contract will formalize
  the labs→harness boundary; this ADR locks the harness side (graduation = one intake
  entry at the crossing).
- **Harness decay is handled by the kill-switch contract.** Every component is built with
  a kill switch (per the hook safety policy in the intent doc and the harness decay
  principle from the wiki). Periodic disable-and-measure is the simplification method;
  the fallback log provides baseline coverage to detect quality loss when a component is
  disabled.
- Recorded per the global decision rule.
