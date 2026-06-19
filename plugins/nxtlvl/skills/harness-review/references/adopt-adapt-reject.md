# Mode B — Adopt / Adapt / Reject Ledger (borrow-decision distillation)

> Per-mode reference for the **`harness-review` skill**, Mode B. `SKILL.md` is the shared spine
> (vendor → map → fan-out → reader-test → land); this file owns the **fork**: the LENS contract and
> fan-out payload (§1), the distillation + ledger format (§2), the knobs (§3), and the lessons (§4).
> Read it before your first Mode-B run, or when Phase 3/5 needs more than its summary.
>
> Mode B answers **"what should `TARGET` adopt, adapt, or reject from this harness?"** — it mines the
> reviewed repo for transferable patterns and renders a borrow verdict on each, mapped to the
> surfaces of a harness *you* build or maintain. (For a neutral "how good is it on its own terms,"
> use Mode A → [`general-review.md`](general-review.md).)

---

## 1. The LENS and the fan-out payload

**`TARGET`** (required) is the harness you're deciding *for*. **`LENS`** (required) is the set of
`TARGET` surfaces this repo most plausibly informs — it is **the most important Mode-B parameter**.
Without it the fan-out returns a generic code summary; with it, every finding is mapped against a
decision `TARGET` actually faces. State it explicitly in Phase 0 and **ask the user if it's
unclear** — never guess a lens.

> *Example LENS (from a hooks-focused review): "the target's context-alert hook · its dangerous-bash
> gate · its PreCompact handling · its ideation agents." Each finding gets weighed against one of
> those surfaces.*

On top of the shared Phase-3 elements (read-only mandate, scoped target, claims-vs-wiring discipline,
`file:line` citations — see `SKILL.md`), every Mode-B fan-out agent prompt MUST add:

1. **Decision framing + `TARGET`'s existing positions** — tell the agent it is mining this domain so
   `TARGET` can decide what to borrow, and **give it `TARGET`'s relevant existing positions** (its
   locked decisions, conventions, prior judgments on this surface), not just its build method. This
   is what lets an agent recognize when a *reject validates an existing `TARGET` choice* — the
   highest-value Mode-B output. Without those positions the fan-out can spot a weak pattern but can't
   tie the reject back to a decision `TARGET` already made; with them, "this repo ships full-privilege
   reviewers; `TARGET` already scopes them read-only → reject, validates least-privilege" falls out
   directly.
2. **The LENS** — the specific `TARGET` surfaces to map findings against.
3. **Required output shape** — a structured digest, every claim cited to `file:line`, **ending in an
   explicit Adopt / Adapt / Reject list** keyed to the LENS surfaces:
   - **Adopt** — take roughly as-is; the pattern transfers cleanly.
   - **Adapt** — the idea is right but needs rework to fit `TARGET`'s shape/conventions.
   - **Reject** — not worth borrowing (wrong fit, worse than `TARGET`'s current approach, or unsafe);
     **say why** — a reasoned reject is as valuable as an adopt, and the best findings are often
     contrasts that *validate* a decision `TARGET` already made.

Agents return conclusions, not file dumps — preserve the main thread's context for synthesis.

---

## 2. The distillation + ledger format (Phase 5 output)

Write `docs/reference/<repo>-distillation.md`. Scaffold every header with a placeholder first, then
fill and review each section in turn. Lead with the Phase-4 spine (the cross-cutting borrow finding).

```markdown
> **<repo> — distillation for <TARGET>.** <one-line what-it-is>. Analyzed <date> · <size> ·
> source: <url>. LENS: <the TARGET surfaces>. Method: vendor → parallel read-only fan-out
> (<N> domains) → adopt/adapt/reject synthesis.

## 1. Spine — the headline finding
The single most important takeaway, often a contrast that confirms or challenges a `TARGET`
decision rather than a feature to copy. Lead here.

## N. <Domain> findings   (one numbered section per fan-out domain)
What the domain does, how it works, with verbatim quotes cited to file:line. The transferable
patterns and the non-transferable ones, each reasoned.

## Adopt / Adapt / Reject ledger   (the consolidated verdict)
A table mapping each finding to a LENS surface and a verdict:

| Finding | LENS surface | Verdict | Why / how to apply |
|---------|--------------|---------|--------------------|
| ...     | ...          | Adopt/Adapt/Reject | ... |

## Applying to <TARGET>
The concrete next moves: which adopts are worth queuing, which adapts need design, and any finding
that rises to an architectural decision worth recording (see §4).
```

**Citations:** every claim cites `file:line` from the clone — the verdicts have to be auditable.
**Separate signal from demo:** teaching/demo filler (toy apps, demo domains) is not craft and must
not be mistaken for a borrowable pattern.

---

## 3. Knobs (Mode B)

| Knob | Varies by | Default |
|------|-----------|---------|
| `REPO` | every run | — (required) |
| `TARGET` | the harness you're deciding for | — (required) |
| `LENS` (TARGET surfaces) | what the repo is about | — (required; ask if unclear) |
| Domain partition | repo shape | hooks / agents / skills+commands+periphery (3) |
| Fan-out agent count | partition size | 2–4 |
| Signal-vs-demo filter | teaching/demo vs production repo | on for demo repos |
| Distillation depth | repo richness + LENS overlap | full pipeline; skim for poor targets |

---

## 4. Lessons & gotchas

- **The LENS is everything.** It's what converts a neutral code-read into an adopt/adapt/reject
  judgment. Pass it to every fan-out agent and require the A/A/R list in their output — retrofitting
  the framing during synthesis is far more expensive.
- **The best finding is often a contrast, not a feature.** Budget synthesis time for "what does this
  repo's stance reveal about a decision `TARGET` already made?" A reject that validates an existing
  choice is a real result — **but the fan-out agents can only produce it if you hand them `TARGET`'s
  existing positions** (§1 element 1). Give them the decisions/conventions up front; don't expect
  synthesis to retrofit the validation from a position-blind digest.
- **A reasoned Reject is as valuable as an Adopt.** "Why not" protects `TARGET` from cargo-culting;
  always say the reason.
- **Separate signal from demo first.** Demo/teaching repos optimize for teaching; their toy domains
  are not patterns to borrow.
- **Curate hard on what rises to a decision.** Most findings are notes, not architectural decisions.
  When a borrow finding *is* architectural and expensive to reverse, raise it through whatever
  decision-recording process `TARGET` uses — don't dilute the decision set with every small adopt.
- **Cross-check stale reference material** against current upstream docs before trusting a reviewed
  repo's own tables (they can be incomplete or out of date).
- **Edit wrapped prose carefully** — read the exact line before an `Edit`; match a unique
  single-line token so `old_string` doesn't miss on soft-wrapped paragraphs.
