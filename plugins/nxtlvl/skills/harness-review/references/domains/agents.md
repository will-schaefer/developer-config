# Domain Review — Agents / subagents (Mode C rubric)

> Per-domain specialist rubric for the **`harness-review` skill**, Mode C. `SKILL.md` is the spine;
> [`../domain-review.md`](../domain-review.md) is the framework; this file owns the **agents** rubric.
> Neutral: judges a harness's subagents on **general best practice for subagent design** —
> nxtlvl's own lessons (read-only-by-withheld-tools, pointers-over-content, per-agent read-contract,
> bounded orchestration depth) are cited as *rationale for why a checkpoint matters*, never as the
> bar the reviewed harness is scored against.

---

## 1. What this domain is — where to look

A harness's **agents** are its subagents — scoped personas the runtime spawns in a fresh context to
do one bounded job and return a result, without spending the main thread's context. Each is a
routing contract (frontmatter) plus a system prompt (the job). Read, in order:

- **The frontmatter** — `name`, `description`, `tools` in each agent `*.md`, or the agent block in a
  plugin manifest. This is the **wiring**: the `description` is the trigger the router matches on, and
  `tools:` is the grant. Trust it over any prose claim about what the agent "is for."
- **The system-prompt body** — the actual instructions below the frontmatter. Does it deliver the job
  the description promises: role-framed, concrete, output-shaped, with success criteria?
- **The tool grant** — what the agent *can* do. A read-only role (scout, critic, reviewer) that has
  `Write`/`Edit`/`Bash` is a finding regardless of what the prompt says. Note the absence of `Agent`/
  spawn capability too. *(Cross-check tool names against current upstream — grant syntax drifts.)*

---

## 2. The specialist rubric  (score each 1–5, justify with `file:line`)

**Dominant dimensions: D1 (single clear job) and D2 (system-prompt effectiveness)** — an agent that
owns no coherent responsibility, or whose prompt doesn't actually deliver the job its description
promises, is broken no matter how clean the wiring is. A fatal flaw in either caps the overall;
don't flat-average it away.

| # | Dimension | The question it answers | What a 5 looks like | The failure mode (a 1) |
|---|-----------|-------------------------|---------------------|------------------------|
| 1 | **Single clear job (cohesion)** ⭐ | Does the agent own one responsibility, not a grab-bag? | One crisp job statable in a sentence; everything in the prompt serves it; scope is fenced. | A catch-all "does everything" agent; the prompt sprawls across unrelated duties with no single deliverable. |
| 2 | **System-prompt effectiveness** ⭐ | Does the prompt actually *deliver* the job — not just name it? | Role-framed, concrete, output-shaped, with explicit success criteria and constraints; a fresh model could execute it well. | Vague aspirational prose ("be a great reviewer") with no method, no output shape, no done-condition; the description over-promises what the body delivers. |
| 3 | **Tool-grant least-privilege** | Are only the tools the job needs granted? | The grant is the minimal set; a read-only role (scout/critic/reviewer) gets `Read`/`Grep`/`Glob` and nothing that mutates. | A read-only agent granted `Write`/`Edit`/`Bash`; a blanket `*` / "all tools" grant on a narrow job. |
| 4 | **Context isolation & return shape** | Does it preserve the caller's context — return conclusions, not dumps? | Returns pointers/conclusions (file:line + one-line why), a stated input contract, and a defined output shape; noisy exploration stays in the subagent. | Returns pasted file blocks / raw logs that re-flood the main thread; no input contract; output shape undefined. |
| 5 | **Spawn boundaries** | Does it (correctly) avoid spawning further agents / unbounded fan-out? | A leaf agent doesn't spawn; orchestrators fan out to a bounded, small set and don't recurse; depth is explicit. | An agent spawns sub-agents that spawn sub-agents; unbounded fan-out; no cap on orchestration depth. |
| 6 | **Description & triggering** | Does the frontmatter route the right agent for the right job, without accidental overlap? | The `description` names a distinct trigger; the right agent fires; no two descriptions collide on the same intent. | A vague description that overlaps three siblings → the router picks ambiguously; or so narrow it never fires. |
| 7 | **Clarity & maintainability** | Is the prompt readable and conventionally consistent? | Legible structure, consistent conventions across the agent set, traceable from description → prompt → output. | Opaque wall-of-text prompt; conventions drift agent-to-agent; description and body have diverged. |

