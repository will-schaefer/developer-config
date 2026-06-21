# Mode A — General Review (neutral deep-dive + scored quality assessment)

> Per-mode reference for the **`harness-review` skill**, Mode A. `SKILL.md` is the shared spine
> (vendor → map → fan-out → reader-test → land); this file owns the **fork**: the scoring rubric
> (§1), the report template (§2), the knobs (§3), and the lessons (§4). Read it before your first
> Mode-A run, or when Phase 3/5 needs more than its summary.
>
> Mode A answers **"how is this harness built, and how good is it?"** — a deep dive into its
> components and strategy, judged on the harness's own terms against good agent-harness practice,
> with no comparison to any other system. (For "what should *my* harness borrow from it," use
> Mode B → [`adopt-adapt-reject.md`](adopt-adapt-reject.md).)

---

## 1. The scoring rubric (shared across all fan-out agents)

Every Phase-3 agent scores its domain on the **same six dimensions** so the scores roll up into one
overall assessment in Phase 4. Score **1–5**, and **justify each score in one line citing
`file:line` evidence** — an unjustified number is noise. Score the **wiring, not the README**.

| # | Dimension | The question it answers | What a 5 looks like |
|---|-----------|-------------------------|---------------------|
| 1 | **Cohesion & purpose** | Does each component have a clear, singular job, and do the parts form a coherent whole? | Every piece has an obvious reason to exist; no grab-bag, no overlap-by-accident. |
| 2 | **Composition & reuse** | Do components compose and share, or duplicate and reinvent? | Shared logic is factored once and referenced; components call each other rather than re-implementing. |
| 3 | **Robustness & safety** | Are fail modes sound — guards, error handling, idempotence, fail-open vs fail-closed chosen deliberately? | Failure paths are explicit and correct for the risk; nothing silently swallows errors or blocks unrecoverably. |
| 4 | **Discoverability & triggering** | Are components reliably invoked? Are descriptions/routing clear enough that the right one fires? | Descriptions are specific and trigger accurately; routing is unambiguous; nothing is dead-on-arrival. |
| 5 | **Clarity & maintainability** | Is it readable, documented, and easy to extend? | A newcomer can follow it; conventions are consistent; docs match the code. |
| 6 | **Effectiveness / fitness** | Does it actually accomplish its stated purpose well, on the evidence? | The shipped behavior demonstrably does the job; claims are backed by wiring, not just prose. |

**Weighting by component type** — the dimensions matter unevenly, so weight to the component:
- **Hooks / automation** → robustness & safety dominate (fail-open vs fail-closed, exit codes, guards).
- **Skills** → discoverability & triggering dominate (the description *is* the trigger), then cohesion.
- **Agents / subagents** → cohesion (single clear job) + effectiveness (does the system prompt deliver).
- **Commands** → clarity + discoverability (argument design, naming).
- **Tools / MCP** → robustness + composition (interface design, error surfaces).
- **Rules / docs / context** → clarity + effectiveness (does the guidance actually shape behavior).

**For a deep single-domain audit, these one-liners bloom into full specialist rubrics** — see Mode
C ([`domain-review.md`](domain-review.md) §2 registry → `domains/<domain>.md`), which now spans more
than these component types (also `scripts`, subsystems like `memory`/`marketplace`, and composed
concerns like `capability`/`orchestration`). Those rubrics are the canonical criteria; this table is
their one-line summary for the whole-harness pass.

Note in the digest which dimensions you weighted up and why — the synthesis needs that to roll a
fair overall score rather than a flat average.

**Overall score (Phase 4):** roll the per-domain scores into an overall 1–5 per dimension plus a
one-line **headline verdict**. Don't just average — a fatal flaw in robustness can cap the overall
even if everything else scores high; say so explicitly when it does.

---

## 2. The report template (Phase 5 output)

Write `docs/reference/<repo>-analysis.md`. Scaffold every header with a placeholder first, then fill
and review each section in turn. Lead with the Phase-4 spine. Adapt the skeleton to what the harness
actually contains — **drop component sections that don't apply** (no hooks → no hooks section), and
add any the harness has that aren't listed.

```markdown
> **<repo> — harness analysis.** <one-line what-it-is>. Analyzed <date> · <size> · source: <url>.
> Scope: <whole harness | FOCUS>. Method: vendor → parallel read-only fan-out (<N> domains) → synthesis.

## 1. Overview & thesis
What the harness is trying to be; the central design strategy that explains how it coheres (the
Phase-4 spine). Lead here — it frames everything below.

## 2. Architecture map
The component inventory and how the parts relate: what talks to what, where control flows, the
domain partition used for analysis. A diagram or table if it helps.

## 3. Component deep-dives   (one subsection per component type PRESENT)
### 3.x Skills / Agents / Commands / Hooks / Tools / Rules & docs
For each: what's there, how it works (cited to file:line), notable patterns, strengths,
weaknesses/risks, and the rubric scores for that domain.

## 4. Strategy & workflow
How a task actually moves through the harness end-to-end: the orchestration model, control flow,
the lifecycle of a request. What the harness optimizes for, and the tradeoffs that buys.

## 5. Quality assessment   (the scored verdict)
- A rubric table: the six dimensions × overall score (1–5) with one-line justification each.
- **Strengths** — what it does genuinely well, with evidence.
- **Weaknesses & risks** — fragilities, gaps, claim-vs-wiring mismatches.
- **Headline verdict** — one paragraph: overall quality, who it's for, what caps it.
```

**Citations:** every non-obvious claim cites `file:line` from the clone. **Separate signal from
demo:** call out teaching/demo filler explicitly so it isn't scored as craft.

---

## 3. Knobs (Mode A)

| Knob | Varies by | Default |
|------|-----------|---------|
| `REPO` | every run | — (required) |
| `FOCUS` | user only cares about part of the harness | — (optional; whole harness) |
| Domain partition | repo shape | hooks / agents / skills+commands+periphery (3) |
| Fan-out agent count | partition size | 2–4 |
| Rubric weighting | component mix | per §1 table |
| Signal-vs-demo filter | teaching/demo vs production repo | on for demo repos |
| Report depth | repo richness | full template; drop empty sections |

---

## 4. Lessons & gotchas

- **Score the wiring, not the README.** A confident philosophy doc is not evidence of a robust hook.
  Where claimed capability and shipped behavior diverge, that gap *is* a finding — usually a hit to
  Effectiveness (dim. 6) and worth its own line in Weaknesses.
- **One rubric, or the scores don't compose.** All fan-out agents must use the §1 dimensions and the
  1–5 scale; otherwise Phase 4 is reconciling apples and oranges instead of rolling up.
- **Don't flat-average the overall.** A fatal robustness flaw can cap the overall score even amid
  high marks elsewhere — say so rather than letting the mean hide it.
- **Separate signal from demo first.** Demo/teaching repos ship deliberate filler (toy apps, demo
  domains); scoring that as craft inflates the verdict.
- **Cross-check stale reference material** — a repo's own tables (e.g. a hook-events table) can be
  incomplete; verify reference-grade claims against current upstream docs before trusting them.
- **Edit wrapped prose carefully** — read the exact line before an `Edit`; soft-wrapped paragraphs
  make `old_string` guesses miss. Match a unique single-line token.
