# Spec: stop-slop incorporation into `nxtlvl` (the prose-quality pipeline)

> Design artifact produced via `/brainstorming` (2026-06-17). Consumes the confirmed intent
> [`docs/intent/personal-harness.md`](../intent/personal-harness.md) and the standing decisions
> [ADR-003](../decisions/ADR-003-compose-not-reconstruct.md) (compose/vendor-and-refine),
> [ADR-007](../decisions/ADR-007-context-budgeted-injection.md) (pointers over content),
> [ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md) (reactive growth),
> [ADR-009](../decisions/ADR-009-objective-invoked-audit-gate.md) (objective audit).
> The decision this spec implements is recorded in
> [ADR-024](../decisions/ADR-024-prose-quality-stop-slop.md).
> Status: **DRAFT — awaiting human review.**

## Objective

Make every prose surface `nxtlvl` produces read like a person wrote it, by incorporating the
`anthropic-skills:stop-slop` skill (Hardik Pandya; 8 core rules + a 5-dimension rubric + three
reference files) as a permanent part of the harness. Coverage spans four surfaces — harness docs,
deliverable prose (knowledge-base / LLM-wiki), memory writes, and chat responses — through **two
faces drawn from one vendored source**: a composed edit-pass for the produced artifacts, and a
condensed always-on convention for chat.

This is a **workflow-layer composition** (intent line 41: "compose, don't reconstruct"), not new
plumbing. Orchestration stays native; nothing here is a router or a dispatcher.

## Scope

### In scope
- Vendor `stop-slop` into the plugin as the single canonical source.
- Face A — a composed stop-slop pass on harness docs, deliverable prose, and (lightweight) memory.
- Face B — a condensed always-on chat convention in the global config layer.
- A structural guard so the pass never rewrites required doc scaffolding.
- The spec for an objective audit drift-check (built when `nxtlvl:audit` exists).

### Out of scope
- A Stop hook that scores or rewrites responses — the reactive escalation path, not built now
  (ADR-008). A hook that *rewrites* my output before delivery is **never** built (mangles code
  blocks / tool plans).
- A dedicated KB/wiki writing workflow — deferred (reactive); the on-demand path covers that
  surface until one exists.
- Editing any stop-slop rule on day one — vendor faithfully; refine reactively (ADR-008).
- Building `nxtlvl:audit` itself — backlog item 6, "built last" (intent line 61). This spec only
  specifies the one new check it will inherit.

## Design

### 1. Canonical source (foundation)
Vendor stop-slop into `plugins/nxtlvl/skills/stop-slop/` — `SKILL.md` + `LICENSE` + `references/{phrases,
structures,examples}.md`, copied faithfully (no rule edits; the `LICENSE` is retained verbatim, as
MIT redistribution requires). Exposed as `nxtlvl:stop-slop`,
both model- and user-invokable. This single copy is what both faces draw from, per the
vendor-and-refine rule ([ADR-003](../decisions/ADR-003-compose-not-reconstruct.md)).

### 2. Face A — the composed pass (harness docs, deliverable prose, memory)
A final "run stop-slop" step added to the writing workflows in use now: `/spec`,
`documentation-and-adrs`, and the `brainstorming` flow. (Only `documentation-and-adrs` is vendored
into `nxtlvl` today; `/spec` and `brainstorming` live in the shared skill layers — which form each
gets the step is the vendoring-sequencing open question below.) Surfaces with no workflow yet (ad-hoc
KB/wiki prose) get it by invoking `nxtlvl:stop-slop` on demand, until a KB/wiki workflow exists
to bake it into. Other workflows gain the step **reactively**, when slop actually lands in their
output — not all pre-wired (ADR-008).

**Structural guard.** The pass fixes prose tells only. It never touches required scaffolding:
ADR frontmatter, any ADR section heading (Context / Decision / Alternatives / Consequences, plus
`Implementation` when present), or spec section structure. stop-slop is a prose editor; it is fenced
off from structured-doc skeletons. The pass instruction states this explicitly.

**Memory writes.** The memory protocol gains one line — "apply stop-slop core rules" — rather than
a separate pass; entries are short enough that a one-line rule-reminder in the protocol suffices.
This is memory's light Face A touch (per ADR-024 §2), not a hand-off to Face B, which governs chat.