---

## 3. What to hunt — the concrete checks

- **The least-privilege audit** — grep agent frontmatter for `tools:` and read each grant against the
  job. A role whose description says "review" / "scout" / "critique" but whose grant includes `Write`,
  `Edit`, or `Bash` is a D3 finding — confirm by the prompt whether mutation is actually used or just
  over-granted. *(Why it matters: nxtlvl's read-only agents — context-scout, idea-critic — get only
  `Read`/`Grep`/`Glob`, so "read-only by withheld tools" is enforced by the grant, not by asking the
  model nicely.)*
- **The description-vs-body test** — does the system prompt actually deliver what the `description`
  promises? An over-promising description on a thin body is the classic D1/D2 cap. Score the body, not
  the tagline.
- **The return-shape check** — read the prompt for what the agent returns. Does it define a
  pointers-over-content output (conclusions + `file:line`), or will it paste blocks back into the
  caller? An agent with no stated output contract re-floods the main thread it was meant to spare
  (D4). *(Why: pointers-over-content is what keeps a subagent's noisy exploration off the main
  thread's context.)*
- **The read-contract check** — does the prompt state what the agent may read / its memory scope? A
  per-agent read-contract makes isolation legible (D4). Its absence isn't fatal but is a maturity tell.
- **The spawn check** — grep for `Agent` / Task-spawn capability in the grant and for spawn language in
  the body. Confirm leaf agents can't recurse and orchestrators are bounded (D5). *(Why: orchestration
  depth should be bounded — a small agent cap, agents don't endlessly spawn agents.)*
- **The overlap check** — diff the `description` lines across the agent set. Two that match the same
  intent are an accidental-routing finding (D6); a catch-all whose description subsumes three others is
  worse.
- **Read-only-in-name-only** — confirm a "read-only" agent *truly* can't mutate: the grant, not the
  prose, is the proof. A prose disclaimer plus a `Write` grant scores by the grant.

---

## 4. Partition & signal-vs-demo

- **Partition:** ≲ 4 agents → one deep agent over the whole `agents/` tree. More → one analysis agent
  per agent-group (build-resolvers, reviewers, orchestrators…), each scoring §2 over its slice and
  reporting the wiring it owns; synthesis rolls up. Always read the full frontmatter set first and pass
  it to every agent as shared context, so overlap (D6) is visible across slices.
- **Signal vs demo:** tutorial/teaching harnesses ship a deliberately-trivial "hello world" example
  agent (a stub persona with an empty or toy prompt) to demonstrate the agent API. Don't score that as
  craft — note it as demo and judge the *real* agents.

---

## 5. Lessons & gotchas

- **The grant is the contract; the prose is a hope.** "This agent only reads" in the body means nothing
  if `tools:` includes `Write`. Score the wiring — a withheld tool is the only enforceable read-only.
- **A long, eloquent system prompt is not an effective one.** Effectiveness (D2) is method + output
  shape + success criteria a fresh model can execute — not word count or aspirational framing. The gap
  between a confident description and a thin body is itself a finding, usually the most interesting one.
- **Cohesion beats capability.** An agent that does one job well outscores one that does five
  adequately; a catch-all caps D1 even if every individual duty is competent. Resist grading breadth as
  strength.
- **Return shape is a context-preservation decision, not a formatting nicety.** An agent that dumps
  files back defeats the reason to spawn it at all — downgrade D4 hard, since the subsystem's whole
  value is isolating context from the caller.
- **Unbounded spawn is a structural hazard, not a style issue.** Agents that spawn agents that spawn
  agents fan out cost and context without a cap — a small explicit orchestration depth is the safe
  posture; flag any path that can recurse.
- **Cross-check the tool-grant syntax and agent-frontmatter fields** against current upstream docs
  before trusting a repo's own conventions — grant formats and frontmatter keys are common sources of
  stale reference material.
