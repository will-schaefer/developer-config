# Domain Review — Rules / docs / context (Mode C rubric)

> Per-domain specialist rubric for the **`harness-review` skill**, Mode C. `SKILL.md` is the spine;
> [`../domain-review.md`](../domain-review.md) is the framework; this file owns the **rules** rubric.
> Neutral: judges a harness's rules/docs/context on **general best practice for agent-guidance and
> context design** — nxtlvl's own lessons (CLAUDE.md layering, pointers-over-content,
> inform-don't-force, stale-reference risk) are cited as *rationale for why a checkpoint matters*,
> never as the bar the reviewed harness is scored against.

---

## 1. What this domain is — where to look

A harness's **rules / docs / context** are the always-on or on-demand *text* that shapes agent
behavior without executing code — the counterpart to hooks, which execute. They steer the model by
being *read* (loaded into context), not by running. Read, in order:

- **The global instruction file** — `~/.claude/CLAUDE.md` (and any `~/.claude/rules/` it points to).
  This is always on for every session; it sets the baseline behavior.
- **The project instruction file** — `./CLAUDE.md` / `./.claude/CLAUDE.md`. This loads **last** and
  **wins on conflict** with global; it's the harness's own house rules.
- **The rules tree** — `rules/`, `.claude/rules/`, or wherever behavioral conventions live as
  standalone files. Note whether each is *imported/inlined* (always-on, costs budget every turn) or
  referenced by *plain path* (on-demand, loaded only when needed).
- **The docs the agent relies on** — `docs/`, reference material, and any context files the harness
  injects or names. Distinguish docs *for humans* from docs the *agent is told to read*. *(Only the
  latter shape behavior; cross-check that a doc the rules name actually exists and is current.)*

---

## 2. The specialist rubric  (score each 1–5, justify with `file:line`)

**Dominant dimensions: D1 (behavior-shaping effectiveness) and D2 (clarity)** — guidance that
doesn't actually change what the agent does, or that's too vague/ambiguous to act on, is dead weight
no matter how well it's layered. A fatal flaw in either caps the overall; don't flat-average it away.

| # | Dimension | The question it answers | What a 5 looks like | The failure mode (a 1) |
|---|-----------|-------------------------|---------------------|------------------------|
| 1 | **Behavior-shaping effectiveness** ⭐ | Is the guidance actionable enough to change what the agent does? | Concrete, testable directives the model can follow — "branch before committing to main", "cite `file:line`, don't paste blocks" — each shapes a real choice. | Vague aspiration ("write good code", "be thoughtful") that names no action and changes no behavior. |
| 2 | **Clarity** ⭐ | Can a reader tell exactly what to do, with no ambiguity? | Readable, concrete, unambiguous; a newcomer reads a rule and knows the action without guessing. | Dense, contradictory, or so abstract the model fills the gap with its own (wrong) assumptions. |
| 3 | **Layering & precedence** | Are global vs project scope, load order, and conflict resolution clear and consistent? | Scope is explicit; project guidance loads last and wins; precedence is stated where rules could collide; no contradictory directives. | Two rules give opposite instructions with no stated winner; project file silently fights global; precedence left to chance. |
| 4 | **Pointers-over-content & load discipline** | Does it reference files rather than inlining huge blocks, and distinguish always-on from on-demand? | Large content is referenced by `file:line` / plain path (loaded on demand); only the lean essentials are inlined/imported as always-on context. | Big blocks pasted or `@import`-ed into an always-on file, taxing every turn's budget for content needed only occasionally. |
| 5 | **Freshness** | Do the docs/rules still match the current code? | Every named file, function, flag, and path resolves and matches reality; renames/removals were propagated. | Rules cite a renamed skill, a deleted flag, or a moved path — misleading the agent toward something that no longer exists. |
| 6 | **Discoverability / wiring** | Is the rule actually loaded or triggered, or is it dead text? | Behavior-shaping rules live where the runtime loads them (global/project instruction files) or are explicitly imported/named; nothing relies on a file the harness never reads. | A convention sits in an arbitrary file nothing imports — never loaded, so it shapes nothing; dead-on-arrival. |

