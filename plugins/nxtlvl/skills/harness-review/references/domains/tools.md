# Domain Review — Tools / MCP (Mode C rubric)

> Per-domain specialist rubric for the **`harness-review` skill**, Mode C. `SKILL.md` is the spine;
> [`../domain-review.md`](../domain-review.md) is the framework; this file owns the **tools** rubric.
> Neutral: judges a harness's tools on **general best practice for agent tool / MCP design** —
> nxtlvl's own lessons (the action-space model, the observation contract, the error-recovery
> contract) are cited as *rationale for why a checkpoint matters*, never as the bar the reviewed
> harness is scored against.

---

## 1. What this domain is — where to look

A harness's **tools** are what define the agent's **action space** — the verbs it can invoke, the
inputs they accept, the observations they return, and the error surfaces they expose. Tool quality
is the ceiling on completion rate: an agent's output is constrained by **action-space quality,
observation quality, recovery quality, and context-budget quality**. Read, in order:

- **The tool/server registry** — `mcp/` dirs, MCP server definitions, `.mcp.json` / settings `mcpServers`
  blocks, or a manifest listing custom tools. This is ground truth for *what the agent can do*; the
  schemas and handlers are downstream.
- **Each tool's schema** — the input contract (JSONSchema / typed params) and the documented output
  shape. Trust the schema and handler over any prose description.
- **The handler / server code** — how inputs are validated, what the return payload actually looks
  like on success *and* on error, and what side effects fire. The README claims; the handler ships.
- **The naming surface** — the full set of tool names exposed to the model at once. Overlap and
  ambiguity here is a routing problem the model pays for on every turn.

---

## 2. The specialist rubric  (score each 1–5, justify with `file:line`)

**Dominant dimensions: D3 (observation quality) and D4 (error recovery)** — a tool the agent can
*call* but can't *read the result of*, or that fails opaquely with no path forward, caps completion
rate no matter how clean its schema is. A fatal flaw in either caps the overall; don't flat-average
it away.

| # | Dimension | The question it answers | What a 5 looks like | The failure mode (a 1) |
|---|-----------|-------------------------|---------------------|------------------------|
| 1 | **Schema-first narrow inputs** | Are inputs typed, narrow, and explicit, or a catch-all grab-bag? | Each tool takes a small, typed, explicit input schema; one job per tool; no free-form `args`/`command` escape hatch unless isolation is genuinely impossible. | A catch-all tool taking an arbitrary string/blob; untyped params; the schema can't tell the model what's valid. |
| 2 | **Deterministic output shapes** | Can the agent rely on a stable return structure? | Returns are predictable and stable across calls — same keys, same types; the model can parse the result the same way every time. | Output shape varies by code path; sometimes a string, sometimes an object; the agent can't write one parse that holds. |
| 3 | **Observation quality** ⭐ | Does the response tell the agent what happened and what to do next? | Every response carries `status` (success\|warning\|error), a one-line `summary`, actionable `next_actions`, and `artifacts` (paths/IDs) — the agent learns state *and* its next move from the payload. | An opaque blob (raw dump or bare `true`) with no status, no summary, no next step — the agent must guess what just happened. |
| 4 | **Error recovery contract** ⭐ | On failure, can the agent recover without a human? | Every error path returns a **root-cause hint**, a **safe retry instruction**, and an **explicit stop condition** so a loop terminates instead of spinning. | Error-only output: a stack trace or bare non-zero, no cause, no retry guidance, no stop — the agent retries blindly or gives up. |
| 5 | **Granularity & composition** | Is each tool sized to its risk, and do tools compose rather than overlap? | Micro-tools for high-risk ops (deploy / migration / permissions); medium tools for common loops; macro-tools only where round-trip overhead truly dominates; tools compose, don't duplicate. | One mega-tool spanning unrelated jobs; or so many micro-tools for one safe op that round-trips swamp the budget; overlapping verbs. |
| 6 | **Naming stability** | Are tool names stable, explicit, and non-overlapping? | Names are explicit and self-describing; no two tools have confusingly similar semantics; the model can route on the name alone. | Two tools with near-identical names/purposes; vague verbs (`run`, `do`, `process`); names that drift from what the tool does. |
| 7 | **Robustness & safety** | Is the tool safe to call — idempotent, isolated, sane on failure? | Re-calling is safe (idempotent or no-ops cleanly); destructive ops are isolated and guarded; partial failure leaves a recoverable state. | Re-calling double-applies a side effect; a destructive op buried in a broad tool; a crash mid-op leaves corrupt/half-written state. |