### 3. Face B — the condensed chat convention (chat responses)
A condensed core-rules block (target ≤ 15 lines) added to global `~/.claude/CLAUDE.md`, always
loaded, so chat prose is shaped from the first token. It is marked as an extract of the vendored
skill and carries a pointer back to `nxtlvl:stop-slop` for the full rules + references.

**Why content, not a pointer.** [ADR-007](../decisions/ADR-007-context-budgeted-injection.md) and
the decision rule (`~/.claude/rules/decisions.md`) both reject inlining content into always-on
context. This is the deliberate exception: a pointer cannot shape prose unless the skill loads, and
chat has no trigger that reliably loads it. The condensed block earns its always-on tokens because
prose-shaping is impossible without them. The mitigation is a size cap — a *soft densification
target*, not a hard line that drops a rule: its floor is **coverage of every core rule**, and it
stays a tight, dense extract (never the full skill) that still covers all of them
([ADR-014](../decisions/ADR-014-quality-first-over-leanness.md)).

**Sync model — literal copy + audit check** (chosen over `@import`). The block is a literal copy in
the global layer; the audit verifies it still matches the skill's core rules. This keeps the
daily-driver layer independent of the workbench path and avoids coupling always-on global context to
a plugin location across the promotion boundary. (`@import` was rejected: it inlines the same way
the decision rule already declined, and adds cross-layer path coupling.)

### 4. Audit drift-check (specified now, built with `nxtlvl:audit`)
A new objective check: the condensed block in global `CLAUDE.md` still **covers** the vendored skill's
core rules — comparison is by rule *coverage* (each core rule represented in the block), not literal
text, since the block is a condensed extract. Coverage is binary and mechanical, so it sits in the
audit's **block-tier**, not the taste/warning tier
([ADR-009](../decisions/ADR-009-objective-invoked-audit-gate.md)). Built when the audit exists
(Phase ≥1); until then, drift is caught by eye at promotion.

### 5. Reactive refinement
Vendor faithfully now; tune a rule only when the fallback log / real use shows it fighting a surface
(for example, a rule that mangles a legitimate ADR phrasing). Each edit is recorded via the intake
gate — a one-line entry naming the task and the rule that failed ([ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md)).

**Anticipated first trigger.** stop-slop core rule 6 ("no em dashes") collides with the em-dash-heavy
ADR/spec house style. It is resolved at the dogfood run — the first real use — as a logged intake
miss, **not** pre-tuned here (the reactive stance ADR-024 chose over tune-to-voice). Optimizing for
agent consumers, the likely refinement is a *surface-scoped subset*: structured internal docs
(ADRs/specs/memory) get the precision rules (cut filler, active voice, be specific, trust readers);
human-facing deliverable prose and chat get the full rubric, including the authenticity rules
(em-dash ban, cut-quotables, vary-rhythm) whose payoff is human perception. Left to the dogfood to
prove, not baked in now.

## Platform facts

| Concern | Resolved value | Status |
|---|---|---|
| stop-slop shape | `SKILL.md` (8 core rules + quick-checks + 1–10 × 5 rubric, revise < 35/50) + `references/{phrases,structures,examples}.md` (the source archive also ships `LICENSE`/`CHANGELOG.md`/`README.md`). MIT, by Hardik Pandya — `LICENSE` is vendored verbatim. | verified (read) |
| Vendor target | `plugins/nxtlvl/skills/stop-slop/` — components live at plugin root (matches the Phase-0 layout). Namespace → `nxtlvl:stop-slop`. | verified (consistent with MVH spec) |
| Always-on vs on-demand `CLAUDE.md` | Global `CLAUDE.md` is always loaded; an `@import` *inlines* a file (same budget cost as inline text), a plain path is on-demand. The condensed block is **inline literal text**, deliberately (Face B). | verified (decision-rule platform note) |
| Global layer ≠ plugin | Global `~/.claude/CLAUDE.md` is not part of plugin promotion and is not version-controlled by this repo (same as the decision rule, `~/.claude/rules/decisions.md`). ADR-024 + this spec are the repo's record. | verified (decision-rule consequence) |
| Exact condensed-block wording | Drafted in `/plan`, not here. Source path for the vendor copy is pinned at build time. | open (plan) |

## Project structure (files touched)

