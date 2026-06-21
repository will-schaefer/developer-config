# Domain Review — Orchestration / task-flow (Mode C rubric)

> Per-domain specialist rubric for the **`harness-review` skill**, Mode C. `SKILL.md` is the spine;
> [`../domain-review.md`](../domain-review.md) is the framework; this file owns the **orchestration**
> rubric. Neutral: judges how a task flows through a harness on **general best practice for agent
> orchestration** — nxtlvl's own lessons (one front door, route don't duplicate, bounded fan-out,
> inform-don't-force) are cited as *rationale for why a dimension matters*, never as the bar the
> reviewed harness is scored against.
>
> **Cross-cutting, not a component type.** Orchestration is the *flow itself* — entry → routing →
> execution → handoff → termination — that lives across skills, agents, hooks, and rules. This rubric
> scores the spine that connects components; to judge a single component's internals, use its
> component-type rubric. (For a specific *capability's* flow — "the planning capability" — use the
> [`capability`](capability.md) rubric, which composes per-component rubrics; use **orchestration**
> for the harness-wide task lifecycle.)

---

## 1. What this domain is — where to look

A harness's **orchestration** is the path a task takes from the moment it enters to the moment it
finishes: where a user enters, how the harness decides what runs, how components hand off, how it
recovers from failure, and how it stops. The defining question is "does a task *flow* — is there a
front door, a routing decision, and clean handoffs — or is capability scattered across many surfaces
with nothing connecting them?"

Read, in order:
- **The entry points** — the skills/commands/agents/modes a task can start from. Is one the
  documented front door, or are there many equal, unrouted entries?
- **The routing layer** — wherever the harness decides what handles a task: a router skill/agent, a
  dispatch hook, a manifest. Find the *single routing decision*, or confirm its absence.
- **The handoffs** — how one stage feeds the next (spec → plan → build): does stage B consume stage
  A's declared output, or re-derive state from scratch?
- **The flow's source of truth** — an ADR/architecture doc/diagram describing the lifecycle end to
  end, or is the flow only inferable from filenames?
- **The bounds** — loop/recursion/fan-out limits and termination conditions; failure/recovery paths.

---

## 2. The specialist rubric  (score each 1–5, justify with `file:line`)

**Dominant dimension: D2 (routing integrity)** — if a task can't reach the right component, the whole
flow collapses, however good the components are. The recurring "encoded N×, routed 0×, no router"
failure lives here, and a fatal flaw in it caps the overall; don't flat-average it away.

| # | Dimension | The question it answers | What a 5 looks like | The failure mode (a 1) |
|---|-----------|-------------------------|---------------------|------------------------|
| 1 | **Entry-point clarity** | Is there one documented front door, or scattered equal entries? | One canonical entry (skill/command/router); alternatives clearly secondary; the front door is named. | A user faces many equally-named entries with no signal which to use. |
| 2 | **Routing integrity** ⭐ | Does an entering task reach the right component via a real, observable decision? | A single routing decision (router agent / dispatch hook / manifest) sends each task to the right subsystem; the route is traceable in code. | Capability encoded across many surfaces with **no router**; the task is chosen manually or lost; "routes" are prose the model may ignore. |
| 3 | **Single source of truth for the flow** | Is the lifecycle documented once, or scattered across N readmes? | One ADR/architecture doc describes entry → routing → execution → handoff → termination; components link back. | The flow is inferred from filenames; no coherent architecture; copies drift. |
| 4 | **Handoff / composition integrity** | Do stages compose by consuming each other's output, or reimplement? | Stage B consumes stage A's declared artifact by reference via a stable interface; no re-derivation; integration is verified. | Each stage re-scans the repo instead of consuming the prior output; components fork and duplicate work. |
| 5 | **Observability of the flow** | Can you see what task is in flight, where it is, and why? | Structured, machine-readable status/trace per task instance: id, stage, last action, next step. | No visibility; a task runs and you can't tell what it's doing or where it is. |
| 6 | **Failure / recovery posture** | What happens when a stage fails mid-flow? | Failures are caught, logged, and handled per stage; state is preserved for resume; degradation is graceful and announced. | A mid-flow failure crashes the harness or silently drops the task; no recovery path. |
| 7 | **Termination & bound discipline** | Is the flow guaranteed to stop, with bounded fan-out? | Every loop/recursion/fan-out declares a numeric bound and a termination condition; bounds are enforced. | Agents recurse or loop unbounded; fan-out is unlimited; only a manual stop ends the flow. |