---

## 3. What to hunt — the concrete checks

- **Read each input schema** — is it narrow and typed, or a free-form catch-all (`command: string`,
  `args: any`, a single opaque payload)? A grab-bag tool the model can stuff anything into scores
  D1 = 1. *(Why it matters: the action-space model says explicit, narrow inputs are what let the
  model call a tool correctly without trial-and-error.)*
- **The observation audit** — for each tool, find where the success payload is built and check it
  carries `status` + `summary` + `next_actions` + `artifacts`, not just a raw result. A blob with no
  status or next step is a D3 cap. *(Why: the observation contract is how the agent learns state and
  its next move from the payload instead of inferring it.)*
- **The error-path audit** — find every error/throw/reject and ask: *does it hand back a root-cause
  hint, a safe retry instruction, and an explicit stop condition?* Error-only output (trace, bare
  failure) is a D4 cap — it's the single most completion-rate-destroying pattern in a tool surface.
  *(Why: nxtlvl's error-recovery contract exists so a loop can recover or terminate, not spin.)*
- **Overlap sweep** — list all tool names exposed together; flag any two with near-identical
  semantics or confusable names (D6). Overlapping verbs force the model to guess and mis-route.
- **High-risk isolation** — check that deploy / migration / permission / delete ops live in their
  own micro-tools, not folded into a broad tool where the model can trigger them as a side effect
  (D5/D7).
- **Granularity vs round-trips** — flag macro-tools that bundle unrelated jobs (split them) *and*
  swarms of micro-tools for one safe loop where round-trip overhead dominates (merge them) (D5).
- **Idempotence & determinism** — trace whether re-calling double-applies side effects (D7) and
  whether the return shape is stable across code paths (D2).

---

## 4. Partition & signal-vs-demo

- **Partition:** ≲ 4 tools / servers → one deep agent over the whole tool surface. More → one agent
  per server (or per tool-group), each scoring §2 and reporting the schemas/handlers it owns;
  synthesis rolls up. Always read the registry first and pass it to every agent as shared context so
  overlap across groups (D6) is visible.
- **Signal vs demo:** tutorial / teaching harnesses ship a deliberately-trivial example tool
  ("echo", "add two numbers", a hello-world MCP server) purely to demonstrate the wiring. Don't
  score that as craft — note it as demo and judge the *real* tools.

---

## 5. Lessons & gotchas

- **A polished tool description is not a usable tool.** Score the handler's actual return payload —
  on success *and* on error — not the prose. The gap between a confident description and an opaque
  blob output is itself a finding (and usually the most important one).
- **Observation and recovery dominate, not the schema.** A perfectly-typed input schema with an
  opaque, recovery-free output is a worse tool than a loose schema that tells the agent exactly what
  happened and what to do next. Weight D3/D4 accordingly.
- **Catch-all tools trade safety for convenience and the agent pays.** A single grab-bag tool hides
  the action space from the model and turns every call into a guess. Reserve free-form inputs for
  cases where isolating verbs is genuinely impossible — downgrade D1 otherwise.
- **Too many overlapping tools is as bad as too few.** A bloated, redundant surface taxes routing
  every turn; a single mega-tool hides risk. Judge granularity against the op's risk and round-trip
  cost (D5/D6), not against tool count.
- **Error-only output is the classic completion-rate killer.** A tool that returns a bare trace with
  no cause / retry / stop gives the agent nothing to act on — it spins or quits. This is the failure
  mode to hunt first (D4).
- **Cross-check the MCP / schema surface** against current upstream MCP docs before trusting a repo's
  own tool-schema tables or capability lists — they go stale, and a documented schema can drift from
  the handler that ships.