```
Developer/                                        ← workbench repo
├── plugins/nxtlvl/skills/
│   └── stop-slop/                                ← NEW: vendored canonical source
│       ├── SKILL.md                              ←   faithful copy (refine reactively only)
│       ├── LICENSE                               ←   retained verbatim (MIT)
│       └── references/{phrases,structures,examples}.md
├── plugins/nxtlvl/skills/                         ← Face A: a stop-slop step added to the
│   (spec / dev / review / brainstorming flows)    ←   writing workflows in use now
└── docs/
    ├── spec/nxtlvl-stop-slop-pipeline.md         ← this spec
    └── decisions/ADR-024-prose-quality-stop-slop.md  ← the decision record

~/.claude/                                         ← daily driver (global layer; not promoted by plugin)
└── CLAUDE.md                                      ← Face B: the condensed always-on convention (≤15 lines)
                                                   ←   + one line in the memory protocol
```

## Verification strategy

No code framework — verification is **presence + parse + behavior**, gated by eye until the audit
exists:

- **Vendored** — `nxtlvl:stop-slop` is invokable; `SKILL.md` frontmatter, the `LICENSE`, and the three
  references are present and parse; content matches the upstream skill.
- **Face A wired** — `/spec`, `documentation-and-adrs`, and `brainstorming` each name a final
  stop-slop step, and each carries the structural-guard sentence.
- **Structural guard holds** — running the pass on an existing ADR leaves frontmatter and every
  required heading (the four core sections plus `Implementation` when present) intact; only prose
  changes.
- **Face B present + bounded** — the condensed block is in global `CLAUDE.md`, ≤ 15 lines, marked as
  an extract, and points back to the skill.
- **Memory note** — the memory protocol carries the one-line "apply stop-slop core rules."
- **On-demand path** — `nxtlvl:stop-slop` run on an ad-hoc KB/wiki paragraph returns a de-slopped
  draft.
- **Drift-check spec'd** — the audit's future check is written down (block-tier) even though the
  audit is not built.
- **Dogfood** — this spec and ADR-024 are run through the pass once the skill is vendored; it **passes**
  when both contain no core-rule violation except any rule logged (via the intake gate) as
  surface-exempted for structured docs (see §5 — the em-dash rule is the anticipated first such case).

## Boundaries

**Always**
- Vendor stop-slop faithfully first; refine a rule only via a logged intake entry.
- Apply the structural guard whenever the pass touches a structured doc.
- Keep the condensed block a tight extract under its size cap.

**Ask first**
- Editing any vendored stop-slop rule (intake gate).
- Adding the pass to a new workflow (intake gate).
- Escalating Face B to a Stop hook (the reactive belt-and-suspenders path).

**Never**
- A hook that rewrites my output before delivery.
- Restructuring ADR/spec scaffolding via the pass.
- Inflating the condensed block past its budget, or replacing it with the full skill in always-on context.

## Success criteria (binary)

1. **(vendor)** `nxtlvl:stop-slop` is invokable; `SKILL.md`, `LICENSE`, and the three references present and parsing.
2. **(Face A)** `/spec`, `documentation-and-adrs`, `brainstorming` each name a final stop-slop step — in whichever form the vendoring-sequencing open question resolves (vendored into `nxtlvl` vs. augmented in place; `brainstorming` currently lives in the global `~/.claude/` layer, outside this repo per the decision rule, `~/.claude/rules/decisions.md`).
3. **(guard)** The pass run on an existing ADR leaves frontmatter + every section heading (the four core + `Implementation` when present) unchanged.
4. **(Face B)** A ≤15-line extract block is in global `CLAUDE.md`, marked as an extract with a pointer to the skill.
5. **(memory)** The memory protocol carries the one-line stop-slop note.
6. **(on-demand)** `nxtlvl:stop-slop` de-slops an ad-hoc paragraph end to end.
7. **(audit spec)** The coverage-based drift-check is documented as a block-tier item for the future `nxtlvl:audit`.
8. **(reactive)** No stop-slop rule is edited without a logged intake entry naming the triggering task.
9. **(dogfood)** This spec and ADR-024, after the pass, show no core-rule violation except rules logged as surface-exempted; the em-dash collision is resolved via the intake gate at dogfood, not pre-tuned.

## Open questions (resolve in `/plan`, not blocking)

- Exact condensed-block wording and its hard line/token cap.
- The authoritative source path for the vendor copy (pin at build time).
- Whether `documentation-and-adrs` / `brainstorming` are vendored into `nxtlvl` first, or the
  stop-slop step is added to their current (agent-skills / anthropic-skills) form — sequencing for
  the plan, consistent with the reactive-vendoring stance in the MVH spec's Resolved Decision 4.