---

## 3. What to hunt — the concrete checks

- **The router hunt** (D2) — grep for the routing decision (`router`/`dispatch`/`route`/an entry agent
  that picks a subsystem). Then count how many surfaces *encode* a capability vs. how many *route* to
  it. If capabilities ≥ 2 and routers = 0, that's the canary: **encoded N×, routed 0×**. Distinguish a
  real dispatch (selects/blocks) from a "router" that only prints advisory text the model can ignore.
  *(Why: a capability is only as good as the routing between its copies; without a router, the richest
  surface is unreachable.)*
- **The trace-a-task walk** (D2/D4) — pick one realistic task and write down every hop entry →
  finish. If hops exceed ~3 or require a user decision at each step, routing is weak. At each handoff,
  note the data passed: a reference to the prior artifact (good) vs. a re-scan of repo state (D4 fail).
- **The front-door check** (D1) — list entry points; confirm exactly one is documented as primary.
  Many equal entries with no router compounds the D2 cap.
- **The flow-doc check** (D3) — look for an ADR/architecture doc/diagram covering the full lifecycle;
  trace it against the code. Absence (flow only legible from filenames) caps D3.
- **The bound audit** (D7) — grep for `max.*iteration`/`depth`/`timeout`/fan-out caps; every loop,
  recursion, or agent-spawn site should declare one. Unbounded spawn/recursion is a structural risk.
- **The observability check** (D5) — grep for a per-task status/trace record (an id, current stage,
  last action, next step); confirm it's machine-readable and *per task instance*, not per component
  type. No way to tell what task is in flight or where it is in the flow is a D5 fail.
- **The recovery audit** (D6) — find error handling at stage boundaries; confirm a failed stage is
  caught and state preserved, not silently swallowed (which also hits the relevant component's rubric).

---

## 4. Partition & signal-vs-demo

- **Partition:** orchestration is best read as **one trace plus slices** — a main-thread end-to-end
  task walk (the spine), with fan-out agents each auditing one stage's wiring (entry, routing,
  a handoff, bounds) against §2. Keep the trace on the main thread; it's the central evidence and
  shouldn't be split across agents who each see only one hop.
- **Signal vs demo:** teaching harnesses ship a toy end-to-end example to show the flow; judge the
  *production* path, not the demo. A README's confident architecture diagram is a claim until the
  routing decision is found in code — score the wiring, not the diagram.

---

## 5. Lessons & gotchas

- **"Encoded N×, routed 0×" is the signature failure.** The most common orchestration defect across
  harnesses is a capability written into many surfaces (skill + agent + mode + command) with nothing
  routing between them and no single source of truth. It reads as richness and is actually fragmentation.
  This is the D2 cap.
- **A printed "route" is not routing.** A regex/heuristic that emits steering text the model may ignore
  is advice, not dispatch — and conflates with the inform-don't-force line: orchestration may *route*
  (select what runs) but should not silently *steer* the model mid-task. Score a real selection/block
  as routing; score injected unseen steering as a risk.
- **Handoff by reference beats re-derivation.** Stages that re-scan state instead of consuming the
  prior stage's artifact duplicate work and drift; a declared interface between stages is the mark of
  real composition.
- **Bounds are not optional.** Unbounded fan-out or recursion is a structural hazard even if it hasn't
  bitten yet; a self-spawning agent with no depth limit is a latent runaway.
- **Dead surfaces masquerade as flow.** A behavior-shaping mode/rule the manifest never loads is not
  part of the flow no matter how rich — confirm each stage is actually *wired*, not just present.