---

## 3. What to hunt — the concrete checks

- **The aspiration audit** — read each rule and ask: *is this actionable, or just a wish?* A
  directive that names a concrete action and a trigger ("when X, do Y") scores D1 high; "be careful"
  / "write quality code" names no behavior and scores D1 = 1. The dominant test for this domain.
- **The inline-vs-pointer test** — find large content (long code blocks, full file dumps, sprawling
  examples) baked into an always-on file or `@import`-ed in. If a plain-path pointer would do, it's a
  D4 hit. *(Why it matters: inlined/imported content is always-on and costs context budget every
  turn; a plain path is loaded only on demand — pointers-over-content keeps the budget lean.)*
- **The stale-reference hunt** — for every file, function, flag, or path a rule names, confirm it
  still exists and still means what the rule says. A rule that cites a renamed/removed thing misleads
  (D5). *(Why: a rule is only as good as its match to reality — a stale name steers the agent wrong.)*
- **The precedence check** — where two rules could conflict, is the winner stated? Confirm the
  layering model is explicit and conflict-free (D3). *(Why: global is always-on; an `@import`/inlined
  path is inlined-and-always-on while a plain path is on-demand; the project file loads last and wins
  on conflict — guidance that ignores this layering produces silent contradictions.)*
- **The wiring check** — for each behavior-shaping rule, confirm something actually loads it: it's in
  an always-on instruction file, or explicitly imported/named by one. An unreferenced doc that no
  instruction file imports is **not** auto-loaded (arbitrary `~/.claude` files aren't), so it shapes
  nothing — D6 = 1. *(Why: deterministic steering that isn't a code gate belongs in a rule, but a
  rule nothing reads is as dead as an unwired hook.)*
- **Human-doc vs agent-doc split** — separate prose written for humans (fine as-is) from text the
  agent is told to read; only score the latter as behavior guidance.

---

## 4. Partition & signal-vs-demo

- **Partition:** ≲ 4 rule/doc files → one deep agent over the whole rules/docs surface. More → one
  agent per doc-cluster (e.g. the rules tree, the project CLAUDE.md, the agent-facing docs), each
  scoring §2 and reporting the guidance it owns; synthesis rolls up. Always read the global +
  project instruction files first and pass them to every agent as shared context — they set the
  layering every other file inherits.
- **Signal vs demo:** tutorial/scaffold harnesses ship boilerplate `README.md` / `CLAUDE.md` filler
  ("this is an example project", placeholder "describe your project here" stubs). Don't score that as
  craft — note it as demo and judge the *real* behavior-shaping rules.

---

## 5. Lessons & gotchas

- **A long, confident CLAUDE.md is not the same as effective guidance.** Score whether each rule
  changes a real decision, not how authoritative the prose sounds. The most common finding is volume
  masquerading as direction — pages of aspiration that steer nothing.
- **Inlined content is a silent tax.** Anything `@import`-ed or pasted into an always-on file costs
  budget every single turn. Reserve always-on for the lean essentials; push everything else behind a
  plain-path pointer the agent loads only when it needs it.
- **Behavior-shaping belongs in rules, not hooks — but only if loaded.** Deterministic steering that
  isn't a code gate is correctly a rule (the inform-don't-force split). The catch is wiring: a rule
  in a file the runtime never reads is dead. Verify the load path before crediting the rule.
- **Precedence is where harnesses quietly contradict themselves.** Global is always-on; the project
  file loads last and wins on conflict; arbitrary files aren't auto-loaded at all. A rule set that
  doesn't state its precedence will eventually issue two opposite instructions with no resolver —
  downgrade D3.
- **Stale references mislead worse than missing ones.** A rule naming a flag or file that no longer
  exists actively steers the agent toward a dead end. Cross-check every named artifact against the
  current tree before trusting the rule.
